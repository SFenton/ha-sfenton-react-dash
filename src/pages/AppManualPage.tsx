import { useHass } from '@hakit/core'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Description } from '../components/core/Description'
import { MaterialIcon } from '../components/core/Icon'
import { SectionHeader } from '../components/core/SectionHeader'
import { ManualScreenshot } from '../components/manual/ManualScreenshot'
import { EVERSHELF_FOOD_SPACES } from '../constants/everShelfFood'
import { ROOM_PAGE_CONFIGS } from '../constants/roomPages'
import { DASHBOARD_ROUTES, APP_MANUAL_ROUTE_PATH, primaryNavPathForRoute } from '../constants/routes'
import { dashboardEventTargets, dashboardHref, pushDashboardUrl, replaceDashboardUrl, DASHBOARD_ROUTE_CHANGE_EVENT } from '../hooks/dashboardLocation'
import { usePageScrollToTop } from '../hooks/usePageScroller'
import {
  MANUAL_ARTICLES,
  MANUAL_ARTICLES_BY_ID,
  MANUAL_SECTIONS,
  MANUAL_SECTIONS_BY_ID,
  manualArticlesForSection,
  manualTaskEntries,
} from '../manual/catalog'
import { manualBehaviorGuideAuthoredTextValues } from '../manual/behaviorGuides'
import { manualFamilyGuideAuthoredTextValues } from '../manual/familyGuides'
import { MANUAL_HA_SUMMARY } from '../manual/generated/haInventory'
import { manualSelectionFromUrl, manualUrl, type ManualSelection } from '../manual/navigation'
import { roomCardFamilyArticleId } from '../manual/roomCardFamilies'
import { roomReferenceInteractionDescription } from '../manual/roomReference'
import { manualScreenshotConfig } from '../manual/screenshots'
import { manualSurfaceGuideAuthoredTextValues } from '../manual/surfaceGuides'
import { MANUAL_SURFACES } from '../manual/surfaces'
import { manualTaskGuideAuthoredTextValues } from '../manual/taskGuides'
import type { ManualArticle, ManualBehaviorGuideArticle, ManualBlock, ManualFactId, ManualFamilyGuideArticle, ManualPageGuideArticle, ManualSectionGuideGroup, ManualSectionId, ManualSurfaceGuideArticle, ManualSurfaceGuideNavigationItem, ManualTaskGuideArticle } from '../manual/types'
import styles from './AppManualPage.module.css'

const PRELOAD_TILE_COUNT = 8

function ManualPreload() {
  return (
    <div aria-hidden="true" className={styles.preload} data-manual-preload="true">
      {Array.from({ length: PRELOAD_TILE_COUNT }, (_, index) => <span key={index} />)}
    </div>
  )
}

function normalizedSearchText(value: string) {
  return value.trim().toLowerCase()
}

function canonicalManualSelection(selection: ManualSelection): ManualSelection {
  const selectedArticle = selection.articleId ? MANUAL_ARTICLES_BY_ID.get(selection.articleId) : undefined
  const canonicalSection = selectedArticle ? MANUAL_SECTIONS.find((section) => section.landing?.canonicalArticleId === selectedArticle.id) : undefined
  return canonicalSection ? { sectionId: canonicalSection.id } : selection
}

function searchArticleText(article: ManualArticle) {
  const blockText = article.blocks.flatMap((block) => {
    if (block.type === 'paragraph' || block.type === 'callout') return [block.text]
    if (block.type === 'steps' || block.type === 'bullets') return [block.title, ...block.items]
    if (block.type === 'fact') return [block.title, block.factId]
    if (block.type === 'overview-purpose') return [block.text]
    if (block.type === 'overview-actions' || block.type === 'overview-automation') return block.items
    if (block.type === 'overview-first-look') return block.items.flatMap((item) => [item.label, item.text])
    if (block.type === 'overview-safety') return [block.title, block.text]
    return []
  })
  const pageGuideText = article.kind === 'page-guide'
    ? [
      article.pageGuide.routePath,
      article.pageGuide.orientation,
      ...article.pageGuide.visiblePageSectionNames,
      ...article.pageGuide.whatYouCanDo,
      ...(article.pageGuide.whatHappensAutomatically.mode === 'automatic'
        ? article.pageGuide.whatHappensAutomatically.items
        : [article.pageGuide.whatHappensAutomatically.explanation]),
      ...article.pageGuide.lookHereFirst.flatMap((item) => [item.label, item.explanation]),
      article.pageGuide.safetyAndLimitations.title,
      article.pageGuide.safetyAndLimitations.text,
      ...article.pageGuide.troubleshootingChecks,
    ]
    : []
  const familyGuideText = article.kind === 'family-guide' ? manualFamilyGuideAuthoredTextValues(article) : []
  const surfaceGuideText = article.kind === 'surface-guide' ? manualSurfaceGuideAuthoredTextValues(article) : []
  const behaviorGuideText = article.kind === 'behavior-guide' ? manualBehaviorGuideAuthoredTextValues(article) : []
  const taskGuideText = article.kind === 'task-guide' ? manualTaskGuideAuthoredTextValues(article) : []
  const surfaceLabels = MANUAL_SURFACES.filter((surface) => surface.ownerArticleId === article.id).map((surface) => surface.visibleName)
  return [
    article.title,
    article.summary,
    ...(article.aliases ?? []),
    ...(article.visibleLabels ?? []),
    ...article.keywords,
    ...article.tasks,
    ...blockText,
    ...pageGuideText,
    ...familyGuideText,
    ...surfaceGuideText,
    ...behaviorGuideText,
    ...taskGuideText,
    ...surfaceLabels,
  ].join(' ').toLowerCase()
}

function statusLabel(article: ManualArticle) {
  if (article.status === 'in-development') return 'In Development'
  if (article.status === 'known-limitation') return 'Known Limitation'
  return null
}

function manualDisplayText(value: string) {
  return value
    .replace(/\bDonetick\b/gi, 'the household task system')
    .replace(/\bEverShelf\b/gi, 'the food inventory service')
}

function articleKindLabel(article: ManualArticle) {
  if (article.kind === 'task-guide') return 'Step-by-step'
  if (article.kind === 'page-guide') return 'Page tour'
  if (article.kind === 'surface-guide') return 'Screen guide'
  if (article.kind === 'family-guide') return 'Control guide'
  if (article.kind === 'behavior-guide') return 'How the house works'
  if (article.kind === 'technical-reference') return 'Technical reference'
  return 'Guide'
}

function manualArticleOutlineLabels(article: ManualArticle) {
  if (article.kind === 'page-guide') return ['What this page is for', "What you'll find", 'What you can do', 'What happens automatically', 'Look here first', 'Troubleshooting']
  if (article.kind === 'family-guide') return ['What this card does', "Where you'll see it", 'What tapping it does', 'What each label means', 'When it is unavailable', 'After you tap', 'Troubleshooting']
  if (article.kind === 'surface-guide') return ['How to open', "What you'll find", 'Moving around inside', 'Close, back, or cancel', 'Behind the scenes', 'When controls are unavailable', 'Troubleshooting']
  if (article.kind === 'behavior-guide') return ['What this does', 'How it works', 'Pause, override, or recover', 'Troubleshooting', 'Behind the scenes']
  if (article.kind === 'task-guide') return ['Task at a glance', 'Before you start', 'Steps', 'What success looks like', 'Back, cancel, or close', 'If it does not work', 'What happens automatically']
  return article.blocks.flatMap((block) => (
    block.type === 'steps' || block.type === 'bullets' || block.type === 'fact'
      ? [block.title]
      : []
  ))
}

