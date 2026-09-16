import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CONTEXTS, DEVICE_ONLY_GAPS, EXTERNAL_SPECS, LAYOUT_UNIT_GATES, PARITY_SPEC, PLAYWRIGHT_SPEC_COVERAGE,
  SCENARIO_IDS, SHARED_MODAL_OWNER_ROOTS, SHARED_OWNER_ROOTS, SURFACE_CONTRACTS, type ContextId, type ScenarioId,
} from '../../e2e/layout/contracts'
import { obligationsFor, SOURCE_ROOM_OPENERS, SOURCE_ROUTES, validateRegistry } from '../../e2e/layout/scenarios'
import { CANONICAL_VIEWPORT_NAMES, LAYOUT_PROFILES, VIEWPORTS } from '../../e2e/responsive-acceptance-data'
import type { LayoutPlan, SourceSnapshot } from '../../e2e/layout/types'
import { runCoverageCheck } from '../e2e-coverage-check'
import { assertSourceInventory } from './source-inventory'
import { artifactPath, assertOptions, changedFiles, git, isEntry, option, snapshot, stableHash, writeJson } from './shared'

export function classifyChanges(changes: string[]) {
  const source = changes.filter((file) => (file.startsWith('src/') || file.startsWith('public/') || file === 'index.html')
    && !file.startsWith('src/test/') && !/\.test\.[jt]sx?$/.test(file))
  if (!source.length) {
    const docsOnly = changes.length > 0 && changes.every((file) =>
      file.endsWith('.md') && !file.startsWith('.github/') && !file.startsWith('docs/ux/'))
    const layoutTooling = changes.some((file) =>
      file.startsWith('scripts/layout/')
      || file.startsWith('e2e/layout/')
      || file === 'e2e/responsive-acceptance-data.ts'
      || file === 'e2e/playwright-coverage.ts'
      || file === 'playwright.config.ts'
      || file === 'vite.config.ts')
    const mode = layoutTooling ? 'tooling' as const : 'non-layout' as const
    return {
      mode,
      scenarios: [],
      reasons: [
        docsOnly
          ? 'Documentation-only; no runtime or validation contract changes'
          : !changes.length
            ? 'No changed files'
            : layoutTooling
              ? 'Layout tooling changes use unit and guarded workflow evidence without claiming product-surface acceptance'
              : 'No production layout source changed; pull-request quality and Playwright jobs own the affected non-layout checks',
      ],
      unowned: [],
    }
  }
  const scopes = new Set<ScenarioId>()
  const unowned: string[] = []
  const shared = source.filter((file) => SHARED_OWNER_ROOTS.some((prefix) => file.startsWith(prefix)))
  const sharedModal = source.filter((file) => SHARED_MODAL_OWNER_ROOTS.some((prefix) => file.startsWith(prefix)))
  for (const file of source) {
    const owners = SCENARIO_IDS.filter((id) => SURFACE_CONTRACTS[id].owners.some((prefix) => file.startsWith(prefix)))
    if (!owners.length && !shared.includes(file) && !sharedModal.includes(file)) unowned.push(file)
    for (const owner of owners) scopes.add(owner)
    if (sharedModal.includes(file)) {
      for (const id of SCENARIO_IDS) {
        if (SURFACE_CONTRACTS[id].family === 'modal') scopes.add(id)
      }
    }
  }
  if (unowned.length || shared.length) return {
    mode: 'full-known-mock' as const, scenarios: [...SCENARIO_IDS],
    reasons: ['Conservative whole-known-mock fallback; syntax/import reach never subtracts owners or states', ...shared.map((file) => `Shared owner expands all surface families: ${file}`), ...unowned.map((file) => `Unnarrowed runtime consumer: ${file}`)],
    unowned,
  }
  return {
    mode: 'focused' as const,
    scenarios: SCENARIO_IDS.filter((id) => scopes.has(id)),
    reasons: [
      'Explicit source owners; every declared state is retained',
      ...sharedModal.map((file) => `Shared modal owner expands modal surface families only: ${file}`),
    ],
    unowned,
  }
}

