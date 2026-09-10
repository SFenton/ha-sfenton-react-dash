import { afterEach, describe, expect, it } from 'vitest'
import { installFocusAppearance } from './focusAppearance'

describe('installFocusAppearance', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
  })

  it('quiets pointer focus and restores keyboard navigation focus', () => {
    dispose = installFocusAppearance(document)
    expect(document.documentElement).toHaveAttribute('data-rd-quiet-focus')

    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }))
    expect(document.documentElement).not.toHaveAttribute('data-rd-quiet-focus')

    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
    expect(document.documentElement).toHaveAttribute('data-rd-quiet-focus')
  })

  it('does not restore focus decoration for text-entry keystrokes', () => {
    const input = document.createElement('input')
    document.body.append(input)
    dispose = installFocusAppearance(document)

    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    expect(document.documentElement).toHaveAttribute('data-rd-quiet-focus')

    input.remove()
  })
})
// @covers src/main.tsx
