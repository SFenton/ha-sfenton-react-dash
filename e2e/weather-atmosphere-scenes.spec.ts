import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from './layout/fixture'
import { LEGACY_ENGINE_SKIPS } from './layout/contracts'
import { WEATHER_SCENES } from '../src/components/hass/weatherPresentation'
import { setWeatherSceneDebug } from './weather-scene-debug'

const VIEWPORTS = [
  { width: 393, height: 852 },
  { width: 852, height: 393 },
  { width: 1152, height: 741 },
  { width: 842, height: 836 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

async function openWeather(page: Page) {
  await page.goto('/index.html?path=overview')
  const opener = page.getByRole('button', { name: /Open seven-day weather forecast/ })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Weather', exact: true })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(650)
  return {
    opener,
    dialog,
    atmosphere: dialog.locator('[data-weather-scene]'),
  }
}

async function pin(atmosphere: Locator, time: number) {
  await atmosphere.evaluate((element, value) => {
    element.getAnimations({ subtree: true }).forEach((animation) => {
      animation.pause()
      animation.currentTime = value
    })
  }, time)
}

async function settleScene(atmosphere: Locator) {
  await expect.poll(() => atmosphere.evaluate((element) => (
    element.getAnimations({ subtree: true }).filter((animation) => animation instanceof CSSTransition).length
  ))).toBe(0)
}

async function closeAndRapidlyReopenWeather(page: Page) {
  return page.evaluate(() => new Promise<{ animationsPaused: boolean; closingObserved: boolean }>((resolve) => {
    const atmosphere = document.querySelector<HTMLElement>('[data-weather-scene]')
    const dialog = atmosphere?.closest<HTMLElement>('[role="dialog"]')
    const close = dialog?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    const opener = document.querySelector<HTMLButtonElement>('button[aria-label^="Open seven-day weather forecast"]')
    if (!dialog || !close || !opener || !atmosphere) throw new Error('Weather lifecycle controls are unavailable')
    close.click()
    const observeClosingFrame = () => {
      const closingObserved = dialog.getAttribute('data-closing') === 'true'
      const animationsPaused = atmosphere.getAnimations({ subtree: true })
        .every((animation) => animation.playState === 'paused')
      if (closingObserved && animationsPaused) {
        opener.click()
        resolve({ animationsPaused, closingObserved })
        return
      }
      requestAnimationFrame(observeClosingFrame)
    }
    requestAnimationFrame(observeClosingFrame)
  }))
}

async function pixelDifference(page: Page, first: Buffer, second: Buffer, cssWidth: number) {
  return page.evaluate(async ({ first, second, cssWidth }) => {
    const load = (value: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = `data:image/png;base64,${value}`
    })
    const [a, b] = await Promise.all([load(first), load(second)])
    if (a.width !== b.width || a.height !== b.height) throw new Error('Scene image dimensions changed')
    const canvas = document.createElement('canvas')
    canvas.width = a.width
    canvas.height = a.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Scene pixel comparison unavailable')
    const inset = Math.ceil(32 * a.width / cssWidth)
    const width = a.width - inset * 2
    const height = a.height - inset * 2
    context.drawImage(a, 0, 0)
    const before = context.getImageData(inset, inset, width, height).data
    context.clearRect(0, 0, a.width, a.height)
    context.drawImage(b, 0, 0)
    const after = context.getImageData(inset, inset, width, height).data
    let maxDelta = 0
    let changed = 0
    let totalDelta = 0
    for (let index = 0; index < before.length; index += 4) {
      const delta = Math.max(...[0, 1, 2].map((channel) => Math.abs(before[index + channel] - after[index + channel])))
      maxDelta = Math.max(maxDelta, delta)
      totalDelta += [0, 1, 2].reduce((sum, channel) => sum + Math.abs(before[index + channel] - after[index + channel]), 0)
      if (delta > 3) changed++
    }
    return { maxDelta, changedRatio: changed / (width * height), meanChannelDelta: totalDelta / (width * height * 3) }
  }, { first: first.toString('base64'), second: second.toString('base64'), cssWidth })
}

test('Rain retains the independently captured descriptors and original animation contract', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0])
  const { atmosphere } = await openWeather(page)
  await setWeatherSceneDebug(page, 'rain')
  await settleScene(atmosphere)
  const properties = await atmosphere.locator('[data-weather-raindrop]').evaluateAll((elements) => (
    elements.map((element) => {
      const style = (element as HTMLElement).style
      return Object.fromEntries(Array.from({ length: style.length }, (_, index) => style.item(index))
        .sort().map((name) => [name, style.getPropertyValue(name)]))
    })
  ))
  expect(createHash('sha256').update(JSON.stringify(properties)).digest('hex'))
    .toBe('d8c8be5974643f0105a34e8080aa764f8e1f1bdbd773da68922edc2631f9987b')
  const animations = await atmosphere.evaluate((element) => element.getAnimations({ subtree: true }).map((animation) => ({
    name: (animation as CSSAnimation).animationName,
    timing: { ...animation.effect!.getTiming(), iterations: String(animation.effect!.getTiming().iterations) },
    keyframes: (animation.effect as KeyframeEffect).getKeyframes(),
  })))
  expect(animations).toHaveLength(35)
  expect(animations.every((animation) => animation.timing.iterations === 'Infinity')).toBe(true)
  const light = animations.find((animation) => animation.name.includes('weatherLightDrift'))!
  expect(light.timing).toMatchObject({ delay: 0, direction: 'alternate', duration: 28_000 })
  const values = await atmosphere.evaluate((element, frames) => {
    const probe = document.createElement('span')
    Object.assign(probe.style, { position: 'absolute', width: '100px', height: '100px', visibility: 'hidden' })
    element.append(probe)
    const values = frames.map(({ transform, easing }) => {
      probe.style.transform = String(transform)
      const matrix = new DOMMatrixReadOnly(getComputedStyle(probe).transform)
      return { x: matrix.e, y: matrix.f, scaleX: matrix.a, scaleY: matrix.d, easing }
    })
    probe.remove()
    return values
  }, light.keyframes)
  // The existing build minifier serializes zero-Z translate3d as translate.
  expect(values).toEqual([
    { x: -2, y: -1, scaleX: 1.02, scaleY: 1.02, easing: 'ease-in-out' },
    { x: 3, y: 2, scaleX: 1.08, scaleY: 1.08, easing: 'ease-in-out' },
  ])
  const dropMidpoint = await atmosphere.locator('[data-weather-raindrop]').nth(1).evaluate((element) => {
    const animation = element.getAnimations()[0]
    const timing = animation.effect!.getTiming()
    animation.pause()
    animation.currentTime = timing.delay + Number(timing.duration) * 3.5
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
    return { x: matrix.e, y: matrix.f, expectedX: parseFloat(getComputedStyle(element).getPropertyValue('--rain-drift')) / 2, expectedY: innerHeight / 2 }
  })
  expect(dropMidpoint.x).toBeCloseTo(dropMidpoint.expectedX, 1)
  expect(dropMidpoint.y).toBeCloseTo(dropMidpoint.expectedY, 1)
  await expect(atmosphere.locator('[data-weather-snowflake], [data-weather-storm-flash]')).toHaveCount(0)
})

