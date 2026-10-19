/**
 * Smoke-test the data plane against the local ZCode store without starting MCP.
 * Usage: node scripts/smoke.mjs [sessionId]
 */
import { DatabaseSync } from 'node:sqlite'
import { resolvePaths } from '../src/data/paths.mjs'
import { createService } from '../src/service.mjs'

const paths = resolvePaths()
const db = new DatabaseSync(paths.dbPath, { readOnly: true })
const requested = process.argv[2]
const session =
  (requested ? db.prepare('SELECT id, title FROM session WHERE id = ?').get(requested) : null) ??
  db.prepare('SELECT id, title FROM session ORDER BY time_updated DESC LIMIT 1').get()
db.close()
if (!session) {
  console.error('No local sessions found.')
  process.exit(1)
}
console.log('session', session.id, session.title?.slice(0, 80))
const service = createService(paths)
const started = Date.now()
const snapshot = await service.snapshot(session.id, { locale: 'zh-CN' })
console.log('snapshot', JSON.stringify({
  bytes: Buffer.byteLength(JSON.stringify(snapshot)),
  steps: snapshot.stats.steps,
  turns: snapshot.stats.turns,
  current: snapshot.current && {
    step: snapshot.current.step,
    prompt: snapshot.current.prompt,
    parts: snapshot.current.parts,
    pct: snapshot.current.pct,
    window: snapshot.current.window,
  },
  events: snapshot.events.length,
  files: snapshot.files.entries.length,
  coverage: snapshot.coverage,
}, null, 2))
const latestStep = snapshot.current?.step ?? snapshot.stats.steps
if (latestStep) {
  const detail = await service.step(session.id, latestStep, { locale: 'zh-CN' })
  console.log('step', latestStep, JSON.stringify({
    bytes: Buffer.byteLength(JSON.stringify(detail)),
    groups: detail.groups.map((group) => [group.cat, group.count, group.tokens]),
    dna: detail.dna.length,
    diff: { added: detail.diff.addedCount, removed: detail.diff.removedCount, available: detail.diff.available },
  }, null, 2))
  const first = detail.dna.find((item) => !item.header) ?? detail.dna[0]
  if (first) {
    const element = await service.element(session.id, latestStep, first.key, { limit: 500, locale: 'zh-CN' })
    console.log('element', first.key, element.title, element.totalChars, 'chars')
  }
}
const fleet = await service.fleet(session.id, { locale: 'zh-CN' })
console.log('fleet', fleet.nodes.length, 'nodes', fleet.edges.length, 'edges')
const insights = await service.insights({ range: '30d', includeComposition: false, locale: 'zh-CN' })
console.log('insights', insights.sessionCards.length, 'sessions, kpi', insights.kpi)
const report = await service.report(session.id)
console.log('report\n' + report.text)
console.log('elapsed', Date.now() - started, 'ms')
service.close()
