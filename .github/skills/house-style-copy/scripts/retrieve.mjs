import { resolve } from 'node:path'
import {
  buildCorpus,
  detectRefusal,
  loadQualifiedCorpus,
  normalizedRequestForResponse,
  normalizeRequestEntries,
  parseCliArgs,
  readJson,
  retrieveExamples,
  validateRequest,
} from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
if (!args.request) throw new Error('Usage: retrieve.mjs --request <request.json> [--live]')

const input = await readJson(resolve(String(args.request)))
const entries = normalizeRequestEntries(input)
const errors = [
  ...(entries.length ? [] : ['At least one request is required.']),
  ...entries.flatMap(({ request }, index) => validateRequest(request).map((error) => `Request ${index + 1}: ${error}`)),
]
if (errors.length) {
  console.log(JSON.stringify({ ok: false, errors, requests: entries.map((entry) => entry.request) }, null, 2))
  process.exitCode = 1
} else {
  const corpus = args.live ? await buildCorpus() : (await loadQualifiedCorpus()).records
  const results = entries.map(({ rawInput, request }) => {
    const refusal = detectRefusal(request, JSON.stringify(rawInput))
    const outputRequest = normalizedRequestForResponse(request, rawInput)
    return refusal
      ? { request: outputRequest, refusal, positives: [], negatives: [] }
      : { request: outputRequest, refusal: null, ...retrieveExamples(corpus, request) }
  })
  console.log(JSON.stringify({
    corpusSource: args.live ? 'live' : 'qualified',
    ok: results.every((result) => result.refusal === null),
    results,
  }, null, 2))
}
