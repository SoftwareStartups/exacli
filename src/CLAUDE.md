# Source Code

## Module Guide

- **index.ts** — CLI entry point (arg parsing, help text, command dispatch)
- **client.ts** — Exa SDK wrapper (initializes with API key, exposes typed methods)

### auth/

OS keychain credential storage via Bun Secrets API: `login` stores key, `logout` removes it. Env var `EXA_API_KEY` overrides stored credential.

### cli/

Clerc CLI framework: `app.ts` (command registration), `format.ts` (output formatting).

### commands/

One file per command type:
- **search.ts** — Web search with query, date filters, domain filters
- **contents.ts** — URL content extraction (text, highlights, summary)
- **similar.ts** — Find pages similar to a given URL
- **answer.ts** — AI-powered answers with source citations
- **research.ts** — Async research tasks (create, poll status, list results)
- **types.ts** — Shared command arg interfaces

### formatters/

**markdown.ts** — Formats search results, content, and answers as readable markdown. Default output mode; `--json` flag bypasses formatting for raw JSON.

### utils/

- **commands.ts** — Shared command helpers (error handling, content option building, citation formatting)
- **validation.ts** — Input validation (numbers, URLs, comma-separated string lists)

## Key Patterns

- **Commands return raw results** from the Exa SDK; formatters transform them for display
- **Markdown is the default output** — human-readable, structured. `--json` emits the raw API response
- **Research tasks are async** — `research create` starts a task, `research status` polls it, `research list` shows all tasks
- **Validation at the edge** — `utils/validation.ts` validates CLI input before passing to commands
