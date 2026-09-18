// @covers src/components/core/ModalSheet.module.css
// @covers src/components/core/GlassTile.module.css
// @covers src/components/core/GlassTile.tsx
// @covers src/components/shell/GlobalQuickLinksAction.module.css
import { expect, test, type Locator, type Page } from './layout/fixture'
import { waitForModalReady, type ModalReadiness } from './layout/evidence'
import { writeFileSync } from 'node:fs'
import { ROOM_PAGE_CONFIGS } from '../src/constants/roomPages'
import { MEDIA_REMOTE_CONFIGS } from '../src/constants/mediaRemotes'
import { SHOW_OUTDOOR_FAUCETS_ENTITY_ID } from '../src/constants/sprinklers'
import { installSafeAreaInsets, setSafeAreaInsets } from './safe-area'
import { globalQuickLinksAction, openQuickLinksTab, quickLinksLayout } from './quick-links'

const PORTRAIT = { width: 393, height: 852, insets: { top: 59, right: 0, bottom: 34, left: 0 } }
const LANDSCAPES = [
  { name: 'island-left', width: 852, height: 393, insets: { top: 0, right: 44, bottom: 21, left: 59 } },
  { name: 'island-right', width: 852, height: 393, insets: { top: 0, right: 59, bottom: 21, left: 44 } },
  { name: 'rectangular', width: 667, height: 375, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'small-rectangular', width: 568, height: 320, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'intermediate', width: 734, height: 343, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'android-left', width: 915, height: 412, insets: { top: 0, right: 0, bottom: 24, left: 48 } },
  { name: 'android-right', width: 915, height: 412, insets: { top: 0, right: 48, bottom: 24, left: 0 } },
  { name: 'short-desktop', width: 1280, height: 500, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'large-island-phone', width: 874, height: 402, insets: { top: 0, right: 44, bottom: 21, left: 59 } },
] as const

type Profile = typeof PORTRAIT
type Box = { x: number; y: number; width: number; height: number }

async function settle(dialog: Locator, readiness: ModalReadiness = 'tabs') {
  await waitForModalReady(dialog, 5_000, readiness)
}

async function resize(page: Page, profile: Profile) {
  await page.setViewportSize({ width: profile.width, height: profile.height })
  await setSafeAreaInsets(page, profile.insets)
}

async function outerBox(dialog: Locator, readiness: ModalReadiness = 'tabs'): Promise<Box> {
  await settle(dialog, readiness)
  const box = await dialog.boundingBox()
  if (!box) throw new Error('Open modal has no bounding box')
  return box
}

