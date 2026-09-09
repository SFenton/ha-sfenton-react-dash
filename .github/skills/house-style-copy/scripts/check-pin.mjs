import { resolve } from 'node:path'
import {
  validateBoundTriggerReceipt,
  liveVsQualifiedCorpusStatus,
  loadQualifiedCorpus,
  parseCliArgs,
  readJson,
  skillRoot,
} from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
const routing = await readJson(resolve(skillRoot, 'evals/runtime-routing.json'))
const candidates = await readJson(resolve(skillRoot, 'evals/candidates.json'))
const historicalPin = await readJson(resolve(skillRoot, 'evals/model-pin.json'))
const latest = await readJson(resolve(skillRoot, 'evals/latest-results.json'))
const errors = []
const warnings = []
let qualifiedSnapshot = null

try {
  qualifiedSnapshot = await loadQualifiedCorpus()
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error))
}

let selected = routing.default
let route = 'default'
if (args['trigger-receipt']) {
  route = 'conditional-adjudicator'
  selected = routing.conditionalAdjudicator
  const receipt = await readJson(resolve(String(args['trigger-receipt'])))
  if (!args['pipeline-state'] ||
    !/^[a-f0-9]{64}$/.test(String(args['request-hash'] ?? ''))) {
    errors.push('Copy adjudication trigger receipt is invalid.')
  } else {
    try {
      const policy = await readJson(resolve(
        skillRoot,
        '../../agent-opportunities.json',
      ))
      const registry = await readJson(resolve(
        skillRoot,
        '../../agent-tools.json',
      ))
      validateBoundTriggerReceipt(
        receipt,
        await readJson(resolve(String(args['pipeline-state']))),
        {
          project: 'ha-react',
          opportunityId: 'ux',
          triggerIds: selected.triggerIds,
          policy,
          registry,
          requestHash: String(args['request-hash']),
        },
      )
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (
    historicalPin.status !== 'validated'
    || historicalPin.candidateId !== selected.candidateId
    || latest.winner !== selected.candidateId
  ) {
    errors.push('Historical max adjudicator evidence is unavailable.')
  }
} else {
  if (
    routing.version !== 1
    || routing.status !== 'provisional'
    || selected.qualificationClaim !== false
    || selected.evidenceStatus !== 'measured-finalist-provisional'
    || !latest.finalists.some((entry) =>
      entry.candidateId === selected.candidateId
      && entry.public?.hardFailureCount === 0
      && entry.holdout?.hardFailureCount === 0)
  ) {
    errors.push('Provisional default route is not bound to measured finalist evidence.')
  }
  warnings.push('The default house-style-copy profile is provisional; no new qualification is claimed.')
}

const candidate = candidates.candidates.find((entry) =>
  entry.id === selected?.candidateId)
if (!candidate) errors.push('Routed candidate does not exist.')
if (
  candidate
  && (candidate.model !== selected.model
    || candidate.effort !== selected.effort
    || candidate.context !== selected.context)
) {
  errors.push('Routed candidate profile is inconsistent.')
}

const activeEffort = args.effort === 'none' ? null : args.effort
if (
  args.model !== selected.model
  || activeEffort !== selected.effort
  || args.context !== selected.context
) {
  errors.push('Active model, effort, or context does not match the selected route.')
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
  route,
  profile: errors.length ? null : {
    candidateId: selected.candidateId,
    context: selected.context,
    effort: selected.effort,
    model: selected.model,
    qualificationClaim: selected.qualificationClaim,
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
