// @covers src/pages/Page.module.css
// @covers src/pages/Page.tsx
// @covers src/components/core/SectionHeader.tsx
// @covers src/components/core/SectionHeader.module.css
// @covers src/components/hass/StatusRail.module.css
// @covers src/pages/DashboardViewPage.module.css
// @covers src/pages/FoodHubPage.module.css
// @covers src/pages/FoodHubPage.tsx
import { expect, test, type Page } from './layout/fixture'

const VIEWPORTS = [
  { height: 852, width: 393 },
  { height: 393, width: 852 },
  { height: 1180, width: 820 },
  { height: 900, width: 1440 },
] as const

const LEADING_SECTION_ROUTES = [
  { chips: true, path: '/at-a-glance/security' },
  { chips: true, path: '/kitchen' },
  { chips: false, path: '/vacuums' },
  { chips: false, path: '/food' },
] as const

const CONTENT_START_ROUTES = [
  { chips: true, path: '/' },
  { chips: false, path: '/settings' },
] as const

async function measureHeaderSpacing(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0
    }
    const header = document.querySelector<HTMLElement>('[data-page-header]')
    const content = document.querySelector<HTMLElement>('[data-page-content="true"]')
    if (!header || !content) return null

    const headerContent = Array.from(header.querySelectorAll('button, a, h1')).filter(visible)
    const headerBottom = Math.max(...headerContent.map((element) => element.getBoundingClientRect().bottom))
    const contentElements = Array.from(content.querySelectorAll('*')).filter(visible)
    const contentTop = Math.min(...contentElements.map((element) => element.getBoundingClientRect().top))

    const sectionHeader = content.querySelector<HTMLElement>('[data-section-header]')
    let leading = false
    for (let node: HTMLElement | null = sectionHeader; node; node = node.parentElement) {
      if (node === content) {
        leading = true
        break
      }
      if (node.previousElementSibling) break
    }
    if (!sectionHeader || !leading) {
      return { contentTop, headerBottom, leading: false as const }
    }

    const sectionBounds = sectionHeader.getBoundingClientRect()
    const nextTop = Math.min(...contentElements
      .filter((element) => !sectionHeader.contains(element))
      .map((element) => element.getBoundingClientRect().top)
      .filter((top) => top >= sectionBounds.bottom - 0.5))
    return {
      above: sectionBounds.top - headerBottom,
      below: nextTop - sectionBounds.bottom,
      contentTop,
      headerBottom,
      leading: true as const,
    }
  })
}

const STATUS_CHIP_ROUTES = ['/', '/at-a-glance/security', '/kitchen'] as const

async function measureHeaderToChips(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const bounds = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0
    }
    const header = document.querySelector<HTMLElement>('[data-page-header]')
    const quickLinks = header?.querySelector<HTMLElement>('[data-page-header-quick-links="true"]')
    if (!header || !quickLinks) return null
    const headerRow = Array.from(header.querySelectorAll('button, a, h1'))
      .filter((element) => visible(element) && !quickLinks.contains(element))
    const chips = Array.from(quickLinks.querySelectorAll('button, a')).filter(visible)
    if (!headerRow.length || !chips.length) return null
    const headerBottom = Math.max(...headerRow.map((element) => element.getBoundingClientRect().bottom))
    const chipsTop = Math.min(...chips.map((element) => element.getBoundingClientRect().top))
    return chipsTop - headerBottom
  })
}

async function openRoute(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('[data-page-content="true"]').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-route-transition-state]').last()).toHaveAttribute('data-route-transition-state', 'idle', { timeout: 15_000 })
}

async function expectQuickLinks(page: Page, chips: boolean) {
  const scroller = page.locator('[data-page-scroller="true"]:visible').last()
  if (chips) await expect(scroller).toHaveAttribute('data-header-quick-links', 'true')
  else await expect(scroller).not.toHaveAttribute('data-header-quick-links', 'true')
}

