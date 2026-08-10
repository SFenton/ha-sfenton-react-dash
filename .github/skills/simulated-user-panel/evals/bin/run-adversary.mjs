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
if (!args.run) throw new Error('Usage: run-adversary.mjs --run <artifact-dir>')

const runDir = resolve(process.cwd(), String(args.run))
const outputDir = resolve(runDir, 'adversary')
await mkdir(outputDir, { recursive: true })
const summary = await readFile(resolve(runDir, 'qualitative-summary.json'), 'utf8')
const prompt = `You are the adversarial reviewer for a simulated usability panel.

Review the normalized participant output below. Find:
- false or correlated consensus;
- stereotype-driven or demographic capability claims;
- unsupported factual or numeric claims;
- severity inflation;
- scope drift;
- hidden assumptions;
- recommendations that conflict with repository rules;
- valuable minority findings that should not be suppressed.

Do not use tools or modify anything. Return strict JSON only:
{
  "issues": [
    {
      "type": "false-consensus|stereotype|unsupported|severity|scope|repository-conflict|other",
      "case_id": "case",
      "persona_id": "persona",
      "claim": "claim",
      "disposition": "reject|revise|preserve",
      "reason": "reason"
    }
  ],
  "preserve": ["valuable finding"],
  "overall_risk": "high|medium|low"
}

Panel output:
${summary}`

const child = spawn('copilot', [
  '-C',
  outputDir,
  '-p',
  prompt,
  '--model',
  'claude-opus-4.8',
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
  cwd: outputDir,
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
if (exitCode !== 0) throw new Error(`Adversary failed (${exitCode}): ${stderr}`)

const normalized = stdout.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
const parsed = JSON.parse(normalized)
await writeFile(resolve(outputDir, 'result.json'), `${JSON.stringify(parsed, null, 2)}\n`)
console.log(JSON.stringify({
  issues: parsed.issues?.length ?? 0,
  overallRisk: parsed.overall_risk,
  preserved: parsed.preserve?.length ?? 0,
}, null, 2))
