/**
 * Build the distributable package and register/enable it in ZCode through the bundled CLI.
 * This is a developer convenience; the normal user flow is the Plugin Marketplace UI.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAll, ROOT, syncInstalled } from './lib/build.mjs'

const pluginId = 'zcode-context-insight@dev-zcode-context-insight'
const market = join(ROOT, 'plugins')

function cliPath() {
  const explicit = process.env.ZCODE_CLI
  if (explicit && existsSync(explicit)) return { command: process.execPath, prefix: [explicit] }
  const candidates = [
    '/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs',
    join(process.env.HOME ?? '', '.zcode', 'cli', 'zcode.cjs'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return { command: process.execPath, prefix: [candidate] }
  }
  return null
}

const cli = cliPath()
if (!cli) {
  console.error('ZCode CLI not found. Set ZCODE_CLI=/path/to/zcode.cjs, or install via Settings → Plugin Management.')
  process.exit(1)
}

function run(args) {
  console.log('$ zcode ' + args.join(' '))
  execFileSync(cli.command, [...cli.prefix, ...args], { stdio: 'inherit' })
}

await buildAll()
try {
  await import('./package.mjs')
} catch (error) {
  console.error('package step failed:', error)
  process.exit(1)
}

// Marketplace add is idempotent enough for dev: try update first, then add when it is not registered.
try {
  run(['plugins', 'marketplace', 'update', 'dev-zcode-context-insight'])
} catch {
  run(['plugins', 'marketplace', 'add', market, '--scope', 'user'])
}
run(['plugins', 'install', pluginId, '--scope', 'user'])
run(['plugins', 'enable', pluginId, '--scope', 'user'])
const installed = await syncInstalled()
if (!installed) {
  console.error('Installed dev plugin cache was not found in the ZCode plugin registry.')
  process.exit(1)
}
console.log('synced ' + installed)
console.log('\nregistered ' + pluginId + '. Restart ZCode if this is the first install; UI-only iterations can close/reopen the panel.')
