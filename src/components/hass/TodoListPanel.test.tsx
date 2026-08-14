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
        serviceData: { item: 'first-chore' },
      },
    ]))
  })

  it('adds a separate edit action only when the caller enables DoneTick editing', async () => {
    mockTodoItemsByEntity[ENTITY_ID] = [
      { uid: '240--2026-08-03 16:30:00+00:00', summary: 'Editable chore', status: 'needs_action' },
    ]
    const onEditTask = vi.fn()

    const view = render(<TodoListPanel entityId={ENTITY_ID} onEditTask={onEditTask} title="Optimistic Chores" />)

    const editButton = await screen.findByRole('button', { name: 'Edit Editable chore' })
    fireEvent.click(editButton)

    expect(onEditTask).toHaveBeenCalledWith({
      itemUid: '240--2026-08-03 16:30:00+00:00',
      taskId: 240,
      todoEntityId: ENTITY_ID,
    })
    expect(mockCallServiceCalls).toEqual([])
    expect(screen.getByRole('button', { name: 'Editable chore' })).toHaveAttribute('aria-pressed', 'false')

    view.rerender(<TodoListPanel entityId={ENTITY_ID} title="Optimistic Chores" />)
    expect(screen.queryByRole('button', { name: 'Edit Editable chore' })).not.toBeInTheDocument()
  })

  it('puts generated battery levels in task titles and keeps due status in subtitles', async () => {
    mockTodoItemsByEntity[ENTITY_ID] = [
      {
        description: [
          'The Front Yard battery is at 10%.',
          '',
          'Area: Entryway.',
          '',
          'Home Assistant updates this task when the reported percentage changes.',
          '',
          'Maintenance reference: BATT-7FA024E8.',
        ].join('\n'),
        due: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'needs_action',
        summary: 'Replace Front Yard battery',
        uid: 'battery-replacement',
      },
      {
        description: [
          'The Aqara Smart Lock U400 battery is at 20%.',
          '',
          'Home Assistant updates this task when the reported percentage changes.',
          '',
          'Maintenance reference: BATT-68C6D9B6.',
        ].join('\n'),
        due: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
        status: 'needs_action',
        summary: 'Charge Aqara Smart Lock U400',
        uid: 'battery-charge',
      },
    ]

    render(<TodoListPanel entityId={ENTITY_ID} title="Optimistic Chores" />)

    expect(await screen.findByRole('button', { name: 'Replace Front Yard Battery · 10% 2 days overdue' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Charge Aqara Smart Lock U400 · 20% 7 hours overdue' })).toBeInTheDocument()
    expect(screen.getByText('Replace Front Yard Battery · 10%')).toBeInTheDocument()
    expect(screen.getByText('Charge Aqara Smart Lock U400 · 20%')).toBeInTheDocument()
    expect(screen.getByText('2 days overdue')).toBeInTheDocument()
    expect(screen.getByText('7 hours overdue')).toBeInTheDocument()
    expect(screen.queryByText(/Maintenance reference:/i)).not.toBeInTheDocument()
  })
})
