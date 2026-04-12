---
name: exacli
description: Exa AI search API via CLI. Activate when user wants to search the web, find information, extract content from websites, get AI answers with sources, or perform automated research. Examples: "search for AI startups", "extract content from this URL", "research this topic", "find similar pages".
---

# Exacli

## Rules

1. Match output format to context: use default for metadata-only results, `--toon` when fetching content, `--json` only when piping to `jq`
2. Set `EXA_API_KEY` env var before use (or run `exacli login` to store in OS keychain)
3. Use `--text` to include full content, `--highlights` for snippets
4. Use `--poll` with research tasks to wait for results

## Auth / API Key

```bash
# Option 1: environment variable (preferred in agent contexts)
export EXA_API_KEY="your-api-key-here"

# Option 2: OS keychain
exacli login

# Option 3: per-command flag
exacli search "query" --api-key "your-key"
```

Resolution order: `--api-key` flag → `EXA_API_KEY` env var → OS keychain

## Output Modes

Measured on 10 results with no content flags (`--text`/`--highlights`/`--summary` off):

| Flag | Chars | Est. tokens | Best for |
|------|-------|-------------|----------|
| _(none)_ | ~3,300 | ~830 | Agent contexts with metadata only — omits null/empty fields |
| `--toon` | ~4,200 | ~1,050 | Agent contexts with content — flat `key: value`, no formatting overhead |
| `--json` | ~5,000 | ~1,250 | Scripting only — most verbose due to null fields + structural chars |

**Key insight:** `--json` is ~50% larger than the default for the same data because it includes `"highlights": null`, `"highlightScores": null`, `"text": ""`, `"summary": ""` on every result. Prefer default or `--toon` to keep context small; reach for `--json` only when piping to `jq`.

```bash
# Metadata-only: default is most compact
exacli search "query"

# With content: --toon is most compact
exacli search "query" --text --toon

# Scripting: --json when you need jq field extraction
exacli search "query" --json | jq '.results[] | {title, url}'
exacli research-status "task-id" --json | jq '{status, output}'
```

## Commands

### search

```bash
exacli search "query" [options]
```

| Option | Description |
|--------|-------------|
| `--num-results <n>` | Number of results (default: 10) |
| `--type <auto\|fast\|deep\|instant>` | Search type |
| `--text` | Include full text content |
| `--highlights` | Include relevant highlights |
| `--summary` | Include AI-generated summary |
| `--category <category>` | Filter by category |
| `--include-domains <list>` | Comma-separated domains to include |
| `--exclude-domains <list>` | Comma-separated domains to exclude |
| `--start-date <date>` | Start date (ISO format) |
| `--end-date <date>` | End date (ISO format) |
| `--autoprompt` | Use autoprompt to enhance query |

### contents

Retrieve content from specific URLs.

```bash
exacli contents <url...> [options]
```

Options: `--text`, `--highlights`, `--summary`, `--max-age-hours <n>`

### similar

Find pages similar to a given URL.

```bash
exacli similar <url> [options]
```

Options: `--num-results <n>`, `--exclude-source-domain`, `--text`, `--highlights`, `--summary`, `--category <category>`

### answer

Get AI-powered answers with source citations.

```bash
exacli answer "query" [options]
```

Options: `--text`, `--model <exa|exa-pro>`, `--stream`, `--system-prompt <text>`

### research

Create automated research tasks.

```bash
exacli research "instructions" [options]
```

Options: `--model <fast|regular|pro>`, `--poll`, `--poll-interval <ms>`, `--timeout <ms>`

### research-status / research-list

```bash
exacli research-status <task-id>
exacli research-list [--limit <n>] [--cursor <token>]
```

### login / logout

```bash
exacli login    # store API key in OS keychain
exacli logout   # remove API key from OS keychain
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Exa API key |
| `--json` | Output raw JSON |
| `--toon` | Output compact TOON format |
| `-h, --help` | Show help |

## Search Categories

`company`, `research paper`, `news`, `pdf`, `tweet`, `personal site`, `financial report`, `people`

## Search Types

| Type | Description |
|------|-------------|
| `auto` | Automatically chosen (default) |
| `fast` | Quick results |
| `deep` | Thorough, best for research |
| `instant` | Lowest latency |

## Research Models

| Model | Description |
|-------|-------------|
| `fast` | Quick facts |
| `regular` | Balanced (default) |
| `pro` | Highest quality |

## Common Patterns

```bash
# Semantic search with content
exacli search "AI startups" --num-results 5 --text --json | jq '.results[] | {title, url}'

# Deep search for research
exacli search "transformer architecture" --type deep --text --highlights --json

# Filter by category and date
exacli search "startup funding" --category news --start-date 2024-01-01 --json

# Domain-specific search
exacli search "research" --include-domains "arxiv.org,openai.com" --json

# Extract content from URLs
exacli contents "https://example.com/article" --text --json | jq '.results[0].text'

# Find similar pages
exacli similar "https://openai.com/research" --exclude-source-domain --json

# AI-powered answers
exacli answer "What is quantum computing?" --json | jq '.answer'

# Streaming answers
exacli answer "Explain neural networks" --stream

# Research with polling
exacli research "Latest AI developments" --poll --json

# Check research status
exacli research-status "task-id" --json | jq '{status, output}'

# List research tasks
exacli research-list --limit 10 --json | jq '.data[] | {id, status}'
```

## References

- **Full help:** `exacli --help`
- **Exa API docs:** https://exa.ai/docs
- **API keys:** https://dashboard.exa.ai/api-keys
