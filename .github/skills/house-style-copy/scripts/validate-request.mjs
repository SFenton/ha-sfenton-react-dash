import { resolve } from 'node:path'
import { detectRefusal, normalizedRequestForResponse, normalizeRequestEntries, parseCliArgs, readJson, validateRequest } from './lib.mjs'

const args = parseCliArgs(process.argv.slice(2))
if (!args.request) throw new Error('Usage: validate-request.mjs --request <request.json>')

const input = await readJson(resolve(String(args.request)))
const entries = normalizeRequestEntries(input)
const requests = entries.map((entry) => entry.request)
const errors = [
  ...(requests.length ? [] : ['At least one request is required.']),
  ...requests.flatMap((request, index) => validateRequest(request).map((error) => `Request ${index + 1}: ${error}`)),
]
const refusals = entries.map(({ rawInput, request }) => detectRefusal(request, JSON.stringify(rawInput)))
const outputRequests = entries.map(({ rawInput, request }) => normalizedRequestForResponse(request, rawInput))
console.log(JSON.stringify({ ok: errors.length === 0, errors, refusals, requests: outputRequests }, null, 2))
if (errors.length) process.exitCode = 1
