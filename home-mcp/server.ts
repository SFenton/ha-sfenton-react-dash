import { loadRuntimeEnvironment } from '../scripts/lib/runtimeEnv'
import { createHomeMcpServer } from './app'
import { ConversationImprovementStore } from './improvement/store'
import { readFileSync } from 'node:fs'

loadRuntimeEnvironment()

const port = Number(process.env.HOME_MCP_PORT ?? 8787)
const host = process.env.HOME_MCP_HOST ?? '127.0.0.1'
const hassUrl = process.env.HOME_MCP_HA_URL ?? process.env.VITE_HA_URL ?? 'https://homeassistant.sfenton-server.com'
const agentId = process.env.HOME_MCP_AGENT_ID || undefined
const allowedOrigins = (process.env.HOME_MCP_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const improvementDataDir = process.env.HOME_MCP_IMPROVEMENT_DATA_DIR
const improvementStore = new ConversationImprovementStore({
  root: improvementDataDir,
  enabled: process.env.HOME_MCP_IMPROVEMENT_ENABLED === 'true' && Boolean(improvementDataDir),
  autoPublish: process.env.HOME_MCP_AUTO_PUBLISH === 'true',
  quietMs: Number(process.env.HOME_MCP_IMPROVEMENT_QUIET_MS ?? 5 * 60_000),
})
const tlsCertPath = process.env.HOME_MCP_TLS_CERT
const tlsKeyPath = process.env.HOME_MCP_TLS_KEY
if (Boolean(tlsCertPath) !== Boolean(tlsKeyPath)) throw new Error('HOME_MCP_TLS_CERT and HOME_MCP_TLS_KEY must be configured together')
const tls = tlsCertPath && tlsKeyPath
  ? { cert: readFileSync(tlsCertPath), key: readFileSync(tlsKeyPath) }
  : undefined

const server = createHomeMcpServer({
  hassUrl,
  agentId,
  allowedOrigins,
  chatModel: process.env.HOME_MCP_CHAT_MODEL ?? 'Gemini 3.1 Flash Lite',
  improvementStore,
  tls,
})
let improvementSweepTask = Promise.resolve()
const sweepImprovements = () => {
  improvementSweepTask = improvementSweepTask
    .then(() => improvementStore.queueIdleConversations())
    .then(() => undefined)
    .catch((error) => console.error('Home MCP improvement queue sweep failed:', error instanceof Error ? error.message : error))
}
const improvementSweep = improvementStore.enabled
  ? setInterval(sweepImprovements, 60_000)
  : undefined
improvementSweep?.unref()
if (improvementStore.enabled) sweepImprovements()
server.on('close', () => {
  if (improvementSweep) clearInterval(improvementSweep)
})
server.listen(port, host, () => console.log(`Home MCP listening on ${tls ? 'https' : 'http'}://${host}:${port}`))
