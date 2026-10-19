/**
 * Refresh the bundled models.dev snapshot used for list prices and context windows.
 * Run deliberately; the plugin never fetches this at runtime.
 */
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const response = await fetch('https://models.dev/api.json', { signal: AbortSignal.timeout(60_000) })
if (!response.ok) throw new Error('models.dev returned ' + response.status)
const api = await response.json()
const out = { generatedAt: new Date().toISOString(), source: 'https://models.dev/api.json', providers: {} }
let models = 0
for (const [pid, provider] of Object.entries(api)) {
  if (!provider || typeof provider !== 'object' || !provider.models || typeof provider.models !== 'object') continue
  const entries = {}
  for (const [mid, model] of Object.entries(provider.models)) {
    if (!model || typeof model !== 'object') continue
    const cost = model.cost && typeof model.cost === 'object'
      ? Object.fromEntries(['input', 'output', 'cache_read', 'cache_write', 'reasoning'].filter((key) => typeof model.cost[key] === 'number').map((key) => [key, model.cost[key]]))
      : null
    const limit = model.limit && typeof model.limit === 'object'
      ? Object.fromEntries(['context', 'output'].filter((key) => typeof model.limit[key] === 'number').map((key) => [key, model.limit[key]]))
      : null
    if (!cost && !limit) continue
    entries[mid] = {
      name: typeof model.name === 'string' ? model.name : mid,
      ...(limit ? { limit } : {}),
      ...(cost ? { cost } : {}),
      ...(typeof model.last_updated === 'string' ? { updated: model.last_updated } : {}),
    }
    models++
  }
  if (Object.keys(entries).length) {
    out.providers[pid] = {
      name: typeof provider.name === 'string' ? provider.name : pid,
      ...(typeof provider.npm === 'string' ? { npm: provider.npm } : {}),
      models: entries,
    }
  }
}
const file = join(root, 'src/shared/models.json')
await writeFile(file, JSON.stringify(out))
console.log('updated ' + file + ' with ' + models + ' models from ' + Object.keys(out.providers).length + ' providers')
