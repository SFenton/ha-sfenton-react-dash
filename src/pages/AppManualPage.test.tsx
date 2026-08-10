import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ROOM_PAGE_CONFIGS } from '../constants/roomPages'
import { MANUAL_ARTICLES, MANUAL_ARTICLES_BY_ID, MANUAL_SECTIONS } from '../manual/catalog'
import { MANUAL_BEHAVIOR_GUIDE_ARTICLES } from '../manual/behaviorGuides'
import { ROOM_CARD_FAMILY_GUIDE_ARTICLES, ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND } from '../manual/familyGuides'
import { ROOM_PAGE_GUIDE_ARTICLES } from '../manual/roomPageGuides'
import { MANUAL_SCREENSHOTS } from '../manual/screenshots'
import { isManualSurfaceGuideArticle } from '../manual/surfaceGuides'
import { MANUAL_TASK_GUIDE_ARTICLES } from '../manual/taskGuides'
import { AppManualPage } from './AppManualPage'

const LANDING_CASES = MANUAL_SECTIONS.map((section) => {
  const landing = section.landing
  if (!landing) throw new Error(`Missing landing for ${section.id}`)
  const context = MANUAL_SCREENSHOTS.find((screenshot) => screenshot.landingUse?.sectionId === section.id && screenshot.role === 'context')
  if (!context) throw new Error(`Missing context screenshot for ${section.id}`)
  return { canonicalArticleId: landing.canonicalArticleId, contextAlt: context.alt, id: section.id, title: section.title }
})

const PAGE_GUIDE_CASES = [
  { articleId: 'app-manual-page-guide', question: /^How do I use the App Manual\?/, sectionId: 'start', title: 'App Manual page guide' },
  { articleId: 'home-overview', question: /^What is on the Home screen\?/, sectionId: 'home', title: 'Home page guide' },
  { articleId: 'custom-lights-page-guide', question: /^How do I use Custom Lights\?/, sectionId: 'home', title: 'Custom Lights page guide' },
  { articleId: 'security-page-guide', question: /^What is on the Security page\?/, sectionId: 'security', title: 'Security page guide' },
  { articleId: 'thermostat-page-guide', question: /Thermostat page guide/i, sectionId: 'climate', title: 'Thermostat page guide' },
  { articleId: 'chores-page-guide', question: /Main Chores page guide/i, sectionId: 'chores', title: 'Main Chores page guide' },
  { articleId: 'to-do-page-guide', question: /Admin To-Do page guide/i, sectionId: 'chores', title: 'Admin To-Do page guide' },
  { articleId: 'groceries-page-guide', question: /Groceries page guide/i, sectionId: 'chores', title: 'Groceries page guide' },
  { articleId: 'stephens-chores-page-guide', collapsedCount: 4, collapsedGroup: 'People, ownership, and projects', question: /Stephen.s Chores page guide/i, sectionId: 'chores', title: 'Stephen’s Chores page guide' },
  { articleId: 'stephs-chores-page-guide', collapsedCount: 4, collapsedGroup: 'People, ownership, and projects', question: /Steph.s Chores page guide/i, sectionId: 'chores', title: 'Steph’s Chores page guide' },
  { articleId: 'unassigned-chores-page-guide', collapsedCount: 4, collapsedGroup: 'People, ownership, and projects', question: /Unassigned Chores page guide/i, sectionId: 'chores', title: 'Unassigned Chores page guide' },
  { articleId: 'home-improvement-chores-page-guide', collapsedCount: 4, collapsedGroup: 'People, ownership, and projects', question: /Home Improvement Tasks page guide/i, sectionId: 'chores', title: 'Home Improvement Tasks page guide' },
  { articleId: 'grocery-list-page-guide', question: /Home Grocery List page guide/i, sectionId: 'food', title: 'Home Grocery List page guide' },
  { articleId: 'food-page-guide', question: /^What is on the Food and Recipes hub\?/, sectionId: 'food', title: 'Food & Recipes hub page guide' },
  { articleId: 'recipes-page-guide', question: /Recipes page guide/i, sectionId: 'food', title: 'Recipes page guide' },
  { articleId: 'all-food-page-guide', question: /All Food page guide/i, sectionId: 'food', title: 'All Food page guide' },
  { articleId: 'pantry-page-guide', collapsedCount: 5, collapsedGroup: 'Storage spaces', question: /Pantry page guide/i, sectionId: 'food', title: 'Pantry page guide' },
  { articleId: 'fridge-page-guide', collapsedCount: 5, collapsedGroup: 'Storage spaces', question: /Fridge page guide/i, sectionId: 'food', title: 'Fridge page guide' },
  { articleId: 'freezer-page-guide', collapsedCount: 5, collapsedGroup: 'Storage spaces', question: /Freezer page guide/i, sectionId: 'food', title: 'Freezer page guide' },
  { articleId: 'spice-rack-page-guide', collapsedCount: 5, collapsedGroup: 'Storage spaces', question: /Spice Rack page guide/i, sectionId: 'food', title: 'Spice Rack page guide' },
  { articleId: 'cabinet-page-guide', collapsedCount: 5, collapsedGroup: 'Storage spaces', question: /Cabinet page guide/i, sectionId: 'food', title: 'Cabinet page guide' },
  { articleId: 'mach-e-page-guide', question: /Mach-E page guide/i, sectionId: 'rooms', title: 'Mach-E page guide' },
  { articleId: 'vacuums-page-guide', question: /Vacuums page guide/i, sectionId: 'rooms', title: 'Vacuums page guide' },
  { articleId: 'media-page-guide', question: /Media page guide/i, sectionId: 'rooms', title: 'Media page guide' },
  { articleId: 'settings-page-guide', question: /Settings page guide/i, sectionId: 'settings', title: 'Settings page guide' },
  { articleId: 'admin-page-guide', question: /Admin Controls page guide/i, sectionId: 'settings', title: 'Admin Controls page guide' },
  { articleId: 'guest-controls-page-guide', question: /Guest Controls page guide/i, sectionId: 'settings', title: 'Guest Controls page guide' },
  { articleId: 'vacation-page-guide', question: /Vacation page guide/i, sectionId: 'settings', title: 'Vacation page guide' },
] as const

