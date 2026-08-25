import { resolve } from 'node:path'
import {
  hashSkillFiles,
  liveVsQualifiedCorpusStatus,
  loadQualifiedCorpus,
  parseCliArgs,
  readJson,
  skillRoot,
  valueHash,
} from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
const pin = await readJson(resolve(skillRoot, 'evals/model-pin.json'))
const candidates = await readJson(resolve(skillRoot, 'evals/candidates.json'))
const candidate = candidates.candidates.find((entry) => entry.id === pin.candidateId)
const errors = []
const warnings = []
let qualifiedSnapshot = null

try {
  qualifiedSnapshot = await loadQualifiedCorpus()
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error))
}

if (pin.status !== 'validated') errors.push('No validated model profile is available.')
if (!candidate) errors.push('Pinned candidate does not exist.')
if (
  candidate
  && (candidate.model !== pin.model || candidate.effort !== pin.effort || candidate.context !== pin.context)
) {
  errors.push('Pinned candidate profile is inconsistent.')
}

if (pin.status === 'validated') {
  const selectedAt = Date.parse(pin.selectedAt)
  if (!Number.isFinite(selectedAt)) errors.push('Validated pin is missing selectedAt.')
  if (!Number.isInteger(pin.expiresAfterDays) || pin.expiresAfterDays <= 0) errors.push('Validated pin has an invalid expiry window.')
  if (
    Number.isFinite(selectedAt)
    && Number.isInteger(pin.expiresAfterDays)
    && Date.now() > selectedAt + pin.expiresAfterDays * 24 * 60 * 60 * 1000
  ) {
    errors.push('Validated pin has expired.')
  }

  if (qualifiedSnapshot) {
    const currentHashes = {
      candidates: valueHash(candidates),
      corpus: qualifiedSnapshot.corpusHash,
      skill: await hashSkillFiles(),
    }
    for (const [name, value] of Object.entries(currentHashes)) {
      if (pin.evidence?.qualificationHashes?.[name] !== value) errors.push(`Validated pin has a stale ${name} hash.`)
    }
  }

  const activeEffort = args.effort === 'none' ? null : args.effort
  if (args.model !== pin.model || activeEffort !== pin.effort || args.context !== pin.context) {
    errors.push('Active model, effort, or context does not match the validated pin.')
  }
}

const liveCorpus = qualifiedSnapshot
  ? await liveVsQualifiedCorpusStatus(undefined, qualifiedSnapshot.records)
  : {
      status: 'unavailable',
      drifted: null,
      warning: 'Live corpus status is unavailable because the qualified snapshot is invalid.',
    }
if (liveCorpus.warning) warnings.push(liveCorpus.warning)

console.log(JSON.stringify({
  ok: errors.length === 0,
  errors,
  warnings,
  profile: errors.length ? null : {
    candidateId: pin.candidateId,
    context: pin.context,
    effort: pin.effort,
    model: pin.model,
  },
  corpus: {
    qualified: qualifiedSnapshot
      ? {
          hash: qualifiedSnapshot.corpusHash,
          records: qualifiedSnapshot.records.length,
          snapshotId: qualifiedSnapshot.snapshotId,
          sourceHead: qualifiedSnapshot.manifest.sourceHead,
        }
      : null,
    live: liveCorpus,
  },
}, null, 2))
if (errors.length) process.exitCode = 1
