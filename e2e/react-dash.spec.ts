import { expect, test, type Locator, type Page } from '@playwright/test'

type FreeSleepAlarmSnapshot = {
  enabled: boolean
  time: string
}

type FreeSleepSchedulesSnapshot = Partial<Record<'left' | 'right', Partial<Record<string, { alarms?: FreeSleepAlarmSnapshot[] }>>>>

declare global {
  interface Window {
    __vacationPickerCalls?: number
  }
}

async function openBedAlarmDialog(page: Page, bedButtonName: RegExp) {
  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: bedButtonName }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Alarm Schedule Disabled' }).click()
  await expect(dialog.getByRole('button', { name: 'Alarm Schedule Enabled' })).toBeVisible()
  return dialog
}

async function openAddAlarmForm(dialog: Locator, sideTitle: string) {
  const addAlarmButton = dialog.getByRole('button', { exact: true, name: 'Add Alarm' })
  await expect(addAlarmButton).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(addAlarmButton).toHaveCSS('border-top-style', 'none')
  await addAlarmButton.click()
  const addAlarm = dialog.getByRole('group', { name: `Add ${sideTitle} alarm` })
  await expect(addAlarm).toBeVisible()
  await expect(addAlarm.getByRole('button', { name: 'New alarm time 7:00 AM' }).locator('svg')).toHaveCount(1)
  return addAlarm
}

async function selectAlarmDays(addAlarm: Locator, days: string[]) {
  await addAlarm.getByRole('button', { name: /Alarm days Choose days/i }).click()
  for (const day of days) {
    const option = addAlarm.getByRole('option', { name: day })
    await option.click()
    await expect(option).toHaveAttribute('aria-selected', 'true')
    await expect(option).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(option.locator('svg')).toHaveCount(0)
  }
}

async function freeSleepSchedules(page: Page) {
  return page.evaluate(() => (window as unknown as { __mockHass: { freeSleepSchedules: () => FreeSleepSchedulesSnapshot } }).__mockHass.freeSleepSchedules())
}

async function expectFreeSleepAlarms(page: Page, side: 'left' | 'right', day: string, expected: FreeSleepAlarmSnapshot[]) {
  await expect.poll(async () => {
    const schedules = await freeSleepSchedules(page)
    return (schedules[side]?.[day]?.alarms ?? []).map((alarm) => ({ enabled: alarm.enabled, time: alarm.time }))
  }).toEqual(expected)
}

async function expectDesktopSquareGrid(dialog: Locator, sectionLabel: string) {
  const grid = dialog.locator(`section[aria-label="${sectionLabel}"] > div`)
  await expect(grid).toBeVisible()
  const cardCount = await grid.locator('> div').count()
  const expectedColumns = Math.max(1, Math.ceil(Math.sqrt(cardCount)))
  const expectedRows = Math.ceil(cardCount / expectedColumns)

  await expect.poll(async () => {
    return grid.evaluate((gridElement) => {
      const firstCard = gridElement.firstElementChild?.firstElementChild
      const firstCardRect = firstCard?.getBoundingClientRect()
      const gridStyle = window.getComputedStyle(gridElement)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length
      const rows = gridStyle.gridTemplateRows.split(' ').filter(Boolean).length
      return {
        cardCount: gridElement.children.length,
        cardHeight: Math.round(firstCardRect?.height ?? 0),
        cardWidth: Math.round(firstCardRect?.width ?? 0),
        columns,
        fitsAllRooms: columns * rows >= gridElement.children.length,
        rows,
        scrollsHorizontally: gridElement.scrollWidth > gridElement.clientWidth + 1,
        squareCard: Math.round(firstCardRect?.width ?? 0) === Math.round(firstCardRect?.height ?? 0),
      }
    })
  }).toMatchObject({
    cardCount,
    cardHeight: 168,
    cardWidth: 168,
    columns: expectedColumns,
    fitsAllRooms: true,
    rows: expectedRows,
    scrollsHorizontally: false,
    squareCard: true,
  })

  const dialogBox = await dialog.boundingBox()
  const gridBox = await grid.boundingBox()
  expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))
  return grid
}

async function expectDesktopAdminSquareGrid(dialog: Locator, gridLabel: string) {
  const grid = dialog.getByRole('group', { name: gridLabel })
  await expect(grid).toBeVisible()
  const cardCount = await grid.locator('> button, > article').count()
  const expectedColumns = Math.max(1, Math.ceil(Math.sqrt(cardCount)))
  const expectedRows = Math.ceil(cardCount / expectedColumns)

  await expect.poll(async () => {
    return grid.evaluate((gridElement) => {
      const firstCard = gridElement.firstElementChild
      const firstCardRect = firstCard?.getBoundingClientRect()
      const gridStyle = window.getComputedStyle(gridElement)
      const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length
      const rows = gridStyle.gridTemplateRows.split(' ').filter(Boolean).length
      return {
        cardCount: gridElement.children.length,
        cardHeight: Math.round(firstCardRect?.height ?? 0),
        cardWidth: Math.round(firstCardRect?.width ?? 0),
        columns,
        fitsAllCards: columns * rows >= gridElement.children.length,
        rows,
        scrollsHorizontally: gridElement.scrollWidth > gridElement.clientWidth + 1,
        squareCard: Math.round(firstCardRect?.width ?? 0) === Math.round(firstCardRect?.height ?? 0),
      }
    })
  }).toMatchObject({
    cardCount,
    cardHeight: 168,
    cardWidth: 168,
    columns: expectedColumns,
    fitsAllCards: true,
    rows: expectedRows,
    scrollsHorizontally: false,
    squareCard: true,
  })

  const dialogBox = await dialog.boundingBox()
  const gridBox = await grid.boundingBox()
  expect(Math.round(dialogBox?.width ?? 0)).toBeLessThan(900)
  expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))
  return grid
}

async function clickWithPointerJitter(page: Page, target: Locator) {
  const box = await target.boundingBox()
  if (!box) throw new Error('Target was not measurable')
  const clickX = box.x + box.width / 2
  const clickY = box.y + box.height / 2
  await page.mouse.move(clickX, clickY)
  await page.mouse.down()
  await page.mouse.move(clickX, clickY + 4)
  await page.mouse.up()
}

async function swipeWithTouch(page: Page, x: number, startY: number, endY: number) {
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x, y: startY }] })
  for (let step = 1; step <= 8; step += 1) {
    const y = startY + ((endY - startY) * step) / 8
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, radiusX: 4, radiusY: 4, x, y }] })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
}

test('overview renders with mock Home Assistant state', async ({ page }) => {
  await page.goto('/at-a-glance/overview')

  await expect(page).toHaveTitle('Home Assistant')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
})

