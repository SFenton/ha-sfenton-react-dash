// @covers src/components/hass/CreateTodoItemSheet.tsx
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/pages/settings.json

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { CreateTodoItemSheet } from './CreateTodoItemSheet'

describe('CreateTodoItemSheet', () => {
  beforeEach(() => {
    resetMockHass()
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
})
