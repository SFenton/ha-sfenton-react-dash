import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP,
  MANUAL_SCREENSHOT_TOTAL_LIBRARY_BYTE_CAP,
  SCREENSHOT_REVIEW_MANIFEST_PATH,
  SCREENSHOT_REVIEW_SCHEMA_VERSION,
  canonicalJson,
  checkScreenshotReviewApproval,
  collectUiSourcePaths,
  createScreenshotReviewManifest,
  finalizeScreenshotReviewState,
  fingerprintFileEntries,
  screenshotApprovalReceiptIssues,
  screenshotBudgetIssues,
  screenshotReviewApprovalIssues,
  sensitiveManifestIssues,
  serializeReviewJson,
  type ScreenshotCaptureCheckReceipt,
  type ScreenshotContactSheetReceipt,
  type ScreenshotReviewManifest,
  type ScreenshotReviewState,
} from './screenshotReview'

function fingerprint(scope: string, digest: string) {
  return {
    algorithm: 'sha256' as const,
    digest,
    fileCount: 1,
    scope,
  }
}

function fakeState() {
  return finalizeScreenshotReviewState({
    schemaVersion: SCREENSHOT_REVIEW_SCHEMA_VERSION,
    subjectCount: 2,
    variantCount: 4,
    fingerprints: {
      uiSource: fingerprint('app-visual-source-v1', 'a'.repeat(64)),
      screenshotMetadata: {
        algorithm: 'sha256',
        digest: 'b'.repeat(64),
        subjectCount: 2,
        scope: 'manual-screenshot-metadata-v1',
      },
      captureHarness: fingerprint('manual-capture-harness-v1', 'c'.repeat(64)),
    },
    budgets: {
      perFileBytes: MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP,
      totalLibraryBytes: MANUAL_SCREENSHOT_TOTAL_LIBRARY_BYTE_CAP,
    },
    library: {
      totalBytes: 460,
      maxFileBytes: 130,
      maxFilePath: 'public/manual/manual-desktop/second.png',
    },
    subjects: [
      {
        id: 'first',
        variants: {
          mobile: {
            path: 'public/manual/manual-mobile/first.png',
            sha256: '1'.repeat(64),
            bytes: 100,
            width: 393,
            height: 250,
          },
          desktop: {
            path: 'public/manual/manual-desktop/first.png',
            sha256: '2'.repeat(64),
            bytes: 110,
            width: 820,
            height: 250,
          },
        },
      },
      {
        id: 'second',
        variants: {
          mobile: {
            path: 'public/manual/manual-mobile/second.png',
            sha256: '3'.repeat(64),
            bytes: 120,
            width: 393,
            height: 300,
          },
          desktop: {
            path: 'public/manual/manual-desktop/second.png',
            sha256: '4'.repeat(64),
            bytes: 130,
            width: 820,
            height: 300,
          },
        },
      },
    ],
  })
}

function changedState(
  state: ScreenshotReviewState,
  change: (draft: Omit<ScreenshotReviewState, 'reviewStateSha256'>) => void,
) {
  const draft = structuredClone(state) as Partial<ScreenshotReviewState>
  delete draft.reviewStateSha256
  change(draft as Omit<ScreenshotReviewState, 'reviewStateSha256'>)
  return finalizeScreenshotReviewState(draft as Omit<ScreenshotReviewState, 'reviewStateSha256'>)
}

function currentReceipts(state: ScreenshotReviewState) {
  const capture: ScreenshotCaptureCheckReceipt = {
    schemaVersion: SCREENSHOT_REVIEW_SCHEMA_VERSION,
    checkedAt: '2030-01-02T03:04:05.000Z',
    reviewStateSha256: state.reviewStateSha256,
    subjectCount: state.subjectCount,
    variantCount: state.variantCount,
  }
  const pages = (['mobile', 'desktop'] as const).map((variant) => ({
    variant,
    page: 1,
    pageCount: 1,
    path: `artifacts/manual-screenshot-review/contact-sheets/manual-${variant}-01-of-01.svg`,
    sha256: 'd'.repeat(64),
    subjectIds: state.subjects.map((subject) => subject.id),
  }))
  const contact: ScreenshotContactSheetReceipt = {
    schemaVersion: SCREENSHOT_REVIEW_SCHEMA_VERSION,
    reviewStateSha256: state.reviewStateSha256,
    subjectCount: state.subjectCount,
    variantCount: state.variantCount,
    layoutVersion: 1,
    pages,
  }
  return { capture, contact }
}

