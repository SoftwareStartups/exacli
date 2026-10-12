# Tests

## Structure

```text
tests/
├── helpers/
│   ├── mock-client.ts        # mockClient() / requestCall() — mock request() and stream()
│   └── process-exit.ts       # stubProcessExit() — throwing process.exit stub
├── unit/
│   └── auth/
│       └── keychain.test.ts  # Credential storage
├── client.test.ts            # HTTP client, error envelope, SSE parsing (mocked fetch)
├── options.test.ts           # Flag -> request body builders
├── validation.test.ts        # Input validation
├── formatters.test.ts        # Markdown/JSON output
├── commands.test.ts          # CLI command behavior
├── websets.test.ts           # Websets command requests
└── e2e.test.ts               # Real Exa API (requires EXA_API_KEY)
```

## Running Tests

```bash
task test              # All tests (e2e runs live calls when EXA_API_KEY is set, e.g. from .env)
```

## Helpers

- `helpers/process-exit.ts` — `stubProcessExit()` replaces `process.exit` with a throwing stub and returns a `restore()` callback. Command handlers throw instead of exiting; use this only for `runCommand` tests.
- `helpers/mock-client.ts` — `mockClient(respond, events)` builds an `ExaClient` whose `request()` returns `respond(method, path, options)` and whose `stream()` yields `events`. `requestCall(m, i)` returns the arguments of the i-th request, so tests assert the exact method, path, and body sent to the API.

## Conventions

- Framework: `bun:test` (Jest-compatible `describe`/`it`/`expect`)
- Test files: `*.test.ts` mirroring `src/` structure
- Test behavior and outcomes, not implementation details
- Add a unit test for every bug fix
- Tests are production code: strict types, no `any`, no shortcuts
- Unit tests must not make network calls
- E2E tests are gated by credential availability
