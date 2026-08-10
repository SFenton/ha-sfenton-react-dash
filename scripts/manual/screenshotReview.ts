import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  MANUAL_SCREENSHOTS,
  type ManualScreenshotConfig,
} from '../../src/manual/screenshots'

export const SCREENSHOT_REVIEW_SCHEMA_VERSION = 1
export const SCREENSHOT_REVIEW_MANIFEST_PATH = 'scripts/manual/generated/screenshotReviewManifest.json'
export const SCREENSHOT_REVIEW_ARTIFACT_DIRECTORY = 'artifacts/manual-screenshot-review'
export const SCREENSHOT_CAPTURE_CHECK_RECEIPT_PATH = `${SCREENSHOT_REVIEW_ARTIFACT_DIRECTORY}/captureCheckReceipt.json`
export const SCREENSHOT_CONTACT_SHEET_RECEIPT_PATH = `${SCREENSHOT_REVIEW_ARTIFACT_DIRECTORY}/contactSheetReview.json`

export const MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP = 768 * 1024
export const MANUAL_SCREENSHOT_TOTAL_LIBRARY_BYTE_CAP = 25_000_000

export const MANUAL_SCREENSHOT_VARIANTS = [
  { key: 'mobile', project: 'manual-mobile' },
  { key: 'desktop', project: 'manual-desktop' },
] as const

export const SCREENSHOT_UI_SOURCE_SCOPE = 'app-visual-source-v1'
export const SCREENSHOT_METADATA_SCOPE = 'manual-screenshot-metadata-v1'
export const SCREENSHOT_CAPTURE_HARNESS_SCOPE = 'manual-capture-harness-v1'

export const SCREENSHOT_CAPTURE_HARNESS_PATHS = [
  'e2e/manual-screenshots.spec.ts',
  'playwright.config.ts',
  'scripts/manual/contactSheets.ts',
  'scripts/manual/runScreenshotSuite.ts',
  'scripts/manual/screenshotReview.ts',
] as const

const UI_SOURCE_ROOT_FILES = [
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
] as const

const UI_SOURCE_MOCK_FILES = [
  'scripts/manual/mockFixture.ts',
] as const

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export type ManualScreenshotVariantKey = (typeof MANUAL_SCREENSHOT_VARIANTS)[number]['key']

export interface ScreenshotFingerprint {
  algorithm: 'sha256'
  digest: string
  fileCount: number
  scope: string
}

export interface ScreenshotMetadataFingerprint {
  algorithm: 'sha256'
  digest: string
  subjectCount: number
  scope: string
}

export interface ScreenshotVariantReview {
  path: string
  sha256: string
  bytes: number
  width: number
  height: number
}

export interface ScreenshotSubjectReview {
  id: string
  variants: Record<ManualScreenshotVariantKey, ScreenshotVariantReview>
}

export interface ScreenshotReviewState {
  schemaVersion: number
  subjectCount: number
  variantCount: number
  fingerprints: {
    uiSource: ScreenshotFingerprint
    screenshotMetadata: ScreenshotMetadataFingerprint
    captureHarness: ScreenshotFingerprint
  }
  budgets: {
    perFileBytes: number
    totalLibraryBytes: number
  }
  library: {
    totalBytes: number
    maxFileBytes: number
    maxFilePath: string
  }
  subjects: ScreenshotSubjectReview[]
  reviewStateSha256: string
}

export interface ScreenshotReviewManifest extends ScreenshotReviewState {
  reviewedAt: string
}

export interface ScreenshotCaptureCheckReceipt {
  schemaVersion: number
  checkedAt: string
  reviewStateSha256: string
  subjectCount: number
  variantCount: number
}

export interface ScreenshotContactSheetPage {
  variant: ManualScreenshotVariantKey
  page: number
  pageCount: number
  path: string
  sha256: string
  subjectIds: string[]
}

export interface ScreenshotContactSheetReceipt {
  schemaVersion: number
  reviewStateSha256: string
  subjectCount: number
  variantCount: number
  layoutVersion: number
  pages: ScreenshotContactSheetPage[]
}

export interface FileFingerprintEntry {
  path: string
  sha256: string
  bytes: number
}

interface ScreenshotLibraryInspection {
  subjects: ScreenshotSubjectReview[]
  files: ScreenshotVariantReview[]
  issues: string[]
}

export interface CurrentScreenshotReviewInspection {
  state?: ScreenshotReviewState
  issues: string[]
  uiSourcePaths: string[]
  captureHarnessPaths: string[]
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)]),
  )
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalValue(value))
}

