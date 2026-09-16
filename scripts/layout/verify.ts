import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONTEXTS, LEGACY_ENGINE_SKIPS, SCENARIO_IDS } from '../../e2e/layout/contracts'
import { layoutProfile } from '../../e2e/responsive-acceptance-data'
import type { Capabilities, CollectedTest, ExecutionLedger, LayoutPlan, ManualLedger, RunIdentity } from '../../e2e/layout/types'
import { artifactPath, assertOptions, fingerprintDirectory, hash, isEntry, option, readJson, snapshot, stableHash, writeJson } from './shared'
import { assertCurrentPlan } from './plan'

export function assertExactSelection(expected: readonly CollectedTest[], actual: readonly CollectedTest[]) {
  if (!expected.length) throw new Error('No required tests selected; collection or an empty test-list is not execution')
  const key = (test: CollectedTest) => JSON.stringify([test.id, test.project, test.file, test.titlePath])
  const expectedKeys = expected.map(key)
  const actualKeys = actual.map(key)
  if (new Set(expectedKeys).size !== expectedKeys.length || new Set(actualKeys).size !== actualKeys.length) throw new Error('Duplicate collection identity')
  const missing = expected.filter((test) => !actualKeys.includes(key(test)))
  const extra = actual.filter((test) => !expectedKeys.includes(key(test)))
  if (missing.length || extra.length) throw new Error(`Collection mismatch: missing ${missing.map((test) => test.titlePath.join(' / ')).join(', ') || 'none'}; prefix-overbroad/unplanned ${extra.map((test) => test.titlePath.join(' / ')).join(', ') || 'none'}`)
}

export function capabilityMatches(actual: Capabilities, context: keyof typeof CONTEXTS) {
  const required = CONTEXTS[context]
  return actual.browser === required.browser
    && actual.hasTouch === required.touch && actual.isMobile === required.touch
    && (required.touch
      ? actual.coarse && !actual.fine && !actual.hover && (actual.touchPoints > 0 || (actual.browser === 'webkit' && actual.touchPoints === 0))
      : actual.fine && !actual.coarse && actual.hover && actual.touchPoints === 0)
}

export function canClaimFullAcceptance(mode: LayoutPlan['mode'], includeManual: boolean, accepted: boolean) {
  return includeManual && accepted && (mode === 'focused' || mode === 'full-known-mock')
}

