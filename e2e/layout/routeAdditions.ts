import { expect, type Page } from './fixture'
import { INTENTIONAL_ROUTE_ADDITIONS, INTENTIONAL_TILE_ADDITIONS } from './contracts'

async function sections(page: Page) {
  return page.locator('main [data-responsive-section-item="true"] > section').evaluateAll(elements => elements.map(element => {
    const round = (value: number) => Math.round(value * 10) / 10
    const box = element.getBoundingClientRect()
    const heading = element.querySelector('h2')?.textContent?.trim() ?? ''
    const fallbackId = `section-${heading.toLowerCase().replaceAll(/\s+/g, '-')}`
    const describe = (node: HTMLElement) => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return {
        text: node.getAttribute('aria-label') ?? node.textContent,
        semantics: node.dataset.actionKind,
        width: round(rect.width), height: round(rect.height),
        x: round(rect.x - box.x), y: round(rect.y - box.y),
        color: style.color, background: style.backgroundColor, radius: style.borderRadius,
        padding: style.padding, font: style.font, lineHeight: style.lineHeight,
      }
    }
    return {
      id: element.id || fallbackId, x: round(box.x), y: round(box.y),
      width: round(box.width), height: round(box.height),
      content: [...element.querySelectorAll<HTMLElement>('h2, button[data-action-kind], button[data-action-kind] span, button[data-action-kind] svg')]
        .map(describe),
    }
  }))
}

export async function inspectRouteAddition(baseline: Page, candidate: Page, route: string, viewport: string) {
  const contract = INTENTIONAL_ROUTE_ADDITIONS[route]
  if (!contract) return null
  const selector = `[id="${contract.section}"]`
  if (await baseline.locator(selector).count()) return null
  await expect(candidate.locator(selector)).toHaveCount(1)
  const before = await sections(baseline)
  const after = await sections(candidate)
  expect(before.map(section => section.id)).toEqual(contract.inherited)
  const expectedSections = [...contract.inherited]
  expectedSections.splice(contract.insertionIndex, 0, contract.section)
  expect(after.map(section => section.id)).toEqual(expectedSections)
  const expected = contract.viewports[viewport]
  if (!expected) throw new Error(`Unclassified route-addition viewport: ${route}/${viewport}`)
  const addition = after[contract.insertionIndex]
  expect(addition.x).toBe(before[contract.insertionIndex].x)
  expect(addition.y).toBe(before[contract.insertionIndex].y)
  expect(addition.height).toBe(expected.height)
  expect(addition.width).toBe(expected.width)
  for (const previous of before) {
    const current = after.find(section => section.id === previous.id)!
    const shift = expected.shifts[previous.id as keyof typeof expected.shifts]
    if (!shift) throw new Error(`Missing route-addition shift: ${route}/${viewport}/${previous.id}`)
    expect(Math.abs(current.x - previous.x - shift.x), `${previous.id} x`).toBeLessThanOrEqual(1)
    expect(Math.abs(current.y - previous.y - shift.y), `${previous.id} y`).toBeLessThanOrEqual(1)
    expect({ ...current, x: previous.x, y: previous.y }, previous.id).toEqual(previous)
  }
  const section = candidate.locator(selector)
  await expect(section.getByRole('heading', { level: 2, name: contract.heading })).toHaveCount(1)
  if (contract.description) await expect(section.getByText(contract.description, { exact: true })).toHaveCount(1)
  const tile = section.getByRole('button', { name: contract.tile.name })
  await expect(tile).toHaveCount(1)
  if (contract.tile.variant) await expect(tile).toHaveAttribute('data-variant', contract.tile.variant)
  await expect(tile).toHaveAttribute('data-action-kind', contract.tile.actionKind)
  expect((await tile.boundingBox())!.height).toBeCloseTo(expected.tileHeight, 3)
  expect((await tile.boundingBox())!.width).toBeCloseTo(expected.tileWidth, 3)
  expect(await tile.evaluate(node => getComputedStyle(node).borderRadius)).toBe(contract.tile.radius)
  return { owner: contract.owner, selector, before, after, expected }
}

