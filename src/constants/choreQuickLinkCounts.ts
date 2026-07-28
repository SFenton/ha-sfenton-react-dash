import { TODO_PAGES, type TodoCountBucket } from './portedDashboard'

export interface ChoreQuickLinkCounts {
  /** Past-due tasks. */
  overdue: number
  /** Tasks due today or later. */
  upcoming: number
  /** Tasks with no due date at all. */
  noDueDate: number
  /** Every open task on the page, regardless of bucket. */
  total: number
}

const EMPTY_COUNTS: ChoreQuickLinkCounts = { overdue: 0, upcoming: 0, noDueDate: 0, total: 0 }

const BUCKET_KEYS: Record<TodoCountBucket, keyof Omit<ChoreQuickLinkCounts, 'total'>> = {
  overdue: 'overdue',
  upcoming: 'upcoming',
  'no-due-date': 'noDueDate',
}

type EntityStateLookup = Record<string, { state?: string | number } | undefined>

function openItemCount(entities: EntityStateLookup, entityId: string) {
  const value = Number(entities[entityId]?.state ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function choreQuickLinkCounts(path: string, entities: EntityStateLookup): ChoreQuickLinkCounts {
  const page = TODO_PAGES[path]
  if (!page) return EMPTY_COUNTS

  return page.lists.reduce<ChoreQuickLinkCounts>(
    (counts, list) => {
      const count = openItemCount(entities, list.entityId)
      if (list.countBucket) counts[BUCKET_KEYS[list.countBucket]] += count
      counts.total += count
      return counts
    },
    { ...EMPTY_COUNTS },
  )
}

function pluralized(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

/**
 * Summarizes a chore quick link as "what needs attention" rather than a raw total.
 * Overdue outranks upcoming, and undated tasks are appended as a second clause.
 */
export function choreQuickLinkSubtitle({ noDueDate, overdue, upcoming }: ChoreQuickLinkCounts) {
  const dated = overdue > 0 ? pluralized(overdue, 'overdue task', 'overdue tasks') : upcoming > 0 ? pluralized(upcoming, 'upcoming task', 'upcoming tasks') : ''
  const undated = noDueDate > 0 ? pluralized(noDueDate, 'task listed', 'tasks listed') : ''

  if (dated && undated) return `${dated} · ${undated}`
  return dated || undated || 'No tasks listed'
}

export function groceryCountSubtitle(count: number) {
  if (!Number.isFinite(count) || count <= 0) return 'No groceries listed'
  return pluralized(count, 'item', 'items')
}
