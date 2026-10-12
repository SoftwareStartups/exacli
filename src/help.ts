/**
 * Help text for the top-level CLI and each command.
 */

const CONTENT_OPTIONS = `Content Options:
  --text                          Return page text
  --max-characters <n>            Cap text length
  --include-html-tags             Keep lightweight HTML tags in text
  --text-verbosity <level>        compact (default), standard, full
  --include-sections <list>       Only these sections: header, navigation,
                                  banner, body, sidebar, footer, metadata
  --exclude-sections <list>       Drop these sections
  --highlights                    Return query-relevant excerpts (recommended)
  --highlights-query <text>       Custom query that steers highlight selection
  --highlights-max-characters <n> Cap highlight length per result
  --highlights-verbosity <level>  low, medium, high (beta)
  --dynamic-highlights            Share one context budget across results (beta)
  --summary                       Return an LLM summary
  --summary-query <text>          Custom summary query
  --summary-schema <json|@file>   JSON schema for a structured summary
  --max-age-hours <n>             Cache freshness: 0 = always crawl,
                                  -1 = cache only, n = crawl if older
  --snapshot-as-of <date>         Serve the page as stored at this ISO date/time
  --livecrawl <mode>              Deprecated, use --max-age-hours
                                  (never, always, fallback, preferred)
  --livecrawl-timeout <ms>        Live crawl timeout
  --subpages <n>                  Crawl n subpages per result
  --subpage-target <list>         Terms that pick which subpages to crawl
  --extras-links <n>              Links per result
  --extras-image-links <n>        Image links per result
  --extras-rich-links <n>         Rich links per result
  --extras-rich-image-links <n>   Rich image links per result
  --extras-code-blocks <n>        Code blocks per result`;

const PAGINATION = `Pagination:
  --limit <n>                     Results per page
  --cursor <token>                Cursor from a previous page`;

const WEBSET_COMMON = `Websets options accept --body <json|@file> with any field from the API spec
(https://exa.ai/docs/websets/api); flags override keys in --body.`;

export const MAIN_HELP = `
Exacli - Exa AI search, contents, answers, agents, and monitors

Usage: exacli <command> [subcommand] [options] [arguments]

Commands:
  search <query>              Search the web
  contents <url...>           Get contents of URLs
  answer <query>              Get an AI answer with citations
  similar <url>               Find pages similar to a URL (deprecated by Exa)
  agent <subcommand>          Exa Agent runs: run, get, list, cancel, stop,
                              delete, events
  monitor <subcommand>        Scheduled searches with webhook delivery: create,
                              list, get, update, delete, trigger, runs, run, batch
  batch <subcommand>          Async request batches (beta): create, list, get,
                              cancel, delete, results
  webset <subcommand>         Websets: create, list, get, update, delete,
                              cancel, preview, items, item, item-delete
  webset-search               Searches in a webset: create, get, cancel
  webset-enrichment           Enrichments: create, get, update, delete, cancel
  webset-monitor              Scheduled webset searches: create, list, get,
                              update, delete, runs, run
  webset-import               CSV imports: create, list, get, update, delete
  webset-webhook              Websets webhooks: create, list, get, update,
                              delete, attempts
  webset-event                Websets events: list, get
  team                        Team info and concurrency limits (Websets API)
  login                       Store API key in the OS keychain
  logout                      Remove stored API key

Global Options:
  --api-key <key>             Exa API key (or EXA_API_KEY env var)
  --json                      Output {"ok":true,"data":...} JSON envelope
  --version                   Show version
  -h, --help                  Show help (also: exacli <command> --help)

Examples:
  exacli search "AI startups" --num-results 5 --highlights
  exacli contents https://example.com --text --max-characters 2000
  exacli answer "What is quantum computing?"
  exacli agent run "List 10 YC robotics startups" --effort low
  exacli monitor create "AI chip funding" --period 1d --webhook-url https://example.com/hook
`;