export async function normalizeInspectedAddition(page: Page, inspection: NonNullable<Awaited<ReturnType<typeof inspectRouteAddition>>>) {
  const item = page.locator(inspection.selector).locator('..')
  await expect(item).toHaveAttribute('data-responsive-section-item', 'true')
  const originalStyle = await item.getAttribute('style')
  await item.evaluate(node => { (node as HTMLElement).style.display = 'none' })
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
  return async () => {
    await item.evaluate((node, value) => {
      if (value === null) node.removeAttribute('style')
      else node.setAttribute('style', value)
    }, originalStyle)
  }
}

function sectionWithHeading(page: Page, heading: string) {
  return page.locator('main section').filter({ has: page.getByRole('heading', { level: 2, name: heading, exact: true }) })
}

async function sectionTiles(page: Page, heading: string) {
  const section = sectionWithHeading(page, heading)
  await expect(section, `declared tile section: ${heading}`).toHaveCount(1)
  return section.evaluate(element => [...element.querySelectorAll<HTMLElement>('[data-dynamic-grid="true"]')]
    .flatMap((grid, gridIndex) => [...grid.querySelectorAll<HTMLElement>(':scope > [data-dynamic-grid-cell="true"]')].map((cell) => {
      const round = (value: number) => Math.round(value * 10) / 10
      const button = cell.querySelector<HTMLElement>('button[data-action-kind]')
      const style = button ? getComputedStyle(button) : null
      const rect = (button ?? cell).getBoundingClientRect()
      return {
        gridIndex,
        name: (button?.getAttribute('aria-label') ?? button?.textContent ?? '').trim(),
        actionKind: button?.dataset.actionKind ?? null,
        variant: button?.dataset.variant ?? null,
        width: round(rect.width), height: round(rect.height),
        radius: style?.borderRadius ?? null, font: style?.font ?? null,
        color: style?.color ?? null, background: style?.backgroundColor ?? null,
      }
    })))
}

export async function inspectTileAddition(baseline: Page, candidate: Page, route: string) {
  const contract = INTENTIONAL_TILE_ADDITIONS[route]
  if (!contract) return null
  const before = await sectionTiles(baseline, contract.section)
  if (before.some(tile => contract.tile.name.test(tile.name))) return null
  const after = await sectionTiles(candidate, contract.section)
  const matches = after.flatMap((tile, index) => contract.tile.name.test(tile.name) ? [index] : [])
  expect(matches, `${route}: declared tile position`).toEqual([contract.insertionIndex])
  const added = after[contract.insertionIndex]
  const inherited = after.filter((_, index) => index !== contract.insertionIndex)
  expect(inherited, `${route}: inherited ${contract.section} tiles`).toEqual(before)
  expect(added.actionKind, `${route}: declared tile action`).toBe(contract.tile.actionKind)
  const sibling = after[contract.insertionIndex - 1] ?? after[contract.insertionIndex + 1]
  if (!sibling) throw new Error(`Declared tile has no sibling: ${route}`)
  const shape = ({ gridIndex, actionKind, variant, width, height, radius, font }: typeof added) => ({ gridIndex, actionKind, variant, width, height, radius, font })
  expect(shape(added), `${route}: declared tile matches its sibling geometry and style`).toEqual(shape(sibling))
  return { owner: contract.owner, source: contract.source, section: contract.section, index: contract.insertionIndex, added, before }
}

export async function normalizeInspectedTileAddition(page: Page, inspection: NonNullable<Awaited<ReturnType<typeof inspectTileAddition>>>) {
  const cell = sectionWithHeading(page, inspection.section)
    .locator('[data-dynamic-grid="true"] > [data-dynamic-grid-cell="true"]')
    .nth(inspection.index)
  await expect(cell.locator('button[data-action-kind]')).toHaveAccessibleName(inspection.added.name)
  const originalStyle = await cell.getAttribute('style')
  await cell.evaluate(node => { (node as HTMLElement).style.display = 'none' })
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))))
  return async () => {
    await cell.evaluate((node, value) => {
      if (value === null) node.removeAttribute('style')
      else node.setAttribute('style', value)
    }, originalStyle)
  }
}
