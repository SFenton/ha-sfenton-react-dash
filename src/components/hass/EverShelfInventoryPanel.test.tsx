import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { EverShelfInventoryFloatingActions, EverShelfInventoryPanel, type EverShelfInventoryLocation } from './EverShelfInventoryPanel'
import { useEverShelfInventoryControls } from './EverShelfInventoryControls'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'

function InventoryPanelHarness({ location, title }: { location: EverShelfInventoryLocation; title: string }) {
  const controls = useEverShelfInventoryControls(location)
  return (
    <>
      <EverShelfInventoryPanel controls={controls} location={location} title={title} />
      <EverShelfInventoryFloatingActions controls={controls} />
    </>
  )
}

async function openEditModal({ itemName, listLabel, location, quantityLabel = 'Quantity 2', title }: { itemName: string; listLabel: string; location: EverShelfInventoryLocation; quantityLabel?: string; title: string }) {
  render(<InventoryPanelHarness location={location} title={title} />)
  const list = await screen.findByLabelText(listLabel)
  const row = await within(list).findByRole('group', { name: new RegExp(`${itemName} ${quantityLabel}`, 'i') })
  fireEvent.click(within(row).getByRole('button', { name: `Edit ${itemName}` }))
  return await screen.findByRole('dialog', { name: new RegExp(itemName, 'i') })
}

function openGreekYogurtEditModal() {
  return openEditModal({ itemName: 'Greek Yogurt', listLabel: 'Fridge inventory list', location: 'frigo', title: 'Fridge' })
}

function openCannedBeansEditModal() {
  return openEditModal({ itemName: 'Canned Beans', listLabel: 'Pantry inventory list', location: 'dispensa', title: 'Pantry' })
}

async function clickAndFlush(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function inventoryServiceCalls() {
  return mockCallServiceCalls.filter((call) => call.domain === 'evershelf' && call.service !== 'list_inventory')
}

describe('EverShelfInventoryPanel item edit modal', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('adds the extra items to EverShelf when the quantity is increased', async () => {
    const dialog = await openGreekYogurtEditModal()

    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Greek Yogurt' })).toHaveTextContent('2')
    expect(within(dialog).queryByRole('button', { name: 'Save Greek Yogurt' })).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Greek Yogurt' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Greek Yogurt' }))

    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Greek Yogurt' })).toHaveTextContent('4')
    expect(within(dialog).getByText('Saving adds 2 items to the fridge.')).toBeInTheDocument()

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Greek Yogurt' }))

    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'add_scanned_item',
        serviceData: {
          expiry_date: expect.any(String),
          location: 'frigo',
          name: 'Greek Yogurt',
          product_id: 2003,
          quantity: 2,
          unit: 'pz',
          vacuum_sealed: false,
        },
      },
    ])
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'frigo' },
    }))
  })

  it('removes only the reduced items from EverShelf when the quantity is decreased', async () => {
    const dialog = await openGreekYogurtEditModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove one Greek Yogurt' }))

    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Greek Yogurt' })).toHaveTextContent('1')
    expect(within(dialog).getByText('Saving removes 1 item from the fridge.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Remove one Greek Yogurt' })).toBeDisabled()

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Greek Yogurt' }))

    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'delete_inventory',
        serviceData: { inventory_id: 203, quantity: 1 },
      },
    ])
  })

  it('spreads a reduced quantity across the EverShelf rows behind one food item', async () => {
    const dialog = await openCannedBeansEditModal()

    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Canned Beans' })).toHaveTextContent('2')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove one Canned Beans' }))

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Canned Beans' }))

    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'delete_inventory',
        serviceData: { inventory_id: 102 },
      },
    ])
  })

  it('asks how many items to delete when the food item holds more than one', async () => {
    const dialog = await openCannedBeansEditModal()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('1')

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Delete Canned Beans' }))

    expect(promptSpy).toHaveBeenCalledWith('Quantity of Canned Beans to delete (available: 2).', '1')
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 102 } },
    ])
    promptSpy.mockRestore()
    confirmSpy.mockRestore()
  })

  it('deletes every EverShelf row behind the food item when the full quantity is confirmed', async () => {
    const dialog = await openCannedBeansEditModal()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('2')

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Delete Canned Beans' }))

    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 102 } },
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 106 } },
    ])
    promptSpy.mockRestore()
  })

  it('rejects a delete quantity outside the stocked amount', async () => {
    const dialog = await openCannedBeansEditModal()
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('5')

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Delete Canned Beans' }))

    expect(inventoryServiceCalls()).toEqual([])
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a number from 1 to 2.')
    promptSpy.mockRestore()
  })

  it('confirms before deleting a food item that only holds one item', async () => {
    const dialog = await openEditModal({ itemName: 'Milk', listLabel: 'Fridge inventory list', location: 'frigo', quantityLabel: 'Expired', title: 'Fridge' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Delete Milk' }))

    expect(confirmSpy).toHaveBeenCalledWith('Delete Milk from the fridge?')
    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 205 } },
    ])
    confirmSpy.mockRestore()
  })

  it('moves the whole batch to the new expiration before adding extra items', async () => {
    const dialog = await openGreekYogurtEditModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Greek Yogurt' }))
    fireEvent.change(within(dialog).getByLabelText('Expiration date for Greek Yogurt'), { target: { value: '2026-09-30' } })

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Greek Yogurt' }))

    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'update_inventory_item', serviceData: { expiry_date: '2026-09-30', inventory_id: 203 } },
      { domain: 'evershelf', service: 'update_inventory_item', serviceData: { expiry_date: '2026-09-30', inventory_id: 203 } },
      {
        domain: 'evershelf',
        service: 'add_scanned_item',
        serviceData: {
          expiry_date: '2026-09-30',
          location: 'frigo',
          name: 'Greek Yogurt',
          product_id: 2003,
          quantity: 1,
          unit: 'pz',
          vacuum_sealed: false,
        },
      },
    ])
  })

  it('keeps searched items editable by expanding aggregated EverShelf search results into rows', async () => {
    render(<InventoryPanelHarness location="dispensa" title="Pantry" />)
    await screen.findByRole('group', { name: /Canned Beans Quantity 2/i })

    fireEvent.click(await screen.findByRole('button', { name: 'Search inventory' }))
    fireEvent.change(screen.getByLabelText('Search inventory'), { target: { value: 'beans' } })

    await waitFor(() => expect(screen.getAllByRole('group', { name: /Quantity|Expires|Expired/i })).toHaveLength(1))
    const row = screen.getByRole('group', { name: /Canned Beans Quantity 2/i })
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'dispensa' },
    }))
    const editButton = within(row).getByRole('button', { name: 'Edit Canned Beans' })
    expect(editButton).toBeEnabled()
    expect(editButton).toHaveAttribute('data-modal-disclosure-button', 'true')
    expect(within(row).getByRole('button', { name: 'Add Canned Beans to shopping list' })).toBeEnabled()

    fireEvent.click(editButton)
    const dialog = await screen.findByRole('dialog', { name: /Canned Beans/i })
    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Canned Beans' })).toHaveTextContent('2')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove one Canned Beans' }))
    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Canned Beans' }))

    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 102 } },
    ])
  })

  it('restores the saved quantity and expiration when the edit is reset', async () => {    const dialog = await openGreekYogurtEditModal()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Greek Yogurt' }))
    fireEvent.change(within(dialog).getByLabelText('Expiration date for Greek Yogurt'), { target: { value: '2026-09-30' } })
    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset' }))

    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Greek Yogurt' })).toHaveTextContent('2')
    expect(within(dialog).queryByRole('button', { name: 'Save Greek Yogurt' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })
})