export function runtimeConfigurationChanged(file: string, before: string, after: string) {
  if (file === 'package.json') {
    const oldValue = JSON.parse(before) as Record<string, unknown>
    const newValue = JSON.parse(after) as Record<string, unknown>
    return ['dependencies', 'devDependencies', 'overrides', 'resolutions', 'type', 'engines']
      .some((key) => stableHash(oldValue[key] ?? null) !== stableHash(newValue[key] ?? null))
  }
  if (file === 'vite.config.ts') {
    const withoutOwnedCache = (text: string) => text.replace(/^\s*cacheDir: resolve\(process\.cwd\(\), '\.cache\/vite'\),\r?\n/gm, '')
    return withoutOwnedCache(before) !== withoutOwnedCache(after)
  }
  return true
}

export function makePlan(root: string, source: SourceSnapshot, changes: string[], contexts: ContextId[] = Object.keys(CONTEXTS) as ContextId[]): LayoutPlan {
  if (!contexts.length || new Set(contexts).size !== contexts.length || contexts.some((id) => !CONTEXTS[id])) throw new Error('Unknown, duplicate, or empty required context set')
  let impact = classifyChanges(changes)
  const runtimeConfigurations = changes.filter((file) =>
    ['package.json', 'yarn.lock', 'package-lock.json', 'pnpm-lock.yaml', 'vite.config.ts'].includes(file))
    .filter((file) => {
      try { return runtimeConfigurationChanged(file, git(root, ['show', `${source.base}:${file}`]), readFileSync(resolve(root, file), 'utf8').trim()) }
      catch { return true }
    })
  if (runtimeConfigurations.length) impact = {
    ...impact, mode: 'full-known-mock', scenarios: [...SCENARIO_IDS],
    reasons: [...impact.reasons, ...runtimeConfigurations.map((file) => `Runtime dependency/build configuration expands all consumers: ${file}`)],
  }
  const blockers = impact.unowned.filter((file) => {
    try { git(root, ['cat-file', '-e', `${source.base}:${file}`]); return false } catch { return true }
  }).map((file) => `New runtime source has no explicit contract owner: ${file}. Add an owner and any new state obligations; a full corpus cannot certify an unmodeled new surface.`)
  const legacySpecs = impact.mode === 'full-known-mock'
    ? PLAYWRIGHT_SPEC_COVERAGE.map((entry) => entry.spec).filter((spec) => !EXTERNAL_SPECS.has(spec) && spec !== PARITY_SPEC && spec !== 'layout-acceptance.spec.ts')
    : impact.mode === 'focused'
      ? [...new Set(impact.scenarios.flatMap((id) => SURFACE_CONTRACTS[id].legacy))]
      : impact.mode === 'tooling' ? ['layout-guards.spec.ts'] : []
  if (impact.mode === 'focused' || impact.mode === 'full-known-mock') legacySpecs.push(PARITY_SPEC)
  const plan: LayoutPlan = {
    version: 1, id: '', root, source, mode: impact.mode, changes, reasons: impact.reasons, blockers,
    scenarios: impact.scenarios, contexts,
    obligations: obligationsFor(impact.scenarios, contexts), legacySpecs,
    unitGates: impact.mode === 'non-layout' ? [] : [...LAYOUT_UNIT_GATES],
    exclusions: [...EXTERNAL_SPECS].map((spec) => ({ spec, reason: 'Live integration is outside local mock authorization' })),
    deviceOnly: DEVICE_ONLY_GAPS,
  }
  plan.id = stableHash({ ...plan, id: '' })
  return plan
}

