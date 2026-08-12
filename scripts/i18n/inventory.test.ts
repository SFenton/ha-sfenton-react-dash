import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertNoNewLegacy, buildCopyInventory, currentBaseline } from './inventory'

describe('copy inventory', () => {
  let repositoryInventory: ReturnType<typeof buildCopyInventory>

  beforeAll(() => {
    repositoryInventory = buildCopyInventory()
  }, 30_000)

  it('tracks migrated catalogs separately', () => {
    const inventory = repositoryInventory

    expect(inventory.summary.catalogRecords).toBeGreaterThan(0)
    expect(inventory.summary.legacyRecords).toBeGreaterThan(0)
  })

  it('tracks representative shell, modal, and document copy', () => {
    const inventory = repositoryInventory
    const values = new Set(inventory.records.map((record) => record.value))

    expect(values).toContain('Dashboard sections')
    expect(values).toContain('Close')
    expect(values).toContain('Home Assistant')
    expect(values).toContain('Add Scheduled Activity')
    expect(values).toContain('Alarm time')
    expect(values).toContain('Processing...')
    expect(values).toContain('Schedule Control')
    expect(inventory.records.some((record) =>
      record.file === 'src/pages/DashboardViewPage.tsx'
        && record.value === 'Controls'
        && record.context === 'accessibility')).toBe(true)
  })

  it('rejects offsetting occurrence-count regressions', () => {
    const inventory = repositoryInventory
    const baseline = currentBaseline(inventory)
    const changed = structuredClone(inventory)
    const legacy = changed.records.filter((record) => record.origin === 'legacy')
    const increased = legacy[0]
    const decreased = legacy.find((record) => record.id !== increased.id && record.occurrences > 0)

    expect(increased).toBeDefined()
    expect(decreased).toBeDefined()
    increased.occurrences += 1
    decreased!.occurrences -= 1

    expect(() => assertNoNewLegacy(changed, baseline)).toThrow('occurrence count increased for existing records')
  })

  it('resolves late and shadowed local literal bindings by symbol', () => {
    const root = mkdtempSync(join(tmpdir(), 'copy-inventory-'))
    try {
      mkdirSync(join(root, 'src'))
      writeFileSync(join(root, 'index.html'), '<title>Fixture</title>')
      writeFileSync(join(root, 'src/main.tsx'), `
const LABEL = 'Outer'
function Fixture() {
  const LABEL = 'Inner'
  return <><div aria-label={LABEL} /><div title={LATE_CONTENT} /></>
}
const LATE_CONTENT = 'New text'
void Fixture
`)

      const inventory = buildCopyInventory(root)
      expect(inventory.records.some((record) => record.value === 'Inner' && record.context === 'accessibility')).toBe(true)
      expect(inventory.records.some((record) => record.value === 'Outer' && record.context === 'accessibility')).toBe(false)
      expect(inventory.records.some((record) => record.value === 'New text' && record.context === 'title')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