test('thermostat page accepts the first mobile scroll gesture after closing a room modal', async ({ page }) => {
  await page.goto('/at-a-glance/ecobee')

  await page.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }).click()
  const dialog = page.getByRole('dialog', { name: 'Living Room' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')

  await expect.poll(async () => page.evaluate(() => ({
    bodyPointerEvents: document.body.style.pointerEvents,
    scrollLocked: document.body.getAttribute('data-scroll-locked'),
    modalOverlays: document.querySelectorAll('[data-modal-sheet-overlay]').length,
    closingDialogPointerEvents: window.getComputedStyle(document.querySelector('[role="dialog"]') as Element).pointerEvents,
    closingDialogInert: document.querySelector('[role="dialog"]')?.hasAttribute('inert') ?? false,
  }))).toEqual({
    bodyPointerEvents: 'auto',
    scrollLocked: null,
    modalOverlays: 0,
    closingDialogPointerEvents: 'none',
    closingDialogInert: true,
  })

  const scroller = page.locator('main > div').nth(1)
  const { before, maxScrollTop } = await scroller.evaluate((element) => ({
    before: element.scrollTop,
    maxScrollTop: element.scrollHeight - element.clientHeight,
  }))
  const scrollerBox = await scroller.boundingBox()
  if (!scrollerBox) throw new Error('Ecobee page scroller was not measurable')
  const canScrollDown = before < maxScrollTop - 20
  const swipeX = scrollerBox.x + scrollerBox.width / 2
  const lowerSwipeY = scrollerBox.y + scrollerBox.height * 0.72
  const upperSwipeY = scrollerBox.y + scrollerBox.height * 0.28
  await swipeWithTouch(page, swipeX, canScrollDown ? lowerSwipeY : upperSwipeY, canScrollDown ? upperSwipeY : lowerSwipeY)
  if (canScrollDown) {
    await expect.poll(async () => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(before + 20)
  } else {
    await expect.poll(async () => scroller.evaluate((element) => element.scrollTop)).toBeLessThan(before - 20)
  }
})

test.describe('desktop modal layout', () => {
  test.use({ hasTouch: false, isMobile: false, viewport: { width: 1280, height: 900 } })

  test('rooms modal uses fixed 168px square room cards on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    await page.getByRole('button', { name: 'Rooms' }).click()

    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()

    await expect.poll(async () => {
      return dialog.locator('section[aria-label="Rooms"]').evaluate((grid) => {
        const firstCard = grid.firstElementChild?.firstElementChild
        const firstCardRect = firstCard?.getBoundingClientRect()
        const gridStyle = window.getComputedStyle(grid)
        const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length
        const rows = gridStyle.gridTemplateRows.split(' ').filter(Boolean).length
        return {
          cardCount: grid.children.length,
          firstCardHeight: Math.round(firstCardRect?.height ?? 0),
          firstCardWidth: Math.round(firstCardRect?.width ?? 0),
          columns,
          fitsAllRooms: columns * rows >= grid.children.length,
          rows,
          scrollsHorizontally: grid.scrollWidth > grid.clientWidth + 1,
        }
      })
    }).toMatchObject({
      cardCount: 16,
      firstCardHeight: 168,
      firstCardWidth: 168,
      columns: 4,
      fitsAllRooms: true,
      rows: 4,
      scrollsHorizontally: false,
    })
    const firstCard = dialog.locator('section[aria-label="Rooms"] > div').first()
    const box = await firstCard.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(Math.round(box?.height ?? 0))
    const dialogBox = await dialog.boundingBox()
    const gridBox = await dialog.locator('section[aria-label="Rooms"]').boundingBox()
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThan(900)
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))

  })

  test('desktop modal has no grabber and cannot be dragged', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    await page.getByRole('button', { name: 'Rooms' }).click()

    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(250)
    await expect(dialog.locator('[data-mobile-drag-handle="true"]')).toHaveCount(0)

    const before = await dialog.boundingBox()
    if (!before) throw new Error('Rooms modal was not measurable before drag')
    await page.mouse.move(before.x + before.width / 2, before.y + 36)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2, before.y + 180)
    await page.mouse.up()

    await expect(dialog).toBeVisible()
    const after = await dialog.boundingBox()
    expect(Math.abs(Math.round(after?.x ?? 0) - Math.round(before.x))).toBeLessThanOrEqual(8)
    expect(Math.abs(Math.round(after?.y ?? 0) - Math.round(before.y))).toBeLessThanOrEqual(8)
  })

  test('room-source vacuum zones tab scrolls above its constrained desktop modal nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 620 })
    await page.goto('/at-a-glance/living-room')

    await page.getByRole('button', { name: /Main Floor Docked/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Zones' }).click()
    await expect(dialog.getByRole('heading', { name: 'Zones' })).toBeVisible()

    const zonesPane = dialog.getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })
    const modalNav = dialog.getByRole('navigation', { name: 'Main Floor modal sections' })
    const diningRoomZone = dialog.getByRole('button', { name: 'Dining Room' })
    await expect.poll(async () => zonesPane.evaluate((element) => {
      const style = window.getComputedStyle(element)
      element.scrollTop = element.scrollHeight
      return {
        canScroll: element.scrollTop > 0,
        overflows: element.scrollHeight > element.clientHeight + 1,
        overflowY: style.overflowY,
      }
    })).toEqual({
      canScroll: true,
      overflows: true,
      overflowY: 'auto',
    })
    await expect.poll(async () => diningRoomZone.evaluate((zoneElement) => {
      const zoneBox = zoneElement.getBoundingClientRect()
      const navBox = document.querySelector('nav[aria-label="Main Floor modal sections"]')?.getBoundingClientRect()
      return Boolean(navBox && zoneBox.bottom <= navBox.top - 4)
    })).toBe(true)
    await expect(modalNav).toBeVisible()
  })

  test('media remote modal uses the shared desktop sheet height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('/at-a-glance/living-room')
    await page.getByRole('button', { name: /^Living Room SHIELD Off$/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect.poll(async () => {
      return dialog.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return Math.round((rect.height / window.innerHeight) * 100)
      })
    }).toBe(90)
  })

  test('bed modal uses fixed desktop hero with 700px width and 70vh height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await page.goto('/at-a-glance/master-bedroom')
    await page.getByRole('button', { name: /Steph's Bed Off/i }).click()

    const dialog = page.getByRole('dialog', { name: "Steph's Bed" })
    await expect(dialog).toBeVisible()
    await expect.poll(async () => {
      return dialog.evaluate((element) => ({
        boxWidth: Math.round(element.getBoundingClientRect().width),
        boxHeight: Math.round(element.getBoundingClientRect().height),
        heightVar: getComputedStyle(element).getPropertyValue('--modal-desktop-height').trim(),
        maxHeightVar: getComputedStyle(element).getPropertyValue('--modal-desktop-max-height').trim(),
        maxWidthVar: getComputedStyle(element).getPropertyValue('--modal-desktop-max-width').trim(),
        widthVar: getComputedStyle(element).getPropertyValue('--modal-desktop-width').trim(),
      }))
    }).toEqual({
      boxHeight: 350,
      boxWidth: 700,
      heightVar: '70vh',
      maxHeightVar: '70vh',
      maxWidthVar: '700px',
      widthVar: '700px',
    })

    await dialog.getByRole('button', { name: 'Alarms' }).click()
    const body = dialog.locator('[data-layout="eight-sleep-modal-body"]')
    const hero = dialog.locator('[data-section="eight-sleep-hero"]')
    const panel = dialog.locator('[data-scroll-region="eight-sleep-panel"]')
    await expect(hero.getByText('Tap the thermostat to turn on the Pod.')).toBeVisible()
    const offHeroBox = await hero.boundingBox()
    await hero.getByRole('button', { name: "Turn on Steph's Bed" }).click()
    await expect(hero.getByText('Tap the thermostat to turn off the Pod.')).toBeVisible()
    const onHeroBox = await hero.boundingBox()
    if (!offHeroBox) throw new Error('Eight Sleep hero was not measurable before toggling on')
    if (!onHeroBox) throw new Error('Eight Sleep hero was not measurable after toggling on')
    expect(Math.abs(Math.round(onHeroBox.height) - Math.round(offHeroBox.height))).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.round(onHeroBox.y) - Math.round(offHeroBox.y))).toBeLessThanOrEqual(1)
    await expect(panel).toHaveAttribute('aria-label', "Steph's Bed Alarms")
    await expect.poll(async () => {
      return { alignContent: await hero.evaluate((element) => getComputedStyle(element).alignContent), alignSelf: await hero.evaluate((element) => getComputedStyle(element).alignSelf) }
    }).toEqual({ alignContent: 'center', alignSelf: 'center' })
    const bodyBox = await body.boundingBox()
    const beforeScrollHeroBox = await hero.boundingBox()
    if (!bodyBox) throw new Error('Eight Sleep modal body was not measurable')
    if (!beforeScrollHeroBox) throw new Error('Eight Sleep hero was not measurable before panel scroll')
    const heroCenterY = beforeScrollHeroBox.y + beforeScrollHeroBox.height / 2
    const bodyCenterY = bodyBox.y + bodyBox.height / 2
    expect(Math.abs(Math.round(heroCenterY) - Math.round(bodyCenterY))).toBeLessThanOrEqual(8)

    await panel.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(async () => panel.evaluate((element) => Math.round(element.scrollTop))).toBeGreaterThan(0)

    const afterScrollHeroBox = await hero.boundingBox()
    expect(Math.abs(Math.round(afterScrollHeroBox?.y ?? 0) - Math.round(beforeScrollHeroBox.y))).toBeLessThanOrEqual(1)

    await dialog.getByRole('button', { name: 'Special Modes' }).click()
    await expect(panel).toHaveAttribute('aria-label', "Steph's Bed Special Modes")
    await expect.poll(async () => {
      return panel.evaluate((element) => {
        const heading = element.querySelector('h2')
        const description = element.querySelector('p')
        const button = element.querySelector('button')
        const headingBox = heading?.getBoundingClientRect()
        const descriptionBox = description?.getBoundingClientRect()
        const buttonBox = button?.getBoundingClientRect()
        const descriptionGap = Math.round((descriptionBox?.top ?? 0) - (headingBox?.bottom ?? 0))
        const buttonGap = Math.round((buttonBox?.top ?? 0) - (descriptionBox?.bottom ?? 0))
        return {
          compactNaturalGaps: descriptionGap > 0 && descriptionGap <= 24 && buttonGap > 0 && buttonGap <= 40,
          panelAlignItems: getComputedStyle(element).alignItems,
          sectionAlignContent: getComputedStyle(element.querySelector('section') as Element).alignContent,
        }
      })
    }).toEqual({
      compactNaturalGaps: true,
      panelAlignItems: 'start',
      sectionAlignContent: 'start',
    })
  })

  test('desktop modal preserves its size during the close fade', async ({ page }) => {
    await page.goto('/at-a-glance/overview')
    await page.getByRole('button', { name: 'Rooms' }).click()

    const dialog = page.getByRole('dialog', { name: 'Rooms' })
    await expect(dialog).toBeVisible()
    const roomGrid = dialog.locator('section[aria-label="Rooms"]')
    await expect(roomGrid).toBeVisible()
    await expect.poll(async () => {
      return roomGrid.evaluate((gridElement) => {
        const firstCard = gridElement.firstElementChild?.firstElementChild
        const firstCardRect = firstCard?.getBoundingClientRect()
        return {
          cardHeight: Math.round(firstCardRect?.height ?? 0),
          cardWidth: Math.round(firstCardRect?.width ?? 0),
        }
      })
    }).toEqual({ cardHeight: 168, cardWidth: 168 })

    const before = await dialog.boundingBox()
    if (!before) throw new Error('Rooms modal was not measurable before closing')

    const frames = await page.evaluate(async () => {
      const dialogElement = document.querySelector('[role="dialog"]') as HTMLElement | null
      const closeButton = dialogElement?.querySelector('button[aria-label="Close"]') as HTMLButtonElement | null
      if (!dialogElement || !closeButton) return []

      const samples: Array<{ height: number; width: number }> = []
      closeButton.click()
      const start = performance.now()

      await new Promise<void>((resolve) => {
        const sample = () => {
          if (!document.body.contains(dialogElement)) {
            resolve()
            return
          }

          const rect = dialogElement.getBoundingClientRect()
          samples.push({ height: Math.round(rect.height), width: Math.round(rect.width) })
          if (performance.now() - start >= 150) {
            resolve()
            return
          }
          requestAnimationFrame(sample)
        }

        requestAnimationFrame(sample)
      })

      return samples
    })

    expect(frames.length).toBeGreaterThan(2)
    expect(Math.max(...frames.map((frame) => Math.abs(frame.width - Math.round(before.width))))).toBeLessThanOrEqual(2)
    expect(Math.max(...frames.map((frame) => Math.abs(frame.height - Math.round(before.height))))).toBeLessThanOrEqual(2)
  })

  test('home lights modal uses fixed 168px square room cards on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview#lights-overview')

    const dialog = page.getByRole('dialog', { name: /Lights/ })
    await expect(dialog).toBeVisible()

    const grid = dialog.locator('section[aria-label="Lights by room"] > div')
    await expect.poll(async () => {
      return grid.evaluate((gridElement) => {
        const firstCard = gridElement.firstElementChild?.firstElementChild
        const firstCardRect = firstCard?.getBoundingClientRect()
        const gridStyle = window.getComputedStyle(gridElement)
        const columns = gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length
        const rows = gridStyle.gridTemplateRows.split(' ').filter(Boolean).length
        return {
          cardCount: gridElement.children.length,
          cardHeight: Math.round(firstCardRect?.height ?? 0),
          cardWidth: Math.round(firstCardRect?.width ?? 0),
          columns,
          fitsAllRooms: columns * rows >= gridElement.children.length,
          rows,
          scrollsHorizontally: gridElement.scrollWidth > gridElement.clientWidth + 1,
        }
      })
    }).toMatchObject({
      cardCount: 16,
      cardHeight: 168,
      cardWidth: 168,
      columns: 4,
      fitsAllRooms: true,
      rows: 4,
      scrollsHorizontally: false,
    })
    const firstCard = grid.locator('> div').first()
    const box = await firstCard.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(Math.round(box?.height ?? 0))
    const dialogBox = await dialog.boundingBox()
    const gridBox = await grid.boundingBox()
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThan(900)
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.width ?? 0) + 52))

    const livingRoomButton = grid.getByRole('button', { name: /Open Living Room Lights/i })
    const livingRoomBox = await livingRoomButton.boundingBox()
    if (!livingRoomBox) throw new Error('Living Room Lights button was not measurable')
    const clickX = livingRoomBox.x + livingRoomBox.width / 2
    const clickY = livingRoomBox.y + livingRoomBox.height / 2
    await page.mouse.move(clickX, clickY)
    await page.mouse.down()
    await page.mouse.move(clickX, clickY + 4)
    await page.mouse.up()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Living Room Lights' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Back to room lights' })).toBeVisible()
  })

  test('security system modal is capped at 500px width with adaptive height on desktop', async ({ page }) => {
    await page.goto('/at-a-glance/overview#security-system')

    const dialog = page.getByRole('dialog', { name: 'Security System' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Armed Home', { exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Current security system state Armed Home')).toHaveCount(0)

    await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(495)
    const box = await dialog.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBeLessThanOrEqual(500)
    expect(Math.round(box?.height ?? 0)).toBeLessThan(720)
  })

  test('thermostat room modal uses 600px desktop split layout', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee#living-room')

    const dialog = page.getByRole('dialog', { name: 'Living Room' })
    await expect(dialog).toBeVisible()
    const thermostatHero = dialog.getByLabel('Living Room thermostat control')
    const vents = dialog.getByLabel('Living Room Vents')
    await expect(thermostatHero).toBeVisible()
    await expect(vents).toBeVisible()
    const ventGrid = vents.locator(':scope > div').nth(1)

    await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(595)
    const dialogBox = await dialog.boundingBox()
    const heroBox = await thermostatHero.boundingBox()
    const ventsBox = await vents.boundingBox()
    if (!dialogBox || !heroBox || !ventsBox) throw new Error('Thermostat modal layout was not measurable')

    expect(Math.round(dialogBox.width)).toBeLessThanOrEqual(600)
    expect(heroBox.x).toBeLessThan(ventsBox.x)
    expect(Math.abs(heroBox.y - ventsBox.y)).toBeLessThanOrEqual(24)
    expect(heroBox.y + heroBox.height).toBeGreaterThan(ventsBox.y)
    await expect.poll(async () => ventGrid.evaluate((gridElement) => {
      const firstCardRect = gridElement.firstElementChild?.getBoundingClientRect()
      const gridRect = gridElement.getBoundingClientRect()
      const gridStyle = window.getComputedStyle(gridElement)
      return {
        cardFillsContainer: Math.round(firstCardRect?.width ?? 0) >= Math.round(gridRect.width) - 2,
        columns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
      }
    })).toEqual({ cardFillsContainer: true, columns: 1 })
  })

  test('thermostat hub mode uses security-style desktop picker without separator', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee')

    await page.getByLabel(/Thermostat Hub Mode Off/i).click()
    const dialog = page.getByRole('dialog', { name: 'Thermostat Hub Mode' })
    await expect(dialog).toBeVisible()
    const options = dialog.getByRole('group', { name: 'Thermostat Hub Mode options' })
    await expect(options).toHaveAttribute('data-layout', 'compact-grid')
    await expect(dialog.locator('span[aria-hidden="true"][class*="separator"]')).toHaveCount(0)

    await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(495)
    const dialogBox = await dialog.boundingBox()
    expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(500)
    await expect.poll(async () => options.evaluate((optionsElement) => {
      const firstOption = optionsElement.firstElementChild?.getBoundingClientRect()
      const style = window.getComputedStyle(optionsElement)
      return {
        columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
        optionHeight: Math.round(firstOption?.height ?? 0),
      }
    })).toEqual({ columns: 2, optionHeight: 74 })
  })

  test('eco mode pickers use security-style desktop layout without separators', async ({ page }) => {
    await page.goto('/at-a-glance/ecobee')

    const assertCompactPicker = async (triggerName: RegExp, dialogName: string) => {
      await page.getByLabel(triggerName).click()
      const dialog = page.getByRole('dialog', { name: dialogName })
      await expect(dialog).toBeVisible()
      const options = dialog.getByRole('group', { name: `${dialogName} options` })
      await expect(options).toHaveAttribute('data-layout', 'compact-grid')
      await expect(dialog.locator('span[aria-hidden="true"][class*="separator"]')).toHaveCount(0)

      await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBeGreaterThanOrEqual(495)
      const dialogBox = await dialog.boundingBox()
      expect(Math.round(dialogBox?.width ?? 0)).toBeLessThanOrEqual(500)
      await expect.poll(async () => options.evaluate((optionsElement) => {
        const firstOption = optionsElement.firstElementChild?.getBoundingClientRect()
        const style = window.getComputedStyle(optionsElement)
        return {
          columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
          optionHeight: Math.round(firstOption?.height ?? 0),
        }
      })).toEqual({ columns: 2, optionHeight: 74 })
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(dialog).toBeHidden()
    }

    await assertCompactPicker(/Eco Mode Critical Tracking Track Select Critical/i, 'Eco Mode Critical Tracking')
    await assertCompactPicker(/Eco Behavior When Away Keep Eco Active/i, 'Eco Behavior When Away')
  })

  const squareOverviewCases = [
    {
      backButtonName: 'Back to room climates',
      buttonName: /Open Living Room Climate/i,
      detailHeading: 'Living Room Climate',
      dialogName: 'Climate',
      hash: '#climate-overview',
      sectionLabel: 'Climate by room',
    },
    {
      backButtonName: 'Back to room occupancy',
      buttonName: /Open Living Room Occupancy/i,
      detailHeading: 'Living Room Occupancy',
      dialogName: 'Occupancy',
      hash: '#occupancy-overview',
      sectionLabel: 'Occupancy by room',
    },
    {
      adaptiveHeight: true,
      backButtonName: 'Back to room contact sensors',
      buttonName: /Open Living Room Contact Sensors/i,
      detailHeading: 'Living Room Contact Sensors',
      dialogName: 'Contact Sensors',
      hash: '#contact-sensors-overview',
      sectionLabel: 'Contact sensors by room',
    },
    {
      adaptiveHeight: true,
      dialogName: 'Air Quality',
      hash: '#aqi-overview',
      sectionLabel: 'AQI by room',
    },
  ]

  for (const modalCase of squareOverviewCases) {
    test(`${modalCase.dialogName} modal uses fixed 168px square room grid on desktop`, async ({ page }) => {
      await page.goto(`/at-a-glance/overview${modalCase.hash}`)

      const dialog = page.getByRole('dialog', { name: modalCase.dialogName })
      await expect(dialog).toBeVisible()
      const grid = await expectDesktopSquareGrid(dialog, modalCase.sectionLabel)
      const overviewDialogBox = await dialog.boundingBox()

      if ('adaptiveHeight' in modalCase) {
        const gridBox = await grid.boundingBox()
        expect(Math.round(overviewDialogBox?.height ?? 0)).toBeLessThan(760)
        expect(Math.round(overviewDialogBox?.height ?? 0)).toBeLessThanOrEqual(Math.round((gridBox?.height ?? 0) + 180))
      }

      if ('buttonName' in modalCase) {
        await clickWithPointerJitter(page, grid.getByRole('button', { name: modalCase.buttonName }))
        await expect(dialog).toBeVisible()
        await expect(dialog.getByRole('heading', { name: modalCase.detailHeading })).toBeVisible()
        await expect(dialog.getByRole('button', { name: modalCase.backButtonName })).toBeVisible()
        if (modalCase.dialogName === 'Contact Sensors') {
          const detailDialogBox = await dialog.boundingBox()
          expect(Math.abs(Math.round(detailDialogBox?.height ?? 0) - Math.round(overviewDialogBox?.height ?? 0))).toBeLessThanOrEqual(2)
        }
      }
    })
  }

  const adminSquareCases = [
    {
      dialogName: 'Presence-Based Overrides',
      gridLabel: 'Presence-Based Overrides by room',
      hash: '#presence-based-overrides',
    },
    {
      dialogName: 'Presence-Based Overrides Auto-Reset',
      gridLabel: 'Presence-Based Auto-Reset by room',
      hash: '#presence-based-overrides-auto',
    },
  ]

  for (const modalCase of adminSquareCases) {
    test(`${modalCase.dialogName} modal uses fixed 168px square admin cards on desktop`, async ({ page }) => {
      await page.goto(`/at-a-glance/admin${modalCase.hash}`)

      const dialog = page.getByRole('dialog', { name: modalCase.dialogName })
      await expect(dialog).toBeVisible()
      await expectDesktopAdminSquareGrid(dialog, modalCase.gridLabel)
    })
  }

  test('security page contact chip opens the same desktop contact sensors modal as Home', async ({ page }) => {
    await page.goto('/at-a-glance/security')

    await page.getByRole('button', { name: /Contact Sensors\s*All Closed/i }).click()
    const dialog = page.getByRole('dialog', { name: 'Contact Sensors' })
    await expect(dialog).toBeVisible()
    const grid = await expectDesktopSquareGrid(dialog, 'Contact sensors by room')
    const overviewDialogBox = await dialog.boundingBox()

    await clickWithPointerJitter(page, grid.getByRole('button', { name: /Open Living Room Contact Sensors/i }))
    await expect(dialog.getByRole('heading', { name: 'Living Room Contact Sensors' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Back to room contact sensors' })).toBeVisible()
    const detailDialogBox = await dialog.boundingBox()
    expect(Math.abs(Math.round(detailDialogBox?.height ?? 0) - Math.round(overviewDialogBox?.height ?? 0))).toBeLessThanOrEqual(2)
  })
})

test('settings links to Vacation mode controls', async ({ page }) => {
  await page.goto('/at-a-glance/settings')

  await expect(page.getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation\./i })).toBeVisible()
  await page.getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation\./i }).click()

  await expect(page).toHaveURL(/\/at-a-glance\/settings\?path=vacation/)
  await expect(page.getByRole('heading', { name: 'Vacation Mode', exact: true })).toBeVisible()
  await expect(page.getByText('Enable or disable vacation mode for the house')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Vacation Mode Off' })).toHaveCSS('min-height', '116px')
  await page.getByRole('button', { name: 'Vacation Mode Off' }).click()
  await expect(page.getByRole('button', { name: 'Vacation Mode On' })).toHaveCSS('outline-style', 'none')
  await expect(page.getByRole('heading', { name: 'Vacation Dates' })).toBeVisible()
  await expect(page.getByText('Set the start and end time for your vacation. Vacation mode will automatically be turned off at the set end date and time.')).toBeVisible()
  await expect(page.getByLabel('Start Date')).toHaveAttribute('type', 'date')
  await expect(page.getByLabel('End Time')).toHaveAttribute('type', 'time')
  for (const label of ['Start Date', 'Start Time', 'End Date', 'End Time']) {
    await expect(page.getByText(label, { exact: true })).toHaveCSS('text-align', 'left')
    await expect(page.getByLabel(label)).toHaveCSS('text-align', 'left')
  }
  await page.evaluate(() => {
    window.__vacationPickerCalls = 0
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value() {
        window.__vacationPickerCalls = (window.__vacationPickerCalls ?? 0) + 1
      },
    })
  })
  const endDateCard = page.getByText('End Date', { exact: true }).locator('..')
  await expect(endDateCard).toHaveCSS('cursor', 'pointer')
  await endDateCard.click({ position: { x: 8, y: 8 } })
  await expect.poll(() => page.evaluate(() => window.__vacationPickerCalls ?? 0)).toBe(1)
  await page.getByLabel('Start Date').click()
  await expect(page.getByLabel('Start Date').locator('..')).toHaveCSS('outline-style', 'none')
})

