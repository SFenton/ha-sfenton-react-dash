import { fireEvent, render, screen, within } from '@testing-library/react'
import { AtAGlancePage } from './AtAGlancePage'
import { materialIconPath } from '../components/core/iconPaths'
import { SECURITY_ENTITY } from '../constants/atAGlance'
import { CHORE_BLUE } from '../constants/portedDashboard'
import { mockEntities, resetMockHass } from '../test/mocks/hakitCoreState'

describe('AtAGlancePage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
  })

  it('opens the Air Quality overview from the header chip with room cards', async () => {
    mockEntities['input_text.office_aqi_color'].state = 'rgba(229, 57, 53, 1)'
    render(<AtAGlancePage />)

    fireEvent.click(screen.getByRole('button', { name: /Air Quality AQI 1 · PM2\.5 0μg\/m³ - 1μg\/m³/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Air Quality' })).toBeInTheDocument()
    expect(within(dialog).getByText('Rooms')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Living Room AQI 1 PM2.5 2 μg/m³')).toHaveStyle('--card-rgb: 0 150 136')
    expect(within(dialog).getByLabelText('Guest Room AQI 1 PM2.5 2 μg/m³')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Office AQI 1 PM2.5 2 μg/m³')).toHaveStyle('--card-rgb: 229 57 53')
    expect(within(dialog).queryByRole('button', { name: /Living Room AQI/i })).not.toBeInTheDocument()

    expect(within(dialog).getAllByText('1 • 2 μg/m³')).toHaveLength(6)
  })

  it('colors overview security tiles from the alarm state', () => {
    mockEntities[SECURITY_ENTITY].state = 'armed_night'
    render(<AtAGlancePage />)

    expect(screen.getByRole('button', { name: 'Security Armed Night' })).toHaveStyle('--header-pill-color: rgba(142, 36, 170, 0.44)')
    expect(screen.getByRole('button', { name: 'Security System Armed Night' })).toHaveStyle('--tile-color: rgba(142, 36, 170, 0.5)')
  })

  it('uses the shell header menu and More actions', async () => {
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByText('Navigation')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))
    expect(navigate).toHaveBeenCalledWith('security')

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('moves overview room navigation into the layout FAB sheet', async () => {
    const navigate = vi.fn()
    render(<AtAGlancePage onNavigate={navigate} />)

    expect(screen.queryByRole('heading', { name: 'Areas' })).not.toBeInTheDocument()
    const layoutButton = screen.getByRole('button', { name: 'Open room layout' })
    expect(layoutButton).toHaveStyle(`--card-rgb: ${CHORE_BLUE.r} ${CHORE_BLUE.g} ${CHORE_BLUE.b}`)
    expect(layoutButton.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:floor-plan'))
    fireEvent.click(layoutButton)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Living Room area' }))

    expect(navigate).toHaveBeenCalledWith('living-room')
  })
})
