import { fireEvent, render, screen } from '@testing-library/react'
import { ImageCard } from './ImageCard'

describe('ImageCard', () => {
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
