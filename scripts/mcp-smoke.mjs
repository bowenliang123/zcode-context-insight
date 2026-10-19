/**
 * End-to-end stdio MCP smoke test against the built server bundle.
 * Verifies initialize, tool discovery, session-bound calls, the model report and the HTML resource.
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePaths } from '../src/data/paths.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const paths = resolvePaths()
const db = new DatabaseSync(paths.dbPath, { readOnly: true })
const sessionId = process.argv[2] ?? db.prepare('SELECT id FROM session ORDER BY time_updated DESC LIMIT 1').get()?.id
db.close()
if (!sessionId) {
  console.error('No local sessions found.')
  process.exit(1)
}

const child = spawn(process.execPath, [join(root, 'dist/server.mjs')], {
  cwd: root,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, ZCODE_CONTEXT_DATA_ROOT: paths.dataRoot },
})
child.stderr.on('data', (chunk) => process.stderr.write('[server] ' + chunk))
const lines = createInterface({ input: child.stdout })
const pending = new Map()
let sequence = 0
lines.on('line', (line) => {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  if (message.id == null) return
  const job = pending.get(message.id)
  if (!job) return
  pending.delete(message.id)
  message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result)
})

function request(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      reject(new Error('timeout: ' + method))
    }, 30_000).unref()
  })
}
function notify(method, params = {}) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
}

const current = await request('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'zcode-context-insight-smoke', version: '0' },
})
console.log('initialize', current.protocolVersion, current.serverInfo?.name, current.serverInfo?.version)
notify('notifications/initialized')

const tools = await request('tools/list')
console.log(
  'tools',
  tools.tools.map((tool) => tool.name).join(', '),
)
const snapshot = await request('tools/call', {
  name: 'get_context_snapshot',
  arguments: { locale: 'zh-CN' },
  _meta: { 'com.zcode/request-context': { session_id: sessionId } },
})
if (snapshot.isError) throw new Error('snapshot failed: ' + JSON.stringify(snapshot.structuredContent))
console.log(
  'snapshot',
  snapshot.structuredContent.session.id,
  'steps',
  snapshot.structuredContent.stats.steps,
  'bytes',
  Buffer.byteLength(JSON.stringify(snapshot.structuredContent)),
)
const insights = await request('tools/call', {
  name: 'get_context_insights',
  arguments: { range: '7d', includeComposition: false, locale: 'zh-CN' },
  _meta: { 'com.zcode/request-context': { session_id: sessionId } },
})
if (insights.isError) throw new Error('insights failed: ' + JSON.stringify(insights.structuredContent))
console.log(
  'insights',
  insights.structuredContent.sessionCards.length,
  'cards,',
  insights.structuredContent.sessionsTotal,
  'total,',
  Buffer.byteLength(JSON.stringify(insights.structuredContent)),
  'bytes',
)

const report = await request('tools/call', {
  name: 'get_context_report',
  arguments: {},
  _meta: { 'com.zcode/request-context': { session_id: sessionId } },
})
console.log('report', report.content?.[0]?.text?.split('\n').slice(0, 2).join(' | '))

const missing = await request('tools/call', {
  name: 'get_context_snapshot',
  arguments: {},
  _meta: {},
})
console.log('missing metadata ->', missing.isError, missing.structuredContent?.error?.code)

const resource = await request('resources/read', { uri: 'ui://zcode-context-insight/context.html' })
const html = resource.contents?.[0]?.text ?? ''
console.log('resource', resource.contents?.[0]?.mimeType, Buffer.byteLength(html), 'bytes', html.includes('window.__ZCODE_CONTEXT_PREVIEW__={') ? 'preview!' : 'ok')

child.stdin.end()
child.kill('SIGTERM')
await new Promise((resolve) => child.once('exit', resolve))
