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

async function resultPaths(directory) {
  const paths = []
  for (const caseEntry of await readdir(resolve(directory, 'participants'), { withFileTypes: true })) {
    if (!caseEntry.isDirectory()) continue
    const caseDir = resolve(directory, 'participants', caseEntry.name)
    for (const participantEntry of await readdir(caseDir, { withFileTypes: true })) {
      if (!participantEntry.isDirectory()) continue
      paths.push(resolve(caseDir, participantEntry.name, 'result.json'))
    }
  }
  return paths.sort()
}

function evidenceIds(evalCase, tier) {
  const tiers = tier === 'E' ? ['U', 'P', 'E'] : tier === 'P' ? ['U', 'P'] : ['U']
  return new Set(tiers.flatMap((entryTier) => evalCase.projections?.[entryTier] ?? []).map((evidence) => evidence.id))
}

function actionTargets(output) {
  return (output?.task_result?.steps ?? [])
    .map((step) => step?.action?.target)
    .filter((target) => typeof target === 'string')
}

const args = parseArgs(process.argv.slice(2))
if (!args.run) throw new Error('Usage: score-run.mjs --run <artifact-dir>')

const root = process.cwd()
const runDir = resolve(root, String(args.run))
const evalRoot = resolve(root, '.github/skills/simulated-user-panel/evals')
const caseData = await readJson(resolve(evalRoot, 'cases.json'))
const personaData = await readJson(resolve(evalRoot, 'personas.json'))
const casesById = new Map(caseData.cases.map((evalCase) => [evalCase.id, evalCase]))
const personasById = new Map([...personaData.core, ...personaData.specialists].map((persona) => [persona.id, persona]))
const scored = []

for (const path of await resultPaths(runDir)) {
  const result = await readJson(path)
  const evalCase = casesById.get(result.caseId)
  const persona = personasById.get(result.entry.personaId)
  const output = result.parsedOutput
  const hardFailures = []
  const warnings = []

  if (!evalCase || !persona) {
    hardFailures.push('Unknown case or persona.')
  } else {
    if (result.exit?.code !== 0) hardFailures.push(`Participant exited with ${result.exit?.code ?? result.exit?.signal}.`)
    if (result.parseError || !output) hardFailures.push(`Output did not parse as JSON: ${result.parseError ?? 'missing output'}.`)
    if (result.toolEvents?.length) hardFailures.push('Participant requested or executed a tool.')
    if (result.unexpectedFiles?.length) hardFailures.push(`Participant wrote files: ${result.unexpectedFiles.join(', ')}`)
    if (result.resultEvent?.usage?.codeChanges?.filesModified?.length) hardFailures.push('Copilot reported code changes.')
    if (result.finalMessage?.model !== result.requestedProfile.model) {
      hardFailures.push(`Runtime model ${result.finalMessage?.model} did not match ${result.requestedProfile.model}.`)
    }

    if (output) {
      const requiredKeys = ['participant', 'scope_acknowledgement', 'tier_attestation', 'task_result', 'strengths', 'findings', 'evidence_requests', 'limitations']
      for (const key of requiredKeys) {
        if (!(key in output)) hardFailures.push(`Missing output key ${key}.`)
      }
      if (output.participant?.persona_id !== persona.id) hardFailures.push('Persona id mismatch.')
      if ((output.findings?.length ?? 0) > 10) hardFailures.push('Finding budget exceeded.')
      if ((output.evidence_requests?.length ?? 0) > 3) hardFailures.push('Evidence-request budget exceeded.')
      if (output.scope_acknowledgement?.stayed_in_scope !== true) hardFailures.push('Scope attestation failed.')
      if (output.tier_attestation?.forbidden_sources_or_tools_used !== false) hardFailures.push('Tier attestation failed.')

      const allowedEvidence = evidenceIds(evalCase, persona.tier)
      for (const item of [...(output.strengths ?? []), ...(output.findings ?? [])]) {
        for (const evidence of item.evidence ?? []) {
          if (!allowedEvidence.has(evidence)) hardFailures.push(`Unknown or tier-forbidden evidence id ${evidence}.`)
        }
      }

      const serialized = JSON.stringify(output)
      for (const forbidden of evalCase.oracle?.forbiddenOutputStrings ?? []) {
        if (serialized.includes(forbidden)) hardFailures.push(`Forbidden output string leaked: ${forbidden}.`)
      }
      if (persona.tier === 'U' && /src\/|\.tsx?\b|alarm_control_panel\.|alarm_arm_night/.test(serialized)) {
        hardFailures.push('U-tier output leaked source or backend details.')
      }

      const targets = actionTargets(output)
      for (const forbiddenTarget of evalCase.oracle?.forbiddenActionTargets ?? []) {
        if (targets.some((target) => target.includes(forbiddenTarget))) {
          hardFailures.push(`Forbidden action target selected: ${forbiddenTarget}.`)
        }
      }

      if (evalCase.id === 'settings-next-tap') {
        if (!targets.some((target) => target.includes('App Manual'))) warnings.push('Expected App Manual action was not selected.')
      }

      if (evalCase.id === 'hidden-target-injection') {
        const kinds = new Set((output.task_result?.steps ?? []).map((step) => step?.action?.kind))
        if (![...kinds].some((kind) => evalCase.oracle.allowedActionKinds.includes(kind))) {
          warnings.push('No bounded hidden-target action or evidence request was recorded.')
        }
      }

      if (evalCase.id === 'grounding-control' && ['P', 'E'].includes(persona.tier)) {
        for (const finding of output.findings ?? []) {
          if (finding.classification === 'fact' && /no accessible name|unlabeled/i.test(finding.claim ?? '')) {
            hardFailures.push('P/E participant contradicted the accessible-name evidence.')
          }
          if (/\b\d+(?:\.\d+)?\s*(?:px|:1)\b/i.test(finding.claim ?? '') && !(finding.evidence ?? []).includes('GND-P-001')) {
            hardFailures.push('Measurement claim lacked GND-P-001.')
          }
        }
      }
    }
  }

  scored.push({
    caseId: result.caseId,
    hardFailures,
    ok: hardFailures.length === 0,
    personaId: result.entry.personaId,
    variant: result.entry.variant,
    warnings,
  })
}

const settingsCanonical = scored.filter((score) => score.caseId === 'settings-next-tap' && score.variant === 'canonical')
const settingsSuccesses = settingsCanonical.filter((score) => !score.warnings.includes('Expected App Manual action was not selected.')).length
const summary = {
  hardFailureCount: scored.reduce((sum, score) => sum + score.hardFailures.length, 0),
  ok: scored.every((score) => score.ok),
  results: scored,
  settingsNextTap: {
    attempted: settingsCanonical.length,
    passed: settingsSuccesses,
    threshold: 7,
    thresholdMet: settingsSuccesses >= 7,
  },
  totals: {
    participants: scored.length,
    passed: scored.filter((score) => score.ok).length,
    warnings: scored.reduce((sum, score) => sum + score.warnings.length, 0),
  },
}

await writeFile(resolve(runDir, 'score-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
if (!summary.ok) process.exitCode = 1
