import type { LightAction, LightContext } from '../light-skill'

export const IMPROVEMENT_SCHEMA_VERSION = 1
export const MAX_IMPROVEMENT_TURNS = 100
export const MAX_IMPROVEMENT_ASSISTANT_CHARS = 2_000

export type ConversationTurnOutcome = 'answer' | 'error' | 'empty' | 'failed'

export interface ImprovementConversationTurn {
  id: string
  createdAt: number
  userText: string
  assistantText: string | null
  outcome: ConversationTurnOutcome
  parsedAsLights: boolean
  handledByHomeMcp: boolean
  contextBefore: LightContext | null
  contextAfter: LightContext | null
}

export interface ImprovementConversation {
  version: typeof IMPROVEMENT_SCHEMA_VERSION
  threadId: string
  userScope: string
  createdAt: number
  updatedAt: number
  turns: ImprovementConversationTurn[]
}

export interface ImprovementJob {
  version: typeof IMPROVEMENT_SCHEMA_VERSION
  id: string
  conversationHash: string
  enqueuedAt: number
  attempts: number
  notBefore?: number
  claimedAt?: number
  stage: 'queued' | 'analyzed' | 'pr-open' | 'merged' | 'published'
  source: 'runtime' | 'history'
  conversation?: ImprovementConversation
  routingVerification?: {
    version: typeof IMPROVEMENT_SCHEMA_VERSION
    conversationHash: string
    verifiedAt: string
  }
  analysis?: ImprovementAnalysis
  branch?: string
  headCommit?: string
  releaseVersion?: string
  pr?: number
  mergeCommit?: string
}

export interface ExpectedLightOperation {
  action: LightAction
  roomId: string
  lightNames: string[]
  brightnessPct: number | number[] | null
  rgbColor: [number, number, number] | null
  colorName: string | null
  colorTemperatureKelvin: number | null
  historyBefore: string | null
  targetState: 'on' | 'off' | null
}

export interface ExpectedLightTurn {
  turnIndex: number
  input: string
  context: LightContext | null
  status: 'ready' | 'clarify' | 'unsupported'
  operations: ExpectedLightOperation[]
  controlKinds: Array<'room-picker' | 'color-picker' | 'brightness-slider' | 'suggestions'>
  textIncludes: string[]
}

export interface LightRegressionFixture {
  version: typeof IMPROVEMENT_SCHEMA_VERSION
  id: string
  conversationHash: string
  coveredPaths: ['home-mcp/light-skill.ts']
  summary: string
  turns: ExpectedLightTurn[]
}

export interface ImprovementAnalysis {
  version: typeof IMPROVEMENT_SCHEMA_VERSION
  outcome: 'met-needs' | 'needs-improvement'
  inferredIntent: string
  issues: string[]
  summary: string[]
  regressions: ExpectedLightTurn[]
}

export interface ImprovementRecord {
  version: string
  publishedAt: string
  summary: string[]
}

export interface HomeMcpMetadata {
  serverVersion: string
  improvements: ImprovementRecord[]
}

export interface ImprovementWorkerStatus {
  state: 'idle' | 'processing' | 'error'
  jobId: string | null
  updatedAt: string
  message: string | null
}

export interface ImprovementQueueStatus {
  enabled: boolean
  autoPublish: boolean
  pending: number
  processing: boolean
  lastError: string | null
}

export interface HomeMcpInfo {
  chatModel: string
  mcpVersion: string
  supportedTools: ['lights']
  queue: ImprovementQueueStatus
  improvements: ImprovementRecord[]
}
