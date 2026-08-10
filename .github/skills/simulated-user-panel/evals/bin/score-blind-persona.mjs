import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) continue
    const key = value.slice(2)
    const next = argv[index + 1]
    result[key] = next && !next.startsWith('--') ? argv[++index] : true
  }
  return result
}

const args = parseArgs(process.argv.slice(2))
if (!args.run) throw new Error('Usage: score-blind-persona.mjs --run <artifact-dir> [--judge file]')

const runDir = resolve(process.cwd(), String(args.run))
const judgeFile = String(args.judge ?? 'persona-blind-judge-scrubbed.json')
const key = JSON.parse(await readFile(resolve(runDir, 'persona-blind-key.json'), 'utf8'))
const rawJudge = await readFile(resolve(runDir, judgeFile), 'utf8')
const parsedJudge = JSON.parse(rawJudge.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
const assignments = parsedJudge.assignments ?? []
const results = assignments.map((assignment) => ({
  actual: assignment.persona_id,
  expected: key[assignment.id] ?? null,
  id: assignment.id,
  pass: assignment.persona_id === key[assignment.id],
}))
const correct = results.filter((result) => result.pass).length
const summary = {
  accuracy: results.length === 0 ? 0 : correct / results.length,
  correct,
  reportedIdentifiability: parsedJudge.overall_identifiability,
  results,
  total: results.length,
}
await writeFile(resolve(runDir, 'persona-blind-score.json'), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
