/**
 * Local visual harness: serve the built panel with a preview transport that talks to the same
 * read-only service. This is not part of the installed plugin; it lets the panel be opened in a
 * browser with real local data before the MCP host trial.
 *
 * Usage: node scripts/preview.mjs [--session <id>] [--port 4180] [--open]
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePaths } from '../src/data/paths.mjs'
import { createService } from '../src/service.mjs'

const args = process.argv.slice(2)
const getArg = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : null
}
const paths = resolvePaths()
const db = new DatabaseSync(paths.dbPath, { readOnly: true })
const sessionId =
  getArg('--session') ??
  db.prepare('SELECT id FROM session ORDER BY time_updated DESC LIMIT 1').get()?.id
db.close()
if (!sessionId) {
  console.error('No sessions in the local store.')
  process.exit(1)
}
const service = createService(paths)
const port = Number(getArg('--port') || 0)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = await readFile(join(root, 'dist/context.html'), 'utf8')

async function callTool(name, args) {
  switch (name) {
    case 'get_context_snapshot':
      return service.snapshot(sessionId, args)
    case 'get_context_history':
      return service.history(sessionId, args)
    case 'get_context_step':
      return service.step(sessionId, args.step, args)
    case 'get_context_group':
      return service.group(sessionId, args.step, args.cat, args)
    case 'get_context_dna':
      return service.dna(sessionId, args.step, args)
    case 'get_context_dna_series':
      return service.dnaSeries(sessionId, args)
    case 'get_context_element':
      return service.element(sessionId, args.step, args.key, args)
    case 'get_context_event':
      return service.eventDetail(sessionId, args.eventId, args)
    case 'get_context_fleet':
      return service.fleet(sessionId, args)
    case 'get_context_fleet_member':
      return service.fleetMember(sessionId, args.targetId, args)
    case 'get_context_insights':
      return service.insights(args)
    case 'get_context_preferences':
      return service.preferencesGet()
    case 'set_context_preferences':
      return service.preferencesSet(args.patch)
    case 'get_context_report':
      return service.report(sessionId)
    default:
      throw Object.assign(new Error('Unknown tool'), { code: 'unknown_tool' })
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url?.startsWith('/api/tool')) {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      try {
        const result = await callTool(body.name, body.arguments ?? {})
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ structuredContent: result }))
      } catch (error) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            error: { code: error?.code ?? 'read_failed', message: error?.message ?? 'Read failed.' },
          }),
        )
      }
      return
    }
    if (req.url === '/favicon.ico') {
      res.writeHead(204)
      res.end()
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const locale = url.searchParams.get('lang') === 'en' ? 'en-US' : 'zh-CN'
    const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'
    const config = JSON.stringify({ url: '/api/tool', locale, theme }).replace(/</g, '\\u003c')
    const early = `<script>window.__zcErrors=[];window.addEventListener('error',function(e){window.__zcErrors.push(String(e.error&&e.error.stack||e.message))});window.addEventListener('unhandledrejection',function(e){window.__zcErrors.push(String(e.reason&&e.reason.stack||e.reason))});</script>`
    const injected = early + `<script>window.__ZCODE_CONTEXT_PREVIEW__=${config}</script>`
    const page = html.replace('</head>', () => injected + '</head>')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    res.end(page)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(String(error?.stack ?? error))
  }
})

server.listen(port, '127.0.0.1', () => {
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}/`
  console.log(`preview ${sessionId}`)
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
