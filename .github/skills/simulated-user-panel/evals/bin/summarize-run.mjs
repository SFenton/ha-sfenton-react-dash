import { readFile, readdir, writeFile } from 'node:fs/promises'
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

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

const args = parseArgs(process.argv.slice(2))
if (!args.run) throw new Error('Usage: summarize-run.mjs --run <artifact-dir>')

const runDir = resolve(process.cwd(), String(args.run))
const participantsRoot = resolve(runDir, 'participants')
const records = []

for (const caseEntry of await readdir(participantsRoot, { withFileTypes: true })) {
  if (!caseEntry.isDirectory()) continue
  const caseDir = resolve(participantsRoot, caseEntry.name)
  for (const participantEntry of await readdir(caseDir, { withFileTypes: true })) {
    if (!participantEntry.isDirectory()) continue
    const result = await readJson(resolve(caseDir, participantEntry.name, 'result.json'))
    const output = result.parsedOutput
    records.push({
      actions: (output?.task_result?.steps ?? []).map((step) => step.action),
      caseId: result.caseId,
      findings: (output?.findings ?? []).map((finding) => ({
        affected_surface: finding.affected_surface,
        claim: finding.claim,
        classification: finding.classification,
        confidence: finding.confidence,
        evidence: finding.evidence,
        severity: finding.severity,
        suggested_direction: finding.suggested_direction,
      })),
      limitations: output?.limitations ?? [],
      model: result.finalMessage?.model,
      parseError: result.parseError,
      personaId: result.entry.personaId,
      status: output?.task_result?.status,
      strengths: (output?.strengths ?? []).map((strength) => strength.claim),
      tier: result.entry.tier,
      toolEvents: result.toolEvents?.length ?? 0,
      variant: result.entry.variant,
    })
  }
}

records.sort((left, right) => `${left.caseId}/${left.personaId}/${left.variant}`.localeCompare(`${right.caseId}/${right.personaId}/${right.variant}`))
const summary = {
  records,
  totals: {
    findings: records.reduce((sum, record) => sum + record.findings.length, 0),
    parseErrors: records.filter((record) => record.parseError).length,
    participants: records.length,
    toolEvents: records.reduce((sum, record) => sum + record.toolEvents, 0),
  },
}

const outputPath = resolve(runDir, 'qualitative-summary.json')
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, totals: summary.totals }, null, 2))
