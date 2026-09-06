import { callsites, assertSourceInventory } from './source-inventory'
import { makePlan } from './plan'
import { artifactPath, git, snapshot } from './shared'
import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

describe('independent source reconciliation', () => {
  it('observes aliases and multiple physical nodes without conflating consumer identities', () => {
    expect(callsites(`
import { ModalSheet as Sheet } from '../core/ModalSheet'
export function Sample() { return <><Sheet /><ModalSheet /><OptionPickerDialog presentation="sheet" /></> }
`, 'src/Sample.tsx')).toEqual({
      sheets: { 'src/Sample.tsx:Sample': 2 }, pickers: ['src/Sample.tsx:Sample'],
    })
  })
  it('checks the actual repository against the independently reviewed existing oracle', () => {
    expect(() => assertSourceInventory(process.cwd())).not.toThrow()
  })
  it('blocks unowned new source instead of using a full corpus to certify a new unknown surface', () => {
    const root = process.cwd()
    const base = git(root, ['rev-parse', 'HEAD'])
    const plan = makePlan(root, snapshot(root, base), ['src/pages/UnmodeledNewSurface.tsx'])
    expect(plan.mode).toBe('full-known-mock')
    expect(plan.blockers.join()).toMatch(/New runtime source/)
  })
  it('keeps validation guards and independent padding regressions in the full-known-mock plan', () => {
    const root = process.cwd()
    const base = git(root, ['rev-parse', 'HEAD'])
    const plan = makePlan(root, snapshot(root, base), ['src/components/core/ModalSheet.module.css'])
    expect(plan.mode).toBe('full-known-mock')
    expect(plan.legacySpecs).toContain('layout-guards.spec.ts')
    expect(plan.legacySpecs).toContain('modal-rotation-regressions.spec.ts')
    expect(plan.legacySpecs).toContain('mobile-parity-all-routes.spec.ts')
    expect(plan.legacySpecs).not.toContain('layout-acceptance.spec.ts')
  })
})

describe('reachable declared artifact roots', () => {
  it('rejects escapes and symlinked roots, without using OS temporary directories', () => {
    const root = process.cwd()
    const directory = resolve(root, 'artifacts/layout', `path-test-${randomUUID()}`)
    mkdirSync(directory, { recursive: true })
    try {
      expect(() => artifactPath(root, 'artifacts/elsewhere/file.json')).toThrow()
      expect(() => artifactPath(root, '../outside.json')).toThrow()
      symlinkSync(resolve(root, 'docs'), resolve(directory, 'escape'), 'dir')
      expect(() => artifactPath(root, resolve(directory, 'escape/ux/layouts.md'), true)).toThrow(/symlinked/)
      expect(artifactPath(root, resolve(directory, 'future.json'))).toBe(resolve(directory, 'future.json'))
    } finally { rmSync(directory, { recursive: true, force: true }) }
  })
})
