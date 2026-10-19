import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const warnings = []

function check(condition, message) {
  if (!condition) errors.push(message)
}

const manifestPath = join(root, '.zcode-plugin/plugin.json')
check(existsSync(manifestPath), 'missing .zcode-plugin/plugin.json')
let manifest = {}
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    errors.push('plugin.json is not valid JSON: ' + error.message)
  }
}
check(manifest.name === 'zcode-context', 'manifest name must be zcode-context')
check(typeof manifest.version === 'string' && manifest.version.length > 0, 'manifest version is required')
check(Boolean(manifest.mcpServers?.context), 'manifest mcpServers.context is required')
check(Boolean(manifest.ui?.surfaces?.length), 'manifest ui.surfaces is required')
for (const surface of manifest.ui?.surfaces ?? []) {
  check(surface.availability === 'session', 'surface availability must be session')
  check(surface.server === 'context', 'surface server must be context')
  check(String(surface.resourceUri).startsWith('ui://zcode-context/'), 'surface resource URI must be ui://zcode-context/...')
}
check(existsSync(join(root, 'src/server.mjs')), 'missing src/server.mjs')
check(existsSync(join(root, 'src/worker.mjs')), 'missing src/worker.mjs')
check(existsSync(join(root, 'ui/app.mjs')), 'missing ui/app.mjs')
check(existsSync(join(root, 'ui/index.html')), 'missing ui/index.html')
check(existsSync(join(root, 'ui/styles.css')), 'missing ui/styles.css')

if (existsSync(join(root, 'dist/context.html'))) {
  const html = readFileSync(join(root, 'dist/context.html'), 'utf8')
  check(!html.includes('/*__APP__*/'), 'built HTML still contains the app placeholder')
  check(!html.includes('/*__STYLE__*/'), 'built HTML still contains the style placeholder')
  check(Buffer.byteLength(html) < 16 * 1024 * 1024, 'built HTML exceeds the 16 MiB host limit')
  if (Buffer.byteLength(html) > 8 * 1024 * 1024) warnings.push('built HTML is large: ' + statSync(join(root, 'dist/context.html')).size + ' bytes')
}
for (const file of ['dist/server.mjs', 'dist/worker.mjs']) {
  if (existsSync(join(root, file))) {
    try {
      execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'pipe' })
    } catch (error) {
      errors.push(file + ' failed node --check: ' + String(error.stderr ?? error.message).slice(0, 400))
    }
  }
}

const dataRoot = process.env.ZCODE_CONTEXT_DATA_ROOT || join(process.env.HOME, '.zcode', 'cli')
const dbPath = process.env.ZCODE_CONTEXT_DB_PATH || join(dataRoot, 'db', 'db.sqlite')
if (!existsSync(dbPath)) warnings.push('no local ZCode database at ' + dbPath + ' (runtime reads will report database_missing)')

if (errors.length) {
  console.error('checks failed:\n- ' + errors.join('\n- '))
  process.exit(1)
}
if (warnings.length) console.warn('warnings:\n- ' + warnings.join('\n- '))
console.log('checks passed for ' + manifest.name + '@' + manifest.version)
