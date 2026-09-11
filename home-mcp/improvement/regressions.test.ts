import { validateRegressionFixture } from './regressions'
import type { LightRegressionFixture } from './types'

// @covers home-mcp/improvement/validate-regressions.ts
describe('learned light regression fixtures', () => {
  it('validates expected parser behavior for a contextual follow-up', () => {
    const fixture: LightRegressionFixture = {
      version: 1,
      id: 'conversation-example',
      conversationHash: 'hash',
      coveredPaths: ['home-mcp/light-skill.ts'],
      summary: 'Keep a room-scoped state follow-up.',
      turns: [{
        turnIndex: 1,
        input: 'What about now?',
        context: { domain: 'lights', roomId: 'living-room', entityIds: [], lightNames: [], lastAction: 'state' },
        status: 'ready',
        operations: [{
          action: 'state',
          roomId: 'living-room',
          lightNames: [],
          brightnessPct: null,
          rgbColor: null,
          colorName: null,
          colorTemperatureKelvin: null,
          historyBefore: null,
          targetState: null,
        }],
        controlKinds: [],
        textIncludes: [],
      }],
    }

    expect(validateRegressionFixture(fixture)).toEqual([])
  })

  it('rejects private text anywhere in a stored regression turn', () => {
    const fixture: LightRegressionFixture = {
      version: 1,
      id: 'conversation-private',
      conversationHash: 'hash',
      coveredPaths: ['home-mcp/light-skill.ts'],
      summary: 'Keep a room-scoped history follow-up.',
      turns: [{
        turnIndex: 1,
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
        operations: [{
          action: 'history',
          roomId: 'living-room',
          lightNames: [],
          brightnessPct: null,
          rgbColor: null,
          colorName: null,
          colorTemperatureKelvin: null,
          historyBefore: null,
          targetState: null,
        }],
        controlKinds: [],
        textIncludes: [],
      }],
    }

    expect(validateRegressionFixture(fixture)).toContain('fixture contains private or credential-like text')
  })
})
