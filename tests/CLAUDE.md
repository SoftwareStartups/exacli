# Tests

## Structure

```text
tests/
├── helpers/
│   ├── mock-client.ts        # asExaClient() — typed cast for partial ExaClient mocks
│   └── process-exit.ts       # stubProcessExit() — throwing process.exit stub
├── unit/
│   └── auth/
│       └── keychain.test.ts  # Credential storage
├── validation.test.ts        # Input validation
├── formatters.test.ts        # Markdown/JSON output
├── commands.test.ts          # CLI command behavior
└── e2e.test.ts               # Real Exa API (requires EXA_API_KEY)
```

## Running Tests

```bash
task test              # All tests (e2e skipped without EXA_API_KEY)
```

## Helpers

- `helpers/process-exit.ts` — `stubProcessExit()` replaces `process.exit` with a throwing stub and returns a `restore()` callback. Use this in any test that exercises code calling `process.exit` so a stray call surfaces as a test failure rather than a silent pass.
- `helpers/mock-client.ts` — `asExaClient(partial)` casts a partial mock object to `ExaClient` for tests, replacing the `as unknown as ExaClient` boilerplate.

## Conventions

- Framework: `bun:test` (Jest-compatible `describe`/`it`/`expect`)
- Test files: `*.test.ts` mirroring `src/` structure
- Test behavior and outcomes, not implementation details
- Add a unit test for every bug fix
- Tests are production code: strict types, no `any`, no shortcuts
- Unit tests must not make network calls
- E2E tests are gated by credential availability