export function generatedLayoutsDoc() {
  return `# Executable layout validation

This is the human view of \`e2e/layout/contracts.ts\`, not another inventory.
Generated by \`npm run layout:check -- --write\`. Do not hand-edit.

## Workflow

Pull requests automate planning and execution in the protected
\`Automated layout\` job, then run
\`layout:verify -- --run <artifact> --automated-only\`. That check validates
exact automated evidence and uploads the run as \`layout-automation\`; it never
manufactures manual judgment. Do not rerun the broad automated corpus locally
merely to permit an initial push.

1. Read the current UX contract. Do not redesign its geometry or HA behavior.
2. Run \`npm run layout:plan -- --base <resolved-master-sha> --out artifacts/layout/<run-id>/plan.json\`.
3. Review the plan's owners, states, contexts, exclusions and blockers. Unknown new
   surfaces require an explicit owner/scenario. Never use import reach or text length
   to remove obligations. Exact rendered values AND unchanged consumers are needed
   to justify a catalog serialization-only exception; none is inferred automatically.
4. Run \`npm run layout:run -- --plan artifacts/layout/<run-id>/plan.json\`.
   This owns fresh mock builds and strict loopback previews; it does not authorize HA.
5. Inspect the generated \`manual-worklist.json\` AND perform its listed browser
   interactions. View the unnormalized images with an image-capable tool. Record
   observations in \`manual.json\`; capture alone is not inspection.
6. Run \`npm run layout:verify -- --run artifacts/layout/<run-id>\`.
   The external assessor blocks missing work, stale fingerprints, failed/skipped
   required checkpoints, unreviewed images and inaccessible artifacts.

The full six-step workflow is the human acceptance path for layout-sensitive
work. During release, inspect the current pull-request artifact and exercise an
owned preview of the exact pull-request head before merge or deployment. A
\`non-layout\` Action classification or a zero-item manual worklist requires no
manual layout review.

To replay a completed candidate manually, use \`layout:run -- --plan <plan> --review\`.
It reuses only fingerprint-verified build artifacts and owns a new no-proxy preview.
Stop only the PID it reports. Do not reuse an unowned port or copy credentials.
Then use the guarded agent-directed controller, for example:

\`\`\`bash
npm run layout:review -- --run artifacts/layout/<run-id> --scenario summary --state expired --context touch-chromium --profiles island-phone-portrait,island-phone-landscape-left,island-phone-landscape-right,island-phone-portrait
\`\`\`

\`--interact\` exercises bounded mock controls; \`--terminal\` captures actual end
positions. The controller records actions and captures, never review verdicts.
View the images and complete the worklist yourself. These mock replays cannot
authorize a live browser, arbitrary service, or external destination.

## Authority and limits

- Source owns routes/openers; the registry owns obligations; source scans and accepted
  geometry oracles remain independent. Planned, registered, selected, executed,
  passed, failed, skipped/not-run and manually reviewed are distinct.
- Explicit owners select focused scenarios; unknown existing sources select the full
  known mock corpus. Legacy files are **coarse functional evidence**, not certified
  backend-state checkpoints. New/changed states must be declared and exercised.
- Actual browser/viewport/pointer evidence, not a project name, certifies a context.
- WPE coarse emulation can report zero maxTouchPoints. Keyboard contraction uses
  an explicitly synthetic touch-point hint, not a claim of native iOS behavior.
- Existing HAKit component mocks simplify toggle/dial internals. Surrounding layout,
  interaction and state evidence is useful, but does not certify real-HAKit paint.
- The runner executes the declared unit gates, including preload timer/observer
  invariants. Computed body overflow determines effective ownership: auto/scroll
  bodies retain strict actual end inset and finite terminal-control clearance even
  when pane mode is preferred or content fits. Bounded normal-dialog panes require
  a hidden/clip body and a real eligible inner pane. Missing controls are failures,
  never a success-shaped geometry fallback. Explicit registry-owned read-only
  states instead require one visible, named, noninteractive state terminal and
  zero body controls; their content clearance is recorded separately. Failures
  remain failed.
- An incoming panel must exist and settle before its screenshot. Never freeze
  elapsed Date.now time or fix production animation to satisfy the harness.
  The source-declared empty vacuum state and recipe same-sheet details use named
  readiness contracts with real state/field targets; undeclared missing panels
  and outgoing content still fail.
- Artifacts live below the declared repository-relative \`artifacts/layout/<run-id>\`.
  Access-unavailable means blocked, never permission to bypass a file restriction.
- Repeated truthful observations and identical return images are valid. Records and
  hashes prove correspondence, not the quality or honesty of visual judgment.
- Baseline production inputs come from the pinned commit. Only test-side
  \`src/test/mocks\` is overlaid into the exported baseline inputs so both builds
  use identical backend fixtures; the overlay and both asset digests are recorded.
  No clean baseline worktree or production source is changed.
- A registry-owned route addition is not a whole-page parity exclusion. Its exact
  new geometry/semantics and all inherited sections are asserted first, with the
  added section visible in separate captures. Only that validated section may be
  removed for inherited-content pixel comparison; all original thresholds remain.
- No commit, push, deployment, live service call, or external-system mutation is
  authorized by validation. Preserve one React tree, optimistic path and HA owner.

## Canonical endpoints

${CANONICAL_VIEWPORT_NAMES.map((name) => `- \`${name}\`: ${VIEWPORTS[name].width}×${VIEWPORTS[name].height}`).join('\n')}