export function serializeReviewJson(value: unknown) {
  return `${JSON.stringify(canonicalValue(value), null, 2)}\n`
}

function isTestSourcePath(path: string) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
    || path.includes('/__tests__/')
    || (path.startsWith('src/test/') && !path.startsWith('src/test/mocks/'))
}

function isSensitiveSourcePath(path: string) {
  const name = basename(path)
  return name === '.env'
    || name.startsWith('.env.')
    || ['.key', '.pem', '.p12', '.pfx'].includes(extname(name).toLowerCase())
    || path.includes('/.certs/')
}

export function isUiSourcePath(path: string) {
  const normalized = path.replaceAll('\\', '/')
  if (isSensitiveSourcePath(normalized) || isTestSourcePath(normalized)) return false
  if (normalized.startsWith('public/manual/')) return false
  if (normalized.startsWith('dist/') || normalized.startsWith('dist-ssr/')) return false
  if (normalized.startsWith('src/')) return true
  if (normalized.startsWith('public/')) return true
  return UI_SOURCE_ROOT_FILES.includes(normalized as (typeof UI_SOURCE_ROOT_FILES)[number])
    || UI_SOURCE_MOCK_FILES.includes(normalized as (typeof UI_SOURCE_MOCK_FILES)[number])
}

async function walkFiles(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return walkFiles(root, path)
    return entry.isFile() ? [path] : []
  }))
  return paths.flat()
}

export async function collectUiSourcePaths(root = process.cwd()) {
  const candidates = [
    ...await walkFiles(root, 'src'),
    ...await walkFiles(root, 'public'),
    ...UI_SOURCE_ROOT_FILES,
    ...UI_SOURCE_MOCK_FILES,
  ]
  return [...new Set(candidates.filter(isUiSourcePath))].sort()
}

async function fileFingerprintEntries(root: string, paths: readonly string[]) {
  return Promise.all([...paths].sort().map(async (path): Promise<FileFingerprintEntry> => {
    const content = await readFile(resolve(root, path))
    return {
      path,
      sha256: sha256(content),
      bytes: content.byteLength,
    }
  }))
}

export function fingerprintFileEntries(scope: string, entries: readonly FileFingerprintEntry[]): ScreenshotFingerprint {
  const normalized = [...entries].sort((left, right) => left.path.localeCompare(right.path))
  return {
    algorithm: 'sha256',
    digest: sha256(canonicalJson(normalized)),
    fileCount: normalized.length,
    scope,
  }
}

export async function collectUiSourceFingerprint(root = process.cwd()) {
  const paths = await collectUiSourcePaths(root)
  return {
    fingerprint: fingerprintFileEntries(SCREENSHOT_UI_SOURCE_SCOPE, await fileFingerprintEntries(root, paths)),
    paths,
  }
}

export async function collectCaptureHarnessFingerprint(root = process.cwd()) {
  const paths = [...SCREENSHOT_CAPTURE_HARNESS_PATHS]
  return {
    fingerprint: fingerprintFileEntries(
      SCREENSHOT_CAPTURE_HARNESS_SCOPE,
      await fileFingerprintEntries(root, paths),
    ),
    paths,
  }
}

export function screenshotMetadataFingerprint(
  screenshots: readonly ManualScreenshotConfig[] = MANUAL_SCREENSHOTS,
): ScreenshotMetadataFingerprint {
  return {
    algorithm: 'sha256',
    digest: sha256(canonicalJson(screenshots)),
    subjectCount: screenshots.length,
    scope: SCREENSHOT_METADATA_SCOPE,
  }
}