function expectBox(actual: Box, expected: Box, label: string) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${label}: ${key}`).toBeLessThanOrEqual(1)
  }
}

async function expectLandscapeFrame(dialog: Locator, profile: Profile, readiness: ModalReadiness = 'tabs') {
  await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
  expectBox(await outerBox(dialog, readiness), {
    x: profile.insets.left + 12,
    y: profile.insets.top + 8,
    width: profile.width - profile.insets.left - profile.insets.right - 24,
    height: profile.height - profile.insets.top - profile.insets.bottom - 16,
  }, 'shared landscape frame')
}

async function close(dialog: Locator) {
  const node = await dialog.elementHandle()
  if (!node) throw new Error('Cannot close a missing modal')
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  expect(await node.getAttribute('data-state')).toBe('closed')
  expect(await node.getAttribute('inert')).not.toBeNull()
  await expect(dialog).toHaveCount(0)
  await node.dispose()
}

async function openQuickLinks(page: Page, rooms = false) {
  let dialog = await openQuickLinksTab(page)
  if (rooms) {
    await dialog.getByRole('button', { name: 'Rooms', exact: true }).click()
    dialog = page.getByRole('dialog', { name: 'Rooms', exact: true })
  }
  await settle(dialog)
  return dialog
}

async function squareGrids(dialog: Locator) {
  return dialog.locator('[style*="--modal-square-card-size"]').evaluateAll((grids) => grids.map((grid) => {
    const style = getComputedStyle(grid)
    const rect = grid.getBoundingClientRect()
    const cards = Array.from(grid.children).map((cell) => {
      const card = cell.matches('button, article') ? cell : cell.querySelector('button, article')
      if (!card) throw new Error('Modal tile cell has no card')
      const box = card.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    return {
      left: rect.left + Number.parseFloat(style.paddingLeft),
      width: rect.width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
      cards,
    }
  }))
}

function expectGrowingTracks(grids: Awaited<ReturnType<typeof squareGrids>>, label: string) {
  expect(grids.length, `${label}: grids`).toBeGreaterThan(0)
  for (const grid of grids) {
    // The width oracle is independent of the implementation's sizing variables.
    const columns = Math.max(1, Math.floor((grid.width + 10) / 142))
    const track = (grid.width - (columns - 1) * 10) / columns
    const rows = new Map<number, typeof grid.cards>()
    for (const card of grid.cards) {
      expect(Math.abs(card.width - track), `${label}: equal expanded track`).toBeLessThanOrEqual(1)
      expect(Math.abs(card.height - card.width), `${label}: square tile`).toBeLessThanOrEqual(1)
      const row = Math.round(card.y)
      rows.set(row, [...(rows.get(row) ?? []), card])
    }
    for (const row of rows.values()) {
      const width = row.at(-1)!.x + row.at(-1)!.width - row[0].x
      expect(row.length, `${label}: available columns`).toBeLessThanOrEqual(columns)
      expect(Math.abs(row[0].x - grid.left), `${label}: left-aligned row`).toBeLessThanOrEqual(1)
      if (row.length === columns) expect(Math.abs(width - grid.width), `${label}: full-row utilization`).toBeLessThanOrEqual(1)
    }
  }
}

const TILE_FAMILIES = [
  { name: 'Rooms', route: 'overview', rooms: true, admin: false },
  { name: 'Home Lights', route: 'overview#lights-overview', admin: false },
  { name: 'Home Climate', route: 'overview#climate-overview', admin: false },
  { name: 'Home Occupancy', route: 'overview#occupancy-overview', admin: false },
  { name: 'Home Contacts', route: 'overview#contact-sensors-overview', admin: false },
  { name: 'Home Air Quality', route: 'overview#aqi-overview', admin: false },
  { name: 'Security Contacts', route: 'security#contact-sensors-overview', admin: false },
  { name: 'Admin Presence', route: 'admin#presence-based-overrides', admin: true },
  { name: 'Admin Auto-Reset', route: 'admin#presence-based-overrides-auto', admin: true },
] as const

for (const family of TILE_FAMILIES) {
  test(`${family.name} tiles grow equally on mounted landscape rotation without changing portrait`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(PORTRAIT)
    await installSafeAreaInsets(page, PORTRAIT.insets)
    await page.goto(`/index.html?path=${family.route}`)
    const dialog = 'rooms' in family ? await openQuickLinks(page, true) : page.getByRole('dialog')
    await settle(dialog)
    await dialog.evaluate((element) => { element.setAttribute('data-rotation-probe', 'original') })

    const assertPortrait = async () => {
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      await settle(dialog)
      expectBox(await outerBox(dialog), { x: 0, y: 85.203125, width: 393, height: 766.796875 }, `${family.name}: accepted portrait frame`)
      const grids = await squareGrids(dialog)
      for (const grid of grids) {
        expect(Math.abs(grid.width - 359)).toBeLessThanOrEqual(1)
        for (const card of grid.cards) {
          expect(Math.abs(card.width - (family.admin ? 175.5 : 174.5))).toBeLessThanOrEqual(0.1)
          expect(Math.abs(card.height - (family.admin ? 120 : 147.875))).toBeLessThanOrEqual(0.1)
        }
      }
    }

    await assertPortrait()
    for (const profile of LANDSCAPES) {
      await resize(page, profile)
      await expectLandscapeFrame(dialog, profile)
      await expect.poll(async () => {
        const grids = await squareGrids(dialog)
        return grids.every((grid) => {
          const columns = Math.max(1, Math.floor((grid.width + 10) / 142))
          return grid.cards.every((card) => Math.abs(card.width - (grid.width - (columns - 1) * 10) / columns) <= 1)
        })
      }, { message: `${family.name}: fill tracks after ${profile.name}` }).toBe(true)
      expectGrowingTracks(await squareGrids(dialog), `${family.name}/${profile.name}`)
      await expect(dialog).toHaveAttribute('data-rotation-probe', 'original')
      const scroll = await dialog.locator('[data-modal-sheet-body]').evaluate((body) => {
        const innerOwners = Array.from(body.querySelectorAll<HTMLElement>('*')).filter((element) =>
          element.clientHeight > 0 && element.scrollHeight > element.clientHeight + 1
          && ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))
        const previous = body.scrollTop
        body.scrollTop = body.scrollHeight
        const grids = body.querySelectorAll('[style*="--modal-square-card-size"]')
        const cards = grids.item(grids.length - 1)?.querySelectorAll('button, article')
        const last = cards?.item(cards.length - 1)?.getBoundingClientRect()
        if (!last) throw new Error('Modal tile grid has no terminal card')
        const result = { innerOwners: innerOwners.map((element) => element.className), bottom: body.getBoundingClientRect().bottom, lastBottom: last.bottom }
        body.scrollTop = previous
        return result
      })
      expect(scroll.innerOwners, `${family.name}/${profile.name}: one landscape scroll owner`).toEqual([])
      expect(scroll.lastBottom).toBeLessThanOrEqual(scroll.bottom + 1)
    }
    await resize(page, { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } })
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
    await settle(dialog)
    for (const grid of await squareGrids(dialog)) {
      const rowStarts = new Map<number, number>()
      for (const card of grid.cards) {
        expect(card.width).toBe(168)
        expect(card.height).toBe(168)
        const row = Math.round(card.y)
        if (!rowStarts.has(row)) rowStarts.set(row, card.x)
      }
      for (const left of rowStarts.values()) expect(Math.abs(left - grid.left), `${family.name}: desktop row start`).toBeLessThanOrEqual(1)
    }
    await resize(page, PORTRAIT)
    await assertPortrait()
    await close(dialog)
  })
}

test('Quick Links gives portrait and landscape tiles enough width for their text', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PORTRAIT)
  await installSafeAreaInsets(page, PORTRAIT.insets)
  await page.goto('/index.html?path=overview')
  await expect.poll(() => page.evaluate(() => Boolean(window.__mockHass))).toBe(true)
  await page.evaluate((entityId) => window.__mockHass!.setEntityState(entityId, 'off'), SHOW_OUTDOOR_FAUCETS_ENTITY_ID)
  const dialog = await openQuickLinks(page)
  const grid = dialog.getByRole('group', { name: 'Quick Links', exact: true })
  const rooms = grid.getByRole('button', { name: 'Rooms', exact: true })
  await rooms.evaluate((element) => { element.dataset.quickLinksNode = 'original' })
  const expectTextAwarePortrait = async () => {
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    await expect(grid).toHaveAttribute('data-dynamic-grid-last-row', 'fill')
    await expect.poll(async () => (await quickLinksLayout(dialog)).cards.map((card) => card.span)).toEqual([2, 2, 2, 1, 1, 2])
    const layout = await quickLinksLayout(dialog)
    expect(layout.columns).toBe(2)
    expect(layout.gridWidth).toBeCloseTo(359, 2)
    expect(layout.gridHeight).toBeCloseTo(640, 2)
    expect(Math.abs(layout.gridTop - layout.bodyTop)).toBeLessThanOrEqual(1)
    const widths = [359, 359, 359, 174.5, 174.5, 359]
    const rowTops = [0, 130, 260, 390, 390, 520]
    for (const [index, card] of layout.cards.entries()) {
      expect(card.width).toBeCloseTo(widths[index], 2)
      expect(card.y).toBeCloseTo(rowTops[index], 2)
      expect(card.height).toBeCloseTo(120, 2)
      expect(card.padding).toBe('16px')
      expect(card.radius).toBe('32px')
      expect(card.iconWidth).toBeCloseTo(24, 2)
      expect(card.titleFont).toBe('14.4px')
      expect(card.copyFits).toBe(true)
    }
  }
  await expectTextAwarePortrait()

  for (const profile of [LANDSCAPES[0], LANDSCAPES[1], LANDSCAPES[2], LANDSCAPES[3], LANDSCAPES[5], LANDSCAPES[8]]) {
    await resize(page, profile)
    await expectLandscapeFrame(dialog, profile)
    await settle(dialog)
    await expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    await expect(grid).toHaveAttribute('data-dynamic-grid-last-row', 'start')
    await expect(grid).toHaveAttribute('data-dynamic-grid-fill-rows', 'except-last')
    const layout = await quickLinksLayout(dialog)
    expect(Math.abs(layout.gridWidth - layout.measureWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.gridTop - layout.bodyTop)).toBeLessThanOrEqual(1)
    const rows = new Set<number>()
    for (const card of layout.cards) {
      expect(card.height).toBeCloseTo(88, 2)
      expect(card.copyFits).toBe(true)
      expect(card.insideBody).toBe(true)
      if (!rows.has(card.y)) expect(Math.abs(card.x)).toBeLessThanOrEqual(1)
      rows.add(card.y)
    }
    const rowTops = [...rows]
    for (const top of rowTops.slice(0, -1)) {
      expect(layout.cards.filter((card) => card.y === top).reduce((sum, card) => sum + card.span, 0)).toBe(layout.columns)
    }
    await expect(rooms).toHaveAttribute('data-quick-links-node', 'original')
    if (profile === LANDSCAPES[0]) {
      expect(layout.cards.map((card) => card.span)).toEqual([2, 2, 2, 1, 1, 2])
      const label = rooms.locator('[data-dynamic-grid-label="true"]').first()
      await label.evaluate((element) => { element.textContent = 'Open every room, light, and environmental control throughout the house' })
      await expect.poll(async () => (await rooms.boundingBox())?.width ?? 0).toBeGreaterThan(layout.cards[0].width + 10)
      expect((await quickLinksLayout(dialog)).cards[0].copyFits).toBe(true)
      await label.evaluate((element) => { element.textContent = 'Rooms' })
      await expect.poll(async () => (await rooms.boundingBox())?.width ?? 0).toBe(layout.cards[0].width)
    }
  }
  await resize(page, PORTRAIT)
  await expectTextAwarePortrait()
  await expect(rooms).toHaveAttribute('data-quick-links-node', 'original')
  await close(dialog)
})

test('Security mode grids fill the modal width from every opener without changing portrait sizing', async ({ page }) => {
  test.setTimeout(120_000)
  for (const entry of ['overview', 'security', 'quick-links']) {
    await page.setViewportSize(PORTRAIT)
    await page.goto(`/index.html?path=${entry === 'security' ? 'security' : 'overview'}&securityEntry=${entry}${entry === 'quick-links' ? '' : '#security-system'}`)
    await setSafeAreaInsets(page, PORTRAIT.insets)
    if (entry === 'quick-links') {
      const quick = await openQuickLinks(page)
      await quick.getByRole('button', { name: /^Security System/ }).click()
    }
    const dialog = page.getByRole('dialog', { name: 'Security System' })
    const grid = dialog.locator('[data-security-mode-grid]')
    const portraitSize = async () => {
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      await settle(dialog)
      const cards = await grid.locator('button').evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }))
      expect(cards).toHaveLength(4)
      for (const card of cards) {
        expect(Math.abs(card.width - 174.5)).toBeLessThanOrEqual(0.1)
        expect(card.height).toBe(74)
      }
    }
    await portraitSize()
    for (const profile of [
      ...LANDSCAPES.slice(0, 5),
      { width: 820, height: 1180, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      { width: 1180, height: 820, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
      { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    ]) {
      await resize(page, profile)
      await expect(dialog).toHaveAttribute('data-modal-presentation', profile.height < 560 ? 'landscape-dialog' : 'dialog')
      await settle(dialog)
      const metrics = await grid.evaluate((element) => {
        const body = element.closest('[data-modal-sheet-body]')!
        const bodyStyle = getComputedStyle(body)
        const bodyRect = body.getBoundingClientRect()
        const rect = element.getBoundingClientRect()
        const left = bodyRect.left + Number.parseFloat(bodyStyle.paddingLeft)
        const width = bodyRect.width - Number.parseFloat(bodyStyle.paddingLeft) - Number.parseFloat(bodyStyle.paddingRight)
        const cards = Array.from(element.querySelectorAll('button')).map((button) => {
          const box = button.getBoundingClientRect()
          const title = button.querySelector('[data-dynamic-grid-label="true"]')
          return { x: box.x, y: box.y, width: box.width, height: box.height, copyFits: !title || title.scrollWidth <= title.clientWidth + 1 }
        })
        return { left, width, gridLeft: rect.left, gridWidth: rect.width, cards }
      })
      expect(Math.abs(metrics.gridLeft - metrics.left), `${entry}: left inset`).toBeLessThanOrEqual(1)
      expect(Math.abs(metrics.gridWidth - metrics.width), `${entry}: full usable width`).toBeLessThanOrEqual(1)
      const columns = Math.min(4, Math.max(1, Math.floor((metrics.width + 10) / 170)))
      const track = (metrics.width - 10 * (columns - 1)) / columns
      for (const [index, card] of metrics.cards.entries()) {
        expect(Math.abs(card.width - track), `${entry}: equal security tracks`).toBeLessThanOrEqual(1)
        expect(card.height).toBe(74)
        expect(card.copyFits).toBe(true)
        if (index % columns === 0) expect(Math.abs(card.x - metrics.left)).toBeLessThanOrEqual(1)
      }
      if (profile.height < 560) await expectLandscapeFrame(dialog, profile)
    }
    await resize(page, PORTRAIT)
    await portraitSize()
    await page.evaluate(() => {
      if (!window.__mockHass) throw new Error('Security command assertions require mock Home Assistant')
      window.__mockHass.calls.splice(0)
    })
    for (const button of await grid.getByRole('button').all()) await button.click()
    expect(await page.evaluate(() => window.__mockHass!.calls.filter((call) => call.domain === 'alarm_control_panel').map((call) => call.service)))
      .toEqual(['alarm_arm_home', 'alarm_arm_away', 'alarm_arm_night', 'alarm_disarm'])
    await close(dialog)
  }
})

test('Guest Presence Security uses the full centered content area on both routes', async ({ page }) => {
  for (const route of ['overview', 'security']) {
    await page.setViewportSize(PORTRAIT)
    await page.goto(`/index.html?path=${route}#guest-presence-security`)
    await setSafeAreaInsets(page, PORTRAIT.insets)
    const dialog = page.getByRole('dialog')
    const portrait = await outerBox(dialog)
    for (const profile of [
      LANDSCAPES[0], LANDSCAPES[1], LANDSCAPES[2],
      { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    ]) {
      await resize(page, profile)
      await expect(dialog).toHaveAttribute('data-modal-content-width', 'full')
      await expect(dialog).toHaveAttribute('data-modal-presentation', profile.height < 560 ? 'landscape-dialog' : 'dialog')
      await expect(dialog).toHaveAttribute('data-modal-body-tier', profile.width === 667 ? 'fields' : 'wide')
      await settle(dialog)
      const sizes = await dialog.evaluate((element) => {
        const body = element.querySelector<HTMLElement>('[data-modal-sheet-body]')!
        const measure = element.querySelector<HTMLElement>('[data-modal-content-measure]')!
        const style = getComputedStyle(body)
        const sections = element.querySelector('[data-modal-landscape-layout="section-grid"]')!
        return {
          available: body.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
          content: measure.getBoundingClientRect().width,
          columns: getComputedStyle(sections).gridTemplateColumns.split(' ').length,
        }
      })
      expect(Math.abs(sizes.content - sizes.available)).toBeLessThanOrEqual(1)
      expect(sizes.columns).toBe(profile.width === 667 ? 1 : 2)
    }
    await resize(page, PORTRAIT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    expectBox(await outerBox(dialog), portrait, 'Guest security portrait')
    await close(dialog)
  }
})

