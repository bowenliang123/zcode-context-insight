import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'plugins', 'zcode-context-insight')
const marketRoot = join(root, 'plugins')
const manifest = JSON.parse(await readFile(join(root, '.zcode-plugin/plugin.json'), 'utf8'))

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
for (const entry of ['dist', '.zcode-plugin', 'commands', 'skills', 'docs']) {
  await cp(join(root, entry), join(target, entry), { recursive: true })
}
for (const file of ['README.md', 'README_zh.md', 'LICENSE', 'NOTICE']) {
  await cp(join(root, file), join(target, file))
}
try {
  await cp(join(root, 'icon.svg'), join(target, 'icon.svg'))
} catch {}

const catalog = {
  name: 'dev-zcode-context-insight',
  plugins: [
    {
      name: manifest.name,
      source: './zcode-context-insight',
      version: manifest.version,
      icon: 'https://raw.githubusercontent.com/bowenliang123/dsh-context/main/icon.svg',
      description: manifest.description,
      displayName: 'ZCode Context',
      displayName_i18n: { 'zh-CN': 'ZCode 上下文洞察' },
      description_i18n: manifest.description_i18n,
      category: 'developer-tools',
    },
  ],
}
await mkdir(marketRoot, { recursive: true })
await writeFile(join(marketRoot, 'marketplace.json'), JSON.stringify(catalog, null, 2) + '\n')
console.log('packaged plugin at ' + target)
console.log('local marketplace at ' + join(marketRoot, 'marketplace.json'))