function pngDimensions(content: Buffer, path: string) {
  if (content.length < 24 || !content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${path} is not a valid PNG file.`)
  }
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
  }
}

async function pngPaths(root: string, project: string) {
  const directory = resolve(root, 'public/manual', project)
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => `public/manual/${project}/${entry.name}`)
    .sort()
}

async function inspectScreenshotLibrary(
  root: string,
  screenshots: readonly ManualScreenshotConfig[],
): Promise<ScreenshotLibraryInspection> {
  const issues: string[] = []
  const subjectRecords = new Map<string, Partial<Record<ManualScreenshotVariantKey, ScreenshotVariantReview>>>(
    screenshots.map((screenshot) => [screenshot.id, {}]),
  )
  const files: ScreenshotVariantReview[] = []

  for (const variant of MANUAL_SCREENSHOT_VARIANTS) {
    const actualPaths = await pngPaths(root, variant.project).catch(() => undefined)
    if (!actualPaths) {
      issues.push(`Missing screenshot directory public/manual/${variant.project}.`)
      continue
    }

    const expectedPaths = screenshots
      .map((screenshot) => `public/manual/${variant.project}/${screenshot.id}.png`)
      .sort()
    const actualSet = new Set(actualPaths)
    const expectedSet = new Set(expectedPaths)
    const missing = expectedPaths.filter((path) => !actualSet.has(path))
    const extra = actualPaths.filter((path) => !expectedSet.has(path))
    if (missing.length > 0 || extra.length > 0) {
      issues.push(
        `${variant.project} screenshot set changed.`
        + `${missing.length > 0 ? ` Missing: ${missing.join(', ')}.` : ''}`
        + `${extra.length > 0 ? ` Extra: ${extra.join(', ')}.` : ''}`,
      )
    }

    for (const screenshot of screenshots) {
      const path = `public/manual/${variant.project}/${screenshot.id}.png`
      if (!actualSet.has(path)) continue
      try {
        const content = await readFile(resolve(root, path))
        const dimensions = pngDimensions(content, path)
        const record = {
          path,
          sha256: sha256(content),
          bytes: content.byteLength,
          ...dimensions,
        }
        subjectRecords.get(screenshot.id)![variant.key] = record
        files.push(record)
      } catch (error) {
        issues.push(error instanceof Error ? error.message : `Could not read ${path}.`)
      }
    }
  }

  const subjects: ScreenshotSubjectReview[] = []
  for (const screenshot of screenshots) {
    const variants = subjectRecords.get(screenshot.id)
    if (!variants?.mobile || !variants.desktop) continue
    subjects.push({
      id: screenshot.id,
      variants: {
        mobile: variants.mobile,
        desktop: variants.desktop,
      },
    })
  }

  return { subjects, files, issues }
}

export function screenshotBudgetIssues(
  files: readonly Pick<ScreenshotVariantReview, 'bytes' | 'path'>[],
  perFileCap = MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP,
  totalLibraryCap = MANUAL_SCREENSHOT_TOTAL_LIBRARY_BYTE_CAP,
) {
  const issues = files
    .filter((file) => file.bytes > perFileCap)
    .map((file) => `${file.path} is ${file.bytes} bytes, above the ${perFileCap}-byte per-file cap.`)
  const totalBytes = files.reduce((total, file) => total + file.bytes, 0)
  if (totalBytes > totalLibraryCap) {
    issues.push(`The screenshot library is ${totalBytes} bytes, above the ${totalLibraryCap}-byte total cap.`)
  }
  return issues
}

export function finalizeScreenshotReviewState(
  value: Omit<ScreenshotReviewState, 'reviewStateSha256'>,
): ScreenshotReviewState {
  return {
    ...value,
    reviewStateSha256: sha256(canonicalJson(value)),
  }
}

export async function inspectCurrentScreenshotReview(
  root = process.cwd(),
  screenshots: readonly ManualScreenshotConfig[] = MANUAL_SCREENSHOTS,
): Promise<CurrentScreenshotReviewInspection> {
  const [library, uiSource, captureHarness] = await Promise.all([
    inspectScreenshotLibrary(root, screenshots),
    collectUiSourceFingerprint(root),
    collectCaptureHarnessFingerprint(root),
  ])
  const issues = [
    ...library.issues,
    ...screenshotBudgetIssues(library.files),
  ]
  if (library.subjects.length !== screenshots.length) {
    issues.push(`Expected ${screenshots.length} complete screenshot subjects but found ${library.subjects.length}.`)
  }
  const variantCount = library.files.length
  if (variantCount !== screenshots.length * MANUAL_SCREENSHOT_VARIANTS.length) {
    issues.push(`Expected ${screenshots.length * MANUAL_SCREENSHOT_VARIANTS.length} PNG variants but found ${variantCount}.`)
  }

  const maxFile = [...library.files].sort((left, right) => (
    right.bytes - left.bytes || left.path.localeCompare(right.path)
  ))[0]
  const state = issues.some((issue) => issue.includes('Missing screenshot directory') || issue.includes('is not a valid PNG'))
    || library.subjects.length !== screenshots.length
    || variantCount !== screenshots.length * MANUAL_SCREENSHOT_VARIANTS.length
    ? undefined
    : finalizeScreenshotReviewState({
        schemaVersion: SCREENSHOT_REVIEW_SCHEMA_VERSION,
        subjectCount: screenshots.length,
        variantCount,
        fingerprints: {
          uiSource: uiSource.fingerprint,
          screenshotMetadata: screenshotMetadataFingerprint(screenshots),
          captureHarness: captureHarness.fingerprint,
        },
        budgets: {
          perFileBytes: MANUAL_SCREENSHOT_PER_FILE_BYTE_CAP,
          totalLibraryBytes: MANUAL_SCREENSHOT_TOTAL_LIBRARY_BYTE_CAP,
        },
        library: {
          totalBytes: library.files.reduce((total, file) => total + file.bytes, 0),
          maxFileBytes: maxFile?.bytes ?? 0,
          maxFilePath: maxFile?.path ?? '',
        },
        subjects: library.subjects,
      })

  return {
    state,
    issues,
    uiSourcePaths: uiSource.paths,
    captureHarnessPaths: captureHarness.paths,
  }
}

export function createScreenshotReviewManifest(
  state: ScreenshotReviewState,
  reviewedAt: string,
): ScreenshotReviewManifest {
  const parsedTimestamp = new Date(reviewedAt)
  if (Number.isNaN(parsedTimestamp.getTime()) || parsedTimestamp.toISOString() !== reviewedAt) {
    throw new Error('Screenshot review timestamps must be canonical ISO-8601 UTC values.')
  }
  return {
    ...state,
    reviewedAt,
  }
}

function orderedSubjectIds(value: Pick<ScreenshotReviewState, 'subjects'>) {
  return value.subjects.map((subject) => subject.id)
}

export function sensitiveManifestIssues(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const issues: string[] = []
  if (/(?:^|[/"])\/(?:home|Users|var\/tmp|tmp)\//.test(text) || /[A-Za-z]:\\/.test(text)) {
    issues.push('The screenshot review manifest contains an absolute or temporary filesystem path.')
  }
  if (/(?:^|[/"])\.env(?:[./"]|$)/i.test(text) || /VITE_HA_TOKEN|access[_-]?token|bearer\s+[A-Za-z0-9._-]+/i.test(text)) {
    issues.push('The screenshot review manifest contains environment or credential-like content.')
  }
  if (/scripts\/manual\/generated\/(?:haInventory|behaviorOwnershipAudit|behaviorConfigReview)\.json/i.test(text)) {
    issues.push('The screenshot review manifest exposes a private Home Assistant inventory path.')
  }
  return issues
}

export function screenshotReviewApprovalIssues(
  manifest: ScreenshotReviewManifest | undefined,
  state: ScreenshotReviewState,
) {
  if (!manifest) return ['Screenshot review approval is missing. Run npm run manual:screenshots:approve only after capture check and visual contact-sheet review.']

  const issues = [...sensitiveManifestIssues(manifest)]
  if (manifest.schemaVersion !== SCREENSHOT_REVIEW_SCHEMA_VERSION) {
    issues.push(`Screenshot review schema changed from ${manifest.schemaVersion} to ${SCREENSHOT_REVIEW_SCHEMA_VERSION}.`)
  }
  const reviewedAt = new Date(manifest.reviewedAt)
  if (Number.isNaN(reviewedAt.getTime()) || reviewedAt.toISOString() !== manifest.reviewedAt) {
    issues.push('Screenshot review approval has an invalid reviewedAt timestamp.')
  }
  if (manifest.subjectCount !== state.subjectCount || manifest.variantCount !== state.variantCount) {
    issues.push(`Screenshot review counts changed from ${manifest.subjectCount}/${manifest.variantCount} to ${state.subjectCount}/${state.variantCount}.`)
  }
  if (canonicalJson(orderedSubjectIds(manifest)) !== canonicalJson(orderedSubjectIds(state))) {
    issues.push('Screenshot subject set or configured order changed.')
  }
  if (canonicalJson(manifest.fingerprints.uiSource) !== canonicalJson(state.fingerprints.uiSource)) {
    issues.push('The UI/source fingerprint changed; screenshots require capture check, contact-sheet review, and explicit approval.')
  }
  if (canonicalJson(manifest.fingerprints.screenshotMetadata) !== canonicalJson(state.fingerprints.screenshotMetadata)) {
    issues.push('The screenshot metadata fingerprint changed; capture scenarios require review and explicit approval.')
  }
  if (canonicalJson(manifest.fingerprints.captureHarness) !== canonicalJson(state.fingerprints.captureHarness)) {
    issues.push('The screenshot capture-harness fingerprint changed; recapture verification and explicit approval are required.')
  }
  if (canonicalJson(manifest.budgets) !== canonicalJson(state.budgets)) {
    issues.push('Screenshot byte-budget constants changed without a new approval.')
  }

  const manifestSubjects = new Map(manifest.subjects.map((subject) => [subject.id, subject]))
  for (const subject of state.subjects) {
    const reviewedSubject = manifestSubjects.get(subject.id)
    if (!reviewedSubject) continue
    if (canonicalJson(Object.keys(reviewedSubject.variants).sort()) !== canonicalJson(MANUAL_SCREENSHOT_VARIANTS.map((variant) => variant.key).sort())) {
      issues.push(`Screenshot variant set changed for ${subject.id}.`)
    }
    for (const variant of MANUAL_SCREENSHOT_VARIANTS) {
      const reviewed = reviewedSubject.variants[variant.key]
      const current = subject.variants[variant.key]
      if (!reviewed) {
        issues.push(`Screenshot variant set changed for ${subject.id}; ${variant.key} is missing from approval.`)
        continue
      }
      if (reviewed.path !== current.path) {
        issues.push(`Screenshot variant path changed for ${subject.id} ${variant.key}.`)
      }
      if (reviewed.sha256 !== current.sha256) {
        issues.push(`PNG SHA-256 changed for ${current.path}.`)
      }
      if (reviewed.bytes !== current.bytes) {
        issues.push(`PNG byte size changed for ${current.path}: ${reviewed.bytes} -> ${current.bytes}.`)
      }
      if (reviewed.width !== current.width || reviewed.height !== current.height) {
        issues.push(`PNG dimensions changed for ${current.path}.`)
      }
    }
  }
  for (const reviewedSubject of manifest.subjects) {
    if (!state.subjects.some((subject) => subject.id === reviewedSubject.id)) {
      issues.push(`Approved screenshot subject ${reviewedSubject.id} is no longer configured.`)
    }
  }
  if (canonicalJson(manifest.library) !== canonicalJson(state.library)) {
    issues.push('Screenshot library byte totals or maximum-file metadata changed.')
  }
  if (manifest.reviewStateSha256 !== state.reviewStateSha256) {
    issues.push('The aggregate screenshot review state changed.')
  }
  return [...new Set(issues)]
}

async function readJson<T>(root: string, path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(resolve(root, path), 'utf8')) as T
  } catch {
    return undefined
  }
}

export async function checkScreenshotReviewApproval(root = process.cwd()) {
  const inspection = await inspectCurrentScreenshotReview(root)
  if (!inspection.state) return inspection
  const manifest = await readJson<ScreenshotReviewManifest>(root, SCREENSHOT_REVIEW_MANIFEST_PATH)
  return {
    ...inspection,
    issues: [
      ...inspection.issues,
      ...screenshotReviewApprovalIssues(manifest, inspection.state),
    ],
  }
}

export function screenshotApprovalReceiptIssues(
  state: ScreenshotReviewState,
  captureReceipt: ScreenshotCaptureCheckReceipt | undefined,
  contactSheetReceipt: ScreenshotContactSheetReceipt | undefined,
) {
  const issues: string[] = []
  if (!captureReceipt) {
    issues.push('No current capture-check receipt exists. Run npm run manual:capture:check.')
  } else if (
    captureReceipt.schemaVersion !== SCREENSHOT_REVIEW_SCHEMA_VERSION
    || captureReceipt.reviewStateSha256 !== state.reviewStateSha256
    || captureReceipt.subjectCount !== state.subjectCount
    || captureReceipt.variantCount !== state.variantCount
  ) {
    issues.push('The capture-check receipt is stale. Run npm run manual:capture:check again.')
  }

  if (!contactSheetReceipt) {
    issues.push('No current contact-sheet review artifact exists. Run npm run manual:screenshots:review and inspect every page.')
  } else {
    if (
      contactSheetReceipt.schemaVersion !== SCREENSHOT_REVIEW_SCHEMA_VERSION
      || contactSheetReceipt.reviewStateSha256 !== state.reviewStateSha256
      || contactSheetReceipt.subjectCount !== state.subjectCount
      || contactSheetReceipt.variantCount !== state.variantCount
    ) {
      issues.push('The contact-sheet review artifact is stale. Regenerate and inspect every page.')
    }
    for (const variant of MANUAL_SCREENSHOT_VARIANTS) {
      const coveredIds = contactSheetReceipt.pages
        .filter((page) => page.variant === variant.key)
        .sort((left, right) => left.page - right.page)
        .flatMap((page) => page.subjectIds)
      if (canonicalJson(coveredIds) !== canonicalJson(orderedSubjectIds(state))) {
        issues.push(`Contact sheets do not cover every ${variant.key} screenshot exactly once in configured order.`)
      }
    }
  }
  return issues
}

async function contactSheetFileIssues(root: string, receipt: ScreenshotContactSheetReceipt) {
  const issues: string[] = []
  for (const page of receipt.pages) {
    try {
      const content = await readFile(resolve(root, page.path))
      if (sha256(content) !== page.sha256) issues.push(`Contact sheet ${page.path} changed after generation.`)
    } catch {
      issues.push(`Contact sheet ${page.path} is missing.`)
    }
  }
  return issues
}

async function currentStateOrThrow(root: string) {
  const inspection = await inspectCurrentScreenshotReview(root)
  if (!inspection.state || inspection.issues.length > 0) {
    throw new Error(`Screenshot review state is not approvable:\n- ${inspection.issues.join('\n- ')}`)
  }
  return inspection.state
}

export async function recordScreenshotCaptureCheck(root = process.cwd(), checkedAt = new Date().toISOString()) {
  const state = await currentStateOrThrow(root)
  const receipt: ScreenshotCaptureCheckReceipt = {
    schemaVersion: SCREENSHOT_REVIEW_SCHEMA_VERSION,
    checkedAt,
    reviewStateSha256: state.reviewStateSha256,
    subjectCount: state.subjectCount,
    variantCount: state.variantCount,
  }
  const path = resolve(root, SCREENSHOT_CAPTURE_CHECK_RECEIPT_PATH)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, serializeReviewJson(receipt))
  return receipt
}

export async function approveScreenshotReview(root = process.cwd(), reviewedAt = new Date().toISOString()) {
  const state = await currentStateOrThrow(root)
  const [captureReceipt, contactSheetReceipt] = await Promise.all([
    readJson<ScreenshotCaptureCheckReceipt>(root, SCREENSHOT_CAPTURE_CHECK_RECEIPT_PATH),
    readJson<ScreenshotContactSheetReceipt>(root, SCREENSHOT_CONTACT_SHEET_RECEIPT_PATH),
  ])
  const receiptIssues = [
    ...screenshotApprovalReceiptIssues(state, captureReceipt, contactSheetReceipt),
    ...(contactSheetReceipt ? await contactSheetFileIssues(root, contactSheetReceipt) : []),
  ]
  if (receiptIssues.length > 0) {
    throw new Error(`Screenshot review cannot be approved:\n- ${receiptIssues.join('\n- ')}`)
  }

  const manifest = createScreenshotReviewManifest(state, reviewedAt)
  const path = resolve(root, SCREENSHOT_REVIEW_MANIFEST_PATH)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, serializeReviewJson(manifest))
  return manifest
}

async function runCli() {
  const command = process.argv[2]
  if (command === 'record-capture-check') {
    const receipt = await recordScreenshotCaptureCheck()
    console.log(`Recorded a passing capture check for ${receipt.subjectCount} subjects / ${receipt.variantCount} variants.`)
    return
  }
  if (command === 'approve') {
    const manifest = await approveScreenshotReview()
    console.log(`Recorded the already completed visual review in ${SCREENSHOT_REVIEW_MANIFEST_PATH}.`)
    console.log('This command did not capture screenshots or perform visual review; it persisted approval only after current capture-check and contact-sheet receipts matched.')
    console.log(`Approved ${manifest.subjectCount} subjects / ${manifest.variantCount} variants (${manifest.library.totalBytes} bytes total; ${manifest.library.maxFileBytes} bytes max).`)
    return
  }
  if (command === 'check') {
    const result = await checkScreenshotReviewApproval()
    if (result.issues.length > 0) throw new Error(`Screenshot review checks failed:\n- ${result.issues.join('\n- ')}`)
    console.log(`Screenshot review approval is current for ${result.state?.subjectCount ?? 0} subjects / ${result.state?.variantCount ?? 0} variants.`)
    return
  }
  throw new Error('Usage: tsx scripts/manual/screenshotReview.ts <record-capture-check|approve|check>')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  await runCli()
}
