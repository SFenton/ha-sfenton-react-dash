import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import { hostname, networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const CERT_DIR = '.certs'
const CERT_PATH = join(CERT_DIR, 'localhost.pem')
const KEY_PATH = join(CERT_DIR, 'localhost-key.pem')

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function localSubjectAltNames() {
  const dnsNames = new Set(['localhost', hostname()])
  const ipAddresses = new Set(['127.0.0.1', '::1'])

  for (const interfaces of Object.values(networkInterfaces())) {
    for (const details of interfaces ?? []) {
      if (details.internal) continue
      dnsNames.add(hostname())
      ipAddresses.add(details.address.replace(/%.+$/, ''))
    }
  }

  return [
    ...[...dnsNames].filter(Boolean).map((name) => `DNS:${name}`),
    ...[...ipAddresses].filter(Boolean).map((address) => `IP:${address}`),
  ].join(',')
}

async function createCertificate() {
  await mkdir(CERT_DIR, { recursive: true })
  await execFileAsync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-sha256',
    '-days',
    '825',
    '-keyout',
    KEY_PATH,
    '-out',
    CERT_PATH,
    '-subj',
    '/CN=localhost',
    '-addext',
    `subjectAltName=${localSubjectAltNames()}`,
  ])
}

if ((await fileExists(CERT_PATH)) && (await fileExists(KEY_PATH))) {
  console.info(`Dev HTTPS certificate already exists at ${CERT_PATH}`)
} else {
  try {
    await createCertificate()
    console.info(`Created dev HTTPS certificate at ${CERT_PATH}`)
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error('OpenSSL is required to generate the dev HTTPS certificate.', { cause: error })
    }
    throw error
  }
}

console.info('Run npm run dev:https, then open the HTTPS Vite URL. Trust this certificate on mobile devices before testing camera access over LAN.')
