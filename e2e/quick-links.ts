import { expect, type Frame, type FrameLocator, type Locator, type Page } from '@playwright/test'

type QuickLinksScope = Page | Frame | FrameLocator

export function globalQuickLinksAction(scope: QuickLinksScope) {
  return scope.getByRole('button', { name: /^(?:Open Chat and Quick Links|Quick Links)$/ })
}

export async function selectQuickLinksTab(scope: QuickLinksScope, activation: 'pointer' | 'keyboard' = 'pointer') {
  const tabs = scope.getByRole('tab', { name: 'Quick Links', exact: true })
  const currentHost = await scope.locator('button[aria-label="Open Chat and Quick Links"]').count() > 0
  if (currentHost) {
    await expect(tabs).toBeVisible()
    if (activation === 'keyboard') {
      await tabs.focus()
      await tabs.press('Enter')
    } else await tabs.click()
    await expect(tabs).toHaveAttribute('aria-selected', 'true')
  }
  const dialog = scope.getByRole('dialog', { name: 'Quick Links', exact: true })
  await expect(dialog.getByRole('group', { name: 'Quick Links', exact: true })).toBeVisible()
  return dialog
}

export async function openQuickLinksTab(scope: QuickLinksScope) {
  const opener = globalQuickLinksAction(scope)
  const currentHost = await opener.getAttribute('aria-label') === 'Open Chat and Quick Links'
  await opener.click()
  if (currentHost) await expect(scope.getByRole('tab', { name: 'Home Assistant', exact: true })).toBeVisible()
  return selectQuickLinksTab(scope)
}

export async function quickLinksLayout(dialog: Locator) {
  return dialog.getByRole('group', { name: 'Quick Links', exact: true }).evaluate((grid) => {
    const body = grid.closest<HTMLElement>('[data-modal-sheet-body="true"]')
    if (!body) throw new Error('Quick Links has no modal body')
    const bodyRect = body.getBoundingClientRect()
    const bodyStyle = getComputedStyle(body)
    const gridRect = grid.getBoundingClientRect()
    const measure = grid.closest('[data-modal-content-measure="true"]')
    return {
      columns: Number(grid.getAttribute('data-dynamic-grid-columns')),
      gridWidth: gridRect.width,
      gridHeight: gridRect.height,
      gridTop: gridRect.top,
      bodyTop: bodyRect.top + Number.parseFloat(bodyStyle.paddingTop),
      bodyOverflow: bodyStyle.overflowY,
      measureWidth: measure?.getBoundingClientRect().width ?? 0,
      cards: Array.from(grid.querySelectorAll<HTMLElement>('[data-dynamic-grid-cell="true"] button')).map((button) => {
        const rect = button.getBoundingClientRect()
        const style = getComputedStyle(button)
        const labels = Array.from(button.querySelectorAll<HTMLElement>('[data-dynamic-grid-label="true"]'))
        return {
          name: button.getAttribute('aria-label'),
          width: rect.width,
          height: rect.height,
          x: rect.left - gridRect.left,
          y: rect.top - gridRect.top,
          span: Number(button.closest('[data-dynamic-grid-cell="true"]')?.getAttribute('data-dynamic-grid-span')),
          iconWidth: button.querySelector('svg')?.getBoundingClientRect().width ?? 0,
          padding: style.padding,
          radius: style.borderRadius,
          titleFont: labels[0] ? getComputedStyle(labels[0]).fontSize : '',
          copyFits: labels.every((label) => label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1),
          insideBody: rect.left >= bodyRect.left - 1 && rect.right <= bodyRect.right + 1,
        }
      }),
    }
  })
}
