# Exacli

A Go CLI for the [Exa AI](https://exa.ai) search API. Search the web semantically, extract content from URLs, get AI-powered answers with citations, and conduct automated research — all from your terminal. Statically linked, no external package dependencies.

> **Attribution:** Based on [exa-cli](https://github.com/sandiiarov/exa-cli) by Alex Sandiiarov. Now maintained by [wesbragagt](https://github.com/wesbragagt).

## Why Go?

The original project was written in TypeScript and required Bun to run. I kept running into segfaults when trying to use it inside a sandboxed harness, which was the final push to rewrite it. Go produces a single statically linked binary with no runtime dependencies — small enough to drop anywhere, and easy to cross-compile for Linux, macOS, and Windows from one machine (`task compile:all`). Honestly, I'm also just biased — Go is my favorite way to build CLIs.

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

The recommended way to set up the development environment is with [Nix](https://nixos.org), which provides Go, Task, and all other dependencies automatically. If you don't have Nix, install it with the [Determinate Nix Installer](https://github.com/DeterminateSystems/nix-installer):

```bash
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

Then clone the repo and let Nix set up the environment:

```bash
git clone https://github.com/wesbragagt/exacli.git
cd exacli
nix develop        # drops you into a shell with Go 1.25, Task, and all tools ready
go mod download
task build
sudo cp build/exacli /usr/local/bin/
```

If you use [direnv](https://direnv.net), the included `.envrc` activates the Nix environment automatically when you `cd` into the repo:

```bash
direnv allow
```

**Without Nix:** Install the following tools manually, then follow the steps below.

| Tool | Version | Install |
|------|---------|---------|
| [Go](https://go.dev/dl/) | 1.25+ | `brew install go` (macOS) or download from go.dev |
| [Task](https://taskfile.dev/installation/) | any | `brew install go-task` (macOS) or `sh -c "$(curl --location https://taskfile.dev/install.sh)" -- -d` |
| [Git](https://git-scm.com) | any | pre-installed on most systems |

```bash
git clone https://github.com/wesbragagt/exacli.git
cd exacli
go mod download
task build
sudo cp build/exacli /usr/local/bin/
```

## Use with AI Assistants

Exacli ships with a canonical skill file (`SKILL.md`) that lets AI coding assistants invoke exacli commands on your behalf. Copy the file to the location your tool expects, then make sure `EXA_API_KEY` is set in your environment — no edits to the skill file are needed.

| Tool | Placement path |
|------|---------------|
| **Claude Code** | `.claude/skills/exacli/SKILL.md` |
| **opencode** | `.opencode/skills/exacli/SKILL.md` |
| **Cursor** | `.cursor/rules/exacli.mdc` (or append to `.cursorrules`) |

The YAML frontmatter (`name`, `description`) at the top of `SKILL.md` is used by tools that support it and safely ignored by those that don't.

> **Note:** Configure your API key in the environment (`EXA_API_KEY`) before asking your assistant to use exacli. See [Configuration](#configuration) below.

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

### Output Format Trade-offs

The three formats make different token/size trade-offs that matter when output flows into an AI context window.

Measured on a 10-result metadata-only search (no `--text`, `--highlights`, `--summary`):

| Format | Characters | Est. tokens | When to use |
|--------|-----------|-------------|-------------|
| Default (markdown) | ~3,300 | ~830 | Best baseline — omits null/empty fields entirely |
| `--toon` | ~4,200 | ~1,050 | Includes empty fields as flat `key: value` pairs |
| `--json` | ~5,000 | ~1,250 | Most verbose — includes all nulls + structural overhead |

**Why JSON is largest:** every result carries `"highlights": null`, `"highlightScores": null`, `"text": ""`, and `"summary": ""` even when empty, plus JSON structural characters (quotes, brackets, commas on every key).

**Why default markdown is smallest for sparse results:** the formatter skips null and empty fields entirely, emitting only populated data.

**When the ranking shifts:** once results include actual content (`--text`, `--highlights`, `--summary`), `--toon` becomes the most compact option because it uses flat `key: value` lines with no markdown formatting overhead (no section headers, no bold labels per field).

**Recommendations:**

| Use case | Best format |
|----------|-------------|
| AI agent, metadata only | Default (markdown) |
| AI agent, with content | `--toon` |
| Scripting / field extraction | `--json \| jq` |
| Human reading | Default (markdown) |

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
