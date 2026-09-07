import { expect, test } from '@playwright/test'
import { RESPONSIVE_ROUTES } from './responsive-acceptance-data'

test('hidden preload geometry performs no runtime I/O', async ({ page }) => {
  await page.addInitScript(() => {
    const audit = {
      eventListeners: 0,
      mutationObservations: 0,
      resizeObservations: 0,
    }
    ;(window as unknown as { __preloadIoAudit: typeof audit }).__preloadIoAudit = audit

    const originalAddEventListener = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function (...args) {
      if (this instanceof Element && this.closest('[data-dashboard-preload-cache]')) audit.eventListeners += 1
      return originalAddEventListener.apply(this, args)
    }

    const OriginalResizeObserver = window.ResizeObserver
    if (OriginalResizeObserver) {
      window.ResizeObserver = class extends OriginalResizeObserver {
        observe(target, options) {
          if (target instanceof Element && target.closest('[data-dashboard-preload-cache]')) audit.resizeObservations += 1
          return super.observe(target, options)
        }
      }
    }

    const OriginalMutationObserver = window.MutationObserver
    window.MutationObserver = class extends OriginalMutationObserver {
      observe(target, options) {
        if (target instanceof Element && target.closest('[data-dashboard-preload-cache]')) audit.mutationObservations += 1
        return super.observe(target, options)
      }
    }
  })

  await page.goto('/index.html?path=overview')
  const cache = page.locator('[data-dashboard-preload-cache="true"]')
  await expect(cache).toBeAttached()
  await expect(cache.locator('[data-preload-route]')).toHaveCount(RESPONSIVE_ROUTES.length)
  await expect(cache.locator('[data-preload-geometry="modal"]').first()).toBeAttached()
  await expect(cache.locator('[data-preload-modal="media#music-room-remote"]')).toBeAttached()
  await expect(cache.locator('[data-preload-modal="music-room#music-room-remote"]')).toBeAttached()
  await expect(cache.locator('[data-dynamic-grid="true"]')).toHaveCount(0)

  const audit = await page.evaluate(() => ({
    calls: window.__mockHass?.calls ?? [],
    images: document.querySelectorAll('[data-dashboard-preload-cache] :is(img, video, audio, source, iframe, object, embed, script, link, canvas)').length,
    cssLoads: Array.from(document.querySelectorAll('[data-dashboard-preload-cache], [data-dashboard-preload-cache] *')).flatMap((element) => (
      [undefined, '::before', '::after'].flatMap((pseudo) => {
        const style = getComputedStyle(element, pseudo)
        return ['background-image', 'mask-image', 'border-image-source', 'list-style-image', 'content']
          .flatMap((property) => /url\s*\(/i.test(style.getPropertyValue(property)) ? [property] : [])
      })
    )),
    io: (window as unknown as {
      __preloadIoAudit: {
        eventListeners: number
        mutationObservations: number
        resizeObservations: number
      }
    }).__preloadIoAudit,
  }))

  expect(audit.calls).toEqual([])
  expect(audit.images).toBe(0)
  expect(audit.cssLoads).toEqual([])
  expect(audit.io).toEqual({
    eventListeners: 0,
    mutationObservations: 0,
    resizeObservations: 0,
  })
})
