import { resolve } from 'node:path'
import { normalizeRequestEntries, parseCliArgs, readJson, validateRequest, validateResponseSet } from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
if (!args.request || !args.response) {
  throw new Error('Usage: validate-response.mjs --request <request.json> --response <response.json>')
}

const input = await readJson(resolve(String(args.request)))
const entries = normalizeRequestEntries(input)
const requests = entries.map((entry) => entry.request)
const response = await readJson(resolve(String(args.response)))
const errors = [
  ...(requests.length ? [] : ['At least one request is required.']),
  ...requests.flatMap((request, index) => validateRequest(request).map((error) => `Request ${index + 1}: ${error}`)),
  ...validateResponseSet(response, requests, entries.map((entry) => entry.rawInput)),
]
console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2))
if (errors.length) process.exitCode = 1
