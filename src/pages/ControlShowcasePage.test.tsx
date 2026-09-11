import { fireEvent, render, screen } from '@testing-library/react'
import { ControlShowcasePage } from './ControlShowcasePage'

// @covers src/i18n/locales/en/pages/controlShowcase.json
describe('ControlShowcasePage', () => {
  it('keeps RGB and Kelvin edits local to the sample page', () => {
    render(<ControlShowcasePage />)

    fireEvent.change(screen.getByRole('spinbutton', { name: 'R channel' }), { target: { value: '20' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Choose a white temperature' }), { target: { value: '4200' } })

    expect(screen.getByText('RGB 20, 138, 61')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Choose a white temperature' })).toHaveAttribute('aria-valuenow', '4200')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