describe('App Manual screenshot review gate', () => {
  it('serializes deterministic manifests for a fixed review timestamp', () => {
    const state = fakeState()
    const first = createScreenshotReviewManifest(state, '2030-01-02T03:04:05.000Z')
    const second = createScreenshotReviewManifest(structuredClone(state), '2030-01-02T03:04:05.000Z')

    expect(canonicalJson(first)).toBe(canonicalJson(second))
    expect(serializeReviewJson(first)).toBe(serializeReviewJson(second))
  })

  it('fingerprints file content and paths deterministically while detecting source drift', () => {
    const entries = [
      { path: 'src/pages/Page.tsx', sha256: '1'.repeat(64), bytes: 10 },
      { path: 'src/components/core/Card.tsx', sha256: '2'.repeat(64), bytes: 20 },
    ]
    const first = fingerprintFileEntries('test', entries)
    const reordered = fingerprintFileEntries('test', [...entries].reverse())
    const changed = fingerprintFileEntries('test', [
      entries[0],
      { ...entries[1], sha256: '3'.repeat(64) },
    ])

    expect(first).toEqual(reordered)
    expect(changed.digest).not.toBe(first.digest)
  })

  it('covers conservative visual source and mock scopes without tests, secrets, PNGs, builds, or private inventories', async () => {
    const paths = await collectUiSourcePaths()
    expect(paths).toContain('src/pages/AppManualPage.tsx')
    expect(paths).toContain('src/components/manual/ManualScreenshot.module.css')
    expect(paths).toContain('src/constants/routes.ts')
    expect(paths).toContain('src/manual/screenshots.ts')
    expect(paths).toContain('src/test/mocks/hakitCoreState.ts')
    expect(paths).toContain('src/test/mocks/generated/appEntities.ts')
    expect(paths).toContain('scripts/manual/mockFixture.ts')
    expect(paths).toContain('package-lock.json')
    expect(paths.some((path) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))).toBe(false)
    expect(paths.some((path) => path.startsWith('public/manual/'))).toBe(false)
    expect(paths.some((path) => path.startsWith('dist/'))).toBe(false)
    expect(paths.some((path) => path.includes('.env'))).toBe(false)
    expect(paths.some((path) => /scripts\/manual\/generated\/(?:haInventory|behaviorOwnershipAudit|behaviorConfigReview)\.json/.test(path))).toBe(false)
  })

  it('detects UI/source, screenshot metadata, and capture-harness drift', () => {
    const state = fakeState()
    const manifest = createScreenshotReviewManifest(state, '2030-01-02T03:04:05.000Z')
    const uiDrift = changedState(state, (draft) => {
      draft.fingerprints.uiSource.digest = '9'.repeat(64)
    })
    const metadataDrift = changedState(state, (draft) => {
      draft.fingerprints.screenshotMetadata.digest = '8'.repeat(64)
    })
    const harnessDrift = changedState(state, (draft) => {
      draft.fingerprints.captureHarness.digest = '7'.repeat(64)
    })

    expect(screenshotReviewApprovalIssues(manifest, uiDrift).join('\n')).toMatch(/UI\/source fingerprint changed/)
    expect(screenshotReviewApprovalIssues(manifest, metadataDrift).join('\n')).toMatch(/metadata fingerprint changed/)
    expect(screenshotReviewApprovalIssues(manifest, harnessDrift).join('\n')).toMatch(/capture-harness fingerprint changed/)
  })

  it('detects image-set, hash, byte-size, and dimension drift', () => {
    const state = fakeState()
    const manifest = createScreenshotReviewManifest(state, '2030-01-02T03:04:05.000Z')
    const imageSetDrift = structuredClone(manifest)
    imageSetDrift.subjects.pop()
    const hashDrift = structuredClone(manifest)
    hashDrift.subjects[0].variants.mobile.sha256 = 'f'.repeat(64)
    const sizeDrift = structuredClone(manifest)
    sizeDrift.subjects[0].variants.mobile.bytes += 1
    const dimensionDrift = structuredClone(manifest)
    dimensionDrift.subjects[0].variants.mobile.height += 1

    expect(screenshotReviewApprovalIssues(imageSetDrift, state).join('\n')).toMatch(/subject set/)
    expect(screenshotReviewApprovalIssues(hashDrift, state).join('\n')).toMatch(/PNG SHA-256 changed/)
    expect(screenshotReviewApprovalIssues(sizeDrift, state).join('\n')).toMatch(/PNG byte size changed/)
    expect(screenshotReviewApprovalIssues(dimensionDrift, state).join('\n')).toMatch(/PNG dimensions changed/)
  })

  it('enforces per-file and total-library byte budgets', () => {
    expect(screenshotBudgetIssues([
      { path: 'one.png', bytes: MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP },
    ])).toEqual([])
    expect(screenshotBudgetIssues([
      { path: 'one.png', bytes: MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP + 1 },
    ]).join('\n')).toMatch(/per-file cap/)
    expect(screenshotBudgetIssues([
      { path: 'one.png', bytes: 60 },
      { path: 'two.png', bytes: 60 },
    ], 100, 100).join('\n')).toMatch(/total cap/)
  })

  it('requires current capture-check and complete contact-sheet receipts before approval', () => {
    const state = fakeState()
    const receipts = currentReceipts(state)
    expect(screenshotApprovalReceiptIssues(state, receipts.capture, receipts.contact)).toEqual([])
    expect(screenshotApprovalReceiptIssues(state, undefined, undefined).join('\n')).toMatch(/capture-check receipt/)
    expect(screenshotApprovalReceiptIssues(state, undefined, undefined).join('\n')).toMatch(/contact-sheet review artifact/)

    const staleCapture = { ...receipts.capture, reviewStateSha256: '0'.repeat(64) }
    const incompleteContact = structuredClone(receipts.contact)
    incompleteContact.pages[0].subjectIds.pop()
    expect(screenshotApprovalReceiptIssues(state, staleCapture, incompleteContact).join('\n')).toMatch(/capture-check receipt is stale/)
    expect(screenshotApprovalReceiptIssues(state, staleCapture, incompleteContact).join('\n')).toMatch(/do not cover every mobile screenshot/)
  })

  it('fails check behavior when approval is missing and accepts an exact manifest', () => {
    const state = fakeState()
    expect(screenshotReviewApprovalIssues(undefined, state).join('\n')).toMatch(/approval is missing/)
    const manifest = createScreenshotReviewManifest(state, '2030-01-02T03:04:05.000Z')
    expect(screenshotReviewApprovalIssues(manifest, state)).toEqual([])
  })

  it('rejects sensitive paths and credential-like content', () => {
    expect(sensitiveManifestIssues({ path: '/home/private/review.json' }).join('\n')).toMatch(/absolute/)
    expect(sensitiveManifestIssues({ path: '.env.development' }).join('\n')).toMatch(/credential/)
    expect(sensitiveManifestIssues({ value: 'VITE_HA_TOKEN=secret' }).join('\n')).toMatch(/credential/)
    expect(sensitiveManifestIssues({ path: 'scripts/manual/generated/haInventory.json' }).join('\n')).toMatch(/private Home Assistant inventory/)
    expect(sensitiveManifestIssues(createScreenshotReviewManifest(fakeState(), '2030-01-02T03:04:05.000Z'))).toEqual([])
  })

  it('keeps the committed manifest current, private, deterministic, and sensitive-data free', async () => {
    const source = await readFile(resolve(process.cwd(), SCREENSHOT_REVIEW_MANIFEST_PATH), 'utf8')
    const manifest = JSON.parse(source) as ScreenshotReviewManifest
    expect(source).toBe(serializeReviewJson(manifest))
    expect(sensitiveManifestIssues(source)).toEqual([])

    const result = await checkScreenshotReviewApproval()
    expect(result.issues).toEqual([])
    expect(result.state?.subjectCount).toBe(manifest.subjectCount)
    expect(result.state?.variantCount).toBe(manifest.variantCount)
  })
})
