import { access, constants, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import chalk from 'chalk'
import { Client } from 'node-scp'
import prompts from 'prompts'
import { loadRuntimeEnvironment } from './lib/runtimeEnv'
import { resolveDeploymentVersion } from './lib/dashboardDeployment'
import { syncDashboardDeployment } from './sync-dashboard-deployment'

loadRuntimeEnvironment()

const HA_URL = process.env.VITE_HA_URL
const HA_TOKEN = process.env.VITE_HA_TOKEN
const USERNAME = process.env.VITE_SSH_USERNAME || 'root'
const PASSWORD = process.env.VITE_SSH_PASSWORD
const HOST_OR_IP_ADDRESS = process.env.VITE_SSH_HOSTNAME || '192.168.1.22'
const PRIVATE_KEY_PATH = resolve(process.env.VITE_SSH_PRIVATE_KEY || join(homedir(), '.ssh/ha-sfenton-react-dash-deploy'))
const PORT = Number(process.env.VITE_SSH_PORT || 22)
const REMOTE_FOLDER_NAME = process.env.VITE_FOLDER_NAME
const LOCAL_DIRECTORY = './dist'
const PANEL_PACKAGE_PATH = resolve('home-assistant/packages/sfenton_react_panel.yaml')
const CHAT_COMPONENT_FILES = ['__init__.py', 'manifest.json', 'services.yaml', 'retention.py', 'README.md']
const HOME_MCP_PROXY_PATHS = [
  'packages/sfenton_home_mcp_proxy.yaml',
  'custom_components/sfenton_home_mcp_proxy/__init__.py',
  'custom_components/sfenton_home_mcp_proxy/home-mcp-server.crt',
  'custom_components/sfenton_home_mcp_proxy/manifest.json',
]
const REMOTE_PATH = `/www/${REMOTE_FOLDER_NAME}`
const AUTO_CONFIRM = process.argv.includes('--yes')

async function confirmDeploymentWithHaToken() {
  if (!HA_TOKEN || AUTO_CONFIRM) {
    return
  }

  const response = (await prompts({
    type: 'confirm',
    name: 'value',
    message: chalk.yellow(
      'WARN: You are about to deploy to Home Assistant with VITE_HA_TOKEN set in .env. Continue?',
    ),
    initial: true,
  })) as { value: boolean }

  if (response.value !== true) {
    process.exit()
  }
}

async function checkDirectoryExists() {
  try {
    await access(LOCAL_DIRECTORY, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function deploy() {
  if (!HA_URL) throw new Error('Missing VITE_HA_URL in .env or .env.development.')
  if (!HA_TOKEN) throw new Error('Missing VITE_HA_TOKEN in .env or .env.development.')
  if (!REMOTE_FOLDER_NAME) throw new Error('Missing VITE_FOLDER_NAME in .env or .env.development.')
  if (!PASSWORD && !(await access(PRIVATE_KEY_PATH, constants.R_OK).then(() => true, () => false))) {
    throw new Error('Configure VITE_SSH_PASSWORD or VITE_SSH_PRIVATE_KEY for SSH deployment.')
  }

  const exists = await checkDirectoryExists()
  if (!exists) {
    throw new Error('Missing ./dist directory, have you run `npm run build`?')
  }

  const privateKey = PASSWORD ? undefined : await readFile(PRIVATE_KEY_PATH)
  const client = await Client({
    host: HOST_OR_IP_ADDRESS,
    port: PORT,
    username: USERNAME,
    password: PASSWORD,
    privateKey,
  })

  try {
    const configRoot = await findConfigRoot(client)
    const remote = `${configRoot}${REMOTE_PATH}`
    const remotePackage = `${configRoot}/packages/sfenton_react_panel.yaml`
    const packageContent = await readFile(PANEL_PACKAGE_PATH)
    const currentPackage = await readRemoteFile(client, remotePackage)
    const packageChanged = !currentPackage?.equals(packageContent)
    const chatPaths = [
      'packages/sfenton_react_chat.yaml',
      ...CHAT_COMPONENT_FILES.map((file) => `custom_components/sfenton_react_chat/${file}`),
    ]
    const managedPaths = [...chatPaths, ...HOME_MCP_PROXY_PATHS]
    const changedConfig = []
    if (packageChanged) changedConfig.push({ path: remotePackage, content: packageContent, previous: currentPackage })
    for (const path of managedPaths) {
      const content = await readFile(resolve('home-assistant', path))
      const previous = await readRemoteFile(client, `${configRoot}/${path}`)
      if (!previous?.equals(content)) changedConfig.push({ path: `${configRoot}/${path}`, content, previous })
    }
    const chatChanged = changedConfig.some((file) => chatPaths.some((path) => file.path.endsWith(`/${path}`)))
    const homeMcpProxyChanged = changedConfig.some((file) => HOME_MCP_PROXY_PATHS.some((path) => file.path.endsWith(`/${path}`)))

    if (changedConfig.length) {
      await client.mkdir(`${configRoot}/packages`, undefined, { recursive: true })
      await client.mkdir(`${configRoot}/custom_components/sfenton_react_chat`, undefined, { recursive: true })
      await client.mkdir(`${configRoot}/custom_components/sfenton_home_mcp_proxy`, undefined, { recursive: true })
      for (const file of changedConfig) {
        if (file.previous) await client.writeFile(`${file.path}.bak`, file.previous)
      }
      try {
        for (const file of changedConfig) await client.writeFile(file.path, file.content)
        await validateHomeAssistantConfig()
      } catch (error) {
        const failures: unknown[] = [error]
        for (const file of [...changedConfig].reverse()) {
          try {
            if (file.previous) await client.writeFile(file.path, file.previous)
            else if (await client.exists(file.path)) await client.unlink(file.path)
          } catch (restoreError) {
            failures.push(restoreError)
          }
        }
        if (failures.length > 1) throw new AggregateError(failures, 'Configuration staging failed and rollback was incomplete; restore the .bak files before restarting HA.', { cause: error })
        throw error
      }
      console.info(chalk.green('\nHome Assistant package/component files were staged and configuration-checked.'))
      if (packageChanged) console.info(chalk.yellow('Restart Home Assistant with approval before deploying the React assets.'))
      if (chatChanged) console.info(chalk.yellow('Restart Home Assistant with approval, then verify the prior daily chat purge automation is absent.'))
      if (homeMcpProxyChanged) console.info(chalk.yellow('Restart Home Assistant with approval, then verify /api/sfenton_home_mcp before enabling Home MCP in the production build.'))
      console.info(chalk.yellow('React assets were not uploaded. Rerun deployment after the required restart and proxy verification.'))
      process.exitCode = 2
      return
    }

    if (await client.exists(remote)) await client.rmdir(remote)
    console.info(chalk.blue('Uploading', `"${LOCAL_DIRECTORY}"`, 'to', `"${remote}"`))
    await client.uploadDir(LOCAL_DIRECTORY, remote)

    const version = await resolveDeploymentVersion()
    const syncResult = await syncDashboardDeployment({
      haToken: HA_TOKEN,
      haUrl: HA_URL,
      requirePanel: !packageChanged,
      version,
    })

    console.info(chalk.green(packageChanged
      ? '\nReact assets and the existing dashboard were deployed; the new panel config is staged.'
      : '\nSuccessfully deployed both React dashboard hosts.'))
    console.info(chalk.blue(new URL(`/local/${REMOTE_FOLDER_NAME}/index.html`, HA_URL).href))
    console.info(chalk.blue(new URL('/sfenton-react-dash/home', HA_URL).href))
    console.info(chalk.blue(new URL('/sfenton-react-panel', HA_URL).href))
    console.info(chalk.blue(`Legacy wrapper URL: ${syncResult.legacyDashboardUrl}`))
    console.info(chalk.yellow('Chat history and Home MCP proxy files already match the validated Home Assistant configuration.'))
  } finally {
    client.close()
  }
}

async function findConfigRoot(client: Awaited<ReturnType<typeof Client>>) {
  for (const directory of ['/config', '/homeassistant']) {
    if (await client.exists(directory)) return directory
  }
  throw new Error('Could not find a config/homeassistant directory in the Home Assistant installation root.')
}

async function readRemoteFile(client: Awaited<ReturnType<typeof Client>>, remotePath: string) {
  if (!(await client.exists(remotePath))) return undefined
  return client.readFile(remotePath)
}

async function validateHomeAssistantConfig() {
  const response = await fetch(new URL('/api/config/core/check_config', HA_URL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Home Assistant config validation failed with HTTP ${response.status}.`)
  }

  const result = await response.json() as { errors?: unknown; result?: unknown }
  if (result.result !== 'valid') {
    throw new Error(`Home Assistant rejected the staged configuration: ${String(result.errors || 'unknown validation error')}`)
  }
}

await confirmDeploymentWithHaToken()
deploy().catch((error: unknown) => {
  console.error(chalk.red('Error:', error instanceof Error ? error.message : String(error)))
  process.exitCode = 1
})