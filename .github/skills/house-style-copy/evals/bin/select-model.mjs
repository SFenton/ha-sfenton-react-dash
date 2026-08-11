import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  batchesForCases,
  buildCorpus,
  hashSkillFiles,
  packedLaunchUnits,
  parseCliArgs,
  readJson,
  repositoryRoot,
  skillRoot,
  valueHash,
} from '../../scripts/lib.mjs'

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function standardDeviation(values) {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

function percentile(values, probability) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(probability * sorted.length) - 1))]
}

function normalizeLower(value, min, max) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 1
  if (max === min) return 0
  return (value - min) / (max - min)
}

const args = parseCliArgs(process.argv.slice(2))
if (!args.runs) {
  throw new Error('Usage: select-model.mjs --runs run-a,run-b,run-c [--write-pin]')
}

const runDirs = String(args.runs).split(',').map((value) => resolve(repositoryRoot, value.trim()))
const reports = []
for (const runDir of runDirs) {
  reports.push({
    candidates: JSON.parse(await readFile(resolve(runDir, 'candidates.json'), 'utf8')),
    cases: JSON.parse(await readFile(resolve(runDir, 'cases.json'), 'utf8')),
    corpus: JSON.parse(await readFile(resolve(runDir, 'corpus.json'), 'utf8')),
    manifest: JSON.parse(await readFile(resolve(runDir, 'run-manifest.json'), 'utf8')),
    runDir,
    score: JSON.parse(await readFile(resolve(runDir, 'score-run.json'), 'utf8')),
  })
}

const candidates = await readJson(resolve(skillRoot, 'evals/candidates.json'))
const candidatesById = new Map(candidates.candidates.map((candidate) => [candidate.id, candidate]))
const planData = await Promise.all(['calibration', 'rule-tuning', 'qualification', 'holdout', 'latency']
  .map((name) => readJson(resolve(skillRoot, `evals/plans/${name}.json`))))
const planHashes = new Map(planData.map((plan) => [plan.name, valueHash(plan)]))
const caseHashes = new Map(await Promise.all(['cases.public.json', 'cases.holdout.json'].map(async (file) => [
  file,
  valueHash(await readJson(resolve(skillRoot, `evals/${file}`))),
])))
const currentHashes = {
  candidates: valueHash(candidates),
  corpus: valueHash(await buildCorpus()),
  skill: await hashSkillFiles(),
}

function reportPhase(score) {
  return {
    'finalist-public-qualification-v1': 'qualification',
    'top-three-holdout-v1': 'holdout',
    'top-two-singleton-latency-v1': 'latency',
  }[score.manifest.name] ?? null
}

