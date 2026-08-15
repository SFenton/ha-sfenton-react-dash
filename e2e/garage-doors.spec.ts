import { expect, test, type Page } from '@playwright/test'
import {
  GARAGE_DOOR_CONFIRM_TIMEOUT_MS,
  GARAGE_DOOR_FAILURE_HOLD_MS,
  GARAGE_DOOR_SENDING_FEEDBACK_MS,
} from '../src/constants/garageDoors'

type MockCallServiceOutcome = 'pending' | 'reject' | 'resolve'
type MockConnectionStatus = 'connected' | 'disconnected' | 'suspended'

async function resetGarageMocks(page: Page) {
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        reset: () => void
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.reset()
    mock.setEntityState('cover.left_door', 'closed')
    mock.setEntityState('cover.right_door', 'closed')
  })
}

async function setServiceOutcome(page: Page, service: string, outcome: MockCallServiceOutcome) {
  await page.evaluate(({ nextOutcome, targetService }) => {
    const mock = (window as unknown as {
      __mockHass: {
        setCallServiceOutcome: (domain: string, service: string, outcome: MockCallServiceOutcome) => void
      }
    }).__mockHass
    mock.setCallServiceOutcome('cover', targetService, nextOutcome)
  }, { nextOutcome: outcome, targetService: service })
}

async function setDoorState(page: Page, state: string) {
  await page.evaluate((nextState) => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('cover.left_door', nextState)
  }, state)
}

async function setConnectionStatus(page: Page, status: MockConnectionStatus) {
  await page.evaluate((nextStatus) => {
    const mock = (window as unknown as {
      __mockHass: {
        setConnectionStatus: (status: MockConnectionStatus) => void
      }
    }).__mockHass
    mock.setConnectionStatus(nextStatus)
  }, status)
}

async function garageCalls(page: Page) {
  return page.evaluate(() => (
    (window as unknown as { __mockHass: { calls: Record<string, unknown>[] } }).__mockHass.calls
      .filter((call) => call.domain === 'cover')
  ))
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
})

test('garage command feedback is immediate, stable, and converges on Home Assistant state', async ({ page }) => {
  await page.goto('/at-a-glance/security')
  await resetGarageMocks(page)

  const closed = page.getByRole('button', { name: 'Left Door Closed' })
  const before = await closed.boundingBox()
  if (!before) throw new Error('Garage door tile was not measurable before the command')

  await closed.click()

  const sending = page.getByRole('button', { name: 'Left Door Sending Open…' })
  await expect(sending).toBeVisible()
  await expect(sending).toHaveAttribute('aria-disabled', 'true')
  expect(await sending.evaluate((element) => (element as HTMLButtonElement).disabled)).toBe(false)
  await expect(page.locator('[data-live-announcement="true"]').filter({ hasText: 'Sending Open…' })).toHaveText('Sending Open…')
  const during = await sending.boundingBox()
  if (!during) throw new Error('Garage door tile was not measurable during the command')
  expect(Math.round(during.width)).toBe(Math.round(before.width))
  expect(Math.round(during.height)).toBe(Math.round(before.height))
  await expect.poll(() => garageCalls(page)).toEqual([
    { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
  ])

  await expect(page.getByRole('button', { name: 'Left Door Opening' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Left Door Opening' })).not.toHaveAttribute('aria-disabled')
  await setDoorState(page, 'opening')
  await expect(page.getByRole('button', { name: 'Left Door Opening' })).toBeEnabled()
  await setDoorState(page, 'open')
  await expect(page.getByRole('button', { name: 'Left Door Open' })).toBeEnabled()
})

test('garage service rejection restores truth, announces an error, and remains retryable', async ({ page }) => {
  await page.goto('/at-a-glance/security')
  await resetGarageMocks(page)
  await setServiceOutcome(page, 'open_cover', 'reject')

  await page.getByRole('button', { name: 'Left Door Closed' }).click()

  const failed = page.getByRole('button', { name: 'Left Door Error' })
  await expect(failed).toBeEnabled()
  await expect(failed).toHaveAttribute('data-tone', 'danger')
  await expect(page.locator('[data-live-announcement="true"]').filter({ hasText: 'Error' })).toHaveText('Error')
  await expect.poll(() => garageCalls(page)).toEqual([
    { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
  ])

  await setServiceOutcome(page, 'open_cover', 'resolve')
  await failed.click()
  await expect(page.getByRole('button', { name: 'Left Door Sending Open…' })).toHaveAttribute('aria-disabled', 'true')
  await expect.poll(() => garageCalls(page)).toHaveLength(2)
})

test('garage commands fail without a phantom transition when Home Assistant is disconnected', async ({ page }) => {
  await page.goto('/at-a-glance/security')
  await resetGarageMocks(page)
  await setConnectionStatus(page, 'disconnected')

  await page.getByRole('button', { name: 'Left Door Closed' }).click()

  await expect(page.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
  await expect(page.locator('[data-live-announcement="true"]').filter({ hasText: 'Error' })).toHaveText('Error')
  await expect.poll(() => garageCalls(page)).toEqual([])
})

test('garage confirmation timeout returns to live truth with an actionable error', async ({ page }) => {
  await page.goto('/at-a-glance/security')
  await resetGarageMocks(page)
  await expect(page.getByRole('button', { name: 'Left Door Closed' })).toBeVisible()
  await page.clock.install()

  await page.getByRole('button', { name: 'Left Door Closed' }).click()
  await page.clock.fastForward(GARAGE_DOOR_SENDING_FEEDBACK_MS)
  await expect(page.getByRole('button', { name: 'Left Door Opening' })).toBeEnabled()

  await page.clock.fastForward(GARAGE_DOOR_CONFIRM_TIMEOUT_MS - GARAGE_DOOR_SENDING_FEEDBACK_MS)
  await expect(page.getByRole('button', { name: 'Left Door Error' })).toBeEnabled()
  await expect(page.locator('[data-live-announcement="true"]').filter({ hasText: 'Error' })).toHaveText('Error')

  await page.clock.fastForward(GARAGE_DOOR_FAILURE_HOLD_MS)
  await expect(page.getByRole('button', { name: 'Left Door Closed' })).toBeEnabled()
})

test('garage and guest surfaces share duplicate suppression and the explicit service path', async ({ page }) => {
  await page.goto('/at-a-glance/garage')
  await resetGarageMocks(page)

  const garageTile = page.getByRole('button', { name: 'Left Door Closed' })
  await garageTile.evaluate((element) => {
    const button = element as HTMLButtonElement
    button.click()
    button.click()
  })
  await expect.poll(() => garageCalls(page)).toEqual([
    { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
  ])
  await expect(page.getByRole('button', { name: 'Left Door Sending Open…' })).toHaveAttribute('aria-disabled', 'true')

  await page.goto('/at-a-glance/overview')
  await resetGarageMocks(page)
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('input_boolean.guests_staying_in_guest_room', 'on')
  })
  await page.getByRole('button', { name: 'Guest Presence Security' }).click()
  const dialog = page.getByRole('dialog', { name: 'Guest Presence Security' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Left Door Closed' }).click()
  await expect(dialog.getByRole('button', { name: 'Left Door Sending Open…' })).toHaveAttribute('aria-disabled', 'true')
  await expect.poll(() => garageCalls(page)).toEqual([
    { domain: 'cover', service: 'open_cover', target: 'cover.left_door' },
  ])
})
