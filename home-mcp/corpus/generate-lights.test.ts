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
  }, 15_000)

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

  it('generates a full whole-home light-status family', () => {
    const generated = generateFamily('whole-home-lights-on', 10_000)
    expect(generated.utterances).toBeGreaterThanOrEqual(10_000)
    expect(generated.examples.every((item) => {
      const operations = item.expected.operations as Array<{ action: string; room: string }>
      return operations.length === HOUSE_LIGHT_ROOMS.length
        && operations.every((operation, index) =>
          operation.action === 'lights-on' && operation.room === HOUSE_LIGHT_ROOMS[index].name)
    })).toBe(true)
    const utterances = generated.examples.map((item) => item.turns[0].text)
    expect(utterances.some((text) => /^Are any lights on\b/i.test(text))).toBe(true)
    expect(utterances.some((text) => /^Do we have any lights on\b/i.test(text))).toBe(true)
    expect(utterances.some((text) => /\bWhich lights have been left on\b/i.test(text))).toBe(true)
    expect(utterances.some((text) => /\bWhich lights are switched on\b/i.test(text))).toBe(true)
    expect(utterances.every((text) => /[.!?]$/.test(text))).toBe(true)
    expect(utterances.every((text) => (text.match(/\bplease\b/gi)?.length ?? 0) <= 1)).toBe(true)
    expect(utterances.every((text) => {
      const normalized = text.toLowerCase()
      return ['currently', 'right now', 'at the moment', 'at present']
        .reduce((count, marker) => count + normalized.split(marker).length - 1, 0) <= 1
    })).toBe(true)
  })
})
