import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, mockState, resetMockHass } from '../../test/mocks/hakitCoreState'
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

  describe('ScanItemCameraSheet storage suggestions', () => {
    beforeEach(() => resetMockHass())

    it('applies exact manual-name history in the background', async () => {
      const originalCallService = mockState.helpers.callService
      mockState.helpers.callService = (params) => {
        if (params.domain === 'evershelf' && params.service === 'suggest_location') {
          mockCallServiceCalls.push(params)
          return Promise.resolve({
            response: {
              confidence: 1,
              location: 'frigo',
              source: 'history_name',
              success: true,
            },
          })
        }
        return originalCallService(params)
      }

      try {
        renderSheet()
        goToReviewStep('Milk')

        expect(screen.getByRole('radio', { name: 'Pantry' })).toBeChecked()
        await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
          domain: 'evershelf',
          returnResponse: true,
          service: 'suggest_location',
          serviceData: { mode: 'manual', name: 'Milk' },
        }))
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Fridge' })).toBeChecked())
        expect(screen.getByText('Selected from your previous EverShelf entries.')).toBeInTheDocument()
      } finally {
        mockState.helpers.callService = originalCallService
      }
    })

    it('debounces manual typing into one location lookup', async () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Skip Barcode' }))
      fireEvent.click(screen.getByRole('button', { name: 'Skip Expiration' }))
      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Mil' } })
      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Milk' } })

      await waitFor(() => {
        const suggestionCalls = mockCallServiceCalls.filter((call) => call.domain === 'evershelf' && call.service === 'suggest_location')
        expect(suggestionCalls).toEqual([{
          domain: 'evershelf',
          returnResponse: true,
          service: 'suggest_location',
          serviceData: { mode: 'manual', name: 'Milk' },
        }])
      })
    })

    it('keeps the location-page fallback when EverShelf returns unknown', async () => {
      render(<ScanItemCameraSheet defaultLocation="freezer" onClose={vi.fn()} open />)
      goToReviewStep('Mystery item')

      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'suggest_location',
        serviceData: { mode: 'manual', name: 'Mystery item' },
      }))
      expect(screen.getByRole('radio', { name: 'Freezer' })).toBeChecked()
      expect(screen.getByText('No confident match; using the current page default.')).toBeInTheDocument()
    })

    it('keeps the app fallback and reports an unavailable background suggestion', async () => {
      const originalCallService = mockState.helpers.callService
      mockState.helpers.callService = (params) => {
        if (params.domain === 'evershelf' && params.service === 'suggest_location') {
          mockCallServiceCalls.push(params)
          return Promise.reject(new Error('EverShelf unavailable'))
        }
        return originalCallService(params)
      }

      try {
        renderSheet()
        goToReviewStep('Unknown item')

        await waitFor(() => expect(screen.getByText('Storage suggestion unavailable; using the app default.')).toBeInTheDocument())
        expect(screen.getByRole('radio', { name: 'Pantry' })).toBeChecked()
      } finally {
        mockState.helpers.callService = originalCallService
      }
    })

    it('does not let a late suggestion replace a manual location choice', async () => {
      const originalCallService = mockState.helpers.callService
      let resolveSuggestion!: (value: unknown) => void
      mockState.helpers.callService = (params) => {
        if (params.domain === 'evershelf' && params.service === 'suggest_location') {
          mockCallServiceCalls.push(params)
          return new Promise((resolve) => {
            resolveSuggestion = resolve
          })
        }
        return originalCallService(params)
      }

      try {
        renderSheet()
        goToReviewStep('Slow item')
        await waitFor(() => expect(resolveSuggestion).toEqual(expect.any(Function)))

        fireEvent.click(screen.getByRole('radio', { name: 'Freezer' }))
        expect(screen.getByText('Location selected manually.')).toBeInTheDocument()

        resolveSuggestion({
          response: {
            confidence: 1,
            location: 'frigo',
            source: 'history_name',
            success: true,
          },
        })

        await waitFor(() => expect(screen.getByRole('radio', { name: 'Freezer' })).toBeChecked())
        expect(screen.getByRole('radio', { name: 'Fridge' })).not.toBeChecked()
      } finally {
        mockState.helpers.callService = originalCallService
      }
    })

    it('does not apply a stale suggestion after the product name changes', async () => {
      const originalCallService = mockState.helpers.callService
      let resolveFirstSuggestion!: (value: unknown) => void
      mockState.helpers.callService = (params) => {
        if (params.domain === 'evershelf' && params.service === 'suggest_location') {
          mockCallServiceCalls.push(params)
          if ((params.serviceData as { name?: string } | undefined)?.name === 'Milk') {
            return new Promise((resolve) => {
              resolveFirstSuggestion = resolve
            })
          }
          return Promise.resolve({
            response: {
              confidence: 1,
              location: 'dispensa',
              source: 'history_name',
              success: true,
            },
          })
        }
        return originalCallService(params)
      }

      try {
        renderSheet()
        goToReviewStep('Milk')
        await waitFor(() => expect(resolveFirstSuggestion).toEqual(expect.any(Function)))

        fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Bread' } })
        resolveFirstSuggestion({
          response: {
            confidence: 1,
            location: 'frigo',
            source: 'history_name',
            success: true,
          },
        })

        await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
          domain: 'evershelf',
          returnResponse: true,
          service: 'suggest_location',
          serviceData: { mode: 'manual', name: 'Bread' },
        }))
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Pantry' })).toBeChecked())
        expect(screen.getByRole('radio', { name: 'Fridge' })).not.toBeChecked()
      } finally {
        mockState.helpers.callService = originalCallService
      }
    })
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
