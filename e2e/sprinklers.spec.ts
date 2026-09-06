import { expect, test } from './layout/fixture'

test('shows both sprinkler controllers and edits Front Yard on mobile', async ({ page }) => {
  await page.goto('/at-a-glance/sprinklers')

  await expect(page.getByRole('heading', { name: 'Sprinklers' })).toBeVisible()
  await expect(page.getByText('Battery 12%')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Backyard Faucet Auto · Next Unknown' })).toBeVisible()

  await page.getByRole('button', { name: /Front Yard Auto · Next/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Water now · Front Yard' })).toBeEnabled()
  await expect(dialog.getByRole('button', { name: 'Stop watering' })).toBeDisabled()

  await dialog.getByRole('button', { name: /Front Yard schedule .* Every day/i }).click()
  await expect(dialog.getByRole('heading', { name: 'Front Yard schedule' })).toBeVisible()
  await expect(dialog.getByLabel('Start 1')).toHaveValue('07:00')
  await expect(dialog.getByLabel('Start 2')).toHaveValue('19:00')
  await expect(dialog.getByRole('button', { name: 'Add Another Start Time' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apply' })).toBeEnabled()

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Backyard Faucet Auto · Next Unknown' }).click()
  await expect(dialog.getByRole('heading', { name: 'Backyard Faucet' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Water now · Sidewalk (New)' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Water now · Bushes (New)' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Water now · Backyard' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Water now · House' })).toBeVisible()
})
