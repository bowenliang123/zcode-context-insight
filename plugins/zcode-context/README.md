# zcode-context

A read-only, offline context insight panel for [ZCode](https://github.com/zai-org/ZCode), adapted from the
feature set of [dsh-context](https://github.com/bowenliang123/dsh-context) for DeepSeek Harness.

Open it from any session's right-side panel switcher and see what the model is actually carrying:

- **Context** — current composition, per-request trend, full request browser, injections and
  compactions, and file activity.
- **Fleet** — the current agent, its parents and every subagent, with billed tokens, estimated cost and
  context occupancy.
- **Insights** — cross-session usage, a 7-day chart, an 8-week heatmap, token mix, aggregate
  composition and searchable session cards.

It never changes a session, never calls a model and never touches the network.

![Context panel](docs/images/context-panel.png)

## What it answers

| Question | Where |
| --- | --- |
| How full is the window right now, and what is in it? | **Current Context** bar and legend |
| Which part of the context is responsible? | system prompt, tool schemas, user, injected context, skills, assistant, tool results |
| How did it grow? | **Context Trend**: one stacked bar per request, Step/Turn, Total/Delta, overview, duration overlay |
| What exactly did request #N carry? | **Context Browser**: categories, search, sort, DNA order, full element content |
| What changed between requests? | Compare with the previous step or turn; added/removed/token deltas |
| What did the runtime inject? | **Context Events**: reminders, agent listings, background-task notices, skill loads, compaction summaries |
| What did a compaction remove? | compaction event → **What was summarized**, on the active branch |
| What did the agent do to files? | **File Activity**: read/write/search/image rows, line deltas, per-op log |
| How is the agent family doing? | **Fleet**: lineage cards, live status, context occupancy, cost |
| What did I use across sessions? | **Insights**: KPIs, daily chart, heatmap, token mix, composition, session cards |
| Quick summary in chat | `/context` |

## Install

### From a local development checkout

```sh
npm install
npm run build
npm run package
```

`npm run package` writes the installable plugin to `plugins/zcode-context/` and a local catalog to
`plugins/marketplace.json`.

1. Open **Settings → Plugin Management → Discover**.
2. Click **+** / **Add Plugin Marketplace** and paste the absolute path to
   `<checkout>/plugins` (the directory containing `marketplace.json`).
3. Open the new market, install **zcode-context**, and enable it.
4. Restart ZCode if it was already running when the plugin was installed, so the app reloads plugin surfaces.
5. Open a session, click **+** in the right-side panel switcher, and choose **Context**.

Updates: run `npm run build && npm run package`, refresh the marketplace, and reinstall/update the
plugin. Preserve the same local market name; don't create a second market for the same source.

### From GitHub

Add `bowenliang123/zcode-context` (or the full repository URL) as a plugin marketplace, install
**zcode-context**, and enable it. The repository root `marketplace.json` points at the packaged plugin
under `plugins/zcode-context`; run `npm run build && npm run package` before publishing a release so
that directory is present.

**Requirement:** Node.js 24+ on PATH (`node -v`). The MCP server needs `node:sqlite` and worker
threads. No npm/build tooling is needed at runtime; `dist/` is self-contained.

## Use

### The Context panel

The panel is session-scoped and follows the host's theme and locale (English / 简体中文).

- **Step selector** — `‹`/`›` or the dropdown move between agent requests. Clicking a trend bar pins
  that request; the panel keeps your selection while new requests arrive and offers **N newer
  requests** to jump back. Keyboard `←`/`→` works when focus is not in a field.
- **Current Context** — the provider-reported prompt size, the resolved window, occupancy, an
  explicitly labelled output reserve, and the full composition bar.
- **Context Trend** — stacked category bars; Step/Turn granularity; Total/Delta; **Overview** as a
  continuous stacked area scaled to the loaded session window (with four axis ticks, turns and a duration
  curve); **DNA mode** draws each loaded trend bar as a per-item fingerprint and switches the browser to its flat
  DNA list; Adaptive scaling; hover details and click-to-pin. Compactions, model switches and rewinds
  are marked above the bar.
- **Context Browser** — category groups with token totals and change badges; search; sort by
  size/name/prompt order/calls; **Changes** mode against a previous step or turn; **DNA** mode that
  flattens every item in prompt order (newest at the top). Click any item for its full content, tool
  arguments, result body, raw JSON, and find-in-content.
- **Context Events** — filter by Inject / Compact / Switch / Rewind. Injection rows open the exact
  browser item; compaction rows open **What was summarized** with pagination.
- **File Activity** — filter Read / Written / Searched / Images, search paths, sort by ops/latest/
  path/name/added lines; expand a file for its per-operation log and jump to the tool result.
- **Coverage** — exact vs approximated headers, Model I/O retention state, and a link to the setting
  that improves future coverage.

### The `/context` command

Type `/context` in the composer. The plugin's model-visible `get_context_report` tool returns a
compact report for the current session (current prompt, occupancy, composition, counts, recent
events, coverage). The command asks the agent to present it without inventing figures.

### Preferences

The gear opens per-user preferences: default view, trend granularity/mode, comparison baseline,
duration curve, file sort, tool sort, currency, language, context-window override, and compact
cards. Preferences are stored in the plugin data directory (`ZCODE_PLUGIN_DATA` or
`~/.zcode/zcode-context/preferences.json`) and do not change the session.

## How the numbers are made

- **Messages** are reconstructed from ZCode's complete session store: `message` and `part` rows,
  including tool calls/results, synthetic reminders, compaction summaries, images and attachments.
  `semantics.providerVisibility` decides what was sent to the model; `session.revert` decides the
  active branch.
- **Header** (system prompt + tool schemas) comes from ZCode's model-I/O trajectory
  (`~/.zcode/cli/rollout/model-io-<session>.jsonl`). The file uses `full` / `delta` / `tail`
  encoding; the panel understands all three.
- **Per-request totals** come from `model_usage`: `input_tokens` is the provider-reported prompt
  (cache read included), `output_tokens` is exact, and cache creation/read are kept separate.
  Category proportions are heuristic and scaled so their sum matches the actual prompt.
- **Token heuristics** use a script-weighted density (~4 ASCII / 1.5 CJK / 2 other characters per
  token), plus block and role overhead. Images use the DeepSeek 14px-patch vision calculator when
  dimensions are recorded. All category figures are labelled `≈`; prompt and output totals are not.
- **Timing** uses `model_usage` duration/TTFT plus `tool_usage`; the strip paints TTFT, generation,
  tool runs and gaps. Parallel tool runs may overlap, so the ring clamps the tool slice while the rows
  keep the true sums.
- **Cost** is an estimate from a bundled [models.dev](https://models.dev) snapshot at list price
  (USD, or CNY at 1 CNY = 0.15 USD). Unknown models show `—`; no price is fetched at runtime.
- **Context window** resolves in this order: your override → ZCode's provider config →
  models.dev → unknown. Unknown windows show composition without a fake percentage.
- **File activity** uses Read/Write/Edit metadata (including exact edit additions/deletions) and a
  conservative shell parser for unambiguous Bash paths; shell-derived ops are marked as estimates.

## Data coverage and retention

ZCode's default **Model I/O retention is bounded**: production keeps at most three session
trajectory files, resets a session file at 64 MiB, and writes only a trailing message window plus
deltas. This plugin therefore reconstructs **messages** from the complete session store, while the
**header** of an older request may be approximated from the nearest recorded request. The panel says
so in the Coverage card and in the footer; it never presents an approximation as exact.

For exact historical headers, enable **Settings → General → Keep complete model I/O** in ZCode. It
applies to future requests only; records already discarded cannot be recovered. The plugin never
changes this setting.

Other limits: usage rows and logs are retained for shorter windows than the session store; a
session whose model-I/O file is gone still shows a complete message composition with a `header
missing` residual. Rewound branches are read-only; the summarized-message list follows the active
branch and says when the compaction itself is on an abandoned branch.

## Adaptation notes (DSH → ZCode)

| dsh-context | zcode-context |
| --- | --- |
| Conversation **Context** / **Fleet** tabs, Insights sidebar page, `/context` modal | One session-scoped MCP Apps surface with **Context / Fleet / Insights** tabs; ZCode only exposes session-scoped `ui.surfaces`, not a global sidebar page or a programmatic modal. |
| `/context` modal | `/context` command + model-visible `get_context_report`; the interactive browser remains one click away in the panel. |
| Host `contextPressure` / `contextBreakdown` projections | Provider-reported `model_usage` + a complete SQLite message store; headers from model-I/O. |
| DSH subagent/team projections | ZCode `session.parent_id` / `task_type = subagent_child`; Fleet is informational because the panel host exposes no session switch. |
| File preview / attachment preview column | Read-only metadata and content; paths can be copied. The plugin never loads external resources. |
| Prompt prefix/suffix injection | Not available in ZCode's plugin contract; omitted rather than faked. |
| Live plugin attribution (`tools.register`) | Tool-source chips: `built-in`, `plugin`, or `mcp:<server>` inferred from the tool name. |
| One band per item in every trend bar | DNA uses a compact per-request band series fetched on demand (up to 36 bands per bar); the browser carries the full, paged DNA list. |

The interaction vocabulary is kept: follow vs pin, hover/pin trend, step brief, category diff,
DNA order, events filters, file filters, and the current-composition reserve masks.

## Privacy

- Reads only local files: `~/.zcode/cli/db/db.sqlite`, `db.sqlite-wal`, `rollout/`, `debug/`, `log/`
  and, for context windows, `~/.zcode/v2/provider_config.json` (model rules only). It also reads
  `~/.zcode/v2/setting.json` for the retention flag.
- Opens SQLite `readOnly` with `PRAGMA query_only`; no migrations, writes or locks.
- No network, no telemetry, no model calls. The HTML resource declares an empty CSP allowlist.
- Full tool outputs are read one element at a time and chunked; session listings use bounded SQL
  fields. Every result-producing read is capped under ZCode's 64 KiB `structuredContent` budget, with
  element content, event pages, DNA lists and category pages paginated rather than truncated silently.

## Development

```sh
npm install          # esbuild + MCP SDK
npm run build        # dist/server.mjs, dist/worker.mjs, dist/context.html
npm test             # domain tests
npm run check        # manifest, build and syntax checks
npm run smoke        # live local database smoke
npm run mcp-smoke    # real stdio MCP handshake + tools/resource
npm run preview      # browser preview over the live service
npm run test-host    # MCP Apps AppBridge handshake + tool calls in an iframe
npm run package      # installable plugin + local marketplace
```

`npm run preview` serves the built panel on `127.0.0.1` with a small local transport to the same
read-only service; append `?theme=dark` or `?lang=en` to inspect the other theme/locale.

Key paths:

```
src/server.mjs          MCP stdio server and session binding
src/worker.mjs          read-only SQLite worker
src/service.mjs         cached session view + payload fitting
src/data/db.mjs         schema-tolerant bounded SQL queries
src/data/rollout.mjs    model-I/O full/delta/tail reader
src/domain/compose.mjs  request snapshots, trend, diff, brief
src/domain/items.mjs    per-element extraction and token estimates
src/domain/events.mjs   injections, compactions, model switches, rewinds
src/domain/files.mjs    file operations and aggregation
src/domain/detail.mjs   full element and summarized-message content
ui/app.mjs              MCP App UI
ui/styles.css           card/chart visual system
```

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Feature and interaction design is adapted
from **dsh-context** (Apache-2.0); model metadata and list prices come from **models.dev**.
