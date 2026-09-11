import { parseImprovementAnalysis } from './copilot'
import type { ImprovementJob } from './types'

const job: ImprovementJob = {
  version: 1,
  id: 'abc',
  conversationHash: 'abc',
  enqueuedAt: 1,
  attempts: 0,
  stage: 'queued',
  source: 'runtime',
  conversation: {
    version: 1,
    threadId: 'thread-one',
    userScope: 'user-one',
    createdAt: 1,
    updatedAt: 2,
    turns: [{
      id: 'turn-one',
      createdAt: 2,
      userText: 'Make the lounge lamps brighter.',
      assistantText: 'Which room?',
      outcome: 'answer',
      parsedAsLights: true,
      contextBefore: null,
      contextAfter: { domain: 'lights', roomId: null, entityIds: [], lightNames: [] },
    }],
  },
}

const operation = (overrides: Record<string, unknown> = {}) => ({
  action: 'up',
  roomId: 'living-room',
  lightNames: [],
  brightnessPct: null,
  rgbColor: null,
  colorName: null,
  colorTemperatureKelvin: null,
  historyBefore: null,
  targetState: null,
  ...overrides,
})

describe('Copilot improvement analysis', () => {
  it('accepts a bounded unmet-intent contract', () => {
    const result = parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Raise the Living Room lights by ten percent.',
      issues: ['The assistant asked for a room even though lounge identifies it.'],
      summary: ['Alice can now ask for brighter room lights.'],
      regressions: [{
        turnIndex: 0,
        input: 'Brighten the lounge lights.',
        context: null,
        status: 'ready',
        operations: [operation()],
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)

    expect(result.outcome).toBe('needs-improvement')
    expect(result.regressions[0].operations[0]).toMatchObject({ action: 'up', roomId: 'living-room' })
    expect(result.inferredIntent).not.toContain('Alice')
    expect(result.summary.join(' ')).not.toContain('Alice')
  })

  it('rejects an unmet analysis without a regression fixture', () => {
    expect(() => parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Raise the lights.',
      issues: ['No action was taken.'],
      summary: ['Understands another brightness request.'],
      regressions: [],
    }), job)).toThrow(/requires a regression fixture/)
  })

  it('rejects a ready regression without an executable operation', () => {
    expect(() => parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Raise the Living Room lights.',
      issues: ['The assistant missed the requested light action.'],
      summary: ['Understands another brightness request.'],
      regressions: [{
        turnIndex: 0,
        input: 'Brighten the lounge lights.',
        context: null,
        status: 'ready',
        operations: [],
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)).toThrow(/ready regressions require operations/)
  })

  it('rejects private or transcript-derived regression fields', () => {
    const analysis = {
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Raise the Living Room lights.',
      issues: ['The assistant missed the requested light action.'],
      summary: ['Understands another brightness request.'],
      regressions: [{
        turnIndex: 0,
        input: 'Brighten the lounge lights.',
        context: null,
        status: 'ready',
        operations: [operation()],
        controlKinds: [],
        textIncludes: ['private medical appointment'],
      }],
    }
    expect(() => parseImprovementAnalysis(JSON.stringify(analysis), job)).toThrow(/textIncludes must remain empty/)
    expect(() => parseImprovementAnalysis(JSON.stringify({
      ...analysis,
      regressions: [{ ...analysis.regressions[0], input: 'Brighten the lounge lights before my medical appointment.', textIncludes: [] }],
    }), job)).toThrow(/invalid regression turn/)
    expect(() => parseImprovementAnalysis(JSON.stringify({
      ...analysis,
      regressions: [{ ...analysis.regressions[0], input: 'Brighten the lounge lights to 5551234567 percent.', textIncludes: [] }],
    }), job)).toThrow(/invalid regression turn/)
  })

  it('rejects unknown rooms and fixture names in expected operations', () => {
    const analysis = {
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Raise the Living Room lights.',
      issues: ['The assistant missed the requested light action.'],
      summary: ['Understands another brightness request.'],
      regressions: [{
        turnIndex: 0,
        input: 'Brighten the lounge lights.',
        context: null,
        status: 'ready',
        operations: [operation({ lightNames: ['Imaginary Light'] })],
        controlKinds: [],
        textIncludes: [],
      }],
    }
    expect(() => parseImprovementAnalysis(JSON.stringify(analysis), job)).toThrow(/unknown expected light target/)
    expect(() => parseImprovementAnalysis(JSON.stringify({
      ...analysis,
      regressions: [{ ...analysis.regressions[0], operations: [operation({ roomId: 'secret-room' })] }],
    }), job)).toThrow(/unknown expected light target/)
  })

  it('rejects private context fields and invalid structured expectations', () => {
    const regression = {
      turnIndex: 0,
      input: 'What about before that?',
      context: {
        domain: 'lights',
        roomId: 'living-room',
        entityIds: [],
        lightNames: [],
        lastAction: 'history',
        historyBefore: 'private medical appointment with Alice',
      },
      status: 'ready',
      operations: [operation({ action: 'history' })],
      controlKinds: [],
      textIncludes: [],
    }
    const analysis = {
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Check earlier Living Room light history.',
      issues: ['The assistant missed the requested light history.'],
      summary: ['Understands another light-history follow-up.'],
      regressions: [regression],
    }
    expect(() => parseImprovementAnalysis(JSON.stringify(analysis), job)).toThrow(/invalid light history boundary/)
    expect(() => parseImprovementAnalysis(JSON.stringify({
      ...analysis,
      regressions: [{
        ...regression,
        context: null,
        operations: [operation({ action: 'history', brightnessPct: 200 })],
      }],
    }), job)).toThrow(/invalid expected brightness/)
  })

  it('accepts fully specified custom RGB and Kelvin expectations', () => {
    const base = {
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Set a custom light color.',
      issues: ['The assistant missed the requested light color.'],
      summary: ['Understands another custom light color.'],
      controlKinds: [],
      textIncludes: [],
      context: null,
      status: 'ready',
      turnIndex: 0,
    }
    const rgb = parseImprovementAnalysis(JSON.stringify({
      version: base.version,
      outcome: base.outcome,
      inferredIntent: base.inferredIntent,
      issues: base.issues,
      summary: base.summary,
      regressions: [{
        ...base,
        input: 'Turn the Music Room lights to rgb(1, 2, 3).',
        operations: [operation({
          action: 'color',
          roomId: 'music-room',
          rgbColor: [1, 2, 3],
          colorName: 'rgb(1, 2, 3)',
        })],
      }],
    }), job)
    const kelvin = parseImprovementAnalysis(JSON.stringify({
      version: base.version,
      outcome: base.outcome,
      inferredIntent: base.inferredIntent,
      issues: base.issues,
      summary: base.summary,
      regressions: [{
        ...base,
        input: 'Turn the Living Room lights to 4250K.',
        operations: [operation({
          action: 'color',
          colorName: '4250K',
          colorTemperatureKelvin: 4250,
        })],
      }],
    }), job)

    expect(rgb.regressions[0].operations[0]).toMatchObject({ rgbColor: [1, 2, 3], colorName: 'rgb(1, 2, 3)' })
    expect(kelvin.regressions[0].operations[0]).toMatchObject({ colorTemperatureKelvin: 4250, colorName: '4250K' })
  })
})
