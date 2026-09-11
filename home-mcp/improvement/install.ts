import { spawn } from 'node:child_process'
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto'
import { access, chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadRuntimeEnvironment } from '../../scripts/lib/runtimeEnv'

const REPOSITORY = 'SFenton/ha-sfenton-react-dash'
const MARKER_SUFFIX = '.home-mcp-improver'

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}`)))
  })
}

async function exists(path: string) {
  return access(path).then(() => true, () => false)
}

function safeSystemdValue(value: string) {
  if (!value || /[\r\n"]/.test(value)) throw new Error('Unsafe systemd value')
  return value
}

async function prepareRepository(repoRoot: string) {
  const markerPath = `${repoRoot}${MARKER_SUFFIX}`
  if (!(await exists(repoRoot))) {
    await mkdir(resolve(repoRoot, '..'), { recursive: true })
    await run('gh', ['repo', 'clone', REPOSITORY, repoRoot, '--', '--branch', 'master', '--single-branch'], process.cwd())
    await writeFile(markerPath, `${REPOSITORY}\n`, 'utf8')
  } else {
    if (!(await exists(markerPath))) throw new Error(`Refusing to manage ${repoRoot} without ${markerPath}`)
    const marker = (await readFile(markerPath, 'utf8')).trim()
    if (marker !== REPOSITORY) throw new Error(`Unexpected ${markerPath} owner`)
    await run('git', ['fetch', 'origin', 'master'], repoRoot)
    await run('git', ['switch', 'master'], repoRoot)
    await run('git', ['reset', '--hard', 'origin/master'], repoRoot)
  }

  await run('npm', ['ci'], repoRoot)
}

async function provisionTls(repoRoot: string, deployRoot: string, privateKeySource?: string) {
  const tlsRoot = join(deployRoot, 'tls')
  const certificateTarget = join(tlsRoot, 'server.crt')
  const privateKeyTarget = join(tlsRoot, 'server.key')
  await mkdir(tlsRoot, { recursive: true })
  await copyFile(
    join(repoRoot, 'home-assistant/custom_components/sfenton_home_mcp_proxy/home-mcp-server.crt'),
    certificateTarget,
  )
  if (!(await exists(privateKeyTarget))) {
    if (!privateKeySource) throw new Error(`HOME_MCP_TLS_KEY_SOURCE is required to provision ${privateKeyTarget}`)
    await copyFile(resolve(privateKeySource), privateKeyTarget)
    await chmod(privateKeyTarget, 0o600)
  }

  const certificate = new X509Certificate(await readFile(certificateTarget))
  const certificatePublicKey = certificate.publicKey.export({ type: 'spki', format: 'der' })
  const privatePublicKey = createPublicKey(createPrivateKey(await readFile(privateKeyTarget)))
    .export({ type: 'spki', format: 'der' })
  if (!certificatePublicKey.equals(privatePublicKey)) throw new Error('The Home MCP TLS certificate does not match the provisioned private key')
}

async function setComposeEnvironment(deployRoot: string, key: string, value: string) {
  const path = join(deployRoot, '.env')
  const existing = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? '' : Promise.reject(error))
  const lines = existing.split(/\r?\n/).filter(Boolean)
  const next = lines.filter((line) => !line.startsWith(`${key}=`))
  next.push(`${key}=${value}`)
  await writeFile(path, `${next.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })
}

