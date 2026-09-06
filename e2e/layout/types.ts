import type { ContextId, ScenarioId } from './contracts'

export interface SourceSnapshot {
  base: string
  head: string
  files: Record<string, string>
  digest: string
}

export interface Obligation {
  id: string
  scenario: ScenarioId
  state: string
  context: ContextId
  profile: string
  step: number
  review: boolean
}

export interface LayoutPlan {
  version: 1
  id: string
  root: string
  source: SourceSnapshot
  mode: 'focused' | 'full-known-mock' | 'non-layout' | 'tooling'
  changes: string[]
  reasons: string[]
  blockers: string[]
  scenarios: ScenarioId[]
  contexts: ContextId[]
  obligations: Obligation[]
  legacySpecs: string[]
  unitGates: string[]
  exclusions: Array<{ spec: string; reason: string }>
  deviceOnly: readonly string[]
}

export interface CollectedTest {
  id: string
  project: string
  file: string
  titlePath: string[]
  scenario?: string
}

export interface BuildIdentity {
  source: string
  root: string
  digest: string
  assets: Record<string, string>
  origin: string
  pid: number
  fixtureDigest: string
  serverNonce: string
}

export interface RunIdentity {
  version: 1
  runId: string
  root: string
  artifactRoot: string
  planId: string
  source: SourceSnapshot
  candidate: BuildIdentity
  baseline: BuildIdentity
  fixtureDigest: string
  startedAt: string
  collectionDigest?: string
  selectionDigest?: string
  unitEvidence?: { log: string; digest: string; gates: string[] }
  environment?: { node: string; platform: string; locale: string; timezone: string }
}

export interface Capabilities {
  browser: string
  version: string
  isMobile: boolean
  hasTouch: boolean
  fine: boolean
  coarse: boolean
  hover: boolean
  touchPoints: number
}

export interface Checkpoint {
  version: 1
  id: string
  runId: string
  planId: string
  sourceDigest: string
  buildDigest: string
  fixtureDigest: string
  testId: string
  scenario: ScenarioId
  state: string
  context: ContextId
  profile: string
  step: number
  capabilities: Capabilities
  viewport: { width: number; height: number }
  insets: { top: number; right: number; bottom: number; left: number }
  facts: Record<string, unknown>
  screenshot: string
  screenshotHash: string
  status: 'passed' | 'failed'
}

export interface ExecutionLedger {
  version: 1
  runId: string
  planId: string
  sourceDigest: string
  selected: CollectedTest[]
  attempts: Array<{
    testId: string
    expectedStatus: string
    status: string
    retry: number
    workerIndex: number
    annotations: Array<{ type: string; description?: string }>
    checkpoints: Checkpoint[]
  }>
  errors: string[]
  status: string
  complete: boolean
}

export interface ManualReview {
  checkpointId: string
  runId: string
  screenshotHash: string
  verdict: 'pass' | 'fail' | 'not-inspected' | 'access-unavailable'
  observation: string
  inspectedWith: string
  interaction: string
  factKeys: string[]
}

export interface ManualLedger {
  version: 1
  runId: string
  planId: string
  reviewer: string
  reviews: ManualReview[]
}
