import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

await build({
  entryPoints: [join(root, 'src/server.mjs')],
  outfile: join(dist, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
})

await build({
  entryPoints: [join(root, 'src/worker.mjs')],
  outfile: join(dist, 'worker.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
})

const bundle = await build({
  entryPoints: [join(root, 'ui/app.mjs')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'chrome120',
  write: false,
  minify: true,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
})
const app = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const css = await readFile(join(root, 'ui/styles.css'), 'utf8')
const template = await readFile(join(root, 'ui/index.html'), 'utf8')
const html = template
  .replace('/*__STYLE__*/', () => css.replace(/<\/style/gi, '<\\/style'))
  .replace('/*__APP__*/', () => app)
await writeFile(join(dist, 'context.html'), html, 'utf8')

const manifest = JSON.parse(await readFile(join(root, '.zcode-plugin/plugin.json'), 'utf8'))
await writeFile(
  join(dist, 'build.json'),
  JSON.stringify({ name: manifest.name, version: manifest.version, builtAt: new Date().toISOString() }, null, 2),
)
console.log(`built ${manifest.name}@${manifest.version}: dist/server.mjs, dist/worker.mjs, dist/context.html`)
