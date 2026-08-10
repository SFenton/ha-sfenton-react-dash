import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
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
if (!args.run) throw new Error('Usage: run-blind-judge.mjs --run <artifact-dir>')

const runDir = resolve(process.cwd(), String(args.run))
const inputName = String(args.input ?? 'persona-blind-settings.json')
const outputName = String(args.output ?? 'persona-blind-judge.json')
const blind = await readFile(resolve(runDir, inputName), 'utf8')
const prompt = `You are a blind evaluator.

The JSON data below contains nine anonymized reports from the same Settings task.
Assign each report to exactly one persona id, using every id exactly once:
young-novice, tech-teen, ha-engineer, cautious-elder, visual-texter,
ux-designer, occasional-partner, power-user, accessibility-auditor.

Base assignments on action priorities and finding topics, not writing style,
response length, or demographic stereotypes. Return strict JSON only:
{
  "assignments": [
    {
      "id": "R01",
      "persona_id": "one persona id",
      "confidence": "high|medium|low",
      "evidence_topics": ["topic"]
    }
  ],
  "overall_identifiability": 0.0,
  "confusable_pairs": [["persona-a", "persona-b"]]
}

Do not use tools.

Reports:
${blind}`

const child = spawn('copilot', [
  '-C',
  runDir,
  '-p',
  prompt,
  '--model',
  'gemini-3.1-pro-preview',
  '--effort',
  'high',
  '--context',
  'long_context',
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
  cwd: runDir,
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
if (exitCode !== 0) throw new Error(`Blind judge failed (${exitCode}): ${stderr}`)

await writeFile(resolve(runDir, outputName), `${stdout.trim()}\n`)
console.log(stdout.trim())
