# zcode-context-insight

A ZCode UI plugin for context insight and management, adapted from DeepSeek Harness's `dsh-context`.

## Background

- ZCode:
  - Open-source agent workbench by Z.ai: https://github.com/zai-org/ZCode
  - Local clone at `~/dev/ZCode`. `git pull` on `main` to update; it is the source of truth for
    the UI plugin contract, session store, model-I/O writer and retention rules.
  - Read `UI_PLUGIN.md` and the host sources before changing any UI surface, MCP resource or
    session-binding behavior.
  - The live desktop app is `/Applications/ZCode.app` (3.15.x); data is under `~/.zcode`.
- The original plugin:
  - `dsh-context` at `~/dev/dsh-context` — feature and interaction reference, not a runtime
    dependency. Read the source rather than relying on stale README screenshots.
- Plugin contract:
  - Source manifest: `.zcode-plugin/plugin.json`
  - Distribution: `plugins/zcode-context-insight/` plus `plugins/marketplace.json`
  - Runtime: one MCP stdio server (`dist/server.mjs`), one worker (`dist/worker.mjs`), one MCP Apps
    HTML resource (`dist/context.html`), built by `scripts/build.mjs`.

## Coding

- Make the minimal change that fully solves the problem.
- Data accuracy and integrity come first. Never sacrifice them for refactors, performance or visual
  polish. Verify changes against the real local ZCode store, not only fixtures.
- Read-only guarantees are part of the product contract:
  - SQLite is opened `readOnly` with `PRAGMA query_only`.
  - No migrations, no session writes, no network, no model calls.
  - The only write is the plugin's own preferences file under `ZCODE_PLUGIN_DATA`.
  - Session identity comes only from `_meta["com.zcode/request-context"]`; never accept a session id
    from page state or a tool argument.
- Reuse ZCode's own MCP Apps contract (`ui.surfaces`, app-only tool visibility, 64 KiB
  `structuredContent`) rather than inventing a side channel.
- Keep source and tests modular. Split a module before it grows past ~1,000 lines; the existing
  `ui/app.mjs` and `ui/styles.css` are large and should be split when touched for a substantial
  change, not expanded by default.
- Prefer targeted, bounded SQL. Full tool outputs are read one element at a time and chunked.
- Comments only for non-obvious decisions, data semantics or host constraints. Remove comments that
  restate the code.
- Write code comments, docs, commit messages and PR descriptions in English.
- Temporary files go under `.tmp/` and are removed after use.

## Pre-commit checks

Complete all of these before any commit:

- Close out the todo list; every item completed, cleaned up or explicitly closed.
- Review the full diff independently; every change necessary and correct.
- Clean up temporary files, debug logs and temporary comments.
- Load the `code-review` skill when available, run it, and verify/follow its findings.
- Run:
  - `npm test` — domain tests
  - `npm run check` — manifest, build output, syntax, environment
  - `npm run mcp-smoke` — real stdio MCP handshake, tools, session binding, Insights path
  - `node /Applications/ZCode.app/Contents/Resources/glm/zcode.cjs plugins validate plugins/zcode-context-insight`
- Capture complete output; do not truncate a failing test or type/lint error.
- If the UI changed, take fresh screenshots and update the README images.

## Layout & responsive

- The panel is a resizable ZCode session side pane, not the viewport. Drive layout with container
  queries; never assume the app window width.
- Follow the DSH right-sidebar arrangement:
  - compact metrics strip;
  - Token Stats and Timing Stats stacked full width;
  - Current Context and Context Trend full width;
  - Browser / Events / File Activity behind a slim detail switcher.
- Fold, never crush: wrap rows or stack cards instead of truncating into unreadability. No
  horizontal scrollbars and no overlapping content.
- Verify at 320, 390, 560 and 980 px, in English and 简体中文, with a long session. English labels are
  the truncation stress case.
- Overlays portal to the document body; do not put them inside a container-query containment box.
- Verify against the real MCP Apps host after rebuilding. The host caches the HTML resource and MCP
  process: close/reopen the panel for UI-only changes; restart ZCode for server or worker changes.

## Build & run

- **Build**: `npm run build` (writes `dist/`).
- **Watch / hot rebuild**: `npm run watch` rebuilds on changes and mirrors `dist/` into the installed
  dev plugin cache (`~/.zcode/cli/plugins/cache/dev-zcode-context-insight/zcode-context-insight/<version>/dist`).
  - UI-only change: close and reopen the Context panel, which re-reads the MCP resource.
  - Server/worker change: restart ZCode; the running MCP process keeps its module graph.
- **Register**: `npm run register` builds, packages, refreshes the local market, installs/enables
  `zcode-context-insight@dev-zcode-context-insight`, and syncs the runtime.
- **Browser preview**: `npm run preview` — opens `127.0.0.1:4180` with real local data; append
  `?theme=dark` or `?lang=en`.
- **MCP Apps harness**: `npm run test-host` — AppBridge + iframe, real `callServerTool` and host
  context changes.
- **Smoke**: `npm run smoke` (service) and `npm run mcp-smoke` (stdio MCP).
- **Package**: `npm run package` — writes `plugins/zcode-context-insight/` and the local catalog.
- **Node**: 24+ on PATH. ZCode's MCP launcher uses the declared `node` command.

## Compatibility

- Baseline: ZCode Desktop **3.15.1+** with the official MCP Apps UI contract; tested on 3.15.3.
- Node.js **24+** (`node:sqlite`, worker threads).
- Models: context windows resolve from ZCode provider config → bundled models.dev snapshot → user
  override; unknown windows must stay unknown rather than fabricated.
- Model I/O retention is bounded by default. Messages come from the complete SQLite store; older
  headers may be approximated from the nearest recorded request and must be labeled as such.
- Keep compatibility behavior explicit in `docs/verification.md` when the supported set changes.

## I18n

- English and 简体中文 are supported.
- Update both dictionaries (`ui/i18n.mjs`) whenever adding or changing UI text.
- Remove unused or deprecated keys.

## Docs

- `docs/` contains user-facing documents and screenshots only.
- README images use raw GitHub URLs so they render on GitHub and package pages; files live under
  `docs/images/`.
- Update the screenshot after a visible layout/interaction change.
- Keep `docs/verification.md` current with the tested host version, commands, known limits and
  whether the native surface was actually exercised.

## Git

- When asked to commit, commit changes separately by task or purpose.
- `gh` is available; push after creating commits.
- Do not commit `node_modules/`, root `dist/`, cache dumps or local plugin data.
- The packaged `plugins/zcode-context-insight/dist` is a deliberate distribution artifact and is committed.
