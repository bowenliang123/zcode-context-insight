# Verification

Verified on 2026-10-20 against ZCode Desktop **3.15.3** (CLI 0.16.9, Electron 41) and Node **24.21.0**.

## Automated

| Check | Result |
| --- | --- |
| `npm test` | 11/11 domain tests pass: script-weighted estimation, image cap, session binding, preferences, file ops, composition anchoring, step detail/diff/DNA, DNA series, payload budget |
| `npm run check` | manifest name/version, `ui.surfaces`, `dist/` placeholders, HTML size, `node --check` for server/worker |
| `zcode plugins validate plugins/zcode-context` | **Plugin manifest is valid** |
| `npm run mcp-smoke` | initialize `2025-06-18`; 14 tools listed; session-bound snapshot/report succeed; missing metadata returns `binding_unavailable`; `ui://` resource returns `text/html;profile=mcp-app` |
| `npm run smoke` | service reads the live local store; snapshot, fleet, insights and report all succeed |
| `npm run test-host` | MCP Apps AppBridge handshake in an iframe; `callServerTool` reaches the service; host theme/locale changes repaint the panel; panel renders at 430 and 980 px |
| `npm run watch` | rebuilds on changes and mirrors the runtime into the installed dev plugin cache |
| `npm run register` | builds, packages, refreshes the local market, installs and enables `zcode-context@dev-zcode-context` |

Live results during this pass:

- Snapshot payload 56,162 bytes for a 638-step session, under ZCode's 64 KiB
  `structuredContent` budget; the fitter trims requests, events, file rows and timing spans further
  on longer sessions.
- Insights payload 54,047 bytes: 71 of 236 session cards after payload fitting; the panel states the
  truncation. Aggregate composition is limited to the 12 most recent sessions and says so.
- MCP Apps HTML resource 612,180 bytes, under the 16 MiB resource limit.

## Desktop install

- Local marketplace added as `dev-zcode-context` (source `/Users/bw/dev/zcode-context/plugins`).
- Plugin installed and enabled as `zcode-context@dev-zcode-context` 0.1.0, MCP server
  `plugin:zcode-context:context`, 1 command, 1 skill, 0 diagnostics.
- After the required ZCode restart, the native **Context** surface loaded and bound to the live
  session; it was inspected at the ZCode side-panel width.
- `npm run register` refreshed the installed cache and re-enabled the plugin. The running desktop app
  keeps its MCP process and cached HTML resource for the lifetime of that process, so it must be
  restarted once more to load the final runtime.

## DSH side-by-side pass

A live DSH Context tab was compared against the ZCode panel. The resulting changes:

- **Overview** is a continuous stacked area scaled to the whole loaded session, with five axis
  labels, turn labels and a duration curve — not a ribbon where every request is normalized to 100%.
- **DNA mode** draws each trend bar as a per-item fingerprint (compacted to 36 bands) and switches the
  browser to the flat DNA list. The compact series is kept across polling refreshes.
- The trend brief shows `Actual prompt / Output / Cache`, matching DSH's step detail header.
- The Context view follows DSH's right-sidebar arrangement: compact metrics strip, stacked Token and
  Timing cards, full-width Current Context and Trend, with Browser/Events/File Activity behind a slim
  detail switcher instead of competing for sidebar width.
- Token/Timing cards stack at 560 px for readability while Current/Browser keep a two-column layout.
- Overlays no longer replay entry animations on polling refreshes, and the final render is skipped
  while a drawer/panel is open. A changed snapshot can still refresh step detail beneath the overlay.

## Screenshots

- `docs/images/context-panel.png` — the native ZCode Context panel at 2× (1434 × 1736), captured from
  the running desktop app.
- The remaining screenshots were captured from the built panel with live local data at 980 px:
  `context-overview.png`, `context-dna.png`, `context-browser.png`, `file-activity.png`, `fleet.png`,
  `insights.png` and `settings.png`.

## Known host limits

- Only session-scoped `ui.surfaces` are supported, so Insights and Fleet are internal tabs rather
  than separate sidebar pages.
- The panel API exposes no session switch; Fleet and Insights cards show details instead of opening
  another session.
- No prompt prefix/suffix injection contract; omitted.
- DNA forces Total mode; per-item DNA Delta is not implemented.
- Default Model I/O retention drops older request headers; coverage warnings explain approximations.
- Node.js 24+ is required for `node:sqlite`.