export function verifyEvidence(
  plan: LayoutPlan,
  run: RunIdentity,
  selection: CollectedTest[],
  ledger: ExecutionLedger,
  manual: ManualLedger | null,
  loadArtifact: (path: string) => Buffer,
  includeManual = true,
) {
  const failures: string[] = []
  if (plan.version !== 1 || run.version !== 1 || ledger.version !== 1) failures.push('Unsupported evidence schema')
  if (plan.id !== stableHash({ ...plan, id: '' })) failures.push('Plan contents changed after planning')
  if (run.planId !== plan.id || ledger.planId !== plan.id || ledger.runId !== run.runId) failures.push('Run/plan identity mismatch')
  if (run.source.digest !== plan.source.digest || ledger.sourceDigest !== plan.source.digest || run.candidate.source !== plan.source.digest || run.baseline.source !== plan.source.base) {
    failures.push('Temporal source/run mismatch: current source must not be attributed to a historical tested run')
  }
  if (!run.baseline.fixtureDigest || run.baseline.fixtureDigest !== run.candidate.fixtureDigest) failures.push('Baseline/candidate backend fixture mismatch')
  if (plan.blockers.length) failures.push(...plan.blockers)
  if (!ledger.complete || ledger.status !== 'passed' || ledger.errors.length) failures.push(`Incomplete/failed runner: ${ledger.status}; ${ledger.errors.join('; ')}`)
  try { assertExactSelection(selection, ledger.selected) } catch (error) { failures.push(String(error)) }
  const selectedIds = new Set(selection.map((test) => test.id))
  const notApplicable: Array<{ testId: string; reason: string }> = []
  for (const test of selection) {
    const attempts = ledger.attempts.filter((attempt) => attempt.testId === test.id)
    if (!attempts.length) { failures.push(`Not run: ${test.project}/${test.file}/${test.titlePath.join(' / ')}`); continue }
    const attempt = attempts[0]
    const effectiveBrowser = attempt.annotations.find((annotation) => annotation.type === 'layout-effective-browser')?.description
    const declaredSkip = !test.scenario && plan.legacySpecs.includes(test.file) && attempts.length === 1
      && attempt.workerIndex >= 0 && attempt.retry === 0 && attempt.status === 'skipped' && attempt.checkpoints.length === 0
      && LEGACY_ENGINE_SKIPS.find((rule) => rule.spec === test.file && rule.title === test.titlePath.at(-1)
        && rule.browser === effectiveBrowser
        && attempt.annotations.some((annotation) => annotation.type === 'skip' && annotation.description === rule.reason))
    if (declaredSkip) {
      notApplicable.push({ testId: test.id, reason: declaredSkip.reason })
      continue
    }
    if (attempts.some((attempt) => attempt.workerIndex < 0)) failures.push(`Never assigned/executed: ${test.id}`)
    if (attempts.some((attempt) => attempt.status !== 'passed' || attempt.expectedStatus !== 'passed')) {
      failures.push(`Required failure/skip/expected-failure: ${test.id} (${attempts.map((attempt) => attempt.status).join(', ')})`)
    }
    if (attempts.length !== 1 || attempts.some((attempt) => attempt.retry !== 0)) failures.push(`Flaky/retried evidence requires diagnosis and a fresh run: ${test.id}`)
  }
  if (ledger.attempts.some((attempt) => !selectedIds.has(attempt.testId))) failures.push('Evidence contains unselected attempts')
  const checkpoints = ledger.attempts.flatMap((attempt) => attempt.checkpoints)
  const expectedIds = new Set(plan.obligations.map((obligation) => obligation.id))
  if (expectedIds.size !== plan.obligations.length) failures.push('Duplicate planned checkpoint')
  if (checkpoints.some((checkpoint) => !expectedIds.has(checkpoint.id))) failures.push('Unexpected checkpoint outside the plan')
  for (const obligation of plan.obligations) {
    const matching = checkpoints.filter((checkpoint) => checkpoint.id === obligation.id)
    if (matching.length !== 1) { failures.push(`${obligation.id}: expected one passed checkpoint, observed ${matching.length}`); continue }
    const checkpoint = matching[0]
    if (!selectedIds.has(checkpoint.testId) || checkpoint.status !== 'passed') failures.push(`${obligation.id}: unbound or failed checkpoint`)
    if (checkpoint.runId !== run.runId || checkpoint.planId !== plan.id
      || checkpoint.sourceDigest !== plan.source.digest || checkpoint.buildDigest !== run.candidate.digest
      || checkpoint.fixtureDigest !== run.fixtureDigest) failures.push(`${obligation.id}: stale checkpoint provenance`)
    for (const key of ['scenario', 'state', 'context', 'profile', 'step'] as const) {
      if (checkpoint[key] !== obligation[key]) failures.push(`${obligation.id}: tuple mismatch ${key}`)
    }
    if (!capabilityMatches(checkpoint.capabilities, obligation.context)) failures.push(`${obligation.id}: unsupported actual context capabilities (project names are not proof)`)
    const expected = layoutProfile(obligation.profile)
    // A synthetic host deliberately measures its narrower inner React viewport.
    const width = obligation.scenario === 'host' && obligation.state === 'panel' && obligation.profile === 'desktop' ? expected.viewport.width - 256 : expected.viewport.width
    if (checkpoint.viewport.width !== width || checkpoint.viewport.height !== expected.viewport.height
      || Object.entries(expected.insets).some(([edge, inset]) => checkpoint.insets[edge as keyof typeof expected.insets] !== inset)) {
      failures.push(`${obligation.id}: actual viewport/insets do not match the required profile`)
    }
    if (!Object.keys(checkpoint.facts).length) failures.push(`${obligation.id}: missing asserted facts`)
    try {
      if (hash(loadArtifact(checkpoint.screenshot)) !== checkpoint.screenshotHash) failures.push(`${obligation.id}: screenshot hash mismatch`)
    } catch { failures.push(`${obligation.id}: screenshot missing or access-unavailable`) }
    if (!obligation.review || !includeManual) continue
    const reviews = manual?.reviews.filter((review) => review.checkpointId === obligation.id) ?? []
    if (reviews.length !== 1) { failures.push(`${obligation.id}: manual inspection missing or duplicated`); continue }
    const review = reviews[0]
    if (manual?.runId !== run.runId || manual.planId !== plan.id || !manual.reviewer.trim()
      || review.runId !== run.runId || review.screenshotHash !== checkpoint.screenshotHash) failures.push(`${obligation.id}: stale/unbound manual review`)
    if (review.verdict !== 'pass') failures.push(`${obligation.id}: manual ${review.verdict}`)
    if (!review.observation.trim() || !review.inspectedWith.trim() || !review.interaction.trim()
      || !review.factKeys.length || review.factKeys.some((key) => !(key in checkpoint.facts))) {
      failures.push(`${obligation.id}: manual record lacks observation, actual inspection/interaction or matching fact references`)
    }
  }
  if (manual?.reviews.some((review) => !plan.obligations.some((obligation) => obligation.review && obligation.id === review.checkpointId))) failures.push('Manual review cites an unrequested checkpoint')
  const accepted = failures.length === 0
  return {
    accepted, failures,
    fullAcceptance: canClaimFullAcceptance(plan.mode, includeManual, accepted),
    counts: {
      plannedCheckpoints: plan.obligations.length, selectedTests: selection.length,
      attempts: ledger.attempts.length, executedCheckpoints: checkpoints.length,
      passedCheckpoints: checkpoints.filter((checkpoint) => checkpoint.status === 'passed').length,
      failedCheckpoints: checkpoints.filter((checkpoint) => checkpoint.status === 'failed').length,
      requiredManual: plan.obligations.filter((obligation) => obligation.review).length,
      manualPassRecords: manual?.reviews.filter((review) => review.verdict === 'pass').length ?? 0,
    },
    scope: includeManual
      ? 'Local mock evidence only. Legacy files remain coarse; arbitrary backend states and physical devices are not certified.'
      : 'Automated-only assessment. No manual judgment or full acceptance is claimed.',
    notApplicable,
  }
}

