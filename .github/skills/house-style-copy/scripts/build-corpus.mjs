import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildCorpus, parseCliArgs, repositoryRoot } from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
const root = args.root ? resolve(String(args.root)) : repositoryRoot
const corpus = await buildCorpus(root)
const content = `${corpus.map((record) => JSON.stringify(record)).join('\n')}\n`

if (args.out) {
  const output = resolve(String(args.out))
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, content)
  console.log(JSON.stringify({ output, records: corpus.length }, null, 2))
} else {
  process.stdout.write(content)
}