export async function installImprovementWorker(options: {
  dataDir: string
  deployRoot: string
  repoRoot: string
  systemdRoot: string
  npmPath: string
  copilotPath: string
  privateKeySource?: string
  autoPublish?: boolean
}) {
  const dataDir = safeSystemdValue(resolve(options.dataDir))
  const deployRoot = safeSystemdValue(resolve(options.deployRoot))
  const repoRoot = safeSystemdValue(resolve(options.repoRoot))
  const npmPath = safeSystemdValue(options.npmPath)
  const copilotPath = safeSystemdValue(options.copilotPath)
  await mkdir(join(dataDir, 'inbox'), { recursive: true })
  await prepareRepository(repoRoot)
  await provisionTls(repoRoot, deployRoot, options.privateKeySource)
  await setComposeEnvironment(deployRoot, 'HOME_MCP_AUTO_PUBLISH', options.autoPublish === true ? 'true' : 'false')
  await mkdir(options.systemdRoot, { recursive: true })

  const units = improvementSystemdUnits({
    dataDir,
    deployRoot,
    repoRoot,
    npmPath,
    copilotPath,
    autoPublish: options.autoPublish === true,
  })
  await writeFile(join(options.systemdRoot, 'home-mcp-improver.service'), units.service, 'utf8')
  await writeFile(join(options.systemdRoot, 'home-mcp-improver.path'), units.path, 'utf8')
  await writeFile(join(options.systemdRoot, 'home-mcp-improver.timer'), units.timer, 'utf8')
  await run('systemctl', ['--user', 'daemon-reload'], process.cwd())
  await run('systemctl', ['--user', 'enable', '--now', 'home-mcp-improver.path', 'home-mcp-improver.timer'], process.cwd())
  await run('systemctl', ['--user', 'start', 'home-mcp-improver.service'], process.cwd())
}

export function improvementSystemdUnits(options: {
  dataDir: string
  deployRoot: string
  repoRoot: string
  npmPath: string
  copilotPath: string
  autoPublish?: boolean
}) {
  const { dataDir, deployRoot, repoRoot, npmPath, copilotPath } = options
  const service = `[Unit]
Description=Review queued Home MCP conversations
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=${repoRoot}
Environment=HOME=${homedir()}
Environment=PATH=${dirname(npmPath)}:${dirname(copilotPath)}:/usr/local/bin:/usr/bin:/bin
Environment=HOME_MCP_IMPROVEMENT_DATA_DIR=${dataDir}
Environment=HOME_MCP_IMPROVEMENT_REPO=${repoRoot}
Environment=HOME_MCP_DEPLOY_ROOT=${deployRoot}
Environment=HOME_MCP_AUTO_PUBLISH=${options.autoPublish === true ? 'true' : 'false'}
Environment=HOME_MCP_IMPROVEMENT_MODEL=gpt-5.6-sol
Environment=COPILOT_CLI_PATH=${copilotPath}
ExecStartPre=/usr/bin/git -C ${repoRoot} fetch origin master
ExecStartPre=/usr/bin/git -C ${repoRoot} switch master
ExecStartPre=/usr/bin/git -C ${repoRoot} reset --hard origin/master
ExecStart=${npmPath} run home-mcp:improvements:worker -- --once
TimeoutStartSec=2h
Nice=10
`
  const pathUnit = `[Unit]
Description=Watch the Home MCP conversation improvement queue

[Path]
PathChanged=${join(dataDir, 'inbox')}
Unit=home-mcp-improver.service

[Install]
WantedBy=default.target
`
  const timer = `[Unit]
Description=Retry the Home MCP conversation improvement queue

[Timer]
OnBootSec=2m
OnUnitActiveSec=5m
Unit=home-mcp-improver.service
Persistent=true

[Install]
WantedBy=timers.target
`
  return { service, path: pathUnit, timer }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  loadRuntimeEnvironment()
  const deployRoot = process.env.HOME_MCP_DEPLOY_ROOT ?? '/home/sfenton/Docker/home-mcp'
  await installImprovementWorker({
    dataDir: process.env.HOME_MCP_IMPROVEMENT_DATA_DIR ?? join(deployRoot, 'data'),
    deployRoot,
    repoRoot: process.env.HOME_MCP_IMPROVEMENT_REPO ?? join(deployRoot, 'improver-repo'),
    systemdRoot: process.env.HOME_MCP_SYSTEMD_ROOT ?? join(homedir(), '.config/systemd/user'),
    npmPath: process.env.HOME_MCP_NPM_PATH ?? join(homedir(), '.local/bin/npm'),
    copilotPath: process.env.COPILOT_CLI_PATH ?? join(homedir(), '.local/bin/copilot'),
    privateKeySource: process.env.HOME_MCP_TLS_KEY_SOURCE,
    autoPublish: process.env.HOME_MCP_AUTO_PUBLISH === 'true',
  })
  console.log('Installed the Home MCP improvement queue worker.')
}
