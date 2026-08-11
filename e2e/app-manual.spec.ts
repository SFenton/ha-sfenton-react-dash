import { expect, test, type Browser } from '@playwright/test'
import { ROOM_PAGE_CONFIGS } from '../src/constants/roomPages'
import { DASHBOARD_ROUTES } from '../src/constants/routes'
import { MANUAL_SECTIONS } from '../src/manual/catalog'
import { ROOM_CARD_FAMILY_GUIDE_ARTICLES } from '../src/manual/familyGuides'
import { ROOM_PAGE_GUIDE_ARTICLES } from '../src/manual/roomPageGuides'
import { MANUAL_SCREENSHOTS } from '../src/manual/screenshots'
import { MANUAL_TASK_GUIDE_ARTICLES } from '../src/manual/taskGuides'

const LANDING_CASES = MANUAL_SECTIONS.map((section) => {
  const landing = section.landing
  if (!landing) throw new Error(`Missing landing for ${section.id}`)
  const context = MANUAL_SCREENSHOTS.find((screenshot) => screenshot.landingUse?.sectionId === section.id && screenshot.role === 'context')
  if (!context) throw new Error(`Missing context screenshot for ${section.id}`)
  return {
    canonicalArticleId: landing.canonicalArticleId,
    commonTaskCount: landing.commonTasks.length,
    contextAlt: context.alt,
    id: section.id,
    maxFirstTaskOffset: section.id === 'climate' ? 1380 : 1140,
    technical: Boolean(landing.technicalArticleIds?.length),
    title: section.title,
  }
})

const CHORE_ROUTE_GUIDE_CASES = [
  { articleId: 'chores-page-guide', routePath: 'chores', title: 'Main Chores page guide', visibleSection: 'Quick Links' },
  { articleId: 'to-do-page-guide', routePath: 'to-do', title: 'Admin To-Do page guide', visibleSection: 'Admin To-Do' },
  { articleId: 'groceries-page-guide', routePath: 'groceries', title: 'Groceries page guide', visibleSection: 'Grocery List' },
  { articleId: 'stephens-chores-page-guide', routePath: 'stephens-chores', title: 'Stephen’s Chores page guide', visibleSection: 'Due Today' },
  { articleId: 'stephs-chores-page-guide', routePath: 'stephs-chores', title: 'Steph’s Chores page guide', visibleSection: 'No Due Date' },
  { articleId: 'unassigned-chores-page-guide', routePath: 'unassigned-chores', title: 'Unassigned Chores page guide', visibleSection: 'Past Due' },
  { articleId: 'home-improvement-chores-page-guide', routePath: 'home-improvement-chores', title: 'Home Improvement Tasks page guide', visibleSection: 'Upcoming' },
] as const

const FOOD_ROUTE_GUIDE_CASES = [
  { articleId: 'grocery-list-page-guide', routePath: 'grocery-list', title: 'Home Grocery List page guide', visibleSection: 'Grocery List' },
  { articleId: 'food-page-guide', routePath: 'food', title: 'Food & Recipes hub page guide', visibleSection: 'Suggested Recipes' },
  { articleId: 'recipes-page-guide', routePath: 'recipes', title: 'Recipes page guide', visibleSection: 'Recipes' },
  { articleId: 'all-food-page-guide', routePath: 'all-food', title: 'All Food page guide', visibleSection: 'All Food' },
  { articleId: 'pantry-page-guide', routePath: 'pantry', title: 'Pantry page guide', visibleSection: 'Pantry' },
  { articleId: 'fridge-page-guide', routePath: 'fridge', title: 'Fridge page guide', visibleSection: 'Fridge' },
  { articleId: 'freezer-page-guide', routePath: 'freezer', title: 'Freezer page guide', visibleSection: 'Freezer' },
  { articleId: 'spice-rack-page-guide', routePath: 'spice-rack', title: 'Spice Rack page guide', visibleSection: 'Spice Rack' },
  { articleId: 'cabinet-page-guide', routePath: 'cabinet', title: 'Cabinet page guide', visibleSection: 'Cabinet' },
] as const

const FEATURE_ROUTE_GUIDE_CASES = [
  { articleId: 'mach-e-page-guide', routePath: 'mach-e', title: 'Mach-E page guide', visibleSection: 'Climate' },
  { articleId: 'vacuums-page-guide', routePath: 'vacuums', title: 'Vacuums page guide', visibleSection: 'Robot Vacuums' },
  { articleId: 'media-page-guide', routePath: 'media', title: 'Media page guide', visibleSection: 'Theater Room' },
] as const

