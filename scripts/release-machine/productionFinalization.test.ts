// @covers scripts/release-machine/productionDriver.ts
import { describe, expect, it, vi } from 'vitest'
import { finalizeProductionRelease } from './productionFinalization'

describe('production release finalization', () => {
  it('runs repository cleanup when production adapter setup fails', async () => {
    const productionError = new Error('Missing SSH configuration')
    const cleanup = vi.fn(async () => undefined)
    await expect(
      finalizeProductionRelease(async () => {
        throw productionError
      }, cleanup),
    ).rejects.toBe(productionError)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('retains both production and cleanup failures', async () => {
    const productionError = new Error('Production finalization failed')
    const cleanupError = new Error('Repository cleanup failed')
    await expect(
      finalizeProductionRelease(
        async () => {
          throw productionError
        },
        async () => {
          throw cleanupError
        },
      ),
    ).rejects.toMatchObject({
      errors: [productionError, cleanupError],
      cause: cleanupError,
    })
  })
})