test('Snow is a bounded scene-local SVG field across the canonical layouts', async ({ page }, testInfo) => {
  const { atmosphere, dialog } = await openWeather(page)
  await setWeatherSceneDebug(page, 'snow')
  await settleScene(atmosphere)
  const id = await dialog.getAttribute('id')
  for (const viewport of [
    ...VIEWPORTS,
    { width: 765, height: 900 },
    { width: 766, height: 900 },
    { width: 767, height: 900 },
    VIEWPORTS[0],
  ]) {
    await page.setViewportSize(viewport)
    await expect(atmosphere.locator('[data-weather-snowflake]')).toHaveCount(34)
    const geometry = await atmosphere.evaluate((element) => {
      const field = element.querySelector('[data-weather-snow-field]')!
      const bounds = field.getBoundingClientRect()
      const flakes = [...field.querySelectorAll<SVGSVGElement>('[data-weather-snowflake]')]
        .filter((flake) => getComputedStyle(flake).display !== 'none')
      return {
        width: bounds.width, height: bounds.height,
        count: flakes.length,
        maxFlakeBox: Math.max(...flakes.map((flake) => Math.max(flake.getBoundingClientRect().width, flake.getBoundingClientRect().height))),
        animations: element.getAnimations({ subtree: true }).length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        finePointer: matchMedia('(pointer: fine)').matches,
        supportsCqh: CSS.supports('height', '1cqh'),
      }
    })
    expect(geometry.supportsCqh).toBe(true)
    expect(geometry.count).toBe(geometry.width >= 700 ? 34 : 28)
    expect(geometry.animations).toBe(geometry.count + 1)
    expect(geometry.maxFlakeBox).toBeLessThan(18)
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    await expect(dialog).toHaveAttribute('id', id!)
    if (testInfo.project.name === 'desktop') expect(geometry.finePointer).toBe(true)
  }
})

