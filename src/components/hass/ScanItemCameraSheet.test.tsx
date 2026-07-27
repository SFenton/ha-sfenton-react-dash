import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { ScanItemCameraSheet } from './ScanItemCameraSheet'

const PREPARED_TITLE = 'Prepared Food Item'
const PREPARED_SUBTITLE = 'Indicates this is a prepared food item and does not need classification.'

function renderSheet() {
  return render(<ScanItemCameraSheet onClose={vi.fn()} open />)
}

/**
 * Walk the sheet from the barcode step to the review step.
 *
 * jsdom has no camera, so the scan-specific controls never render; the skip actions are
 * the reachable path to the review step.
 */
function goToReviewStep(name = 'Leftover lasagna') {
  fireEvent.click(screen.getByRole('button', { name: 'Skip Barcode' }))
  fireEvent.click(screen.getByRole('button', { name: 'Skip Expiration' }))
  fireEvent.change(screen.getByLabelText('Product name'), { target: { value: name } })
}

describe('ScanItemCameraSheet prepared food flag', () => {
  beforeEach(() => resetMockHass())

  it('renders the checkbox unchecked with the expected heading, title, and subtitle', () => {
    renderSheet()
    goToReviewStep()

    expect(screen.getByText('Prepared Food', { selector: 'legend' })).toBeInTheDocument()
    expect(screen.getByText(PREPARED_TITLE, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(PREPARED_SUBTITLE, { selector: 'small' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREPARED_TITLE })).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles on and back off', () => {
    renderSheet()
    goToReviewStep()

    const checkbox = screen.getByRole('button', { name: PREPARED_TITLE })
    fireEvent.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-pressed', 'false')
  })

  it('omits prepared_food from the service call when left unchecked', async () => {
    renderSheet()
    goToReviewStep()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    expect(mockCallServiceCalls[0].serviceData).not.toHaveProperty('prepared_food')
  })

  it('sends prepared_food when checked', async () => {
    renderSheet()
    goToReviewStep()
    fireEvent.click(screen.getByRole('button', { name: PREPARED_TITLE }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    expect(mockCallServiceCalls[0]).toMatchObject({
      domain: 'evershelf',
      service: 'add_scanned_item',
    })
    expect(mockCallServiceCalls[0].serviceData).toMatchObject({ prepared_food: true })
  })

  it('resets to unchecked when the sheet is closed and reopened', () => {
    const onClose = vi.fn()
    const view = render(<ScanItemCameraSheet onClose={onClose} open />)
    goToReviewStep()

    fireEvent.click(screen.getByRole('button', { name: PREPARED_TITLE }))
    expect(screen.getByRole('button', { name: PREPARED_TITLE })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    view.rerender(<ScanItemCameraSheet onClose={onClose} open={false} />)
    view.rerender(<ScanItemCameraSheet onClose={onClose} open />)
    goToReviewStep()

    expect(screen.getByRole('button', { name: PREPARED_TITLE })).toHaveAttribute('aria-pressed', 'false')
  })
})
