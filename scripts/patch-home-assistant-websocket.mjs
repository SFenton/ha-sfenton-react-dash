import { readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const BUGGY_READY_CLEANUP = 'conn.removeEventListener("ready", refresh);'
const FIXED_READY_CLEANUP = 'conn.removeEventListener("ready", refreshSwallow);'
const EMBEDDED_WINDOW_DECLARATION = 'const embeddedWindow = typeof window !== "undefined" && window.top !== window;'
const TARGET_FILES = [
  'node_modules/home-assistant-js-websocket/dist/collection.js',
  'node_modules/home-assistant-js-websocket/dist/haws.cjs',
  'node_modules/home-assistant-js-websocket/dist/haws.umd.js',
]

export function patchReadyListenerCleanup(source, fileName = 'source') {
  const buggyOccurrences = source.split(BUGGY_READY_CLEANUP).length - 1
  if (buggyOccurrences === 0) {
    if (source.includes(FIXED_READY_CLEANUP)) {
      return { changed: false, source }
    }
    throw new Error(`Unable to find the expected ready-listener cleanup in ${fileName}.`)
  }
  if (buggyOccurrences !== 1) {
    throw new Error(`Expected one buggy ready-listener cleanup in ${fileName}, found ${buggyOccurrences}.`)
  }

  return {
    changed: true,
    source: source.replace(BUGGY_READY_CLEANUP, FIXED_READY_CLEANUP),
  }
}

function replaceSingle(source, pattern, replacement, label, fileName) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matches = source.match(new RegExp(pattern.source, flags)) ?? []
  if (matches.length !== 1) {
    throw new Error(`Expected one ${label} in ${fileName}, found ${matches.length}.`)
  }
  return source.replace(pattern, replacement)
}

export function patchEmbeddedCollectionTeardown(source, fileName = 'source') {
  if (
    source.includes(EMBEDDED_WINDOW_DECLARATION)
    && source.includes('const collection = {')
    && source.includes('conn[key] = collection;')
  ) {
    return { changed: false, source }
  }

  // A child-created collection is cached on the parent connection, so final teardown must
  // also release that cache entry or the parent keeps the dead iframe realm reachable.
  let patched = replaceSingle(
    source,
    /^(\s*)let store = createStore\(\);$/m,
    `$&\n$1${EMBEDDED_WINDOW_DECLARATION}`,
    'collection store declaration',
    fileName,
  )
  patched = replaceSingle(
    patched,
    /^(\s*)conn\.removeEventListener\("disconnected", handleDisconnect\);$/m,
    `$&\n$1if (embeddedWindow && conn[key] === collection) {\n$1    delete conn[key];\n$1}`,
    'collection disconnect-listener cleanup',
    fileName,
  )
  patched = replaceSingle(
    patched,
    /^(\s*)unsubTimer = setTimeout\(teardownUpdateSubscription, UNSUB_GRACE_PERIOD\);$/m,
    // Timers owned by a removed iframe never fire, so embedded collections must release synchronously.
    `$1if (embeddedWindow) {\n$1    teardownUpdateSubscription();\n$1    return;\n$1}\n$&`,
    'collection teardown timer',
    fileName,
  )
  patched = replaceSingle(
    patched,
    /^(\s*)conn\[key\] = \{$/m,
    '$1const collection = {',
    'collection cache assignment',
    fileName,
  )
  patched = replaceSingle(
    patched,
    /^(\s*)return conn\[key\];\n(\s*)};\n(\s*)\/\/ Legacy name/m,
    '$1conn[key] = collection;\n$1return collection;\n$2};\n$3// Legacy name',
    'collection cache return',
    fileName,
  )

  return { changed: true, source: patched }
}

export async function patchHomeAssistantWebsocket(rootDirectory = process.cwd()) {
  const patchedFiles = []

  for (const relativePath of TARGET_FILES) {
    const filePath = resolve(rootDirectory, relativePath)
    const source = await readFile(filePath, 'utf8')
    const readyPatched = patchReadyListenerCleanup(source, relativePath)
    const embeddedPatched = patchEmbeddedCollectionTeardown(readyPatched.source, relativePath)
    if (!readyPatched.changed && !embeddedPatched.changed) continue
    await writeFile(filePath, embeddedPatched.source)
    patchedFiles.push(relativePath)
  }

  await rm(resolve(rootDirectory, 'node_modules/.vite'), {
    force: true,
    recursive: true,
  })
  return patchedFiles
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''

if (import.meta.url === invokedPath) {
  patchHomeAssistantWebsocket()
    .then((patchedFiles) => {
      if (patchedFiles.length > 0) {
        console.info(`Patched Home Assistant websocket cleanup in ${patchedFiles.length} files.`)
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
