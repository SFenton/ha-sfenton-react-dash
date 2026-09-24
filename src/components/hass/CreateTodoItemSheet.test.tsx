// @covers src/components/hass/CreateTodoItemSheet.tsx
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/pages/settings.json

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { CreateTodoItemSheet } from './CreateTodoItemSheet'

describe('CreateTodoItemSheet', () => {
  let objectUrlCount = 0

  beforeEach(() => {
    resetMockHass()
    objectUrlCount = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:todo-image-${++objectUrlCount}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  it('previews selected images, removes one, and uploads only the retained files', async () => {
    let resolveRequest!: (response: Response) => void
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)
    const onClose = vi.fn()
    render(<CreateTodoItemSheet entityId="todo.groceries" onClose={onClose} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    const input = within(dialog).getByLabelText('Images')
    const firstImage = new File(['first'], 'first.png', { type: 'image/png' })
    const secondImage = new File(['second'], 'second.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [firstImage, secondImage] } })

    expect(await within(dialog).findByRole('img', { name: 'first.png' })).toHaveAttribute('src', 'blob:todo-image-1')
    expect(within(dialog).getByRole('img', { name: 'second.png' })).toHaveAttribute('src', 'blob:todo-image-2')
    const initialRemoveButtons = [...dialog.querySelectorAll<HTMLButtonElement>('[data-selected-image-remove="true"]')]
    expect(initialRemoveButtons).toHaveLength(2)
    expect(initialRemoveButtons[0]).toHaveAccessibleName('Close')
    expect(initialRemoveButtons[0]).toHaveAccessibleDescription('1. first.png')
    expect(initialRemoveButtons[1]).toHaveAccessibleDescription('2. second.png')
    fireEvent.click(initialRemoveButtons[0])

    const retainedRemoveButton = dialog.querySelector<HTMLButtonElement>('[data-selected-image-remove="true"]')
    expect(retainedRemoveButton).not.toBeNull()
    expect(retainedRemoveButton).toHaveFocus()
    expect(retainedRemoveButton).toHaveAccessibleDescription('1. second.png')
    expect(within(dialog).queryByRole('img', { name: 'first.png' })).not.toBeInTheDocument()
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:todo-image-1'))

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Task' }), {
      target: { value: 'Attach the retained screenshot' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Task' }))

    expect(input).toBeDisabled()
    expect(retainedRemoveButton).toBeDisabled()
    const formData = fetchMock.mock.calls[0]?.[1]?.body as FormData
    expect(formData.getAll('images').map((entry) => (entry as File).name)).toEqual(['second.png'])

    resolveRequest(new Response(JSON.stringify({ created: true }), { status: 200 }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('keeps duplicate filenames independently removable and permits same-file reselection', async () => {
    render(<CreateTodoItemSheet entityId="todo.groceries" onClose={vi.fn()} open />)
    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    const input = within(dialog).getByLabelText('Images')
    const firstImage = new File(['first'], 'duplicate.webp', { type: 'image/webp' })
    const secondImage = new File(['second'], 'duplicate.webp', { type: 'image/webp' })
    fireEvent.change(input, { target: { files: [firstImage, secondImage] } })

    expect(await within(dialog).findAllByRole('img', { name: 'duplicate.webp' })).toHaveLength(2)
    let removeButtons = [...dialog.querySelectorAll<HTMLButtonElement>('[data-selected-image-remove="true"]')]
    expect(removeButtons[0]).toHaveAccessibleDescription('1. duplicate.webp')
    expect(removeButtons[1]).toHaveAccessibleDescription('2. duplicate.webp')
    fireEvent.click(removeButtons[0])
    removeButtons = [...dialog.querySelectorAll<HTMLButtonElement>('[data-selected-image-remove="true"]')]
    expect(removeButtons).toHaveLength(1)
    expect(removeButtons[0]).toHaveAccessibleDescription('1. duplicate.webp')
    expect(removeButtons[0]).toHaveFocus()
    fireEvent.click(removeButtons[0])
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { files: [firstImage] } })
    expect(await within(dialog).findByRole('img', { name: 'duplicate.webp' })).toHaveAttribute('src', 'blob:todo-image-3')
  })

  it('revokes preview URLs when a selection is replaced and the sheet unmounts', async () => {
    const { unmount } = render(<CreateTodoItemSheet entityId="todo.groceries" onClose={vi.fn()} open />)
    const dialog = await screen.findByRole('dialog', { name: 'Add Task' })
    const input = within(dialog).getByLabelText('Images')
    fireEvent.change(input, {
      target: { files: [new File(['first'], 'first.png', { type: 'image/png' })] },
    })
    expect(await within(dialog).findByRole('img', { name: 'first.png' })).toHaveAttribute('src', 'blob:todo-image-1')

    fireEvent.change(input, {
      target: { files: [new File(['second'], 'second.png', { type: 'image/png' })] },
    })
    expect(await within(dialog).findByRole('img', { name: 'second.png' })).toHaveAttribute('src', 'blob:todo-image-2')
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:todo-image-1'))

    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:todo-image-2')
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
