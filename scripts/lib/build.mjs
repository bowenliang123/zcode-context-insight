import { build } from 'esbuild'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export async function buildAll({ quiet = false } = {}) {
  const dist = join(ROOT, 'dist')
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  const logLevel = quiet ? 'silent' : 'info'

  await build({
    entryPoints: [join(ROOT, 'src/server.mjs')],
    outfile: join(dist, 'server.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: false,
    legalComments: 'none',
    logLevel,
  })
  await build({
    entryPoints: [join(ROOT, 'src/worker.mjs')],
    outfile: join(dist, 'worker.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: false,
    legalComments: 'none',
    logLevel,
  })
  const bundle = await build({
    entryPoints: [join(ROOT, 'ui/app.mjs')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'chrome120',
    write: false,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    logLevel,
  })
  const app = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
  const css = await readFile(join(ROOT, 'ui/styles.css'), 'utf8')
  const template = await readFile(join(ROOT, 'ui/index.html'), 'utf8')
  const html = template
    .replace('/*__STYLE__*/', () => css.replace(/<\/style/gi, '<\\/style'))
    .replace('/*__APP__*/', () => app)
  await writeFile(join(dist, 'context.html'), html, 'utf8')

  const manifest = JSON.parse(await readFile(join(ROOT, '.zcode-plugin/plugin.json'), 'utf8'))
  await writeFile(
    join(dist, 'build.json'),
    JSON.stringify({ name: manifest.name, version: manifest.version, builtAt: new Date().toISOString() }, null, 2),
  )
  if (!quiet) console.log(`built ${manifest.name}@${manifest.version}: dist/server.mjs, dist/worker.mjs, dist/context.html`)
  return manifest
}

/** Copy the freshly built runtime into the dev plugin's installed cache, when present. */
export async function syncInstalled() {
  const configured = process.env.ZCODE_STORAGE_DIR?.trim()
  const storage = configured || join(homedir(), '.zcode')
  const cliRoot = basename(storage) === 'cli' ? storage : join(storage, 'cli')
  const installed = join(cliRoot, 'plugins', 'installed_plugins.json')
  if (!existsSync(installed)) return null
  let parsed
  try {
    parsed = JSON.parse(await readFile(installed, 'utf8'))
  } catch {
    return null
  }
  const entry = parsed?.plugins?.find(
    (plugin) => plugin.name === 'zcode-context' && plugin.marketplace === 'dev-zcode-context',
  )
  if (!entry?.installPath || !existsSync(entry.installPath)) return null
  const target = join(entry.installPath, 'dist')
  await mkdir(target, { recursive: true })
  for (const file of ['server.mjs', 'worker.mjs', 'context.html', 'build.json']) {
    await cp(join(ROOT, 'dist', file), join(target, file))
  }
  return entry.installPath
}
