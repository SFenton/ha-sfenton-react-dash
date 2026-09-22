// @covers src/components/hass/CreateTodoItemSheet.tsx
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/pages/settings.json

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { CreateTodoItemSheet } from './CreateTodoItemSheet'

describe('CreateTodoItemSheet', () => {
  beforeEach(() => {
    resetMockHass()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('discloses public GitHub synchronization and creates the Home Assistant item', async () => {
    const onClose = vi.fn()
    render(<CreateTodoItemSheet entityId="todo.groceries" onClose={onClose} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    expect(
      within(dialog).getByText(
        'This issue is synchronized from the dashboard Admin To-Do list. The repository is public.',
      ),
    ).toBeVisible()

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Task' }), {
      target: { value: '  Fix terminal page spacing  ' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Task' }))

    await waitFor(() =>
      expect(mockCallServiceCalls).toEqual([
        {
          domain: 'todo',
          service: 'add_item',
          serviceData: { item: 'Fix terminal page spacing' },
          target: 'todo.groceries',
        },
      ]),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('creates the Home Assistant item and attachment manifest through the authenticated endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    render(<CreateTodoItemSheet entityId="todo.groceries" onClose={onClose} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    expect(
      within(dialog).getByText('Add up to four PNG, JPEG, or WebP images, 10 MB each.'),
    ).toBeVisible()
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Task' }), {
      target: { value: 'Vacuum report totals do not match' },
    })
    const image = new File(['reported state'], 'vacuum-report.png', { type: 'image/png' })
    fireEvent.change(within(dialog).getByLabelText('Images'), {
      target: { files: [image] },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Task' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(mockCallServiceCalls).toEqual([])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/sfenton_admin_todo')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer mock-ha-access-token')
    const formData = init?.body as FormData
    expect(formData.get('entity_id')).toBe('todo.groceries')
    expect(formData.get('item')).toBe('Vacuum report totals do not match')
    expect((formData.get('images') as File).name).toBe('vacuum-report.png')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps the draft visible when attachment creation fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('failed', { status: 503 })))
    render(<CreateTodoItemSheet entityId="todo.groceries" onClose={vi.fn()} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Task' }), {
      target: { value: 'Show the reported layout issue' },
    })
    fireEvent.change(within(dialog).getByLabelText('Images'), {
      target: {
        files: [new File(['reported state'], 'layout.webp', { type: 'image/webp' })],
      },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Task' }))

    expect(await within(dialog).findByText('Unable to add this task. Try again.')).toBeVisible()
    expect(within(dialog).getByRole('textbox', { name: 'Task' })).toHaveValue(
      'Show the reported layout issue',
    )
  })

  it('rejects more than four images before submission', async () => {
    render(<CreateTodoItemSheet entityId="todo.groceries" onClose={vi.fn()} open />)
    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    const images = Array.from(
      { length: 5 },
      (_, index) => new File(['image'], `image-${index}.png`, { type: 'image/png' }),
    )
    fireEvent.change(within(dialog).getByLabelText('Images'), {
      target: { files: images },
    })
    expect(await within(dialog).findByText('Select no more than four images.')).toBeVisible()
  })
})
