---
paths:
  - "**/*.go"
---

## Go

- Module path: `github.com/SoftwareStartups/exacli`
- Go 1.21+ — use `any` alias (not `interface{}`), `min`/`max` builtins where applicable
- `CGO_ENABLED=0` for all builds — no cgo, no external C dependencies
- No third-party libraries beyond what's in go.mod (cobra, go-keyring)

## Packages

- `internal/client` — Exa HTTP client, all response/option types
- `internal/commands` — Cobra command definitions, one file per command; `rootCmd` and `ResolveAPIKey` live in `root.go`
- `internal/formatters` — Output formatting (markdown, JSON, TOON); import client types, never import commands
- `internal/utils` — Pure utility functions (validation, string helpers); no imports from other internal packages

## Error handling

- Commands: print error to stderr via `fmt.Fprintln(os.Stderr, ...)` then `os.Exit(1)` — do not return errors from cobra `RunE` after printing
- Library code (`client`, `formatters`, `utils`): return errors, never call `os.Exit`
- Wrap errors with context: `fmt.Errorf("doing X: %w", err)`

## Naming

- Exported functions use PascalCase: `FormatSearchResults`, `ParseNumber`
- Unexported request body structs use camelCase with `Request` suffix: `searchRequest`
- Test files: `*_test.go` in the same package (white-box testing)

## CLI patterns

- Global flags (`--api-key`, `--json`, `--toon`) are `PersistentFlags` on `rootCmd` — subcommands access them via `cmd.Flags().GetBool("json")`
- API key resolution order: `--api-key` flag → `EXA_API_KEY` env → OS keychain (`ResolveAPIKey`)
- Register subcommands in `init()` via `rootCmd.AddCommand(...)`

## Formatting

- `gofmt` / `go vet` — run `task lint` before committing
- Run `task check` before committing (lint + test)
- Prefer `strings.Builder` for multi-part string construction in formatters
- Table-driven tests with `for _, tc := range cases { t.Run(tc.name, ...) }`

## Output formats

Three mutually exclusive modes checked in order: `asJSON` → `asToon` → markdown (default).
Never name a parameter `json` or `toon` — those shadow package names; use `asJSON`, `asToon`.