const SETTINGS_ROUTE_GUIDE_CASES = [
  { articleId: 'settings-page-guide', contextId: 'section-settings-context', routePath: 'settings', title: 'Settings page guide', visibleSection: 'Home Assistant Settings' },
  { articleId: 'admin-page-guide', contextId: 'admin-page-context', routePath: 'admin', title: 'Admin Controls page guide', visibleSection: 'Living Room Power Recovery' },
  { articleId: 'guest-controls-page-guide', contextId: 'guest-controls-page-context', routePath: 'guests-staying-over', title: 'Guest Controls page guide', visibleSection: 'Guest Controls' },
  { articleId: 'vacation-page-guide', contextId: 'vacation-page-context', routePath: 'vacation', title: 'Vacation page guide', visibleSection: 'Vacation Dates' },
] as const

const ROOM_ROUTE_GUIDE_CASES = ROOM_PAGE_GUIDE_ARTICLES.map((article) => ({
  articleId: article.id,
  routePath: article.pageGuide.routePath,
  title: article.title,
  visibleSection: article.pageGuide.visiblePageSectionNames.at(-1) ?? 'Header Summaries',
}))

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

test('Settings opens the complete App Manual and natural-language search finds guides', async ({ page }) => {
  await page.goto('/index.html?path=settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible({ timeout: 15000 })

  const settings = page.getByRole('navigation', { name: 'Settings pages' })
  const manual = settings.getByRole('button', { name: 'App Manual Access guides, instructions, and details on how our Home Assistant instance and app work.' })
  await expect(settings.locator('> button').first()).toHaveAccessibleName('App Manual Access guides, instructions, and details on how our Home Assistant instance and app work.')
  await manual.click()

  await expect(page.getByRole('heading', { level: 1, name: 'App Manual' })).toBeVisible()
  const sections = page.getByRole('group', { name: 'App Manual sections' })
  await expect(sections.getByRole('button')).toHaveCount(9)
  await expect(page.getByRole('button', { name: /^Start Here/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Home\. Learn the Home screen/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Food & Recipes/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Help & Technical Reference/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /What are the status chips/i })).toBeVisible()

  await page.getByLabel('Search the App Manual').fill('schedule humidifier')
  await expect(page.getByRole('button', { name: /Humidifier activities and schedules/i })).toBeVisible()
  await page.getByRole('button', { name: /Humidifier activities and schedules/i }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Humidifier activities and schedules' })).toBeVisible()
  const guide = page.locator('[data-manual-surface-guide="humidifier-schedule"]')
  await expect(guide.getByText('How to open')).toBeVisible()
  await expect(guide.getByText('Moving around inside')).toBeVisible()
  await expect(guide.locator('[data-manual-surface-navigation-item]')).toHaveCount(4)
  await expect(page.getByRole('img', { name: /Humidifier schedule editor/i })).toBeVisible()
})

test('automatic behavior guides open from domain landings and render the household contract', async ({ page }) => {
  const cases = [
    {
      articleId: 'behavior-presence-overnight-reset',
      group: 'Automatic house-mode behavior',
      sectionId: 'settings',
      title: 'Overnight presence-lighting reset',
    },
    {
      articleId: 'behavior-camera-alerts',
      group: 'Automatic security behavior',
      sectionId: 'security',
      title: 'Camera detections, doorbell alerts, and manual recording',
    },
    {
      articleId: 'behavior-vacuum-auto-clean',
      group: 'Automatic cleaning behavior',
      sectionId: 'rooms',
      title: 'Vacuum auto-clean, cleaning control, exclusions, and alerts',
    },
  ] as const

  for (const behavior of cases) {
    await page.goto(`/index.html?path=manual&manual-section=${behavior.sectionId}`)
    const group = page.locator(`[data-manual-guide-group="${behavior.group}"]`)
    await group.getByRole('button', { name: new RegExp(escapedPattern(behavior.title), 'i') }).click()

    await expect(page).toHaveURL(new RegExp(`manual-article=${behavior.articleId}`))
    await expect(page.getByRole('heading', { level: 2, name: behavior.title })).toBeVisible()
    const guide = page.locator(`[data-manual-behavior-guide="${behavior.articleId}"]`)
    for (const heading of ['What this does', 'How it works', 'Pause, override, or recover', 'Troubleshooting']) {
      await expect(guide.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    const behindScenes = guide.getByText('Behind the scenes', { exact: true })
    await expect(behindScenes).toBeVisible()
    await behindScenes.click()
    for (const heading of ['When it happens', 'What must be true', 'What changes', "What you'll notice", 'When house modes change the result', 'Alerts you may see', "Where you'll notice it"]) {
      await expect(guide.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Related Guides', exact: true })).toBeVisible()
  }
})

async function screenshotSource(browser: Browser, viewport: { height: number; width: number }, device: { hasTouch: boolean; isMobile: boolean }) {
  const context = await browser.newContext({ ...device, viewport })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5174/index.html?path=manual&manual-section=home&manual-article=home-overview')
  const image = page.getByRole('img', { name: /Home page showing the header/i })
  await expect(image).toBeVisible({ timeout: 15000 })
  const currentSrc = await image.evaluate((element) => (element as HTMLImageElement).currentSrc)
  const renderedWidth = (await image.boundingBox())?.width ?? 0
  await context.close()
  return { currentSrc, renderedWidth }
}

test('manual screenshots use mobile for phones and desktop for tablets and computers', async ({ browser }) => {
  expect((await screenshotSource(browser, { width: 393, height: 852 }, { hasTouch: true, isMobile: true })).currentSrc).toContain('/manual/manual-mobile/app-layout-home.png')
  expect((await screenshotSource(browser, { width: 844, height: 390 }, { hasTouch: true, isMobile: true })).currentSrc).toContain('/manual/manual-mobile/app-layout-home.png')
  const portraitTablet = await screenshotSource(browser, { width: 768, height: 1024 }, { hasTouch: true, isMobile: true })
  expect(portraitTablet.currentSrc).toContain('/manual/manual-desktop/app-layout-home.png')
  expect(portraitTablet.renderedWidth).toBeGreaterThanOrEqual(650)
  const landscapeTablet = await screenshotSource(browser, { width: 1024, height: 768 }, { hasTouch: true, isMobile: true })
  expect(landscapeTablet.currentSrc).toContain('/manual/manual-desktop/app-layout-home.png')
  expect(landscapeTablet.renderedWidth).toBeGreaterThanOrEqual(650)
  expect((await screenshotSource(browser, { width: 500, height: 900 }, { hasTouch: false, isMobile: false })).currentSrc).toContain('/manual/manual-desktop/app-layout-home.png')
  expect((await screenshotSource(browser, { width: 1280, height: 900 }, { hasTouch: false, isMobile: false })).currentSrc).toContain('/manual/manual-desktop/app-layout-home.png')
})

test('manual navigation resets scroll and focuses the new view heading', async ({ page }) => {
  await page.goto('/index.html?path=manual')
  await expect(page.getByRole('heading', { level: 1, name: 'App Manual' })).toBeVisible({ timeout: 15000 })
  await page.getByLabel('Search the App Manual').fill('room')

  const target = page.getByRole('button', { name: /Robot vacuums, zones, and auto-clean/i })
  const scroller = page.locator('main [class*="_scroller_"]').last()
  await target.scrollIntoViewIfNeeded()
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await target.click()

  const heading = page.getByRole('heading', { level: 2, name: 'Robot vacuums, zones, and auto-clean' })
  await expect(heading).toBeFocused()
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(0)
  await expect.poll(async () => Math.round((await heading.boundingBox())?.y ?? -1)).toBeGreaterThan(0)
})

test('Home manual drilldown links status chips to the Lights overview and room detail guide', async ({ page }) => {
  await page.goto('/index.html?path=manual')
  await expect(page.getByRole('heading', { level: 1, name: 'App Manual' })).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: /^Home\. Learn the Home screen/i }).click()
  await page.getByRole('button', { name: /How do I read or scroll the status chips/i }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Status chips' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Beginning of the horizontally scrollable Home status-chip row/i })).toBeVisible()
  await expect(page.getByRole('img', { name: /End of the Home status-chip row/i })).toBeVisible()

  await page.getByRole('button', { name: /^Lights status and room controls Use the Lights chip/i }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Lights status and room controls' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Lights overview sheet/i })).toBeVisible()
  await expect(page.getByRole('img', { name: /Living Room light detail page/i })).toBeVisible()
})

test('five foundational route guides open from their landings and render the structured contract', async ({ page }) => {
  const cases = [
    { articleId: 'app-manual-page-guide', question: /^How do I use the App Manual\?/, sectionId: 'start', title: 'App Manual page guide', visibleSection: 'Popular Questions' },
    { articleId: 'home-overview', question: /^What is on the Home screen\?/, sectionId: 'home', title: 'Home page guide', visibleSection: 'Quick Links' },
    { articleId: 'custom-lights-page-guide', question: /^How do I use Custom Lights\?/, sectionId: 'home', title: 'Custom Lights page guide', visibleSection: 'Reset All Lights' },
    { articleId: 'security-page-guide', question: /^What is on the Security page\?/, sectionId: 'security', title: 'Security page guide', visibleSection: 'Guest Presence Security' },
    { articleId: 'thermostat-page-guide', question: /Thermostat page guide/i, sectionId: 'climate', title: 'Thermostat page guide', visibleSection: 'Advanced Configuration' },
  ]

  for (const routeGuide of cases) {
    await page.goto(`/index.html?path=manual&manual-section=${routeGuide.sectionId}`)
    await page.getByRole('button', { name: routeGuide.question }).first().click()
    const guide = page.locator('[data-manual-page-guide]')
    await expect(page.getByRole('heading', { level: 2, name: routeGuide.title })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`manual-article=${routeGuide.articleId}`))
    await expect(guide.getByRole('heading', { name: 'What this page is for', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: "What you'll find", exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What you can do', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What happens automatically', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Look here first', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.getByText(routeGuide.visibleSection, { exact: true }).first()).toBeVisible()
    expect(await guide.locator('[data-manual-screenshot]').count()).toBeGreaterThan(0)
  }
})

test('all seven Chores-domain route guides render the structured page-guide contract', async ({ page }) => {
  for (const routeGuide of CHORE_ROUTE_GUIDE_CASES) {
    await page.goto(`/index.html?path=manual&manual-section=chores&manual-article=${routeGuide.articleId}`)
    const guide = page.locator(`[data-manual-page-guide="${routeGuide.routePath}"]`)

    await expect(page.getByRole('heading', { level: 2, name: routeGuide.title })).toBeVisible({ timeout: 15000 })
    await expect(guide.getByRole('heading', { name: 'What this page is for', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: "What you'll find", exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What you can do', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What happens automatically', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Look here first', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.getByText(routeGuide.visibleSection, { exact: true }).first()).toBeVisible()
    expect(await guide.locator('[data-manual-page-guide-first-look="true"]').count()).toBeGreaterThanOrEqual(3)
    expect(await guide.locator('[data-manual-screenshot]').count()).toBeGreaterThan(0)
  }
})

test('all nine Food-domain route guides render the structured page-guide contract', async ({ page }, testInfo) => {
  testInfo.setTimeout(120000)
  for (const routeGuide of FOOD_ROUTE_GUIDE_CASES) {
    await page.goto(`/index.html?path=manual&manual-section=food&manual-article=${routeGuide.articleId}`)
    const guide = page.locator(`[data-manual-page-guide="${routeGuide.routePath}"]`)

    await expect(page.getByRole('heading', { level: 2, name: routeGuide.title })).toBeVisible({ timeout: 30000 })
    await expect(guide.getByRole('heading', { name: 'What this page is for', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: "What you'll find", exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What you can do', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What happens automatically', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Look here first', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.getByText(routeGuide.visibleSection, { exact: true }).first()).toBeVisible()
    expect(await guide.locator('[data-manual-page-guide-first-look="true"]').count()).toBeGreaterThanOrEqual(3)
    expect(await guide.locator('[data-manual-screenshot]').count()).toBeGreaterThan(0)
  }
})

test('Mach-E, Vacuums, and Media route guides render their route-specific contracts and context images', async ({ page }) => {
  for (const routeGuide of FEATURE_ROUTE_GUIDE_CASES) {
    await page.goto(`/index.html?path=manual&manual-section=rooms&manual-article=${routeGuide.articleId}`, { waitUntil: 'networkidle' })
    const guide = page.locator(`[data-manual-page-guide="${routeGuide.routePath}"]`)

    await expect(page.getByRole('heading', { level: 2, name: routeGuide.title })).toBeVisible({ timeout: 30000 })
    await expect(guide.getByRole('heading', { name: 'What this page is for', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: "What you'll find", exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What you can do', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What happens automatically', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Look here first', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.getByText(routeGuide.visibleSection, { exact: true }).first()).toBeVisible()
    const context = guide.locator('[data-screenshot-role="context"]').first()
    await expect(context).toBeVisible()
    await expect(context.locator('img')).toHaveAttribute('src', new RegExp(`${routeGuide.routePath === 'mach-e' ? 'mach-e' : routeGuide.routePath}-page-context\\.png$`))
  }
})

test('Settings, Admin, Guest Controls, and Vacation render distinct structured route guides', async ({ page }) => {
  for (const routeGuide of SETTINGS_ROUTE_GUIDE_CASES) {
    await page.goto(`/index.html?path=manual&manual-section=settings&manual-article=${routeGuide.articleId}`)
    const guide = page.locator(`[data-manual-page-guide="${routeGuide.routePath}"]`)

    await expect(page.getByRole('heading', { level: 2, name: routeGuide.title })).toBeVisible({ timeout: 15000 })
    await expect(guide.getByRole('heading', { name: 'What this page is for', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: "What you'll find", exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What you can do', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What happens automatically', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Look here first', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.getByText(routeGuide.visibleSection, { exact: true }).first()).toBeVisible()
    const context = guide.locator('[data-screenshot-role="context"]').first()
    await expect(context).toBeVisible()
    await expect(context.locator('img')).toHaveAttribute('src', new RegExp(`${routeGuide.contextId}\\.png$`))
  }
})

test('all sixteen room route guides render authored content before the configured controls appendix', async ({ page }, testInfo) => {
  testInfo.setTimeout(120000)
  for (const routeGuide of ROOM_ROUTE_GUIDE_CASES) {
    await page.goto(`/index.html?path=manual&manual-section=rooms&manual-article=${routeGuide.articleId}`)
    const guide = page.locator(`[data-manual-page-guide="${routeGuide.routePath}"]`)
    const appendix = guide.locator('[data-manual-page-guide-block="configured-controls-reference"]')
    const reference = appendix.locator(`[data-manual-room-reference="${routeGuide.routePath}"]`)
    const room = ROOM_PAGE_CONFIGS[routeGuide.routePath]
    const expectedCardCount = room.overviewCards.length + room.sourceSections.flatMap((section) => section.cards).length

    await expect(page.getByRole('heading', { level: 2, name: routeGuide.title })).toBeVisible({ timeout: 15000 })
    await expect(guide.getByRole('heading', { name: 'What this page is for', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What you can do', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What happens automatically', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Look here first', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.getByText(routeGuide.visibleSection, { exact: true }).first()).toBeVisible()
    await expect(appendix.getByRole('heading', { name: 'Configured Controls Reference', exact: true })).toBeVisible()
    await expect(reference.locator('[data-manual-room-reference-card="true"]')).toHaveCount(expectedCardCount)
    expect(await guide.locator('[data-manual-screenshot]').count()).toBeGreaterThan(0)
    expect(await guide.evaluate((element) => {
      const troubleshooting = element.querySelector('[data-manual-page-guide-block="troubleshooting"]')
      const controlsReference = element.querySelector('[data-manual-page-guide-block="configured-controls-reference"]')
      return Boolean(troubleshooting && controlsReference && (troubleshooting.compareDocumentPosition(controlsReference) & Node.DOCUMENT_POSITION_FOLLOWING))
    })).toBe(true)
  }
})

test('all fourteen room-card family guides render the structured family contract', async ({ page }, testInfo) => {
  testInfo.setTimeout(120000)
  for (const article of ROOM_CARD_FAMILY_GUIDE_ARTICLES) {
    await page.goto(`/index.html?path=manual&manual-section=rooms&manual-article=${article.id}`)
    const guide = page.locator(`[data-manual-family-guide="${article.familyGuide.cardKind}"]`)
    await expect(page.getByRole('heading', { level: 2, name: article.title })).toBeVisible({ timeout: 15000 })
    await expect(guide.getByRole('heading', { name: 'What this card does', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: "Where you'll see it", exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What tapping it does', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'What each label means', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'When it is unavailable', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'After you tap', exact: true })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Troubleshooting', exact: true })).toBeVisible()
    await expect(guide.locator('[data-manual-family-state="true"]')).toHaveCount(article.familyGuide.persistentStateMeanings.length)
    await expect(guide.locator('[data-manual-screenshot]')).toHaveCount(article.familyGuide.screenshotIds.length)
  }
})

test('all structured task guides render their workflow contract', async ({ page }, testInfo) => {
  testInfo.setTimeout(180000)
  for (const article of MANUAL_TASK_GUIDE_ARTICLES) {
    await page.goto(`/index.html?path=manual&manual-section=${article.sectionId}&manual-article=${article.id}`)
    const guide = page.locator(`[data-manual-task-guide="${article.id}"]`)

    await expect(page.getByRole('heading', { level: 2, name: article.title })).toBeVisible({ timeout: 15000 })
    for (const heading of [
      'Task at a glance',
      'Before you start',
      'Steps',
      'What success looks like',
      'Back, cancel, or close',
      'If it does not work',
      'What happens automatically',
    ]) await expect(guide.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(guide.locator('[data-manual-task-guide-block="steps"] li')).toHaveCount(article.taskGuide.steps.length)
    await expect(guide.locator('[data-manual-screenshot]')).toHaveCount(article.taskGuide.screenshotEvidence.screenshotIds.length)
    if (article.taskGuide.screenshotEvidence.nonvisualReason) {
      await expect(guide.locator('[data-manual-task-guide-nonvisual="true"]')).toBeVisible()
    }
    await expect(page.getByRole('heading', { name: 'Related Guides', exact: true })).toBeVisible()
  }
})

test('room appendices explain status-only, physical, conditional, and PC branch behavior', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=rooms&manual-article=room-garage')
  await expect(page.getByRole('button', { name: /Washing Machine\s+Status only — reports live state/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /Left Door\s+Immediate direct action — toggles this physical control/i })).toBeVisible()

  await page.goto('/index.html?path=manual&manual-section=rooms&manual-article=room-office')
  await expect(page.getByRole('button', { name: /Stephen.s PC\s+State-dependent direct action/i })).toBeVisible()

  await page.goto('/index.html?path=manual&manual-section=rooms&manual-article=room-back-deck')
  await expect(page.getByRole('button', { name: /Bear Grills\s+Conditional detail opener/i })).toBeVisible()
})

test('Chores landing exposes main lists and collapses the four ownership and project guides', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=chores')
  const mainLists = page.locator('[data-manual-guide-group="Main and shared lists"]')
  const siblingLists = page.locator('[data-manual-guide-group="People, ownership, and projects"]')
  const sharedBehavior = page.locator('[data-manual-guide-group="Shared task behavior"]')

  await expect(mainLists.getByRole('button')).toHaveCount(3)
  await expect(mainLists.getByRole('button', { name: /Main Chores page guide/i })).toBeVisible()
  await expect(mainLists.getByRole('button', { name: /Groceries page guide/i })).toBeVisible()
  await expect(mainLists.getByRole('button', { name: /Admin To-Do page guide/i })).toBeVisible()
  await expect(siblingLists).not.toHaveAttribute('open', '')
  await expect(siblingLists.getByRole('button', { includeHidden: true })).toHaveCount(4)
  await expect(sharedBehavior.getByRole('button')).toHaveCount(2)

  await siblingLists.locator('summary').click()
  await expect(siblingLists.getByRole('button', { name: /Stephen.s Chores page guide/i })).toBeVisible()
  await expect(siblingLists.getByRole('button', { name: /Steph.s Chores page guide/i })).toBeVisible()
  await expect(siblingLists.getByRole('button', { name: /Unassigned Chores page guide/i })).toBeVisible()
  await expect(siblingLists.getByRole('button', { name: /Home Improvement Tasks page guide/i })).toBeVisible()
})

test('Food landing exposes four main pages and collapses five storage guides', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=food')
  const foodPages = page.locator('[data-manual-guide-group="Food pages"]')
  const storageSpaces = page.locator('[data-manual-guide-group="Storage spaces"]')
  const sharedWorkflows = page.locator('[data-manual-guide-group="Shared workflows"]')

  await expect(foodPages.getByRole('button')).toHaveCount(4)
  await expect(foodPages.getByRole('button', { name: /Food & Recipes hub page guide/i })).toBeVisible()
  await expect(foodPages.getByRole('button', { name: /Home Grocery List page guide/i })).toBeVisible()
  await expect(foodPages.getByRole('button', { name: /All Food page guide/i })).toBeVisible()
  await expect(foodPages.getByRole('button', { name: /Recipes page guide/i })).toBeVisible()
  await expect(storageSpaces).not.toHaveAttribute('open', '')
  await expect(storageSpaces.getByRole('button', { includeHidden: true })).toHaveCount(5)
  await expect(sharedWorkflows.getByRole('button')).toHaveCount(3)

  await storageSpaces.locator('summary').click()
  await expect(storageSpaces.getByRole('button', { name: /Pantry page guide/i })).toBeVisible()
  await expect(storageSpaces.getByRole('button', { name: /Fridge page guide/i })).toBeVisible()
  await expect(storageSpaces.getByRole('button', { name: /Freezer page guide/i })).toBeVisible()
  await expect(storageSpaces.getByRole('button', { name: /Spice Rack page guide/i })).toBeVisible()
  await expect(storageSpaces.getByRole('button', { name: /Cabinet page guide/i })).toBeVisible()
})

test('Settings landing exposes four route guides and keeps shared behavior guides separate', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=settings')
  const routeGuides = page.locator('[data-manual-guide-group="Settings page guides"]')
  const sharedGuides = page.locator('[data-manual-guide-group="Shared behavior guides"]')

  await expect(routeGuides.getByRole('button')).toHaveCount(4)
  await expect(routeGuides.getByRole('button', { name: /Settings page guide/i })).toBeVisible()
  await expect(routeGuides.getByRole('button', { name: /Admin Controls page guide/i })).toBeVisible()
  await expect(routeGuides.getByRole('button', { name: /Guest Controls page guide/i })).toBeVisible()
  await expect(routeGuides.getByRole('button', { name: /Vacation page guide/i })).toBeVisible()
  await expect(sharedGuides.getByRole('button')).toHaveCount(2)
  await expect(sharedGuides.getByRole('button', { name: /Presence-based lighting/i })).toBeVisible()
  await expect(sharedGuides.getByRole('button', { name: /Guest stays and Vacation Mode/i })).toBeVisible()
})

test('all nine landings render the complete rich overview contract', async ({ page }, testInfo) => {
  for (const landing of LANDING_CASES) {
    await page.goto(`/index.html?path=manual&manual-section=${landing.id}&manual-article=${landing.canonicalArticleId}`)
    const overview = page.locator(`[data-manual-section-overview="${landing.id}"]`)
    const image = overview.getByRole('img', { name: landing.contextAlt })
    const tasks = overview.locator('[data-manual-common-task="true"]')
    const firstTask = tasks.first()

    await expect(overview).toBeVisible({ timeout: 15000 })
    await expect(image).toBeVisible()
    await expect(tasks).toHaveCount(landing.commonTaskCount)
    expect(await overview.locator('[data-manual-block="actions"] li').count()).toBeGreaterThanOrEqual(4)
    expect(await overview.locator('[data-manual-block="automation"] li').count()).toBeGreaterThanOrEqual(3)
    expect(await overview.locator('[data-manual-first-look="true"]').count()).toBeGreaterThanOrEqual(4)
    await expect(overview.locator('[data-manual-block="safety"]')).toHaveCount(1)
    expect(await overview.locator('[data-manual-block="guides"] [data-manual-guide-group] button').count()).toBeGreaterThan(0)
    await expect(overview.locator('[data-manual-block="troubleshooting"]')).toBeVisible()
    await expect(overview.locator('[data-manual-block="related-areas"]')).toBeVisible()
    await expect(overview.locator('video')).toHaveCount(0)
    expect(await overview.locator('img').evaluateAll((images) => images.filter((image) => {
      const src = (image as HTMLImageElement).currentSrc
      return /camera|webrtc|snapshot/i.test(src) && !image.closest('[data-manual-screenshot]')
    }).length)).toBe(0)

    const targetArticleIds = await tasks.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-manual-target-article')))
    expect(targetArticleIds).not.toContain(landing.canonicalArticleId)
    expect(await overview.locator('[data-manual-screenshot] img').evaluateAll((images) => images.every((image) => !(image as HTMLImageElement).alt.includes('Unavailable')))).toBe(true)

    const contextBeforeActions = await overview.evaluate((element) => {
      const context = element.querySelector('[data-screenshot-role="context"]')
      const actions = element.querySelector('[data-manual-block="actions"]')
      return Boolean(context && actions && (context.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING))
    })
    expect(contextBeforeActions).toBe(true)
    const blockOrder = await overview.locator('[data-manual-block]').evaluateAll((blocks) => blocks.map((block) => block.getAttribute('data-manual-block')))
    const expectedOrder = ['actions', 'common-tasks', 'automation', 'first-look', 'safety', 'guides', 'troubleshooting', 'related-areas']
    let previousIndex = -1
    for (const block of expectedOrder) {
      const nextIndex = blockOrder.indexOf(block)
      expect(nextIndex).toBeGreaterThan(previousIndex)
      previousIndex = nextIndex
    }
    if (landing.technical) {
      await expect(overview.locator('[data-manual-block="technical-details"]')).not.toHaveAttribute('open', '')
      expect(blockOrder.indexOf('technical-details')).toBeGreaterThan(blockOrder.indexOf('related-areas'))
    }

    const imageBox = await image.boundingBox()
    expect(imageBox?.height ?? 0).toBeLessThanOrEqual(420)
    const firstTaskOffset = await firstTask.evaluate((element) => {
      const scroller = element.closest<HTMLElement>('[class*="_scroller_"]')
      if (!scroller) return Number.POSITIVE_INFINITY
      return element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    })
    expect(firstTaskOffset).toBeLessThanOrEqual(landing.maxFirstTaskOffset)

    const currentSrc = await image.evaluate((element) => (element as HTMLImageElement).currentSrc)
    expect(currentSrc).toContain(testInfo.project.name === 'manual-content-desktop' ? '/manual/manual-desktop/' : '/manual/manual-mobile/')
    await expect(page).toHaveURL(new RegExp(`manual-section=${landing.id}(?:&|$)`))
    expect(new URL(page.url()).searchParams.has('manual-article')).toBe(false)
  }
})

test('Security landing common tasks open focused guides and the filtered question list', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=security')
  await page.getByRole('button', { name: /How do I arm or disarm the home alarm safely/i }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Arm or disarm the alarm' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Security' }).click()
  await page.getByRole('button', { name: /How do I lock the front door or move a garage door safely/i }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Control the front door or garage' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Security' }).click()
  await page.getByRole('button', { name: /How do I open a camera and use snapshot, audio, or recording/i }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Use a security camera' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Camera controls showing Snapshot, Muted, and Recording actions/i })).toBeVisible()
  await page.getByRole('button', { name: 'Back to Security' }).click()

  await page.getByRole('button', { name: 'Browse every question in Security Filtered to this area' }).click()
  await expect(page).toHaveURL(/manual-section=how-to.*manual-task-section=security/)
  await expect(page.getByText('Showing questions about Security.')).toBeVisible()
  expect(await page.locator('[data-manual-question="true"]').count()).toBeGreaterThan(14)
})

test('Rooms and Help prioritize useful guides and collapse long reference lists', async ({ page }) => {
  await page.goto('/index.html?path=manual&manual-section=rooms')
  const featurePages = page.locator('[data-manual-guide-group="Feature page guides"]')
  const sharedWorkflows = page.locator('[data-manual-guide-group="Shared family and workflow guides"]')
  const comfortFamilies = page.locator('[data-manual-guide-group="Comfort & sensors"]')
  const deviceFamilies = page.locator('[data-manual-guide-group="Devices & media"]')
  const actionFamilies = page.locator('[data-manual-guide-group="Cleaning & actions"]')
  const roomReferences = page.locator('[data-manual-guide-group="Room-by-room references"]')
  await expect(featurePages.getByRole('button')).toHaveCount(3)
  await expect(featurePages.getByRole('button', { name: /Mach-E page guide/i })).toBeVisible()
  await expect(featurePages.getByRole('button', { name: /Vacuums page guide/i })).toBeVisible()
  await expect(featurePages.getByRole('button', { name: /Media page guide/i })).toBeVisible()
  await expect(sharedWorkflows.getByRole('button')).toHaveCount(5)
  await expect(sharedWorkflows.getByRole('button', { name: /Robot vacuums, zones, and auto-clean/i })).toBeVisible()
  await expect(sharedWorkflows.getByRole('button', { name: /Draw a vacuum cleaning area/i })).toBeVisible()
  await expect(sharedWorkflows.getByRole('button', { name: /Media, appliances, computers, grill, and Mach-E/i })).toBeVisible()
  await expect(comfortFamilies.getByRole('button')).toHaveCount(6)
  await expect(comfortFamilies.getByRole('button', { name: /Air quality and purifier cards/i })).toBeVisible()
  await expect(deviceFamilies.getByRole('button')).toHaveCount(6)
  await expect(deviceFamilies.getByRole('button', { name: /Media remote and app cards/i })).toBeVisible()
  await expect(actionFamilies.getByRole('button')).toHaveCount(2)
  await expect(actionFamilies.getByRole('button', { name: /Robot vacuum cards and sheets/i })).toBeVisible()
  await expect(roomReferences).not.toHaveAttribute('open', '')
  await expect(roomReferences.locator('button')).toHaveCount(16)
  await roomReferences.locator('summary').click()
  for (const roomGuide of ROOM_ROUTE_GUIDE_CASES) {
    await expect(roomReferences.getByRole('button', { name: new RegExp(`^${escapedPattern(roomGuide.title)}\\s`, 'i') })).toBeVisible()
  }

  await page.goto('/index.html?path=manual&manual-section=help')
  const helpFirst = page.locator('[data-manual-guide-group="Start here"]')
  const technical = page.locator('[data-manual-guide-group="Behind the scenes"]')
  await expect(helpFirst.getByRole('button')).toHaveCount(3)
  await expect(technical).not.toHaveAttribute('open', '')
  await expect(technical.locator('button')).toHaveCount(3)
})

test('every rendered route section is declared by its route guide', async ({ page }) => {
  test.setTimeout(240000)
  for (const route of DASHBOARD_ROUTES) {
    await page.goto(`/index.html?path=${route.path}`)
    const pageHeading = route.path === 'overview'
      ? 'Home'
      : route.path === 'guests-staying-over'
        ? 'Guest Controls'
        : route.title
    await expect(page.getByRole('heading', { level: 1, name: pageHeading })).toBeVisible({ timeout: 30000 })
    const declared = new Set(route.manualVisibleSectionNames ?? [])
    const rendered = await page.locator('[data-manual-visible-section]').evaluateAll((elements) => (
      [...new Set(elements.map((element) => element.getAttribute('data-manual-visible-section')).filter((value): value is string => Boolean(value)))]
    ))
    expect(rendered.filter((title) => !declared.has(title)), route.path).toEqual([])
  }
})
