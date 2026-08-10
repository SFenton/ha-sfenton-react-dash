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
if (!args.run) throw new Error('Usage: build-blind-persona.mjs --run <artifact-dir>')

const runDir = resolve(process.cwd(), String(args.run))
const summary = JSON.parse(await readFile(resolve(runDir, 'qualitative-summary.json'), 'utf8'))
const canonical = summary.records
  .filter((record) => record.caseId === 'settings-next-tap' && record.variant === 'canonical' && !record.parseError)
  .sort((left, right) => left.personaId.localeCompare(right.personaId))

const rotated = canonical.map((_, index) => canonical[(index * 4 + 3) % canonical.length])
const identityPattern = /\b(?:young[- ]novice|tech[- ]teen|ha[- ]engineer|home assistant engineer|cautious[- ]elder|older novice|visual[- ]texter|artist who mostly uses messaging apps|ux[- ]designer|ux specialist|occasional[- ]partner|household partner|power[- ]user|frequent dashboard user|accessibility[- ]auditor|accessibility auditor|claude-[a-z0-9.-]+|gpt-[a-z0-9.-]+|gemini-[a-z0-9.-]+|grok-[a-z0-9.-]+)\b/gi
const selfReferencePattern = /\b(?:as|for)\s+(?:a|an|the)?\s*(?:young child|child|teen|older user|older novice|artist|designer|engineer|partner|power user|accessibility auditor)\b[:,]?\s*/gi
const scrub = (value) => {
  if (typeof value === 'string') {
    return value
      .replace(identityPattern, '[persona]')
      .replace(selfReferencePattern, '')
  }
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, scrub(entry)]))
  }
  return value
}
const blindRecords = rotated.map((record, index) => ({
  actions: record.actions,
  findings: record.findings,
  id: `R${String(index + 1).padStart(2, '0')}`,
  limitations: record.limitations,
  strengths: record.strengths,
}))
const scrubbedRecords = blindRecords.map(scrub)
const key = Object.fromEntries(rotated.map((record, index) => [
  `R${String(index + 1).padStart(2, '0')}`,
  record.personaId,
]))

await writeFile(resolve(runDir, 'persona-blind-settings.json'), `${JSON.stringify({ records: blindRecords }, null, 2)}\n`)
await writeFile(resolve(runDir, 'persona-blind-settings-scrubbed.json'), `${JSON.stringify({ records: scrubbedRecords }, null, 2)}\n`)
await writeFile(resolve(runDir, 'persona-blind-key.json'), `${JSON.stringify(key, null, 2)}\n`)
console.log(JSON.stringify({ records: blindRecords.length }, null, 2))
