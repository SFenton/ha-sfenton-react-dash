import { fireEvent, render, screen, within } from '@testing-library/react'
import { AtAGlancePage } from './AtAGlancePage'
import { mockEntities, resetMockHass } from '../test/mocks/hakitCoreState'

describe('AtAGlancePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
  })

  it('opens the Air Quality overview from the header chip with non-clickable AQI room cards', async () => {
    mockEntities['input_text.office_aqi_color'].state = 'rgba(229, 57, 53, 1)'
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /Air Quality AQI 1 · PM2\.5 0μg\/m³ - 1μg\/m³/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Rooms')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Living Room AQI 1 PM2.5 2μg/m³')).toHaveStyle('--card-rgb: 0 150 136')
    expect(within(dialog).getByLabelText('Guest Room AQI 1 PM2.5 2μg/m³')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Office AQI 1 PM2.5 2μg/m³')).toHaveStyle('--card-rgb: 229 57 53')
    expect(within(dialog).queryByRole('button', { name: /Living Room AQI/i })).not.toBeInTheDocument()

    expect(within(dialog).getAllByText('AQI 1')).toHaveLength(6)
    expect(within(dialog).getAllByText('PM2.5 2μg/m³')).toHaveLength(6)
  })

  it('uses the shell header menu and More actions', async () => {
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
  expect(screen.getByText('Navigation')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close navigation menu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))
    expect(navigate).toHaveBeenCalledWith('security')

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })
})