async function summaryTypography(dialog: Locator, list: Locator, expectedColumns: number) {
  await expect.poll(() => list.evaluate((element) => {
    const items = element.querySelector('ul')
    if (!items) throw new Error('Summary list is missing')
    return getComputedStyle(items).gridTemplateColumns.split(' ').length
  })).toBe(expectedColumns)
  const fonts = await list.locator('strong, small').evaluateAll((nodes) => nodes.map((node) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    const style = getComputedStyle(node)
    return {
      tag: node.tagName,
      font: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      glyphHeight: range.getBoundingClientRect().height,
      width: node.getBoundingClientRect().width,
    }
  }))
  expect(fonts.length).toBeGreaterThan(0)
  for (const font of fonts) {
    expect(Math.abs(font.font - (font.tag === 'STRONG' ? 13.12 : 11.2))).toBeLessThan(0.01)
    expect(font.glyphHeight).toBeLessThanOrEqual(font.lineHeight * 3 + 1)
  }
  await expect(dialog.locator('h2').first()).toHaveCSS('font-size', '16px')
  return fonts
}

for (const tab of ['Overdue Chores', 'Upcoming Chores', 'Expired Food'] as const) {
  test(`Summary ${tab} updates on rotation before any tab refresh`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(PORTRAIT)
    await installSafeAreaInsets(page, PORTRAIT.insets)
    await page.goto('/index.html?path=overview&user=stephen#daily-report')
    const dialog = page.getByRole('dialog', { name: "Stephen's Summary" })
    await settle(dialog)
    await dialog.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
    const list = dialog.getByLabel(`${tab} ${tab === 'Expired Food' ? 'inventory' : 'todo'} list`, { exact: true })
    await expect(list).toBeVisible()
    await list.locator('strong').first().evaluate((element) => { element.setAttribute('data-rotation-probe', 'original-row') })
    const readColumns = async () => {
      if (tab !== 'Expired Food') return summaryTypography(dialog, list, 2)
      const rows = list.locator('[data-expiry-tone="expired"]')
      await expect.poll(() => rows.evaluateAll((elements) => new Set(elements.map((element) => Math.round(element.getBoundingClientRect().left))).size)).toBe(2)
      return list.locator('strong, small').evaluateAll((elements) => elements.map((element) => ({
        tag: element.tagName, font: Number.parseFloat(getComputedStyle(element).fontSize),
      })))
    }
    for (const profile of [LANDSCAPES[0], LANDSCAPES[1], LANDSCAPES[5]]) {
      await resize(page, profile)
      await expectLandscapeFrame(dialog, profile)
      const fonts = await readColumns()
      for (const font of fonts) expect(Math.abs(font.font - (font.tag === 'STRONG' ? 13.12 : 11.2))).toBeLessThan(0.01)
      await expect(list.locator('[data-rotation-probe="original-row"]')).toHaveCount(1)
    }
    const beforeRefresh = await readColumns()
    await dialog.getByRole('tab', { name: tab === 'Expired Food' ? /^Overdue Chores/ : /^Expired Food/ }).click()
    await dialog.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
    expect(await readColumns()).toEqual(beforeRefresh)
    await resize(page, PORTRAIT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await settle(dialog)
    expectBox(await outerBox(dialog), { x: 0, y: 85.203125, width: 393, height: 766.796875 }, 'returned portrait Summary')
    await close(dialog)
  })
}

