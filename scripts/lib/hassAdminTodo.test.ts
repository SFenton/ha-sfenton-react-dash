import { adminCompletionBoundarySatisfied, HassAdminTodoClient } from './hassAdminTodo'

describe('HassAdminTodoClient', () => {
  it('reads todo items through the Home Assistant return-response service API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      changed_states: [],
      service_response: {
        'todo.groceries': {
          items: [{ status: 'needs_action', summary: 'Admin task', uid: 'task-1' }],
        },
      },
    }), { status: 200 }))
    const client = new HassAdminTodoClient({ token: 'secret', url: 'http://ha.local:8123' }, fetchMock)

    await expect(client.getItems('todo.groceries')).resolves.toEqual([
      { status: 'needs_action', summary: 'Admin task', uid: 'task-1' },
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ha.local:8123/api/services/todo/get_items?return_response',
      expect.objectContaining({
        body: JSON.stringify({ entity_id: 'todo.groceries' }),
        method: 'POST',
      }),
    )
  })

  it('completes an item through the HA-owned completion script', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('[]', { status: 200 }))
    const client = new HassAdminTodoClient({ token: 'secret', url: 'http://ha.local:8123' }, fetchMock)

    await client.completeItem('script.complete_admin_todo_item', 'task-1')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ha.local:8123/api/services/script/complete_admin_todo_item',
      expect.objectContaining({
        body: JSON.stringify({ item: 'task-1' }),
        method: 'POST',
      }),
    )
  })

  it('reads the HA completion receipt helper state', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      entity_id: 'input_text.admin_todo_completion_receipt',
      state: 'task-1',
    }), { status: 200 }))
    const client = new HassAdminTodoClient({ token: 'secret', url: 'http://ha.local:8123' }, fetchMock)

    await expect(client.getState('input_text.admin_todo_completion_receipt')).resolves.toMatchObject({
      state: 'task-1',
    })
  })

  it('requires both completed todo state and the matching completion receipt', () => {
    expect(adminCompletionBoundarySatisfied('needs_action', 'task-1', 'task-1')).toBe(false)
    expect(adminCompletionBoundarySatisfied('completed', 'another-task', 'task-1')).toBe(false)
    expect(adminCompletionBoundarySatisfied('completed', 'task-1', 'task-1')).toBe(true)
  })
})
