# Source Code

## Module Guide

- **index.ts** — Entry point. Declares every flag (`BOOLEAN_FLAGS`/`STRING_FLAGS`, parsed with `parseArgs` in strict mode so unknown flags fail), maps `command [subcommand]` to handlers in `COMMANDS`, resolves the API key, and wraps handlers in `runCommand`.
- **help.ts** — `MAIN_HELP` plus `COMMAND_HELP[command]`, shown for `exacli <command> --help` and on usage errors.
- **client.ts** — `createClient(apiKey)` returns `{ request, stream }`. `request(method, path, { body, query, headers })` sends JSON with `x-api-key`; `stream()` POSTs with `Accept: text/event-stream` and yields parsed SSE events. Non-2xx responses throw `ExaApiError` (message, status, tag, requestId) from the API error envelope.

### auth/

OS keychain credential storage via Bun Secrets API: `login` stores key, `logout` removes it. Env var `EXA_API_KEY` overrides stored credential.

### cli/

Auth subcommand handlers: `commands/login.ts` and `commands/logout.ts`.

### commands/

Handlers share the signature `(client, positionals, args: CliArgs) => Promise<void>`. They validate input, build the request body, call the API, and print via `printOutput`. They throw on errors; they never call `process.exit`.

- **search.ts** — `/search`, all search types, synthesized output (`--output-schema`, optional `--stream`)
- **contents.ts** — `/contents` (content options at top level of the body)
- **similar.ts** — `/findSimilar` (deprecated by Exa, still served)
- **answer.ts** — `/answer`, optional streaming
- **agent.ts** — Agent runs, including `--wait` polling and `--stream` events. Replaces the retired Research API
- **monitor.ts** — Search monitors and batch actions (dry run unless `--execute`)
- **batch.ts** — Batch API; every call sends `Exa-Beta: batches-2026-06-06`
- **types.ts** — `CliArgs`, spec enums, beta tokens, and the response shapes the formatters read

### formatters/

**markdown.ts** — One formatter per resource. Only used without `--json`.

### utils/

- **options.ts** — `buildContents` (returns `contents` plus required beta tokens), `buildResultFilters`, `buildUserLocation`, `paginationQuery`, `compact`/`nonEmpty`
- **validation.ts** — `parseNumber`/`parseInteger`/`parseEnum`/`parseJsonObject` (inline JSON or `@file`), `requireArg`. All throw `UsageError`
- **commands.ts** — `printOutput` (envelope or markdown), `printStreamItem`, `logStatus` (stderr), `runCommand`
- **stream.ts** — Renders OpenAI-style completion chunks from `/answer` and `/search` streams

## Key Patterns

- **Spec-first** — Request bodies use the exact field names from `exa-spec.yaml`; unset flags are omitted with `compact()` so the API applies its defaults
- **Output** — Markdown by default; `--json` prints `{"ok":true,"data":<raw API response>}` or `{"ok":false,"error","code"}`. Streams print NDJSON envelopes. Progress goes to stderr
- **Validation at the edge** — Bad flag values fail fast with `UsageError` instead of being silently dropped
