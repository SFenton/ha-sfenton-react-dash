import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { parseCliArgs, repositoryRoot } from '../../scripts/lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
if (!args.run) throw new Error('Usage: summarize.mjs --run artifacts/house-style-copy-evals/<run-id>')

const runDir = resolve(repositoryRoot, String(args.run))
const score = JSON.parse(await readFile(resolve(runDir, 'score-run.json'), 'utf8'))

const projection = {
  run: score.run,
  models: score.models
    .map((model) => ({
      estimatedAiCreditsPerAcceptedOutput: model.estimatedAiCreditsPerAcceptedOutput,
      hardFailureCount: model.hardFailureCount,
      meanScore: model.meanScore,
      p95SingletonLatencyMs: model.p95SingletonLatencyMs,
      passRate: model.passRate,
      profileId: model.profileId,
      scoreStandardDeviation: model.scoreStandardDeviation,
      singletonMeanScore: model.singletonMeanScore,
      singletonScoreDelta: model.singletonScoreDelta,
      weakestContexts: Object.entries(model.contextMeans)
        .sort((left, right) => left[1] - right[1])
        .slice(0, 5)
        .map(([contextClass, meanScore]) => ({ contextClass, meanScore })),
    }))
    .sort((left, right) => (
      right.passRate - left.passRate
      || right.meanScore - left.meanScore
      || (left.estimatedAiCreditsPerAcceptedOutput ?? Infinity) - (right.estimatedAiCreditsPerAcceptedOutput ?? Infinity)
    )),
  failures: score.cases
    .filter((record) => !record.ok)
    .map((record) => ({
      caseId: record.caseId,
      hardFailures: record.hardFailures,
      profileId: record.profileId,
      score: record.score,
      warnings: record.warnings,
    })),
  totals: score.totals,
}

const markdown = [
  `# ${basename(runDir)} summary`,
  '',
  '| Profile | Pass rate | Mean | Hard failures | AI credits / accepted | p95 singleton ms |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...projection.models.map((model) => (
    `| ${model.profileId} | ${(model.passRate * 100).toFixed(1)}% | ${model.meanScore?.toFixed(1) ?? 'n/a'} | ${model.hardFailureCount} | ${model.estimatedAiCreditsPerAcceptedOutput?.toFixed(4) ?? 'n/a'} | ${model.p95SingletonLatencyMs ?? 'n/a'} |`
  )),
  '',
  `Failed case records: ${projection.failures.length}`,
  '',
].join('\n')

await writeFile(resolve(runDir, 'summary.json'), `${JSON.stringify(projection, null, 2)}\n`)
await writeFile(resolve(runDir, 'summary.md'), `${markdown}\n`)
console.log(JSON.stringify({
  failures: projection.failures.length,
  models: projection.models,
  outputs: [resolve(runDir, 'summary.json'), resolve(runDir, 'summary.md')],
}, null, 2))
