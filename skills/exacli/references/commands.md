# Exacli Command Reference

All commands accept `--json` (envelope `{"ok":true,"data":...}`) and `--help`.

## search

```bash
exacli search "<query>" [options] --json | jq '.data.results'
```

| Option | Values |
|--------|--------|
| `--num-results <n>` | 1-100, default 10 |
| `--type` | `auto` (default), `fast`, `instant`, `deep-lite`, `deep`, `deep-reasoning` |
| `--category` | `company`, `people`, `publication`, `news`, `personal site`, `financial report` |
| `--include-domains`, `--exclude-domains` | Comma list; `example.com`, `example.com/docs`, `*.substack.com` |
| `--start-date`, `--end-date` | Published date range, ISO 8601 |
| `--objective <text>` | Goal of the search; steers ranking |
| `--system-prompt <text>` | Guidance for search and synthesis |
| `--output-schema <json\|@file>` | `{"type":"text"}` or `{"type":"object","properties":{...}}`; result in `.data.output.content`, citations in `.data.output.grounding` |
| `--additional-queries <list>` | Deep types only |
| `--user-location <cc>`, `--latitude`, `--longitude` | Localize results |
| `--moderation` | Filter unsafe content |

Deep types: `deep-lite` is fastest, `deep` takes 4-12s, `deep-reasoning` takes 12-50s.

## Content options (search, contents, similar, monitor)

| Option | Effect |
|--------|--------|
| `--highlights` | Query-relevant excerpts (best default for context size) |
| `--highlights-query <text>`, `--highlights-max-characters <n>` | Steer or cap highlights |
| `--text`, `--max-characters <n>` | Page text, capped |
| `--text-verbosity compact\|standard\|full` | Amount of page rendered |
| `--include-sections`, `--exclude-sections` | `header`, `navigation`, `banner`, `body`, `sidebar`, `footer`, `metadata` |
| `--summary`, `--summary-query`, `--summary-schema` | LLM summary per result |
| `--max-age-hours <n>` | `0` = always crawl fresh, `-1` = cache only |
| `--snapshot-as-of <date>` | Page as stored at that time |
| `--subpages <n>`, `--subpage-target <list>` | Include linked subpages (e.g. `about,pricing`) |
| `--extras-links <n>`, `--extras-image-links <n>`, `--extras-code-blocks <n>` | Extra page data |

```bash
exacli contents "https://a.com" "https://b.com" --highlights --highlights-query "pricing" --json \
  | jq '[.data.results[] | {url, highlights}]'
exacli contents "https://docs.example.com" --text --max-characters 4000 --subpages 3 --subpage-target api --json \
  | jq '.data.results[0] | {text, subpages: [.subpages[].url]}'
```

Failed URLs appear in `.data.statuses`.

## answer

```bash
exacli answer "<question>" [--model exa|exa-pro|exa-research|exa-fast] [--output-schema <json|@file>] --json \
  | jq '{answer: .data.answer, citations: [.data.citations[] | {title, url}]}'
```

## similar

```bash
exacli similar "<url>" --num-results 5 --exclude-source-domain --json | jq '[.data.results[] | {title, url}]'
```

## agent

```bash
exacli agent run "<task>" [options] --json | jq '{id: .data.id, status: .data.status}'
exacli agent get <run-id> --json | jq '.data | {status, stopReason, output}'
exacli agent list --limit 10 --json | jq '[.data.data[] | {id, status}]'
exacli agent events <run-id> --json | jq '[.data.data[].event]'
exacli agent stop <run-id>     # ultra only: finish now, keep partial results
exacli agent cancel <run-id>   # abandon a queued or running run
exacli agent delete <run-id>
```

