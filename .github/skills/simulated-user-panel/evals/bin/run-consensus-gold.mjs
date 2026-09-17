import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

function safeEnv() {
  const env = { NO_COLOR: '1' }
  for (const key of ['HOME', 'LANG', 'LC_ALL', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  return env
}

const args = parseArgs(process.argv.slice(2))
if (!args.out) throw new Error('Usage: run-consensus-gold.mjs --out <artifact-dir>')

const root = process.cwd()
const outputDir = resolve(root, String(args.out))
await mkdir(outputDir, { recursive: true })
const skill = await readFile(resolve(root, '.github/skills/simulated-user-panel/SKILL.md'), 'utf8')
const fixtureData = JSON.parse(await readFile(resolve(root, '.github/skills/simulated-user-panel/evals/gold/consensus-fixtures.json'), 'utf8'))
const fixtures = fixtureData.fixtures.map(({ expected, ...fixture }) => fixture)
const expected = Object.fromEntries(fixtureData.fixtures.map((fixture) => [fixture.id, fixture.expected]))
const consensusSection = skill.match(/## Consensus and adjudication[\s\S]*?## Cross-critique/)?.[0] ?? skill

const prompt = `You are the routine GPT-5.6 Sol medium/default coordinator applying the simulated-user-panel consensus rules.

Rules:
${consensusSection}

Classify each synthetic fixture as exactly one of:
Strong, Moderate, Verified tier-restricted finding, Material Minority,
Contested, Weak or correlated, Rejected.

Primary evidence overrides votes. Repository conflicts invalidate a recommendation.
Return strict JSON only:
{
  "classifications": [
    {
      "id": "fixture id",
      "classification": "one allowed label",
      "reason": "brief rule-grounded reason"
    }
  ]
}

Fixtures:
${JSON.stringify(fixtures, null, 2)}`

const child = spawn('copilot', [
  '-C',
  outputDir,
  '-p',
  prompt,
  '--model',
  'gpt-5.6-luna',
  '--effort',
  'medium',
  '--context',
  'default',
  '--available-tools=fetch_copilot_cli_documentation',
  '--allow-all-tools',
  '--deny-tool=shell',
  '--deny-tool=write',
  '--deny-tool=url',
  '--disable-builtin-mcps',
  '--disable-mcp-server',
  'gmail',
  '--disable-mcp-server',
  'hass',
  '--disable-mcp-server',
  'playwright',
  '--disable-mcp-server',
  'unifi-network',
  '--disallow-temp-dir',
  '--no-ask-user',
  '--no-auto-update',
  '--no-custom-instructions',
  '--no-remote',
  '--no-remote-export',
  '--max-ai-credits',
  '30',
  '--secret-env-vars=VITE_HA_TOKEN,VITE_HA_URL',
  '--silent',
], {
  cwd: root,
  env: safeEnv(),
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
let stderr = ''
child.stdout.on('data', (chunk) => { stdout += chunk })
child.stderr.on('data', (chunk) => { stderr += chunk })
const exitCode = await new Promise((resolvePromise, reject) => {
  child.on('error', reject)
  child.on('exit', (code) => resolvePromise(code))
})
if (exitCode !== 0) throw new Error(`Consensus judge failed (${exitCode}): ${stderr}`)

const normalized = stdout.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
const parsed = JSON.parse(normalized)
const actual = Object.fromEntries(parsed.classifications.map((classification) => [classification.id, classification.classification]))
const comparisons = Object.entries(expected).map(([id, expectedLabel]) => ({
  actual: actual[id] ?? null,
  expected: expectedLabel,
  id,
  pass: actual[id] === expectedLabel,
}))
const result = {
  comparisons,
  output: parsed,
  pass: comparisons.every((comparison) => comparison.pass),
}
await writeFile(resolve(outputDir, 'consensus-gold-result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
if (!result.pass) process.exitCode = 1
