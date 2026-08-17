import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, mockState, resetMockHass } from '../../test/mocks/hakitCoreState'
import { ScanItemCameraSheet } from './ScanItemCameraSheet'

const PREPARED_TITLE = 'Prepared Food Item'
const PREPARED_SUBTITLE = 'Indicates this is a prepared food item and does not need classification.'
const PRODUCT_FINGERPRINT = 'f'.repeat(64)

function renderSheet() {
  return render(<ScanItemCameraSheet onClose={vi.fn()} open />)
}

/**
 * Walk the sheet from the barcode step to the review step.
 *
 * jsdom has no camera or manual-entry camera state. Enter the name on review,
 * then traverse back through the name-page boundary to exercise the same Next
 * transition used by the real manual-entry flow.
 */
function goToReviewStep(name = 'Leftover lasagna') {
  fireEvent.click(screen.getByRole('button', { name: 'Skip Barcode' }))
  fireEvent.click(screen.getByRole('button', { name: 'Skip Expiration' }))
  fireEvent.change(screen.getByLabelText('Product name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Back to expiration date' }))
  fireEvent.click(screen.getByRole('button', { name: 'Back to barcode scan' }))
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(screen.getByRole('button', { name: 'Skip Expiration' }))
}

describe('ScanItemCameraSheet prepared food flag', () => {
  beforeEach(() => resetMockHass())

  it('renders the checkbox unchecked with the expected heading, title, and subtitle', async () => {
    renderSheet()
    goToReviewStep()

    expect(screen.getByText('Prepared Food', { selector: 'legend' })).toBeInTheDocument()
    expect(screen.getByText(PREPARED_TITLE, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(PREPARED_SUBTITLE, { selector: 'small' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PREPARED_TITLE })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(mockCallServiceCalls.some((call) => call.service === 'suggest_location')).toBe(true))
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
          serviceData: {
            mode: 'manual',
            name: 'Milk',
            product_fingerprint: PRODUCT_FINGERPRINT,
            product_id: 123,
          },
        }))
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Fridge' })).toBeChecked())
        expect(screen.getByText('Selected from your previous EverShelf entries.')).toBeInTheDocument()
      } finally {
        mockState.helpers.callService = originalCallService
      }
    })

    it('waits until Next, then prepares before requesting one committed location lookup', async () => {
      renderSheet()
      fireEvent.click(screen.getByRole('button', { name: 'Skip Barcode' }))
      fireEvent.click(screen.getByRole('button', { name: 'Skip Expiration' }))
      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Mil' } })
      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Milk' } })

      expect(mockCallServiceCalls.filter((call) => call.domain === 'evershelf' && call.service === 'prepare_scanned_product')).toEqual([])
      expect(mockCallServiceCalls.filter((call) => call.domain === 'evershelf' && call.service === 'suggest_location')).toEqual([])
      fireEvent.click(screen.getByRole('button', { name: 'Back to expiration date' }))
      fireEvent.click(screen.getByRole('button', { name: 'Back to barcode scan' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      await waitFor(() => {
        const commitCalls = mockCallServiceCalls.filter((call) => (
          call.domain === 'evershelf'
          && (call.service === 'prepare_scanned_product' || call.service === 'suggest_location')
        ))
        expect(commitCalls).toEqual([{
          domain: 'evershelf',
          returnResponse: true,
          service: 'prepare_scanned_product',
          serviceData: { name: 'Milk' },
        }, {
          domain: 'evershelf',
          returnResponse: true,
          service: 'suggest_location',
          serviceData: {
            mode: 'manual',
            name: 'Milk',
            product_fingerprint: PRODUCT_FINGERPRINT,
            product_id: 123,
          },
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
        serviceData: {
          mode: 'manual',
          name: 'Mystery item',
          product_fingerprint: PRODUCT_FINGERPRINT,
          product_id: 123,
        },
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

    it('does not request a suggestion when preparation finishes after a manual location choice', async () => {
      const originalCallService = mockState.helpers.callService
      let resolvePrepare!: (value: unknown) => void
      mockState.helpers.callService = (params) => {
        if (params.domain === 'evershelf' && params.service === 'prepare_scanned_product') {
          mockCallServiceCalls.push(params)
          return new Promise((resolve) => {
            resolvePrepare = resolve
          })
        }
        return originalCallService(params)
      }

      try {
        renderSheet()
        goToReviewStep('Slow commit')
        await waitFor(() => expect(resolvePrepare).toEqual(expect.any(Function)))

        fireEvent.click(screen.getByRole('radio', { name: 'Freezer' }))
        resolvePrepare({
          response: {
            id: 501,
            product_fingerprint: 'c'.repeat(64),
            success: true,
          },
        })

        await waitFor(() => expect(screen.getByRole('radio', { name: 'Freezer' })).toBeChecked())
        expect(mockCallServiceCalls.filter((call) => call.service === 'suggest_location')).toEqual([])
        expect(screen.getByText('Location selected manually.')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        await waitFor(() => {
          const addCall = mockCallServiceCalls.find((call) => call.service === 'add_scanned_item')
          expect(addCall?.serviceData).toMatchObject({
            location: 'freezer',
            product_id: 501,
          })
        })
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

        fireEvent.click(screen.getByRole('button', { name: 'Back to expiration date' }))
        fireEvent.click(screen.getByRole('button', { name: 'Back to barcode scan' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByRole('button', { name: 'Skip Expiration' }))

        await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
          domain: 'evershelf',
          returnResponse: true,
          service: 'suggest_location',
          serviceData: {
            mode: 'manual',
            name: 'Bread',
            product_fingerprint: PRODUCT_FINGERPRINT,
            product_id: 123,
          },
        }))
        expect(mockCallServiceCalls).toContainEqual({
          domain: 'evershelf',
          returnResponse: true,
          service: 'prepare_scanned_product',
          serviceData: { name: 'Bread', product_id: 123 },
        })
        await waitFor(() => expect(screen.getByRole('radio', { name: 'Pantry' })).toBeChecked())
        expect(screen.getByRole('radio', { name: 'Fridge' })).not.toBeChecked()
      } finally {
        mockState.helpers.callService = originalCallService
      }
    })

    it('re-prepares a review-step name edit before the final add', async () => {
      renderSheet()
      goToReviewStep('Milk')
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'prepare_scanned_product',
        serviceData: { name: 'Milk' },
      }))

      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Bread' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'prepare_scanned_product',
        serviceData: { name: 'Bread', product_id: 123 },
      }))
      await waitFor(() => {
        const addCall = mockCallServiceCalls.find((call) => call.service === 'add_scanned_item')
        expect(addCall?.serviceData).toMatchObject({
          name: 'Bread',
          product_id: 123,
        })
      })
    })

    it('reuses a late prepared ID after a name edit without requesting the stale suggestion', async () => {
      const originalCallService = mockState.helpers.callService
      let resolveFirstPrepare!: (value: unknown) => void
      let prepareAttempts = 0
      mockState.helpers.callService = (params) => {
        if (params.domain === 'evershelf' && params.service === 'prepare_scanned_product') {
          mockCallServiceCalls.push(params)
          prepareAttempts += 1
          if (prepareAttempts === 1) {
            return new Promise((resolve) => {
              resolveFirstPrepare = resolve
            })
          }
          return Promise.resolve({
            response: {
              id: 321,
              product_fingerprint: 'b'.repeat(64),
              success: true,
            },
          })
        }
        if (params.domain === 'evershelf' && params.service === 'suggest_location') {
          mockCallServiceCalls.push(params)
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
        await waitFor(() => expect(resolveFirstPrepare).toEqual(expect.any(Function)))

        fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Bread' } })
        fireEvent.click(screen.getByRole('button', { name: 'Back to expiration date' }))
        fireEvent.click(screen.getByRole('button', { name: 'Back to barcode scan' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockCallServiceCalls.filter((call) => call.service === 'prepare_scanned_product')).toHaveLength(1)

        resolveFirstPrepare({
          response: {
            id: 321,
            product_fingerprint: 'a'.repeat(64),
            success: true,
          },
        })
        await waitFor(() => {
          expect(mockCallServiceCalls.filter((call) => call.service === 'suggest_location')).toEqual([])
        })

        await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
          domain: 'evershelf',
          returnResponse: true,
          service: 'prepare_scanned_product',
          serviceData: { name: 'Bread', product_id: 321 },
        }))
        await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
          domain: 'evershelf',
          returnResponse: true,
          service: 'suggest_location',
          serviceData: {
            mode: 'manual',
            name: 'Bread',
            product_fingerprint: 'b'.repeat(64),
            product_id: 321,
          },
        }))
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
    await waitFor(() => expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'suggest_location')).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')).toBe(true))
    const addCall = mockCallServiceCalls.find((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')
    expect(addCall?.serviceData).not.toHaveProperty('prepared_food')
    expect(addCall?.serviceData).toMatchObject({ product_id: 123 })
  })

  it('sends prepared_food when checked', async () => {
    renderSheet()
    goToReviewStep()
    fireEvent.click(screen.getByRole('button', { name: PREPARED_TITLE }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')).toBe(true))
    const addCall = mockCallServiceCalls.find((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')
    expect(addCall).toMatchObject({
      domain: 'evershelf',
      service: 'add_scanned_item',
    })
    expect(addCall?.serviceData).toMatchObject({ prepared_food: true })
  })

  it('waits for in-flight preparation and adds inventory with the committed product ID', async () => {
    const originalCallService = mockState.helpers.callService
    let resolvePrepare!: (value: unknown) => void
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'prepare_scanned_product') {
        mockCallServiceCalls.push(params)
        return new Promise((resolve) => {
          resolvePrepare = resolve
        })
      }
      return originalCallService(params)
    }

    try {
      renderSheet()
      goToReviewStep('Buttermilk')
      await waitFor(() => expect(resolvePrepare).toEqual(expect.any(Function)))

      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      expect(screen.getByText('Adding Item')).toBeInTheDocument()
      expect(mockCallServiceCalls.filter((call) => call.service === 'add_scanned_item')).toEqual([])

      resolvePrepare({
        response: {
          id: 186,
          product_fingerprint: 'd'.repeat(64),
          success: true,
        },
      })

      await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
        domain: 'evershelf',
        returnResponse: true,
        service: 'add_scanned_item',
        serviceData: expect.objectContaining({
          name: 'Buttermilk',
          product_id: 186,
        }),
      })))
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('falls back to add_scanned_item product saving when preparation fails', async () => {
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'prepare_scanned_product') {
        mockCallServiceCalls.push(params)
        return Promise.reject(new Error('Prepare unavailable'))
      }
      return originalCallService(params)
    }

    try {
      renderSheet()
      goToReviewStep('Fallback item')
      await waitFor(() => expect(screen.getByText('Storage suggestion unavailable; using the app default.')).toBeInTheDocument())

      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      await waitFor(() => expect(mockCallServiceCalls.some((call) => call.service === 'add_scanned_item')).toBe(true))
      const addCall = mockCallServiceCalls.find((call) => call.service === 'add_scanned_item')
      expect(addCall?.serviceData).toMatchObject({
        location: 'dispensa',
        name: 'Fallback item',
        quantity: 1,
      })
      expect(addCall?.serviceData).not.toHaveProperty('product_id')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('reuses the same idempotency key when an add is retried', async () => {
    const originalCallService = mockState.helpers.callService
    let addAttempts = 0
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'add_scanned_item') {
        mockCallServiceCalls.push(params)
        addAttempts += 1
        return addAttempts === 1
          ? Promise.reject(new Error('EverShelf busy'))
          : Promise.resolve({ response: { success: true } })
      }
      return originalCallService(params)
    }

    try {
      renderSheet()
      goToReviewStep('Buttermilk')
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('EverShelf busy'))

      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      await waitFor(() => expect(addAttempts).toBe(2))

      const addCalls = mockCallServiceCalls.filter((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')
      const firstKey = (addCalls[0].serviceData as { idempotency_key?: string }).idempotency_key
      const secondKey = (addCalls[1].serviceData as { idempotency_key?: string }).idempotency_key
      expect(firstKey).toMatch(/^scan-[A-Za-z0-9-]+$/)
      expect(secondKey).toBe(firstKey)
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('resets to unchecked when the sheet is closed and reopened', async () => {
    const onClose = vi.fn()
    const view = render(<ScanItemCameraSheet onClose={onClose} open />)
    goToReviewStep()
    await waitFor(() => expect(mockCallServiceCalls.some((call) => call.service === 'suggest_location')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: PREPARED_TITLE }))
    expect(screen.getByRole('button', { name: PREPARED_TITLE })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    view.rerender(<ScanItemCameraSheet onClose={onClose} open={false} />)
    view.rerender(<ScanItemCameraSheet onClose={onClose} open />)
    goToReviewStep()
    await waitFor(() => expect(mockCallServiceCalls.filter((call) => call.service === 'suggest_location')).toHaveLength(2))

    expect(screen.getByRole('button', { name: PREPARED_TITLE })).toHaveAttribute('aria-pressed', 'false')
  })
})
