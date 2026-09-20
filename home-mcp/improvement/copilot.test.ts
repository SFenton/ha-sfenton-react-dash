import { improvementAnalysisPrompt, parseImprovementAnalysis } from './copilot'
import { HOUSE_LIGHT_ROOMS } from '../lights-config'
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
      handledByHomeMcp: true,
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

  it('grounds analysis in routing provenance and configured light inventory', () => {
    const staleJob = {
      ...job,
      conversation: {
        ...job.conversation!,
        turns: [{
          ...job.conversation!.turns[0],
          userText: 'What lights are on?',
          assistantText: 'Christmas Lights and transit indicators are on.',
          handledByHomeMcp: false,
        }],
      },
    }
    const prompt = improvementAnalysisPrompt(staleJob)
    expect(prompt).toContain('"handledByHomeMcp":false')
    expect(prompt).toContain('"room":"Living Room"')
    expect(prompt).toContain('"lights":["Front Left"')
    expect(prompt).toContain('names absent from the configured inventory')
  })

  it('accepts generalized whole-home regression wording', () => {
    const result = parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'List configured lights that are on.',
      issues: ['The assistant did not return the configured light inventory.'],
      summary: ['Lists configured lights that are currently on.'],
      regressions: [{
        turnIndex: 0,
        input: 'Show me which configured lights are currently on across the home.',
        context: null,
        status: 'ready',
        operations: HOUSE_LIGHT_ROOMS.map((room) => ({
          ...operation({ action: 'lights-on' }),
          roomId: room.id,
        })),
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)

    expect(result.regressions[0].input).toBe('Show me which configured lights are currently on across the home.')
    expect(result.regressions[0].operations[0]).toMatchObject({ action: 'lights-on', roomId: 'living-room' })
    expect(result.regressions[0].operations).toHaveLength(HOUSE_LIGHT_ROOMS.length)
  })

  it('rejects partial whole-home regression expectations', () => {
    expect(() => parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'List configured lights that are on.',
      issues: ['The assistant did not return the configured light inventory.'],
      summary: ['Lists configured lights that are currently on.'],
      regressions: [{
        turnIndex: 0,
        input: 'Show me which configured lights are currently on across the home.',
        context: null,
        status: 'ready',
        operations: [{ ...operation({ action: 'lights-on' }), roomId: 'living-room' }],
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)).toThrow(/every configured room/)
  })

  it('rejects model-authored plans that runtime execution policy will reject', () => {
    expect(() => parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Count lights across two rooms.',
      issues: ['The assistant missed a count request.'],
      summary: ['Handles another count request.'],
      regressions: [{
        turnIndex: 0,
        input: 'How many lights are on in the Kitchen and Living Room?',
        context: null,
        status: 'ready',
        operations: [
          { ...operation({ action: 'count' }), roomId: 'kitchen' },
          { ...operation({ action: 'count' }), roomId: 'living-room' },
        ],
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)).toThrow(/runtime execution policy/)
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

  it('accepts canonical multi-room light context for conversational regressions', () => {
    const result = parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'List lights for the selected rooms.',
      issues: ['The assistant did not continue from the whole-home room summary.'],
      summary: ['Continues from room summaries into exact light details.'],
      regressions: [{
        turnIndex: 0,
        input: 'Living Room and Kitchen',
        context: {
          domain: 'lights',
          roomId: null,
          entityIds: [],
          lightNames: [],
          roomIds: ['living-room', 'kitchen'],
          roomLightNames: {
            'living-room': ['Front Left'],
            kitchen: ['Sink Light'],
          },
          lastAction: 'list',
        },
        status: 'ready',
        operations: [
          operation({ action: 'list', roomId: 'living-room', lightNames: [] }),
          operation({ action: 'list', roomId: 'kitchen', lightNames: [] }),
        ],
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)

    expect(result.regressions[0].context).toMatchObject({
      roomIds: ['living-room', 'kitchen'],
      roomLightNames: {
        'living-room': ['Front Left'],
        kitchen: ['Sink Light'],
      },
    })
  })

  it('accepts room-detail regression wording', () => {
    const result = parseImprovementAnalysis(JSON.stringify({
      version: 1,
      outcome: 'needs-improvement',
      inferredIntent: 'Show the active lights in the Living Room.',
      issues: ['The assistant did not continue into room details.'],
      summary: ['Understands requests for room details.'],
      regressions: [{
        turnIndex: 0,
        input: 'I would like details for Living Room',
        context: {
          domain: 'lights',
          roomId: null,
          entityIds: [],
          lightNames: [],
          roomIds: ['living-room'],
          lastAction: 'lights-on',
        },
        status: 'ready',
        operations: [operation({ action: 'list', roomId: 'living-room' })],
        controlKinds: [],
        textIncludes: [],
      }],
    }), job)

    expect(result.regressions[0].input).toBe('I would like details for Living Room')
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
