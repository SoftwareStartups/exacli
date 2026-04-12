# Exacli

Go CLI for the Exa AI search API. Semantic search, content extraction, AI answers, and automated research. Statically linked, zero runtime dependencies.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXA_API_KEY` | Exa API key (or use --api-key flag or `exacli login`) |

## Commands

```bash
# Setup
go mod download                      # Download dependencies

# Development
task build                           # Build binary to build/exacli
task clean                           # Remove build/ and dist/

# Quality
task lint                            # go vet ./...
task test                            # go test ./...
task check                           # Lint + tests

# Pipelines
task ci                              # Full CI: clean -> check -> build

# Release
task compile                         # CGO_ENABLED=0 binary for current platform -> dist/exacli
task compile:all                     # Binaries for all 8 platforms -> dist/
task compile:native                  # Platform-suffixed binary -> dist/exacli-<os>-<arch>
```

## Architecture

```text
cmd/exacli/
└── main.go               # Entry point — calls commands.Execute()
internal/
├── client/
│   └── client.go         # Exa HTTP client (all endpoints, SSE streaming, polling)
├── commands/
│   ├── root.go           # Cobra root command, global flags, ResolveAPIKey()
│   ├── search.go         # search <query>
│   ├── contents.go       # contents <url...>
│   ├── similar.go        # similar <url>
│   ├── answer.go         # answer <query> (+ --stream SSE)
│   ├── research.go       # research / research-status / research-list
│   └── auth.go           # login / logout (OS keychain via go-keyring)
├── formatters/
│   └── formatters.go     # Markdown, JSON, TOON output formatting
└── utils/
    └── validation.go     # Input validation (URLs, search types, models)
archive/                  # TypeScript source (archived)
```

## API Key Resolution

1. `--api-key` flag
2. `EXA_API_KEY` environment variable
3. OS keychain (`exacli login` stores it via go-keyring)

## Cross-compile Targets

8 platforms: linux-x64, linux-arm64, linux-x64-musl, linux-arm64-musl, darwin-x64, darwin-arm64, windows-x64, windows-arm64
All built with `CGO_ENABLED=0`.
