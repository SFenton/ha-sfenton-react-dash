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

test('overview renders with mock Home Assistant state', async ({ page }) => {
  await page.goto('/at-a-glance/overview')

  await expect(page).toHaveTitle('Home Assistant')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quick Links' })).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Create Donetick task' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create Donetick task' })).toHaveCSS('width', '62px')
  await expect(page.getByRole('button', { name: 'Create Donetick task' })).toHaveCSS('background-color', 'rgb(0, 154, 199)')
  await page.getByRole('button', { name: 'Create Donetick task' }).click()
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
  await page.getByRole('button', { name: 'Create Donetick task' }).click()
  await expect(dialog.getByLabel('Recurrence')).toHaveValue('no_repeat')
  await expect(dialog.getByLabel('Repeat Every')).toHaveCount(0)
})

test('chore subpages keep the Chores bottom nav item active', async ({ page }) => {
  await page.goto('/at-a-glance/stephs-chores')

  await expect(page.getByRole('heading', { name: "Steph's Chores" })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Chores' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Create Donetick task' })).toBeVisible()
  await page.getByRole('button', { name: 'Create Donetick task' }).click()
  await expect(page.getByRole('dialog').getByLabel('Assignee')).toHaveValue('2')
})

test('groceries page opens a shopping-list add item modal', async ({ page }) => {
  await page.goto('/at-a-glance/groceries')

  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add grocery item' })).toBeVisible()
  await page.getByRole('button', { name: 'Add grocery item' }).click()
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
