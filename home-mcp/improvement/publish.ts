import { spawn } from 'node:child_process'
import { get as httpsGet } from 'node:https'
import { get as httpGet } from 'node:http'
import { cp, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

interface HomeMcpMetadata {
  serverVersion: string
}

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}`)))
  })
}

async function pathKind(path: string) {
  try {
    const stat = await lstat(path)
    return stat.isSymbolicLink() ? 'symlink' as const : stat.isDirectory() ? 'directory' as const : 'file' as const
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function switchSourceLink(deployRoot: string, releaseDirectory: string) {
  const sourcePath = join(deployRoot, 'source')
  const kind = await pathKind(sourcePath)
  const previousLink = kind === 'symlink' ? await readlink(sourcePath) : null
  const migratedDirectory = kind === 'directory' ? join(deployRoot, `source.pre-managed-${Date.now()}`) : null
  const temporaryLink = join(deployRoot, `.source-${process.pid}-${Date.now()}`)
  try {
    if (migratedDirectory) await rename(sourcePath, migratedDirectory)
    else if (kind === 'file') throw new Error(`Expected ${sourcePath} to be absent, a directory, or a symlink`)
    await symlink(relative(deployRoot, releaseDirectory), temporaryLink)
    await rename(temporaryLink, sourcePath)
    return { previousLink, migratedDirectory }
  } catch (error) {
    await rm(temporaryLink, { force: true })
    if (migratedDirectory && await pathKind(migratedDirectory) && !(await pathKind(sourcePath))) {
      await rename(migratedDirectory, sourcePath)
    }
    throw error
  }
}

export async function restoreSourceLink(deployRoot: string, previous: { previousLink: string | null; migratedDirectory: string | null }) {
  const sourcePath = join(deployRoot, 'source')
  await rm(sourcePath, { force: true })
  if (previous.previousLink) await symlink(previous.previousLink, sourcePath)
  else if (previous.migratedDirectory) await rename(previous.migratedDirectory, sourcePath)
}

interface HealthReceipt {
  protocol: 'http' | 'https'
  version: string
}

async function readHealth(protocol: HealthReceipt['protocol'], certificatePath: string, host: string) {
  const get = protocol === 'https' ? httpsGet : httpGet
  const certificate = protocol === 'https' ? await readFile(certificatePath) : undefined
  return new Promise<HealthReceipt>((resolvePromise, reject) => {
    const request = get({
      host,
      port: 8787,
      path: '/health',
      ...(certificate ? { ca: certificate } : {}),
    }, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try {
          const health = JSON.parse(body) as { ok?: boolean; version?: string }
          if (response.statusCode === 200 && health.ok && typeof health.version === 'string') {
            resolvePromise({ protocol, version: health.version })
          } else reject(new Error(`Home MCP returned ${response.statusCode ?? 'no status'}`))
        } catch {
          reject(new Error('Home MCP returned invalid health data'))
        }
      })
    })
    request.setTimeout(5_000, () => request.destroy(new Error('Home MCP health request timed out')))
    request.on('error', reject)
  })
}

async function currentHealth(certificatePath: string, host: string) {
  return readHealth('https', certificatePath, host).catch(() => readHealth('http', certificatePath, host).catch(() => null))
}

async function waitForVersion(expectedVersion: string, protocol: HealthReceipt['protocol'], certificatePath: string, host: string) {
  let lastError = 'Home MCP did not answer'
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const health = await readHealth(protocol, certificatePath, host)
      if (health.version === expectedVersion) return
      lastError = `Home MCP reported version ${health.version}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Home MCP health check failed'
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000))
  }
  throw new Error(`${lastError}; expected ${expectedVersion}`)
}

export async function publishHomeMcp(sourceRoot: string, deployRoot: string) {
  const root = resolve(sourceRoot)
  const target = resolve(deployRoot)
  if (root === target || !basename(target).includes('home-mcp')) throw new Error('Refusing an unsafe Home MCP deployment root')
  const metadata = JSON.parse(await readFile(join(root, 'home-mcp/metadata.json'), 'utf8')) as HomeMcpMetadata
  const revision = await new Promise<string>((resolvePromise, reject) => {
    const child = spawn('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolvePromise(output.trim()) : reject(new Error('Could not resolve the Home MCP revision')))
  })
  const releasesRoot = join(target, 'releases')
  const releaseDirectory = join(releasesRoot, `${metadata.serverVersion}-${revision}`)
  await mkdir(releaseDirectory, { recursive: true })
  await cp(join(root, 'home-mcp'), join(releaseDirectory, 'home-mcp'), { recursive: true })
  await cp(join(root, 'package.json'), join(releaseDirectory, 'package.json'))
  await cp(join(root, 'package-lock.json'), join(releaseDirectory, 'package-lock.json'))
  await mkdir(join(releaseDirectory, 'scripts/lib'), { recursive: true })
  await cp(join(root, 'scripts/lib/runtimeEnv.ts'), join(releaseDirectory, 'scripts/lib/runtimeEnv.ts'))
  await mkdir(join(target, 'data'), { recursive: true })

  const composePath = join(target, 'docker-compose.yml')
  const certificatePath = join(target, 'tls/server.crt')
  const privateKeyPath = join(target, 'tls/server.key')
  const healthHost = process.env.HOME_MCP_PUBLISH_HEALTH_HOST || '192.168.1.155'
  if (!(await pathKind(certificatePath)) || !(await pathKind(privateKeyPath))) {
    throw new Error(`Provision ${certificatePath} and ${privateKeyPath} before publishing Home MCP`)
  }
  const previousHealth = await currentHealth(certificatePath, healthHost)
  const previousCompose = await readFile(composePath, 'utf8').catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? null : Promise.reject(error))
  let previousSource: Awaited<ReturnType<typeof switchSourceLink>> | null = null
  try {
    await writeFile(composePath, await readFile(join(root, 'home-mcp/docker-compose.production.yml'), 'utf8'), 'utf8')
    previousSource = await switchSourceLink(target, releaseDirectory)
    await run('docker', ['compose', 'up', '-d', '--build', '--force-recreate'], target)
    await waitForVersion(metadata.serverVersion, 'https', certificatePath, healthHost)
  } catch (error) {
    const rollbackErrors: unknown[] = []
    if (previousSource) {
      try { await restoreSourceLink(target, previousSource) } catch (rollbackError) { rollbackErrors.push(rollbackError) }
    }
    try {
      if (previousCompose === null) await rm(composePath, { force: true })
      else await writeFile(composePath, previousCompose, 'utf8')
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
    if (previousHealth && previousSource && previousCompose !== null) {
      try {
        await run('docker', ['compose', 'up', '-d', '--build', '--force-recreate'], target)
        await waitForVersion(previousHealth.version, previousHealth.protocol, certificatePath, healthHost)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], 'Home MCP publish failed and rollback did not restore a healthy prior version', { cause: error })
    throw error
  }
  return { version: metadata.serverVersion, revision, releaseDirectory }
}

const sourceIndex = process.argv.indexOf('--source')
const deployIndex = process.argv.indexOf('--deploy-root')
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const sourceRoot = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : process.cwd()
  const deployRoot = deployIndex >= 0 ? process.argv[deployIndex + 1] : process.env.HOME_MCP_DEPLOY_ROOT ?? '/home/sfenton/Docker/home-mcp'
  const result = await publishHomeMcp(sourceRoot, deployRoot)
  console.log(`Published Home MCP ${result.version} from ${result.revision}.`)
}
