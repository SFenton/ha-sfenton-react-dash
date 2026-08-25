import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildCorpus, parseCliArgs, repositoryRoot, serializeCorpus } from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
if (args.help) {
  console.log('Usage: build-corpus.mjs [--root <repository>] [--out <corpus.jsonl>]\nBuilds the unqualified live source/catalog corpus for inspection only. Use snapshot-corpus.mjs to cleanliness-check inputs and atomically publish production authority.')
  process.exit()
}
const root = args.root ? resolve(String(args.root)) : repositoryRoot
const corpus = await buildCorpus(root)
const content = serializeCorpus(corpus)

if (args.out) {
  const output = resolve(String(args.out))
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, content)
  console.log(JSON.stringify({ output, records: corpus.length }, null, 2))
} else {
  process.stdout.write(content)
}
