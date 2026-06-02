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
- **search.ts** — Web search. Supports `--type` (auto/fast/instant/keyword/neural/hybrid + deep-lite/deep/deep-reasoning), domain and text filters (`--include-domains`/`--exclude-domains`/`--include-text`/`--exclude-text`), published + crawl date ranges, `--user-location`, `--moderation`, `--autoprompt`, and `--additional-queries` (deep types only)
- **contents.ts** — URL content extraction. Shares the content options below
- **similar.ts** — Find pages similar to a given URL. Shares the content options below
- **answer.ts** — AI-powered answers with source citations. `--model` is `exa` only (`exa-pro` deprecated); also `--stream`, `--system-prompt`, `--user-location`
- **research.ts** — Async research tasks (create, poll status, list results)
- **types.ts** — Shared command arg interfaces

Content options (shared by search/contents/similar via `applyContentOptions`): `--text`
(+`--max-characters`), `--highlights`, `--summary`, `--livecrawl`, `--livecrawl-timeout`,
`--max-age-hours`, `--subpages`, `--subpage-target`, `--extras-links`, `--extras-image-links`.

### formatters/

**markdown.ts** — Formats search results, content, and answers as readable markdown (including subpages and `extras` links/image links when present). Default output mode; `--json` flag bypasses formatting for raw JSON.

### utils/

- **commands.ts** — Shared command helpers (error handling, content option building, citation formatting)
- **validation.ts** — Input validation (numbers, URLs, comma-separated string lists)

## Key Patterns

- **Commands return raw results** from the Exa SDK; formatters transform them for display
- **Markdown is the default output** — human-readable, structured. `--json` emits the raw API response
- **Research tasks are async** — `research create` starts a task, `research status` polls it, `research list` shows all tasks
- **Validation at the edge** — `utils/validation.ts` validates CLI input before passing to commands
