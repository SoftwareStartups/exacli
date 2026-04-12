# Exacli

A Go CLI for the [Exa AI](https://exa.ai) search API. Search the web semantically, extract content from URLs, get AI-powered answers with citations, and conduct automated research — all from your terminal. Statically linked, no external package dependencies.

> **Attribution:** Based on [exa-cli](https://github.com/sandiiarov/exa-cli) by Alex Sandiiarov. Now maintained by [wesbragagt](https://github.com/wesbragagt).

## What is it?

`exacli` is a command-line tool that communicates with the Exa AI search API. It can be used standalone or through Claude Code to:

- Search the web using semantic understanding
- Extract full text, highlights, and summaries from URLs
- Get AI-generated answers with source citations
- Find pages similar to any URL
- Conduct automated deep research tasks

## Installation

### With Nix

If you have [Nix](https://nixos.org) installed, you can run exacli directly without any other prerequisites:

```bash
nix run github:wesbragagt/exacli -- search "latest AI news"
```

Or install it into your profile:

```bash
nix profile install github:wesbragagt/exacli
```

### From Source

Prerequisites: [Go 1.21+](https://go.dev/dl/) and [Task](https://taskfile.dev)

```bash
git clone https://github.com/wesbragagt/exacli.git
cd exacli
go mod download
task build
sudo cp build/exacli /usr/local/bin/
```

## Configuration

### API Key

Set your Exa API key as an environment variable:

```bash
export EXA_API_KEY="your-api-key-here"
```

Or store it securely in your OS keychain:

```bash
exacli login
```

Or pass it with each command:

```bash
exacli search "AI startups" --api-key "your-api-key-here"
```

Get your API key at [https://dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)

**Resolution order:** `--api-key` flag → `EXA_API_KEY` env var → OS keychain

## Usage with Claude Code

When installed on your system, Claude Code can use `exacli` to search the web, extract content, and conduct research. The included skill (`.claude/skills/exacli/`) provides Claude Code with command reference and usage patterns.

## Commands

### `search <query>`

Search the web using semantic search.

```bash
exacli search "latest AI developments"
exacli search "machine learning papers" --type deep --text --highlights
exacli search "startup funding" --category news --start-date 2024-01-01
exacli search "AI research" --include-domains "arxiv.org,openai.com"
```

**Options:** `--num-results <n>`, `--type <auto|fast|deep|instant>`, `--text`, `--highlights`, `--summary`, `--category <category>`, `--include-domains <list>`, `--exclude-domains <list>`, `--start-date <date>`, `--end-date <date>`, `--autoprompt`

### `contents <url...>`

Retrieve content from specific URLs.

```bash
exacli contents "https://arxiv.org/abs/2304.15004" --text
exacli contents "https://example.com/1" "https://example.com/2" --highlights --summary
```

**Options:** `--text`, `--highlights`, `--summary`, `--max-age-hours <n>`

### `similar <url>`

Find pages similar to a given URL.

```bash
exacli similar "https://openai.com/research/gpt-4"
exacli similar "https://techcrunch.com/article" --exclude-source-domain --text
```

**Options:** `--num-results <n>`, `--exclude-source-domain`, `--text`, `--highlights`, `--summary`, `--category <category>`

### `answer <query>`

Get AI-powered answers with source citations.

```bash
exacli answer "What is quantum computing?"
exacli answer "Explain neural networks" --stream
exacli answer "Compare transformer architectures" --model exa-pro
```

**Options:** `--text`, `--model <exa|exa-pro>`, `--stream`, `--system-prompt <text>`

### `research <instructions>`

Create automated research tasks.

```bash
exacli research "Latest SpaceX valuation" --poll
exacli research "CRISPR applications" --model pro --poll --timeout 300000
```

**Options:** `--model <fast|regular|pro>`, `--poll`, `--poll-interval <ms>`, `--timeout <ms>`

### `research-status <id>` / `research-list`

```bash
exacli research-status "task-id"
exacli research-list --limit 10
```

### `login` / `logout`

Store or remove your Exa API key in the OS keychain.

```bash
exacli login
exacli logout
```

## Global Options

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Exa API key (overrides EXA_API_KEY env var and keychain) |
| `--json` | Output raw JSON instead of formatted markdown |
| `--toon` | Output compact TOON format |
| `--version` | Show version information |
| `-h, --help` | Show help message |

## Development

Prerequisites: [Go 1.21+](https://go.dev/dl/) and [Task](https://taskfile.dev)

```bash
go mod download                      # Download dependencies
task build                           # Build binary to build/exacli
task lint                            # go vet ./...
task test                            # Run tests
task check                           # Lint + tests
task ci                              # Full CI: clean -> check -> build
task compile                         # CGO_ENABLED=0 binary for current platform -> dist/exacli
task compile:all                     # Binaries for all 8 platforms -> dist/
task compile:native                  # Platform-suffixed binary -> dist/exacli-<os>-<arch>
task clean                           # Remove build/ and dist/
```

## Project Structure

```
exacli/
├── cmd/exacli/
│   └── main.go               # Entry point — calls commands.Execute()
├── internal/
│   ├── client/
│   │   └── client.go         # Exa HTTP client (all endpoints, SSE streaming, polling)
│   ├── commands/
│   │   ├── root.go           # Cobra root command, global flags, ResolveAPIKey()
│   │   ├── search.go         # search <query>
│   │   ├── contents.go       # contents <url...>
│   │   ├── similar.go        # similar <url>
│   │   ├── answer.go         # answer <query> (+ --stream SSE)
│   │   ├── research.go       # research / research-status / research-list
│   │   └── auth.go           # login / logout (OS keychain via go-keyring)
│   ├── formatters/
│   │   └── formatters.go     # Markdown, JSON, TOON output formatting
│   └── utils/
│       └── validation.go     # Input validation (URLs, search types, models)
├── archive/                  # TypeScript source (archived)
├── build/                    # Compiled output (generated)
├── dist/                     # Standalone binaries (generated)
└── go.mod
```

## License

MIT - see [LICENSE](LICENSE) for details.
