/**
 * MCP Apps host harness for the built panel. Unlike preview.mjs (which calls the service directly
 * from the page), this exercises the real `@modelcontextprotocol/ext-apps` AppBridge handshake in an
 * iframe, including host context updates and `callServerTool`.
 *
 * Usage: node scripts/test-host.mjs [--session id] [--port 4190] [--open]
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { resolvePaths } from '../src/data/paths.mjs'
import { createService } from '../src/service.mjs'

const args = process.argv.slice(2)
const getArg = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const paths = resolvePaths()
const db = new DatabaseSync(paths.dbPath, { readOnly: true })
const sessionId = getArg('--session') ?? db.prepare('SELECT id FROM session ORDER BY time_updated DESC LIMIT 1').get()?.id
db.close()
if (!sessionId) {
  console.error('No sessions in the local store.')
  process.exit(1)
}
const service = createService(paths)
const panelHtml = await readFile(join(root, 'dist/context.html'), 'utf8')

const hostSource = `
import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge'
const frame = document.getElementById('panel')
let context = {
  theme: 'light',
  locale: 'zh-CN',
  displayMode: 'fullscreen',
  platform: 'desktop',
  containerDimensions: { width: 430, maxHeight: 1200 },
}
const bridge = new AppBridge(
  null,
  { name: 'zcode-context-test-host', version: '0.1.0' },
  { serverTools: {}, serverResources: {}, logging: {} },
  { hostContext: context },
)
bridge.oncalltool = async (params) => {
  const response = await fetch('/api/tool', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: params.name, arguments: params.arguments ?? {} }),
  })
  const payload = await response.json()
  if (payload.error) {
    return {
      isError: true,
      content: [{ type: 'text', text: payload.error.message }],
      structuredContent: { error: payload.error },
    }
  }
  return { content: [], structuredContent: payload.structuredContent }
}
await new Promise((resolve) => {
  if (frame.contentWindow) resolve()
  else frame.addEventListener('load', resolve, { once: true })
})
frame.src = '/panel'
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow))
document.getElementById('theme').onclick = () => {
  context = { ...context, theme: context.theme === 'dark' ? 'light' : 'dark' }
  bridge.setHostContext(context)
}
document.getElementById('locale').onclick = () => {
  context = { ...context, locale: context.locale === 'zh-CN' ? 'en-US' : 'zh-CN' }
  bridge.setHostContext(context)
}
document.getElementById('status').textContent = 'connected · ' + context.locale + ' · ' + context.theme
`
const bundle = await build({
  stdin: { contents: hostSource, resolveDir: root, loader: 'js' },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  legalComments: 'none',
  logLevel: 'error',
})
const hostJs = bundle.outputFiles[0].text

const hostHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0f14; color: #dbe4ef; font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  header { display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid #243040; background:#121821; position:sticky; top:0; z-index:2; }
  header b { font-size:12px; }
  button { padding:4px 8px; border:1px solid #314153; border-radius:6px; background:#1b2430; color:#dbe4ef; cursor:pointer; }
  #status { margin-left:auto; color:#7f8fa3; font-size:11px; }
  main { display:flex; justify-content:center; padding:12px; }
  iframe { width:430px; height:calc(100vh - 64px); border:1px solid #243040; border-radius:12px; background:#fff; }
</style></head>
<body>
  <header><b>MCP Apps host · zcode-context</b><button id="theme">Toggle theme</button><button id="locale">Toggle locale</button><span id="status">connecting…</span></header>
  <main><iframe id="panel" allow="clipboard-write"></iframe></main>
  <script type="module" src="/host.js"></script>
</body></html>`

async function callTool(name, args) {
  switch (name) {
    case 'get_context_snapshot': return service.snapshot(sessionId, args)
    case 'get_context_history': return service.history(sessionId, args)
    case 'get_context_step': return service.step(sessionId, args.step, args)
    case 'get_context_group': return service.group(sessionId, args.step, args.cat, args)
    case 'get_context_dna': return service.dna(sessionId, args.step, args)
    case 'get_context_element': return service.element(sessionId, args.step, args.key, args)
    case 'get_context_event': return service.eventDetail(sessionId, args.eventId, args)
    case 'get_context_fleet': return service.fleet(sessionId, args)
    case 'get_context_fleet_member': return service.fleetMember(sessionId, args.targetId, args)
    case 'get_context_insights': return service.insights(args)
    case 'get_context_preferences': return service.preferencesGet()
    case 'set_context_preferences': return service.preferencesSet(args.patch)
    case 'get_context_report': return service.report(sessionId)
    default: throw Object.assign(new Error('Unknown tool: ' + name), { code: 'unknown_tool' })
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/tool') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      try {
        const result = await callTool(body.name, body.arguments ?? {})
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ structuredContent: result }))
      } catch (error) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { code: error?.code ?? 'read_failed', message: error?.message ?? 'Read failed.' } }))
      }
      return
    }
    if (req.url === '/host.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
      res.end(hostJs)
      return
    }
    if (req.url === '/panel') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(panelHtml)
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(hostHtml)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain' })
    res.end(String(error?.stack ?? error))
  }
})
const port = Number(getArg('--port') || 4190)
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`
  console.log('mcp-apps test host ' + sessionId)
  console.log(url)
  if (args.includes('--open')) {
    const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    spawn(command, [url], { detached: true, stdio: 'ignore' }).unref()
  }
})
function shutdown() {
  server.close()
  service.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
