import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TodoListPanel } from './TodoListPanel'
import { entity, mockCallServiceCalls, mockEntities, mockTodoItemsByEntity, resetMockHass } from '../../test/mocks/hakitCoreState'

const ENTITY_ID = 'todo.optimistic_chores'

describe('TodoListPanel', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities[ENTITY_ID] = entity(ENTITY_ID, '2')
    mockTodoItemsByEntity[ENTITY_ID] = [
      { uid: 'first-chore', summary: 'First chore', status: 'needs_action' },
      { uid: 'second-chore', summary: 'Second chore', status: 'needs_action' },
    ]
  })

  afterEach(() => {
    delete mockEntities[ENTITY_ID]
  })

  it('keeps rapidly checked rows hidden while stale Home Assistant todo refreshes arrive', async () => {
    const view = render(<TodoListPanel entityId={ENTITY_ID} title="Optimistic Chores" />)

    fireEvent.click(await screen.findByRole('button', { name: 'First chore' }))
    fireEvent.click(screen.getByRole('button', { name: 'Second chore' }))

    expect(screen.queryByRole('button', { name: 'First chore' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Second chore' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'todo', service: 'update_item', target: ENTITY_ID, serviceData: { item: 'first-chore', status: 'completed' } },
      { domain: 'todo', service: 'update_item', target: ENTITY_ID, serviceData: { item: 'second-chore', status: 'completed' } },
    ])

    mockTodoItemsByEntity[ENTITY_ID] = [
      { uid: 'first-chore', summary: 'First chore', status: 'needs_action' },
      { uid: 'second-chore', summary: 'Second chore', status: 'needs_action' },
      { uid: 'third-chore', summary: 'Third chore', status: 'needs_action' },
    ]
    Object.assign(mockEntities[ENTITY_ID], { last_updated: '2026-07-07T23:58:00.000Z', state: '3' })
    view.rerender(<TodoListPanel entityId={ENTITY_ID} title="Optimistic Chores" />)

    expect(await screen.findByRole('button', { name: 'Third chore' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'First chore' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Second chore' })).not.toBeInTheDocument()
  })

  it('routes configured completions through the Home Assistant-owned completion script', async () => {
    render(
      <TodoListPanel
        completionScript="script.complete_admin_todo_item"
        entityId={ENTITY_ID}
        title="Admin To-Do"
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'First chore' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'complete_admin_todo_item',
        serviceData: { item: 'first-chore', task_name: 'First chore' },
      },
    ]))
  })
})
