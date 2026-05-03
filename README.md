# Exacli

A Bun-native TypeScript CLI for the [Exa AI](https://exa.ai) search API. Search the web semantically, extract content from URLs, get AI-powered answers with citations, and conduct automated research - all from your terminal.

> **Attribution:** Based on [exa-cli](https://github.com/sandiiarov/exa-cli) by Alex Sandiiarov. Now maintained by [SoftwareStartups](https://github.com/SoftwareStartups).

## What is it?

`exacli` is a command-line tool that communicates with the Exa AI search API. It can be used standalone or through Claude Code to:

- Search the web using semantic understanding
- Extract full text, highlights, and summaries from URLs
- Get AI-generated answers with source citations
- Find pages similar to any URL
- Conduct automated deep research tasks

## Installation

### From GitHub Releases (recommended)

Download a pre-compiled binary for your platform from [GitHub Releases](https://github.com/SoftwareStartups/exacli/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/SoftwareStartups/exacli/releases/latest/download/exacli-darwin-arm64 -o exacli
chmod +x exacli
sudo mv exacli /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/SoftwareStartups/exacli/releases/latest/download/exacli-darwin-x64 -o exacli
chmod +x exacli
sudo mv exacli /usr/local/bin/

# Linux (x64)
curl -L https://github.com/SoftwareStartups/exacli/releases/latest/download/exacli-linux-x64 -o exacli
chmod +x exacli
sudo mv exacli /usr/local/bin/

# Linux (ARM64)
curl -L https://github.com/SoftwareStartups/exacli/releases/latest/download/exacli-linux-arm64 -o exacli
chmod +x exacli
sudo mv exacli /usr/local/bin/
```

### From Source

Prerequisites: [Bun](https://bun.sh) and [Task](https://taskfile.dev)

```bash
git clone https://github.com/SoftwareStartups/exacli.git
cd exacli
bun install
task build
bun link
```

## Configuration

Set your Exa API key as an environment variable:

```bash
export EXA_API_KEY="your-api-key-here"
```

Or pass it with each command:

```bash
exacli search "AI startups" --api-key "your-api-key-here"
```

Get your API key at [https://dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)

## Use with Claude Code

This repo is a Claude Code plugin marketplace. Install the companion skill so Claude Code can drive `exacli` for you:

```bash
/plugin marketplace add SoftwareStartups/exacli
/plugin install exacli@softwarestartups-exacli
```

Once installed, just ask Claude in plain language (e.g., "Find recent articles about post-quantum cryptography") and the skill will activate automatically. The plugin tracks this repo's releases — run `/plugin marketplace update softwarestartups-exacli` to get the latest skill revisions.

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

## Global Options

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Exa API key (alternative to EXA_API_KEY env var) |
| `--json` | Output raw JSON instead of formatted markdown |
| `--version` | Show version information |
| `-h, --help` | Show help message |

## Development

Prerequisites: [Bun](https://bun.sh) and [Task](https://taskfile.dev)

```bash
bun install                          # Install dependencies
task build                           # Compile TypeScript to build/
task lint                            # Lint with Biome
task format                          # Format with Biome
task test                            # Run tests
task check                           # Lint + typecheck + tests
task ci                              # Full CI pipeline locally
task compile                         # Build standalone binary
task compile:all                     # Build all 4 platform binaries
```

## Project Structure

```
exacli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── client.ts             # Exa SDK wrapper
│   ├── commands/
│   │   ├── types.ts          # Command arg interfaces and shared types
│   │   ├── search.ts         # Web search
│   │   ├── contents.ts       # URL content extraction
│   │   ├── similar.ts        # Similar page discovery
│   │   ├── answer.ts         # AI-powered answers
│   │   └── research.ts       # Research tasks
│   ├── formatters/
│   │   └── markdown.ts       # Output formatting
│   └── utils/
│       ├── commands.ts       # Shared command helpers
│       └── validation.ts     # Input validation
├── tests/                    # Test files
├── build/                    # Compiled output (generated)
├── dist/                     # Standalone binaries (generated)
└── package.json
```

## License

MIT - see [LICENSE](LICENSE) for details.
