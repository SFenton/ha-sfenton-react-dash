import { render, screen } from '@testing-library/react'
import { SettingsSection } from './SettingsSection'

describe('SettingsSection', () => {
  it('keeps the heading, description, and controls in one reusable section', () => {
    render(
      <SettingsSection description="How this setting affects the house." title="House Setting">
        <button type="button">Change setting</button>
      </SettingsSection>,
    )

    const settingsSection = document.querySelector('[data-settings-section="true"]')
    const section = screen.getByRole('heading', { name: 'House Setting' }).closest('section')
    expect(settingsSection).toContainElement(section)
    expect(section).toHaveAttribute('data-section-layout', 'true')
    expect(settingsSection?.querySelector('[data-settings-section-body="true"]')).toBeInTheDocument()
    expect(settingsSection?.querySelector('[data-settings-section-controls="true"]')).toContainElement(screen.getByRole('button', { name: 'Change setting' }))
    expect(screen.getByText('How this setting affects the house.')).toBeInTheDocument()
  })
})