function firstSentence(value: string) {
  return value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? value
}

function ManualRow({
  article,
  onClick,
  secondary,
}: {
  article: ManualArticle
  onClick: () => void
  secondary?: string
}) {
  const status = statusLabel(article)
  return (
    <button className={styles.articleRow} onClick={onClick} type="button">
      <span aria-hidden="true" className={styles.rowIcon}>
        <MaterialIcon name={article.icon} size={24} />
      </span>
      <span className={styles.rowCopy}>
        <strong>{article.title}</strong>
        <small>{manualDisplayText(secondary ?? article.summary)}</small>
        {status && <span className={styles.status}>{status}</span>}
      </span>
      <MaterialIcon name="mdi:chevron-right" size={22} />
    </button>
  )
}

function ManualBackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className={styles.backButton} onClick={onClick} type="button">
      <MaterialIcon name="mdi:chevron-left" size={20} />
      {label}
    </button>
  )
}

function ManualArticleOutline({ article, getArticleElement }: { article: ManualArticle; getArticleElement: () => HTMLElement | null }) {
  const labels = manualArticleOutlineLabels(article)
  if (labels.length < 2) return null

  const jumpTo = (label: string) => {
    const heading = [...(getArticleElement()?.querySelectorAll<HTMLElement>('[data-manual-visible-section]') ?? [])]
      .find((element) => element.textContent?.trim() === label)
    heading?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  return (
    <nav aria-label="In this guide" className={styles.articleOutline}>
      <strong>In this guide</strong>
      <div className={styles.articleOutlineScroller}>
        {labels.map((label) => <button key={label} onClick={() => jumpTo(label)} type="button">{label}</button>)}
      </div>
    </nav>
  )
}

function ManualEndNavigation({
  article,
  navigate,
}: {
  article: ManualArticle
  navigate: (selection: ManualSelection, replace?: boolean) => void
}) {
  const canonicalIds = new Set(MANUAL_SECTIONS.flatMap((section) => section.landing ? [section.landing.canonicalArticleId] : []))
  const siblings = manualArticlesForSection(article.sectionId)
    .filter((candidate) => !canonicalIds.has(candidate.id) && candidate.kind === article.kind)
  const index = siblings.findIndex((candidate) => candidate.id === article.id)
  const previous = index > 0 ? siblings[index - 1] : undefined
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined
  const section = MANUAL_SECTIONS_BY_ID.get(article.sectionId)

  return (
    <footer className={styles.endNavigation}>
      <div className={styles.endMarker}><span>End of guide</span></div>
      <nav aria-label="Guide navigation" className={styles.guidePager}>
        {previous
          ? <button onClick={() => navigate({ articleId: previous.id, sectionId: previous.sectionId })} type="button"><small><MaterialIcon name="mdi:chevron-left" size={15} />Previous</small><strong>{previous.title}</strong></button>
          : <button aria-label={`No previous ${articleKindLabel(article).toLowerCase()} guide`} disabled type="button"><small><MaterialIcon name="mdi:chevron-left" size={15} />Previous</small><strong>First {articleKindLabel(article).toLowerCase()}</strong></button>}
        <button onClick={() => navigate({ sectionId: article.sectionId })} type="button"><small><MaterialIcon name="mdi:arrow-up" size={15} />Section</small><strong>{section?.title ?? 'App Manual'}</strong></button>
        {next
          ? <button onClick={() => navigate({ articleId: next.id, sectionId: next.sectionId })} type="button"><small>Next<MaterialIcon name="mdi:chevron-right" size={15} /></small><strong>{next.title}</strong></button>
          : <button aria-label={`No next ${articleKindLabel(article).toLowerCase()} guide`} disabled type="button"><small>Next<MaterialIcon name="mdi:chevron-right" size={15} /></small><strong>Last {articleKindLabel(article).toLowerCase()}</strong></button>}
      </nav>
    </footer>
  )
}

function ManualBehaviorFlow({ article }: { article: ManualBehaviorGuideArticle }) {
  const guide = article.behaviorGuide
  const stages = [
    { label: 'When', text: firstSentence(guide.whenAndTriggers[0]) },
    { label: 'Checks', text: firstSentence(guide.conditionsAndPreconditions[0]) },
    { label: 'Changes', text: firstSentence(guide.householdEffects[0]) },
    { label: 'You see', text: firstSentence(guide.visibleAppSigns[0]) },
  ]

  return (
    <section className={styles.block} data-manual-behavior-guide-block="flow">
      <SectionHeader title="How it works" />
      <ol className={styles.behaviorFlow}>
        {stages.map((stage, index) => (
          <li key={stage.label}>
            <span>{index + 1}</span>
            <strong>{stage.label}</strong>
            <p>{manualDisplayText(stage.text)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function ManualTaskPath({ article }: { article: ManualTaskGuideArticle }) {
  const guide = article.taskGuide
  const items = [
    { label: 'Prepare', text: guide.prerequisites[0] },
    { label: 'Do', text: guide.steps[0] },
    { label: 'Confirm', text: guide.successConfirmation[0] },
    { label: 'Recover', text: guide.failureAndRecovery[0] },
  ]

  return (
    <section className={styles.block} data-manual-task-guide-block="at-a-glance">
      <SectionHeader title="Task at a glance" />
      <div className={styles.taskPath}>
        {items.map((item, index) => (
          <div key={item.label}>
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
            <p>{manualDisplayText(firstSentence(item.text))}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

interface ResolvedManualGuideGroup extends ManualSectionGuideGroup {
  articles: ManualArticle[]
}

function resolveManualGuideGroups(sectionId: ManualSectionId, groups: ManualSectionGuideGroup[], initiallyUsed: Iterable<string> = []) {
  const usedArticleIds = new Set(initiallyUsed)
  const resolvedGroups = groups.map((group): ResolvedManualGuideGroup => {
    const explicit = group.articleIds ?? []
    const byKind = group.kinds
      ? MANUAL_ARTICLES.filter((article) => article.sectionId === sectionId && group.kinds?.includes(article.kind)).map((article) => article.id)
      : []
    const articles = [...new Set([...explicit, ...byKind])]
      .filter((id) => !usedArticleIds.has(id))
      .map((id) => MANUAL_ARTICLES_BY_ID.get(id))
      .filter((article): article is ManualArticle => Boolean(article))
    articles.forEach((article) => usedArticleIds.add(article.id))
    return { ...group, articles }
  }).filter((group) => group.articles.length > 0)

  return {
    groups: resolvedGroups,
    ungrouped: manualArticlesForSection(sectionId).filter((article) => !usedArticleIds.has(article.id)),
  }
}

function ManualGuideGroups({
  groups,
  navigate,
  ungrouped,
}: {
  groups: ResolvedManualGuideGroup[]
  navigate: (selection: ManualSelection, replace?: boolean) => void
  ungrouped: ManualArticle[]
}) {
  return (
    <>
      {groups.map((group) => group.collapsed ? (
        <details className={styles.details} data-manual-guide-group={group.title} key={group.title}>
          <summary>{group.title} ({group.articles.length})</summary>
          {group.summary && <Description>{group.summary}</Description>}
          <div className={styles.detailsList}>{group.articles.map((article) => <ManualRow article={article} key={article.id} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} />)}</div>
        </details>
      ) : (
        <div className={styles.guideGroup} data-manual-guide-group={group.title} key={group.title}>
          <h3>{group.title}</h3>
          {group.summary && <Description>{group.summary}</Description>}
          <div className={styles.list}>{group.articles.map((article) => <ManualRow article={article} key={article.id} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} />)}</div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div className={styles.guideGroup} data-manual-guide-group="More guides">
          <h3>More Guides</h3>
          <div className={styles.list}>{ungrouped.map((article) => <ManualRow article={article} key={article.id} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} />)}</div>
        </div>
      )}
    </>
  )
}

function groupedCatalog<T extends { category: string }>(items: T[]) {
  return [...new Set(items.map((item) => item.category))].sort().map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  }))
}

function liveCatalogCategory(value: string) {
  const text = value.toLowerCase()
  if (/presence|light|illumin|relay/.test(text)) return 'Lighting & Presence'
  if (/thermostat|climate|humid|air purifier|aqi|fan|temperature|vent/.test(text)) return 'Climate & Air'
  if (/alarm|security|lock|camera|frigate|doorbell|garage/.test(text)) return 'Security & Access'
  if (/food|recipe|grocery|dishwasher|chore|task|donetick|todo/.test(text)) return 'Food, Chores & Tasks'
  if (/vacuum|valetudo|roborock|mop/.test(text)) return 'Cleaning & Vacuums'
  if (/sleep|bed|wake/.test(text)) return 'Sleep & Wake'
  if (/media|tv|shield|apple|sonos|projector|avr|xbox|nintendo|pc/.test(text)) return 'Media & Computers'
  if (/vacation|guest|away/.test(text)) return 'Guest & Vacation'
  if (/washer|dryer|grill|mach|ford|sprinkler/.test(text)) return 'Appliances & Vehicle'
  return 'Reliability & Internal'
}

function ManualFact({ factId }: { factId: ManualFactId }) {
  const hassEntities = useHass((state) => state.entities)
  if (factId === 'presence-states') {
    return (
      <table className={styles.factTable}>
        <thead><tr><th>Household label</th><th>What it means</th><th>HA command value</th></tr></thead>
        <tbody>
          <tr><td>Enabled</td><td>Presence and occupancy may control the room lights.</td><td>active</td></tr>
          <tr><td>Disabled</td><td>Automatic presence lighting is off for the room.</td><td>off</td></tr>
          <tr><td>Paused</td><td>Keep the current light state until explicitly resumed.</td><td>paused</td></tr>
          <tr><td>Quieted</td><td>Stay dark, then rearm after the room clears.</td><td>quieted</td></tr>
        </tbody>
      </table>
    )
  }

  if (factId === 'schedule-types') {
    const rows = [
      ['Chores and tasks', 'Task recurrence and due-date fields', 'Chores or person-specific task pages'],
      ['Wake alarms', 'SleepyPod schedules sent through the configured device connection', 'Master Bedroom bed sheets'],
      ['Humidifier activities', 'Home Assistant schedule helper with device profile data', 'Humidifier Schedules tab'],
      ['Vacuum auto-clean', 'Automations and cleaning-controller switches', 'Vacuums and Guest Controls'],
      ['Vacation dates', 'Home Assistant date/time helpers', 'Settings > Vacation'],
      ['Daily summaries', 'Time-triggered automations and notification deep links', 'Daily Report'],
    ]
    return (
      <table className={styles.factTable}>
        <thead><tr><th>Schedule</th><th>Owner</th><th>Where to edit it</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
      </table>
    )
  }

  if (factId === 'food-spaces') {
    return (
      <table className={styles.factTable}>
        <thead><tr><th>App label</th><th>Inventory storage key</th></tr></thead>
        <tbody>
          {EVERSHELF_FOOD_SPACES.map((space) => <tr key={space.location}><td>{space.title}</td><td>{space.location}</td></tr>)}
        </tbody>
      </table>
    )
  }

  if (factId === 'app-routes') {
    const primaryPaths = [...new Set(DASHBOARD_ROUTES
      .filter((route) => route.path !== APP_MANUAL_ROUTE_PATH)
      .map((route) => primaryNavPathForRoute(route.path)))]
    const groups = primaryPaths.map((primaryPath) => ({
      primaryPath,
      routes: DASHBOARD_ROUTES.filter((route) => route.path !== APP_MANUAL_ROUTE_PATH && primaryNavPathForRoute(route.path) === primaryPath),
    }))
    return (
      <div className={styles.factList}>
        {groups.map((group) => (
          <details className={styles.details} key={group.primaryPath}>
            <summary>{DASHBOARD_ROUTES.find((route) => route.path === group.primaryPath)?.title ?? group.primaryPath} ({group.routes.length})</summary>
            <ul>{group.routes.map((route) => <li key={route.path}>{route.title} - {route.path}</li>)}</ul>
          </details>
        ))}
      </div>
    )
  }

  if (factId === 'app-rooms') {
    return (
      <div className={styles.factList}>
        {Object.values(ROOM_PAGE_CONFIGS).map((room) => (
          <div className={styles.roomCard} key={room.path}>
            <strong>{room.title}</strong>
            <small>{room.overviewCards.length} header summaries - {room.sourceSections.flatMap((section) => section.cards).length} body controls</small>
          </div>
        ))}
      </div>
    )
  }

  if (factId === 'device-families') {
    const kinds = [...new Set(Object.values(ROOM_PAGE_CONFIGS).flatMap((room) => [
      ...room.overviewCards.map((card) => card.kind),
      ...room.sourceSections.flatMap((section) => section.cards.map((card) => card.kind)),
    ]))].sort()
    return <div className={styles.factList}>{kinds.map((kind) => <div className={styles.roomCard} key={kind}><strong>{kind.replace('-', ' ')}</strong><small>Configured room control family</small></div>)}</div>
  }

  if (factId === 'integration-catalog') {
    return (
      <div className={styles.factList}>
        <Description>Last audited: {new Date(MANUAL_HA_SUMMARY.generatedAt).toLocaleDateString(undefined, { timeZone: 'UTC' })} - {MANUAL_HA_SUMMARY.counts.integrationInstances} configured instances across {MANUAL_HA_SUMMARY.counts.integrationDomains} domains. Exact internal identifiers stay in the non-deployed release audit.</Description>
        <table className={styles.factTable}>
          <thead><tr><th>Integration group</th><th>Domains</th><th>Instances</th></tr></thead>
          <tbody>
            {MANUAL_HA_SUMMARY.integrationCategories.map((item) => <tr key={item.category}><td>{item.category}</td><td>{item.count}</td><td>{item.instances}</td></tr>)}
          </tbody>
        </table>
      </div>
    )
  }

  if (factId === 'automation-catalog' || factId === 'script-catalog') {
    const domain = factId === 'automation-catalog' ? 'automation.' : 'script.'
    const items = Object.values(hassEntities)
      .filter((entity) => entity.entity_id.startsWith(domain))
      .map((entity) => {
        const name = typeof entity.attributes.friendly_name === 'string' ? entity.attributes.friendly_name : entity.entity_id
        return { category: liveCatalogCategory(`${entity.entity_id} ${name}`), id: entity.entity_id, name }
      })
      .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name))
    const auditedCount = factId === 'automation-catalog' ? MANUAL_HA_SUMMARY.counts.automations : MANUAL_HA_SUMMARY.counts.scripts
    return (
      <div className={styles.factList}>
        <Description>{auditedCount} items in the last release audit. The list below is read from the current authenticated Home Assistant session and may be shorter when the connection is unavailable.</Description>
        {groupedCatalog(items).map((group) => (
          <details className={styles.details} key={group.category}>
            <summary>{group.category} ({group.items.length})</summary>
            <ul>{group.items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
          </details>
        ))}
      </div>
    )
  }

  if (factId === 'wip-dependencies') {
    return (
      <table className={styles.factTable}>
        <thead><tr><th>Capability</th><th>Required service</th><th>Snapshot status</th></tr></thead>
        <tbody>
          <tr><td>Recipes</td><td>Recipe query service</td><td>{MANUAL_HA_SUMMARY.expectedDependencies.recipeQuery ? 'Available' : 'Expected missing'}</td></tr>
          <tr><td>Recipes</td><td>Recipe hydration service</td><td>{MANUAL_HA_SUMMARY.expectedDependencies.recipeHydration ? 'Available' : 'Expected missing'}</td></tr>
          <tr><td>Recipe Details</td><td>Recipe detail service</td><td>{MANUAL_HA_SUMMARY.expectedDependencies.recipeDetail ? 'Available' : 'Expected missing'}</td></tr>
          <tr><td>Recipe Groceries</td><td>Recipe grocery service</td><td>{MANUAL_HA_SUMMARY.expectedDependencies.recipeGroceryAdd ? 'Available' : 'Expected missing'}</td></tr>
          <tr><td>Vacuum Area Cleaning</td><td>Three clean-zone scripts</td><td>{MANUAL_HA_SUMMARY.expectedDependencies.vacuumAreaScripts ? 'Available' : 'Expected missing'}</td></tr>
        </tbody>
      </table>
    )
  }

  return null
}

function RoomReference({ navigate, roomPath }: { navigate: (selection: ManualSelection, replace?: boolean) => void; roomPath: string }) {
  const room = ROOM_PAGE_CONFIGS[roomPath]
  if (!room) return null
  const roomCard = (card: (typeof room.overviewCards)[number]) => {
    const article = MANUAL_ARTICLES_BY_ID.get(roomCardFamilyArticleId(card.kind))
    const description = roomReferenceInteractionDescription(card)
    if (!article) return <div className={styles.roomCard} data-manual-room-reference-card="true" key={`${card.title}-${card.entityId}`}><strong>{card.title}</strong><small>{description} · {card.kind}</small></div>
    return (
      <button className={`${styles.roomCard} ${styles.roomCardButton}`} data-manual-family-kind={card.kind} data-manual-room-reference-card="true" key={`${card.title}-${card.entityId}`} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} type="button">
        <strong>{card.title}</strong>
        <small>{description} · Open the shared {article.title} guide. · {card.kind}</small>
      </button>
    )
  }
  return (
    <div className={styles.articleBlocks} data-manual-room-reference={room.path}>
      <Description>This inventory is generated from the current room configuration. Its interaction labels distinguish detail openers, immediate commands, state-dependent commands, and cards that only report status.</Description>
      <section className={styles.roomSection}>
        <SectionHeader title="Header Summaries" />
        <div className={styles.roomCards}>
          {room.overviewCards.map(roomCard)}
        </div>
      </section>
      {room.sourceSections.map((section) => (
        <section className={styles.roomSection} key={section.title}>
          <SectionHeader title={section.title} />
          <div className={styles.roomCards}>
            {section.cards.map(roomCard)}
          </div>
        </section>
      ))}
    </div>
  )
}

function ManualBlockView({ block, eagerScreenshot, navigate }: { block: ManualBlock; eagerScreenshot: boolean; navigate: (selection: ManualSelection, replace?: boolean) => void }) {
  if (block.type === 'paragraph') return <Description>{manualDisplayText(block.text)}</Description>
  if (block.type === 'screenshot') return <ManualScreenshot eager={eagerScreenshot} id={block.screenshotId} />
  if (block.type === 'callout') return <div className={styles.callout} data-tone={block.tone} role="note"><strong>{block.title}</strong><span>{manualDisplayText(block.text)}</span></div>
  if (block.type === 'fact') return <section className={styles.factGroup}><SectionHeader title={block.title} /><ManualFact factId={block.factId} /></section>
  if (block.type === 'room-reference') return <RoomReference navigate={navigate} roomPath={block.roomPath} />
  if (block.type === 'overview-purpose' || block.type === 'overview-actions' || block.type === 'overview-automation' || block.type === 'overview-first-look' || block.type === 'overview-safety') return null
  return (
    <section className={styles.block}>
      <SectionHeader title={block.title} />
      {block.type === 'steps'
        ? <ol className={styles.steps}>{block.items.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ol>
        : <ul className={styles.bullets}>{block.items.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ul>}
    </section>
  )
}

function ManualPageGuideContent({ article, navigate }: { article: ManualPageGuideArticle; navigate: (selection: ManualSelection, replace?: boolean) => void }) {
  const guide = article.pageGuide
  const [orientationScreenshot, ...supportingScreenshots] = guide.screenshotIds
  return (
    <div className={styles.articleBlocks} data-manual-page-guide={guide.routePath}>
      <section className={styles.block} data-manual-page-guide-block="orientation">
        <SectionHeader title="What this page is for" />
        <Description>{manualDisplayText(guide.orientation)}</Description>
      </section>
      <ManualScreenshot eager id={orientationScreenshot} />
      <section className={styles.block} data-manual-page-guide-block="visible-sections">
        <SectionHeader title="What you'll find" />
        <ul className={styles.bullets}>{guide.visiblePageSectionNames.map((name) => <li key={name}>{manualDisplayText(name)}</li>)}</ul>
      </section>
      <section className={styles.block} data-manual-page-guide-block="actions">
        <SectionHeader title="What you can do" />
        <ul className={styles.bullets}>{guide.whatYouCanDo.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ul>
      </section>
      <section className={styles.block} data-manual-page-guide-block="automation">
        <SectionHeader title="What happens automatically" />
        {guide.whatHappensAutomatically.mode === 'automatic'
          ? <ul className={styles.bullets}>{guide.whatHappensAutomatically.items.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ul>
          : <Description>{manualDisplayText(guide.whatHappensAutomatically.explanation)}</Description>}
      </section>
      <section className={styles.block} data-manual-page-guide-block="first-look">
        <SectionHeader title="Look here first" />
        <div className={styles.overviewCards}>
          {guide.lookHereFirst.map((item) => (
            <div className={styles.overviewCard} data-manual-page-guide-first-look="true" key={item.label}>
              <strong>{item.label}</strong>
              <span>{manualDisplayText(item.explanation)}</span>
            </div>
          ))}
        </div>
      </section>
      {supportingScreenshots.map((id) => <ManualScreenshot id={id} key={id} />)}
      <div className={styles.callout} data-manual-page-guide-block="safety" data-tone="warning" role="note">
        <strong>{guide.safetyAndLimitations.title}</strong>
        <span>{manualDisplayText(guide.safetyAndLimitations.text)}</span>
      </div>
      <section className={styles.block} data-manual-page-guide-block="troubleshooting">
        <SectionHeader title="Troubleshooting" />
        <ol className={styles.steps}>{guide.troubleshootingChecks.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ol>
      </section>
      {guide.generatedRoomPath && (
        <section className={styles.roomAppendix} data-manual-page-guide-block="configured-controls-reference">
          <SectionHeader title="Configured Controls Reference" />
          <RoomReference navigate={navigate} roomPath={guide.generatedRoomPath} />
        </section>
      )}
    </div>
  )
}

function ManualFamilyGuideContent({ article }: { article: ManualFamilyGuideArticle }) {
  const guide = article.familyGuide
  const [orientationScreenshot, ...supportingScreenshots] = guide.screenshotIds
  return (
    <div className={styles.articleBlocks} data-manual-family-guide={guide.cardKind}>
      <section className={styles.block} data-manual-family-guide-block="purpose">
        <SectionHeader title="What this card does" />
        <Description>{manualDisplayText(guide.purpose)}</Description>
      </section>
      <section className={styles.block} data-manual-family-guide-block="appears-on">
        <SectionHeader title="Where you'll see it" />
        <ul className={styles.bullets}>{guide.appearsOn.routeTypes.map((routeType) => <li key={routeType}>{routeType}</li>)}</ul>
        <Description>{manualDisplayText(guide.appearsOn.explanation)}</Description>
      </section>
      <ManualScreenshot eager id={orientationScreenshot} />
      <section className={styles.block} data-manual-family-guide-block="actions">
        <SectionHeader title="What tapping it does" />
        <ul className={styles.bullets}>{guide.actionSemantics.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ul>
      </section>
      <section className={styles.block} data-manual-family-guide-block="states">
        <SectionHeader title="What each label means" />
        <div className={styles.overviewCards}>
          {guide.persistentStateMeanings.map((item) => (
            <div className={styles.overviewCard} data-manual-family-state="true" key={item.label}>
              <strong>{item.label}</strong>
              <span>{manualDisplayText(item.meaning)}</span>
            </div>
          ))}
        </div>
      </section>
      {supportingScreenshots.map((id) => <ManualScreenshot id={id} key={id} />)}
      <section className={styles.block} data-manual-family-guide-block="unavailable">
        <SectionHeader title="When it is unavailable" />
        <Description>{manualDisplayText(guide.unavailableAndDisabledBehavior)}</Description>
      </section>
      <section className={styles.block} data-manual-family-guide-block="optimistic">
        <SectionHeader title="After you tap" />
        <Description>{manualDisplayText(guide.optimisticAndConfirmationBehavior)}</Description>
      </section>
      <div className={styles.callout} data-manual-family-guide-block="safety" data-tone="warning" role="note">
        <strong>{guide.safetyAndLimitations.title}</strong>
        <span>{manualDisplayText(guide.safetyAndLimitations.text)}</span>
      </div>
      <section className={styles.block} data-manual-family-guide-block="troubleshooting">
        <SectionHeader title="Troubleshooting" />
        <ol className={styles.steps}>{guide.troubleshootingChecks.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ol>
      </section>
    </div>
  )
}

function ManualSurfaceNavigationItems({ items, title }: { items: readonly ManualSurfaceGuideNavigationItem[]; title: string }) {
  if (items.length === 0) return null
  return (
    <section className={styles.block} data-manual-surface-guide-navigation={title.toLowerCase().replaceAll(' ', '-')}>
      <SectionHeader title={title} />
      <div className={styles.overviewCards}>
        {items.map((entry) => (
          <div className={styles.overviewCard} data-manual-surface-navigation-item={entry.surfaceId} key={entry.surfaceId}>
            <strong>{entry.label}</strong>
            <span>{manualDisplayText(entry.explanation)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ManualSurfaceGuideContent({ article }: { article: ManualSurfaceGuideArticle }) {
  const guide = article.surfaceGuide
  const [orientationScreenshot, ...supportingScreenshots] = guide.screenshotIds
  return (
    <div className={styles.articleBlocks} data-manual-surface-guide={article.id}>
      <section className={styles.block} data-manual-surface-guide-block="open">
        <SectionHeader title="How to open" />
        <ol className={styles.steps}>{guide.howToOpen.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ol>
      </section>
      <ManualScreenshot eager id={orientationScreenshot} />
      <section className={styles.block} data-manual-surface-guide-block="contents">
        <SectionHeader title="What you'll find" />
        <ul className={styles.bullets}>{guide.contents.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
      </section>
      <section className={styles.block} data-manual-surface-guide-block="navigation">
        <SectionHeader title="Moving around inside" />
        <Description>{manualDisplayText(guide.navigation.explanation)}</Description>
      </section>
      <ManualSurfaceNavigationItems items={guide.navigation.tabs} title="Tabs" />
      <ManualSurfaceNavigationItems items={guide.navigation.detailPages} title="Detail Pages" />
      <ManualSurfaceNavigationItems items={guide.navigation.wizardSteps} title="Wizard Steps" />
      {supportingScreenshots.map((id) => <ManualScreenshot id={id} key={id} />)}
      <section className={styles.block} data-manual-surface-guide-block="close-back-cancel">
        <SectionHeader title="Close, back, or cancel" />
        <Description>{manualDisplayText(guide.closeBackCancelBehavior)}</Description>
      </section>
      <section className={styles.block} data-manual-surface-guide-block="state-disabled">
        <SectionHeader title="When controls are unavailable" />
        <Description>{manualDisplayText(guide.stateAndDisabledBehavior)}</Description>
      </section>
      <div className={styles.callout} data-manual-surface-guide-block="safety" data-tone="warning" role="note">
        <strong>{guide.safetyAndLimitations.title}</strong>
        <span>{manualDisplayText(guide.safetyAndLimitations.text)}</span>
      </div>
      <section className={styles.block} data-manual-surface-guide-block="troubleshooting">
        <SectionHeader title="Troubleshooting" />
        <ol className={styles.steps}>{guide.troubleshootingChecks.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ol>
      </section>
      <details className={styles.details} data-manual-surface-guide-block="home-assistant-ownership">
        <summary data-manual-visible-section="Behind the scenes">Behind the scenes</summary>
        <Description>{manualDisplayText(guide.homeAssistantOwnership)}</Description>
      </details>
    </div>
  )
}

function ManualBehaviorGuideContent({ article }: { article: ManualBehaviorGuideArticle }) {
  const guide = article.behaviorGuide
  return (
    <div className={styles.articleBlocks} data-manual-behavior-guide={article.id}>
      <section className={styles.block} data-manual-behavior-guide-block="capability">
        <SectionHeader title="What this does" />
        <Description>{manualDisplayText(guide.capability)}</Description>
      </section>
      <ManualBehaviorFlow article={article} />
      <section className={styles.block} data-manual-behavior-guide-block="override">
        <SectionHeader title="Pause, override, or recover" />
        <ol className={styles.steps}>{guide.overridePauseRecover.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ol>
      </section>
      {guide.screenshotIds.map((id) => <ManualScreenshot id={id} key={id} />)}
      <div className={styles.callout} data-manual-behavior-guide-block="safety" data-tone="warning" role="note">
        <strong>{guide.safetyAndLimitations.title}</strong>
        <span>{manualDisplayText(guide.safetyAndLimitations.text)}</span>
      </div>
      <section className={styles.block} data-manual-behavior-guide-block="troubleshooting">
        <SectionHeader title="Troubleshooting" />
        <ol className={styles.steps}>{guide.troubleshootingChecks.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ol>
      </section>
      <details className={styles.behindScenes} data-manual-behavior-guide-block="behind-scenes">
        <summary data-manual-visible-section="Behind the scenes">Behind the scenes</summary>
        <section className={styles.block} data-manual-behavior-guide-block="triggers">
          <SectionHeader title="When it happens" />
          <ul className={styles.bullets}>{guide.whenAndTriggers.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
        </section>
        <section className={styles.block} data-manual-behavior-guide-block="conditions">
          <SectionHeader title="What must be true" />
          <ul className={styles.bullets}>{guide.conditionsAndPreconditions.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
        </section>
        <section className={styles.block} data-manual-behavior-guide-block="effects">
          <SectionHeader title="What changes" />
          <ul className={styles.bullets}>{guide.householdEffects.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
        </section>
        <section className={styles.block} data-manual-behavior-guide-block="visible-signs">
          <SectionHeader title="What you'll notice" />
          <ul className={styles.bullets}>{guide.visibleAppSigns.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
        </section>
        <section className={styles.block} data-manual-behavior-guide-block="exceptions">
          <SectionHeader title="When house modes change the result" />
          <Description>{manualDisplayText(guide.exceptionsGuestVacationAway)}</Description>
        </section>
        <section className={styles.block} data-manual-behavior-guide-block="notifications">
          <SectionHeader title="Alerts you may see" />
          <Description>{manualDisplayText(guide.notifications)}</Description>
        </section>
        <section className={styles.block} data-manual-behavior-guide-block="affected-routes">
          <SectionHeader title="Where you'll notice it" />
          <ul className={styles.bullets}>
            {guide.affectedRoutes.map((path) => <li key={path}>{DASHBOARD_ROUTES.find((route) => route.path === path)?.title ?? path}</li>)}
          </ul>
        </section>
      </details>
    </div>
  )
}

function ManualTaskGuideContent({ article }: { article: ManualTaskGuideArticle }) {
  const guide = article.taskGuide
  return (
    <div className={styles.articleBlocks} data-manual-task-guide={article.id}>
      <div className={styles.taskQuestion}>{manualDisplayText(guide.canonicalQuestion)}</div>
      <ManualTaskPath article={article} />
      <section className={styles.block} data-manual-task-guide-block="prerequisites">
        <SectionHeader title="Before you start" />
        <ul className={styles.bullets}>{guide.prerequisites.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
      </section>
      <section className={styles.block} data-manual-task-guide-block="steps">
        <SectionHeader title="Steps" />
        <ol className={styles.steps}>{guide.steps.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ol>
      </section>
      <section className={styles.block} data-manual-task-guide-block="success">
        <SectionHeader title="What success looks like" />
        <ul className={styles.bullets}>{guide.successConfirmation.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
      </section>
      <section className={styles.block} data-manual-task-guide-block="back-cancel-close">
        <SectionHeader title="Back, cancel, or close" />
        <Description>{manualDisplayText(guide.backCancelClosePath)}</Description>
      </section>
      <section className={styles.block} data-manual-task-guide-block="failure">
        <SectionHeader title="If it does not work" />
        <ol className={styles.steps}>{guide.failureAndRecovery.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ol>
      </section>
      <section className={styles.block} data-manual-task-guide-block="automatic">
        <SectionHeader title="What happens automatically" />
        <ul className={styles.bullets}>{guide.automaticBehaviorAndSideEffects.map((entry) => <li key={entry}>{manualDisplayText(entry)}</li>)}</ul>
      </section>
      {guide.screenshotEvidence.screenshotIds.map((id) => <ManualScreenshot id={id} key={id} />)}
      {guide.screenshotEvidence.missingDedicatedScreenshot && (
        <div className={styles.callout} data-manual-task-guide-image-gap="true" data-tone="development" role="note">
          <strong>Image Still Needed</strong>
          <span>{guide.screenshotEvidence.missingDedicatedScreenshot}</span>
        </div>
      )}
      {guide.screenshotEvidence.nonvisualReason && (
        <div className={styles.callout} data-manual-task-guide-nonvisual="true" data-tone="info" role="note">
          <strong>No Screenshot Needed</strong>
          <span>{guide.screenshotEvidence.nonvisualReason}</span>
        </div>
      )}
      <div className={styles.callout} data-manual-task-guide-block="safety" data-tone="warning" role="note">
        <strong>{guide.safetyAndLimitations.title}</strong>
        <span>{manualDisplayText(guide.safetyAndLimitations.text)}</span>
      </div>
    </div>
  )
}

function ManualArticleView({ article, navigate }: { article: ManualArticle; navigate: (selection: ManualSelection, replace?: boolean) => void }) {
  const articleRef = useRef<HTMLElement>(null)
  const section = MANUAL_SECTIONS_BY_ID.get(article.sectionId)
  const firstScreenshotIndex = article.blocks.findIndex((block) => block.type === 'screenshot')
  const relatedArticleIds = article.kind === 'page-guide'
    ? article.pageGuide.relatedArticleIds
    : article.kind === 'family-guide'
      ? article.familyGuide.relatedArticleIds
      : article.kind === 'surface-guide'
        ? article.surfaceGuide.relatedArticleIds
        : article.kind === 'behavior-guide'
          ? article.behaviorGuide.relatedArticleIds
          : article.kind === 'task-guide'
            ? article.taskGuide.relatedArticleIds
      : article.relatedArticleIds
  return (
    <article className={styles.stack} data-manual-article={article.id} ref={articleRef}>
      <ManualBackButton label={`Back to ${section?.title ?? 'App Manual'}`} onClick={() => navigate({ sectionId: article.sectionId }, true)} />
      <header className={styles.articleHeader}>
        <span className={styles.eyebrow}>{section?.title} · {articleKindLabel(article)}</span>
        <h2 data-manual-view-heading="true" tabIndex={-1}>{article.title}</h2>
        <Description>{manualDisplayText(article.summary)}</Description>
        {statusLabel(article) && <span className={styles.status}>{statusLabel(article)}</span>}
      </header>
      <ManualArticleOutline article={article} getArticleElement={() => articleRef.current} />
      {article.kind === 'page-guide'
        ? <ManualPageGuideContent article={article} navigate={navigate} />
        : article.kind === 'family-guide'
          ? <ManualFamilyGuideContent article={article} />
          : article.kind === 'surface-guide'
            ? <ManualSurfaceGuideContent article={article} />
            : article.kind === 'behavior-guide'
              ? <ManualBehaviorGuideContent article={article} />
              : article.kind === 'task-guide'
                ? <ManualTaskGuideContent article={article} />
        : (
          <div className={styles.articleBlocks}>
            {article.blocks.map((block, index) => <ManualBlockView block={block} eagerScreenshot={index === firstScreenshotIndex} key={`${block.type}-${index}`} navigate={navigate} />)}
          </div>
        )}
      {relatedArticleIds && relatedArticleIds.length > 0 && (
        <section className={styles.relatedList}>
          <SectionHeader title="Related Guides" />
          {relatedArticleIds.map((id) => {
            const related = MANUAL_ARTICLES_BY_ID.get(id)
            return related ? <ManualRow article={related} key={id} onClick={() => navigate({ articleId: id, sectionId: related.sectionId })} /> : null
          })}
        </section>
      )}
      <ManualEndNavigation article={article} navigate={navigate} />
    </article>
  )
}

function ManualSectionOverview({ navigate, section }: { navigate: (selection: ManualSelection, replace?: boolean) => void; section: NonNullable<(typeof MANUAL_SECTIONS)[number]> }) {
  const landing = section.landing
  if (!landing) return null
  const canonical = MANUAL_ARTICLES_BY_ID.get(landing.canonicalArticleId)
  if (!canonical) return null
  const purpose = canonical.blocks.find((block) => block.type === 'overview-purpose')
  const actions = canonical.blocks.find((block) => block.type === 'overview-actions')
  const automation = canonical.blocks.find((block) => block.type === 'overview-automation')
  const firstLook = canonical.blocks.find((block) => block.type === 'overview-first-look')
  const safety = canonical.blocks.find((block) => block.type === 'overview-safety')
  const screenshots = canonical.blocks.flatMap((block) => block.type === 'screenshot' ? [block.screenshotId] : [])
  const contextScreenshot = screenshots.find((id) => manualScreenshotConfig(id)?.role === 'context')
  const stateScreenshots = screenshots.filter((id) => id !== contextScreenshot)
  const separatelyRenderedArticleIds = [canonical.id, ...(landing.technicalArticleIds ?? [])]
  const { groups: guideGroups, ungrouped } = resolveManualGuideGroups(section.id, landing.guideGroups, separatelyRenderedArticleIds)

  return (
    <div className={styles.sectionOverview} data-manual-section-overview={section.id}>
      {purpose?.type === 'overview-purpose' && <Description>{manualDisplayText(purpose.text)}</Description>}
      {contextScreenshot && <ManualScreenshot eager id={contextScreenshot} />}
      {actions?.type === 'overview-actions' && (
        <section className={styles.block} data-manual-block="actions">
          <SectionHeader title="What You Can Do" />
          <ul className={styles.bullets}>{actions.items.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ul>
        </section>
      )}
      <section className={styles.block} data-manual-block="common-tasks">
        <SectionHeader title="Common Tasks" />
        <Description className={styles.navigationHint}>These are shortcuts, not the end of the overview. Choose one now or keep reading below.</Description>
        <div className={styles.list}>
          {landing.commonTasks.map((task) => {
            const article = MANUAL_ARTICLES_BY_ID.get(task.articleId)
            return article ? (
              <button className={styles.taskRow} data-manual-common-task="true" data-manual-target-article={article.id} key={`${task.articleId}-${task.question}`} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} type="button">
                <span aria-hidden="true" className={styles.rowIcon}><MaterialIcon name={article.icon} size={24} /></span>
                <span className={styles.rowCopy}><strong>{task.question}</strong><small>{article.title}</small></span>
                <MaterialIcon name="mdi:chevron-right" size={22} />
              </button>
            ) : null
          })}
          <button className={styles.taskRow} onClick={() => navigate({ sectionId: 'how-to', taskSectionId: section.id })} type="button">
            <span aria-hidden="true" className={styles.rowIcon}><MaterialIcon name="mdi:help-circle-outline" size={24} /></span>
            <span className={styles.rowCopy}><strong>Browse every question in {section.title}</strong><small>Filtered to this area</small></span>
            <MaterialIcon name="mdi:chevron-right" size={22} />
          </button>
        </div>
        <div className={styles.continueCue}>Continue for automatic behavior, first places to look, safety notes, and every guide.</div>
      </section>
      {automation?.type === 'overview-automation' && (
        <section className={styles.block} data-manual-block="automation">
          <SectionHeader title="What Happens Automatically" />
          <ul className={styles.bullets}>{automation.items.map((item) => <li key={item}>{manualDisplayText(item)}</li>)}</ul>
        </section>
      )}
      {firstLook?.type === 'overview-first-look' && (
        <section className={styles.block} data-manual-block="first-look">
          <SectionHeader title="Look Here First" />
          <div className={styles.overviewCards}>
            {firstLook.items.map((item) => <div className={styles.overviewCard} data-manual-first-look="true" key={item.label}><strong>{item.label}</strong><span>{manualDisplayText(item.text)}</span></div>)}
          </div>
        </section>
      )}
      {stateScreenshots.map((id) => <ManualScreenshot id={id} key={id} />)}
      {safety?.type === 'overview-safety' && <div className={styles.callout} data-manual-block="safety" data-tone="warning" role="note"><strong>{safety.title}</strong><span>{manualDisplayText(safety.text)}</span></div>}
      {(guideGroups.length > 0 || ungrouped.length > 0) && (
        <section className={styles.block} data-manual-block="guides" data-manual-guide-browser={section.id}>
          <SectionHeader title="Browse Guides" />
          <ManualGuideGroups groups={guideGroups} navigate={navigate} ungrouped={ungrouped} />
        </section>
      )}
      {MANUAL_ARTICLES_BY_ID.get(landing.troubleshootingArticleId) && (
        <section className={styles.block} data-manual-block="troubleshooting">
          <SectionHeader title="When Something Looks Wrong" />
          <ManualRow article={MANUAL_ARTICLES_BY_ID.get(landing.troubleshootingArticleId) as ManualArticle} onClick={() => navigate({ articleId: landing.troubleshootingArticleId, sectionId: 'help' })} />
        </section>
      )}
      {landing.relatedSectionIds && landing.relatedSectionIds.length > 0 && (
        <section className={styles.block} data-manual-block="related-areas">
          <SectionHeader title="Related Areas" />
          <div className={styles.relatedSections}>
            {landing.relatedSectionIds.map((id) => {
              const related = MANUAL_SECTIONS_BY_ID.get(id)
              return related ? <button className={styles.backButton} key={id} onClick={() => navigate({ sectionId: id })} type="button">{related.title}</button> : null
            })}
          </div>
        </section>
      )}
      {landing.technicalArticleIds && landing.technicalArticleIds.length > 0 && (
        <details className={styles.details} data-manual-block="technical-details" data-manual-guide-group={landing.technicalDetailsTitle ?? 'Technical Details'}>
          <summary>{landing.technicalDetailsTitle ?? 'Technical Details'} ({landing.technicalArticleIds.length})</summary>
          <div className={styles.detailsList}>{landing.technicalArticleIds.map((id) => {
            const article = MANUAL_ARTICLES_BY_ID.get(id)
            return article ? <ManualRow article={article} key={id} onClick={() => navigate({ articleId: id, sectionId: article.sectionId })} /> : null
          })}</div>
        </details>
      )}
    </div>
  )
}

function ManualSectionView({ sectionId, taskSectionId, navigate }: { sectionId: ManualSectionId; taskSectionId?: string; navigate: (selection: ManualSelection, replace?: boolean) => void }) {
  if (sectionId === 'how-to') {
    const taskSection = taskSectionId ? MANUAL_SECTIONS_BY_ID.get(taskSectionId as ManualSectionId) : undefined
    const tasks = manualTaskEntries()
      .filter(({ article }) => !taskSection || article.sectionId === taskSection.id)
      .sort((left, right) => left.task.localeCompare(right.task))
    return (
      <section className={styles.stack}>
        <ManualBackButton label={taskSection ? `Back to ${taskSection.title}` : 'Back to App Manual'} onClick={() => navigate(taskSection ? { sectionId: taskSection.id } : {}, true)} />
        <header className={styles.sectionIntro}>
          {taskSection && <span className={styles.eyebrow}>{taskSection.title}</span>}
          <h2 data-manual-view-heading="true" tabIndex={-1}>How Do I...?</h2>
          <Description>{taskSection ? `Showing questions about ${taskSection.title}.` : 'Find step-by-step answers using the words you would naturally ask.'}</Description>
        </header>
        <div className={styles.list}>
          {tasks.map(({ article, task }) => (
            <button className={styles.taskRow} data-manual-question="true" key={`${article.id}-${task}`} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} type="button">
              <span aria-hidden="true" className={styles.rowIcon}><MaterialIcon name={article.icon} size={24} /></span>
              <span className={styles.rowCopy}><strong>{task}</strong><small>{article.title}</small></span>
              <MaterialIcon name="mdi:chevron-right" size={22} />
            </button>
          ))}
        </div>
      </section>
    )
  }

  const section = MANUAL_SECTIONS_BY_ID.get(sectionId)
  const articles = manualArticlesForSection(sectionId)
  if (!section) return null

  if (section.landing) {
    return (
      <section className={styles.stack}>
        <ManualBackButton label="Back to App Manual" onClick={() => navigate({}, true)} />
        <header className={styles.sectionIntro}><h2 data-manual-view-heading="true" tabIndex={-1}>{section.title}</h2><Description>{section.summary}</Description></header>
        <ManualSectionOverview navigate={navigate} section={section} />
      </section>
    )
  }

  if (section.browseGroups) {
    const { groups, ungrouped } = resolveManualGuideGroups(section.id, section.browseGroups)
    return (
      <section className={styles.stack}>
        <ManualBackButton label="Back to App Manual" onClick={() => navigate({}, true)} />
        <header className={styles.sectionIntro}><h2 data-manual-view-heading="true" tabIndex={-1}>{section.title}</h2><Description>{section.summary}</Description></header>
        <div className={styles.groupedSection} data-manual-grouped-section={section.id}>
          <ManualGuideGroups groups={groups} navigate={navigate} ungrouped={ungrouped} />
        </div>
      </section>
    )
  }

  return (
    <section className={styles.stack}>
      <ManualBackButton label="Back to App Manual" onClick={() => navigate({}, true)} />
      <header className={styles.sectionIntro}><h2 data-manual-view-heading="true" tabIndex={-1}>{section.title}</h2><Description>{section.summary}</Description></header>
      <div className={styles.list}>
        {articles.map((article) => <ManualRow article={article} key={article.id} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} />)}
      </div>
    </section>
  )
}

function ManualHome({ navigate }: { navigate: (selection: ManualSelection, replace?: boolean) => void }) {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizedSearchText(query)
  const results = useMemo(() => {
    if (!normalizedQuery) return []
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean)
    return MANUAL_ARTICLES
      .filter((article) => {
        const articleText = searchArticleText(article)
        return queryTokens.every((token) => articleText.includes(token))
      })
  }, [normalizedQuery])

  return (
    <div className={styles.stack}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Home Assistant and React Dash</span>
          <h2 className={styles.title} data-manual-view-heading="true" tabIndex={-1}>Find an answer without knowing the technical name.</h2>
          <Description>Search a question, browse the app, or learn what Home Assistant is doing behind the scenes.</Description>
        </div>
        <label className={styles.searchShell}>
          <MaterialIcon name="mdi:magnify" size={22} />
          <input aria-label="Search the App Manual" onChange={(event) => setQuery(event.target.value)} placeholder="How do I schedule the humidifier?" type="search" value={query} />
        </label>
      </section>

      {normalizedQuery ? (
        <section className={styles.searchResults} aria-label="Manual search results">
          <SectionHeader title={`Search Results (${results.length})`} />
          {results.length > 0
            ? results.map((article) => <ManualRow article={article} key={article.id} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} />)
            : <p className={styles.empty}>No manual article matched that question.</p>}
        </section>
      ) : (
        <>
          <section className={styles.stack}>
            <SectionHeader title="Browse the Manual" />
            <div aria-label="App Manual sections" className={styles.sectionShortcutGrid} role="group">
              {MANUAL_SECTIONS.map((section) => (
                <button
                  aria-label={`${section.title}. ${section.summary}`}
                  key={section.id}
                  onClick={() => navigate({ sectionId: section.id })}
                  style={{ '--manual-section-color': section.backgroundColor } as CSSProperties}
                  type="button"
                >
                  <MaterialIcon name={section.icon} size={24} />
                  <strong>{section.title}</strong>
                </button>
              ))}
            </div>
          </section>
          <section className={styles.stack} aria-label="Popular questions">
            <SectionHeader title="Popular Questions" />
            <div className={styles.pinnedGrid}>
              {[
                ['What are the status chips?', 'status-chips'],
                ['Which rooms have lights on?', 'status-lights'],
                ['How do I schedule the humidifier?', 'humidifier-schedule'],
              ].map(([task, id]) => {
                const article = MANUAL_ARTICLES_BY_ID.get(id)
                return article ? (
                  <button className={styles.taskRow} key={task} onClick={() => navigate({ articleId: article.id, sectionId: article.sectionId })} type="button">
                    <span aria-hidden="true" className={styles.rowIcon}><MaterialIcon name={article.icon} size={24} /></span>
                    <span className={styles.rowCopy}><strong>{task}</strong><small>{article.title}</small></span>
                    <MaterialIcon name="mdi:chevron-right" size={22} />
                  </button>
                ) : null
              })}
              <button className={styles.taskRow} onClick={() => navigate({ sectionId: 'how-to' })} type="button">
                <span aria-hidden="true" className={styles.rowIcon}><MaterialIcon name="mdi:help-circle-outline" size={24} /></span>
                <span className={styles.rowCopy}><strong>Browse every How Do I...? question</strong><small>Generated from all manual guides</small></span>
                <MaterialIcon name="mdi:chevron-right" size={22} />
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function AppManualInteractive() {
  const [selection, setSelection] = useState(() => canonicalManualSelection(manualSelectionFromUrl(dashboardHref())))
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollToTop = usePageScrollToTop()

  useEffect(() => {
    const sync = () => {
      const href = dashboardHref()
      const requestedSelection = manualSelectionFromUrl(href)
      const nextSelection = canonicalManualSelection(requestedSelection)
      setSelection(nextSelection)
      if (requestedSelection.articleId && !nextSelection.articleId) replaceDashboardUrl(manualUrl(href, nextSelection))
    }
    sync()
    const targets = dashboardEventTargets()
    for (const target of targets) {
      target.addEventListener('popstate', sync)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, sync)
    }
    return () => {
      for (const target of targets) {
        target.removeEventListener('popstate', sync)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, sync)
      }
    }
  }, [])

  useLayoutEffect(() => {
    scrollToTop?.()
    const frame = window.requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>('[data-manual-view-heading="true"]')?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [scrollToTop, selection.articleId, selection.sectionId, selection.taskSectionId])

  const navigate = (nextSelection: ManualSelection, replace = false) => {
    const resolvedSelection = canonicalManualSelection(nextSelection)
    const url = manualUrl(dashboardHref(), resolvedSelection)
    setSelection(resolvedSelection)
    if (replace) replaceDashboardUrl(url)
    else pushDashboardUrl(url)
  }

  const article = selection.articleId ? MANUAL_ARTICLES_BY_ID.get(selection.articleId) : undefined
  const legacySections: Record<string, ManualSectionId> = {
    automation: 'help',
    browse: 'rooms',
    devices: 'rooms',
    integrations: 'help',
    layout: 'start',
    reference: 'help',
    systems: 'home',
  }
  const requestedSection = selection.sectionId ? legacySections[selection.sectionId] ?? selection.sectionId as ManualSectionId : undefined
  const sectionId = requestedSection === 'how-to' || (requestedSection && MANUAL_SECTIONS_BY_ID.has(requestedSection))
    ? requestedSection
    : undefined
  const canonicalSection = article ? MANUAL_SECTIONS.find((section) => section.landing?.canonicalArticleId === article.id) : undefined

  const content = canonicalSection
    ? <ManualSectionView navigate={navigate} sectionId={canonicalSection.id} />
    : article
      ? <ManualArticleView article={article} navigate={navigate} />
      : sectionId
        ? <ManualSectionView navigate={navigate} sectionId={sectionId} taskSectionId={selection.taskSectionId} />
      : <ManualHome navigate={navigate} />

  return <div ref={rootRef}>{content}</div>
}

export function AppManualPage({ preload = false }: { preload?: boolean }) {
  return preload ? <ManualPreload /> : <AppManualInteractive />
}
