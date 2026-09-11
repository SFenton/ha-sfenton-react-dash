import { readFileSync } from 'node:fs'

// @covers scripts/i18n/inventory.ts
describe('i18n technical-token scanner', () => {
  it('keeps TypeScript runtime type labels out of visible-copy inventory', () => {
    const source = readFileSync('scripts/i18n/inventory.ts', 'utf8')
    expect(source).toContain('string|number|boolean|undefined|object|function|symbol|null|bigint')
  })
})