for (const viewport of VIEWPORTS) {
  test.describe(`page header spacing at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    for (const route of LEADING_SECTION_ROUTES) {
      test(`${route.path} leading separator is equidistant ${route.chips ? 'below status chips' : 'without status chips'}`, async ({ page }) => {
        await openRoute(page, route.path)
        await expectQuickLinks(page, route.chips)
        await expect.poll(async () => {
          const spacing = await measureHeaderSpacing(page)
          if (!spacing) return 'page not mounted'
          if (!spacing.leading) return 'no leading separator'
          return Math.abs(spacing.above - spacing.below) <= 1 && Math.abs(spacing.above - 22) <= 1
            ? 'equal'
            : `above ${spacing.above.toFixed(1)} / below ${spacing.below.toFixed(1)}`
        }, { timeout: 10_000 }).toBe('equal')
      })
    }

    for (const path of STATUS_CHIP_ROUTES) {
      test(`${path} status chips start one shared gap below the header row`, async ({ page }) => {
        await openRoute(page, path)
        await expectQuickLinks(page, true)
        const startGap = viewport.width > viewport.height && viewport.height <= 500 ? 8 : 12
        await expect.poll(async () => {
          const gap = await measureHeaderToChips(page)
          if (gap === null) return 'status chips not mounted'
          return Math.abs(gap - startGap) <= 1 ? 'aligned' : `gap ${gap.toFixed(1)}`
        }, { timeout: 10_000 }).toBe('aligned')
      })
    }

    for (const route of CONTENT_START_ROUTES) {
      test(`${route.path} content starts one shared gap below the header`, async ({ page }) => {
        await openRoute(page, route.path)
        await expectQuickLinks(page, route.chips)
        const startGap = viewport.width > viewport.height && viewport.height <= 500 ? 8 : 12
        await expect.poll(async () => {
          const spacing = await measureHeaderSpacing(page)
          if (!spacing) return 'page not mounted'
          const gap = spacing.contentTop - spacing.headerBottom
          return Math.abs(gap - startGap) <= 1 ? 'aligned' : `gap ${gap.toFixed(1)}`
        }, { timeout: 10_000 }).toBe('aligned')
      })
    }
  })
}

test.describe('short pages with a leading separator', () => {
  test.use({ viewport: { height: 852, width: 393 } })

  test('/groceries content still fills the scroller without overflow', async ({ page }) => {
    await openRoute(page, '/groceries')
    await expect.poll(() => page.locator('[data-page-scroller="true"]:visible').last().evaluate((scroller) => {
      const content = scroller.querySelector<HTMLElement>('[data-page-content="true"]')
      if (!content) return 'page not mounted'
      const style = getComputedStyle(scroller)
      const contentBottom = content.getBoundingClientRect().bottom
      const scrollerContentBottom = scroller.getBoundingClientRect().top + scroller.clientHeight - Number.parseFloat(style.paddingBottom)
      const overflow = scroller.scrollHeight - scroller.clientHeight
      return Math.abs(contentBottom - scrollerContentBottom) <= 1 && overflow <= 1
        ? 'filled'
        : `content bottom ${contentBottom.toFixed(1)} / expected ${scrollerContentBottom.toFixed(1)} / overflow ${overflow}`
    }), { timeout: 10_000 }).toBe('filled')
  })

  test('/at-a-glance/food keeps All Recipes above the floating dock', async ({ page }) => {
    await page.goto('/at-a-glance/food')
    await expect(page.getByRole('status', { name: 'Loading Food & Recipes' })).not.toBeVisible({ timeout: 12_000 })
    const allRecipes = page.getByRole('button', { exact: true, name: 'All Recipes' })
    const scanItem = page.getByRole('button', { name: 'Scan Item' })
    const pager = page.getByRole('group', { name: 'Suggested recipes pages' })
    await expect(allRecipes).toBeVisible()
    await expect(scanItem).toBeVisible()
    const tile = await allRecipes.boundingBox()
    const dock = await scanItem.boundingBox()
    const activeDot = await pager.getByRole('button', { name: 'Go to page 1' }).evaluate((button) => {
      const dot = button.firstElementChild ?? button
      return dot.getBoundingClientRect().bottom
    })
    expect((tile?.y ?? 0) + (tile?.height ?? 0)).toBeLessThanOrEqual(dock?.y ?? 0)
    expect((tile?.y ?? 0) - activeDot).toBeGreaterThanOrEqual(22)
  })
})