const WEBKIT_LIFECYCLE_RESTRICTION = LEGACY_ENGINE_SKIPS.find((rule) =>
  rule.spec === 'weather-atmosphere-scenes.spec.ts'
  && rule.title === 'new atmospheric elements follow CSS-owned close, reduced-motion and forced-color lifecycle'
  && rule.browser === 'webkit')

if (!WEBKIT_LIFECYCLE_RESTRICTION) throw new Error('Missing declared WebKit weather lifecycle restriction')

test('new atmospheric elements follow CSS-owned close, reduced-motion and forced-color lifecycle', async ({ browserName, page }) => {
  test.skip(browserName === WEBKIT_LIFECYCLE_RESTRICTION.browser, WEBKIT_LIFECYCLE_RESTRICTION.reason)
  const { atmosphere, dialog, opener } = await openWeather(page)
  for (const scene of WEATHER_SCENES.filter((value) => value !== 'rain')) {
    await setWeatherSceneDebug(page, scene)
    await settleScene(atmosphere)
    expect(await closeAndRapidlyReopenWeather(page)).toEqual({ animationsPaused: true, closingObserved: true })
    await expect(dialog).toHaveAttribute('data-state', 'open')
    await expect(dialog).not.toHaveAttribute('data-closing', 'true')
    await expect(atmosphere).toHaveAttribute('data-weather-scene', scene)
    await expect.poll(() => atmosphere.evaluate((element) => element.getAnimations({ subtree: true })
      .every((animation) => animation.playState === 'running'))).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => atmosphere.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0)
    if (scene === 'snow') {
      const staticFlakes = await atmosphere.locator('[data-weather-snowflake]').evaluateAll((elements) => elements
        .filter((element) => getComputedStyle(element).display !== 'none')
        .map((element) => {
          const style = getComputedStyle(element)
          const matrix = new DOMMatrixReadOnly(style.transform)
          return {
            angle: parseFloat(style.getPropertyValue('--snow-angle')),
            a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, x: matrix.e, y: matrix.f,
          }
        }))
      expect(staticFlakes).toHaveLength(12)
      expect(new Set(staticFlakes.map((flake) => flake.angle)).size).toBeGreaterThan(8)
      for (const flake of staticFlakes) {
        const angle = flake.angle * Math.PI / 180
        expect(flake.a).toBeCloseTo(Math.cos(angle), 5)
        expect(flake.b).toBeCloseTo(Math.sin(angle), 5)
        expect(flake.c).toBeCloseTo(-Math.sin(angle), 5)
        expect(flake.d).toBeCloseTo(Math.cos(angle), 5)
        expect(flake.x).toBe(0)
        expect(flake.y).toBe(0)
      }
    }
    if (scene === 'wind') {
      expect(await atmosphere.locator('[data-weather-wind-wisp]').evaluateAll((elements) => elements
        .filter((element) => getComputedStyle(element).display !== 'none').length)).toBe(2)
    }
    if (scene === 'storm') await expect(atmosphere.locator('[data-weather-storm-flash]')).toHaveCSS('display', 'none')
    await page.emulateMedia({ forcedColors: 'active' })
    await expect(atmosphere).toHaveCSS('display', 'none')
    await page.emulateMedia({ forcedColors: 'none', reducedMotion: 'no-preference' })
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 700 })
  await opener.click()
  await expect(atmosphere).toHaveAttribute('data-weather-scene', 'neutral')
})

