# Verification

Verified on 2026-10-19 against ZCode Desktop **3.15.3** (CLI 0.16.9, Electron 41) and Node **24.21.0**.

## Automated

| Check | Result |
| --- | --- |
| `npm test` | 11/11 domain tests pass: script-weighted estimation, image cap, session binding, preferences, file ops, composition anchoring, step detail/diff/DNA, payload budget |
| `npm run check` | manifest name/version, `ui.surfaces`, `dist/` placeholders, HTML size, `node --check` for server/worker |
| `zcode plugins validate plugins/zcode-context` | **Plugin manifest is valid** |
| `npm run mcp-smoke` | initialize `2025-06-18`; 14 tools listed; session-bound snapshot/report succeed; missing metadata returns `binding_unavailable`; `ui://` resource returns `text/html;profile=mcp-app` |
| `npm run test-host` | MCP Apps AppBridge handshake in an iframe; `callServerTool` reaches the service; host theme/locale changes repaint the panel; full panel renders at 430 and 980 px |

Live snapshot result during verification: ~55.9 KiB JSON, under ZCode's 64 KiB `structuredContent`
budget; the fitter trims requests, events, file rows and timing spans further on longer sessions.

## Desktop install

- Local marketplace added as `dev-zcode-context` (source `/Users/bw/dev/zcode-context/plugins`).
- Plugin installed and enabled as `zcode-context@dev-zcode-context` 0.1.0, MCP server
  `plugin:zcode-context:context`, 1 command, 1 skill, 0 diagnostics.
- After the required ZCode restart, the native **Context** surface loaded and bound to the live
  session; it was inspected at the ZCode side-panel width. The panel then showed the earlier build.
- The final Overview/DNA/layout build is packaged and installed. The app must be restarted once more
  to load the updated HTML resource and MCP server process; the running app caches both for the
  lifetime of its plugin process.
- The final visual behaviors (continuous Overview area, DNA fingerprint bars, responsive layout,
  Actual/Output/Cache chips) were verified in the browser preview and the AppBridge host harness.

## DSH side-by-side pass

A live DSH Context tab (local harness) was compared against the ZCode panel. Two differences were
fixed after that pass:

- **Overview** is now a continuous stacked area scaled to the whole session, with five axis labels,
turn labels and a duration curve — not a ribbon where every request is normalized to 100%.
- **DNA mode** now draws each trend bar as a per-item fingerprint (compacted to 36 bands) and switches
the browser to the flat DNA list. The series is kept across polling refreshes, so the fingerprint does
not flicker back to category bars.
- The trend detail now shows `Actual / Output / Cache`, matching DSH's step detail header.
- The Context view now follows DSH's right-sidebar arrangement: compact metrics strip, stacked Token
  and Timing cards, full-width Current Context and Trend, with Browser/Events/File Activity behind a
  slim detail switcher instead of competing for sidebar width.
- Token/Timing cards stack at 560 px for readability while Current/Browser keep a two-column layout.

## Screenshots

- `docs/images/context-panel.png` — Context view, 980 px, live session.
- Additional local screenshots were captured during development at 430 px and 980 px for Context,
  Fleet, Insights, element detail, compaction detail, and dark/English mode.

## Known host limits

- Only session-scoped `ui.surfaces` are supported, so Insights and Fleet are internal tabs rather
  than separate sidebar pages.
- The panel API exposes no session switch; Fleet and Insights cards show details instead of opening
  another session.
- No prompt prefix/suffix injection contract; omitted.
- Default Model I/O retention drops older request headers; coverage warnings explain approximations.
- Node.js 24+ is required for `node:sqlite`.
