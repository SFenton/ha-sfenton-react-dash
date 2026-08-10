import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { ImageCard } from './ImageCard'

describe('ImageCard', () => {
  it('keeps interactive recipe cards keyboard-focusable and activates through the button control', () => {
    const onActivate = vi.fn()
    render(
      <ImageCard
        imageUrl={null}
        onActivate={onActivate}
        title="Focus Recipe"
      />,
    )

    const card = screen.getByRole('button', { name: 'Open Focus Recipe' })
    card.focus()

    expect(card).toHaveFocus()
    expect(card).toHaveAttribute('data-interactive', 'true')
    fireEvent.click(card)
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it('falls back from a thumbnail to the original image and then to stable artwork', () => {
    const { container } = render(
      <ImageCard
        fallbackImageUrl="https://example.test/original.jpg"
        imageUrl="https://example.test/thumbnail.jpg"
        title="Fallback Recipe"
      />,
    )

    const thumbnail = container.querySelector('img')
    expect(thumbnail).not.toBeNull()
    expect(thumbnail).toHaveAttribute('src', 'https://example.test/thumbnail.jpg')
    fireEvent.error(thumbnail as HTMLImageElement)

    const original = container.querySelector('img')
    expect(original).not.toBeNull()
    expect(original).toHaveAttribute('src', 'https://example.test/original.jpg')
    fireEvent.error(original as HTMLImageElement)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('article', { name: 'Fallback Recipe' })).toHaveAttribute('data-image-state', 'fallback')
  })
})