Extra stress/transition profiles are named in \`responsive-acceptance-data.ts\`;
the broad route sweep deliberately retains its compact-wide subset. Do not append
dimensions to positional arrays or confuse a resize with native input emulation.

## Checkpoint-certified representative surfaces

| Scenario | Family | States | Manual question |
| --- | --- | --- | --- |
${SCENARIO_IDS.map((id) => `| ${id} | ${SURFACE_CONTRACTS[id].family} | ${SURFACE_CONTRACTS[id].states.join(', ')} | ${SURFACE_CONTRACTS[id].question} |`).join('\n')}

Source-derived inventory: ${SOURCE_ROUTES.length} routes; ${SOURCE_ROOM_OPENERS.length}
configured room/hash openers. These are not unique modal or backend-state counts.

## Device-only / outside local certification

${DEVICE_ONLY_GAPS.map((gap) => `- ${gap}`).join('\n')}
`
}

export function checkContracts(root: string, write = false) {
  validateRegistry()
  runCoverageCheck(root)
  assertSourceInventory(root)
  const files = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0')
  for (const id of SCENARIO_IDS) {
    for (const owner of SURFACE_CONTRACTS[id].owners) {
      if (!files.some((file) => file.startsWith(owner))) throw new Error(`Owner matches no source: ${id}/${owner}`)
    }
    for (const obligation of obligationsFor([id], Object.keys(CONTEXTS) as ContextId[])) {
      if (!LAYOUT_PROFILES[obligation.profile]) throw new Error(`Unknown profile: ${obligation.id}`)
    }
    for (const spec of SURFACE_CONTRACTS[id].legacy) {
      if (!PLAYWRIGHT_SPEC_COVERAGE.some((entry) => entry.spec === spec)) throw new Error(`Unknown legacy owner: ${id}/${spec}`)
    }
  }
  for (const entry of PLAYWRIGHT_SPEC_COVERAGE) {
    if (EXTERNAL_SPECS.has(entry.spec) || entry.spec === 'layout-guards.spec.ts') continue
    const text = readFileSync(resolve(root, 'e2e', entry.spec), 'utf8')
    if (!text.includes("from './layout/fixture'")) throw new Error(`Mock spec bypasses guarded contexts: ${entry.spec}`)
    if (/\.launch(?:PersistentContext|Server)?\s*\(/.test(text)) throw new Error(`Unmanaged browser launch in ${entry.spec}; use the guarded browser fixture`)
  }
  const file = resolve(root, 'docs/ux/layouts.md')
  const expected = generatedLayoutsDoc()
  if (write) writeFileSync(file, expected)
  else if (!existsSync(file) || readFileSync(file, 'utf8') !== expected) throw new Error('Generated layouts.md is stale; run layout:check -- --write and review the diff')
}

export function assertCurrentPlan(root: string, plan: LayoutPlan) {
  const source = snapshot(root, plan.source.base)
  const current = makePlan(root, source, changedFiles(root, source.base))
  if (current.id !== plan.id) throw new Error('Plan does not equal the current registry-derived change plan; edited/subtracted obligations or stale source are not accepted')
}

export function main(args = process.argv.slice(2), root = process.cwd()) {
  if (args.includes('--check')) {
    assertOptions(args, [], ['--check', '--write'])
    checkContracts(root, args.includes('--write'))
    return
  }
  assertOptions(args, ['--base', '--out'])
  const base = option(args, '--base')
  const out = option(args, '--out')
  if (!base || !out) throw new Error('Usage: layout:plan -- --base <sha> --out artifacts/layout/<run-id>/plan.json')
  checkContracts(root)
  const source = snapshot(root, base)
  const plan = makePlan(root, source, changedFiles(root, source.base))
  writeJson(artifactPath(root, out), plan)
  console.log(`${plan.mode}: ${plan.obligations.length} checkpoints, ${plan.legacySpecs.length} coarse legacy files; ${plan.blockers.length} blockers. Plan ${plan.id}`)
  if (plan.blockers.length) throw new Error(plan.blockers.join('\n'))
}

if (isEntry(import.meta.url)) {
  try { main() } catch (error) { console.error(String(error)); process.exitCode = 1 }
}
