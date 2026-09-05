import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  createBaseline,
  findRegressions,
  runCli,
  scanRepository,
  type RuleId,
} from './check'

function withFixture(
  files: Record<string, string>,
  assertion: (root: string) => void,
) {
  const root = mkdtempSync(join(process.cwd(), '.design-system-fixture-'))
  try {
    for (const [file, source] of Object.entries(files)) {
      const path = join(root, file)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, source)
    }
    assertion(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function forRule(root: string, rule: RuleId) {
  return scanRepository(root).filter((violation) => violation.rule === rule)
}

describe('design-system checker', () => {
  it('ratchets raw CSS colors outside owned token definition files', () => {
    withFixture({
      'src/components/Fixture.module.css': `
.fixture {
  color: #fff;
  background: rgba(10, 20, 30, 0.5);
  border-color: var(--rd-transparent);
}
`,
      'src/styles/tokens.css': `
:root {
  --rd-content: #fff;
  --rd-transparent: transparent;
}
`,
    }, (root) => {
      expect(forRule(root, 'raw-color-literal')).toEqual([
        expect.objectContaining({ subject: '#fff' }),
        expect.objectContaining({ subject: 'rgba(10, 20, 30, 0.5)' }),
      ])
    })
  })

  it('reports only undefined owned variables across CSS and inline styles', () => {
    withFixture({
      'src/components/Fixture.module.css': `
.fixture {
  color: var(--rd-defined);
  background: var(--rd-missing);
}
`,
      'src/components/Inline.tsx': `
export const style = {
  '--rd-inline': '#fff',
  color: 'var(--rd-inline)',
}
`,
      'src/styles/tokens.css': `
:root {
  --rd-defined: #fff;
}
`,
    }, (root) => {
      expect(forRule(root, 'undefined-rd-variable')).toEqual([
        expect.objectContaining({
          file: 'src/components/Fixture.module.css',
          subject: '--rd-missing',
        }),
      ])
    })
  })

  it('requires runtime safe-area styles to use the owned token contract', () => {
    withFixture({
      'src/components/Fixture.module.css': `
.fixture {
  padding-left: env(safe-area-inset-left, 0px);
  padding-bottom: env(safe-area-max-inset-bottom, 0px);
}
`,
      'src/styles/tokens.css': `
:root {
  --rd-safe-left: env(safe-area-inset-left, 0px);
  --rd-safe-bottom: env(safe-area-max-inset-bottom, 0px);
}
`,
    }, (root) => {
      expect(forRule(root, 'raw-safe-area-env')).toEqual([
        expect.objectContaining({ subject: 'env(safe-area-inset-left' }),
        expect.objectContaining({ subject: 'env(safe-area-max-inset-bottom' }),
      ])
    })
  })

  it('enforces the shared semantic accessory boundary', () => {
    withFixture({
      'src/components/core/SurfaceAccessory.tsx': `
import { ModalDisclosureIcon } from './ModalDisclosureIcon'
export const SurfaceAccessory = ModalDisclosureIcon
`,
      'src/components/Card.tsx': `
import { ModalDisclosureIcon } from './core/ModalDisclosureIcon'
export const Card = ModalDisclosureIcon
export const LazyIcon = import('./core/ModalDisclosureIcon')
`,
    }, (root) => {
      expect(forRule(root, 'modal-disclosure-import')).toHaveLength(2)
    })
  })

  it('requires typed centered geometry and rejects legacy modal size variables', () => {
    withFixture({
      'src/components/BadModal.tsx': `
const style = { '--modal-desktop-height': '620px' }
export function BadModal() {
  return <ModalSheet contentStyle={style} open title="Bad" onClose={() => undefined}>Bad</ModalSheet>
}
`,
      'src/components/GoodModal.tsx': `
export function GoodModal() {
  return <ModalSheet centeredGeometry={{ blockPolicy: 'fixed', blockSize: '620px', id: 'good', inlineSize: '720px' }} open title="Good" onClose={() => undefined}>Good</ModalSheet>
}
`,
    }, (root) => {
      expect(forRule(root, 'legacy-modal-geometry-variable')).toEqual([
        expect.objectContaining({ subject: '--modal-desktop-height' }),
      ])
      expect(forRule(root, 'missing-modal-centered-geometry')).toEqual([
        expect.objectContaining({ file: 'src/components/BadModal.tsx' }),
      ])
    })
  })

  it('rejects fixed modal square sizing outside a presentation selector', () => {
    withFixture({
      'src/components/Fixture.module.css': `
.unsafe {
  width: var(--modal-square-card-size);
}

.unsafeFluid {
  flex-basis: var(--modal-square-track-width);
}

:global([data-modal-presentation='landscape-dialog']) .safe {
  width: var(--modal-square-track-width);
}
`,
    }, (root) => {
      expect(forRule(root, 'unscoped-modal-square-size')).toEqual([
        expect.objectContaining({ subject: '.unsafe' }),
        expect.objectContaining({ subject: '.unsafeFluid' }),
      ])
    })
  })

  it('rejects visual active changes but permits nonvisual cursor rules', () => {
    withFixture({
      'src/components/Fixture.module.css': `
.safe:active {
  color: inherit;
  cursor: grabbing;
}

@media (hover: none) {
  .unsafe:active,
  .unsafe[data-pressed='true'] {
    transform: scale(0.98);
    opacity: 0.8;
    background-color: black;
    filter: brightness(0.9);
    border-color: transparent;
  }
}
`,
    }, (root) => {
      const violations = forRule(root, 'visual-active-rule')
      expect(violations).toHaveLength(5)
      expect(new Set(violations.map((violation) => violation.subject))).toEqual(new Set([
        '.unsafe:active :: background-color',
        '.unsafe:active :: border-color',
        '.unsafe:active :: filter',
        '.unsafe:active :: opacity',
        '.unsafe:active :: transform',
      ]))
    })
  })

  it('allows debt to shrink and rejects new or increased records', () => {
    withFixture({
      'src/components/Fixture.module.css': `
.fixture {
  color: var(--rd-missing);
}
`,
    }, (root) => {
      const initial = scanRepository(root)
      const baseline = createBaseline(initial)
      expect(findRegressions(initial, baseline)).toEqual([])

      const path = join(root, 'src/components/Fixture.module.css')
      writeFileSync(path, '.fixture { color: inherit; }\n')
      expect(findRegressions(scanRepository(root), baseline)).toEqual([])

      writeFileSync(path, `
.fixture {
  color: var(--rd-missing);
  background: var(--rd-missing);
  border-color: var(--rd-new);
}
`)
      expect(findRegressions(scanRepository(root), baseline)).toEqual([
        expect.objectContaining({
          kind: 'increased',
          current: expect.objectContaining({ subject: '--rd-missing' }),
        }),
        expect.objectContaining({
          kind: 'new',
          current: expect.objectContaining({ subject: '--rd-new' }),
        }),
      ])
    })
  })

  it('prevents write mode from absorbing new debt', () => {
    withFixture({
      'src/components/Fixture.module.css': '.fixture { color: inherit; }\n',
    }, (root) => {
      runCli(['--refresh-baseline'], root)

      const path = join(root, 'src/components/Fixture.module.css')
      writeFileSync(path, '.fixture { color: var(--rd-new); }\n')

      expect(() => runCli(['--write'], root)).toThrow(/cannot absorb new or increased violations/i)
      expect(() => runCli(['--refresh-baseline'], root)).not.toThrow()
    })
  })
})
