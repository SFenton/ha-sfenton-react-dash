import { AUTOMATIC_EDIT_PATHS, AUTOMATIC_VALIDATION_COMMANDS, assertLearnedRegressionFailsBase, validateAutomaticParserChange } from './worker'
import { readFileSync } from 'node:fs'

describe('automatic Home MCP release policy', () => {
  it('lets Copilot edit only the production light parser', () => {
    expect([...AUTOMATIC_EDIT_PATHS]).toEqual(['home-mcp/light-skill.ts'])
  })

  it('keeps host-owned policy, complete corpus, and replay validation in every pass', () => {
    const commands = AUTOMATIC_VALIDATION_COMMANDS.map(([command, args]) => `${command} ${args.join(' ')}`)
    expect(commands).toEqual(expect.arrayContaining([
      'npm run test:change-policy',
      'npm run home-mcp:regressions:validate',
      'npm run home-mcp:corpus:lights:validate -- --utterances-per-family 10000',
    ]))
    const source = readFileSync('home-mcp/improvement/worker.ts', 'utf8')
    expect(source).toContain("'pr', 'checks'")
    expect(source).toContain("REQUIRED_PR_CHECK = 'Home MCP regression gates'")
    expect(source).toContain('`${mergeCommit}^1`')
    expect(source).toContain("['revert', '-m', '1', '--no-commit', mergeCommit]")
  })

  it('rejects model-authored runtime capabilities and top-level structure changes', () => {
    const base = "import { value } from './config'\nfunction actionForSegment(text: string) { return text === value }\nfunction toOperation(text: string) { return text }\n"
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { return fetch(text) }\nfunction toOperation(text: string) { return text }\n",
      'return fetch(text)',
    )).toThrow(/forbidden runtime capabilities/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nconst leaked = value\nfunction actionForSegment(text: string) { return text === value }\nfunction toOperation(text: string) { return text }\n",
      'const leaked = value',
    )).toThrow(/top-level structure/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { HOUSE_LIGHT_ROOMS.push(text); return false }\nfunction toOperation(text: string) { return text }\n",
      'HOUSE_LIGHT_ROOMS.push(text)',
    )).toThrow(/mutates canonical capability/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { const key = 'const' + 'ructor'; return value[key] }\nfunction toOperation(text: string) { return text }\n",
      "const key = 'const' + 'ructor'; return value[key]",
    )).toThrow(/dynamic string construction/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { return text.trim() === value }\nfunction toOperation(text: string) { return text }\n",
      'return text.trim() === value',
    )).not.toThrow()
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { return proce\\u0073s.env.HOME }\nfunction toOperation(text: string) { return text }\n",
      'return proce\\u0073s.env.HOME',
    )).toThrow(/forbidden runtime identifier process/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { HOUSE_LIGHT_ROOMS[0].groupEntityId = 'switch.garage_door'; return false }\nfunction toOperation(text: string) { return text }\n",
      "HOUSE_LIGHT_ROOMS[0].groupEntityId = 'switch.garage_door'",
    )).toThrow(/unsafe mutation/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { Object.defineProperties(RGB_COLORS, { red: { value: [0, 0, 0] } }); return false }\nfunction toOperation(text: string) { return text }\n",
      'Object.defineProperties(RGB_COLORS',
    )).toThrow(/unsafe Object capability/)
    expect(() => validateAutomaticParserChange(
      base,
      "import { value } from './config'\nfunction actionForSegment(text: string) { return text === value }\nfunction toOperation(text: string) { return { room: { id: 'secret' } } }\n",
      "return { room: { id: 'secret' } }",
    )).toThrow(/modified protected functions/)
    const productionParser = readFileSync('home-mcp/light-skill.ts', 'utf8')
    expect(() => validateAutomaticParserChange(productionParser, productionParser, '')).not.toThrow()
    const source = readFileSync('home-mcp/improvement/worker.ts', 'utf8')
    expect(source).toContain('await store.readProcessingJob(claim.path)')
    expect(source).not.toContain('retryJob(claim.path, claim.job')
    expect(source).toContain("'improvement-worker-failed'")
    expect(source).not.toContain('error.message.slice')
    expect(source).toContain("existing[0]?.state === 'CLOSED'")
  })

  it('requires a learned regression to fail against the unchanged parser', () => {
    const job = {
      version: 1 as const,
      id: 'job-one',
      conversationHash: 'hash',
      enqueuedAt: 1,
      attempts: 0,
      stage: 'queued' as const,
      source: 'runtime' as const,
      conversation: {
        version: 1 as const,
        threadId: 'thread-one',
        userScope: 'user-one',
        createdAt: 1,
        updatedAt: 2,
        turns: [{
          id: 'turn-one',
          createdAt: 2,
          userText: 'Turn on the Living Room lights.',
          assistantText: 'Which room?',
          outcome: 'answer' as const,
          parsedAsLights: true,
          contextBefore: null,
          contextAfter: null,
        }],
      },
    }
    const analysis = {
      version: 1 as const,
      outcome: 'needs-improvement' as const,
      inferredIntent: 'Handle a supported light request involving on.',
      issues: ['The stored light response did not match the expected supported behavior.'],
      summary: ['Understands more ways to request on for supported lights.'],
      regressions: [{
        turnIndex: 0,
        input: 'Turn on the Living Room lights.',
        context: null,
        status: 'ready' as const,
        operations: [{
          action: 'on' as const,
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

    expect(() => assertLearnedRegressionFailsBase(job, analysis)).toThrow(/already passes/)
  })
})
