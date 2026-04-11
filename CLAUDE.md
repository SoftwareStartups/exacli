# Exacli

Bun-native TypeScript CLI for Exa AI search API. Semantic search, content extraction, AI answers, and automated research.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXA_API_KEY` | Exa API key (or use --api-key flag) |

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
├── index.ts              # CLI entry point (arg parsing, help, command dispatch)
├── client.ts             # Exa SDK wrapper
├── commands/
│   ├── types.ts          # Command arg interfaces and shared types
│   ├── search.ts         # Web search
│   ├── contents.ts       # URL content extraction
│   ├── similar.ts        # Similar page discovery
│   ├── answer.ts         # AI-powered answers
│   └── research.ts       # Research tasks (create, status, list)
├── formatters/
│   └── markdown.ts       # Markdown + JSON output formatting
└── utils/
    ├── commands.ts       # Shared command helpers (error handling, content options, citations)
    └── validation.ts     # Input validation (numbers, URLs, string lists)
tests/
├── validation.test.ts
├── formatters.test.ts
├── commands.test.ts
└── e2e.test.ts
```
