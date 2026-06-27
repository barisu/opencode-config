# Environment Hygiene

## .env handling rules (critical)

If your permission config allows it, you may have access to `.env` files in
project directories. These files contain secrets (API keys, tokens, base URLs)
that must **never leave the local machine**.

### When reading .env

- You may read `.env` directly using `read` or bash tools.
- Reference secrets only by **variable name** (e.g., `OPENCODE_LLAMA_BASEURL`).
- **Never** write raw secret values in task return values, summaries, or
  messages returned to a parent agent.

### When returning results to a parent (cloud) agent

If you invoke a task and return results to a parent agent that runs on a
**remote / cloud model**:

- Do NOT include `.env` content, raw variable values, or any secret material
  in your return text.
- Instead of `baseURL is http://localhost:8080`, write
  `baseURL is set via OPENCODE_LLAMA_BASEURL`.
- If the parent asks "what is the value?", answer with the variable name
  and location only.

### Rationale

Your output becomes the input context of calling (parent) agents. A cloud-based
parent agent receives everything you return — secrets in your return value
will be transmitted to the cloud provider. Permission rules block direct
`.env` reads on cloud agents, but this indirect path would bypass them.

## GitHub CLI (`gh`) usage

When you need to interact with GitHub (repositories, issues, pull requests,
etc.), use the `gh` CLI tool via bash. The CLI is already authenticated.

**Rules:**

- `gh` commands use a **whitelist** — only explicitly allowed read-only
  operations are permitted. All other `gh` commands are denied.
- Allowed read-only commands:
  - `gh repo view`, `gh issue view`, `gh issue list`
  - `gh pr view`, `gh pr list`, `gh pr diff`
  - `gh search`
  - `gh release list`, `gh release view`
  - `gh run list`, `gh run view`
  - `gh workflow list`, `gh workflow view`
- **Never** use `gh auth` commands (authentication is managed externally).
- **Never** use write/delete operations via `gh` (blocked by whitelist
  permission rules).
- Do **not** assume `gh api` is available (it is blocked).