test('chores page shows source sections and checkbox todo rows for the logged-in user', async ({ page }) => {
  await page.goto('/at-a-glance/chores')

  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'House Calendar' })).toBeVisible()
  await expect(page.getByText('No events to display')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Groceries Off/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Past Due' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Evening Tasks' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Afternoon Tasks' })).toHaveCount(0)
  const pastDueList = page.getByLabel('Past Due todo list')
  await expect(pastDueList.getByRole('button', { name: /Mock task one/i })).toHaveAttribute('aria-pressed', 'false')

  await pastDueList.getByRole('button', { name: /Mock task one/i }).click()

  await expect(pastDueList.getByRole('button', { name: /Mock task one/i })).toHaveCount(0)
  await expect(page.getByText('Unable to update task')).toHaveCount(0)
})

test('chores create task FAB opens the source-shaped task modal', async ({ page }) => {
  await page.goto('/at-a-glance/chores')

  await expect(page.getByRole('heading', { name: 'Chores' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Task' })).toHaveCSS('background-color', 'rgb(0, 154, 199)')
  await page.getByRole('button', { name: 'Add Task' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Create Task' })).toBeVisible()
  await expect(dialog.getByText('Create Donetick Task')).toHaveCount(0)
  expect(await page.evaluate(() => (document.activeElement instanceof HTMLInputElement ? document.activeElement.name : ''))).not.toBe('name')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await expect(dialog.getByLabel('Task Name')).toBeVisible()
  await expect(dialog.getByLabel('Due Date')).toHaveAttribute('type', 'date')
  await expect(dialog.getByLabel('Due Time')).toHaveAttribute('type', 'time')
  await expect(dialog.getByLabel('Assignee')).toHaveValue('')
  await expect(dialog.getByLabel('Priority')).toHaveValue('critical')
  await expect(dialog.getByLabel('Recurrence')).toHaveValue('no_repeat')
  await expect(dialog.getByRole('option', { name: /Adaptive/i })).toHaveCount(0)
  await expect(dialog.getByLabel('Repeat Every')).toHaveCount(0)
  await dialog.getByLabel('Recurrence').selectOption('interval')
  await expect(dialog.getByLabel('Repeat Every')).toBeVisible()
  await expect(dialog.getByLabel('Repeat Every')).toHaveAttribute('inputmode', 'numeric')
  await dialog.getByLabel('Repeat Every').focus()
  await expect(dialog).toHaveCSS('transform', 'none')
  await expect(dialog.getByLabel('Interval Unit')).toBeVisible()
  await expect(dialog.getByLabel('Days of Week', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveAttribute('data-state', 'closed')
  await page.getByRole('button', { name: 'Add Task' }).click()
  await expect(dialog.getByLabel('Recurrence')).toHaveValue('no_repeat')
  await expect(dialog.getByLabel('Repeat Every')).toHaveCount(0)
})

test('chore subpages keep the Chores bottom nav item active', async ({ page }) => {
  await page.goto('/at-a-glance/stephs-chores')

  await expect(page.getByRole('heading', { name: "Steph's Chores" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Chores' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Task' }).click()
  await expect(page.getByRole('dialog').getByLabel('Assignee')).toHaveValue('2')
})

test('groceries page opens a shopping-list add item modal', async ({ page }) => {
  await page.goto('/at-a-glance/groceries')

  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Groceries' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Groceries' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Add Grocery Item' })).toBeVisible()
  await expect(dialog.getByLabel('Item')).toBeVisible()
  await expect(dialog.getByLabel('Assignee')).toHaveCount(0)
  await expect(dialog.getByLabel('Priority')).toHaveCount(0)
  await expect(dialog.getByLabel('Recurrence')).toHaveCount(0)
  await expect(dialog.getByLabel('Description')).toHaveCount(0)
})

test('room pages are statically ported React pages', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')

  await expect(page.getByRole('heading', { name: 'Living Room' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Room Status' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Window/i }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Air Quality/i }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Climate' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible()
})

test('room sections keep popup-only grill controls out of the Back Deck page', async ({ page }) => {
  await page.goto('/at-a-glance/back-deck')

  await expect(page.getByRole('heading', { name: 'Grill' })).toBeVisible()
  await expect(page.getByText('Bear Grills')).toBeVisible()
  await expect(page.getByRole('button', { name: /Bear Grills Off/i })).toHaveCount(0)
  await expect(page.getByText('Pellet Level')).toHaveCount(0)
  await expect(page.getByText('Keep Warm')).toHaveCount(0)
})

test('room status chips open direct reusable modal sheets', async ({ page }) => {
  await page.goto('/at-a-glance/kitchen')

  await expect(page.getByRole('button', { name: 'Rooms' })).toBeVisible()
  await page.getByRole('button', { name: /Lights/i }).first().click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kitchen Lights' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Rooms')).toHaveCount(0)
})

test('living room header chips open climate occupancy and air quality popups', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')

  await page.getByRole('button', { name: /Climate/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Living Room Climate' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Occupancy/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Living Room Occupancy' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Air Quality/i }).first().click()
  await expect(page.getByRole('heading', { name: 'Living Room Air Quality' })).toBeVisible()
  await expect(page.getByText('Fan Modes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Auto Modes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('PM2.5')).toBeVisible()
  await expect(page.getByText('AQI')).toBeVisible()
})

test('guest room page opens source-aligned header popups', async ({ page }) => {
  await page.goto('/at-a-glance/guest-room')

  await expect(page.getByRole('heading', { name: 'Guest Room' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Lights On$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Climate 69°F - 71°F$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Occupancy Detected$/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Window Closed$/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Climate' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Vent Open$/i })).toHaveAttribute('data-tone', 'climate')
  await expect(page.getByRole('button', { name: /^Vent Open$/i })).not.toHaveAttribute('data-size')
  await expect(page.getByRole('button', { name: /^Air Purifier Auto • On$/i })).toHaveAttribute('data-tone', 'air')
  await expect(page.getByRole('button', { name: /^Air Purifier Auto • On$/i })).not.toHaveAttribute('data-size')

  await page.getByRole('button', { name: /^Lights On$/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Guest Room Lights' })).toBeVisible()
  await expect(page.getByRole('button', { name: /TV Light On/i })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /^Climate 69°F - 71°F$/i }).click()
  await expect(page.getByRole('heading', { name: 'Guest Room Climate' })).toBeVisible()
  await expect(page.getByText('69.5°F')).toBeVisible()
  await expect(page.getByText('70.2°F')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /^Air Quality 2$/i }).click()
  await expect(page.getByRole('heading', { name: 'Guest Room Air Quality' })).toBeVisible()
  await expect(page.getByText('Fan Modes')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Auto Modes')).toBeVisible()
})

test('room media cards open ported remote modals', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')
  await page.getByRole('button', { name: /^Living Room SHIELD Off$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect.poll(async () => {
    return dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return Math.round((rect.height / window.innerHeight) * 100)
    })
  }).toBe(90)
  await expect(page.getByRole('heading', { name: 'Living Room SHIELD Remote' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sonos Volume' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disney+' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /^Apple TV Paused$/i }).click()
  await expect(page.getByRole('heading', { name: 'Apple TV Remote' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/theater-room')
  await page.getByRole('button', { name: /^Theater Room Off$/i }).click()
  await expect(page.getByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Apps' }).click()
  await expect(page.getByRole('button', { name: 'Prime Video' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Devices' }).click()
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Projector Off/i })).toBeVisible()
})

test('Free Sleep Add Alarm writes the expected alarm into the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const addAlarm = await openAddAlarmForm(dialog, "Steph's Bed")

  await selectAlarmDays(addAlarm, ['Sunday'])
  await addAlarm.getByRole('textbox', { name: 'New alarm time' }).fill('08:00', { force: true })
  await addAlarm.getByRole('button', { exact: true, name: 'Add Alarm' }).click()

  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })
  await expect(sundaySection.getByText('3 alarms')).toBeVisible()
  await expect(sundaySection.getByRole('article', { name: /Steph's Bed Sunday alarm 3 enabled/i })).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
    { enabled: true, time: '08:00' },
  ])
})

test('Free Sleep individual alarm toggle only disables that alarm in the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })

  await sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" }).click()

  await expect(sundaySection.getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'false')
  await expect(sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm 2" })).toHaveAttribute('aria-checked', 'true')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: false, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep alarm time edit keeps the alarm enabled in the UI and backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })

  await expect(sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
  await sundaySection.getByRole('textbox', { name: "Steph's Bed Sunday alarm time" }).fill('06:35', { force: true })

  await expect(sundaySection.getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:35' },
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep alarm delete confirms and removes only that alarm from the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })
  const deleteFirstAlarm = sundaySection.getByRole('button', { exact: true, name: "Delete Steph's Bed Sunday alarm" })

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.type()).toBe('confirm')
    expect(confirmDialog.message()).toBe("Delete Steph's Bed Sunday alarm at 6:30 AM?")
    await confirmDialog.dismiss()
  })
  await deleteFirstAlarm.click()

  await expect(sundaySection.getByText('2 alarms')).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '06:30' },
    { enabled: true, time: '07:15' },
  ])

  page.once('dialog', async (confirmDialog) => {
    expect(confirmDialog.message()).toBe("Delete Steph's Bed Sunday alarm at 6:30 AM?")
    await confirmDialog.accept()
  })
  await deleteFirstAlarm.click()

  await expect(sundaySection.getByText('1 alarm')).toBeVisible()
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: true, time: '07:15' },
  ])
})

test('Free Sleep day toggle disables every alarm for that day in the backend schedule', async ({ page }) => {
  const dialog = await openBedAlarmDialog(page, /Steph's Bed Off/i)
  const sundaySection = dialog.getByRole('region', { name: "Steph's Bed Sunday alarms" })

  await sundaySection.getByRole('switch', { name: "Disable Steph's Bed Sunday alarms" }).click()

  await expect(sundaySection.getByRole('switch', { name: "Enable Steph's Bed Sunday alarms" })).toHaveAttribute('aria-checked', 'false')
  await expect(sundaySection.getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'false')
  await expect(sundaySection.getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm 2" })).toHaveAttribute('aria-checked', 'false')
  await expectFreeSleepAlarms(page, 'right', 'saturday', [
    { enabled: false, time: '06:30' },
    { enabled: false, time: '07:15' },
  ])
})

test('security page opens ported security, contact, and camera modals', async ({ page }) => {
  await page.goto('/at-a-glance/security')

  await expect(page.getByRole('heading', { level: 1, name: 'Security' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Security System Armed Home/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Front Door Locked/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cameras' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Front Door camera' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mach-E' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Doors Locked/i })).toHaveCount(0)

  await page.getByRole('button', { name: /Security System Armed Home/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Security System' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set security system to Away' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Contact Sensors\s*All Closed/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Contact sensors by room')).toBeVisible()
  await expect(page.getByRole('button', { name: /Open Living Room Contact Sensors/i })).toBeVisible()
  await page.getByRole('button', { name: /Open Living Room Contact Sensors/i }).click()
  await expect(page.getByRole('heading', { name: 'Living Room Contact Sensors' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to room contact sensors' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Open Front Door camera' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Front Door Camera' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Snapshot' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Muted' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Record' })).toBeVisible()
})

test('room vacuum cards open reusable vacuum modal controls', async ({ page }) => {
  await page.goto('/at-a-glance/living-room')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Main Floor Robot Vacuum')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Vacuum Controls' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Docked' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Power Settings' })).toBeVisible()
  await expect(page.getByText('Choose whether the robot vacuums, mops, or combines both for the next run.')).toBeVisible()
  await expect(page.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toHaveCount(0)
  await expect(page.getByText('Choose how many passes the vacuum should make, then start cleaning with the selected zones.')).toBeVisible()
  await expect(page.getByRole('combobox', { name: /Cleaning Passes 1x/i })).toHaveValue('1')
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toHaveAttribute('data-icon', 'mdi:play')
  await expect(page.getByRole('button', { name: 'Info' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Consumables' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Mode options' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
  await expect(page.getByRole('dialog', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
  await expect(page.getByRole('dialog', { name: 'Fan' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zones' }).click()
  await expect(page.getByRole('button', { name: /living room/i })).toBeVisible()
  await page.getByRole('button', { name: 'Auto-Clean' }).click()
  await expect(page.getByRole('heading', { name: 'Disabled Auto-Clean Rooms' })).toBeVisible()
  await expect(page.getByText('Check rooms that should be skipped when the coordinator starts an automatic away clean.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Living Room auto-clean enabled' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Closet auto-clean enabled' })).toBeVisible()
  await page.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toBeVisible()
  await page.getByRole('button', { name: 'Info' }).click()
  await expect(page.getByRole('heading', { name: 'Consumables' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Main Brush 204h left' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Dustbag OK' })).toBeVisible()
})

test('theater room vacuum opens with map and Valetudo power controls', async ({ page }) => {
  await page.goto('/at-a-glance/theater-room')

  await page.getByRole('button', { name: /Theater Room Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Theater Room: Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Theater Room Valetudo map' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Info' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zones' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
  await expect(page.getByRole('dialog', { name: 'Mode' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
  await expect(page.getByRole('dialog', { name: 'Fan' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Info' }).click()
  await expect(page.getByRole('group', { name: 'Main Brush 245h left' })).toBeVisible()
  await expect(page.getByText(/Entity not available/i)).toHaveCount(0)
})

test('vacuums page renders without live HASS backend', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await expect(page.getByRole('heading', { level: 1, name: 'Vacuums' })).toBeVisible()
  await expect(page.getByLabel('Music Room')).toBeVisible()
  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  await expect(mainFloorVacuum).toBeVisible()
  await expect(mainFloorVacuum).toHaveAttribute('data-tone', 'vacuum')
})

test('available vacuum cards open source-style modal controls', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zones' }).click()
  await expect(page.getByText('Zones').first()).toBeVisible()
  await page.getByRole('button', { name: 'Auto-Clean' }).click()
  const officeAutoClean = page.getByRole('button', { name: 'Office auto-clean enabled' })
  await expect(officeAutoClean).toHaveAttribute('aria-pressed', 'false')
  await officeAutoClean.click()
  await expect(page.getByRole('button', { name: 'Office auto-clean disabled' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toBeVisible()
  await page.getByRole('button', { name: 'Info' }).click()
  await expect(page.getByRole('group', { name: 'Main Filter 54h left' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Detergent OK' })).toBeVisible()
})

test('vacuum native dropdown stays aligned after rapid close and reopen', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  const cardBox = await mainFloorVacuum.boundingBox()
  if (!cardBox) throw new Error('Main Floor vacuum card was not measurable')

  await mainFloorVacuum.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.waitForTimeout(450)

  await page.getByRole('combobox', { name: /Cleaning Passes/i }).selectOption('3')
  const closeBox = await page.getByRole('button', { name: 'Close' }).boundingBox()
  if (!closeBox) throw new Error('Vacuum modal close button was not measurable')

  await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
  await page.waitForTimeout(50)
  await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)

  const rapidReopenState = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const select = document.querySelector<HTMLSelectElement>('select[aria-label^="Cleaning Passes"]')
    const rect = select?.getBoundingClientRect()
    const style = dialog ? getComputedStyle(dialog) : null
    const selectStyle = select ? getComputedStyle(select) : null

    return {
      animationName: style?.animationName,
      pointerEvents: selectStyle?.pointerEvents,
      rapidReopen: dialog?.getAttribute('data-rapid-reopen'),
      selectRect: rect ? { y: rect.y, height: rect.height } : null,
      transform: style?.transform,
      value: select?.value,
    }
  })

  expect(rapidReopenState.rapidReopen).toBe('true')
  expect(rapidReopenState.animationName).toBe('none')
  expect(rapidReopenState.transform).toBe('none')
  expect(rapidReopenState.pointerEvents).toBe('auto')
  expect(rapidReopenState.selectRect?.y).toBeLessThan(720)
  expect(rapidReopenState.value).toBe('3')

  await page.getByRole('combobox', { name: /Cleaning Passes/i }).selectOption('2')
  await expect(page.getByRole('combobox', { name: /Cleaning Passes/i })).toHaveValue('2')
})

test('vacuum mode dropdown keeps source option labels while optimistic', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  const mainFloorVacuum = page.getByRole('button', { name: /Main Floor Docked/i })
  const cardBox = await mainFloorVacuum.boundingBox()
  if (!cardBox) throw new Error('Main Floor vacuum card was not measurable')

  await mainFloorVacuum.click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('combobox', { name: /Mode/i }).selectOption('mop')

  const closeBox = await page.getByRole('button', { name: 'Close' }).boundingBox()
  if (!closeBox) throw new Error('Vacuum modal close button was not measurable')

  await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2)
  await page.waitForTimeout(50)
  await page.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)

  const modeOptions = await page.getByRole('combobox', { name: /Mode Mop/i }).evaluate((select) => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const style = dialog ? getComputedStyle(dialog) : null
    return {
      animationName: style?.animationName,
      options: Array.from((select as HTMLSelectElement).options).map((option) => ({ label: option.label, value: option.value })),
      rapidReopen: dialog?.getAttribute('data-rapid-reopen'),
      transform: style?.transform,
      value: (select as HTMLSelectElement).value,
    }
  })

  expect(modeOptions.rapidReopen).toBe('true')
  expect(modeOptions.animationName).toBe('none')
  expect(modeOptions.transform).toBe('none')
  expect(modeOptions.value).toBe('mop')
  expect(modeOptions.options).toEqual([
    { label: 'Vacuum And Mop', value: 'vacuum_and_mop' },
    { label: 'Mop', value: 'mop' },
    { label: 'Vacuum', value: 'vacuum' },
    { label: 'Vacuum Then Mop', value: 'vacuum_then_mop' },
  ])

  await page.getByRole('combobox', { name: /Mode Mop/i }).selectOption('vacuum')
  await expect(page.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
})

test('vacuum clean start shows disabled optimistic controls while backend is stale', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('button', { name: 'Clean', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Cleaning' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeDisabled()
})

test('thermostat hero dial allows vertical swipe scrolling', async ({ page, browserName }) => {
  await page.goto('/at-a-glance/ecobee')

  await expect(page.getByRole('heading', { level: 1, name: 'Thermostat' })).toBeVisible()
  await expect(page.getByText(/manually reviewed/i)).toHaveCount(0)

  const heroDial = page.getByRole('region', { name: /Whole Home thermostat/i })
  await expect(heroDial).toBeVisible()
  await expect(heroDial.locator('[data-testid="control-slider-circular"]')).toHaveCSS('touch-action', 'pan-y')
  const beforeLabel = await heroDial.getAttribute('aria-label')
  expect(beforeLabel).toContain('Whole Home thermostat')

  const touchDrag = async (startX: number, startY: number, endX: number, endY: number) => {
    if (browserName === 'chromium') {
      const client = await page.context().newCDPSession(page)
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] })
      for (let step = 1; step <= 8; step += 1) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + ((endX - startX) * step) / 8, y: startY + ((endY - startY) * step) / 8 }] })
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await client.detach()
      return
    }

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 8 })
    await page.mouse.up()
  }

  const mouseDrag = async (startX: number, startY: number, endX: number, endY: number) => {
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(endX, endY, { steps: 8 })
    await page.mouse.up()
  }

  const pointForTemperature = (box: NonNullable<Awaited<ReturnType<typeof heroDial.boundingBox>>>, value: number) => {
    const percentage = (value - 45) / (95 - 45)
    const angle = percentage * 270
    const radians = ((angle - 225) * Math.PI) / 180
    const radius = box.width * (145 / 320)
    return {
      x: box.x + box.width / 2 + Math.cos(radians) * radius,
      y: box.y + box.height / 2 + Math.sin(radians) * radius,
    }
  }

  const scrollTop = () => heroDial.evaluate((element) => {
    let current = element.parentElement
    while (current) {
      const style = window.getComputedStyle(current)
      if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current.scrollTop
      current = current.parentElement
    }
    return window.scrollY
  })

  const before = await scrollTop()
  const box = await heroDial.boundingBox()
  expect(box).not.toBeNull()

  const highHandle = heroDial.locator('[data-target="high"]')
  await expect(highHandle).toHaveCount(1)
  const highHandleBox = await highHandle.boundingBox()
  expect(highHandleBox).not.toBeNull()
  const highArc = heroDial.locator('[data-target="high-arc"]')
  await expect(highArc).toHaveCount(1)
  await expect(highArc).toHaveCSS('stroke', 'rgb(44, 142, 152)')
  const highArcBefore = await highArc.getAttribute('d')
  const highHandleEnd = pointForTemperature(box!, 78)
  await mouseDrag(highHandleBox!.x + highHandleBox!.width / 2, highHandleBox!.y + highHandleBox!.height / 2, highHandleEnd.x, highHandleEnd.y)
  await expect(heroDial).not.toHaveAttribute('aria-label', beforeLabel!)
  const highHandleBoxAfter = await highHandle.boundingBox()
  expect(highHandleBoxAfter).not.toBeNull()
  expect(highHandleBoxAfter!.x).toBeGreaterThan(highHandleBox!.x + 20)
  await expect(highArc).not.toHaveAttribute('d', highArcBefore!)
  const lowHandle = heroDial.locator('[data-target="low"]')
  await expect(lowHandle).toHaveCount(1)
  const lowHandleBox = await lowHandle.boundingBox()
  expect(lowHandleBox).not.toBeNull()
  const lowArc = heroDial.locator('[data-target="low-arc"]')
  await expect(lowArc).toHaveCount(1)
  await expect(lowArc).toHaveCSS('stroke', 'rgb(205, 84, 1)')
  const lowArcBefore = await lowArc.getAttribute('d')
  const lowHandleEnd = pointForTemperature(box!, 68)
  await mouseDrag(lowHandleBox!.x + lowHandleBox!.width / 2, lowHandleBox!.y + lowHandleBox!.height / 2, lowHandleEnd.x, lowHandleEnd.y)
  await expect(lowArc).not.toHaveAttribute('d', lowArcBefore!)
  await page.waitForTimeout(300)
  const labelBeforeRingSwipe = (await heroDial.getAttribute('aria-label')) ?? beforeLabel!

  const ringX = box!.x + box!.width * 0.86
  const ringY = box!.y + box!.height * 0.5
  await touchDrag(ringX, ringY, ringX, ringY - 224)

  await expect.poll(scrollTop).toBeGreaterThan(before + 40)
  await expect(heroDial).toHaveAttribute('aria-label', labelBeforeRingSwipe)
})