test('Storm has three isolated slow illumination envelopes and bounded cloud geometry', async ({ page }) => {
  const { atmosphere } = await openWeather(page)
  await setWeatherSceneDebug(page, 'storm')
  await settleScene(atmosphere)
  const result = await atmosphere.evaluate((element) => {
    const flash = element.querySelector('[data-weather-storm-flash]')!
    const animation = flash.getAnimations()[0]
    const timing = animation.effect!.getTiming()
    const keys = (animation.effect as KeyframeEffect).getKeyframes()
    animation.pause()
    const marks = keys.map((key) => {
      const time = key.computedOffset * Number(timing.duration)
      animation.currentTime = time
      return { time, opacity: Number(getComputedStyle(flash).opacity) }
    })
    const peaks = marks.filter((key) => key.opacity > .001)
    const intervals = marks.slice(0, -1).map((start, index) => {
      const end = marks[index + 1]
      const samples = [0, .25, .5, .75, 1].map((progress) => {
        animation.currentTime = start.time + (end.time - start.time) * progress
        return Number(getComputedStyle(flash).opacity)
      })
      return {
        bounded: samples.every((opacity) => opacity >= Math.min(start.opacity, end.opacity) - .0001
          && opacity <= Math.max(start.opacity, end.opacity) + .0001),
        monotonic: samples.slice(1).every((opacity, sample) => end.opacity >= start.opacity
          ? opacity >= samples[sample] - .0001
          : opacity <= samples[sample] + .0001),
      }
    })
    const bounds = element.getBoundingClientRect()
    const area = [...element.children].filter((child) => !child.hasAttribute('data-weather-rain-field'))
      .reduce((sum, child) => {
        const box = child.getBoundingClientRect()
        return sum + box.width * box.height
      }, 0)
    return {
      duration: timing.duration, delay: timing.delay, peaks, intervals,
      easings: [timing.easing, ...keys.map((key) => key.easing)],
      areaRatio: area / (bounds.width * bounds.height),
    }
  })
  expect(result.duration).toBe(61_000)
  expect(result.delay).toBe(0)
  expect(result.peaks).toHaveLength(3)
  expect(result.easings.every((easing) => ['linear', 'ease-in', 'ease-out', 'ease-in-out'].includes(easing))).toBe(true)
  expect(result.intervals.every((interval) => interval.bounded && interval.monotonic)).toBe(true)
  for (const [index, time] of [9000, 28000, 54000].entries()) {
    expect(result.peaks[index].time).toBeCloseTo(time, 1)
    expect(result.peaks[index].opacity).toBeCloseTo([.24, .30, .26][index], 3)
    expect(result.peaks[index].opacity).toBeLessThanOrEqual(.30)
  }
  const gaps = result.peaks.map((peak, index) => (
    (result.peaks[(index + 1) % 3].time + (index === 2 ? 61_000 : 0)) - peak.time
  ))
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(9000)
  expect(result.areaRatio).toBeLessThanOrEqual(2)
  await expect(atmosphere.locator('[data-weather-raindrop]')).toHaveCount(44)
})