test('responsive typography disables orientation inflation but retains browser zoom', async ({ page, browserName }) => {
  await page.goto('/index.html?path=overview&user=stephen#daily-report')
  const contract = await page.evaluate(() => ({
    adjust: getComputedStyle(document.documentElement).getPropertyValue('text-size-adjust')
      || getComputedStyle(document.documentElement).getPropertyValue('-webkit-text-size-adjust'),
    supported: CSS.supports('text-size-adjust', '100%') || CSS.supports('-webkit-text-size-adjust', '100%'),
    viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
  }))
  // Linux WPE lacks iOS text autosizing even in an iPhone-emulated context.
  if (contract.supported) expect(contract.adjust).toBe('100%')
  else expect(browserName).toBe('webkit')
  expect(contract.viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?:\D|$)/)
})

test.describe('touch keyboard viewport', () => {
  test.use({ hasTouch: true, isMobile: true })

  test('portrait form and chat sheets rise into the keyboard-safe viewport', async ({ page }) => {
    await page.setViewportSize(PORTRAIT)
    await installSafeAreaInsets(page, PORTRAIT.insets)
    await page.addInitScript(({ width, height }) => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
      const viewport = Object.assign(new EventTarget(), {
        width, height, offsetTop: 0, offsetLeft: 0,
        pageTop: 0, pageLeft: 0, scale: 1,
      })
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    }, PORTRAIT)
    await page.goto('/index.html?path=to-do')
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    const formDialog = page.getByRole('dialog', { name: 'Add Task', exact: true })
    await formDialog.getByRole('textbox').focus()
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 520 })
      window.visualViewport!.dispatchEvent(new Event('resize'))
    })
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('332px')
    const formBox = await outerBox(formDialog)
    expectBox(formBox, { x: 0, y: 59, width: 393, height: 461 }, 'keyboard-safe portrait form')
    const formFooter = await formDialog.locator('[data-modal-sheet-footer="true"]').boundingBox()
    expect(formFooter!.y + formFooter!.height).toBeLessThanOrEqual(520)
    await formDialog.getByRole('textbox').blur()
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 852 })
      window.visualViewport!.dispatchEvent(new Event('resize'))
    })
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('0px')
    expectBox(await outerBox(formDialog), { x: 0, y: 85.203125, width: 393, height: 766.796875 }, 'restored portrait form')
    await close(formDialog)

    await page.goto('/index.html?path=overview')
    await globalQuickLinksAction(page).click()
    const chatDialog = page.getByRole('dialog', { name: 'Home Assistant', exact: true })
    await chatDialog.getByRole('textbox', { name: 'Chat Message' }).focus()
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 520 })
      window.visualViewport!.dispatchEvent(new Event('resize'))
    })
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('332px')
    expectBox(await outerBox(chatDialog), formBox, 'matching keyboard-safe portrait chat frame')
    const composer = await chatDialog.locator('[data-chat-composer="true"]').boundingBox()
    expect(composer!.y + composer!.height).toBeLessThanOrEqual(520)
  })

  test('portrait sheets do not double-apply the inset when dynamic viewport units already contract', async ({ page }) => {
    await page.setViewportSize(PORTRAIT)
    await installSafeAreaInsets(page, PORTRAIT.insets)
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
    })
    await page.goto('/index.html?path=to-do')
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add Task', exact: true })
    await dialog.getByRole('textbox').focus()
    await page.evaluate((layoutHeight) => {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        get: () => layoutHeight,
      })
    }, PORTRAIT.height)

    await page.setViewportSize({ width: PORTRAIT.width, height: 520 })
    await expect.poll(() => page.evaluate(() => {
      const probe = document.createElement('div')
      probe.style.cssText = 'position:fixed;height:100dvh;pointer-events:none'
      document.body.append(probe)
      const dynamicHeight = probe.getBoundingClientRect().height
      probe.remove()
      return {
        dynamicHeight,
        innerHeight: window.innerHeight,
        overlayInset: document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'),
        visualHeight: window.visualViewport?.height,
      }
    })).toEqual({
      dynamicHeight: 520,
      innerHeight: PORTRAIT.height,
      overlayInset: '332px',
      visualHeight: 520,
    })

    expectBox(await outerBox(dialog), { x: 0, y: 59, width: 393, height: 461 }, 'contracted-dvh portrait form')
    const footer = await dialog.locator('[data-modal-sheet-footer="true"]').boundingBox()
    expect(Math.abs(footer!.y + footer!.height - 520)).toBeLessThanOrEqual(1)
    await close(dialog)
  })

  test('closed keyboard ignores a stale viewport height after a mounted resize', async ({ page }) => {
    await page.setViewportSize(PORTRAIT)
    await installSafeAreaInsets(page, PORTRAIT.insets)
    await page.goto('/index.html?path=to-do')
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add Task', exact: true })
    const tablet = { width: 820, height: 1180, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
    await resize(page, tablet)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
    const expected = { x: 32, y: 210, width: 756, height: 760 }
    expectBox(await outerBox(dialog), expected, 'settled tablet form')

    const staleViewportBox = await dialog.evaluate((element) => {
      const root = document.documentElement
      root.style.setProperty('--dashboard-viewport-height', '343px')
      root.style.setProperty('--dashboard-keyboard-overlay-inset', '0px')
      root.removeAttribute('data-dashboard-keyboard')
      root.removeAttribute('data-dashboard-kb-arming')
      const box = element.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    })
    expectBox(staleViewportBox, expected, 'keyboard-closed tablet form with stale viewport height')
    await close(dialog)
  })

  test('landscape frames follow the keyboard overlay below the page minimum height', async ({ page }) => {
    const profile = LANDSCAPES[0]
    await page.setViewportSize(profile)
    await installSafeAreaInsets(page, profile.insets)
    await page.addInitScript(({ width, height }) => {
      Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 })
      const viewport = Object.assign(new EventTarget(), {
        width, height, offsetTop: 0, offsetLeft: 0,
        pageTop: 0, pageLeft: 0, scale: 1,
      })
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    }, { width: profile.width, height: profile.height })
    await page.goto('/index.html?path=to-do')
    await page.getByRole('button', { name: 'Add Task', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add Task', exact: true })
    await expectLandscapeFrame(dialog, profile)
    const input = dialog.getByRole('textbox').first()
    await input.focus()
    await expect(input).toBeFocused()
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 263 })
      window.visualViewport!.dispatchEvent(new Event('resize'))
    })
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('130px')
    expectBox(await outerBox(dialog), { x: 71, y: 8, width: 725, height: 226 }, 'keyboard-safe landscape frame')
    const closeButton = dialog.getByRole('button', { name: 'Close', exact: true })
    const box = await closeButton.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(263)
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 393 })
      window.visualViewport!.dispatchEvent(new Event('resize'))
    })
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset'))).toBe('0px')
    await expectLandscapeFrame(dialog, profile)
    await close(dialog)
  })
})

