import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  MANUAL_SCREENSHOT_VARIANTS,
  SCREENSHOT_CONTACT_SHEET_RECEIPT_PATH,
  SCREENSHOT_REVIEW_ARTIFACT_DIRECTORY,
  SCREENSHOT_REVIEW_SCHEMA_VERSION,
  canonicalJson,
  inspectCurrentScreenshotReview,
  serializeReviewJson,
  type ManualScreenshotVariantKey,
  type ScreenshotContactSheetPage,
  type ScreenshotContactSheetReceipt,
  type ScreenshotSubjectReview,
  type ScreenshotVariantReview,
} from './screenshotReview'
import { createHash } from 'node:crypto'

export const SCREENSHOT_CONTACT_SHEET_LAYOUT_VERSION = 1
export const SCREENSHOT_CONTACT_SHEET_DIRECTORY = `${SCREENSHOT_REVIEW_ARTIFACT_DIRECTORY}/contact-sheets`

const PAGE_WIDTH = 2400
const PAGE_HEIGHT = 3200
const PAGE_MARGIN = 48
const PAGE_HEADER_HEIGHT = 128
const GRID_GAP = 24
const GRID_ROWS = 4

const VARIANT_COLUMNS: Record<ManualScreenshotVariantKey, number> = {
  mobile: 5,
  desktop: 3,
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function humanBytes(bytes: number) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function imagePlacement(
  image: Pick<ScreenshotVariantReview, 'height' | 'width'>,
  box: { x: number; y: number; width: number; height: number },
) {
  const scale = Math.min(box.width / image.width, box.height / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  return {
    width,
    height,
    x: Math.round(box.x + (box.width - width) / 2),
    y: Math.round(box.y + (box.height - height) / 2),
  }
}

async function renderContactSheetPage(
  root: string,
  variant: ManualScreenshotVariantKey,
  page: number,
  pageCount: number,
  allSubjectCount: number,
  subjects: readonly ScreenshotSubjectReview[],
  subjectOffset: number,
) {
  const columns = VARIANT_COLUMNS[variant]
  const gridWidth = PAGE_WIDTH - PAGE_MARGIN * 2
  const gridHeight = PAGE_HEIGHT - PAGE_MARGIN * 2 - PAGE_HEADER_HEIGHT
  const cellWidth = Math.floor((gridWidth - GRID_GAP * (columns - 1)) / columns)
  const cellHeight = Math.floor((gridHeight - GRID_GAP * (GRID_ROWS - 1)) / GRID_ROWS)
  const labelHeight = 66
  const cardPadding = 14
  const cards = await Promise.all(subjects.map(async (subject, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = PAGE_MARGIN + column * (cellWidth + GRID_GAP)
    const y = PAGE_MARGIN + PAGE_HEADER_HEIGHT + row * (cellHeight + GRID_GAP)
    const image = subject.variants[variant]
    const placement = imagePlacement(image, {
      x: x + cardPadding,
      y: y + labelHeight,
      width: cellWidth - cardPadding * 2,
      height: cellHeight - labelHeight - cardPadding,
    })
    const source = await readFile(resolve(root, image.path))
    const label = `${String(subjectOffset + index + 1).padStart(3, '0')}/${allSubjectCount} · ${subject.id}`
    const detail = `${image.width}×${image.height} · ${humanBytes(image.bytes)}`
    return [
      `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="20" fill="#151a23" stroke="#3a4353" stroke-width="2"/>`,
      `<text x="${x + cardPadding}" y="${y + 28}" fill="#f5f7fb" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(label)}</text>`,
      `<text x="${x + cardPadding}" y="${y + 54}" fill="#aab4c4" font-family="Arial, sans-serif" font-size="18">${escapeXml(detail)}</text>`,
      `<rect x="${placement.x - 2}" y="${placement.y - 2}" width="${placement.width + 4}" height="${placement.height + 4}" fill="#080b10" stroke="#68758a" stroke-width="2"/>`,
      `<image x="${placement.x}" y="${placement.y}" width="${placement.width}" height="${placement.height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${source.toString('base64')}"/>`,
    ].join('\n')
  }))

  const first = subjects[0]?.id ?? 'none'
  const last = subjects.at(-1)?.id ?? 'none'
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">`,
    `<rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#090d14"/>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 38}" fill="#ffffff" font-family="Arial, sans-serif" font-size="38" font-weight="700">App Manual ${variant} screenshot review · page ${page}/${pageCount}</text>`,
    `<text x="${PAGE_MARGIN}" y="${PAGE_MARGIN + 78}" fill="#aab4c4" font-family="Arial, sans-serif" font-size="22">Configured order · ${escapeXml(first)} through ${escapeXml(last)} · generation does not approve visual review</text>`,
    cards.join('\n'),
    '</svg>',
    '',
  ].join('\n')
}

function contactSheetIndex(pages: readonly ScreenshotContactSheetPage[]) {
  const groups = MANUAL_SCREENSHOT_VARIANTS.map((variant) => ({
    ...variant,
    pages: pages.filter((page) => page.variant === variant.key),
  }))
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <title>App Manual screenshot review</title>',
    '  <style>body{margin:0;padding:32px;background:#090d14;color:#fff;font:16px Arial,sans-serif}h1,h2{margin:0 0 16px}p{color:#aab4c4}.pages{display:grid;gap:28px}.page{display:block;width:min(100%,1200px);background:#151a23;border:1px solid #3a4353}</style>',
    '</head>',
    '<body>',
    '  <h1>App Manual screenshot contact sheets</h1>',
    '  <p>Inspect every labeled page. Generating these artifacts does not approve visual review.</p>',
    ...groups.flatMap((group) => [
      `  <h2>${group.key}</h2>`,
      '  <div class="pages">',
      ...group.pages.map((page) => `    <object class="page" data="${page.path.split('/').at(-1)}" type="image/svg+xml" aria-label="${group.key} contact sheet page ${page.page}"></object>`),
      '  </div>',
    ]),
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

async function clearGeneratedContactSheets(root: string) {
  const directory = resolve(root, SCREENSHOT_CONTACT_SHEET_DIRECTORY)
  await mkdir(directory, { recursive: true })
  const entries = await readdir(directory, { withFileTypes: true })
  await Promise.all(entries
    .filter((entry) => entry.isFile() && (
      /^manual-(?:mobile|desktop)-\d+-of-\d+\.svg$/.test(entry.name)
      || entry.name === 'index.html'
    ))
    .map((entry) => unlink(resolve(directory, entry.name))))
}

export async function generateScreenshotContactSheets(root = process.cwd()) {
  const inspection = await inspectCurrentScreenshotReview(root)
  if (!inspection.state || inspection.issues.length > 0) {
    throw new Error(`Cannot generate contact sheets:\n- ${inspection.issues.join('\n- ')}`)
  }
  const state = inspection.state
  await clearGeneratedContactSheets(root)

  const pages: ScreenshotContactSheetPage[] = []
  for (const variant of MANUAL_SCREENSHOT_VARIANTS) {
    const columns = VARIANT_COLUMNS[variant.key]
    const subjectsPerPage = columns * GRID_ROWS
    const pageCount = Math.ceil(state.subjects.length / subjectsPerPage)
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const subjectOffset = pageIndex * subjectsPerPage
      const subjects = state.subjects.slice(subjectOffset, subjectOffset + subjectsPerPage)
      const content = await renderContactSheetPage(
        root,
        variant.key,
        pageIndex + 1,
        pageCount,
        state.subjects.length,
        subjects,
        subjectOffset,
      )
      const fileName = `manual-${variant.key}-${String(pageIndex + 1).padStart(2, '0')}-of-${String(pageCount).padStart(2, '0')}.svg`
      const path = `${SCREENSHOT_CONTACT_SHEET_DIRECTORY}/${fileName}`
      await writeFile(resolve(root, path), content)
      pages.push({
        variant: variant.key,
        page: pageIndex + 1,
        pageCount,
        path,
        sha256: sha256(content),
        subjectIds: subjects.map((subject) => subject.id),
      })
    }
  }

  const indexPath = `${SCREENSHOT_CONTACT_SHEET_DIRECTORY}/index.html`
  await writeFile(resolve(root, indexPath), contactSheetIndex(pages))
  const receipt: ScreenshotContactSheetReceipt = {
    schemaVersion: SCREENSHOT_REVIEW_SCHEMA_VERSION,
    reviewStateSha256: state.reviewStateSha256,
    subjectCount: state.subjectCount,
    variantCount: state.variantCount,
    layoutVersion: SCREENSHOT_CONTACT_SHEET_LAYOUT_VERSION,
    pages,
  }
  const receiptPath = resolve(root, SCREENSHOT_CONTACT_SHEET_RECEIPT_PATH)
  await mkdir(dirname(receiptPath), { recursive: true })
  await writeFile(receiptPath, serializeReviewJson(receipt))
  return { receipt, indexPath }
}

async function runCli() {
  const first = await generateScreenshotContactSheets()
  const second = await generateScreenshotContactSheets()
  if (canonicalJson(first.receipt) !== canonicalJson(second.receipt)) {
    throw new Error('Contact-sheet generation was not deterministic across consecutive runs.')
  }
  const mobilePages = second.receipt.pages.filter((page) => page.variant === 'mobile').length
  const desktopPages = second.receipt.pages.filter((page) => page.variant === 'desktop').length
  console.log(`Generated ${mobilePages} mobile and ${desktopPages} desktop labeled contact-sheet pages at ${second.indexPath}.`)
  console.log('Generation does not approve visual review. Inspect every page before running npm run manual:screenshots:approve.')
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  await runCli()
}