test('Fog remains bounded and organic Wind wisps reset only while invisible', async ({ page }, testInfo) => {
  const { atmosphere, dialog } = await openWeather(page)
  await setWeatherSceneDebug(page, 'fog')
  await settleScene(atmosphere)
  const fog = await atmosphere.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      animations: element.getAnimations({ subtree: true }).length,
      area: [...element.children].reduce((sum, child) => {
        const box = child.getBoundingClientRect()
        return sum + box.width * box.height
      }, 0) / (bounds.width * bounds.height),
      repeating: [...element.children].some((child) => getComputedStyle(child).backgroundImage.includes('repeating-')),
    }
  })
  expect(fog.animations).toBe(2)
  expect(fog.area).toBeLessThanOrEqual(2.6)
  expect(fog.repeating).toBe(false)

  await setWeatherSceneDebug(page, 'wind')
  await expect(atmosphere).toHaveAttribute('data-weather-scene', 'wind')
  await settleScene(atmosphere)
  const wisps = atmosphere.locator('[data-weather-wind-wisp]')
  await expect(wisps).toHaveCount(4)
  expect(await atmosphere.evaluate((element) => ({
    animations: element.getAnimations({ subtree: true }).length,
    tiled: [...element.querySelectorAll('*')].some((node) => getComputedStyle(node).backgroundImage.includes('repeating-')),
  }))).toEqual({ animations: 4, tiled: false })
  const motion = wisps.first()
  const foreground = dialog.locator('[data-modal-sheet-body]').locator('..')
  await foreground.evaluate((element) => { (element as HTMLElement).style.visibility = 'hidden' })
  await pin(atmosphere, 14_000)
  const timing = await motion.evaluate((element) => element.getAnimations()[0].effect!.getTiming())
  const duration = Number(timing.duration)
  const boundary = timing.delay + Math.max(1, Math.ceil((1 - timing.delay) / duration)) * duration
  const capture = async (time: number) => {
    await motion.evaluate((element, currentTime) => {
      const animation = element.getAnimations()[0]
      animation.pause()
      animation.currentTime = currentTime
      const others = element.closest('[data-weather-scene]')!.getAnimations({ subtree: true }).filter((other) => other !== animation)
      if (others.some((other) => other.playState !== 'paused' || other.currentTime !== 14000)) throw new Error('Non-target animation was not held fixed')
    }, time)
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    return atmosphere.screenshot({ animations: 'allow' })
  }
  const width = (await atmosphere.boundingBox())!.width
  const before = await capture(boundary - 1)
  const after = await capture(boundary + 1)
  const difference = await pixelDifference(page, before, after, width)
  await testInfo.attach('wind-wrap-difference', { body: JSON.stringify(difference), contentType: 'application/json' })
  await testInfo.attach('wind-wrap-before', { body: before, contentType: 'image/png' })
  await testInfo.attach('wind-wrap-after', { body: after, contentType: 'image/png' })
  await writeFile(testInfo.outputPath('wind-wrap-difference.json'), JSON.stringify(difference))
  await writeFile(testInfo.outputPath('wind-wrap-before.png'), before)
  await writeFile(testInfo.outputPath('wind-wrap-after.png'), after)
  expect(difference.maxDelta).toBeLessThanOrEqual(1)
  expect(difference.changedRatio).toBe(0)
  const control = await capture(boundary - duration / 2)
  const positive = await pixelDifference(page, after, control, width)
  expect(positive.maxDelta).toBeGreaterThan(5)
  expect(positive.changedRatio).toBeGreaterThan(.0001)
  await foreground.evaluate((element) => { (element as HTMLElement).style.removeProperty('visibility') })
})

test('Night uses one coherent star plane without tiled textures or individual twinkling', async ({ page }) => {
  const { atmosphere } = await openWeather(page)
  await setWeatherSceneDebug(page, 'night')
  await settleScene(atmosphere)
  const stars = atmosphere.locator('[data-weather-night-star]')
  await expect(stars).toHaveCount(35)
  const data = await atmosphere.evaluate((element) => ({
    total: element.getAnimations({ subtree: true }).length,
    individuallyAnimated: [...element.querySelectorAll('[data-weather-night-star]')].some((star) => star.getAnimations().length > 0),
    tiled: [...element.querySelectorAll('*')].some((node) => getComputedStyle(node).backgroundImage.includes('repeating-')),
    positions: [...element.querySelectorAll('[data-weather-night-star]')].map((star) => `${getComputedStyle(star).left},${getComputedStyle(star).top}`),
  }))
  expect(data.total).toBe(1)
  expect(data.individuallyAnimated).toBe(false)
  expect(data.tiled).toBe(false)
  expect(new Set(data.positions).size).toBe(35)
})

test('Snow particle wraps use their negative delays and stay outside the clipped field', async ({ page }) => {
  const { atmosphere } = await openWeather(page)
  await setWeatherSceneDebug(page, 'snow')
  await pin(atmosphere, 14_000)
  const results = await atmosphere.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return [0, 13, 27].map((index) => {
      const flake = element.querySelectorAll('[data-weather-snowflake]')[index]
      const animation = flake.getAnimations()[0]
      const timing = animation.effect!.getTiming()
      const duration = Number(timing.duration)
      const iteration = Math.max(1, Math.ceil((1 - timing.delay) / duration))
      const boundary = timing.delay + iteration * duration
      const states = [-1, 1].map((offset) => {
        animation.currentTime = boundary + offset
        const box = flake.getBoundingClientRect()
        return {
          iteration: animation.effect!.getComputedTiming().currentIteration,
          visibleArea: Math.max(0, Math.min(bounds.right, box.right) - Math.max(bounds.left, box.left))
            * Math.max(0, Math.min(bounds.bottom, box.bottom) - Math.max(bounds.top, box.top)),
        }
      })
      return { iteration, states }
    })
  })
  for (const result of results) {
    expect(result.states.map((state) => state.iteration)).toEqual([result.iteration - 1, result.iteration])
    expect(result.states.every((state) => state.visibleArea === 0)).toBe(true)
  }
})
