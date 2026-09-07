import { expect, test } from './layout/fixture'

test('long battery task titles remain visible with a fine pointer', async ({ page }) => {
  const title = 'Replace Hallway/Entryway/Living Room Presence Sensor Battery · 20%'
  await page.goto('/index.html?path=overview&battery-title-desktop=1')
  await page.evaluate((taskTitle) => {
    const mock = (window as unknown as {
      __mockHass: {
        reset: () => void
        setEntityState: (entityId: string, state: string) => void
        setTodoItems: (entityId: string, items: {
          description?: string
          due?: string
          status: string
          summary: string
          uid: string
        }[]) => void
      }
    }).__mockHass
    mock.reset()
    const entityId = 'todo.stephen_s_past_due_with_unassigned'
    mock.setTodoItems(entityId, [{
      description: 'Maintenance reference: BATT-LONG1234.',
      due: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'needs_action',
      summary: taskTitle,
      uid: '540--2026-08-31 00:00:00+00:00',
    }])
    mock.setEntityState(entityId, '1')
    const url = new URL(window.location.href)
    url.searchParams.set('path', 'chores')
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, title)

  const root = page.locator('[data-route-path="chores"]:visible').last()
  const titleElement = root.getByText(title, { exact: true })
  await expect(titleElement).toBeVisible()
  const metrics = await titleElement.evaluate((element) => {
    const style = window.getComputedStyle(element)
    return {
      overflowWrap: style.overflowWrap,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pointerFine: window.matchMedia('(pointer: fine)').matches,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      whiteSpace: style.whiteSpace,
    }
  })

  expect(metrics.pointerFine).toBe(true)
  expect(metrics.whiteSpace).toBe('normal')
  expect(metrics.overflowWrap).toBe('anywhere')
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1)
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1)
  expect(metrics.pageOverflow).toBeLessThanOrEqual(1)
})
