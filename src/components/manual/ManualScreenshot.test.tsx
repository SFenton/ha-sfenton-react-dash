import { render, screen } from '@testing-library/react'
import { ManualScreenshot } from './ManualScreenshot'

describe('ManualScreenshot', () => {
  it('uses desktop sources for fine-pointer and tablet layouts with mobile fallback', () => {
    const { container } = render(<ManualScreenshot id="app-layout-home" />)
    const image = screen.getByRole('img')
    const source = container.querySelector('source')

    expect(source?.getAttribute('media')).toContain('(any-hover: hover) and (any-pointer: fine)')
    expect(source?.getAttribute('media')).toContain('(min-width: 900px) and (min-height: 600px)')
    expect(source?.getAttribute('media')).toContain('(min-width: 700px) and (min-height: 700px)')
    expect(source?.getAttribute('srcset')).toContain('manual/manual-desktop/app-layout-home.png')
    expect(image.getAttribute('src')).toContain('manual/manual-mobile/app-layout-home.png')
    expect(image).toHaveAccessibleName(/Home page showing the header/i)
  })
})