export function verificationOutputName(includeManual: boolean) {
  return includeManual ? 'assessment.json' : 'automated-verification.json'
}

export function parseVerificationArgs(args: string[]) {
  assertOptions(args, ['--run'], ['--automated-only'])
  const run = option(args, '--run')
  if (!run) throw new Error('Usage: layout:verify -- --run artifacts/layout/<run-id> [--automated-only]')
  return { run, includeManual: !args.includes('--automated-only') }
}

export function verifyRun(root: string, input: string, includeManual = true) {
  const directory = artifactPath(root, input, true)
  const plan = readJson<LayoutPlan>(resolve(directory, 'plan.json'))
  const output = resolve(directory, verificationOutputName(includeManual))
  assertCurrentPlan(root, plan)
  if (plan.mode === 'non-layout') {
    const result = {
      accepted: true,
      fullAcceptance: canClaimFullAcceptance(plan.mode, includeManual, true),
      scope: 'Non-layout classification only; no UI or visual evidence claimed',
    }
    writeJson(output, result)
    console.log(JSON.stringify(result))
    return result
  }
  const run = readJson<RunIdentity>(resolve(directory, 'run.json'))
  if (!run.unitEvidence || stableHash(run.unitEvidence.gates) !== stableHash(plan.unitGates)
    || hash(readFileSync(artifactPath(root, run.unitEvidence.log, true))) !== run.unitEvidence.digest) throw new Error('Missing/stale declared unit-gate evidence')
  if (run.root !== root || run.artifactRoot !== directory) throw new Error('Run uses a different declared artifact/source root')
  for (const build of [run.baseline, run.candidate]) {
    artifactPath(root, build.root, true)
    if (stableHash(fingerprintDirectory(build.root)) !== build.digest || stableHash(build.assets) !== build.digest) throw new Error('Build artifacts changed after execution')
  }
  if (snapshot(root, plan.source.base).digest !== plan.source.digest) throw new Error('Source changed after planning/build/capture; replan rather than attributing old evidence to new source')
  const ledger = readJson<ExecutionLedger>(resolve(directory, 'execution.json'))
  const selection = readJson<CollectedTest[]>(resolve(directory, 'selection.json'))
  const registered = readJson<CollectedTest[]>(resolve(directory, 'registered.json'))
  if (run.collectionDigest !== stableHash(registered) || run.selectionDigest !== stableHash(selection)) throw new Error('Collection/selection artifacts changed after execution')
  assertExactSelection(selectTests(plan, registered), selection)
  let manual: ManualLedger | null = null
  if (includeManual) {
    try { manual = readJson<ManualLedger>(resolve(directory, 'manual.json')) } catch { /* Missing/inaccessible reviews remain blocked. */ }
  }
  const report = verifyEvidence(
    plan,
    run,
    selection,
    ledger,
    manual,
    (file) => readFileSync(artifactPath(root, file, true)),
    includeManual,
  )
  writeJson(output, report)
  if (!report.accepted) throw new Error(report.failures.join('\n'))
  console.log(JSON.stringify(report, null, 2))
  return report
}

export function selectTests(plan: LayoutPlan, registered: CollectedTest[]) {
  const selected = registered.filter((test) =>
    test.scenario
      ? plan.scenarios.includes(test.scenario as typeof SCENARIO_IDS[number])
        && plan.contexts.some((context) => CONTEXTS[context].project === test.project)
      : plan.legacySpecs.includes(test.file),
  )
  for (const scenario of plan.scenarios) {
    for (const context of plan.contexts) {
      if (!selected.some((test) => test.scenario === scenario && test.project === CONTEXTS[context].project)) {
        throw new Error(`Required scenario/context not registered: ${scenario}/${context}; enable the required engine/project`)
      }
    }
  }
  for (const file of plan.legacySpecs) if (!selected.some((test) => test.file === file)) throw new Error(`Required legacy file is not registered: ${file}`)
  assertExactSelection(selected, selected)
  return selected
}

export function testList(tests: CollectedTest[]) {
  return tests.map((test) => {
    const tokens = [test.project, test.file, ...test.titlePath]
    if (tokens.some((token) => /[\r\n›]/.test(token))) throw new Error('Test-list cannot safely represent a title containing a delimiter')
    return `[${test.project}] › ${test.file} › ${test.titlePath.join(' › ')}`
  }).join('\n') + '\n'
}

if (isEntry(import.meta.url)) {
  try {
    const request = parseVerificationArgs(process.argv.slice(2))
    verifyRun(process.cwd(), request.run, request.includeManual)
  } catch (error) { console.error(String(error)); process.exitCode = 1 }
}
