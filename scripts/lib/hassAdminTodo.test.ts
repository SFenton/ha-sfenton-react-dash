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

  it('reopens an already-completed item by exact UID and verifies needs_action', async () => {
    let status = 'completed'
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
      const path = String(input)
      if (path.endsWith('/api/services/todo/get_items?return_response')) {
        return new Response(JSON.stringify({
          service_response: {
            'todo.groceries': { items: [{ uid: 'task-1', summary: 'Updated task', status }] },
          },
        }), { status: 200 })
      }
      if (path.endsWith('/api/services/todo/update_item')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          entity_id: 'todo.groceries',
          item: 'task-1',
          status: 'needs_action',
        })
        status = 'needs_action'
        return new Response('[]', { status: 200 })
      }
      throw new Error(`Unexpected HA request: ${path}`)
    })
    const client = new HassAdminTodoClient({ token: 'test-token', url: 'http://ha.local:8123' }, fetchMock)
    await client.reopenItem('todo.groceries', 'task-1')
    expect(status).toBe('needs_action')
    await client.reopenItem('todo.groceries', 'task-1')
    expect(fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/api/services/todo/update_item'))).toHaveLength(1)
  })

  it('refuses to claim a todo reopened when HA did not confirm its new status', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith('/api/services/todo/get_items?return_response')) {
        return new Response(JSON.stringify({
          service_response: {
            'todo.groceries': {
              items: [{ uid: 'task-1', summary: 'Updated task', status: 'completed' }],
            },
          },
        }), { status: 200 })
      }
      return new Response('[]', { status: 200 })
    })
    const client = new HassAdminTodoClient({ token: 'test-token', url: 'http://ha.local:8123' }, fetchMock)
    await expect(client.reopenItem('todo.groceries', 'task-1'))
      .rejects.toThrow('did not reopen')
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

  it('downloads Admin To-Do attachments through the authenticated endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }),
    )
    const client = new HassAdminTodoClient({ token: 'secret', url: 'http://ha.local:8123' }, fetchMock)

    await expect(client.getAdminTodoAttachment('attachment 1')).resolves.toEqual(
      new Uint8Array([137, 80, 78, 71]),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ha.local:8123/api/sfenton_admin_todo/attachments/attachment%201',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret' },
      }),
    )
  })

  it('accepts missing attachments during idempotent cleanup', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', { status: 404 }),
    )
    const client = new HassAdminTodoClient({ token: 'secret', url: 'http://ha.local:8123' }, fetchMock)

    await expect(client.deleteAdminTodoAttachment('attachment-1')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://ha.local:8123/api/sfenton_admin_todo/attachments/attachment-1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret' },
        method: 'DELETE',
      }),
    )
  })

  it('requires both completed todo state and the matching completion receipt', () => {
    expect(adminCompletionBoundarySatisfied('needs_action', 'task-1', 'task-1')).toBe(false)
    expect(adminCompletionBoundarySatisfied('completed', 'another-task', 'task-1')).toBe(false)
    expect(adminCompletionBoundarySatisfied('completed', 'task-1', 'task-1')).toBe(true)
  })
})
