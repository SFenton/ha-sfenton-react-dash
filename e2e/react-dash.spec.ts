import { expect, test } from '@playwright/test'

test('overview renders with mock Home Assistant state', async ({ page }) => {
  await page.goto('/at-a-glance/overview')

  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
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

test('chore subpages keep the Chores bottom nav item active', async ({ page }) => {
  await page.goto('/at-a-glance/stephs-chores')

  await expect(page.getByRole('heading', { name: "Steph's Chores" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Chores' })).toHaveAttribute('aria-current', 'page')
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

  await page.getByRole('button', { name: /Lights/i }).first().click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kitchen Lights' })).toBeVisible()
  await expect(page.getByText('Rooms')).toHaveCount(0)
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
  await page.getByRole('button', { name: /^SHIELD Off$/i }).click()
  await expect(page.getByRole('heading', { name: 'Living Room: SHIELD' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'SHIELD Remote' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sonos Volume' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disney+' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/master-bedroom')
  await page.getByRole('button', { name: /^Apple TV Paused$/i }).click()
  await expect(page.getByRole('heading', { name: 'Master Bedroom: Apple TV' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Apple TV Remote' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Plex' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.goto('/at-a-glance/theater-room')
  await page.getByRole('button', { name: /^Theater Room Off$/i }).click()
  await expect(page.getByRole('heading', { name: 'Theater Room: Theater Room' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Theater Remote' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Prime Video' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Projector Off/i })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'Entryway' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Office' })).toBeVisible()
  await expect(page.getByLabel('PC Window Closed')).toBeVisible()
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

  await page.getByRole('button', { name: /Robot Vacuum Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Main Floor Robot Vacuum')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Vacuum Controls' })).toBeVisible()
  await expect(page.getByText('Power Settings')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Power Settings' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Docked' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Docked' }).getByRole('button', { name: 'Empty Dock' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toHaveAttribute('data-icon', 'mdi:play')
  await expect(page.getByRole('heading', { name: 'Zones' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Empty Dock' })).toBeVisible()
  const sectionOrder = await page.evaluate(() => [...document.querySelectorAll('h3')].map((heading) => heading.textContent?.trim()))
  expect(sectionOrder.indexOf('Zones')).toBeLessThan(sectionOrder.indexOf('Empty Dock'))
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Mode options' })).toHaveCount(0)
  await page.getByRole('button', { name: /Mode Vacuum/i }).click()
  const modePicker = page.getByRole('dialog', { name: 'Mode' })
  await expect(modePicker).toBeVisible()
  await expect(modePicker.getByRole('button', { name: /^Vacuum$/ })).toHaveAttribute('aria-pressed', 'true')
  await modePicker.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: /Fan Balanced/i }).click()
  const fanPicker = page.getByRole('dialog', { name: 'Fan' })
  await expect(fanPicker).toBeVisible()
  await expect(fanPicker.getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true')
  await fanPicker.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('button', { name: /living room/i })).toBeVisible()
})

test('theater room vacuum opens with map and Valetudo power controls', async ({ page }) => {
  await page.goto('/at-a-glance/theater-room')

  await page.getByRole('button', { name: /Robot Vacuum Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Theater Room: Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Theater Room Valetudo map' })).toBeVisible()
  await page.getByRole('button', { name: /Mode Vacuum/i }).click()
  const modePicker = page.getByRole('dialog', { name: 'Mode' })
  await expect(modePicker.getByRole('button', { name: /^Vacuum$/ })).toHaveAttribute('aria-pressed', 'true')
  await modePicker.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: /Fan Balanced/i }).click()
  const fanPicker = page.getByRole('dialog', { name: 'Fan' })
  await expect(fanPicker.getByRole('button', { name: 'Balanced' })).toHaveAttribute('aria-pressed', 'true')
  await fanPicker.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByText(/Entity not available/i)).toHaveCount(0)
})

test('vacuums page renders without live HASS backend', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await expect(page.getByRole('heading', { level: 1, name: 'Vacuums' })).toBeVisible()
  await expect(page.getByLabel('Music Room')).toBeVisible()
  await expect(page.getByRole('button', { name: /Main Floor Docked/i })).toBeVisible()
})

test('available vacuum cards open source-style modal controls', async ({ page }) => {
  await page.goto('/at-a-glance/vacuums')

  await page.getByRole('button', { name: /Main Floor Docked/i }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Main Floor Valetudo map' })).toBeVisible()
  await expect(page.getByText('No error')).toHaveCount(0)
  await expect(page.getByText('Zones').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clean', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Empty Dock' })).toBeVisible()
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
