import type { Checkpoint, CollectedTest, ExecutionLedger, LayoutPlan, ManualLedger, RunIdentity } from '../../e2e/layout/types'
import { capabilityMatches, assertExactSelection, selectTests, testList, verifyEvidence } from './verify'
import { classifyChanges, runtimeConfigurationChanged } from './plan'
import { hash, stableHash } from './shared'
import { networkDecision } from '../../e2e/layout/fixture'
import { assertDeclaredTabs } from '../../e2e/layout/evidence'

function fixture() {
  const source = { base: 'base-commit', head: 'head-commit', files: { 'src/example.ts': 'content-hash' }, digest: 'source-content-hash' }
  const obligation = { id: 'form/draft/fine-chromium/0-desktop', scenario: 'form' as const, state: 'draft', context: 'fine-chromium' as const, profile: 'desktop', step: 0, review: true }
  const plan: LayoutPlan = {
    version: 1, id: '', root: '/repo', source, mode: 'focused', changes: ['src/example.ts'],
    reasons: ['Explicit owner'], blockers: [], scenarios: ['form'], contexts: ['fine-chromium'],
    obligations: [obligation], legacySpecs: [], unitGates: [], exclusions: [], deviceOnly: [],
  }
  plan.id = stableHash({ ...plan, id: '' })
  const build = { source: source.digest, root: '/repo/artifacts/layout/run/dist', digest: 'build-hash', assets: {}, origin: 'http://127.0.0.1:12345', pid: 1, fixtureDigest: 'shared-backend-fixture', serverNonce: 'fixture-nonce' }
  const run: RunIdentity = {
    version: 1, runId: 'run', root: '/repo', artifactRoot: '/repo/artifacts/layout/run', planId: plan.id, source,
    candidate: build, baseline: { ...build, source: source.base, origin: 'http://127.0.0.1:12346' },
    fixtureDigest: 'fixture-hash', startedAt: '2026-09-06T00:00:00Z',
  }
  const selection: CollectedTest[] = [{ id: 'test-id', project: 'desktop', file: 'layout-acceptance.spec.ts', titlePath: ['layout contract: form'], scenario: 'form' }]
  const png = Buffer.from('unit fixture image bytes; browser tests own actual image capture')
  const checkpoint: Checkpoint = {
    version: 1, ...obligation, runId: run.runId, planId: plan.id, sourceDigest: source.digest, buildDigest: build.digest,
    fixtureDigest: run.fixtureDigest, testId: selection[0].id,
    capabilities: { browser: 'chromium', version: 'installed', isMobile: false, hasTouch: false, fine: true, coarse: false, hover: true, touchPoints: 0 },
    viewport: { width: 1440, height: 900 }, insets: { top: 0, right: 0, bottom: 0, left: 0 },
    facts: { draft: 'preserved', frame: 'asserted' }, screenshot: 'artifacts/layout/run/form.png', screenshotHash: hash(png), status: 'passed',
  }
  const ledger: ExecutionLedger = {
    version: 1, runId: run.runId, planId: plan.id, sourceDigest: source.digest, selected: selection,
    attempts: [{ testId: 'test-id', status: 'passed', expectedStatus: 'passed', retry: 0, workerIndex: 0, annotations: [], checkpoints: [checkpoint] }],
    errors: [], complete: true, status: 'passed',
  }
  const manual: ManualLedger = {
    version: 1, runId: run.runId, planId: plan.id, reviewer: 'Unit-test reviewer',
    reviews: [{ checkpointId: obligation.id, runId: run.runId, screenshotHash: hash(png), verdict: 'pass', observation: 'Draft remained visible', inspectedWith: 'unit fixture, not actual UI evidence', interaction: 'unit fixture', factKeys: ['draft'] }],
  }
  return { plan, run, selection, checkpoint, ledger, manual, png }
}

