import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const entries = {
  check: ['scripts/layout/plan.ts', '--check'],
  plan: ['scripts/layout/plan.ts'],
  run: ['scripts/layout/run.ts'],
  verify: ['scripts/layout/verify.ts'],
  review: ['scripts/layout/review.ts'],
}
const entry = entries[process.argv[2]]
if (!entry) throw new Error('Unknown layout command')
const root = process.cwd()
const scratch = resolve(root, '.cache/layout-runtime')
mkdirSync(scratch, { recursive: true })
const child = spawn(process.execPath, ['--import', 'tsx', ...entry, ...process.argv.slice(3)], {
  cwd: root,
  env: {
    ...process.env,
    TMPDIR: scratch, TMP: scratch, TEMP: scratch,
    NODE_COMPILE_CACHE: resolve(root, '.cache/node'),
    npm_config_cache: resolve(root, '.cache/npm'),
  },
  stdio: 'inherit',
})
child.once('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.once('exit', (code) => { process.exitCode = code ?? 1 })
process.once('SIGTERM', () => { child.kill('SIGTERM') })
process.once('SIGINT', () => { child.kill('SIGINT') })
