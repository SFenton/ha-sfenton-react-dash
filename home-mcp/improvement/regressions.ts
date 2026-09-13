import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { HOUSE_LIGHT_ROOMS } from '../lights-config'
import { validateLightPlanForExecution } from '../app'
import { parseLightUtterance } from '../light-skill'
import { improvementTextNeedsRedaction } from './scope'
import {
  IMPROVEMENT_SCHEMA_VERSION,
  type ExpectedLightOperation,
  type ImprovementAnalysis,
  type ImprovementJob,
  type LightRegressionFixture,
} from './types'

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function regressionPrivacySafe(value: unknown): boolean {
  if (typeof value === 'string') return !improvementTextNeedsRedaction(value)
  if (Array.isArray(value)) return value.every(regressionPrivacySafe)
  if (value && typeof value === 'object') return Object.values(value).every(regressionPrivacySafe)
  return true
}

function operationMatches(actual: {
  action: string
  room: { id: string }
  entityIds: string[]
  lightNames: string[]
  brightnessPct: number | number[] | null
  rgbColor: [number, number, number] | null
  colorName: string | null
  colorTemperatureKelvin: number | null
  historyBefore: string | null
  targetState: 'on' | 'off' | null
}, expected: ExpectedLightOperation) {
  const room = HOUSE_LIGHT_ROOMS.find((candidate) => candidate.id === expected.roomId)
  const expectedEntityIds = expected.lightNames.map((name) => room?.lights.find((light) => light.name === name)?.entityId)
  return actual.action === expected.action
    && actual.room.id === expected.roomId
    && expectedEntityIds.every((id) => Boolean(id))
    && sameValue(actual.entityIds, expectedEntityIds)
    && sameValue(actual.lightNames, expected.lightNames)
    && sameValue(actual.brightnessPct, expected.brightnessPct)
    && sameValue(actual.rgbColor, expected.rgbColor)
    && actual.colorName === expected.colorName
    && actual.colorTemperatureKelvin === expected.colorTemperatureKelvin
    && actual.historyBefore === expected.historyBefore
    && actual.targetState === expected.targetState
}

export function fixtureFromAnalysis(job: ImprovementJob, analysis: ImprovementAnalysis): LightRegressionFixture {
  const fixture: LightRegressionFixture = {
    version: IMPROVEMENT_SCHEMA_VERSION,
    id: `conversation-${job.id.slice(0, 16)}`,
    conversationHash: job.conversationHash,
    coveredPaths: ['home-mcp/light-skill.ts'],
    summary: analysis.inferredIntent.slice(0, 180),
    turns: analysis.regressions.map((regression) => {
      const turn = job.conversation?.turns[regression.turnIndex]
      if (!turn) throw new Error(`Regression turn ${regression.turnIndex} does not exist`)
      return regression
    }),
  }
  if (!regressionPrivacySafe({ summary: fixture.summary, turns: fixture.turns })) {
    throw new Error('Regression fixture contains private or credential-like text')
  }
  return fixture
}

export function validateRegressionFixture(fixture: LightRegressionFixture) {
  const errors: string[] = []
  if (!regressionPrivacySafe({ summary: fixture.summary, turns: fixture.turns })) {
    errors.push('fixture contains private or credential-like text')
  }
  for (const expected of fixture.turns) {
    const actual = parseLightUtterance(expected.input, expected.context)
    if (!actual) {
      errors.push(`turn ${expected.turnIndex}: parser returned unsupported`)
      continue
    }
    if (actual.status !== expected.status) errors.push(`turn ${expected.turnIndex}: expected status ${expected.status}, got ${actual.status}`)
    if (actual.status === 'ready' && validateLightPlanForExecution(actual).status !== 'ready') {
      errors.push(`turn ${expected.turnIndex}: parser plan is rejected by runtime execution policy`)
    }
    const controlKinds = actual.controls.map((control) => control.kind)
    if (!sameValue(controlKinds, expected.controlKinds)) {
      errors.push(`turn ${expected.turnIndex}: expected controls ${expected.controlKinds.join(',')}, got ${controlKinds.join(',')}`)
    }
    const operations = actual.operations ?? []
    if (operations.length !== expected.operations.length) {
      errors.push(`turn ${expected.turnIndex}: expected ${expected.operations.length} operations, got ${operations.length}`)
    } else {
      operations.forEach((operation, index) => {
        if (!operationMatches(operation, expected.operations[index])) errors.push(`turn ${expected.turnIndex}: operation ${index + 1} did not match`)
      })
    }
    for (const text of expected.textIncludes) {
      if (!actual.text.toLowerCase().includes(text.toLowerCase())) errors.push(`turn ${expected.turnIndex}: response did not include "${text}"`)
    }
  }
  return errors
}

export async function writeRegressionFixture(root: string, job: ImprovementJob, analysis: ImprovementAnalysis) {
  const directory = resolve(root, 'home-mcp/improvement/regressions')
  await mkdir(directory, { recursive: true })
  const fixture = fixtureFromAnalysis(job, analysis)
  const path = join(directory, `${fixture.id}.json`)
  await writeFile(path, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8')
  return path
}

export async function validateRegressionDirectory(root: string) {
  const directory = resolve(root, 'home-mcp/improvement/regressions')
  let files: string[] = []
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const failures: string[] = []
  for (const file of files) {
    const fixture = JSON.parse(await readFile(join(directory, file), 'utf8')) as LightRegressionFixture
    for (const error of validateRegressionFixture(fixture)) failures.push(`${file}: ${error}`)
  }
  return { files: files.length, failures }
}