test('Quick Links and Summary share the same frame on rotation, reopen, tablet and desktop', async ({ browserName, page }) => {
  test.setTimeout(browserName === 'webkit' ? 180_000 : 90_000)
  await page.setViewportSize(PORTRAIT)
  await installSafeAreaInsets(page, PORTRAIT.insets)
  await page.goto('/index.html?path=overview&user=stephen')
  for (const profile of [
    LANDSCAPES[0], LANDSCAPES[1], LANDSCAPES[2],
    { width: 820, height: 1180, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 1920, height: 1080, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  ]) {
    await resize(page, PORTRAIT)
    await page.evaluate(() => { window.location.hash = '#daily-report' })
    const summary = page.getByRole('dialog', { name: "Stephen's Summary" })
    await settle(summary)
    await resize(page, profile)
    await expect(summary).toHaveAttribute('data-modal-presentation', profile.height < 560 ? 'landscape-dialog' : 'dialog')
    const summaryBox = await outerBox(summary)
    await close(summary)
    const quick = await openQuickLinks(page)
    expectBox(await outerBox(quick), summaryBox, 'Quick Links versus rotated Summary')
    await close(quick)
    await page.evaluate(() => { window.location.hash = '#daily-report' })
    expectBox(await outerBox(summary), summaryBox, 'reopened Summary')
    await close(summary)
  }
})

const CONFIGURED_ROOM_MODALS = Object.values(ROOM_PAGE_CONFIGS).map((room) => {
  const cards = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
  const openers = cards.flatMap((card) => card.hash ? [{ hash: card.hash, kind: card.kind }] : [])
  return { path: room.path, title: room.title, openers: [...new Map(openers.map((opener) => [opener.hash, opener])).values()] }
}).filter((room) => room.openers.length > 0)

for (const room of CONFIGURED_ROOM_MODALS) {
  test(`${room.title} configured modal openers and tabs retain geometry on rotation`, async ({ browserName, page }, testInfo) => {
    test.setTimeout(browserName === 'webkit' ? 600_000 : 300_000)
    const states: Array<{ route: string; hash: string; kind: string; tab: string; intent: string | null }> = []
    for (const opener of room.openers) {
      await test.step(`${room.path}${opener.hash} (${opener.kind})`, async () => {
        await page.setViewportSize(PORTRAIT)
        await page.goto(`/index.html?path=${room.path}&modalOpener=${encodeURIComponent(opener.hash)}${opener.hash}`)
        await setSafeAreaInsets(page, PORTRAIT.insets)
        const dialog = page.getByRole('dialog')
        const readiness = opener.kind === 'vacuum' ? 'vacuum-tabs' : 'tabs'
        await settle(dialog, readiness)
        await expect(dialog).toHaveAttribute('data-modal-geometry-intent', /.+/)
        await dialog.evaluate((element) => { element.setAttribute('data-configured-modal-node', 'original') })
        const portrait = await outerBox(dialog, readiness)
        const tabNames = await dialog.getByRole('tab').evaluateAll((tabs) =>
          tabs.map((tab) => tab.getAttribute('aria-label') ?? tab.textContent?.trim() ?? ''))
        for (const [index, name] of (tabNames.length > 0 ? tabNames : [null]).entries()) {
          const tab = name === null ? null : dialog.getByRole('tab', { name, exact: true })
          if (tab) {
            await expect(tab).toBeEnabled()
            await tab.click()
          }
          await settle(dialog, readiness)
          const artifact = `${room.path}-${opener.hash.slice(1)}-${index}`
          if (testInfo.project.name === 'mobile') {
            await page.screenshot({ path: testInfo.outputPath(`${artifact}-portrait.png`), scale: 'css' })
          }
          for (const profile of [LANDSCAPES[0], LANDSCAPES[1], LANDSCAPES[2]]) {
            await resize(page, profile)
            await expectLandscapeFrame(dialog, profile, readiness)
            await expect(dialog).toHaveAttribute('data-configured-modal-node', 'original')
            if (tab) await expect(tab).toHaveAttribute('aria-selected', 'true')
            const body = dialog.locator('[data-modal-sheet-body]')
            const paneOwned = opener.kind === 'vacuum'
            await expect(body).toHaveCSS('overflow-y', paneOwned ? 'hidden' : 'auto')
            if (paneOwned) await expect(dialog.locator('[data-scroll-region="vacuum-panel"]')).toHaveCSS('overflow-y', 'auto')
            if (profile === LANDSCAPES[0] && testInfo.project.name === 'mobile') {
              await page.screenshot({ path: testInfo.outputPath(`${artifact}-landscape.png`), scale: 'css' })
            }
          }
          await resize(page, { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } })
          await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
          expectBox(await outerBox(dialog, readiness), { x: 170, y: 70, width: 1100, height: 760 }, `${artifact}: common desktop frame`)
          await resize(page, PORTRAIT)
          await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
          expectBox(await outerBox(dialog, readiness), portrait, `${artifact}: unchanged portrait frame`)
          if (tab) await expect(tab).toHaveAttribute('aria-selected', 'true')
          states.push({ route: room.path, hash: opener.hash, kind: opener.kind, tab: name ?? 'root', intent: await dialog.getAttribute('data-modal-geometry-intent') })
        }
        const mutations = await page.evaluate(() => {
          const reads = new Set(['evershelf.list_inventory', 'evershelf.recipe_detail', 'evershelf.recipe_query', 'weather.get_forecasts'])
          return (window.__mockHass?.calls ?? []).filter((call) => !reads.has(`${call.domain}.${call.service}`))
        })
        expect(mutations, `${room.path}${opener.hash}: navigation must not actuate devices`).toEqual([])
        await close(dialog)
      })
    }
    const reportPath = testInfo.outputPath('configured-modal-state-inventory.json')
    writeFileSync(reportPath, `${JSON.stringify(states, null, 2)}\n`)
    await testInfo.attach('configured-modal-state-inventory', { path: reportPath, contentType: 'application/json' })
  })
}

