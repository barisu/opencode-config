import type { Plugin } from "@opencode-ai/plugin"

const DEFAULT_CONTEXT = 131072
const DEFAULT_OUTPUT = 4096
const FETCH_TIMEOUT_MS = 5000
const ENV_VAR_PATTERN = /^\{env:([^}]+)\}$/

function humanReadableName(id: string): string {
  const trimmed = id.replace(/^~[^/]+\//, "")
  const parts = trimmed.split("/")
  const last = parts[parts.length - 1]
  return last || id
}

const llamaModelDiscoveryPlugin: Plugin = async () => {
  return {
    config: async (cfg) => {
      const llamaConfig = cfg.provider?.["llama.cpp"] as
        | { options?: { baseURL?: string } }
        | undefined

      if (!llamaConfig?.options?.baseURL) return

      let baseURL = llamaConfig.options.baseURL

      const envMatch = ENV_VAR_PATTERN.exec(baseURL)
      if (envMatch) {
        baseURL = process.env[envMatch[1]] || ""
      }

      if (!baseURL) return

      let normalizedBase = baseURL.endsWith("/v1")
        ? baseURL
        : `${baseURL.replace(/\/+$/, "")}/v1`

      const fetchFn = typeof globalThis !== "undefined" && globalThis.fetch
        ? globalThis.fetch
        : fetch

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

        const response = await fetchFn(`${normalizedBase}/models`, {
          signal: controller.signal as AbortSignal,
        })

        clearTimeout(timer)

        if (!response.ok) {
          console.warn(
            `[llama-model-discovery] /v1/models returned status ${response.status}; skipping discovery.`,
          )
          return
        }

        const body = (await response.json()) as {
          object?: string
          data?: Array<{
            id?: string
            object?: string
            created?: number
            owned_by?: string
            meta?: { n_ctx_train?: number }
          }>
        }

        if (body?.object !== "list" || !Array.isArray(body.data)) {
          console.warn("[llama-model-discovery] Unexpected /v1/models response shape; skipping.")
          return
        }

        // Filter to non-empty IDs only (llama-server can return meta entries).
        const discovered: string[] = body.data
          .map(entry => entry.id)
          .filter((id): id is string => !!id && id.length > 0)

        if (discovered.length === 0) {
          console.warn("[llama-model-discovery] No model IDs returned from llama-server; skipping update.")
          return
        }

        const firstId = discovered[0]

        const models = (llamaConfig as { models?: Record<string, unknown> }).models ?? {}
        const existing = { ...(models as Record<string, unknown>) }

        for (const entry of body.data) {
          const id = entry.id
          if (!id) continue

          const meta = entry.meta ?? {}
          const context =
            typeof meta.n_ctx_train === "number" ? meta.n_ctx_train : DEFAULT_CONTEXT

          const modelEntry = {
            id,
            name: humanReadableName(id),
            limit: {
              context,
              output: DEFAULT_OUTPUT,
            },
          }

          existing[id] = modelEntry
        }

        ;(llamaConfig as { models?: Record<string, unknown> }).models = existing

        // Update small_model if it currently points at a llama.cpp model.
        if (typeof cfg.small_model === "string" && cfg.small_model.startsWith("llama.cpp/")) {
          cfg.small_model = `llama.cpp/${firstId}`
        }

        // Update any agent models that currently point at llama.cpp/*.
        if (cfg.agent && typeof cfg.agent === "object") {
          for (const [agentName, agentCfg] of Object.entries(
            cfg.agent as Record<string, unknown>,
          )) {
            if (
              agentCfg &&
              typeof agentCfg === "object" &&
              "model" in (agentCfg as Record<string, unknown>) &&
              typeof (agentCfg as { model?: unknown }).model === "string" &&
              (agentCfg as { model: string }).model.startsWith("llama.cpp/")
            ) {
              ;(agentCfg as { model: string }).model = `llama.cpp/${firstId}`
            }
          }
        }

        console.log(
          `[llama-model-discovery] Discovered ${discovered.length} models from ${normalizedBase}; using "${firstId}" as default.`,
        )
      } catch (err) {
        console.warn(
          `[llama-model-discovery] Failed to discover models from ${normalizedBase}: ${(err as Error)?.message ?? err}`,
        )
      }
    },
  }
}

export default llamaModelDiscoveryPlugin