| Run option | Values |
|------------|--------|
| `--effort` | `minimal`, `low`, `medium`, `high`, `xhigh`, `auto` (default), `ultra` |
| `--output-schema <json\|@file>` | JSON Schema; result in `.data.output.structured` |
| `--input <json\|@file>` | `{"data":[...records to enrich],"exclusion":[...records to skip]}` |
| `--data-sources <list>` | `fiber`, `financial_datasets`, `similarweb`, `baselayer`, `affiliate`, `particle`, `jinko`, `polymarket`, `macrobond` |
| `--max-cost <usd>` | `auto`/`ultra` spend cap ($1-$100) |
| `--max-duration <s>` | `ultra` time cap (300-10800) |
| `--previous-run <id>` | Follow-up on an earlier run |
| `--system-prompt`, `--metadata`, `--user-id` | Guidance and bookkeeping |
| `--wait [--poll-interval <ms>] [--timeout <ms>]` | Poll until finished |

Run statuses: `queued`, `running`, `completed`, `failed`, `cancelled`. Stop reasons include `schema_satisfied`, `budget_reached`, `time_limit_reached`, `stopped`. `agent run` exits 1 when the run it prints is `failed` or `cancelled`.

Structured list example:

```bash
exacli agent run "Find 10 US climate-tech startups that raised Series A in 2026" --effort medium \
  --output-schema '{"type":"object","properties":{"companies":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string"},"website":{"type":"string"},"amount":{"type":"string"}}}}}}' \
  --json | jq '.data.id'
```

## monitor

```bash
exacli monitor create "<query>" --webhook-url https://... [--period 1d] [--name n] [--num-results n] [content options] --json \
  | jq '{id: .data.id, secret: .data.webhookSecret}'
exacli monitor list [--status active|paused|disabled] [--name n] [--metadata '{"k":"v"}'] --json \
  | jq '[.data.data[] | {id, name, status}]'
exacli monitor get <id> --json | jq '.data'
exacli monitor update <id> [--status active|paused] [--query q] [--period 6h | --remove-schedule] [--webhook-url u] --json
exacli monitor trigger <id>
exacli monitor runs <id> --json | jq '[.data.data[] | {id, status}]'
exacli monitor run <id> <run-id> --json | jq '.data.output'
exacli monitor batch pause|unpause|delete --name n [--status s] [--metadata j]      # dry run
exacli monitor batch pause --name n --execute
exacli monitor delete <id>
```

The webhook secret is returned only by `create`. Webhook URLs must be public HTTPS. The minimum period is `1h`. Monitors accept the content options above except `--summary-schema` and `--snapshot-as-of`. `--metadata` values must be strings.

## websets (requires a Websets-enabled plan)

Every Websets command accepts `--body <json|@file>` for any spec field; flags override it.

```bash
exacli webset create --query "<q>" --count 25 --entity company|person|article|research_paper \
  --criterion "<must hold>" --enrichment "<field to extract>" --json | jq '.data.id'
exacli webset get <id> --json | jq '.data | {status, searches: [.searches[]?.status]}'
exacli webset items <id> --limit 50 --json | jq '[.data.data[] | {id, url: .properties.url}]'
exacli webset preview --query "<q>" --with-items --json | jq '.data'
exacli webset-search create <id> --query "<q>" --count 10 --behavior append
exacli webset-enrichment create <id> --description "<what>" --format text|date|number|options|email|phone|url [--options a,b]
exacli webset-monitor create <id> --cron "0 9 * * 1" --count 5 [--behavior append]
exacli webset-import create file.csv --entity company [--identifier-column 0]   # first row is a header
exacli webset-webhook create --webhook-url <url> --events webset.item.created,webset.idle
exacli webset-event list --types webset.idle --json | jq '[.data.data[] | {id, type}]'
exacli team --json | jq '.data'
```

Websets run asynchronously: poll `webset get <id>` until `status` is `idle`, then read `webset items`.

## batch (beta, team must be enabled)

```bash
exacli batch create requests.jsonl --json | jq '.data.id'    # or - for stdin
exacli batch get <id> --json | jq '.data | {status, requestCounts}'
exacli batch results <id> > results.jsonl
exacli batch list --status completed
exacli batch cancel <id>
exacli batch delete <id>
```

Each request line: `{"customId":"q1","method":"POST","url":"/search","body":{"query":"..."}}` (`url` is `/search` or `/agent/runs`).
