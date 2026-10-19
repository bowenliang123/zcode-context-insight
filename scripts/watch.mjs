/**
 * Rebuild the panel on source changes and mirror the fresh runtime into the installed dev plugin.
 * UI-only changes: close and reopen the Context panel (the MCP resource is re-read on open).
 * Server/worker changes: restart ZCode, because the running MCP process keeps the old module graph.
 */
import { watch } from 'node:fs'
import { join } from 'node:path'
import { buildAll, ROOT, syncInstalled } from './lib/build.mjs'

let timer = null
let building = false
let queued = false

async function rebuild(reason) {
  if (building) {
    queued = true
    return
  }
  building = true
  const started = Date.now()
  try {
    await buildAll({ quiet: true })
    const installed = await syncInstalled()
    console.log(
      `rebuilt in ${Date.now() - started}ms (${reason})` +
        (installed ? ' · synced ' + installed : ' · no dev install; cache sync skipped'),
    )
  } catch (error) {
    console.error('build failed:', error)
  } finally {
    building = false
    if (queued) {
      queued = false
      void rebuild('queued change')
    }
  }
}

function schedule(reason) {
  clearTimeout(timer)
  timer = setTimeout(() => void rebuild(reason), 180)
}

await buildAll()
const installed = await syncInstalled()
console.log(
  'watching src/ and ui/' +
    (installed ? ' · synced ' + installed : ' · no dev-zcode-context-insight install; cache sync skipped'),
)
for (const directory of ['src', 'ui']) {
  const watcher = watch(join(ROOT, directory), { recursive: true }, (_event, filename) => {
    if (!filename || /(?:~|\.swp|\.tmp)$/.test(filename)) return
    schedule(directory + '/' + filename)
  })
  watcher.on('error', (error) => console.error(`watch ${directory} failed:`, error))
}
