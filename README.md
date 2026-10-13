# Exacli

A Bun-native TypeScript CLI for the [Exa AI](https://exa.ai) API. Search the web, extract page contents, get cited answers, run Exa Agent research jobs, schedule search monitors, submit request batches, and build Websets from your terminal.

> **Attribution:** Based on [exa-cli](https://github.com/sandiiarov/exa-cli) by Alex Sandiiarov. Now maintained by [SoftwareStartups](https://github.com/SoftwareStartups).

## What is it?

`exacli` talks to the Exa REST API ([OpenAPI spec](https://exa.ai/docs/exa-spec.yaml)) directly, with no SDK in between, so it exposes the current API surface:

- **Search** with every search type (`instant` to `deep-reasoning`), categories, domain and date filters, objectives, and synthesized structured output with field-level grounding
- **Contents** with text, highlights (including Dynamic Highlights), summaries, freshness control, page snapshots, subpages, and extras
- **Answer** with model selection, structured output, and streaming
- **Agent** runs for deep research, list building, and enrichment, with effort levels, budgets, Exa Connect data sources, and structured output
- **Monitors** that run a search on a schedule and post new results to a webhook
- **Batches** of `/search` and `/agent/runs` requests processed asynchronously (beta)
- **Websets** with searches, enrichments, items, scheduled monitors, CSV imports, webhooks, and events (requires a Websets-enabled plan)

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

Windows binaries (`exacli-windows-x64.exe`, `exacli-windows-arm64.exe`) are attached to each release too.

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

Store your API key in the OS keychain:

```bash
exacli login
```

Or set it in the environment (takes precedence over the keychain), or pass it per command:

```bash
export EXA_API_KEY="your-api-key-here"
exacli search "AI startups" --api-key "$MY_EXA_KEY"
```

Get your API key at [https://dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys). Remove a stored key with `exacli logout`.

## Use with Claude Code

This repo is a Claude Code plugin marketplace. Install the companion skill so Claude Code can drive `exacli` for you:

```bash
/plugin marketplace add SoftwareStartups/exacli
/plugin install exacli@softwarestartups-exacli
```

Once installed, ask Claude in plain language (e.g., "Find recent articles about post-quantum cryptography") and the skill activates automatically. Run `/plugin marketplace update softwarestartups-exacli` to get the latest skill revisions.

## Commands

Every command and subcommand has its own help: `exacli <command> --help`.

### `search <query>`

```bash
exacli search "latest AI developments" --highlights
exacli search "startup funding" --category news --start-date 2026-01-01 --num-results 5
exacli search "AI research" --include-domains "arxiv.org,openai.com/research"
exacli search "Who founded Exa?" --type deep --output-schema '{"type":"object","properties":{"founders":{"type":"array","items":{"type":"string"}}}}'
exacli search "EU AI Act status" --output-schema '{"type":"text"}' --stream
```

Without content options, results carry title, URL, and metadata only. Add `--highlights` (recommended), `--text`, or `--summary` to get page content.

**Search options:** `--num-results`, `--type <auto|fast|instant|deep-lite|deep|deep-reasoning>`, `--category <company|people|publication|news|personal site|financial report>`, `--include-domains`, `--exclude-domains`, `--start-date`, `--end-date`, `--objective`, `--system-prompt`, `--output-schema <json|@file>`, `--stream`, `--additional-queries` (deep types), `--user-location`, `--latitude`/`--longitude`, `--moderation`, `--user-id`, `--compliance hipaa`, `--include-text`/`--exclude-text` (deprecated by Exa)

### `contents <url...>`

```bash
exacli contents "https://arxiv.org/abs/2304.15004" --text --max-characters 5000
exacli contents "https://example.com/1" "https://example.com/2" --highlights --summary
exacli contents "https://example.com" --text --max-age-hours 0 --text-verbosity full --exclude-sections navigation,footer
exacli contents "https://example.com/pricing" --text --snapshot-as-of 2026-01-15
```

**Content options** (shared by `search`, `contents`, `similar`, and `monitor`):

| Option | Description |
|--------|-------------|
| `--text`, `--max-characters <n>` | Page text, optionally capped |
| `--include-html-tags` | Keep lightweight HTML tags |
| `--text-verbosity <compact\|standard\|full>` | How much of the page to render |
| `--include-sections`, `--exclude-sections <list>` | `header`, `navigation`, `banner`, `body`, `sidebar`, `footer`, `metadata` |
| `--highlights` | Query-relevant excerpts |
| `--highlights-query`, `--highlights-max-characters` | Steer or cap highlights |
| `--highlights-verbosity <low\|medium\|high>`, `--dynamic-highlights` | Dynamic Highlights (beta) |
| `--summary`, `--summary-query`, `--summary-schema <json\|@file>` | LLM summary, optionally structured |
| `--max-age-hours <n>` | `0` always crawls, `-1` cache only, `n` crawls if older |
| `--snapshot-as-of <date>` | Stored version of the page at this time |
| `--livecrawl <mode>` | Deprecated, use `--max-age-hours` |
| `--livecrawl-timeout <ms>` | Live crawl timeout |
| `--subpages <n>`, `--subpage-target <list>` | Crawl linked subpages |
| `--extras-links`, `--extras-image-links`, `--extras-rich-links`, `--extras-rich-image-links`, `--extras-code-blocks <n>` | Extra page data |

### `answer <query>`

```bash
exacli answer "What is quantum computing?"
exacli answer "Explain neural networks" --stream
exacli answer "Compare transformer architectures" --model exa-pro
exacli answer "Largest EU battery makers" --output-schema '{"type":"object","properties":{"companies":{"type":"array","items":{"type":"string"}}}}'
```

**Options:** `--model <exa|exa-pro|exa-research|exa-fast>`, `--text`, `--stream`, `--system-prompt`, `--output-schema <json|@file>`, `--user-location`, `--latitude`/`--longitude`, `--user-id`

### `similar <url>`

Exa deprecated `/findSimilar` but still serves it.

```bash
exacli similar "https://openai.com/research" --exclude-source-domain --highlights
```

**Options:** `--num-results`, `--exclude-source-domain`, `--category`, `--include-domains`, `--exclude-domains`, `--start-date`, `--end-date`, plus content options

### `agent <subcommand>`

[Exa Agent](https://exa.ai/docs/agent/quickstart) replaces the retired Research API.

```bash
exacli agent run "List 20 seed-stage robotics startups in Europe" --effort medium
exacli agent run "Compare cloud GPU pricing" --output-schema @schema.json --wait
exacli agent run "Find B2B SaaS companies with 50-200 employees" --data-sources fiber,similarweb --effort ultra --max-cost 30
exacli agent get agent_run_123
exacli agent list --limit 10
exacli agent stop agent_run_123      # ultra runs: finish early, keep results
exacli agent cancel agent_run_123
exacli agent events agent_run_123
exacli agent delete agent_run_123
```

`agent run` returns immediately with a run ID. Use `--wait` to poll until it finishes or `--stream` to follow its events. The command exits 1 when the run it prints has ended `failed` or `cancelled`.

**Run options:** `--effort <minimal|low|medium|high|xhigh|auto|ultra>`, `--system-prompt`, `--output-schema`, `--input <json|@file>`, `--previous-run <id>`, `--data-sources <list>`, `--max-cost <usd>`, `--max-duration <seconds>`, `--metadata`, `--user-id`, `--wait`, `--poll-interval <ms>`, `--timeout <ms>`, `--stream`

### `monitor <subcommand>`

[Monitors](https://exa.ai/docs/monitors/quickstart) run a search on a schedule and deliver new results to a webhook.

```bash
exacli monitor create "AI chip startup funding" --name chips --period 1d \
  --webhook-url https://hooks.example.com/exa --highlights --num-results 10
exacli monitor list --status active
exacli monitor update <monitor-id> --status paused
exacli monitor update <monitor-id> --remove-schedule
exacli monitor trigger <monitor-id>
exacli monitor runs <monitor-id>
exacli monitor run <monitor-id> <run-id>
exacli monitor batch pause --name chips             # dry run
exacli monitor batch pause --name chips --execute
exacli monitor delete <monitor-id>
```

`monitor create` prints the webhook signing secret once. Store it. Monitors accept the content options of `search`, except `--summary-schema` and `--snapshot-as-of`.

### `batch <subcommand>`

[Batches](https://exa.ai/docs/reference/batches/create-a-batch) (beta, must be enabled for your team) run many `/search` or `/agent/runs` requests asynchronously.

```bash
cat > requests.jsonl <<'EOF'
{"customId":"q1","method":"POST","url":"/search","body":{"query":"AI chips","numResults":5}}
{"customId":"q2","method":"POST","url":"/search","body":{"query":"battery recycling","numResults":5}}
EOF
exacli batch create requests.jsonl
exacli batch get <batch-id>
exacli batch results <batch-id> > results.jsonl
exacli batch list --status completed
exacli batch cancel <batch-id>
exacli batch delete <batch-id>
```

### `webset` and related commands

[Websets](https://exa.ai/docs/websets/api) build verified lists of companies, people, articles, or papers. Every Websets command accepts `--body <json|@file>` for any spec field (scope, exclude, import, ...); flags override keys in `--body`.

```bash
exacli webset create --query "AI startups in Berlin with a female founder" --count 25 --entity company \
  --criterion "founded after 2020" --criterion "raised a seed round" --enrichment "CEO name"
exacli webset preview --query "fintechs in Lisbon" --with-items
exacli webset get <webset-id>
exacli webset items <webset-id> --limit 50
exacli webset-search create <webset-id> --query "more like these" --count 10 --behavior append
exacli webset-enrichment create <webset-id> --description "Funding stage" --format options --options seed,series-a,series-b
exacli webset-monitor create <webset-id> --cron "0 9 * * 1" --count 5 --behavior append
exacli webset-import create companies.csv --entity company --identifier-column 0
exacli webset-webhook create --webhook-url https://hooks.example.com/exa --events webset.item.created
exacli webset-event list --types webset.idle
exacli team
```

| Command | Subcommands |
|---------|-------------|
| `webset` | create, list, get, update, delete, cancel, preview, items, item, item-delete |
| `webset-search` | create, get, cancel |
| `webset-enrichment` | create, get, update, delete, cancel |
| `webset-monitor` | create, list, get, update, delete, runs, run |
| `webset-import` | create (uploads the CSV), list, get, update, delete |
| `webset-webhook` | create, list, get, update, delete, attempts |
| `webset-event` | list, get |
| `team` | Team info and concurrency limits |

## Output

Markdown by default. With `--json`, every command prints one envelope:

```json
{"ok":true,"data":{ "...raw Exa API response..." }}
{"ok":false,"error":"Invalid API key. ...","code":"INVALID_API_KEY"}
```

Streaming commands (`--stream --json`) print one envelope per line (NDJSON). Progress messages go to stderr. A stream that ends before it completes is an error.

The exit code is 0 on success and 1 on any error, including usage errors and agent runs that end `failed` or `cancelled`. `--metadata` takes a JSON object with string values. Text from web pages is printed without terminal control characters.

## Upgrading from v1

| v1 | v2 |
|----|----|
| `research "<task>"` | `agent run "<task>"` |
| `research-status <id>` | `agent get <id>` |
| `research-list` | `agent list` |
| `--poll` | `--wait` |
| `--type keyword`, `neural`, `hybrid` | `--type auto`, `fast`, `instant`, `deep-lite`, `deep`, `deep-reasoning` |
| `--livecrawl auto` | `--max-age-hours <n>` |
| `--autoprompt`, `--start-crawl-date`, `--end-crawl-date` | Removed (no longer in the Exa API) |
| `--json` printed the raw response | `--json` prints `{"ok":true,"data":...}`; read `.data` |

## Global Options

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Exa API key (alternative to `EXA_API_KEY` or `exacli login`) |
| `--json` | JSON envelope output |
| `--version` | Show version information |
| `-h, --help` | Show help (per command: `exacli <command> --help`) |

## Development

Prerequisites: [Bun](https://bun.sh) and [Task](https://taskfile.dev)

```bash
bun install                          # Install dependencies
task build                           # Compile TypeScript to build/
task lint                            # Lint with Biome
task format                          # Format with Biome
task test                            # Run tests (e2e runs when EXA_API_KEY is set)
task check                           # Lint + typecheck + tests
task ci                              # Full CI pipeline locally
task compile                         # Build standalone binary
task compile:all                     # Build all 6 platform binaries
```

## Project Structure

```
exacli/
├── src/
│   ├── index.ts              # CLI entry point, flag parsing, command registry
│   ├── help.ts               # Top-level and per-command help text
│   ├── client.ts             # Exa REST client (fetch + SSE)
│   ├── auth/keychain.ts      # OS keychain credential storage
│   ├── cli/commands/         # login / logout
│   ├── commands/             # search, contents, similar, answer, agent, monitor, batch, websets
│   ├── formatters/markdown.ts
│   └── utils/                # options, validation, output, streaming
├── tests/
└── package.json
```

## License

MIT - see [LICENSE](LICENSE) for details.