describe('layout scope and selection', () => {
  it('rejects a newly rendered or missing tab instead of deriving the expected set from observation', () => {
    expect(() => assertDeclaredTabs(['First', 'Second'], ['^First$', '^Second$'])).not.toThrow()
    expect(() => assertDeclaredTabs(['First', 'Second', 'New'], ['^First$', '^Second$'])).toThrow(/inventory changed/)
    expect(() => assertDeclaredTabs(['First'], ['^First$', '^Second$'])).toThrow(/inventory changed/)
  })
  it('keeps a known leaf focused and treats tooling separately', () => {
    expect(classifyChanges(['src/components/hass/CreateTodoItemSheet.tsx']).scenarios).toEqual(['form'])
    expect(classifyChanges(['scripts/layout/verify.ts']).mode).toBe('tooling')
    expect(classifyChanges(['README.md']).mode).toBe('non-layout')
  })
  it('does not classify dependency/build behavior changes as harmless validation scripts', () => {
    expect(runtimeConfigurationChanged('package.json', '{"scripts":{}}', '{"scripts":{"layout:check":"check"}}')).toBe(false)
    expect(runtimeConfigurationChanged('package.json', '{"dependencies":{"react":"19"}}', '{"dependencies":{"react":"20"}}')).toBe(true)
    expect(runtimeConfigurationChanged('vite.config.ts', "return {\nbase: './'\n}", "return {\ncacheDir: resolve(process.cwd(), '.cache/vite'),\nbase: './'\n}")).toBe(false)
    expect(runtimeConfigurationChanged('vite.config.ts', "base: './'", "base: '/'")).toBe(true)
  })
  it('does not exempt catalog-only, same-length copy or shared CSS changes', () => {
    for (const file of ['src/i18n/locales/en/shell.json', 'src/pages/Page.module.css', 'src/components/core/ModalSheet.tsx']) {
      const result = classifyChanges([file])
      expect(result.mode).not.toBe('non-layout')
      expect(result.scenarios.length).toBeGreaterThan(0)
    }
    expect(classifyChanges(['src/i18n/locales/en/shell.json']).mode).toBe('full-known-mock')
  })
  it('rejects empty, duplicate and prefix-overbroad collection', () => {
    const { selection } = fixture()
    expect(() => assertExactSelection([], [])).toThrow(/No required/)
    expect(() => assertExactSelection(selection, [])).toThrow(/missing/)
    expect(() => assertExactSelection(selection, [...selection, { ...selection[0], id: 'extra', titlePath: ['layout contract: form', 'unexpected nested test'] }])).toThrow(/prefix-overbroad/)
    expect(() => assertExactSelection(selection, [...selection, ...selection])).toThrow(/Duplicate/)
    expect(() => assertExactSelection(selection, selection)).not.toThrow()
    expect(testList(selection)).toBe('[desktop] › layout-acceptance.spec.ts › layout contract: form\n')
  })
  it('blocks required contexts missing from actual registration', () => {
    const { plan, selection } = fixture()
    expect(selectTests(plan, selection)).toEqual(selection)
    expect(() => selectTests(plan, [{ ...selection[0], project: 'mobile' }])).toThrow(/not registered/)
  })
})

