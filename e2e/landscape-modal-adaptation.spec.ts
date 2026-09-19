// @covers src/components/core/ModalSheet.module.css
import { expect, test, type Locator, type Page } from './layout/fixture'
import type { ModalBodyTier } from '../src/components/core/modalSheetPresentation'
import { setSafeAreaInsets } from './safe-area'

interface AdaptiveModalCase {
  id: string
  open: (page: Page) => Promise<Locator>
  splitPair?: [string, string]
  splitTiers?: ModalBodyTier[]
}

async function gotoRoute(page: Page, path: string) {
  await page.goto(`/index.html?path=${path}`)
  await expect(page.locator(`[data-route-path="${path.split('&')[0]}"]`)).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
}

async function openButtonModal(page: Page, path: string, name: string | RegExp) {
  await gotoRoute(page, path)
  await page.getByRole('button', { name }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

async function cameraSplitMetrics(dialog: Locator) {
  return dialog.locator('[data-modal-landscape-layout="media-split"]').evaluate((sheet) => {
    const body = sheet.closest('[data-modal-sheet-body="true"]') as HTMLElement
    const media = sheet.firstElementChild!.getBoundingClientRect()
    const controlsElement = sheet.querySelector('[class*="cameraControls"]')!
    const controls = controlsElement.getBoundingClientRect()
    const columns = getComputedStyle(sheet).gridTemplateColumns.split(' ').filter(Boolean).map(Number.parseFloat)
    return {
      columns: columns.length,
      controlColumns: getComputedStyle(controlsElement).gridTemplateColumns.split(' ').filter(Boolean).length,
      equalHalves: columns.length === 2 && Math.abs(columns[0] - columns[1]) <= 1,
      fits: media.height <= body.clientHeight && body.scrollHeight <= body.clientHeight + 1,
      mediaFillsLeftHalf: Math.abs(media.width - columns[0]) <= 1,
      mediaLeftOfControls: media.right <= controls.left + 1,
      mediaWidth: media.width,
      topAligned: Math.abs(controls.top - media.top) <= 1,
    }
  })
}

const CAMERA_SPLIT_CONTRACT = {
  columns: 2,
  controlColumns: 1,
  equalHalves: true,
  fits: true,
  mediaFillsLeftHalf: true,
  mediaLeftOfControls: true,
  topAligned: true,
}

const CASES: AdaptiveModalCase[] = [
  {
    id: 'media-remote',
    open: (page) => openButtonModal(page, 'living-room', /^Living Room Remote Off$/i),
    splitPair: ['[class*="remoteControlSection"]', '[class*="tabContent"]'],
    splitTiers: ['fields', 'standard', 'wide'],
  },
  {
    id: 'eight-sleep',
    open: (page) => openButtonModal(page, 'master-bedroom', /Steph's Side Off/i),
    splitPair: ['[data-scroll-region="eight-sleep-hero-column"]', '[data-scroll-region="eight-sleep-panel"]'],
    splitTiers: ['standard', 'wide'],
  },
  {
    id: 'humidifier',
    open: (page) => openButtonModal(page, 'master-bedroom', /Humidifier .*46%/i),
    splitPair: ['[data-scroll-region="humidifier-hero"]', '[data-scroll-region="humidifier-panel"]'],
    splitTiers: ['standard', 'wide'],
  },
  {
    id: 'vacuum',
    open: (page) => openButtonModal(page, 'vacuums', /Main Floor Docked/i),
    splitPair: ['[aria-label$="map and status"]', '[data-scroll-region="vacuum-panel"]'],
    splitTiers: ['fields', 'standard', 'wide'],
  },
  {
    id: 'thermostat-room',
    open: async (page) => {
      await page.goto('/index.html?path=thermostat#thermostat-controls')
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: /^Living Room/ }).click()
      await expect(dialog.getByRole('heading', { exact: true, name: 'Living Room' })).toBeVisible()
      return dialog
    },
    splitPair: ['[data-thermostat-modal-dial-shell="true"]', '[aria-label="Living Room Vents"]'],
    splitTiers: ['standard', 'wide'],
  },
]

function bodyTierForDialog(dialog: Locator) {
  return dialog.evaluate((element) => {
    const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    if (!body) return null
    const style = getComputedStyle(body)
    const inlinePadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
    return {
      bodyClientHeight: body.clientHeight,
      bodyContentInlineSize: body.clientWidth - inlinePadding,
      bodyOverflow: style.overflowY,
      bodyScrollHeight: body.scrollHeight,
      tier: element.getAttribute('data-modal-body-tier'),
    }
  })
}

async function waitForModalMotionToSettle(dialog: Locator) {
  await expect.poll(() => dialog.evaluate((element) => {
    const transform = getComputedStyle(element).transform
    return transform === 'none' ? 0 : Math.abs(new DOMMatrixReadOnly(transform).m42)
  }), { timeout: 2_000 }).toBeLessThanOrEqual(0.001)
  await dialog.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

test.describe('non-room landscape modal adaptation', () => {
  for (const viewport of [
    { expectedTier: 'fields' as const, height: 320, width: 568 },
    { expectedTier: 'fields' as const, height: 375, width: 667 },
    { expectedTier: 'standard' as const, height: 343, width: 734 },
    { expectedTier: 'wide' as const, height: 393, width: 852 },
  ]) {
    test(`uses measured tiers and one vertical scroll owner at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      test.setTimeout(120_000)
      for (const modalCase of CASES) {
        await page.setViewportSize(viewport)
        const dialog = await modalCase.open(page)
        await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
        await expect(dialog).toHaveAttribute('data-landscape-density', 'compact')

        const body = await bodyTierForDialog(dialog)
        expect(body).not.toBeNull()
        const expectedTier = viewport.expectedTier
        expect(body?.tier).toBe(expectedTier)
        const usesVacuumPaneScroll = modalCase.id === 'vacuum'
        if (usesVacuumPaneScroll) {
          expect(body?.bodyOverflow).toBe('hidden')
          const rightPane = dialog.locator('[data-scroll-region="vacuum-panel"]')
          await expect(rightPane).toHaveCSS('overflow-y', 'auto')
          await expect(rightPane).toHaveCSS('overscroll-behavior-y', 'auto')
        } else {
          expect(['auto', 'scroll']).toContain(body?.bodyOverflow)
          for (const region of await dialog.locator('[data-scroll-region]').all()) {
            await expect(region).toHaveCSS('overflow-y', 'visible')
          }
        }

        if (modalCase.splitPair) {
          const split = await dialog.evaluate((element, selectors) => {
            const first = element.querySelector<HTMLElement>(selectors[0])?.getBoundingClientRect()
            const second = element.querySelector<HTMLElement>(selectors[1])?.getBoundingClientRect()
            return Boolean(first && second && Math.abs(first.left - second.left) > 40)
          }, modalCase.splitPair)
          expect(split, `${modalCase.id} ${expectedTier} split state`).toBe(modalCase.splitTiers?.includes(expectedTier) ?? false)
        }

        if (usesVacuumPaneScroll) {
          await expect.poll(() => dialog.locator('[data-scroll-region="vacuum-panel"]').evaluate((element) => {
            element.scrollTop = element.scrollHeight
            return element.scrollTop
          })).toBeGreaterThan(0)
        } else if ((body?.bodyScrollHeight ?? 0) > (body?.bodyClientHeight ?? 0) + 1) {
          await expect.poll(() => dialog.locator('[data-modal-sheet-body="true"]').evaluate((element) => {
            element.scrollTop = element.scrollHeight
            return element.scrollTop
          })).toBeGreaterThan(0)
        }
        await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
        await expect(dialog).toHaveCount(0, { timeout: 700 })
      }
    })
  }

  test('compacts chrome, reveals fitting tab labels, splits camera modals, and caps landscape media', async ({ page }) => {
    await page.setViewportSize({ height: 393, width: 852 })
    await setSafeAreaInsets(page, { bottom: 21, left: 59, right: 44, top: 0 })

    let dialog = await CASES[3].open(page)
    await setSafeAreaInsets(page, { bottom: 21, left: 59, right: 44, top: 0 })
    const chrome = await dialog.evaluate((element) => {
      const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
      const header = body?.previousElementSibling as HTMLElement | null
      const navigation = element.querySelector<HTMLElement>('[data-modal-sheet-navigation="true"]')
      return {
        bodyHeight: body?.clientHeight ?? 0,
        dialogHeight: element.getBoundingClientRect().height,
        headerPadding: header ? getComputedStyle(header).padding : '',
        navigationPadding: navigation ? getComputedStyle(navigation).padding : '',
      }
    })
    expect(chrome.bodyHeight / chrome.dialogHeight).toBeGreaterThanOrEqual(0.62)
    expect(chrome.headerPadding).toBe('10px 16px 8px')
    expect(chrome.navigationPadding).toBe('8px 16px 10px')
    const vacuumLabels = dialog.locator('[data-modal-tab-nav="true"] [class*="label"]')
    await expect(vacuumLabels).toHaveCount(5)
    for (const label of await vacuumLabels.all()) await expect(label).toBeVisible()
    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    for (const path of ['overview', 'security']) {
      await page.setViewportSize({ height: 393, width: 852 })
      dialog = await openButtonModal(page, path, /Open Front Door camera/i)
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
      await expect(dialog.locator('[data-variant="modal"]')).toHaveAttribute('data-fill', 'true')
      await expect.poll(async () => {
        const { mediaWidth, ...contract } = await cameraSplitMetrics(dialog)
        void mediaWidth
        return contract
      }).toEqual(CAMERA_SPLIT_CONTRACT)
      const narrowMedia = (await cameraSplitMetrics(dialog)).mediaWidth
      await page.setViewportSize({ height: 393, width: 1024 })
      await expect.poll(async () => (await cameraSplitMetrics(dialog)).mediaWidth > narrowMedia).toBe(true)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })

      await page.setViewportSize({ height: 820, width: 1180 })
      dialog = await openButtonModal(page, path, /Open Front Door camera/i)
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'dialog')
      await expect(dialog.locator('[data-variant="modal"]')).toHaveAttribute('data-fill', 'true')
      await expect.poll(async () => {
        const { mediaWidth, ...contract } = await cameraSplitMetrics(dialog)
        void mediaWidth
        return contract
      }).toEqual(CAMERA_SPLIT_CONTRACT)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }

    await page.setViewportSize({ height: 393, width: 852 })
    for (const path of ['overview', 'security']) {
      dialog = await openButtonModal(page, path, /Open Driveway camera/i)
      await expect.poll(() => dialog.locator('[data-modal-landscape-layout="media-split"] > :first-child').evaluate((media) => {
        const box = media.getBoundingClientRect()
        return box.width / box.height
      })).toBeCloseTo(10 / 3, 2)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }

    await gotoRoute(page, 'food')
    await expect(page.getByRole('heading', { name: 'Suggested Recipes' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /Open Suggested .* recipe details/i }).first().click()
    dialog = page.getByRole('dialog')
    const recipeHero = dialog.locator('[class*="hero"]').first()
    await expect.poll(async () => Math.round((await recipeHero.boundingBox())?.height ?? 0)).toBeLessThanOrEqual(200)
  })

  test('keeps the initial camera loading frame flush with its landscape wrapper', async ({ page }) => {
    await page.setViewportSize({ height: 820, width: 1180 })
    let releaseModule!: () => void
    const moduleGate = new Promise<void>((resolve) => { releaseModule = resolve })
    await page.route('**/webrtc/webrtc-camera.js**', async (route) => {
      await moduleGate
      await route.abort()
    })

    const dialog = await openButtonModal(page, 'overview', /Open Upper Deck camera/i)
    const frame = dialog.locator('[data-variant="modal"]')
    await expect(frame).toHaveAttribute('data-fill', 'true')
    await expect(frame).toHaveAttribute('data-loaded', 'false')
    await expect.poll(() => dialog.evaluate((element) => {
      const focus = element.querySelector<HTMLElement>('[class*="cameraFocus"]')!.getBoundingClientRect()
      const cameraFrame = element.querySelector<HTMLElement>('[data-variant="modal"]')!.getBoundingClientRect()
      const host = element.querySelector<HTMLElement>('[data-variant="modal"] > div')!.getBoundingClientRect()
      return {
        frameFlush: Math.abs(cameraFrame.width - focus.width) <= 1 && Math.abs(cameraFrame.height - focus.height) <= 1,
        hostFlush: Math.abs(host.width - focus.width) <= 1 && Math.abs(host.height - focus.height) <= 1,
      }
    })).toEqual({ frameFlush: true, hostFlush: true })

    releaseModule()
    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })
  })

  test('uses paired landscape forms and option grids without changing portrait', async ({ page }) => {
    await page.setViewportSize({ height: 320, width: 568 })

    let dialog = await openButtonModal(page, 'chores', 'Add Task')
    await expect.poll(() => dialog.locator('form[data-modal-landscape-layout="paired-form"]').evaluate((form) =>
      getComputedStyle(form).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(2)
    const taskBody = dialog.locator('[data-modal-sheet-body="true"]')
    await dialog.getByLabel('Task Name').focus()
    await expect(dialog.getByLabel('Task Name')).toBeFocused()
    await expect.poll(() => taskBody.evaluate((body) => body.scrollHeight > body.clientHeight)).toBe(true)
    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    await gotoRoute(page, 'recipes')
    await page.getByRole('button', { name: 'Filter' }).click()
    dialog = page.getByRole('dialog', { name: 'Filter Recipes' })
    await expect.poll(() => dialog.locator('[data-modal-landscape-layout="section-grid"]').evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(2)
    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    await gotoRoute(page, 'fridge')
    await expect(page.getByLabel('Fridge inventory list')).toBeVisible({ timeout: 15_000 })
    await page.locator('[data-floating-action-dock="true"]').getByRole('button', { name: 'Filter' }).click()
    dialog = page.getByRole('dialog', { name: 'Filter Inventory' })
    await expect.poll(() => dialog.getByRole('radiogroup', { name: 'Filter items' }).evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(2)
    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    await page.goto('/?__modalAcceptance=option-picker&__modalValue=Option%20Picker&__modalValue=Automatic&__modalValue=Manual')
    dialog = page.getByRole('dialog', { name: 'Option Picker' })
    const options = dialog.getByRole('group', { name: 'Option Picker options' })
    await expect.poll(() => options.evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(2)
    await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    await page.setViewportSize({ height: 852, width: 393 })
    dialog = await openButtonModal(page, 'chores', 'Add Task')
    await expect.poll(() => dialog.locator('form[data-modal-landscape-layout="paired-form"]').evaluate((form) =>
      getComputedStyle(form).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(1)
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toHaveCount(0, { timeout: 700 })

    await page.goto('/?__modalAcceptance=option-picker&__modalValue=Option%20Picker&__modalValue=Automatic&__modalValue=Manual')
    dialog = page.getByRole('dialog', { name: 'Option Picker' })
    await expect.poll(() => dialog.getByRole('group', { name: 'Option Picker options' }).evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(1)
  })

  test('keeps wide split modals inside both mirrored landscape safe areas', async ({ page }) => {
    await page.setViewportSize({ height: 393, width: 852 })
    for (const insets of [
      { bottom: 21, left: 59, right: 44, top: 0 },
      { bottom: 21, left: 44, right: 59, top: 0 },
    ]) {
      const dialog = await CASES[3].open(page)
      await setSafeAreaInsets(page, insets)
      await expect(dialog).toHaveAttribute('data-modal-body-tier', 'wide')
      const geometry = await dialog.evaluate((element, safe) => {
        const rect = element.getBoundingClientRect()
        const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
        const left = element.querySelector<HTMLElement>('[aria-label$="map and status"]')?.getBoundingClientRect()
        const right = element.querySelector<HTMLElement>('[data-scroll-region="vacuum-panel"]')?.getBoundingClientRect()
        return {
          bodyOverflow: body ? body.scrollWidth - body.clientWidth : Number.POSITIVE_INFINITY,
          bottom: rect.bottom,
          left: rect.left,
          panesSplit: Boolean(left && right && right.left > left.left + 40),
          right: rect.right,
          safeBottom: innerHeight - safe.bottom,
          safeRight: innerWidth - safe.right,
        }
      }, insets)
      expect(geometry.left).toBeGreaterThanOrEqual(insets.left + 11)
      expect(geometry.right).toBeLessThanOrEqual(geometry.safeRight - 11)
      expect(geometry.bottom).toBeLessThanOrEqual(geometry.safeBottom - 7)
      expect(geometry.bodyOverflow).toBeLessThanOrEqual(1)
      expect(geometry.panesSplit).toBe(true)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }
  })

  test('keeps the vacuum map stationary while right-side locate and controls scroll', async ({ page }) => {
    for (const viewport of [
      { height: 393, insets: { bottom: 21, left: 59, right: 44, top: 0 }, width: 852 },
      { height: 393, insets: { bottom: 21, left: 44, right: 59, top: 0 }, width: 852 },
      { height: 393, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 852 },
      { height: 682, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 776 },
      { height: 343, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 734 },
      { height: 375, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 667 },
      { height: 320, insets: { bottom: 0, left: 0, right: 0, top: 0 }, width: 568 },
    ]) {
      await page.setViewportSize({ height: viewport.height, width: viewport.width })
      const dialog = await CASES[3].open(page)
      await setSafeAreaInsets(page, viewport.insets)
      await expect(dialog).toHaveAttribute('data-modal-presentation', /^(?:dialog|landscape-dialog)$/)

      const body = dialog.locator('[data-modal-sheet-body="true"]')
      const leftPane = dialog.locator('[aria-label$="map and status"]')
      const rightPane = dialog.locator('[data-scroll-region="vacuum-panel"]')
      const map = dialog.getByRole('region', { name: 'Main Floor Valetudo map' })
      const locate = rightPane.getByRole('button', { name: 'Locate' })
      const rightContent = rightPane.locator(':scope > *')
      const dockStatus = rightPane.getByRole('group', { name: /^Dock Status/ })
      await expect(map).toBeVisible()
      await expect(locate).toBeVisible()
      await expect(dockStatus).toBeVisible()
      await expect(body).toHaveCSS('overflow-y', 'hidden')
      await expect(leftPane).toHaveCSS('overflow-y', 'hidden')
      await expect(leftPane.locator('[data-vacuum-map-status-controls="true"]')).toBeHidden()
      await expect(rightPane).toHaveCSS('overflow-y', 'auto')
      await expect(rightPane).toHaveCSS('overscroll-behavior-y', 'auto')
      const statusGridItems = await dockStatus.locator('..').locator('..').locator(':scope > *').evaluateAll((elements) =>
        elements.map((element) => element.querySelector('[aria-label]')?.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''))
      const dockStatusIndex = statusGridItems.findIndex((item) => item.startsWith('Dock Status'))
      expect(dockStatusIndex).toBeGreaterThanOrEqual(0)
      expect(statusGridItems.indexOf('Locate')).toBe(dockStatusIndex + 1)

      const scrollRanges = await Promise.all([
        body.evaluate((element) => element.scrollHeight - element.clientHeight),
        leftPane.evaluate((element) => element.scrollHeight - element.clientHeight),
        rightPane.evaluate((element) => element.scrollHeight - element.clientHeight),
      ])
      expect(scrollRanges[0]).toBeLessThanOrEqual(1)
      expect(scrollRanges[1]).toBeLessThanOrEqual(1)
      expect(scrollRanges[2]).toBeGreaterThan(1)

      const before = await Promise.all([map.boundingBox(), locate.boundingBox(), rightContent.boundingBox()])
      await expect.poll(() => rightPane.evaluate((element) => {
        element.scrollTop = element.scrollHeight
        return element.scrollTop
      })).toBeGreaterThan(0)
      const atBottom = await Promise.all([map.boundingBox(), locate.boundingBox(), rightContent.boundingBox()])

      expect(Math.abs((atBottom[0]?.y ?? 0) - (before[0]?.y ?? 0))).toBeLessThanOrEqual(1)
      expect((atBottom[1]?.y ?? 0)).toBeLessThan((before[1]?.y ?? 0) - 1)
      expect((atBottom[2]?.y ?? 0)).toBeLessThan((before[2]?.y ?? 0) - 1)
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0)
      expect(await leftPane.evaluate((element) => element.scrollTop)).toBe(0)

      const rightBox = await rightPane.boundingBox()
      expect(rightBox).not.toBeNull()
      await page.mouse.move((rightBox?.x ?? 0) + (rightBox?.width ?? 0) / 2, (rightBox?.y ?? 0) + (rightBox?.height ?? 0) / 2)
      await page.mouse.wheel(0, 1_000)
      await dialog.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      const beyondBottom = await map.boundingBox()
      expect(Math.abs((beyondBottom?.y ?? 0) - (before[0]?.y ?? 0))).toBeLessThanOrEqual(1)

      await rightPane.evaluate((element) => { element.scrollTop = 0 })
      await expect.poll(() => rightPane.evaluate((element) => element.scrollTop)).toBe(0)
      await page.mouse.wheel(0, -1_000)
      await dialog.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      const beyondTop = await Promise.all([map.boundingBox(), locate.boundingBox()])
      expect(Math.abs((beyondTop[0]?.y ?? 0) - (before[0]?.y ?? 0))).toBeLessThanOrEqual(1)
      expect(Math.abs((beyondTop[1]?.y ?? 0) - (before[1]?.y ?? 0))).toBeLessThanOrEqual(1)
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0)
      expect(await leftPane.evaluate((element) => element.scrollTop)).toBe(0)

      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }
  })

  test('uses two-column landscape section collections only when measured space allows', async ({ page }) => {
    for (const viewport of [
      { height: 375, expectedColumns: 1, width: 667 },
      { height: 343, expectedColumns: 2, width: 734 },
      { height: 393, expectedColumns: 2, width: 852 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/index.html?path=overview#guest-presence-security')
      let dialog = page.getByRole('dialog', { name: 'Guest Presence Security' })
      await expect(dialog).toBeVisible()
      await expect.poll(() => dialog.locator('[data-modal-landscape-layout="section-grid"]').evaluate((grid) =>
        getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(viewport.expectedColumns)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })

      await page.goto('/index.html?path=kitchen#dishwasher')
      dialog = page.getByRole('dialog', { name: 'Dishwasher' })
      await expect(dialog).toBeVisible()
      await expect.poll(() => dialog.locator('[data-modal-landscape-layout="section-grid"]').evaluate((grid) =>
        getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(viewport.expectedColumns)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }

    await page.setViewportSize({ height: 852, width: 393 })
    await page.goto('/index.html?path=overview#guest-presence-security')
    const portraitDialog = page.getByRole('dialog', { name: 'Guest Presence Security' })
    await expect.poll(() => portraitDialog.locator('[data-modal-landscape-layout="section-grid"]').evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(1)
  })

  test('restores exact portrait chrome and stacked geometry after rotation', async ({ page }) => {
    for (const modalCase of [CASES[0], CASES[1], CASES[2], CASES[3]]) {
      await page.setViewportSize({ height: 852, width: 393 })
      const dialog = await modalCase.open(page)
      await waitForModalMotionToSettle(dialog)
      const portraitStart = await dialog.evaluate((element) => {
        const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
        const header = body?.previousElementSibling as HTMLElement | null
        const navigation = element.querySelector<HTMLElement>('[data-modal-sheet-navigation="true"]')
        return {
          bodyPadding: body ? getComputedStyle(body).padding : '',
          dialog: element.getBoundingClientRect().toJSON(),
          headerPadding: header ? getComputedStyle(header).padding : '',
          navigationPadding: navigation ? getComputedStyle(navigation).padding : '',
          titleFontSize: getComputedStyle(element.querySelector('h2') as Element).fontSize,
        }
      })
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      await expect(dialog).toHaveAttribute('data-modal-body-tier', 'compact')

      await page.setViewportSize({ height: 393, width: 852 })
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
      await page.setViewportSize({ height: 852, width: 393 })
      await expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      await waitForModalMotionToSettle(dialog)
      const portraitEnd = await dialog.evaluate((element) => {
        const body = element.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
        const header = body?.previousElementSibling as HTMLElement | null
        const navigation = element.querySelector<HTMLElement>('[data-modal-sheet-navigation="true"]')
        return {
          bodyPadding: body ? getComputedStyle(body).padding : '',
          dialog: element.getBoundingClientRect().toJSON(),
          headerPadding: header ? getComputedStyle(header).padding : '',
          navigationPadding: navigation ? getComputedStyle(navigation).padding : '',
          titleFontSize: getComputedStyle(element.querySelector('h2') as Element).fontSize,
        }
      })
      expect(portraitEnd).toEqual(portraitStart)
      await dialog.getByRole('button', { exact: true, name: 'Close' }).click()
      await expect(dialog).toHaveCount(0, { timeout: 700 })
    }
  })
})