const evidenceErrors = []
const reportsByPhase = new Map(['qualification', 'holdout', 'latency'].map((phase) => [phase, []]))
if (reports.length !== 3) evidenceErrors.push(`Expected exactly three benchmark runs; received ${reports.length}.`)
if (new Set(reports.map((report) => report.runDir)).size !== reports.length) {
  evidenceErrors.push('Benchmark run paths must be unique.')
}
for (const report of reports) {
  const runLabel = report.runDir.replace(`${repositoryRoot}/`, '')
  const phase = reportPhase(report.score)
  if (!phase) {
    evidenceErrors.push(`${runLabel}: unrecognized benchmark phase.`)
    continue
  }
  reportsByPhase.get(phase).push(report)
  if (report.manifest.completed !== true) evidenceErrors.push(`${runLabel}: run manifest is incomplete.`)
  if (report.manifest.name !== report.score.manifest.name || report.manifest.caseFile !== report.score.manifest.caseFile) {
    evidenceErrors.push(`${runLabel}: score metadata does not match the run manifest.`)
  }
  const plan = report.manifest.plan
  const caseList = Array.isArray(report.cases?.cases) ? report.cases.cases : []
  const candidateProfiles = Array.isArray(report.manifest.candidateProfiles) ? report.manifest.candidateProfiles : []
  const availableCandidateIds = Array.isArray(report.manifest.availableCandidateIds) ? report.manifest.availableCandidateIds : []
  if (!plan || !caseList.length) {
    evidenceErrors.push(`${runLabel}: run plan or cases snapshot is missing.`)
    continue
  }
  if (candidateProfiles.length !== plan?.expectedCandidateCount) {
    evidenceErrors.push(`${runLabel}: requested candidate count does not match the plan.`)
  }
  if (availableCandidateIds.length !== candidateProfiles.length) {
    evidenceErrors.push(`${runLabel}: not every requested candidate passed preflight.`)
  }
  const selectedCaseIds = new Set(plan?.caseIds ?? caseList.map((evalCase) => evalCase.id))
  const selectedCases = caseList.filter((evalCase) => selectedCaseIds.has(evalCase.id))
  const repeats = plan?.repeats ?? 1
  let expectedBatchCount = 0
  for (const profileId of availableCandidateIds) {
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const batches = batchesForCases(caseList, plan, profileId, repeat)
      expectedBatchCount += plan.packBatches
        ? packedLaunchUnits(batches, plan.batchSize).length
        : batches.length
    }
    const profileCases = report.score.cases.filter((record) => record.profileId === profileId)
    if (profileCases.length !== selectedCases.length * repeats) {
      evidenceErrors.push(`${runLabel}: ${profileId} does not have complete case/repeat coverage.`)
    }
    for (const caseId of selectedCaseIds) {
      const caseRepeats = new Set(profileCases.filter((record) => record.caseId === caseId).map((record) => record.repeat))
      if (caseRepeats.size !== repeats) {
        evidenceErrors.push(`${runLabel}: ${profileId}/${caseId} does not cover every repeat.`)
      }
    }
  }
  const expectedCaseCount = selectedCases.length * repeats * availableCandidateIds.length
  if (
    report.manifest.totals?.batches !== expectedBatchCount
    || report.score.totals?.batches !== expectedBatchCount
    || report.score.batches.length !== expectedBatchCount
  ) {
    evidenceErrors.push(`${runLabel}: batch totals do not match the planner.`)
  }
  if (
    report.manifest.totals?.cases !== expectedCaseCount
    || report.score.totals?.cases !== expectedCaseCount
    || report.score.cases.length !== expectedCaseCount
  ) {
    evidenceErrors.push(`${runLabel}: case totals do not match the plan.`)
  }
  if (report.manifest.totals?.profiles !== availableCandidateIds.length) {
    evidenceErrors.push(`${runLabel}: profile totals do not match the manifest.`)
  }
  const hashes = report.score.manifest.hashes ?? {}
  if (hashes.candidates !== valueHash(report.candidates)) evidenceErrors.push(`${runLabel}: claimed candidate hash does not match the saved snapshot.`)
  if (hashes.corpus !== valueHash(report.corpus)) evidenceErrors.push(`${runLabel}: claimed corpus hash does not match the saved snapshot.`)
  if (hashes.cases !== valueHash(report.cases)) evidenceErrors.push(`${runLabel}: claimed case hash does not match the saved snapshot.`)
  if (hashes.plan !== valueHash(report.manifest.plan)) evidenceErrors.push(`${runLabel}: claimed plan hash does not match the saved snapshot.`)
  if (JSON.stringify(hashes) !== JSON.stringify(report.manifest.hashes)) evidenceErrors.push(`${runLabel}: score hashes do not match the run manifest.`)
  if (hashes.candidates !== currentHashes.candidates) evidenceErrors.push(`${runLabel}: candidate snapshot is stale or inconsistent.`)
  if (hashes.corpus !== currentHashes.corpus) evidenceErrors.push(`${runLabel}: corpus snapshot is stale or inconsistent.`)
  if (hashes.skill !== currentHashes.skill) evidenceErrors.push(`${runLabel}: skill snapshot is stale or inconsistent.`)
  if (hashes.cases !== caseHashes.get(report.score.manifest.caseFile)) evidenceErrors.push(`${runLabel}: case snapshot is stale or inconsistent.`)
  if (hashes.plan !== planHashes.get(report.score.manifest.name)) evidenceErrors.push(`${runLabel}: plan snapshot is stale or inconsistent.`)
  if (report.score.manifest.pricingAsOf !== candidates.pricingAsOf) evidenceErrors.push(`${runLabel}: pricing snapshot is stale or inconsistent.`)
}
for (const phase of ['qualification', 'holdout', 'latency']) {
  if (reportsByPhase.get(phase).length !== 1) evidenceErrors.push(`Expected exactly one ${phase} run.`)
}
if ([...reportsByPhase.values()].every((phaseReports) => phaseReports.length === 1)) {
  const candidateSet = (phase) => {
    const ids = reportsByPhase.get(phase)[0].manifest.availableCandidateIds
    if (new Set(ids).size !== ids.length) evidenceErrors.push(`${phase} candidate profiles must be unique.`)
    return new Set(ids)
  }
  const qualificationCandidates = candidateSet('qualification')
  const holdoutCandidates = candidateSet('holdout')
  const latencyCandidates = candidateSet('latency')
  if (JSON.stringify([...qualificationCandidates].sort()) !== JSON.stringify([...holdoutCandidates].sort())) {
    evidenceErrors.push('Qualification and holdout candidate sets must match exactly.')
  }
  if (latencyCandidates.size !== 2 || [...latencyCandidates].some((profileId) => !qualificationCandidates.has(profileId))) {
    evidenceErrors.push('Latency evidence must contain exactly two finalists from the qualification set.')
  }
}
if (evidenceErrors.length) {
  console.log(JSON.stringify({
    ok: false,
    reason: 'Benchmark evidence is incomplete, stale, or inconsistent.',
    errors: evidenceErrors,
  }, null, 2))
  process.exitCode = 1
  process.exit()
}

