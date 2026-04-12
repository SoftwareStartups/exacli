# Tests

## Structure

```text
tests/
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

No shared test helpers — utilities are inline. This is the simplest tool with the simplest test structure.

## Conventions

- Framework: `bun:test` (Jest-compatible `describe`/`it`/`expect`)
- Test files: `*.test.ts` mirroring `src/` structure
- Test behavior and outcomes, not implementation details
- Add a unit test for every bug fix
- Tests are production code: strict types, no `any`, no shortcuts
- Unit tests must not make network calls
- E2E tests are gated by credential availability
