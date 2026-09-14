import { expect, type Locator, type Page } from './layout/fixture'
import { applyProfile, waitForModalReady } from './layout/evidence'
import { journey } from './layout/scenarios'
import { layoutProfile, type SafeAreaInsets } from './responsive-acceptance-data'

export const WAKE_ENTITY = 'sensor.master_bedroom_wake_light'
export const WAKE_TITLE = 'Master Bedroom Wake-Light Alarms'
export const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }
export interface WakeProfile {
  name: string
  width: number
  height: number
  insets: SafeAreaInsets
  presentation: 'sheet' | 'landscape-dialog' | 'dialog'
}
export function wakeProfile(name: string): WakeProfile {
  const { viewport, insets } = layoutProfile(name)
  const { width, height } = viewport
  const presentation = width >= 760 && height >= 560
    ? 'dialog'
    : width >= 560 && width > height && height < 560 ? 'landscape-dialog' : 'sheet'
  return { name, width, height, insets, presentation }
}
export const WAKE_PROFILES = [...new Set([
  ...journey('wake-light', 'touch-chromium'),
  ...journey('wake-light', 'fine-chromium'),
  ...journey('wake-light', 'touch-webkit'),
])].map(wakeProfile)
export type Box = { x: number; y: number; width: number; height: number }
export interface WakeMockApi {
  calls: Record<string, unknown>[]
  getEntity: (id: string) => { state: string; attributes: Record<string, unknown> } | null
  setEntityState: (id: string, state: string) => void
  setEntityAttribute: (id: string, key: string, value: unknown) => void
  setCallServiceOutcome: (domain: string, service: string, outcome: 'resolve' | 'reject' | 'pending') => void
  setWakeResponse: (outcome: string | null) => void
  resolveWakeCommands: () => void
  rejectWakeCommands: () => void
}

export async function openWake(page: Page) {
  await page.goto('/at-a-glance/master-bedroom')
  await expect.poll(() => page.evaluate(() => Boolean(
    (window as unknown as { __mockHass?: WakeMockApi }).__mockHass?.getEntity,
  ))).toBe(true)
  await page.getByRole('button', {
    name: /Wake-Light Alarms Next Alarm: \d{1,2}\/\d{1,2} \d{1,2}:\d{2} [AP]M • \d+ min ramp/,
  }).click()
  const dialog = page.getByRole('dialog', { name: WAKE_TITLE, exact: true })
  await settleWake(dialog)
  await expect(dialog.getByText(/^Next Alarm: \d{1,2}\/\d{1,2} \d{1,2}:\d{2} [AP]M • \d+ min ramp$/)).toBeVisible()
  return dialog
}

export async function settleWake(dialog: Locator) {
  await waitForModalReady(dialog)
}

export async function resizeWake(page: Page, profile: WakeProfile) {
  await applyProfile(page, profile.name)
}

export function expectSameBox(actual: Box, expected: Box) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(Math.abs(actual[key] - expected[key]), `${key}: ${JSON.stringify({ actual, expected })}`).toBeLessThanOrEqual(1)
  }
}

export async function expectWakeTargetAboveFooter(dialog: Locator, target: Locator) {
  await expect.poll(async () => {
    const [targetBox, footerBox] = await Promise.all([
      target.boundingBox(),
      dialog.locator('[data-modal-sheet-footer="true"]').boundingBox(),
    ])
    if (!targetBox || !footerBox) return Number.POSITIVE_INFINITY
    return targetBox.y + targetBox.height - footerBox.y
  }).toBeLessThanOrEqual(1)
}

export async function auditWake(page: Page, dialog: Locator, profile: WakeProfile) {
  await settleWake(dialog)
  await expect(dialog).toHaveAttribute('data-modal-geometry-intent', 'wake-light')
  await expect(dialog).toHaveAttribute('data-modal-block-policy', 'fixed')
  await expect(dialog).toHaveAttribute('data-modal-presentation', profile.presentation)
  await expect(dialog).toHaveAttribute('data-surface', 'hass-popup')
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  if (!box) throw new Error('Missing modal box')
  if (profile.presentation === 'landscape-dialog') {
    expectSameBox(box, {
      x: profile.insets.left + 12, y: profile.insets.top + 8,
      width: profile.width - profile.insets.left - profile.insets.right - 24,
      height: profile.height - profile.insets.top - profile.insets.bottom - 16,
    })
    const owners = await dialog.evaluate(element => [...element.querySelectorAll<HTMLElement>('*')]
      .filter(node => ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1)
      .map(node => node.hasAttribute('data-modal-sheet-body') ? 'body' : node.dataset.scrollRegion ?? node.tagName))
    expect(owners).toEqual(owners.length ? ['body'] : [])
  } else if (profile.presentation === 'dialog') {
    const left = Math.max(32, profile.insets.left), right = Math.max(32, profile.insets.right)
    const top = Math.max(32, profile.insets.top), bottom = Math.max(32, profile.insets.bottom)
    const width = Math.min(1100, profile.width - left - right)
    const height = Math.min(760, profile.height - top - bottom)
    expectSameBox(box, { x: left + (profile.width - left - right - width) / 2, y: top + (profile.height - top - bottom - height) / 2, width, height })
  } else {
    const height = Math.min(profile.height * 0.9, profile.height - profile.insets.top)
    expectSameBox(box, { x: 0, y: profile.height - height, width: profile.width, height })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  const close = await dialog.getByRole('button', { name: 'Close', exact: true }).boundingBox()
  expect(close).not.toBeNull()
  expect(close!.x).toBeGreaterThanOrEqual(profile.insets.left)
  expect(close!.x + close!.width).toBeLessThanOrEqual(profile.width - profile.insets.right + 1)
  expect(close!.y + close!.height).toBeLessThanOrEqual(profile.height - profile.insets.bottom + 1)
  return box
}

export async function terminalVisible(dialog: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded()
  const body = dialog.locator('[data-modal-sheet-body="true"]')
  const outer = await body.boundingBox(), item = await target.boundingBox()
  expect(outer).not.toBeNull()
  expect(item).not.toBeNull()
  expect(item!.y).toBeGreaterThanOrEqual(outer!.y - 1)
  expect(item!.y + item!.height).toBeLessThanOrEqual(outer!.y + outer!.height + 1)
}

export async function seedWake(page: Page, attributes: Record<string, unknown>, phase: string) {
  await page.evaluate(({ attributes, phase, id }) => {
    const api = (window as unknown as { __mockHass: WakeMockApi }).__mockHass
    if (!api) throw new Error('Mock-only gate')
    for (const [key, value] of Object.entries(attributes)) api.setEntityAttribute(id, key, value)
    api.setEntityState(id, phase)
  }, { attributes, phase, id: WAKE_ENTITY })
}
