import { describe, expect, it } from 'vitest'
import { HOUSE_LIGHT_ROOMS } from '../lights-config'
import { CORPUS_FAMILIES, generateFamily } from './generate-lights'
import { validateCorpus } from './validate-lights'

// @covers home-mcp/corpus/validate-lights.ts
describe('Gemini lights corpus', () => {
  it('validates a broad deterministic sample against the parser and planner', () => {
    const summary = validateCorpus(1_000)
    expect(Object.keys(summary.families)).toHaveLength(CORPUS_FAMILIES.length)
    expect(summary.totalUtterances).toBeGreaterThanOrEqual(CORPUS_FAMILIES.length * 1_000)
    expect(summary.uniqueIds).toBe(summary.totalExamples)
  })

  it('covers every room and both prefix and postfix room commands at full scale', () => {
    for (const family of ['single-room-on', 'single-room-off']) {
      const generated = generateFamily(family, 10_000)
      const rooms = new Set(generated.examples.flatMap((item) => {
        const operations = item.expected.operations as Array<{ room: string }>
        return operations.map((operation) => operation.room)
      }))
      expect([...rooms].sort()).toEqual(HOUSE_LIGHT_ROOMS.map((room) => room.name).sort())
      expect(generated.examples.some((item) => /\blights?\b.*\b(on|off)\b/i.test(item.turns[0].text))).toBe(true)
      expect(generated.examples.some((item) => /\b(turn|switch|put)\s+(on|off)\b/i.test(item.turns[0].text))).toBe(true)
    }
  })
})