const phaseProfiles = Object.fromEntries([...reportsByPhase].map(([phase, phaseReports]) => [
  phase,
  new Set(phaseReports.flatMap(({ score }) => score.cases.map((record) => record.profileId))),
]))
const profileIds = [...phaseProfiles.qualification].filter((profileId) =>
  phaseProfiles.holdout.has(profileId) && phaseProfiles.latency.has(profileId))
if (!profileIds.length) {
  console.log(JSON.stringify({
    ok: false,
    reason: 'No candidate has qualification, holdout, and latency evidence.',
  }, null, 2))
  process.exitCode = 1
  process.exit()
}
const aggregates = []

for (const profileId of profileIds) {
  const candidate = candidatesById.get(profileId)
  if (!candidate || candidate.model === 'auto') continue
  const calibrationCases = reportsByPhase.get('qualification')
    .flatMap(({ score }) => score.cases.filter((record) => record.profileId === profileId))
  const holdoutCases = reportsByPhase.get('holdout')
    .flatMap(({ score }) => score.cases.filter((record) => record.profileId === profileId))
  const latencyCases = reportsByPhase.get('latency')
    .flatMap(({ score }) => score.cases.filter((record) => record.profileId === profileId))
  const qualityCases = [...calibrationCases, ...holdoutCases]
  const allCases = [...qualityCases, ...latencyCases]
  const batches = reports.flatMap(({ score }) => score.batches.filter((record) => record.profileId === profileId))
  const latencyBatches = reportsByPhase.get('latency')
    .flatMap(({ score }) => score.batches.filter((record) => record.profileId === profileId))
  const singletonCases = latencyCases
  const nonSingletonCases = qualityCases.filter((record) => !record.singleton)
  const notificationAndSafety = qualityCases.filter((record) => (
    record.contextClass?.startsWith('notification-')
    || record.contextClass === 'destructive-action'
    || /refuse|privacy|injection/.test(record.caseId)
  ))
  const contextMeans = Object.fromEntries([...new Set(qualityCases.map((record) => record.contextClass))]
    .map((context) => [context, mean(qualityCases.filter((record) => record.contextClass === context).map((record) => record.score))]))
  const creditValues = batches.map((batch) => batch.usage.estimatedAiCredits).filter((value) => value !== null)
  const estimatedAiCredits = creditValues.length ? creditValues.reduce((sum, value) => sum + value, 0) : null
  const accepted = allCases.filter((record) => record.ok).length
  const singletonMean = mean(singletonCases.map((record) => record.score))
  const batchMean = mean(nonSingletonCases.map((record) => record.score))
  const holdoutMean = mean(holdoutCases.map((record) => record.score))
  const holdoutRepeatMeans = [...new Set(holdoutCases.map((record) => record.repeat))]
    .map((repeat) => mean(holdoutCases.filter((record) => record.repeat === repeat).map((record) => record.score)))
  const calibrationMean = mean(calibrationCases.map((record) => record.score))
  const singletonScoreDelta = singletonMean !== null && batchMean !== null ? singletonMean - batchMean : null
  const useSingletonQuality = singletonScoreDelta !== null && singletonScoreDelta < -4
  const overallMean = mean(qualityCases.map((record) => record.score))
  const metrics = {
    accepted,
    batchMeanScore: batchMean,
    calibrationMeanScore: calibrationMean,
    contextFloor: Math.min(...Object.values(contextMeans)),
    contextMeans,
    estimatedAiCredits,
    estimatedAiCreditsPerAcceptedOutput: accepted && estimatedAiCredits !== null ? estimatedAiCredits / accepted : null,
    hardFailureCount: allCases.reduce((sum, record) => sum + record.hardFailures.length, 0),
    holdoutDrop: calibrationMean !== null && holdoutMean !== null ? calibrationMean - holdoutMean : null,
    holdoutMeanScore: holdoutMean,
    holdoutRepeatMeans,
    meanScore: overallMean,
    notificationAndSafetyPassRate: notificationAndSafety.length
      ? notificationAndSafety.filter((record) => record.ok).length / notificationAndSafety.length
      : 0,
    latencyPassRate: latencyCases.length
      ? latencyCases.filter((record) => record.ok).length / latencyCases.length
      : 0,
    p95SingletonLatencyMs: percentile(latencyBatches.map((record) => record.durationMs), 0.95),
    passRate: qualityCases.length
      ? qualityCases.filter((record) => record.ok).length / qualityCases.length
      : 0,
    profileId,
    scoreStandardDeviation: standardDeviation(qualityCases.map((record) => record.score)),
    selectionMeanScore: useSingletonQuality ? singletonMean : overallMean,
    singletonMeanScore: singletonMean,
    singletonScoreDelta,
    singletonEvidenceSelected: useSingletonQuality,
    totalCases: qualityCases.length,
  }
  const gateFailures = []
  if (metrics.hardFailureCount !== 0) gateFailures.push('hard failures')
  if (metrics.passRate < 0.95) gateFailures.push('pass rate below 95%')
  if ((metrics.meanScore ?? 0) < 92) gateFailures.push('mean score below 92')
  if (metrics.singletonEvidenceSelected && (metrics.singletonMeanScore ?? 0) < 92) gateFailures.push('singleton-selected mean score below 92')
  if (metrics.contextFloor < 88) gateFailures.push('context floor below 88')
  if (metrics.notificationAndSafetyPassRate < 0.95) gateFailures.push('notification/safety pass rate below 95%')
  if (metrics.latencyPassRate < 0.95) gateFailures.push('latency case pass rate below 95%')
  if (metrics.holdoutDrop !== null && metrics.holdoutDrop > 3) gateFailures.push('holdout drop above 3')
  if (holdoutRepeatMeans.length && Math.min(...holdoutRepeatMeans) < 85) gateFailures.push('holdout repeat below 85')
  aggregates.push({
    candidate,
    gateFailures,
    metrics,
    passedQualityGate: gateFailures.length === 0,
  })
}

