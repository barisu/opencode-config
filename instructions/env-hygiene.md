# Environment Hygiene

## .env handling rules (critical)

Permission rules now block ALL agents from reading `.env` files. You do NOT
have direct access to `.env` content. These files contain secrets (API keys,
tokens, base URLs) that must **never leave the local machine**.

### If you need a secret

- You cannot read `.env` files. If you need to know a secret value, ask the
  user to provide it.
- Reference secrets only by **variable name** (e.g., `OPENCODE_LLAMA_BASEURL`).

### When returning results to a parent (cloud) agent

If you invoke a task and return results to a parent agent that runs on a
**remote / cloud model**:

- Never write raw secret values in task return values, summaries, or messages
  returned to a parent agent.
- Do NOT include `.env` content, raw variable values, or any secret material
  in your return text.
- Instead of `baseURL is http://localhost:8080`, write
  `baseURL is set via OPENCODE_LLAMA_BASEURL`.
- If the parent asks "what is the value?", answer with the variable name
  and location only.

### Rationale

Your output becomes the input context of calling (parent) agents. A cloud-based
parent agent receives everything you return — secrets in your return value
will be transmitted to the cloud provider.

## Python environment management

Prefer `uv` for Python environment and dependency management. `uv` is a
fast, single-binary drop-in for `python -m venv`, `pip`, and `pip-tools`
and handles lockfile-based reproducible installs.

- **Prefer uv for new environments**: Use `uv venv` to create a virtual
  environment and `uv sync` / `uv pip install` for dependency management.
- **Respect existing project tooling**: If the repository already uses
  Poetry, `pip-tools`, `pipenv`, Conda, or another workflow (evidenced by
  `pyproject.toml` settings, `poetry.lock`, `Pipfile.lock`, `requirements.txt`,
  `Makefile` instructions, or CI configuration), follow that workflow. Do
  **not** swap in uv over an established toolchain.
- **Lockfile-first**: When a `uv.lock` exists alongside `pyproject.toml`,
  run `uv sync` rather than `pip install -r requirements.txt` to honour
  exact resolved versions.
- **Do not expose or load `.env` files**: The `.env` handling rules above
  (critical) also apply to Python projects — never read `.env` contents,
  never pass them to parent agents, and never commit `.env` files.
- **`uv run` for reproducibility**: When running a script, test, or tool
  that has project-specific dependencies, prefer `uv run <command>` so
  it executes inside the resolved environment without requiring a
  pre-activated venv.

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