describe('AppManualPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/index.html?path=manual')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
  })

  it('renders nine user-named navigation tiles and searches natural questions', () => {
    render(<AppManualPage />)

    expect(screen.getByRole('group', { name: 'App Manual sections' }).children).toHaveLength(9)
    const search = screen.getByLabelText('Search the App Manual')
    fireEvent.change(search, { target: { value: 'schedule the humidifier' } })
    expect(screen.getByRole('heading', { name: /Search Results/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Humidifier activities and schedules/i })).toBeInTheDocument()
  })

  it.each([
    ['weather forecast', /^Home page guide/i],
    ['custom light color', /Lights status and room controls/i],
    ['media keyboard', /Media, appliances, computers, grill, and Mach-E/i],
    ['vacation confirmation', /Guest stays and Vacation Mode/i],
    ['air quality', /^Status chips/i],
    ['which door is open', /Security, locks, garage doors, and cameras/i],
  ])('finds household wording: %s', (query, expectedArticle) => {
    const { unmount } = render(<AppManualPage />)
    fireEvent.change(screen.getByLabelText('Search the App Manual'), { target: { value: query } })
    expect(screen.getByRole('button', { name: expectedArticle })).toBeInTheDocument()
    unmount()
  })

  it('does not silently truncate broad search results', () => {
    render(<AppManualPage />)
    fireEvent.change(screen.getByLabelText('Search the App Manual'), { target: { value: 'room' } })
    const heading = screen.getByRole('heading', { name: /Search Results/ })
    const count = Number(heading.textContent?.match(/\((\d+)\)/)?.[1] ?? 0)
    expect(screen.getByRole('region', { name: 'Manual search results' }).querySelectorAll('button')).toHaveLength(count)
    expect(screen.getByRole('button', { name: /Master Bathroom/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entryway/i })).toBeInTheDocument()
  })

  it('opens a section and article through query-backed navigation', () => {
    render(<AppManualPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Home Learn the Home screen/i }))
    expect(window.location.search).toContain('manual-section=home')
    fireEvent.click(screen.getByRole('button', { name: /How do I read or scroll the status chips/i }))
    expect(window.location.search).toContain('manual-article=status-chips')
    expect(screen.getByText(/compact header summaries/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to Home/i })).toBeInTheDocument()
  })

  it.each(PAGE_GUIDE_CASES)('opens the $title from its landing without a Common Task self-link', ({ articleId, question, sectionId, title, ...routeGuide }) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${sectionId}`)
    const { container } = render(<AppManualPage />)

    if ('collapsedGroup' in routeGuide) fireEvent.click(screen.getByText(`${routeGuide.collapsedGroup} (${routeGuide.collapsedCount})`))
    fireEvent.click(screen.getAllByRole('button', { name: question })[0])
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    expect(window.location.search).toContain(`manual-article=${articleId}`)
    expect(container.querySelector(`[data-manual-page-guide]`)).toBeInTheDocument()
  })

  it.each(PAGE_GUIDE_CASES)('renders every structured block and registered screenshot for $title', ({ articleId, sectionId, title }) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${sectionId}&manual-article=${articleId}`)
    const { container } = render(<AppManualPage />)
    const article = MANUAL_ARTICLES_BY_ID.get(articleId)
    if (!article || article.kind !== 'page-guide') throw new Error(`Missing page guide ${articleId}`)
    const guide = container.querySelector(`[data-manual-page-guide="${article.pageGuide.routePath}"]`) as HTMLElement

    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    expect(within(guide).getByText('Page Orientation')).toBeInTheDocument()
    expect(within(guide).getByText('Visible Page Sections')).toBeInTheDocument()
    expect(within(guide).getByText('What You Can Do')).toBeInTheDocument()
    expect(within(guide).getByText('What Happens Automatically')).toBeInTheDocument()
    expect(within(guide).getByText('Look Here First')).toBeInTheDocument()
    expect(within(guide).getByText('Troubleshooting')).toBeInTheDocument()
    expect(guide.querySelectorAll('[data-manual-page-guide-first-look="true"]')).toHaveLength(article.pageGuide.lookHereFirst.length)
    expect(guide.querySelectorAll('[data-manual-screenshot]')).toHaveLength(article.pageGuide.screenshotIds.length)
    for (const sectionName of article.pageGuide.visiblePageSectionNames) expect(within(guide).getAllByText(sectionName).length).toBeGreaterThan(0)
    expect(screen.getByText(article.pageGuide.safetyAndLimitations.title)).toBeInTheDocument()
    expect(screen.getByText('Related Guides')).toBeInTheDocument()
  })

  it.each(ROOM_CARD_FAMILY_GUIDE_ARTICLES)('renders every structured family block for $title', (article) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=rooms&manual-article=${article.id}`)
    const { container } = render(<AppManualPage />)
    const guide = container.querySelector(`[data-manual-family-guide="${article.familyGuide.cardKind}"]`) as HTMLElement

    expect(screen.getByRole('heading', { level: 2, name: article.title })).toBeInTheDocument()
    expect(within(guide).getByText('Purpose')).toBeInTheDocument()
    expect(within(guide).getByText('Where It Appears')).toBeInTheDocument()
    expect(within(guide).getByText('Action Semantics')).toBeInTheDocument()
    expect(within(guide).getByText('Persistent State Meanings')).toBeInTheDocument()
    expect(within(guide).getByText('Unavailable and Disabled Behavior')).toBeInTheDocument()
    expect(within(guide).getByText('Requested State and Confirmation')).toBeInTheDocument()
    expect(within(guide).getByText('Troubleshooting')).toBeInTheDocument()
    expect(guide.querySelectorAll('[data-manual-family-state="true"]')).toHaveLength(article.familyGuide.persistentStateMeanings.length)
    expect(guide.querySelectorAll('[data-manual-screenshot]')).toHaveLength(article.familyGuide.screenshotIds.length)
    expect(screen.getByText(article.familyGuide.safetyAndLimitations.title)).toBeInTheDocument()
    expect(screen.getByText('Related Guides')).toBeInTheDocument()
  })

  it.each(MANUAL_ARTICLES.filter(isManualSurfaceGuideArticle))('renders every structured surface block for $title', (article) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${article.sectionId}&manual-article=${article.id}`)
    const { container } = render(<AppManualPage />)
    const guide = container.querySelector(`[data-manual-surface-guide="${article.id}"]`) as HTMLElement

    expect(screen.getByRole('heading', { level: 2, name: article.title })).toBeInTheDocument()
    expect(within(guide).getByText('How to Open')).toBeInTheDocument()
    expect(within(guide).getByText('What It Contains')).toBeInTheDocument()
    expect(within(guide).getByText('Tabs, Details, and Wizard Navigation')).toBeInTheDocument()
    expect(within(guide).getByText('Close, Back, and Cancel')).toBeInTheDocument()
    expect(within(guide).getByText('What Home Assistant Owns')).toBeInTheDocument()
    expect(within(guide).getByText('State and Disabled Behavior')).toBeInTheDocument()
    expect(within(guide).getByText('Troubleshooting')).toBeInTheDocument()
    expect(guide.querySelectorAll('[data-manual-surface-navigation-item]')).toHaveLength(
      article.surfaceGuide.navigation.tabs.length
      + article.surfaceGuide.navigation.detailPages.length
      + article.surfaceGuide.navigation.wizardSteps.length,
    )
    expect(guide.querySelectorAll('[data-manual-screenshot]')).toHaveLength(article.surfaceGuide.screenshotIds.length)
    expect(screen.getByText(article.surfaceGuide.safetyAndLimitations.title)).toBeInTheDocument()
    expect(screen.getByText('Related Guides')).toBeInTheDocument()
  })

  it.each(MANUAL_BEHAVIOR_GUIDE_ARTICLES)('renders every structured behavior block for $title', (article) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${article.sectionId}&manual-article=${article.id}`)
    const { container } = render(<AppManualPage />)
    const guide = container.querySelector(`[data-manual-behavior-guide="${article.id}"]`) as HTMLElement

    expect(screen.getByRole('heading', { level: 2, name: article.title })).toBeInTheDocument()
    for (const heading of [
      'What This Capability Does',
      'When It Runs',
      'Conditions and Preconditions',
      'Household Effects',
      'What You See in the App',
      'Guests, Vacation, and Away',
      'Override, Pause, or Recover',
      'Notifications',
      'Troubleshooting',
      'Affected App Areas',
    ]) expect(within(guide).getByText(heading)).toBeInTheDocument()
    expect(screen.getByText(article.behaviorGuide.safetyAndLimitations.title)).toBeInTheDocument()
    expect(screen.getByText('Related Guides')).toBeInTheDocument()
  })

  it.each(MANUAL_TASK_GUIDE_ARTICLES)('renders the complete structured task contract for $title', (article) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${article.sectionId}&manual-article=${article.id}`)
    const { container } = render(<AppManualPage />)
    const guide = container.querySelector(`[data-manual-task-guide="${article.id}"]`) as HTMLElement

    expect(screen.getByRole('heading', { level: 2, name: article.title })).toBeInTheDocument()
    for (const heading of [
      'Question',
      'Before You Start',
      'Steps',
      'What Success Looks Like',
      'Back, Cancel, or Close',
      'If It Does Not Work',
      'What Happens Automatically',
    ]) expect(within(guide).getByText(heading)).toBeInTheDocument()
    expect(guide.querySelector('[data-manual-task-guide-block="steps"] ol')?.children).toHaveLength(article.taskGuide.steps.length)
    expect(guide.querySelectorAll('[data-manual-screenshot]')).toHaveLength(article.taskGuide.screenshotEvidence.screenshotIds.length)
    if (article.taskGuide.screenshotEvidence.nonvisualReason) {
      expect(guide.querySelector('[data-manual-task-guide-nonvisual="true"]')).toBeInTheDocument()
    }
    expect(screen.getByText(article.taskGuide.safetyAndLimitations.title)).toBeInTheDocument()
    expect(screen.getByText('Related Guides')).toBeInTheDocument()
  })

  it('opens each landing task guide through its canonical Common Tasks question', () => {
    for (const section of MANUAL_SECTIONS) {
      const commonTask = section.landing?.commonTasks.find((entry) => MANUAL_ARTICLES_BY_ID.get(entry.articleId)?.kind === 'task-guide')
      if (!commonTask) throw new Error(`Missing task-guide Common Task for ${section.id}`)
      const article = MANUAL_ARTICLES_BY_ID.get(commonTask.articleId)
      if (!article || article.kind !== 'task-guide') throw new Error(`Missing task guide ${commonTask.articleId}`)

      window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${section.id}`)
      const view = render(<AppManualPage />)
      const commonTaskButton = view.container.querySelector(`[data-manual-common-task="true"][data-manual-target-article="${article.id}"]`)
      if (!(commonTaskButton instanceof HTMLButtonElement)) throw new Error(`Missing Common Task button for ${article.id}`)
      fireEvent.click(commonTaskButton)
      expect(screen.getByRole('heading', { level: 2, name: article.title })).toBeInTheDocument()
      expect(window.location.search).toContain(`manual-article=${article.id}`)
      view.unmount()
    }
  })

  it('renders all sixteen room guides before their generated controls appendix', () => {
    for (const article of ROOM_PAGE_GUIDE_ARTICLES) {
      window.history.replaceState(null, '', `/index.html?path=manual&manual-section=rooms&manual-article=${article.id}`)
      const view = render(<AppManualPage />)
      const guide = view.container.querySelector(`[data-manual-page-guide="${article.pageGuide.routePath}"]`) as HTMLElement
      const troubleshooting = guide.querySelector('[data-manual-page-guide-block="troubleshooting"]') as HTMLElement
      const appendix = guide.querySelector('[data-manual-page-guide-block="configured-controls-reference"]') as HTMLElement
      const reference = appendix.querySelector(`[data-manual-room-reference="${article.pageGuide.generatedRoomPath}"]`) as HTMLElement
      const room = ROOM_PAGE_CONFIGS[article.pageGuide.routePath]
      const configuredCards = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
      const referenceCards = [...reference.querySelectorAll<HTMLButtonElement>('button[data-manual-room-reference-card="true"]')]

      expect(screen.getByRole('heading', { level: 2, name: article.title })).toBeInTheDocument()
      expect(within(guide).getByText('Page Orientation')).toBeInTheDocument()
      expect(within(guide).getByText('Configured Controls Reference')).toBeInTheDocument()
      expect(troubleshooting.compareDocumentPosition(appendix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(reference.querySelectorAll('[data-manual-room-reference-card="true"]')).toHaveLength(
        configuredCards.length,
      )
      expect(referenceCards).toHaveLength(configuredCards.length)
      for (const [index, card] of configuredCards.entries()) {
        expect(referenceCards[index]).toHaveAttribute('data-manual-family-kind', card.kind)
        expect(referenceCards[index]).toHaveTextContent(ROOM_CARD_FAMILY_GUIDE_ARTICLES_BY_KIND[card.kind].title)
      }
      view.unmount()
    }
  })

  it('renders accurate status-only, immediate, conditional, and state-dependent room facts', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=rooms&manual-article=room-garage')
    const garage = render(<AppManualPage />)
    expect(screen.getByRole('button', { name: /Washing MachineStatus only — reports live state and does not open a sheet or send a command/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Left DoorImmediate direct action — toggles this physical control without opening a detail sheet or confirmation/i })).toBeInTheDocument()
    garage.unmount()

    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=rooms&manual-article=room-office')
    const office = render(<AppManualPage />)
    expect(screen.getByRole('button', { name: /Stephen.s PCState-dependent direct action — when the displayed power helper is On/i })).toBeInTheDocument()
    office.unmount()

    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=rooms&manual-article=room-back-deck')
    const deck = render(<AppManualPage />)
    expect(screen.getByRole('button', { name: /Bear GrillsConditional detail opener — opens its focused sheet only while active/i })).toBeInTheDocument()
    deck.unmount()
  })

  it.each(LANDING_CASES)('renders and canonically resolves the $title rich landing', async ({ canonicalArticleId, contextAlt, id, title }) => {
    window.history.replaceState(null, '', `/index.html?path=manual&manual-section=${id}&manual-article=${canonicalArticleId}`)
    const { container } = render(<AppManualPage />)

    const overview = container.querySelector(`[data-manual-section-overview="${id}"]`) as HTMLElement
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: contextAlt })).toBeInTheDocument()
    expect(overview).toBeInTheDocument()
    expect(overview.querySelectorAll('[data-manual-common-task="true"]').length).toBeGreaterThanOrEqual(4)
    expect(overview.querySelectorAll('[data-manual-common-task="true"]').length).toBeLessThanOrEqual(6)
    expect(Array.from(overview.querySelectorAll('[data-manual-common-task="true"]')).every((task) => task.getAttribute('data-manual-target-article') !== canonicalArticleId)).toBe(true)
    expect(overview.querySelector('[data-manual-guide-browser] [data-manual-guide-group]')).toBeInTheDocument()
    expect(overview.querySelector('video')).not.toBeInTheDocument()
    expect(Array.from(overview.querySelectorAll('img')).filter((image) => /camera|webrtc|snapshot/i.test(image.getAttribute('src') ?? '') && !image.closest('[data-manual-screenshot]'))).toHaveLength(0)
    expect(screen.getByText('What You Can Do').compareDocumentPosition(screen.getByText('Common Tasks')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Common Tasks').compareDocumentPosition(screen.getByText('What Happens Automatically')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('What Happens Automatically').compareDocumentPosition(screen.getByText('Look Here First')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await waitFor(() => {
      expect(new URL(window.location.href).searchParams.get('manual-section')).toBe(id)
      expect(new URL(window.location.href).searchParams.has('manual-article')).toBe(false)
    })
  })

  it('groups feature pages, detailed families, room references, and Help instead of one flat list', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=rooms')
    const rooms = render(<AppManualPage />)
    const featurePages = rooms.container.querySelector('[data-manual-guide-group="Feature page guides"]')
    const sharedWorkflows = rooms.container.querySelector('[data-manual-guide-group="Shared family and workflow guides"]')
    const automaticCleaning = rooms.container.querySelector('[data-manual-guide-group="Automatic cleaning behavior"]')
    const automaticEquipment = rooms.container.querySelector('[data-manual-guide-group="Automatic media and equipment behavior"]')
    const comfortFamilies = screen.getByText('Comfort & sensors').closest('[data-manual-guide-group]')
    const deviceFamilies = screen.getByText('Devices & media').closest('[data-manual-guide-group]')
    const actionFamilies = screen.getByText('Cleaning & actions').closest('[data-manual-guide-group]')
    const roomReferences = screen.getByText(`Room-by-room references (16)`).closest('details')
    expect(featurePages).not.toBeNull()
    expect(within(featurePages as HTMLElement).getAllByRole('button')).toHaveLength(3)
    expect(within(featurePages as HTMLElement).getByRole('button', { name: /Mach-E page guide/i })).toBeInTheDocument()
    expect(within(featurePages as HTMLElement).getByRole('button', { name: /Vacuums page guide/i })).toBeInTheDocument()
    expect(within(featurePages as HTMLElement).getByRole('button', { name: /Media page guide/i })).toBeInTheDocument()
    expect(sharedWorkflows).not.toBeNull()
    expect(within(sharedWorkflows as HTMLElement).getAllByRole('button')).toHaveLength(5)
    expect(within(automaticCleaning as HTMLElement).getAllByRole('button')).toHaveLength(2)
    expect(within(automaticEquipment as HTMLElement).getAllByRole('button')).toHaveLength(5)
    expect(within(comfortFamilies as HTMLElement).getAllByRole('button')).toHaveLength(6)
    expect(within(deviceFamilies as HTMLElement).getAllByRole('button')).toHaveLength(6)
    expect(within(actionFamilies as HTMLElement).getAllByRole('button')).toHaveLength(2)
    expect(within(comfortFamilies as HTMLElement).getByRole('button', { name: /Air quality and purifier cards/i })).toBeInTheDocument()
    expect(within(deviceFamilies as HTMLElement).getByRole('button', { name: /Media remote and app cards/i })).toBeInTheDocument()
    expect(within(actionFamilies as HTMLElement).getByRole('button', { name: /Robot vacuum cards and sheets/i })).toBeInTheDocument()
    expect(roomReferences).not.toHaveAttribute('open')
    expect(roomReferences?.querySelectorAll('button')).toHaveLength(16)
    rooms.unmount()

    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=help')
    const help = render(<AppManualPage />)
    const startHere = help.container.querySelector('[data-manual-guide-group="Start here"]')
    const behindScenes = screen.getByText('Behind the scenes (3)').closest('details')
    expect(startHere).not.toBeNull()
    expect(within(startHere as HTMLElement).getAllByRole('button')).toHaveLength(3)
    expect(behindScenes).not.toHaveAttribute('open')
    expect(behindScenes?.querySelectorAll('button')).toHaveLength(3)
  })

  it('keeps Chores route guides grouped and all seven destinations reachable', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=chores')
    const { container } = render(<AppManualPage />)
    const mainLists = container.querySelector('[data-manual-guide-group="Main and shared lists"]') as HTMLElement
    const siblingLists = screen.getByText('People, ownership, and projects (4)').closest('details')
    const sharedBehavior = container.querySelector('[data-manual-guide-group="Shared task behavior"]') as HTMLElement

    expect(within(mainLists).getAllByRole('button')).toHaveLength(3)
    expect(within(mainLists).getByRole('button', { name: /Main Chores page guide/i })).toBeInTheDocument()
    expect(within(mainLists).getByRole('button', { name: /Groceries page guide/i })).toBeInTheDocument()
    expect(within(mainLists).getByRole('button', { name: /Admin To-Do page guide/i })).toBeInTheDocument()
    expect(siblingLists).not.toHaveAttribute('open')
    expect(siblingLists?.querySelectorAll('button')).toHaveLength(4)
    expect(sharedBehavior).not.toBeNull()
    expect(within(sharedBehavior).getAllByRole('button')).toHaveLength(2)

    fireEvent.click(screen.getByText('People, ownership, and projects (4)'))
    expect(within(siblingLists as HTMLElement).getByRole('button', { name: /Stephen.s Chores page guide/i })).toBeInTheDocument()
    expect(within(siblingLists as HTMLElement).getByRole('button', { name: /Steph.s Chores page guide/i })).toBeInTheDocument()
    expect(within(siblingLists as HTMLElement).getByRole('button', { name: /Unassigned Chores page guide/i })).toBeInTheDocument()
    expect(within(siblingLists as HTMLElement).getByRole('button', { name: /Home Improvement Tasks page guide/i })).toBeInTheDocument()
  })

  it('keeps Food route guides grouped and all nine destinations reachable', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=food')
    const { container } = render(<AppManualPage />)
    const foodPages = container.querySelector('[data-manual-guide-group="Food pages"]') as HTMLElement
    const storageSpaces = screen.getByText('Storage spaces (5)').closest('details')
    const sharedWorkflows = container.querySelector('[data-manual-guide-group="Shared workflows"]') as HTMLElement

    expect(within(foodPages).getAllByRole('button')).toHaveLength(4)
    expect(within(foodPages).getByRole('button', { name: /Food & Recipes hub page guide/i })).toBeInTheDocument()
    expect(within(foodPages).getByRole('button', { name: /Home Grocery List page guide/i })).toBeInTheDocument()
    expect(within(foodPages).getByRole('button', { name: /All Food page guide/i })).toBeInTheDocument()
    expect(within(foodPages).getByRole('button', { name: /Recipes page guide/i })).toBeInTheDocument()
    expect(storageSpaces).not.toHaveAttribute('open')
    expect(storageSpaces?.querySelectorAll('button')).toHaveLength(5)
    expect(within(sharedWorkflows).getAllByRole('button')).toHaveLength(3)
    expect(within(sharedWorkflows).getByRole('button', { name: /^RecipesHow recipe suggestions/i })).toBeInTheDocument()

    fireEvent.click(screen.getByText('Storage spaces (5)'))
    expect(within(storageSpaces as HTMLElement).getByRole('button', { name: /Pantry page guide/i })).toBeInTheDocument()
    expect(within(storageSpaces as HTMLElement).getByRole('button', { name: /Fridge page guide/i })).toBeInTheDocument()
    expect(within(storageSpaces as HTMLElement).getByRole('button', { name: /Freezer page guide/i })).toBeInTheDocument()
    expect(within(storageSpaces as HTMLElement).getByRole('button', { name: /Spice Rack page guide/i })).toBeInTheDocument()
    expect(within(storageSpaces as HTMLElement).getByRole('button', { name: /Cabinet page guide/i })).toBeInTheDocument()
  })

  it('keeps four Settings page guides reachable and shared behavior guides separate', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=settings')
    const { container } = render(<AppManualPage />)
    const routeGuides = container.querySelector('[data-manual-guide-group="Settings page guides"]') as HTMLElement
    const sharedGuides = container.querySelector('[data-manual-guide-group="Shared behavior guides"]') as HTMLElement
    const automaticGuides = container.querySelector('[data-manual-guide-group="Automatic house-mode behavior"]') as HTMLElement

    expect(within(routeGuides).getAllByRole('button')).toHaveLength(4)
    expect(within(routeGuides).getByRole('button', { name: /Settings page guide/i })).toBeInTheDocument()
    expect(within(routeGuides).getByRole('button', { name: /Admin Controls page guide/i })).toBeInTheDocument()
    expect(within(routeGuides).getByRole('button', { name: /Guest Controls page guide/i })).toBeInTheDocument()
    expect(within(routeGuides).getByRole('button', { name: /Vacation page guide/i })).toBeInTheDocument()
    expect(within(sharedGuides).getAllByRole('button')).toHaveLength(2)
    expect(within(sharedGuides).getByRole('button', { name: /Presence-based lighting/i })).toBeInTheDocument()
    expect(within(sharedGuides).getByRole('button', { name: /Guest stays and Vacation Mode/i })).toBeInTheDocument()
    expect(within(automaticGuides).getAllByRole('button')).toHaveLength(4)
    expect(within(automaticGuides).getByRole('button', { name: /Overnight presence-lighting reset/i })).toBeInTheDocument()
  })

  it('filters How Do I questions to the selected landing section', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=how-to&manual-task-section=security')
    const { container } = render(<AppManualPage />)

    expect(screen.getByText('Showing questions about Security.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Security' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-manual-question="true"]').length).toBeGreaterThan(14)
    expect(screen.queryByText(/humidifier/i)).not.toBeInTheDocument()
  })

  it('opens a real drilldown from a landing Common Task link', () => {
    window.history.replaceState(null, '', '/index.html?path=manual&manual-section=security')
    render(<AppManualPage />)

    fireEvent.click(screen.getByRole('button', { name: /How do I arm or disarm the home alarm safely/i }))
    expect(screen.getByRole('heading', { level: 2, name: 'Arm or disarm the alarm' })).toBeInTheDocument()
    expect(window.location.search).toContain('manual-article=task-arm-or-disarm-alarm')
  })

  it('renders preload geometry without loading manual images', () => {
    const { container } = render(<AppManualPage preload />)
    expect(container.querySelector('[data-manual-preload="true"]')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByLabelText('Search the App Manual')).not.toBeInTheDocument()
  })
})
