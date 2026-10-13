# Source Code

## Module Guide

- **index.ts** — Entry point. Parses the flags from `commands/types.ts` with `parseArgs` in strict mode (unknown flags fail), maps `command [subcommand]` to handlers in `COMMANDS`, resolves the API key, and wraps handlers in `runCommand`. Usage errors print a JSON envelope with `--json`.
- **help.ts** — `MAIN_HELP` plus `COMMAND_HELP[command]`, shown for `exacli <command> --help` and on usage errors.
- **client.ts** — `createClient(apiKey)` returns `{ request, stream }`. `request(method, path, { body, query, headers })` sends JSON with `x-api-key`; `stream()` POSTs with `Accept: text/event-stream` and yields parsed SSE events. Non-2xx responses throw `ExaApiError` (message, status, tag, requestId) from the API error envelope. Requests time out after 5 minutes. `fetchExternal()` fetches server-supplied URLs (batch results, import uploads) and only allows https.

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
- **websets.ts** — Websets API (`/websets/v0`). Handlers are built with `resourceHandler`/`listHandler` factories; bodies merge `--body <json|@file>` with flag-derived fields (flags win). `webset-import create` also uploads the CSV to the returned `uploadUrl`
- **types.ts** — `BOOLEAN_FLAGS`/`STRING_FLAGS`/`MULTIPLE_FLAGS` (repeatable), the `CliArgs` and `Handler` types derived from them, spec enums, beta tokens, and the response shapes the formatters read

### formatters/

**markdown.ts** — One formatter per resource; Websets resources use the generic `formatResource`/`formatResourceList`. Only used without `--json`.

### utils/

- **options.ts** — `buildContents` (returns `contents` plus required beta tokens), `buildResultFilters`, `buildUserLocation`, `paginationQuery`, `compact`/`nonEmpty`
- **validation.ts** — `parseNumber`/`parseInteger`/`parseEnum`/`parseJsonObject` (inline JSON or `@file`), `parseMetadata` (string values), `pathSegment` (encodes IDs, rejects `.`/`..`), `readTextFile`, `requireArg`. All throw `UsageError`
- **commands.ts** — `printOutput` (envelope or markdown), `printText`/`sanitize` (strip terminal control characters from human output), `printStreamItem`, `logStatus` (stderr), `runCommand`, `exitOnBrokenPipe` (exit 0 when stdout closes early, e.g. piped to `head`)
- **stream.ts** — Renders completion chunks from `/answer` and `/search` streams; a stream without `[DONE]` is an error

## Key Patterns

- **Spec-first** — Request bodies use the exact field names from `exa-spec.yaml`; unset flags are omitted with `compact()` so the API applies its defaults
- **Output** — Markdown by default; `--json` prints `{"ok":true,"data":<raw API response>}` or `{"ok":false,"error","code"}`. Streams print NDJSON envelopes. Progress goes to stderr
- **Validation at the edge** — Bad flag values fail fast with `UsageError` instead of being silently dropped