export const COMMAND_HELP: Record<string, string> = {
  search: `
Usage: exacli search <query> [options]

Search Options:
  --num-results <n>               Number of results (1-100, default 10)
  --type <type>                   auto (default), fast, instant, deep-lite,
                                  deep, deep-reasoning
  --category <category>           company, people, publication, news,
                                  personal site, financial report
  --include-domains <list>        Only these domains (paths and *.wildcards ok)
  --exclude-domains <list>        Skip these domains
  --start-date <date>             Published after (ISO 8601)
  --end-date <date>               Published before (ISO 8601)
  --objective <text>              Broader goal this search serves (ranking hint)
  --system-prompt <text>          Guidance for search and synthesized output
  --output-schema <json|@file>    Synthesize output: {"type":"text"} or
                                  {"type":"object","properties":{...}}
  --stream                        Stream synthesized output (needs --output-schema)
  --additional-queries <list>     Extra query variations (deep types only)
  --user-location <cc>            ISO country code, e.g. US
  --latitude <n> --longitude <n>  User coordinates (set together)
  --moderation                    Filter unsafe content
  --user-id <id>                  End-user identifier for usage attribution
  --compliance <mode>             hipaa (enterprise only)
  --include-text <list>           Deprecated: required text
  --exclude-text <list>           Deprecated: forbidden text

${CONTENT_OPTIONS}

Without content options, results contain title, URL, and metadata only.
`,
  contents: `
Usage: exacli contents <url...> [options]

  --user-id <id>                  End-user identifier for usage attribution
  --compliance <mode>             hipaa (enterprise only)

${CONTENT_OPTIONS}
`,
  similar: `
Usage: exacli similar <url> [options]

Exa deprecated /findSimilar; prefer search for new workflows.

  --num-results <n>               Number of results (1-100, default 10)
  --exclude-source-domain         Skip results from the source domain
  --category <category>           Category filter
  --include-domains <list>        Only these domains
  --exclude-domains <list>        Skip these domains
  --start-date <date>             Published after (ISO 8601)
  --end-date <date>               Published before (ISO 8601)

${CONTENT_OPTIONS}
`,
  answer: `
Usage: exacli answer <query> [options]

  --model <model>                 exa (default), exa-pro, exa-research, exa-fast
  --text                          Include source text in citations
  --stream                        Stream the answer
  --system-prompt <text>          Guidance for the answer
  --output-schema <json|@file>    JSON Schema for a structured answer
  --user-location <cc>            ISO country code, e.g. US
  --latitude <n> --longitude <n>  User coordinates (set together)
  --user-id <id>                  End-user identifier for usage attribution
`,
  agent: `
Usage: exacli agent <subcommand> [options]

Subcommands:
  run <query>                     Start an agent run (returns immediately)
  get <run-id>                    Get a run, including output when completed
  list                            List runs
  cancel <run-id>                 Cancel a queued or running run
  stop <run-id>                   Stop an ultra run early, keeping results
  delete <run-id>                 Delete a stored run
  events <run-id>                 List stored run events

Run Options:
  --effort <level>                minimal, low, medium, high, xhigh,
                                  auto (default), ultra
  --system-prompt <text>          Guidance for the agent
  --output-schema <json|@file>    JSON Schema for output.structured
  --input <json|@file>            {"data":[...],"exclusion":[...]} records
  --previous-run <run-id>         Continue from an earlier run
  --data-sources <list>           Exa Connect providers, e.g. fiber,similarweb,
                                  financial_datasets,baselayer,polymarket
  --max-cost <usd>                Budget cap for auto/ultra ($1-$100)
  --max-duration <seconds>        Time cap for ultra (300-10800)
  --metadata <json|@file>         Metadata stored with the run
  --user-id <id>                  End-user identifier for usage attribution
  --wait                          Poll until the run finishes
  --poll-interval <ms>            Poll interval with --wait (default 5000)
  --timeout <ms>                  Give up waiting after this (default 1800000)
  --stream                        Stream run events until it finishes

${PAGINATION}
`,
  monitor: `
Usage: exacli monitor <subcommand> [options]

Subcommands:
  create <query>                  Create a monitor (requires --webhook-url)
  list                            List monitors
  get <monitor-id>                Get a monitor
  update <monitor-id>             Update a monitor
  delete <monitor-id>             Delete a monitor
  trigger <monitor-id>            Run a monitor now
  runs <monitor-id>               List runs
  run <monitor-id> <run-id>       Get a run with its output
  batch <delete|pause|unpause>    Bulk action on monitors matching filters
                                  (dry run unless --execute)

Create/Update Options:
  --name <name>                   Monitor name (also a list/batch filter)
  --query <query>                 New search query (update only)
  --period <duration>             Run interval, e.g. 1h, 6h, 1d, 7d (min 1h)
  --remove-schedule               Remove the schedule (update only)
  --status <status>               active, paused (update); active, paused,
                                  disabled (list/batch filter)
  --webhook-url <url>             HTTPS URL that receives results
  --webhook-events <list>         monitor.created, monitor.updated,
                                  monitor.deleted, monitor.run.created,
                                  monitor.run.completed
  --output-schema <json|@file>    Synthesized output schema
  --metadata <json|@file>         Metadata (also a list/batch filter)
  --num-results <n>               Results per run
  --include-domains <list>        Only these domains
  --exclude-domains <list>        Skip these domains
  --execute                       Apply a batch action (default is dry run)

${CONTENT_OPTIONS}

${PAGINATION}
`,
  batch: `
Usage: exacli batch <subcommand> [options]

Subcommands:
  create <file|->                 Submit requests from a JSON array or JSONL
                                  file (- reads stdin). Each request:
                                  {"customId","method":"POST",
                                   "url":"/search"|"/agent/runs","body":{...}}
  list                            List batches (--status completed)
  get <batch-id>                  Get batch status and counts
  cancel <batch-id>               Cancel an in-progress batch
  delete <batch-id>               Delete a finished batch
  results <batch-id>              Download results (JSONL) of a completed batch

Options:
  --metadata <json|@file>         Metadata stored with the batch (create)
  --status completed              Only completed batches (list)

${PAGINATION}
`,
  webset: `
Usage: exacli webset <subcommand> [options]

Subcommands:
  create                          Create a webset (--query starts a search)
  list                            List websets (--query filters by text)
  get <webset-id>                 Get a webset (--expand items)
  update <webset-id>              Update --title / --metadata
  delete <webset-id>              Delete a webset
  cancel <webset-id>              Cancel all running operations
  preview                         Preview how --query will be decomposed
                                  (--with-items also returns sample items)
  items <webset-id>               List items (--source-id filters by source)
  item <webset-id> <item-id>      Get an item with evaluations and enrichments
  item-delete <webset-id> <item-id>

Options:
  --query <text>                  Search query
  --count <n>                     Items to find
  --entity <type>                 company, person, article, research_paper, custom
  --entity-description <text>     Required with --entity custom
  --criterion <text>              Criterion items must meet (repeatable)
  --enrichment <text>             Enrichment to add on create (repeatable)
  --recall                        Estimate how many matches exist
  --title <text>                  Webset title
  --external-id <id>              Your own identifier
  --metadata <json|@file>         Key-value metadata
  --body <json|@file>             Raw request body (scope, exclude, import, ...)

${PAGINATION}

${WEBSET_COMMON}
`,
  'webset-search': `
Usage: exacli webset-search <subcommand> [options]

Subcommands:
  create <webset-id>              Run a new search (--query and --count required)
  get <webset-id> <search-id>     Get search progress
  cancel <webset-id> <search-id>  Cancel a running search

Options:
  --query, --count, --entity, --entity-description, --criterion (repeatable)
  --behavior <override|append>    Replace or add to existing items
  --recall                        Estimate how many matches exist
  --metadata <json|@file>, --body <json|@file>

${WEBSET_COMMON}
`,
  'webset-enrichment': `
Usage: exacli webset-enrichment <subcommand> [options]

Subcommands:
  create <webset-id>                    Add an enrichment (--description required)
  get <webset-id> <enrichment-id>
  update <webset-id> <enrichment-id>
  delete <webset-id> <enrichment-id>
  cancel <webset-id> <enrichment-id>

Options:
  --description <text>            What to extract for each item
  --format <format>               text, date, number, options, email, phone, url
  --options <list>                Labels when --format options
  --metadata <json|@file>, --body <json|@file>
`,
  'webset-monitor': `
Usage: exacli webset-monitor <subcommand> [options]

Subcommands:
  create <webset-id>              Schedule searches that add items to a webset
  list                            List monitors (--webset <id> filters)
  get <monitor-id>
  update <monitor-id>             Change schedule, search, or --status
  delete <monitor-id>
  runs <monitor-id>               List runs
  run <monitor-id> <run-id>       Get a run

Options:
  --cron <expr>                   5-field cron, at most once per day
  --timezone <iana>               Default Etc/UTC
  --count <n>                     Max new items per run
  --query, --entity, --entity-description, --criterion (repeatable)
  --behavior <override|append>
  --status <enabled|disabled>     update only
  --metadata <json|@file>, --body <json|@file>

${PAGINATION}
`,
  'webset-import': `
Usage: exacli webset-import <subcommand> [options]

Subcommands:
  create <file.csv>               Create an import and upload the CSV
                                  (--entity required)
  list
  get <import-id>
  update <import-id>              Update --title / --metadata
  delete <import-id>

Options:
  --entity <type>, --entity-description <text>
  --identifier-column <n>         0-based column holding the key (e.g. URL)
  --title <text>, --metadata <json|@file>, --body <json|@file>

${PAGINATION}
`,
  'webset-webhook': `
Usage: exacli webset-webhook <subcommand> [options]

Subcommands:
  create                          --webhook-url and --events required
  list
  get <webhook-id>
  update <webhook-id>
  delete <webhook-id>
  attempts <webhook-id>           Delivery attempts (--event-type,
                                  --successful true|false)

Options:
  --webhook-url <url>             Destination URL
  --events <list>                 e.g. webset.created,webset.item.created,
                                  webset.search.completed
  --metadata <json|@file>, --body <json|@file>

${PAGINATION}
`,
  'webset-event': `
Usage: exacli webset-event <subcommand> [options]

Subcommands:
  list                            --types <list>, --created-after <iso>,
                                  --created-before <iso>
  get <event-id>

${PAGINATION}
`,
  team: `
Usage: exacli team

Shows the team, its concurrency usage, and limits (Websets API).
`,
  login: `
Usage: exacli login [--api-key <key>] [--skip-validation]

Stores the API key in the OS keychain. Prompts when --api-key is omitted.
`,
  logout: `
Usage: exacli logout

Removes the stored API key from the OS keychain.
`,
};