for (const filter of [
  { route: 'recipes', title: 'Filter Recipes' },
  { route: 'fridge', title: 'Filter Inventory' },
]) {
  test(`${filter.title} explanations wrap fully in every presentation`, async ({ page }) => {
    await page.setViewportSize(PORTRAIT)
    await page.goto(`/index.html?path=${filter.route}`)
    await setSafeAreaInsets(page, PORTRAIT.insets)
    await page.locator('[data-floating-action-dock="true"]').getByRole('button', { name: 'Filter', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: filter.title })
    const descriptions = dialog.getByRole('radio').locator('small')
    await expect(descriptions.first()).toHaveCSS('white-space', 'normal')
    expect(await descriptions.evaluateAll((elements) =>
      elements.filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
        .map((element) => element.textContent)), `${filter.title}: readable portrait choices`).toEqual([])
    const portrait = await outerBox(dialog)
    for (const profile of [
      LANDSCAPES[0], LANDSCAPES[2], LANDSCAPES[3],
      { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    ]) {
      await resize(page, profile)
      await expect(dialog).toHaveAttribute('data-modal-presentation', profile.height < 560 ? 'landscape-dialog' : 'dialog')
      await settle(dialog)
      const clipped = await dialog.getByRole('radio').locator('strong, small').evaluateAll((elements) =>
        elements.filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
          .map((element) => element.textContent))
      expect(clipped, `${filter.title}: readable choices at ${profile.width}x${profile.height}`).toEqual([])
      if (filter.route === 'fridge') {
        const first = await dialog.getByRole('radio').first().boundingBox()
        const last = await dialog.getByRole('radio').last().boundingBox()
        expect(Math.abs((first?.x ?? 0) - (last?.x ?? 0)), 'Incomplete filter row starts at the first column').toBeLessThanOrEqual(1)
      }
    }
    await resize(page, PORTRAIT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await expect(descriptions.first()).toHaveCSS('white-space', 'normal')
    expect(await descriptions.evaluateAll((elements) =>
      elements.filter((element) => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
        .map((element) => element.textContent)), `${filter.title}: readable restored portrait choices`).toEqual([])
    expectBox(await outerBox(dialog), portrait, `${filter.title}: portrait preservation`)
    await close(dialog)
  })
}

test('active media remote direction pads fit above navigation and remain operable after rotation', async ({ page }) => {
  test.setTimeout(120_000)
  for (const remote of Object.values(MEDIA_REMOTE_CONFIGS)) {
    const room = CONFIGURED_ROOM_MODALS.find((candidate) => candidate.openers.some((opener) => opener.hash === remote.hash))
    if (!room) throw new Error(`No configured room opener for ${remote.hash}`)
    await page.setViewportSize(PORTRAIT)
    await page.goto(`/index.html?path=${room.path}`)
    await setSafeAreaInsets(page, PORTRAIT.insets)
    await expect.poll(() => page.evaluate(() => Boolean(window.__mockHass))).toBe(true)
    await page.evaluate(({ entityId, hash }) => {
      const mock = window.__mockHass
      if (!mock) throw new Error('The remote interaction gate requires mock Home Assistant')
      mock.setEntityState(entityId, 'idle')
      window.location.hash = hash
    }, { entityId: remote.controlEntityId, hash: remote.hash })
    const dialog = page.getByRole('dialog')
    const pad = dialog.locator('[role="group"][aria-label$=" remote controls"]')
    await settle(dialog)
    const portrait = await pad.boundingBox()
    expect(portrait?.width).toBe(270)
    for (const profile of [LANDSCAPES[3], LANDSCAPES[2], LANDSCAPES[0], LANDSCAPES[1]]) {
      await resize(page, profile)
      await expectLandscapeFrame(dialog, profile)
      const body = dialog.locator('[data-modal-sheet-body]')
      await body.evaluate((element) => { element.scrollTop = 0 })
      const metrics = await pad.evaluate((element) => {
        const body = element.closest('[data-modal-sheet-body]')!.getBoundingClientRect()
        return Array.from(element.querySelectorAll('button')).map((button) => {
          const rect = button.getBoundingClientRect()
          return { name: button.getAttribute('aria-label'), width: rect.width, height: rect.height, fullyVisible: rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1 }
        })
      })
      expect(metrics).toHaveLength(5)
      for (const button of metrics) {
        expect(button.fullyVisible, `${remote.hash}/${profile.name}: ${button.name} is usable without scrolling`).toBe(true)
        expect(button.width).toBeGreaterThanOrEqual(44)
        expect(button.height).toBeGreaterThanOrEqual(44)
      }
      const down = pad.getByRole('button', { name: 'Down', exact: true })
      await expect(down).toBeEnabled()
      const box = await down.boundingBox()
      if (!box) throw new Error('Remote Down target is missing')
      const calls = await page.evaluate(() => window.__mockHass!.calls.length)
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await expect.poll(() => page.evaluate(() => window.__mockHass!.calls.length)).toBe(calls + 1)
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0)
    }
    await resize(page, PORTRAIT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    await settle(dialog)
    expectBox((await pad.boundingBox())!, portrait!, `${remote.hash}: portrait pad`)
    await close(dialog)
  }
})

test('recipe planner and ingredient search retain one frame and entered values on rotation', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PORTRAIT)
  await page.goto('/index.html?path=food')
  await setSafeAreaInsets(page, PORTRAIT.insets)
  await expect.poll(() => page.evaluate(() => Boolean(window.__mockHass))).toBe(true)
  await page.getByRole('button', { name: /Open Suggested .* recipe details/ }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Serves 4')).toBeVisible()
  await dialog.evaluate((element) => { element.setAttribute('data-recipe-flow-node', 'original') })
  const portrait = await outerBox(dialog)
  const rotateDetail = async (control: Locator, readiness: ModalReadiness) => {
    for (const profile of [LANDSCAPES[0], LANDSCAPES[1], LANDSCAPES[2]]) {
      await resize(page, profile)
      await expectLandscapeFrame(dialog, profile, readiness)
      await expect(dialog).toHaveAttribute('data-recipe-flow-node', 'original')
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeInViewport()
      await expect(page.getByRole('dialog')).toHaveCount(1)
    }
    await resize(page, { width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } })
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
    expectBox(await outerBox(dialog, readiness), { x: 170, y: 70, width: 1100, height: 760 }, 'recipe detail desktop')
    await resize(page, PORTRAIT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    expectBox(await outerBox(dialog, readiness), portrait, 'recipe detail portrait')
  }
  await dialog.getByRole('button', { name: 'Add to My Week', exact: true }).click()
  const date = dialog.getByLabel('Cookidoo My Week date')
  const initialDate = await date.inputValue()
  await rotateDetail(date, 'recipe-planner')
  await expect(date).toHaveValue(initialDate)
  await dialog.getByRole('button', { name: 'Back to recipe', exact: true }).click()
  await dialog.getByRole('tab', { name: 'Ingredients', exact: true }).click()
  await dialog.getByRole('button', { name: /Fresh herbs: Inventory match uncertain.*Activate to choose an inventory product/ }).click()
  const search = dialog.getByRole('searchbox', { name: 'Search inventory products' })
  await search.fill('beans')
  await expect(dialog.getByRole('button', { name: /Canned Beans.*in inventory/ })).toBeVisible()
  await rotateDetail(search, 'recipe-product-picker')
  await expect(search).toHaveValue('beans')
  await dialog.getByRole('button', { name: 'Back and mark ingredient available', exact: true }).click()
  await expect(dialog.getByRole('tab', { name: 'Ingredients', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog).toHaveAttribute('data-recipe-flow-node', 'original')
  await close(dialog)
})

test('all Weather condition modes retain their selection and common frame through rotation', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PORTRAIT)
  await page.goto('/index.html?path=overview')
  await setSafeAreaInsets(page, PORTRAIT.insets)
  await page.getByRole('button', { name: /Open seven-day weather forecast/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Weather' })
  const portrait = await outerBox(dialog)
  for (const name of ['Conditions conditions', 'Precipitation conditions', 'Wind conditions']) {
    const mode = dialog.getByRole('button', { name, exact: true })
    await mode.click()
    for (const profile of [LANDSCAPES[0], LANDSCAPES[2], LANDSCAPES[1]]) {
      await resize(page, profile)
      await expectLandscapeFrame(dialog, profile)
      await expect(mode).toHaveAttribute('aria-pressed', 'true')
    }
    await resize(page, PORTRAIT)
    await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
    expectBox(await outerBox(dialog), portrait, `${name}: portrait Weather`)
    await expect(mode).toHaveAttribute('aria-pressed', 'true')
  }
  await close(dialog)
})

const BODY_INSET_PROFILES = [
  { ...PORTRAIT, name: 'portrait-start' },
  ...['island-left', 'island-right', 'rectangular', 'small-rectangular', 'intermediate'].map((name) => {
    const profile = LANDSCAPES.find((entry) => entry.name === name)
    if (!profile) throw new Error(`Missing inset profile: ${name}`)
    return profile
  }),
  { name: 'tablet-portrait', width: 820, height: 1180, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'tablet-landscape', width: 1180, height: 820, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'desktop', width: 1440, height: 900, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  { ...PORTRAIT, name: 'portrait-return' },
]

async function bodyInsetMetrics(dialog: Locator) {
  await settle(dialog)
  const previous = await dialog.locator('[data-modal-sheet-body]').evaluate((body) => body.scrollTop)
  await expect.poll(() => dialog.evaluate(async (element) => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body]')!
    body.scrollTo({ top: body.scrollHeight, behavior: 'instant' })
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
    return Math.abs(body.scrollTop - Math.max(0, body.scrollHeight - body.clientHeight))
  }), { message: 'Reach the real end after responsive content reflow' }).toBeLessThanOrEqual(1)
  return dialog.evaluate(async (element, originalScrollTop) => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body]')!
    const measure = body.querySelector<HTMLElement>('[data-modal-content-measure]')!
    const frame = element.getBoundingClientRect()
    const firstCard = measure.querySelector<HTMLElement>('[style*="--modal-square-card-size"] button')
    const card = firstCard?.getBoundingClientRect()
    const style = getComputedStyle(body)
    body.scrollTo({ top: body.scrollHeight, behavior: 'instant' })
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
    const owners = [...body.querySelectorAll<HTMLElement>('*')].filter((node) =>
      node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    const eligiblePanes = [...body.querySelectorAll<HTMLElement>('*')].filter((node) =>
      node.clientHeight > 0 && ['auto', 'scroll'].includes(getComputedStyle(node).overflowY))
    const controls = [...body.querySelectorAll<HTMLElement>('button,input,select,textarea,[role="slider"]')].filter((node) => {
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    if (!controls.length) throw new Error('Body-inset measurement requires terminal controls')
    const terminalBottom = Math.max(...controls.map((node) => node.getBoundingClientRect().bottom))
    const terminalGap = body.getBoundingClientRect().bottom - terminalBottom
    if (!Number.isFinite(terminalBottom) || !Number.isFinite(terminalGap)) throw new Error('Body-inset terminal geometry must be finite')
    const metrics = {
      presentation: element.getAttribute('data-modal-presentation'),
      scrollMode: element.getAttribute('data-scroll-mode'),
      frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
      bodyOverflow: style.overflowY,
      bodyHeight: body.clientHeight,
      contentHeight: body.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom),
      bodyScrollHeight: body.scrollHeight,
      bodyScrollTop: body.scrollTop,
      padding: Number.parseFloat(style.paddingBottom),
      gap: body.getBoundingClientRect().bottom - measure.getBoundingClientRect().bottom,
      measureHeight: measure.getBoundingClientRect().height,
      measureOverflow: measure.scrollHeight - measure.clientHeight,
      terminalGap,
      terminalControlCount: controls.length,
      innerOwners: owners.map((node) => node.dataset.scrollRegion ?? node.className),
      eligiblePanes: eligiblePanes.map((node) => ({ name: node.dataset.scrollRegion ?? node.className, height: node.clientHeight })),
      firstCard: card && firstCard ? {
        width: card.width, height: card.height, padding: getComputedStyle(firstCard).padding,
        radius: getComputedStyle(firstCard).borderRadius,
        textSize: getComputedStyle(firstCard.querySelector('span:last-child span:first-child') ?? firstCard).fontSize,
      } : null,
    }
    body.scrollTo({ top: originalScrollTop, behavior: 'instant' })
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
    return metrics
  }, previous)
}

test('body-inset measurement rejects missing or non-finite terminal controls', async ({ page }) => {
  const markup = `<div role="dialog" data-state="open" style="width:200px">
    <div data-modal-sheet-body style="height:80px;overflow-y:auto">
      <div data-modal-content-measure style="height:40px"></div>
    </div>
  </div>`
  await page.setContent(markup)
  const dialog = page.getByRole('dialog')
  await expect(bodyInsetMetrics(dialog)).rejects.toThrow('requires terminal controls')
  await dialog.locator('[data-modal-content-measure]').evaluate((measure) => { measure.innerHTML = '<button>Terminal</button>' })
  const valid = await bodyInsetMetrics(dialog)
  expect(valid.terminalControlCount).toBe(1)
  expect(Number.isFinite(valid.terminalGap)).toBe(true)
  await dialog.getByRole('button').evaluate((button) => {
    button.getBoundingClientRect = () => new DOMRect(0, 0, 20, Infinity)
  })
  await expect(bodyInsetMetrics(dialog)).rejects.toThrow('terminal geometry must be finite')
})

for (const surface of ['Rooms', 'Filter Recipes', 'Media Apps'] as const) {
  test(`${surface} preserves body end inset and bounded panes through mounted rotation`, async ({ page }, testInfo) => {
    test.setTimeout(150_000)
    await page.setViewportSize(PORTRAIT)
    await installSafeAreaInsets(page, PORTRAIT.insets)
    const records: Array<Record<string, unknown>> = []
    let dialog: Locator
    if (surface === 'Rooms') {
      await page.goto('/index.html?path=overview')
      dialog = await openQuickLinks(page, true)
    } else if (surface === 'Filter Recipes') {
      await page.goto('/index.html?path=recipes')
      await page.locator('[data-floating-action-dock]').getByRole('button', { name: 'Filter', exact: true }).click()
      dialog = page.getByRole('dialog', { name: 'Filter Recipes' })
    } else {
      await page.goto('/index.html?path=living-room')
      await page.getByRole('button', { name: /^Living Room Remote Off$/i }).click()
      dialog = page.getByRole('dialog')
      await dialog.getByRole('tab', { name: 'Apps', exact: true }).click()
      await expect(dialog.locator('[data-scroll-region="media-remote-panel"]')).toHaveAttribute('data-tab', 'apps')
    }
    await settle(dialog)
    const original = await dialog.elementHandle()
    if (!original) throw new Error('Missing modal')
    let portrait: Awaited<ReturnType<typeof bodyInsetMetrics>> | undefined
    try {
      for (const profile of BODY_INSET_PROFILES) {
        await resize(page, profile)
        const metrics = await bodyInsetMetrics(dialog)
        records.push({ profile: profile.name, ...metrics })
        expect.soft(await original.evaluate((node) => node.isConnected), `${surface}/${profile.name}: mounted identity`).toBe(true)
        if (metrics.presentation === 'landscape-dialog') await expectLandscapeFrame(dialog, profile)
        if (metrics.presentation === 'dialog') {
          const width = Math.min(1100, profile.width - 64), height = Math.min(760, profile.height - 64)
          expectBox(metrics.frame, { width, height, x: (profile.width - width) / 2, y: (profile.height - height) / 2 }, `${surface}/${profile.name}: shared frame`)
        }
        const paneOwned = surface !== 'Filter Recipes' && metrics.presentation === 'dialog'
        if (paneOwned) {
          expect.soft(metrics.bodyOverflow, `${surface}/${profile.name}: pane body lock`).toBe('hidden')
          expect.soft(Math.abs(metrics.measureHeight - metrics.contentHeight), `${surface}/${profile.name}: bounded measure`).toBeLessThanOrEqual(1)
          expect.soft(metrics.eligiblePanes.length, `${surface}/${profile.name}: pane owns overflow even when its content fits`).toBeGreaterThan(0)
          if (surface === 'Rooms') expect.soft(metrics.innerOwners.length, `${profile.name}: long room grid scrolls inside its pane`).toBeGreaterThan(0)
          for (const pane of metrics.eligiblePanes) expect.soft(pane.height, `${surface}/${profile.name}: bounded pane`).toBeLessThanOrEqual(metrics.bodyHeight + 1)
        } else {
          expect.soft(metrics.bodyOverflow, `${surface}/${profile.name}: body owner`).toBe('auto')
          expect.soft(metrics.innerOwners, `${surface}/${profile.name}: no nested scroller`).toEqual([])
          expect.soft(metrics.measureOverflow, `${surface}/${profile.name}: intrinsic wrapper`).toBeLessThanOrEqual(1)
          expect.soft(Math.abs(metrics.gap - metrics.padding), `${surface}/${profile.name}: actual end inset`).toBeLessThanOrEqual(1)
          expect.soft(metrics.terminalGap, `${surface}/${profile.name}: actual terminal control clearance`).toBeGreaterThanOrEqual(metrics.padding - 1)
        }
        if (profile.name === 'portrait-start') portrait = metrics
        if (surface === 'Rooms' && metrics.presentation === 'sheet') {
          expect.soft(Math.abs(metrics.firstCard!.width - 174.5)).toBeLessThanOrEqual(0.1)
          expect.soft(Math.abs(metrics.firstCard!.height - 147.875)).toBeLessThanOrEqual(0.1)
        }
        if (profile.name === 'portrait-return') {
          expectBox(metrics.frame, portrait!.frame, `${surface}: exact portrait return`)
          expect.soft(metrics.firstCard).toEqual(portrait!.firstCard)
          expect.soft(metrics.padding).toBe(portrait!.padding)
          expect.soft(Math.abs(metrics.measureHeight - portrait!.measureHeight), `${surface}: portrait content height returns`).toBeLessThanOrEqual(1)
          expect.soft(Math.abs(metrics.terminalGap - portrait!.terminalGap), `${surface}: portrait terminal clearance returns`).toBeLessThanOrEqual(1)
        }
        if (['portrait-start', 'island-left', 'desktop', 'portrait-return'].includes(profile.name)) {
          await page.screenshot({ path: testInfo.outputPath(`${profile.name}-initial.png`), scale: 'css' })
          if (!paneOwned) {
            await dialog.locator('[data-modal-sheet-body]').evaluate((body) => body.scrollTo({ top: body.scrollHeight, behavior: 'instant' }))
            await page.screenshot({ path: testInfo.outputPath(`${profile.name}-terminal.png`), scale: 'css' })
            await dialog.locator('[data-modal-sheet-body]').evaluate((body) => body.scrollTo({ top: 0, behavior: 'instant' }))
          }
        }
      }
      await close(dialog)
    } finally {
      await testInfo.attach('body-inset-metrics', { body: JSON.stringify(records, null, 2), contentType: 'application/json' })
      writeFileSync(testInfo.outputPath('body-inset-metrics.json'), JSON.stringify(records, null, 2))
      await original.dispose()
    }
  })
}