const passing = aggregates.filter((entry) => entry.passedQualityGate)
if (!passing.length) {
  console.log(JSON.stringify({ ok: false, reason: 'No candidate passed the quality gate.', candidates: aggregates }, null, 2))
  process.exitCode = 1
} else {
  const measured = passing.filter((entry) => (
    entry.metrics.estimatedAiCreditsPerAcceptedOutput !== null
    && entry.metrics.p95SingletonLatencyMs !== null
  ))
  if (!measured.length) {
    console.log(JSON.stringify({
      ok: false,
      reason: 'No quality-passing candidate has both measured cost and singleton latency evidence.',
      candidates: aggregates,
    }, null, 2))
    process.exitCode = 1
    process.exit()
  }
  const costs = measured.map((entry) => entry.metrics.estimatedAiCreditsPerAcceptedOutput)
  const latencies = measured.map((entry) => entry.metrics.p95SingletonLatencyMs)
  const risks = measured.map((entry) => (
    Math.max(0, 100 - entry.metrics.selectionMeanScore)
    + entry.metrics.scoreStandardDeviation
  ))
  const ranges = {
    cost: [Math.min(...costs), Math.max(...costs)],
    latency: [Math.min(...latencies), Math.max(...latencies)],
    risk: [Math.min(...risks), Math.max(...risks)],
  }
  for (let index = 0; index < measured.length; index += 1) {
    measured[index].selectionScore = (
      0.5 * normalizeLower(costs[index], ...ranges.cost)
      + 0.3 * normalizeLower(latencies[index], ...ranges.latency)
      + 0.2 * normalizeLower(risks[index], ...ranges.risk)
    )
  }
  measured.sort((left, right) => (
    left.selectionScore - right.selectionScore
    || (left.metrics.estimatedAiCreditsPerAcceptedOutput ?? Infinity) - (right.metrics.estimatedAiCreditsPerAcceptedOutput ?? Infinity)
    || (left.metrics.p95SingletonLatencyMs ?? Infinity) - (right.metrics.p95SingletonLatencyMs ?? Infinity)
  ))
  const winner = measured[0]
  const result = {
    ok: true,
    winner,
    singletonEvidenceProfiles: measured
      .filter((entry) => entry.metrics.singletonEvidenceSelected)
      .map((entry) => entry.candidate.id),
    ranking: measured,
    rejected: aggregates.filter((entry) => !entry.passedQualityGate || !measured.includes(entry)),
    runHashes: reports.map(({ score }) => valueHash(score)),
  }
  if (args['write-pin']) {
    if (winner.metrics.p95SingletonLatencyMs === null) {
      throw new Error('Cannot write a pin without singleton latency evidence.')
    }
    const pin = {
      version: 1,
      status: 'validated',
      model: winner.candidate.model,
      effort: winner.candidate.effort,
      context: winner.candidate.context,
      candidateId: winner.candidate.id,
      selectionBasis: winner.metrics.singletonEvidenceSelected
        ? 'Passed deterministic quality gate; singleton quality trailed batch quality by more than four points, so selection used singleton evidence before cost, latency, and variance.'
        : 'Passed deterministic quality gate, then minimized accepted-output cost, p95 singleton latency, and variance risk.',
      evalRun: reports.map(({ runDir }) => runDir.replace(`${repositoryRoot}/`, '')).join(','),
      pricingAsOf: candidates.pricingAsOf,
      expiresAfterDays: 90,
      selectedAt: new Date().toISOString(),
      autoSelectionAllowed: false,
      evidence: {
        qualificationHashes: currentHashes,
        runHashes: result.runHashes,
        metrics: winner.metrics,
        selectionScore: winner.selectionScore,
      },
    }
    await writeFile(resolve(skillRoot, 'evals/model-pin.json'), `${JSON.stringify(pin, null, 2)}\n`)
    result.pinWritten = true
  }
  console.log(JSON.stringify(result, null, 2))
}
