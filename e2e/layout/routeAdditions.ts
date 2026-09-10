import { expect, type Page } from './fixture'
import { INTENTIONAL_ROUTE_ADDITIONS } from './contracts'

async function sections(page: Page) {
  return page.locator('main section[id]').evaluateAll(elements => elements.map(element => {
    const round = (value: number) => Math.round(value * 10) / 10
    const box = element.getBoundingClientRect()
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
      id: element.id, x: round(box.x), y: round(box.y),
      width: round(box.width), height: round(box.height),
      content: [...element.querySelectorAll<HTMLElement>('h2, button[data-variant="card"], button[data-variant="card"] span, button[data-variant="card"] svg')]
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
  expect(after.map(section => section.id)).toEqual([contract.section, ...contract.inherited])
  const expected = contract.viewports[viewport]
  if (!expected) throw new Error(`Unclassified route-addition viewport: ${route}/${viewport}`)
  const addition = after[0]
  expect(addition.y).toBe(before[0].y)
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
  const tile = candidate.locator(selector).getByRole('button')
  await expect(tile).toHaveCount(1)
  await expect(tile).toHaveAttribute('data-variant', 'card')
  await expect(tile).toHaveAttribute('data-action-kind', 'modal')
  expect((await tile.boundingBox())!.height).toBeCloseTo(120, 3)
  expect((await tile.boundingBox())!.width).toBeCloseTo(expected.tileWidth, 3)
  expect(await tile.evaluate(node => getComputedStyle(node).borderRadius)).toBe('32px')
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
