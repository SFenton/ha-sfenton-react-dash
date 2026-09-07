import type { Locator } from '@playwright/test'

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
