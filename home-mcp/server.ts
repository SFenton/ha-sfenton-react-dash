import { loadRuntimeEnvironment } from '../scripts/lib/runtimeEnv'
import { createHomeMcpServer } from './app'
import { readFileSync } from 'node:fs'

loadRuntimeEnvironment()

const port = Number(process.env.HOME_MCP_PORT ?? 8787)
const host = process.env.HOME_MCP_HOST ?? '127.0.0.1'
const hassUrl = process.env.HOME_MCP_HA_URL ?? process.env.VITE_HA_URL ?? 'https://homeassistant.sfenton-server.com'
const allowedOrigins = (process.env.HOME_MCP_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const tlsCertPath = process.env.HOME_MCP_TLS_CERT
const tlsKeyPath = process.env.HOME_MCP_TLS_KEY
if (Boolean(tlsCertPath) !== Boolean(tlsKeyPath)) throw new Error('HOME_MCP_TLS_CERT and HOME_MCP_TLS_KEY must be configured together')
const tls = tlsCertPath && tlsKeyPath
  ? { cert: readFileSync(tlsCertPath), key: readFileSync(tlsKeyPath) }
  : undefined

const server = createHomeMcpServer({
  hassUrl,
  allowedOrigins,
  tls,
})
server.listen(port, host, () => console.log(`Home MCP listening on ${tls ? 'https' : 'http'}://${host}:${port}`))