describe('layout evidence assessment', () => {
  it('accepts correctly bound passed evidence, not merely a file or tag', () => {
    const f = fixture()
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(true)
  })
  it('checks actual dimensions before manual review, and never mistakes the automated phase for full acceptance', () => {
    const f = fixture()
    const automatic = verifyEvidence(f.plan, f.run, f.selection, f.ledger, null, () => f.png, false)
    expect(automatic.accepted).toBe(true)
    expect(automatic.scope).toContain('No manual judgment')
    f.checkpoint.viewport.width = 980
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, null, () => f.png, false).failures.join()).toContain('actual viewport/insets')
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, null, () => f.png).accepted).toBe(false)
  })
  it.each(['skipped', 'failed', 'timedOut', 'interrupted'])('rejects required %s attempts', (status) => {
    const f = fixture()
    f.ledger.attempts[0].status = status
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(false)
  })
  it('rejects historical tested-source/current-source attribution, unassigned tests, expected failure and retries', () => {
    for (const mutation of [
      (f: ReturnType<typeof fixture>) => { f.run.candidate.source = 'later-corrected-source-not-the-tested-source' },
      (f: ReturnType<typeof fixture>) => { f.ledger.attempts[0].workerIndex = -1 },
      (f: ReturnType<typeof fixture>) => { f.ledger.attempts[0].expectedStatus = 'failed' },
      (f: ReturnType<typeof fixture>) => { f.ledger.attempts[0].retry = 1 },
      (f: ReturnType<typeof fixture>) => { f.ledger.attempts[0].checkpoints = [] },
      (f: ReturnType<typeof fixture>) => { f.checkpoint.status = 'failed' },
      (f: ReturnType<typeof fixture>) => { f.ledger.complete = false },
    ]) {
      const f = fixture()
      mutation(f)
      expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(false)
    }
  })
  it('uses actual capabilities instead of project-name certification', () => {
    const f = fixture()
    expect(capabilityMatches(f.checkpoint.capabilities, 'fine-chromium')).toBe(true)
    f.selection[0].project = 'mobile'
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(true)
    f.checkpoint.capabilities.isMobile = true
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(false)
  })
  it('records WPE coarse-emulation limits without inventing physical touch capability', () => {
    const actual = { browser: 'webkit', version: '26.4', hasTouch: true, isMobile: true, coarse: true, fine: false, hover: false, touchPoints: 0 }
    expect(capabilityMatches(actual, 'touch-webkit')).toBe(true)
    expect(capabilityMatches({ ...actual, coarse: false, fine: true }, 'touch-webkit')).toBe(false)
    expect(capabilityMatches({ ...actual, browser: 'chromium' }, 'touch-chromium')).toBe(false)
  })
  it('distinguishes an exact runtime engine restriction from missing work or a broad skip allowance', () => {
    const f = fixture()
    const title = 'legacy replacements keep post-GC heap bounded'
    const test = { id: 'heap', project: 'arbitrary-name', file: 'iframe-lifecycle.spec.ts', titlePath: [title] }
    f.selection.push(test)
    f.plan.legacySpecs.push(test.file)
    f.plan.id = stableHash({ ...f.plan, id: '' })
    f.run.planId = f.ledger.planId = f.manual.planId = f.checkpoint.planId = f.plan.id
    f.ledger.attempts.push({
      testId: 'heap', expectedStatus: 'skipped', status: 'skipped', workerIndex: 1, retry: 0, checkpoints: [],
      annotations: [{ type: 'layout-effective-browser', description: 'webkit' }, { type: 'skip', description: 'CDP heap measurements require Chromium.' }],
    })
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).notApplicable).toHaveLength(1)
    f.ledger.attempts.at(-1)!.workerIndex = -1
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(false)
  })
  it('rejects stale fixtures, missing images, unreviewed capture and inaccessible manual evidence', () => {
    for (const mutation of [
      (f: ReturnType<typeof fixture>) => { f.checkpoint.fixtureDigest = 'old-fixture' },
      (f: ReturnType<typeof fixture>) => { f.run.baseline.fixtureDigest = 'different-backend-data' },
      (f: ReturnType<typeof fixture>) => { f.manual.reviews = [] },
      (f: ReturnType<typeof fixture>) => { f.manual.reviews[0].verdict = 'access-unavailable' },
      (f: ReturnType<typeof fixture>) => { f.manual.reviews[0].screenshotHash = 'old-image' },
      (f: ReturnType<typeof fixture>) => { f.checkpoint.viewport.width = 852 },
    ]) {
      const f = fixture()
      mutation(f)
      expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => f.png).accepted).toBe(false)
    }
    const f = fixture()
    expect(verifyEvidence(f.plan, f.run, f.selection, f.ledger, f.manual, () => { throw new Error('Access unavailable') }).failures.join()).toMatch(/access-unavailable/)
  })
})

describe('local mock network policy', () => {
  const origins = ['http://127.0.0.1:12345']
  it('allows owned static assets and intercepts reserved mock media without upstream I/O', () => {
    expect(networkDecision(`${origins[0]}/assets/app.js`, 'GET', origins)).toBe('allow')
    expect(networkDecision('http://mock-hass.local/webrtc/camera.js', 'GET', origins)).toBe('mock')
  })
  it.each(['/api/states', '/%61pi/states', '/local/a', '/webrtc/a', '/hacsfiles/a', '/__evershelf/a', '/assets/valetudo/a'])('blocks proxy path %s', (path) => {
    expect(networkDecision(`${origins[0]}${path}`, 'GET', origins)).toBe('deny')
  })
  it('blocks external origins, credential URLs, POST, and malformed URLs', () => {
    expect(networkDecision('https://example.invalid', 'GET', origins)).toBe('deny')
    expect(networkDecision('http://user:pass@127.0.0.1:12345/', 'GET', origins)).toBe('deny')
    expect(networkDecision(`${origins[0]}/assets/app.js`, 'POST', origins)).toBe('deny')
    expect(networkDecision('not a URL', 'GET', origins)).toBe('deny')
  })
})
