import { expect, test } from '@playwright/test'

const WARNING_TEXT = 'Guest Room guest mode is active. Turning off Relay Control Mode keeps the Guest Room on direct wall control and Guest Bathroom presence lighting off. Turn off Guest Room in Guest Controls to restore normal behavior.'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/at-a-glance/settings?path=admin')
})

test('shows the relay guest-mode warning only while both helpers are on', async ({ page }) => {
  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('input_boolean.relay_control_mode', 'on')
    mock.setEntityState('input_boolean.guests_staying_in_guest_room', 'on')
  })

  const relaySection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Relay Control Mode' }) })
  await expect(relaySection.getByRole('button', { name: 'Relay Control Mode On' })).toHaveAttribute('aria-pressed', 'true')
  await expect(relaySection.getByRole('alert')).toHaveText(WARNING_TEXT)

  await page.evaluate(() => {
    const mock = (window as unknown as {
      __mockHass: {
        setEntityState: (entityId: string, state: string) => void
      }
    }).__mockHass
    mock.setEntityState('input_boolean.relay_control_mode', 'off')
  })

  await expect(relaySection.getByRole('alert')).toBeHidden()
})
