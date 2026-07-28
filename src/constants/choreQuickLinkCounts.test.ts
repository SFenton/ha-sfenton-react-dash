import { describe, expect, it } from 'vitest'
import { choreQuickLinkCounts, choreQuickLinkSubtitle, groceryCountSubtitle } from './choreQuickLinkCounts'

function counts(overdue: number, upcoming: number, noDueDate: number) {
  return { overdue, upcoming, noDueDate, total: overdue + upcoming + noDueDate }
}

describe('choreQuickLinkSubtitle', () => {
  it('falls back to a no-tasks sentence when every bucket is empty', () => {
    expect(choreQuickLinkSubtitle(counts(0, 0, 0))).toBe('No tasks listed')
  })

  it('shows only undated tasks when nothing has a due date', () => {
    expect(choreQuickLinkSubtitle(counts(0, 0, 1))).toBe('1 task listed')
    expect(choreQuickLinkSubtitle(counts(0, 0, 6))).toBe('6 tasks listed')
  })

  it('shows upcoming tasks when nothing is overdue', () => {
    expect(choreQuickLinkSubtitle(counts(0, 1, 0))).toBe('1 upcoming task')
    expect(choreQuickLinkSubtitle(counts(0, 4, 0))).toBe('4 upcoming tasks')
    expect(choreQuickLinkSubtitle(counts(0, 2, 1))).toBe('2 upcoming tasks · 1 task listed')
  })

  it('prefers overdue over upcoming and never shows both', () => {
    expect(choreQuickLinkSubtitle(counts(1, 0, 0))).toBe('1 overdue task')
    expect(choreQuickLinkSubtitle(counts(3, 9, 0))).toBe('3 overdue tasks')
    expect(choreQuickLinkSubtitle(counts(1, 6, 6))).toBe('1 overdue task · 6 tasks listed')
  })
})

describe('choreQuickLinkCounts', () => {
  it('buckets past due, due today plus upcoming, and undated lists separately', () => {
    const entities = {
      'todo.stephen_s_past_due': { state: '2' },
      'todo.stephen_s_due_today': { state: '3' },
      'todo.stephen_s_upcoming': { state: '1' },
      'todo.stephen_s_no_due_date': { state: '5' },
    }

    expect(choreQuickLinkCounts('stephens-chores', entities)).toEqual({ overdue: 2, upcoming: 4, noDueDate: 5, total: 11 })
  })

  it('treats missing and non-numeric states as zero', () => {
    const entities = { 'todo.unassigned_past_due': { state: 'unavailable' }, 'todo.unassigned_due_today': { state: '-2' } }

    expect(choreQuickLinkCounts('unassigned-chores', entities)).toEqual({ overdue: 0, upcoming: 0, noDueDate: 0, total: 0 })
  })

  it('counts unbucketed lists toward the total only, so groceries still tally', () => {
    expect(choreQuickLinkCounts('groceries', { 'todo.shopping_list': { state: '7' } })).toEqual({ overdue: 0, upcoming: 0, noDueDate: 0, total: 7 })
  })

  it('returns empty counts for an unknown page', () => {
    expect(choreQuickLinkCounts('not-a-page', {})).toEqual({ overdue: 0, upcoming: 0, noDueDate: 0, total: 0 })
  })
})

describe('groceryCountSubtitle', () => {
  it('keeps the grocery item wording', () => {
    expect(groceryCountSubtitle(0)).toBe('No groceries listed')
    expect(groceryCountSubtitle(1)).toBe('1 item')
    expect(groceryCountSubtitle(7)).toBe('7 items')
  })
})
