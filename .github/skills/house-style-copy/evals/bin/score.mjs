import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import {
  loadQualifiedCorpus,
  normalizeRequest,
  parseCliArgs,
  readJson,
  repositoryRoot,
  retrieveExamples,
  skillRoot,
  validateResponse,
} from '../../scripts/lib.mjs'

const evalRoot = resolve(skillRoot, 'evals')

async function resultPaths(directory) {
  const paths = []
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = resolve(current, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (
        entry.isFile()
        && entry.name === 'result.json'
        && (current.includes('/participants/') || current.includes('/local-results/'))
      ) {
        paths.push(path)
      }
    }
  }
  await walk(directory)
  return paths.sort()
}

function percentile(values, probability) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(probability * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function standardDeviation(values) {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

function findNumeric(value, names) {
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    if (names.includes(key.toLowerCase()) && Number.isFinite(Number(child))) return Number(child)
  }
  for (const child of Object.values(value)) {
    const found = findNumeric(child, names)
    if (found !== null) return found
  }
  return null
}

function findString(value, names) {
  if (!value || typeof value !== 'object') return null
  for (const [key, child] of Object.entries(value)) {
    if (names.includes(key.toLowerCase()) && typeof child === 'string') return child
  }
  for (const child of Object.values(value)) {
    const found = findString(child, names)
    if (found !== null) return found
  }
  return null
}

function usageProjection(usage, pricing, promptText, outputText) {
  const inputTokens = findNumeric(usage, ['inputtokens', 'input_tokens', 'prompttokens', 'prompt_tokens']) ?? 0
  const cachedInputTokens = findNumeric(usage, ['cachedinputtokens', 'cached_input_tokens', 'cache_read_input_tokens']) ?? 0
  const cacheWriteTokens = findNumeric(usage, ['cachewritetokens', 'cache_write_tokens', 'cache_creation_input_tokens']) ?? 0
  const outputTokens = findNumeric(usage, ['outputtokens', 'output_tokens', 'completiontokens', 'completion_tokens']) ?? 0
  const reportedAiCredits = findNumeric(usage, ['aicredits', 'ai_credits', 'totalcredits', 'total_credits'])
  const premiumRequests = findNumeric(usage, ['premiumrequests', 'premium_requests'])
  const totalNanoAiu = findNumeric(usage, ['totalnanoaiu', 'total_nano_aiu'])
  const tokenUsageAvailable = inputTokens + cachedInputTokens + cacheWriteTokens + outputTokens > 0
  const estimatedInputTokens = tokenUsageAvailable ? inputTokens : Math.ceil(String(promptText ?? '').length / 4)
  const estimatedOutputTokens = tokenUsageAvailable ? outputTokens : Math.ceil(String(outputText ?? '').length / 4)
  const estimatedUsd = (
    estimatedInputTokens * pricing.input
    + cachedInputTokens * pricing.cachedInput
    + cacheWriteTokens * pricing.cacheWrite
    + estimatedOutputTokens * pricing.output
  ) / 1_000_000
  return {
    cacheWriteTokens,
    cachedInputTokens,
    estimatedAiCredits: reportedAiCredits ?? estimatedUsd * 100,
    estimatedUsd,
    inputTokens,
    outputTokens,
    premiumRequests,
    reportedAiCredits,
    tokenEstimateMethod: tokenUsageAvailable ? 'reported-tokens' : 'characters-divided-by-four',
    totalNanoAiu,
  }
}

function hardValidationError(error) {
  return /(?:Response must|Missing response field|Unexpected|Invalid response status|Invalid refusal code|normalizedRequest|rankedCandidates must|exemplarsUsed|warnings|checks must|must be true|Successful responses|responses must|require a structured refusal|Mandatory refusal|proposedKey|ranked candidates|Candidate rank|ranks must|texts must|rationale is required|variant ids|require a variant|maxCharacters|maxWords|placeholders|forbidden term|Raw backend IDs|Sensitive output)/i.test(error)
}

function responseText(response) {
  return JSON.stringify(response)
}

function candidateText(candidate) {
  return typeof candidate?.text === 'string' ? candidate.text : ''
}

function normalizedWords(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []
}

function hasSurfaceSubject(text, surface) {
  const ignored = new Set(['card', 'control', 'footer', 'modal', 'notification', 'page', 'row', 'search', 'section', 'sheet', 'summary'])
  const subjectTerms = normalizedWords(surface).filter((term) => !ignored.has(term))
  const candidateTerms = new Set(normalizedWords(text))
  return subjectTerms.some((term) => candidateTerms.has(term))
}

function oracleScore(response, evalCase, exemplarIds) {
  const oracle = evalCase.oracle
  const hardFailures = []
  const warnings = []
  let score = 100
  if (response.status !== oracle.expectedStatus) {
    hardFailures.push(`Expected status ${oracle.expectedStatus}, received ${response.status}.`)
  }

  if (oracle.expectedStatus !== 'ok') {
    if (response.refusal?.code !== oracle.requiredRefusalCode) {
      hardFailures.push(`Expected refusal code ${oracle.requiredRefusalCode}.`)
    }
    if ((response.rankedCandidates?.length ?? 0) !== 0) hardFailures.push('Refusal returned candidates.')
  } else {
    const candidates = Array.isArray(response.rankedCandidates)
      ? response.rankedCandidates.filter((candidate) => candidate && typeof candidate === 'object')
      : []
    if (candidates.length !== oracle.requiredCandidateCount) hardFailures.push(`Expected ${oracle.requiredCandidateCount} candidates.`)
    if (oracle.requiredKeyPrefix && !(typeof response.proposedKey === 'string' && response.proposedKey.startsWith(oracle.requiredKeyPrefix))) {
      score -= 3
      warnings.push(`proposedKey does not start with ${oracle.requiredKeyPrefix}.`)
    }
    const accepted = new Set(oracle.acceptedTexts ?? [])
    const primary = candidateText(candidates.find((candidate) => candidate.rank === 1))
    const requiredTerms = oracle.requiredTerms ?? []
    const matchingTerms = requiredTerms.filter((term) => primary.toLowerCase().includes(term.toLowerCase())).length
    if (accepted.size) {
      const acceptedCount = candidates.filter((candidate) => accepted.has(candidateText(candidate))).length
      if (acceptedCount === candidates.length) {
        // Full credit.
      } else if (acceptedCount > 0) {
        const unmatchedCount = candidates.length - acceptedCount
        score -= Math.min(24, unmatchedCount * 8)
        warnings.push(`${unmatchedCount} candidate(s) did not match accepted outputs.`)
      } else {
        const semanticCoverage = requiredTerms.length ? matchingTerms / requiredTerms.length : 0
        const semanticPenalty = requiredTerms.length
          ? semanticCoverage > 0 ? Math.round(12 * (1 - semanticCoverage)) : 25
          : hasSurfaceSubject(primary, evalCase.expectedRequest.surface) ? 12 : 25
        score -= semanticPenalty
        warnings.push('No candidate matched an accepted output.')
      }
    }
    if (requiredTerms.length) {
      const missing = requiredTerms.length - matchingTerms
      if (missing) warnings.push(`Primary candidate missed ${missing} required semantic term(s).`)
    }
    const used = new Set(Array.isArray(response.exemplarsUsed) ? response.exemplarsUsed : [])
    const invalidExemplars = [...used].filter((id) => !exemplarIds.has(id))
    if (invalidExemplars.length) {
      score -= 5
      warnings.push(`Response cited unavailable exemplar ids: ${invalidExemplars.join(', ')}`)
    }
    if (!used.size && exemplarIds.size) {
      score -= 5
      warnings.push('Response did not cite a supplied exemplar.')
    }
  }

  const forbiddenTarget = oracle.expectedStatus === 'ok'
    ? (Array.isArray(response.rankedCandidates) ? response.rankedCandidates : []).map(candidateText).join('\n')
    : responseText(response)
  for (const pattern of oracle.forbiddenPatterns ?? []) {
    if (new RegExp(pattern, 'i').test(forbiddenTarget)) {
      hardFailures.push(`Response matched forbidden pattern ${pattern}.`)
    }
  }

  if (response.confidence === 'low' && response.status === 'ok') score -= 5
  return {
    hardFailures,
    ok: hardFailures.length === 0 && score >= 88,
    score: Math.max(0, score),
    warnings,
  }
}

const args = parseCliArgs(process.argv.slice(2))
if (!args.run) throw new Error('Usage: score.mjs --run artifacts/house-style-copy-evals/<run-id>')

const runDir = resolve(repositoryRoot, String(args.run))
const manifest = await readJson(resolve(runDir, 'run-manifest.json'))
const candidateData = await readJson(resolve(runDir, 'candidates.json')).catch(() => readJson(resolve(evalRoot, 'candidates.json')))
const candidatesById = new Map(candidateData.candidates.map((candidate) => [candidate.id, candidate]))
const savedCases = await readJson(resolve(runDir, 'cases.json')).catch(() => null)
const publicCases = savedCases ?? await readJson(resolve(evalRoot, 'cases.public.json'))
const holdoutCases = savedCases ? { cases: [] } : await readJson(resolve(evalRoot, 'cases.holdout.json'))
const casesById = new Map([...publicCases.cases, ...holdoutCases.cases].map((evalCase) => [evalCase.id, evalCase]))
const corpus = await readJson(resolve(runDir, 'corpus.json'))
  .catch(async () => (await loadQualifiedCorpus()).records)
const scoredCases = []
const batchRecords = []

for (const path of await resultPaths(runDir)) {
  const record = JSON.parse(await readFile(path, 'utf8'))
  const result = record.result
  const profile = candidatesById.get(record.profile.id)
  const batchHardFailures = []
  const localOnly = record.localOnly === true
  if (!profile) batchHardFailures.push(`Unknown profile ${record.profile.id}.`)
  if (!localOnly && result.exit?.code !== 0) batchHardFailures.push(`Copilot exited with ${result.exit?.code ?? result.exit?.signal}.`)
  if (result.parseError || !result.parsedOutput) batchHardFailures.push(`Invalid JSON: ${result.parseError ?? 'missing output'}.`)
  if (!localOnly && result.finalMessage?.model !== record.profile.model) {
    batchHardFailures.push(`Runtime model ${result.finalMessage?.model} did not match ${record.profile.model}.`)
  }
  if (!localOnly && (
    result.launcherProfile?.model !== record.profile.model
    || result.launcherProfile?.effort !== record.profile.effort
    || result.launcherProfile?.context !== record.profile.context
  )) {
    batchHardFailures.push('Launcher profile did not match the requested model, effort, and context.')
  }
  const runtimeProfileEvents = (result.selectedEvents ?? []).filter((event) => (
    event.type === 'model.call_start' || event.type === 'session.info'
  ))
  const runtimeModels = runtimeProfileEvents
    .filter((event) => event.type === 'model.call_start')
    .map((event) => event.data?.model)
    .filter(Boolean)
  if (!localOnly && (!runtimeModels.length || runtimeModels.some((model) => model !== record.profile.model))) {
    batchHardFailures.push(`Runtime model-call evidence did not match ${record.profile.model}.`)
  }
  const runtimeEffort = findString(runtimeProfileEvents, ['effort', 'effortlevel', 'reasoning_effort'])
  const runtimeContext = findString(runtimeProfileEvents, ['context', 'contexttier', 'context_tier'])
  if (!localOnly && record.profile.effort !== null && runtimeEffort !== null && runtimeEffort !== record.profile.effort) {
    batchHardFailures.push(`Runtime effort ${runtimeEffort} did not match ${record.profile.effort}.`)
  }
  if (!localOnly && runtimeContext !== null && runtimeContext !== record.profile.context) {
    batchHardFailures.push(`Runtime context ${runtimeContext} did not match ${record.profile.context}.`)
  }
  if (result.toolEvents?.length) batchHardFailures.push('Participant requested or executed a tool.')
  if (result.unexpectedFiles?.length) batchHardFailures.push(`Participant wrote files: ${result.unexpectedFiles.join(', ')}`)
  if (localOnly && (record.modelCaseIds?.length || result.finalMessage || result.selectedEvents?.length)) {
    batchHardFailures.push('Local-only refusal batch contains participant execution evidence.')
  }

  const rawOutputResults = Array.isArray(result.parsedOutput?.results) ? result.parsedOutput.results : []
  const outputResults = rawOutputResults.filter((entry) =>
    entry && typeof entry === 'object' && typeof entry.caseId === 'string')
  if (outputResults.length !== rawOutputResults.length) {
    batchHardFailures.push(`Malformed result entries: ${rawOutputResults.length - outputResults.length}.`)
  }
  const byCase = new Map(outputResults.map((entry) => [entry.caseId, entry.response]))
  if (rawOutputResults.length !== record.caseIds.length) {
    batchHardFailures.push(`Expected ${record.caseIds.length} result objects, received ${rawOutputResults.length}.`)
  }
  for (const extra of outputResults.map((entry) => entry.caseId).filter((caseId) => !record.caseIds.includes(caseId))) {
    batchHardFailures.push(`Unexpected case id ${extra}.`)
  }

  const promptText = localOnly
    ? ''
    : await readFile(resolve(dirname(path), 'prompt.md'), 'utf8').catch(() => '')
  const usage = localOnly
    ? {
        cacheWriteTokens: 0,
        cachedInputTokens: 0,
        estimatedAiCredits: 0,
        estimatedUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        premiumRequests: null,
        reportedAiCredits: null,
        tokenEstimateMethod: 'local-deterministic',
        totalNanoAiu: null,
      }
    : usageProjection(result.resultEvent?.usage, profile?.pricing ?? {
        input: 0,
        cachedInput: 0,
        cacheWrite: 0,
        output: 0,
      }, promptText, result.finalMessage?.content ?? '')
  batchRecords.push({
    batchId: record.batchId,
    durationMs: result.durationMs,
    hardFailures: batchHardFailures,
    localOnly,
    profileId: record.profile.id,
    repeat: record.repeat,
    singleton: record.singleton,
    usage,
  })

  for (const caseId of record.caseIds) {
    const evalCase = casesById.get(caseId)
    const response = byCase.get(caseId)
    const localCase = record.localCaseIds?.includes(caseId) ?? false
    const hardFailures = localCase ? [] : [...batchHardFailures]
    const warnings = []
    let score = 0
    if (!evalCase) {
      hardFailures.push(`Unknown case ${caseId}.`)
    } else if (!response) {
      hardFailures.push(`Missing response for ${caseId}.`)
    } else {
      const request = normalizeRequest(evalCase.expectedRequest)
      const validationErrors = validateResponse(response, request, evalCase.input)
      for (const error of validationErrors) {
        if (hardValidationError(error)) hardFailures.push(error)
        else warnings.push(error)
      }
      const validationWarningCount = warnings.length
      const retrieval = localCase
        ? { positives: [], negatives: [] }
        : retrieveExamples(corpus, {
            ...request,
            sourceText: typeof evalCase.input === 'string'
              ? evalCase.input
              : evalCase.input.sourceText ?? evalCase.input.intent,
          })
      const exemplarIds = new Set([...retrieval.positives, ...retrieval.negatives].map((record) => record.id))
      const oracle = oracleScore(response, evalCase, exemplarIds)
      hardFailures.push(...oracle.hardFailures)
      warnings.push(...oracle.warnings)
      score = Math.max(0, oracle.score - Math.min(20, validationWarningCount * 4))
    }
    scoredCases.push({
      batchId: record.batchId,
      caseId,
      contextClass: evalCase?.expectedRequest?.contextClass ?? null,
      hardFailures,
      ok: hardFailures.length === 0 && score >= 88,
      profileId: record.profile.id,
      repeat: record.repeat,
      score,
      singleton: record.singleton,
      local: localCase,
      warnings,
    })
  }
}

const models = []
for (const profileId of [...new Set(scoredCases.map((record) => record.profileId))]) {
  const cases = scoredCases.filter((record) => record.profileId === profileId)
  const batches = batchRecords.filter((record) => record.profileId === profileId)
  const accepted = cases.filter((record) => record.ok).length
  const hardFailureCount = cases.reduce((sum, record) => sum + record.hardFailures.length, 0)
  const scores = cases.map((record) => record.score)
  const singletonScores = cases.filter((record) => record.singleton).map((record) => record.score)
  const batchScores = cases.filter((record) => !record.singleton).map((record) => record.score)
  const singletonLatencies = batches.filter((record) => record.singleton).map((record) => record.durationMs)
  const creditValues = batches.map((record) => record.usage.estimatedAiCredits).filter((value) => value !== null)
  const totalAiCredits = creditValues.length ? creditValues.reduce((sum, value) => sum + value, 0) : null
  const contextMeans = Object.fromEntries([...new Set(cases.map((record) => record.contextClass))]
    .map((context) => [context, mean(cases.filter((record) => record.contextClass === context).map((record) => record.score))]))
  models.push({
    acceptedCases: accepted,
    batchMeanScore: mean(batchScores),
    contextMeans,
    estimatedAiCredits: totalAiCredits,
    estimatedAiCreditsPerAcceptedOutput: accepted && totalAiCredits !== null ? totalAiCredits / accepted : null,
    hardFailureCount,
    meanScore: mean(scores),
    p95SingletonLatencyMs: percentile(singletonLatencies, 0.95),
    passRate: cases.length ? accepted / cases.length : 0,
    profileId,
    scoreStandardDeviation: standardDeviation(scores),
    singletonMeanScore: mean(singletonScores),
    singletonScoreDelta: singletonScores.length && batchScores.length ? mean(singletonScores) - mean(batchScores) : null,
    totalCases: cases.length,
  })
}

const report = {
  version: 1,
  run: basename(runDir),
  manifest: {
    caseFile: manifest.caseFile,
    hashes: manifest.hashes,
    name: manifest.name,
    pricingAsOf: manifest.pricingAsOf,
  },
  models,
  cases: scoredCases,
  batches: batchRecords,
  totals: {
    batches: batchRecords.length,
    cases: scoredCases.length,
    hardFailures: scoredCases.reduce((sum, record) => sum + record.hardFailures.length, 0),
    passed: scoredCases.filter((record) => record.ok).length,
  },
}

await writeFile(resolve(runDir, 'score-run.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  models,
  output: resolve(runDir, 'score-run.json'),
  totals: report.totals,
}, null, 2))
