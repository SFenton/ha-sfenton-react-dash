// @covers src/components/hass/EditTodoItemSheet.tsx
// @covers src/components/hass/EditTodoItemSheet.module.css
// @covers src/components/hass/adminTodoEdit.ts
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/core.json
// @covers src/i18n/locales/en/pages/settings.json
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditTodoItemSheet } from './EditTodoItemSheet'
import { mockCallServiceCalls, mockState, resetMockHass, setMockCallServiceOutcome } from '../../test/mocks/hakitCoreState'

const target = {
  itemUid: 'uid-1',
  originalTitle: '  Raw task title  ',
  todoEntityId: 'todo.groceries',
}

describe('EditTodoItemSheet', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('prefills the raw title, keeps Reset before Save, and sends the exact rename payload', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<EditTodoItemSheet editTarget={target} onClose={onClose} onSaved={onSaved} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })
    expect(within(dialog).getByText('This issue is synchronized from the dashboard Admin To-Do list. The repository is public.')).toBeVisible()
    const input = screen.getByRole('textbox', { name: 'Task Name' })
    expect(input).toHaveValue('  Raw task title  ')
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()

    fireEvent.change(input, { target: { value: '  Renamed task  ' } })
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([{
      domain: 'todo',
      service: 'update_item',
      target: 'todo.groceries',
      serviceData: { item: 'uid-1', rename: 'Renamed task' },
    }]))
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('resets without calling HA and keeps Save unavailable without a UID', async () => {
    const onClose = vi.fn()
    render(
      <EditTodoItemSheet
        editTarget={{ originalTitle: 'Task', todoEntityId: 'todo.groceries' }}
        onClose={onClose}
        onSaved={vi.fn()}
        open
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })
    const input = screen.getByRole('textbox', { name: 'Task Name' })
    expect(screen.getByRole('alert')).toHaveTextContent('identity is unavailable')
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Changed' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))
    expect(input).toHaveValue('Task')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('uses Enter for the same guarded submit path', async () => {
    render(<EditTodoItemSheet editTarget={target} onClose={vi.fn()} onSaved={vi.fn()} open />)
    const input = await screen.findByRole('textbox', { name: 'Task Name' })
    fireEvent.change(input, { target: { value: 'Next title' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(mockCallServiceCalls[0]).toEqual({
      domain: 'todo',
      service: 'update_item',
      target: 'todo.groceries',
      serviceData: { item: 'uid-1', rename: 'Next title' },
    }))
  })

  it('disables every control, suppresses duplicate submits, and ignores close while pending', async () => {
    setMockCallServiceOutcome('todo', 'update_item', 'pending')
    const onClose = vi.fn()
    render(<EditTodoItemSheet editTarget={target} onClose={onClose} onSaved={vi.fn()} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })
    const input = within(dialog).getByRole('textbox', { name: 'Task Name' })
    fireEvent.change(input, { target: { value: 'Pending title' } })
    const saveButton = within(dialog).getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockCallServiceCalls).toHaveLength(1)
    expect(input).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: /Saving/ })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('retains the draft and error after rejection and permits a retry', async () => {
    setMockCallServiceOutcome('todo', 'update_item', 'reject')
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<EditTodoItemSheet editTarget={target} onClose={onClose} onSaved={onSaved} open />)

    const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })
    const input = within(dialog).getByRole('textbox', { name: 'Task Name' })
    fireEvent.change(input, { target: { value: 'Retry title' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Mock service rejection'))
    expect(input).toHaveValue('Retry title')
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    setMockCallServiceOutcome('todo', 'update_item', 'resolve')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockCallServiceCalls).toHaveLength(2)
  })

  it('retains the draft and error after a synchronous throw', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = () => {
      throw new Error('Synchronous service failure')
    }
    try {
      render(<EditTodoItemSheet editTarget={target} onClose={vi.fn()} onSaved={vi.fn()} open />)
      const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })
      const input = within(dialog).getByRole('textbox', { name: 'Task Name' })
      fireEvent.change(input, { target: { value: 'Thrown title' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Synchronous service failure'))
      expect(input).toHaveValue('Thrown title')
      expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
      expect(mockCallServiceCalls).toHaveLength(0)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reseeds the draft when the same item is reopened', async () => {
    const view = render(<EditTodoItemSheet editTarget={target} key="session-1" onClose={vi.fn()} onSaved={vi.fn()} open />)
    const input = await screen.findByRole('textbox', { name: 'Task Name' })
    fireEvent.change(input, { target: { value: 'Unsaved draft' } })

    view.rerender(<EditTodoItemSheet editTarget={target} key="session-1" onClose={vi.fn()} onSaved={vi.fn()} open={false} />)
    view.rerender(<EditTodoItemSheet editTarget={target} key="session-2" onClose={vi.fn()} onSaved={vi.fn()} open />)

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Task Name' })).toHaveValue('  Raw task title  '))
  })
})
