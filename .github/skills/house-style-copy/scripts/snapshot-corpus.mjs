import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildCorpus,
  collectCorpusInputProvenance,
  createQualifiedCorpusManifest,
  loadQualifiedCorpus,
  loadQualifiedCorpusBundle,
  parseCliArgs,
  qualifiedCorpusBundlePaths,
  qualifiedCorpusDirectory,
  qualifiedCorpusPointerPath,
  QUALIFIED_CORPUS_POINTER_VERSION,
  readJsonLines,
  repositoryRoot,
  serializeCorpus,
  skillRoot,
  validateQualifiedCorpusInventory,
  valueHash,
} from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
if (args.help) {
  console.log('Usage: snapshot-corpus.mjs [--allow-dirty]\nPublishes a validated hash-versioned corpus bundle, then atomically swaps current.json. Dirty corpus inputs are rejected unless --allow-dirty is supplied for maintenance-only evidence.')
  process.exit()
}

async function atomicWrite(path, content) {
  const stagedPath = `${path}.next-${process.pid}`
  await unlink(stagedPath).catch(() => {})
  await writeFile(stagedPath, content, { flag: 'wx' })
  try {
    await rename(stagedPath, path)
  } catch (error) {
    await unlink(stagedPath).catch(() => {})
    throw error
  }
}

async function cleanupBundles(snapshotId) {
  const keep = new Set([
    'current.json',
    `${snapshotId}.jsonl`,
    `${snapshotId}.manifest.json`,
  ])
  for (const entry of await readdir(qualifiedCorpusDirectory, { withFileTypes: true })) {
    if (keep.has(entry.name)) continue
    await rm(resolve(qualifiedCorpusDirectory, entry.name), { force: true, recursive: true })
  }
}

const source = await collectCorpusInputProvenance(repositoryRoot)
if (source.sourceInputsDirty && !args['allow-dirty']) {
  throw new Error('Corpus input paths are dirty. Restore or commit those inputs before release refresh, or use --allow-dirty for maintenance-only non-release evidence.')
}

const liveCorpus = await buildCorpus(repositoryRoot)
const serializedCorpus = serializeCorpus(liveCorpus)
const manifest = createQualifiedCorpusManifest(liveCorpus, source)
const newHash = manifest.corpusHash
const newSnapshotId = manifest.snapshotId
const bundlePaths = qualifiedCorpusBundlePaths(newSnapshotId)
const legacyCorpusPath = resolve(skillRoot, 'assets/corpus/qualified.jsonl')
const legacyManifestPath = resolve(skillRoot, 'assets/corpus/qualified-manifest.json')

let oldHash = null
let oldSnapshotId = null
try {
  const existing = await loadQualifiedCorpus()
  oldHash = existing.corpusHash
  oldSnapshotId = existing.snapshotId
} catch {
  const legacyRecords = await readJsonLines(legacyCorpusPath).catch(() => null)
  if (legacyRecords) oldHash = valueHash(legacyRecords)
}

await mkdir(qualifiedCorpusDirectory, { recursive: true })
let bundleRepaired = false
try {
  await loadQualifiedCorpusBundle(newSnapshotId)
} catch {
  bundleRepaired = true
  await atomicWrite(bundlePaths.corpusPath, serializedCorpus)
  await atomicWrite(bundlePaths.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await loadQualifiedCorpusBundle(newSnapshotId)
}

const pointerChanged = oldSnapshotId !== newSnapshotId
if (pointerChanged) {
  const pointer = {
    version: QUALIFIED_CORPUS_POINTER_VERSION,
    snapshotId: newSnapshotId,
  }
  await atomicWrite(qualifiedCorpusPointerPath, `${JSON.stringify(pointer, null, 2)}\n`)
}

const published = await loadQualifiedCorpus()
if (published.snapshotId !== newSnapshotId) {
  throw new Error('Qualified corpus pointer did not publish the validated target bundle.')
}

await cleanupBundles(newSnapshotId)
await Promise.all([
  rm(legacyCorpusPath, { force: true }),
  rm(legacyManifestPath, { force: true }),
])
const inventory = await validateQualifiedCorpusInventory()
if (inventory.errors.length) {
  throw new Error(`Qualified corpus bundle inventory is invalid: ${inventory.errors.join(' ')}`)
}

console.log(JSON.stringify({
  allowDirty: Boolean(args['allow-dirty']),
  bundleRepaired,
  changed: pointerChanged || bundleRepaired,
  contentChanged: oldHash !== newHash,
  inputPathsDirty: source.sourceInputsDirty,
  newHash,
  newSnapshotId,
  oldHash,
  oldSnapshotId,
  qualifiedCorpusPointerPath,
  records: liveCorpus.length,
  sourceHead: source.sourceHead,
  sourceInputFileCount: source.sourceInputFileCount,
  sourceInputHash: source.sourceInputHash,
  sourceStatusHash: source.sourceStatusHash,
}, null, 2))
