---
name: exacli
description: Exa AI search API via CLI. Activate when user wants to search the web, find information, extract content from websites, get AI answers with sources, or perform automated research. Examples: "search for AI startups", "extract content from this URL", "research this topic", "find similar pages".
---

# Exacli

## Rules

1. Always use `--json` and pipe through `jq` to keep context small
2. Set `EXA_API_KEY` env var before use
3. Use `--text` to include full content, `--highlights` for snippets
4. Use `--poll` with research tasks to wait for results

## Output

Default: formatted markdown. With `--json`: raw API JSON.

```bash
# JSON output for scripting
exacli search "query" --json | jq '.results[0].title'
exacli research-status "task-id" --json | jq '.status'
```

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

## Search Categories

company, research paper, news, pdf, tweet, personal site, financial report, people

## Search Types

- `auto` — default, automatically chosen
- `fast` — quick results
- `deep` — thorough, best for research
- `instant` — lowest latency

## Research Models

- `fast` — quick facts
- `regular` — balanced (default)
- `pro` — highest quality

## References

- **Full help:** `exacli --help`
- **Exa API docs:** https://exa.ai/docs
