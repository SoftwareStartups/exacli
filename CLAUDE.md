# Exacli

Bun-native TypeScript CLI for the Exa AI API: search, contents, answers, Exa Agent runs, search monitors, and batches. Zero runtime dependencies; calls the REST API directly, following https://exa.ai/docs/exa-spec.yaml (source of truth for request/response shapes). Websets (`/v0/*`) are out of scope.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXA_API_KEY` | Exa API key (overrides keychain; or use --api-key flag). Also enables live e2e tests in `task test` |

## Commands

```bash
# Setup
bun install                          # Install dependencies
task build                           # Compile TypeScript to build/
task clean                           # Remove build/ and dist/

# Quality
task lint                            # Lint with Biome
task format                          # Format with Biome (write)
task test                            # Run tests (bun test)
task check                           # Lint + typecheck + tests

# Pipelines
task ci                              # Full CI locally: clean -> install -> format:check -> check -> build

# Release
task compile                         # Build standalone binary for current platform
task compile:all                     # Build binaries for all 6 platforms
```

## Architecture

```text
src/
├── index.ts              # Entry point: flag table (parseArgs, strict), command registry, dispatch
├── help.ts               # Top-level and per-command help text
├── client.ts             # Exa REST client: request() (JSON) and stream() (SSE), ExaApiError
├── auth/
│   └── keychain.ts       # OS keychain credential storage (Bun Secrets API)
├── cli/
│   └── commands/         # login.ts / logout.ts
├── commands/
│   ├── types.ts          # CliArgs, API enums, beta tokens, response types
│   ├── search.ts         # POST /search
│   ├── contents.ts       # POST /contents
│   ├── similar.ts        # POST /findSimilar (deprecated by Exa)
│   ├── answer.ts         # POST /answer
│   ├── agent.ts          # /agent/runs (run, get, list, cancel, stop, delete, events)
│   ├── monitor.ts        # /monitors (create, list, get, update, delete, trigger, runs, run, batch)
│   └── batch.ts          # /batches (beta header)
├── formatters/
│   └── markdown.ts       # Markdown output per resource
└── utils/
    ├── options.ts        # Flag -> request body builders (contents, filters, user location, betas)
    ├── validation.ts     # Strict parsers that throw UsageError
    ├── commands.ts       # Output envelope, runCommand error handling
    └── stream.ts         # Renders streamed /answer and /search output
tests/
├── helpers/              # mock-client.ts, process-exit.ts
├── unit/auth/            # keychain.test.ts
├── client.test.ts
├── options.test.ts
├── validation.test.ts
├── formatters.test.ts
├── commands.test.ts
└── e2e.test.ts           # Live API (skipped without EXA_API_KEY)
```

## Updating for API changes

1. Diff the endpoints and schemas in `exa-spec.yaml` against `commands/types.ts` enums and the body builders.
2. Add flags to `STRING_FLAGS`/`BOOLEAN_FLAGS` in `index.ts`, `CliArgs`, `help.ts`, README, llms.txt, and `skills/exacli/`.
3. Beta features need their `Exa-Beta` token (see `types.ts`).
