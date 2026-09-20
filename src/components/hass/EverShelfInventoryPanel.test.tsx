import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  EverShelfInventoryDetailsPage,
  EverShelfInventoryDetailsPageHost,
  EverShelfInventoryFloatingActions,
  EverShelfInventoryPanel,
  type EverShelfInventoryLocation,
} from './EverShelfInventoryPanel'
import { useEverShelfInventoryControls } from './EverShelfInventoryControls'
import { mockCallServiceCalls, mockState, resetMockHass } from '../../test/mocks/hakitCoreState'
import {
  GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY,
  readGroceryDeleteDialogDiagnostics,
} from './EverShelfInventoryPanelDiagnostics'

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
  return openEditModal({ itemName: 'Canned Beans', listLabel: 'Pantry inventory list', location: 'dispensa', quantityLabel: 'Quantity 5', title: 'Pantry' })
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

function offsetDisplayDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${date.getFullYear()}`
}

function offsetIsoDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// The pantry mock stocks Canned Beans as two expiration batches: 2 items expiring in three days and
// 3 items expiring in 200 days.
const SOON_BATCH = `expiring ${offsetDisplayDate(3)}`
const LATER_BATCH = `expiring ${offsetDisplayDate(200)}`

function inventoryServiceCalls() {
  return mockCallServiceCalls.filter((call) => call.domain === 'evershelf' && call.service !== 'list_inventory')
}

function setMockInventory(location: string, items: Record<string, unknown>[]) {
  const mockHass = (window as unknown as {
    __mockHass: { setInventoryItems: (location: string, items: Record<string, unknown>[]) => void }
  }).__mockHass
  mockHass.setInventoryItems(location, items)
}

describe('EverShelfInventoryPanel item edit modal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetMockHass()
    delete (window as unknown as Record<string, unknown>)[GROCERY_DELETE_DIALOG_DIAGNOSTICS_PROPERTY]
  })
  afterEach(() => {
    vi.useRealTimers()
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
          inventory_prepared_food: false,
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

  it('clears successful edit busy state before the same item is reopened', async () => {
    const dialog = await openGreekYogurtEditModal()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Greek Yogurt' }))

    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Greek Yogurt' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Greek Yogurt/i })).not.toBeInTheDocument())

    const list = screen.getByLabelText('Fridge inventory list')
    const row = within(list).getByRole('group', { name: /Greek Yogurt Quantity/i })
    fireEvent.click(within(row).getByRole('button', { name: 'Edit Greek Yogurt' }))

    const reopenedDialog = await screen.findByRole('dialog', { name: /Greek Yogurt/i })
    expect(within(reopenedDialog).getByRole('button', { name: 'Remove one Greek Yogurt' })).toBeEnabled()
    expect(within(reopenedDialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })).toBeEnabled()
  })

  // @covers src/i18n/index.ts
  // @covers src/i18n/locales/en/pages/food.json
  it('shows the localized fallback when an item update fails without an Error', async () => {
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'add_scanned_item') {
        return Promise.reject('Mock service rejection')
      }
      return originalCallService(params)
    })
    const dialog = await openGreekYogurtEditModal()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Greek Yogurt' }))

    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Greek Yogurt' }))

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to update item'))
    expect(screen.getByRole('dialog', { name: 'Greek Yogurt' })).toBeInTheDocument()
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

  it('spreads a reduced quantity across the EverShelf rows behind one expiration batch', async () => {
    const dialog = await openCannedBeansEditModal()

    expect(within(dialog).getByRole('spinbutton', { name: `Quantity for Canned Beans ${SOON_BATCH}` })).toHaveTextContent('2')
    fireEvent.click(within(dialog).getByRole('button', { name: `Remove one Canned Beans ${SOON_BATCH}` }))

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: `Save Canned Beans ${SOON_BATCH}` }))

    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'delete_inventory',
        serviceData: { inventory_id: 102 },
      },
    ])
  })

  it('prompts directly for an accepted multi-item delete quantity', async () => {
    const dialog = await openCannedBeansEditModal()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('1')

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: `Delete Canned Beans ${SOON_BATCH}` }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalledWith(
      `Choose how many Canned Beans ${SOON_BATCH} to delete from the pantry. Enter a number from 1 to 2.`,
      '1',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 102 } },
    ])
    expect(screen.getByRole('dialog', { name: 'Canned Beans' })).toBeInTheDocument()
    expect(within(dialog).getByRole('spinbutton', { name: `Quantity for Canned Beans ${SOON_BATCH}` })).toHaveTextContent('1')
    expect(within(dialog).getByRole('button', { name: `Delete Canned Beans ${SOON_BATCH}` })).toBeEnabled()
    expect(readGroceryDeleteDialogDiagnostics().map(
      ({ event, maximumQuantity, result }) => ({ event, maximumQuantity, result }),
    )).toEqual([
      { event: 'prompt-opened', maximumQuantity: 2, result: undefined },
      { event: 'prompt-resolved', maximumQuantity: 2, result: 'value' },
      { event: 'prompt-parsed', maximumQuantity: 2, result: 'valid' },
    ])
    confirmSpy.mockRestore()
    promptSpy.mockRestore()
  })

  it('keeps the details modal open when another batch remains after deletion', async () => {
    const dialog = await openCannedBeansEditModal()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('2')

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: `Delete Canned Beans ${SOON_BATCH}` }))

    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 102 } },
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 106 } },
    ])
    expect(screen.getByRole('dialog', { name: 'Canned Beans' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('spinbutton', { name: `Quantity for Canned Beans ${SOON_BATCH}` })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Canned Beans' })).toHaveTextContent('3')
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
    promptSpy.mockRestore()
  })

  it('rejects a delete quantity outside the batch amount', async () => {
    const dialog = await openCannedBeansEditModal()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('5')

    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: `Delete Canned Beans ${SOON_BATCH}` }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalledWith(
      `Choose how many Canned Beans ${SOON_BATCH} to delete from the pantry. Enter a number from 1 to 2.`,
      '1',
    )
    expect(inventoryServiceCalls()).toEqual([])
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a number from 1 to 2.')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(readGroceryDeleteDialogDiagnostics().map(({ event, result }) => ({ event, result }))).toEqual([
      { event: 'prompt-opened', result: undefined },
      { event: 'prompt-resolved', result: 'value' },
      { event: 'prompt-parsed', result: 'invalid' },
    ])
    confirmSpy.mockRestore()
    promptSpy.mockRestore()
  })

  it('uses native confirmation before deleting a food item that only holds one item', async () => {
    const dialog = await openEditModal({ itemName: 'Milk', listLabel: 'Fridge inventory list', location: 'frigo', quantityLabel: 'Expired', title: 'Fridge' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Delete Milk' }))

    expect(confirmSpy).toHaveBeenCalledWith('Delete Milk from the fridge?')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 205 } },
    ])
    expect(readGroceryDeleteDialogDiagnostics().map(({ event, result }) => ({ event, result }))).toEqual([
      { event: 'confirm-opened', result: undefined },
      { event: 'confirm-resolved', result: 'accepted' },
    ])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Milk' })).not.toBeInTheDocument())
    confirmSpy.mockRestore()
  })

  it('cancels a native multi-item prompt without changing EverShelf', async () => {
    const dialog = await openCannedBeansEditModal()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null)

    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: `Delete Canned Beans ${SOON_BATCH}` }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalledWith(
      `Choose how many Canned Beans ${SOON_BATCH} to delete from the pantry. Enter a number from 1 to 2.`,
      '1',
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(inventoryServiceCalls()).toEqual([])
    expect(readGroceryDeleteDialogDiagnostics().map(({ elapsedMs, event, result }) => ({
      elapsedMs,
      event,
      result,
    }))).toEqual([
      { elapsedMs: undefined, event: 'prompt-opened', result: undefined },
      { elapsedMs: expect.any(Number), event: 'prompt-resolved', result: 'cancelled' },
    ])
    confirmSpy.mockRestore()
    promptSpy.mockRestore()
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
          inventory_prepared_food: false,
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
    await screen.findByRole('group', { name: /Canned Beans Quantity 5/i })

    fireEvent.click(await screen.findByRole('button', { name: 'Search inventory' }))
    fireEvent.change(screen.getByLabelText('Search inventory'), { target: { value: 'beans' } })

    await waitFor(() => expect(screen.getAllByRole('group', { name: /Quantity|Expires|Expired/i })).toHaveLength(1))
    const row = screen.getByRole('group', { name: /Canned Beans Quantity 5/i })
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
    expect(within(dialog).getByRole('spinbutton', { name: `Quantity for Canned Beans ${SOON_BATCH}` })).toHaveTextContent('2')

    fireEvent.click(within(dialog).getByRole('button', { name: `Remove one Canned Beans ${SOON_BATCH}` }))
    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: `Save Canned Beans ${SOON_BATCH}` }))

    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'delete_inventory', serviceData: { inventory_id: 102 } },
    ])
  })

  it('collapses every expiration batch of a food item into one row', async () => {
    render(<InventoryPanelHarness location="dispensa" title="Pantry" />)
    const list = await screen.findByLabelText('Pantry inventory list')

    const rows = await within(list).findAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      `Almond Flour Expired on ${offsetDisplayDate(-10)}`,
      'Canned Beans Quantity 5 · Multiple Expiration Dates',
      `Ziti Expires on ${offsetDisplayDate(40)}`,
    ])
  })

  it('lists every expiration batch of a food item as its own modal section', async () => {
    const dialog = await openCannedBeansEditModal()

    const sections = within(dialog).getAllByRole('listitem')
    expect(sections).toHaveLength(2)
    expect(sections.map((section) => section.querySelector('strong')?.textContent)).toEqual([
      `Expires on ${offsetDisplayDate(3)}`,
      `Expires on ${offsetDisplayDate(200)}`,
    ])
    expect(within(sections[0]).getByRole('spinbutton', { name: `Quantity for Canned Beans ${SOON_BATCH}` })).toHaveTextContent('2')
    expect(within(sections[0]).getByLabelText(`Expiration date for Canned Beans ${SOON_BATCH}`)).toHaveValue(offsetIsoDate(3))
    expect(within(sections[1]).getByRole('spinbutton', { name: `Quantity for Canned Beans ${LATER_BATCH}` })).toHaveTextContent('3')
    expect(within(sections[1]).getByLabelText(`Expiration date for Canned Beans ${LATER_BATCH}`)).toHaveValue(offsetIsoDate(200))
    expect(within(dialog).queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('adds stock to the edited expiration batch only', async () => {
    const dialog = await openCannedBeansEditModal()

    fireEvent.click(within(dialog).getByRole('button', { name: `Add one Canned Beans ${LATER_BATCH}` }))

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: `Save Canned Beans ${LATER_BATCH}` }))

    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'add_scanned_item',
        serviceData: {
          expiry_date: offsetIsoDate(200),
          inventory_prepared_food: false,
          location: 'dispensa',
          name: 'Canned Beans',
          product_id: 1002,
          quantity: 1,
          unit: 'pz',
          vacuum_sealed: false,
        },
      },
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

  it('keeps added stock prepared when editing a prepared batch', async () => {
    const mockHass = (window as unknown as {
      __mockHass: { setInventoryItems: (location: string, items: Record<string, unknown>[]) => void }
    }).__mockHass
    mockHass.setInventoryItems('dispensa', [
      {
        expiry_date: '2020-01-01',
        id: 101,
        location: 'dispensa',
        name: 'Almond Flour',
        prepared_food: true,
        product_id: 1001,
        quantity: 1,
        unit: 'pz',
        vacuum_sealed: false,
      },
    ])
    const dialog = await openEditModal({ itemName: 'Almond Flour', listLabel: 'Pantry inventory list', location: 'dispensa', quantityLabel: 'Expired', title: 'Pantry' })

    expect(within(dialog).getByRole('button', { name: 'Prepared Food Item for Almond Flour prepared' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add one Almond Flour prepared' }))

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Save Almond Flour prepared' }))

    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'add_scanned_item',
        serviceData: {
          expiry_date: expect.any(String),
          inventory_prepared_food: true,
          location: 'dispensa',
          name: 'Almond Flour',
          product_id: 1001,
          quantity: 1,
          unit: 'pz',
          vacuum_sealed: false,
        },
      },
    ])
  })
})

describe('EverShelfInventoryPanel prepared food toggle', () => {
  beforeEach(() => {
    resetMockHass()
    vi.restoreAllMocks()
  })

  it('renders an unchecked toggle with the expected copy', async () => {
    const dialog = await openGreekYogurtEditModal()

    const toggle = within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText('Prepared Food Item', { selector: 'strong' })).toBeInTheDocument()
    expect(within(dialog).getByText('Indicates this is a prepared food item and does not need classification.', { selector: 'small' })).toBeInTheDocument()
  })

  it('keeps the modal open, stays busy through refresh, and renders authoritative prepared state', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    const refreshedInventory = [
      {
        expiry_date: offsetIsoDate(5),
        id: 203,
        location: 'frigo',
        name: 'Greek Yogurt',
        prepared_food: false,
        product_id: 2003,
        quantity: 1,
        unit: 'pz',
        vacuum_sealed: false,
      },
      {
        expiry_date: offsetIsoDate(5),
        id: 208,
        location: 'frigo',
        name: 'Greek Yogurt',
        prepared_food: true,
        product_id: 2003,
        quantity: 1,
        unit: 'pz',
        vacuum_sealed: false,
      },
    ]
    let mutationStarted = false
    let resolveRefresh: ((value: unknown) => void) | undefined
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      const result = originalCallService(params)
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        mutationStarted = true
        setMockInventory('frigo', refreshedInventory)
      }
      return result
    })

    const dialog = await openGreekYogurtEditModal()
    mockCallServiceCalls.length = 0
    const toggle = within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })
    fireEvent.click(toggle)

    await waitFor(() => expect(resolveRefresh).toEqual(expect.any(Function)))
    expect(screen.getByRole('dialog', { name: /Greek Yogurt/i })).toBeInTheDocument()
    expect(toggle).toBeDisabled()

    resolveRefresh?.({ response: { inventory: refreshedInventory } })
    await waitFor(() => {
      const preparedToggle = within(dialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })
      expect(preparedToggle).toHaveAttribute('aria-pressed', 'true')
      expect(preparedToggle).toBeEnabled()
    })
    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'set_inventory_prepared_food',
        serviceData: { inventory_id: 203, prepared_food: true, quantity: 1 },
      },
    ])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Greek Yogurt/i })).not.toBeInTheDocument())
    const list = await screen.findByLabelText('Fridge inventory list')
    const row = await within(list).findByRole('group', { name: /Greek Yogurt Quantity 2/i })
    fireEvent.click(within(row).getByRole('button', { name: 'Edit Greek Yogurt' }))
    const reopenedDialog = await screen.findByRole('dialog', { name: /Greek Yogurt/i })
    await waitFor(() => {
      expect(within(reopenedDialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('flips the control immediately and starts the first prepared write in the click turn', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    const refreshedInventory = [
      {
        expiry_date: offsetIsoDate(5),
        id: 203,
        location: 'frigo',
        name: 'Greek Yogurt',
        prepared_food: false,
        product_id: 2003,
        quantity: 1,
        unit: 'pz',
        vacuum_sealed: false,
      },
      {
        expiry_date: offsetIsoDate(5),
        id: 208,
        location: 'frigo',
        name: 'Greek Yogurt',
        prepared_food: true,
        product_id: 2003,
        quantity: 1,
        unit: 'pz',
        vacuum_sealed: false,
      },
    ]
    const events: string[] = []
    let mutationStarted = false
    let resolveRefresh: ((value: unknown) => void) | undefined
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        events.push('write')
        mutationStarted = true
        return originalCallService(params)
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        events.push('read')
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      return originalCallService(params)
    })

    const dialog = await openGreekYogurtEditModal()
    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))

    expect(events[0]).toBe('write')
    const projectedToggle = within(dialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })
    expect(projectedToggle).toHaveAttribute('aria-pressed', 'true')
    expect(projectedToggle).toBeDisabled()
    await waitFor(() => expect(resolveRefresh).toEqual(expect.any(Function)))

    resolveRefresh?.({ response: { inventory: refreshedInventory } })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeEnabled())
  })

  it('projects a full prepared move before the deferred authority read', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('2')
    let resolveRefresh: ((value: unknown) => void) | undefined
    let mutationStarted = false
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') mutationStarted = true
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      return originalCallService(params)
    })

    const dialog = await openGreekYogurtEditModal()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))

    expect(within(dialog).getAllByRole('button', { name: /Prepared Food Item for Greek Yogurt/ })).toHaveLength(1)
    const projectedToggle = within(dialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })
    expect(projectedToggle).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('spinbutton', { name: 'Quantity for Greek Yogurt prepared' })).toHaveTextContent('2')
    expect(projectedToggle).toBeDisabled()
    await waitFor(() => expect(resolveRefresh).toEqual(expect.any(Function)))

    resolveRefresh?.({
      response: {
        inventory: [{
          expiry_date: offsetIsoDate(5),
          id: 208,
          location: 'frigo',
          name: 'Greek Yogurt',
          prepared_food: true,
          product_id: 2003,
          quantity: 2,
          unit: 'pz',
          vacuum_sealed: false,
        }],
      },
    })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeEnabled())
  })

  it('projects partial multi-row moves, merges the destination batch, and removes service rows from affected batches', async () => {
    const soonDate = offsetIsoDate(3)
    const laterDate = offsetIsoDate(200)
    setMockInventory('dispensa', [
      { expiry_date: soonDate, id: 102, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 2, unit: 'pz', vacuum_sealed: false },
      { expiry_date: soonDate, id: 106, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
      { expiry_date: soonDate, id: 108, location: 'dispensa', name: 'Canned Beans', prepared_food: true, product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
      { expiry_date: laterDate, id: 107, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 3, unit: 'pz', vacuum_sealed: false },
    ])
    vi.spyOn(window, 'prompt').mockReturnValue('2')
    let resolveRefresh: ((value: unknown) => void) | undefined
    let mutationStarted = false
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') mutationStarted = true
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      return originalCallService(params)
    })

    const dialog = await openEditModal({ itemName: 'Canned Beans', listLabel: 'Pantry inventory list', location: 'dispensa', quantityLabel: 'Quantity 7', title: 'Pantry' })
    fireEvent.click(within(dialog).getByRole('button', { name: `Prepared Food Item for Canned Beans ${SOON_BATCH}`, exact: true }))

    const projectedToggles = within(dialog).getAllByRole('button', { name: /Prepared Food Item for Canned Beans/i })
    expect(projectedToggles).toHaveLength(3)
    expect(projectedToggles.filter((toggle) => toggle.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expect(projectedToggles.filter((toggle) => toggle.getAttribute('aria-pressed') === 'false')).toHaveLength(2)
    expect(projectedToggles.every((toggle) => toggle.hasAttribute('disabled'))).toBe(true)
    expect(within(dialog).getByRole('spinbutton', { name: /Canned Beans expiring .* prepared/i })).toHaveTextContent('3')
    await waitFor(() => expect(resolveRefresh).toEqual(expect.any(Function)))

    resolveRefresh?.({
      response: {
        inventory: [
          { expiry_date: soonDate, id: 109, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
          { expiry_date: soonDate, id: 110, location: 'dispensa', name: 'Canned Beans', prepared_food: true, product_id: 1002, quantity: 3, unit: 'pz', vacuum_sealed: false },
          { expiry_date: laterDate, id: 107, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 3, unit: 'pz', vacuum_sealed: false },
        ],
      },
    })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /Prepared Food Item for Canned Beans.*prepared/i })).toBeEnabled())
  })

  it('keeps the prepared projection through local close and same-item reopen', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    let resolveRefresh: ((value: unknown) => void) | undefined
    let mutationStarted = false
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        mutationStarted = true
        return originalCallService(params)
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      return originalCallService(params)
    })

    const dialog = await openGreekYogurtEditModal()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    await waitFor(() => expect(resolveRefresh).toEqual(expect.any(Function)))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Greek Yogurt/i })).not.toBeInTheDocument())

    const list = await screen.findByLabelText('Fridge inventory list')
    const row = await within(list).findByRole('group', { name: /Greek Yogurt Quantity 2/i })
    fireEvent.click(within(row).getByRole('button', { name: 'Edit Greek Yogurt' }))
    const reopenedDialog = await screen.findByRole('dialog', { name: /Greek Yogurt/i })
    expect(within(reopenedDialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toHaveAttribute('aria-pressed', 'true')

    resolveRefresh?.({
      response: {
        inventory: [
          { expiry_date: offsetIsoDate(5), id: 203, location: 'frigo', name: 'Greek Yogurt', prepared_food: false, product_id: 2003, quantity: 1, unit: 'pz', vacuum_sealed: false },
          { expiry_date: offsetIsoDate(5), id: 208, location: 'frigo', name: 'Greek Yogurt', prepared_food: true, product_id: 2003, quantity: 1, unit: 'pz', vacuum_sealed: false },
        ],
      },
    })
    await waitFor(() => expect(within(reopenedDialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeEnabled())
  })

  it('keeps the prepared projection when a shared host clears and reopens the same target', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    const item = {
      expiry_date: offsetIsoDate(5),
      id: 203,
      location: 'frigo',
      name: 'Greek Yogurt',
      prepared_food: false,
      product_id: 2003,
      quantity: 2,
      unit: 'pz',
      vacuum_sealed: false,
    }
    const target = {
      item: { ...item, groupedItems: [item] },
      location: 'frigo' as const,
      locationLabel: 'fridge',
    }
    const writes: Record<string, unknown>[] = []
    let mutationStarted = false
    let resolveRefresh: ((value: unknown) => void) | undefined
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        writes.push(params)
        mutationStarted = true
        return originalCallService(params)
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return new Promise((resolve) => {
          resolveRefresh = resolve
        })
      }
      return originalCallService(params)
    })
    const onComplete = vi.fn()
    const renderHost = (active: boolean, nextTarget: typeof target | null) => (
      <EverShelfInventoryDetailsPageHost active={active} onComplete={onComplete} target={nextTarget}>
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>
    )
    const view = render(renderHost(true, target))

    fireEvent.click(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    await waitFor(() => expect(resolveRefresh).toEqual(expect.any(Function)))
    expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeDisabled()

    view.rerender(renderHost(false, null))
    await act(async () => {
      await Promise.resolve()
    })
    view.rerender(renderHost(true, target))

    expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeDisabled()
    expect(writes).toHaveLength(1)

    resolveRefresh?.({
      response: {
        inventory: [
          { ...item, quantity: 1 },
          { ...item, id: 208, prepared_food: true, quantity: 1 },
        ],
      },
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeEnabled())
  })

  it('sends an explicit false payload and renders authoritative unchecked state', async () => {
    setMockInventory('dispensa', [
      {
        expiry_date: offsetIsoDate(-10),
        id: 101,
        location: 'dispensa',
        name: 'Almond Flour',
        prepared_food: true,
        product_id: 1001,
        quantity: 1,
        unit: 'pz',
        vacuum_sealed: false,
      },
    ])
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      const result = originalCallService(params)
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        setMockInventory('dispensa', [
          {
            expiry_date: offsetIsoDate(-10),
            id: 101,
            location: 'dispensa',
            name: 'Almond Flour',
            prepared_food: false,
            product_id: 1001,
            quantity: 1,
            unit: 'pz',
            vacuum_sealed: false,
          },
        ])
      }
      return result
    })

    const dialog = await openEditModal({ itemName: 'Almond Flour', listLabel: 'Pantry inventory list', location: 'dispensa', quantityLabel: 'Expired', title: 'Pantry' })
    const toggle = within(dialog).getByRole('button', { name: 'Prepared Food Item for Almond Flour prepared' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    mockCallServiceCalls.length = 0
    fireEvent.click(toggle)
    await waitFor(() => {
      const uncheckedToggle = within(dialog).getByRole('button', { name: 'Prepared Food Item for Almond Flour' })
      expect(uncheckedToggle).toHaveAttribute('aria-pressed', 'false')
      expect(uncheckedToggle).toBeEnabled()
    })
    expect(screen.getByRole('dialog', { name: 'Almond Flour' })).toBeInTheDocument()
    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'set_inventory_prepared_food',
        serviceData: { inventory_id: 101, prepared_food: false, quantity: 1 },
      },
    ])
  })

  it('refreshes every location when prepared food is edited from an all-inventory view', async () => {
    const pantryItem = {
      expiration_date: '2026-09-21',
      id: 101,
      inventory_id: 101,
      location: 'dispensa',
      name: 'Tomato Soup',
      prepared_food: false,
      product_id: 3001,
      quantity: 1,
      unit: 'pz',
      vacuum_sealed: false,
    }
    const fridgeItem = {
      ...pantryItem,
      expiration_date: '2026-09-22',
      id: 102,
      inventory_id: 102,
      location: 'frigo',
    }
    setMockInventory('all', [
      { ...pantryItem, prepared_food: true },
      { ...fridgeItem, prepared_food: false },
    ])
    mockCallServiceCalls.length = 0
    const onComplete = vi.fn()

    render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={onComplete}
        target={{
          item: {
            ...pantryItem,
            groupedItems: [pantryItem, fridgeItem],
            quantity: 2,
          },
          location: 'all',
          locationLabel: 'inventory',
        }}
      >
        {(controller) => (
          <>
            <button onClick={() => controller.togglePreparedFood(controller.batches[0])} type="button">Mark prepared</button>
            <span>{controller.batches.every((batch) => batch.preparedFood) ? 'Prepared' : 'Not prepared'}</span>
          </>
        )}
      </EverShelfInventoryDetailsPageHost>,
    )

    expect(screen.getByText('Not prepared')).toBeInTheDocument()
    await clickAndFlush(screen.getByRole('button', { name: 'Mark prepared' }))

    await waitFor(() => expect(screen.getByText('Not prepared')).toBeInTheDocument())
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: {},
    })
    expect(mockCallServiceCalls).not.toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'dispensa' },
    })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('confirms from an unfiltered read even when the visible parent refresh omits the group', async () => {
    const item = {
      expiry_date: offsetIsoDate(5),
      id: 203,
      location: 'frigo',
      name: 'Greek Yogurt',
      prepared_food: false,
      product_id: 2003,
      quantity: 1,
      unit: 'pz',
      vacuum_sealed: false,
    }
    const onInventoryChanged = vi.fn(async () => [])
    setMockInventory('frigo', [{ ...item, prepared_food: true }])
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => originalCallService(params))

    render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        onInventoryChanged={onInventoryChanged}
        target={{
          item: { ...item, groupedItems: [item] },
          location: 'frigo',
          locationLabel: 'fridge',
        }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt prepared/i })).toBeEnabled())
    expect(onInventoryChanged).toHaveBeenCalledTimes(1)
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'frigo' },
    })
    expect(mockCallServiceCalls).not.toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'frigo', q: 'Greek Yogurt' },
    })
  })

  it('reconciles partial persistence after a later prepared-row mutation fails', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('2')
    let mutationCount = 0
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      const result = originalCallService(params)
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        mutationCount += 1
        if (mutationCount === 1) {
          setMockInventory('dispensa', [
            { expiry_date: offsetIsoDate(3), id: 102, location: 'dispensa', name: 'Canned Beans', prepared_food: true, product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
            { expiry_date: offsetIsoDate(3), id: 106, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
            { expiry_date: offsetIsoDate(200), id: 107, location: 'dispensa', name: 'Canned Beans', prepared_food: false, product_id: 1002, quantity: 3, unit: 'pz', vacuum_sealed: false },
          ])
        }
        if (mutationCount === 2) return Promise.reject('Mock service rejection')
      }
      return result
    })

    const dialog = await openCannedBeansEditModal()
    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: `Prepared Food Item for Canned Beans ${SOON_BATCH}` }))

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Unable to update prepared food'))
    expect(screen.getByRole('dialog', { name: 'Canned Beans' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Prepared Food Item for Canned Beans.*prepared/i })).toHaveAttribute('aria-pressed', 'true')
    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'set_inventory_prepared_food', serviceData: { inventory_id: 102, prepared_food: true, quantity: 1 } },
      { domain: 'evershelf', service: 'set_inventory_prepared_food', serviceData: { inventory_id: 106, prepared_food: true, quantity: 1 } },
    ])
  })

  it('keeps the modal open and reports an authoritative refresh failure', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    let mutationStarted = false
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      const result = originalCallService(params)
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') mutationStarted = true
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return Promise.reject(new Error('Authoritative refresh failed'))
      }
      return result
    })

    const dialog = await openGreekYogurtEditModal()
    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))

    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('Authoritative refresh failed'))
    expect(screen.getByRole('dialog', { name: /Greek Yogurt/i })).toBeInTheDocument()
    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'set_inventory_prepared_food',
        serviceData: { inventory_id: 203, prepared_food: true, quantity: 1 },
      },
    ])
  })

  it('times out the optimistic operation at ten seconds without retrying the write', async () => {
    vi.useFakeTimers()
    const writes: Record<string, unknown>[] = []
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        writes.push(params)
        return Promise.resolve({})
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory') {
        return Promise.resolve({
          response: {
            inventory: [{
              expiry_date: offsetIsoDate(5),
              id: 203,
              location: 'frigo',
              name: 'Greek Yogurt',
              prepared_food: false,
              product_id: 2003,
              quantity: 2,
              unit: 'pz',
              vacuum_sealed: false,
            }],
          },
        })
      }
      return originalCallService(params)
    })

    render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        target={{
          item: {
            expiry_date: offsetIsoDate(5),
            id: 203,
            location: 'frigo',
            name: 'Greek Yogurt',
            prepared_food: false,
            product_id: 2003,
            quantity: 2,
            unit: 'pz',
            vacuum_sealed: false,
          },
          location: 'frigo',
          locationLabel: 'fridge',
        }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )
    vi.spyOn(window, 'prompt').mockReturnValue('1')

    fireEvent.click(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    expect(writes).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeDisabled()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      vi.advanceTimersByTime(9999)
      await Promise.resolve()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to update prepared food')
    expect(writes).toHaveLength(1)
    vi.useRealTimers()
  })

  it('releases the command lock when the final authoritative read no longer contains the item', async () => {
    vi.useFakeTimers()
    const writes: Record<string, unknown>[] = []
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        writes.push(params)
        return Promise.resolve({})
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory') {
        return Promise.resolve({ response: { inventory: [] } })
      }
      return originalCallService(params)
    })

    render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        target={{
          item: {
            expiry_date: offsetIsoDate(5),
            id: 203,
            location: 'frigo',
            name: 'Greek Yogurt',
            prepared_food: false,
            product_id: 2003,
            quantity: 1,
            unit: 'pz',
            vacuum_sealed: false,
          },
          location: 'frigo',
          locationLabel: 'fridge',
        }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    expect(writes).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeDisabled()

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const revertedToggle = screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })
    expect(revertedToggle).toHaveAttribute('aria-pressed', 'false')
    expect(revertedToggle).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to update prepared food')
    expect(writes).toHaveLength(1)
    vi.useRealTimers()
  })

  it('reverts and reports at ten seconds while a deferred write stays locked until authority', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    let resolveWrite: ((value: unknown) => void) | undefined
    let writeSettled = false
    const writes: Record<string, unknown>[] = []
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        writes.push(params)
        return new Promise((resolve) => {
          resolveWrite = resolve
        })
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && writeSettled) {
        return Promise.resolve({
          response: {
            inventory: [
              {
                expiry_date: offsetIsoDate(5),
                id: 203,
                location: 'frigo',
                name: 'Greek Yogurt',
                prepared_food: false,
                product_id: 2003,
                quantity: 1,
                unit: 'pz',
                vacuum_sealed: false,
              },
              {
                expiry_date: offsetIsoDate(5),
                id: 208,
                location: 'frigo',
                name: 'Greek Yogurt',
                prepared_food: true,
                product_id: 2003,
                quantity: 1,
                unit: 'pz',
                vacuum_sealed: false,
              },
            ],
          },
        })
      }
      return originalCallService(params)
    })

    render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        target={{
          item: {
            expiry_date: offsetIsoDate(5),
            id: 203,
            location: 'frigo',
            name: 'Greek Yogurt',
            prepared_food: false,
            product_id: 2003,
            quantity: 2,
            unit: 'pz',
            vacuum_sealed: false,
          },
          location: 'frigo',
          locationLabel: 'fridge',
        }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )

    const toggle = screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })
    fireEvent.click(toggle)
    expect(writes).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(10_000)
      await Promise.resolve()
    })
    const revertedToggle = screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })
    expect(revertedToggle).toHaveAttribute('aria-pressed', 'false')
    expect(revertedToggle).toBeDisabled()
    expect(screen.getByRole('spinbutton', { name: 'Quantity for Greek Yogurt' })).toHaveTextContent('2')
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to update prepared food')

    fireEvent.click(revertedToggle)
    expect(writes).toHaveLength(1)

    writeSettled = true
    await act(async () => {
      resolveWrite?.({})
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    const confirmedToggle = screen.getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })
    expect(confirmedToggle).toHaveAttribute('aria-pressed', 'true')
    expect(confirmedToggle).toBeEnabled()
    expect(writes).toHaveLength(1)
    vi.useRealTimers()
  })

  it('stops confirmation retries and external callbacks after unmount', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'prompt').mockReturnValue('1')
    let readCount = 0
    const onComplete = vi.fn()
    const onErrorChange = vi.fn()
    const onInventoryChanged = vi.fn(async () => [])
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') return Promise.resolve({})
      if (params.domain === 'evershelf' && params.service === 'list_inventory') {
        readCount += 1
        return Promise.resolve({
          response: {
            inventory: [{
              expiry_date: offsetIsoDate(5),
              id: 203,
              location: 'frigo',
              name: 'Greek Yogurt',
              prepared_food: false,
              product_id: 2003,
              quantity: 2,
              unit: 'pz',
              vacuum_sealed: false,
            }],
          },
        })
      }
      return originalCallService(params)
    })

    const view = render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={onComplete}
        onErrorChange={onErrorChange}
        onInventoryChanged={onInventoryChanged}
        target={{
          item: {
            expiry_date: offsetIsoDate(5),
            id: 203,
            location: 'frigo',
            name: 'Greek Yogurt',
            prepared_food: false,
            product_id: 2003,
            quantity: 2,
            unit: 'pz',
            vacuum_sealed: false,
          },
          location: 'frigo',
          locationLabel: 'fridge',
        }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(readCount).toBe(1)
    const readsBeforeUnmount = readCount
    const errorsBeforeUnmount = onErrorChange.mock.calls.length
    view.unmount()

    await act(async () => {
      vi.advanceTimersByTime(3_000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(readCount).toBe(readsBeforeUnmount)
    expect(onErrorChange).toHaveBeenCalledTimes(errorsBeforeUnmount)
    expect(onInventoryChanged).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not apply a stale generation after switching A to B and back to A with changed rows', async () => {
    const itemA = {
      expiry_date: offsetIsoDate(5),
      id: 203,
      location: 'frigo',
      name: 'Greek Yogurt',
      prepared_food: false,
      product_id: 2003,
      quantity: 1,
      unit: 'pz',
      vacuum_sealed: false,
    }
    const itemB = {
      expiry_date: offsetIsoDate(-10),
      id: 101,
      location: 'dispensa',
      name: 'Almond Flour',
      prepared_food: false,
      product_id: 1001,
      quantity: 1,
      unit: 'pz',
      vacuum_sealed: false,
    }
    let resolveOldRead: ((value: unknown) => void) | undefined
    let mutationStarted = false
    const originalCallService = mockState.helpers.callService
    vi.spyOn(mockState.helpers, 'callService').mockImplementation((params) => {
      if (params.domain === 'evershelf' && params.service === 'set_inventory_prepared_food') {
        mutationStarted = true
        return Promise.resolve({})
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && mutationStarted) {
        return new Promise((resolve) => {
          resolveOldRead = resolve
        })
      }
      return originalCallService(params)
    })

    const view = render(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        target={{ item: { ...itemA, groupedItems: [itemA] }, location: 'frigo', locationLabel: 'fridge' }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))
    await waitFor(() => expect(resolveOldRead).toEqual(expect.any(Function)))

    view.rerender(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        target={{ item: { ...itemB, groupedItems: [itemB] }, location: 'dispensa', locationLabel: 'pantry' }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )
    expect(screen.getByRole('button', { name: 'Prepared Food Item for Almond Flour' })).toHaveAttribute('aria-pressed', 'false')
    const replacementA = { ...itemA, id: 999, groupedItems: [{ ...itemA, id: 999 }] }
    view.rerender(
      <EverShelfInventoryDetailsPageHost
        active
        onComplete={vi.fn()}
        target={{ item: replacementA, location: 'frigo', locationLabel: 'fridge' }}
      >
        {(controller) => <EverShelfInventoryDetailsPage controller={controller} />}
      </EverShelfInventoryDetailsPageHost>,
    )
    resolveOldRead?.({
      response: {
        inventory: [{ ...itemA, prepared_food: true }],
      },
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })).toHaveAttribute('aria-pressed', 'false')
    view.unmount()
  })

  it('reads persisted EverShelf state after a fresh unmount and remount without client persistence', async () => {
    const firstView = render(<InventoryPanelHarness location="frigo" title="Fridge" />)
    await screen.findByLabelText('Fridge inventory list')
    firstView.unmount()

    setMockInventory('frigo', [{
      expiry_date: offsetIsoDate(5),
      id: 203,
      location: 'frigo',
      name: 'Greek Yogurt',
      prepared_food: true,
      product_id: 2003,
      quantity: 2,
      unit: 'pz',
      vacuum_sealed: false,
    }])
    const persistedDialog = await openGreekYogurtEditModal()
    expect(within(persistedDialog).getByRole('button', { name: /Prepared Food Item for Greek Yogurt.*prepared/i })).toHaveAttribute('aria-pressed', 'true')
    cleanup()

    setMockInventory('frigo', [{
      expiry_date: offsetIsoDate(5),
      id: 203,
      location: 'frigo',
      name: 'Greek Yogurt',
      prepared_food: false,
      product_id: 2003,
      quantity: 2,
      unit: 'pz',
      vacuum_sealed: false,
    }])
    const unpersistedDialog = await openGreekYogurtEditModal()
    expect(within(unpersistedDialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('asks how many to mark and sends only that many', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('1')
    const dialog = await openGreekYogurtEditModal()

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))

    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('How many of Greek Yogurt to mark as prepared?'), '2')
    expect(inventoryServiceCalls()).toEqual([
      {
        domain: 'evershelf',
        service: 'set_inventory_prepared_food',
        serviceData: { inventory_id: 203, prepared_food: true, quantity: 1 },
      },
    ])
  })

  it('spreads the requested count across the rows backing one batch', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('2')
    const dialog = await openCannedBeansEditModal()

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: `Prepared Food Item for Canned Beans ${SOON_BATCH}` }))

    // The soon batch is stored as two single-item rows, so both are flagged.
    expect(inventoryServiceCalls()).toEqual([
      { domain: 'evershelf', service: 'set_inventory_prepared_food', serviceData: { inventory_id: 102, prepared_food: true, quantity: 1 } },
      { domain: 'evershelf', service: 'set_inventory_prepared_food', serviceData: { inventory_id: 106, prepared_food: true, quantity: 1 } },
    ])
  })

  it('does nothing when the prompt is cancelled', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    const dialog = await openGreekYogurtEditModal()

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))

    expect(inventoryServiceCalls()).toEqual([])
  })

  it('rejects a count outside the available quantity', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('7')
    const dialog = await openGreekYogurtEditModal()

    mockCallServiceCalls.length = 0
    await clickAndFlush(within(dialog).getByRole('button', { name: 'Prepared Food Item for Greek Yogurt' }))

    expect(inventoryServiceCalls()).toEqual([])
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a number from 1 to 2.')
  })
})
