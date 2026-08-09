import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRecipeControls, type RecipeControls } from './useRecipeControls'
import { RecipeFloatingActions } from './RecipeFloatingActions'

function Harness({ onControls }: { onControls?: (controls: RecipeControls) => void }) {
  const controls = useRecipeControls('test')
  onControls?.(controls)
  return <RecipeFloatingActions controls={controls} />
}

describe('RecipeFloatingActions', () => {
  it('opens the full-width search action as a focused editable field', () => {
    let controls: RecipeControls | undefined
    render(<Harness onControls={(next) => {
      controls = next
    }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Search recipes' }))
    const search = screen.getByRole('searchbox', { name: 'Search recipes' })
    expect(search).toHaveFocus()
    fireEvent.change(search, { target: { value: 'chicken' } })
    expect(search).toHaveValue('chicken')
    expect(controls?.searchQuery).toBe('chicken')
    expect(screen.getByRole('button', { hidden: true, name: 'Sort' }).parentElement).toHaveAttribute('data-collapsed', 'true')
    expect(screen.getByRole('button', { hidden: true, name: 'Filter' }).parentElement).toHaveAttribute('data-collapsed', 'true')
  })

  it('uses approved defaults and commits sort drafts only on Apply', async () => {
    let controls: RecipeControls | undefined
    render(<Harness onControls={(next) => {
      controls = next
    }} />)

    expect(controls?.criteria).toMatchObject({
      q: '',
      sort: 'availability',
      availabilityWeight: 100,
      expiryWeight: 25,
      minimumCoverage: 0,
    })
    expect(controls?.criteria.expiringWithinDays).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Sort' }))
    const sortDialog = await screen.findByRole('dialog', { name: 'Sort Recipes' })
    expect(within(sortDialog).getByRole('radio', { name: /Ingredients Available/i })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(within(sortDialog).getByRole('radio', { name: /Alphabetical/i }))
    expect(controls?.criteria.sort).toBe('availability')
    fireEvent.click(within(sortDialog).getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sort Recipes' })).not.toBeInTheDocument())
    expect(controls?.criteria.sort).toBe('alphabetical')

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    const filterDialog = await screen.findByRole('dialog', { name: 'Filter Recipes' })
    expect(within(filterDialog).getByText('Weights are unavailable while recipes are sorted alphabetically.')).toBeInTheDocument()
    expect(within(filterDialog).getByRole('slider', { name: 'Availability Weight' })).toBeDisabled()
    expect(within(filterDialog).getByRole('slider', { name: 'Expiry Weight' })).toBeDisabled()
  })

  it('keeps independent filter drafts, commits only on Apply, and resets drafts', async () => {
    let controls: RecipeControls | undefined
    render(<Harness onControls={(next) => {
      controls = next
    }} />)

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    let filterDialog = await screen.findByRole('dialog', { name: 'Filter Recipes' })
    const expiryToggle = within(filterDialog).getByLabelText('Turn on Use expiring ingredients only')
    fireEvent.click(expiryToggle)
    fireEvent.click(within(filterDialog).getByRole('radio', { name: /30 Days/i }))
    fireEvent.change(within(filterDialog).getByRole('slider', { name: 'Minimum Ingredients Available' }), { target: { value: '45' } })
    fireEvent.change(within(filterDialog).getByRole('slider', { name: 'Availability Weight' }), { target: { value: '65' } })
    fireEvent.change(within(filterDialog).getByRole('slider', { name: 'Expiry Weight' }), { target: { value: '80' } })

    expect(controls?.criteria).toMatchObject({
      availabilityWeight: 100,
      expiryWeight: 25,
      minimumCoverage: 0,
    })
    expect(controls?.criteria.expiringWithinDays).toBeUndefined()

    fireEvent.click(within(filterDialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Filter Recipes' })).not.toBeInTheDocument())
    expect(controls?.criteria).toMatchObject({
      expiringWithinDays: 30,
      minimumCoverage: 45,
      availabilityWeight: 65,
      expiryWeight: 80,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    filterDialog = await screen.findByRole('dialog', { name: 'Filter Recipes' })
    fireEvent.click(within(filterDialog).getByRole('button', { name: 'Reset' }))
    expect(within(filterDialog).getByRole('slider', { name: 'Minimum Ingredients Available' })).toHaveValue('0')
    expect(within(filterDialog).getByRole('slider', { name: 'Availability Weight' })).toHaveValue('100')
    expect(within(filterDialog).getByRole('slider', { name: 'Expiry Weight' })).toHaveValue('25')
    expect(controls?.criteria.minimumCoverage).toBe(45)
    fireEvent.click(within(filterDialog).getByRole('button', { name: 'Apply' }))
    expect(controls?.criteria).toMatchObject({
      availabilityWeight: 100,
      expiryWeight: 25,
      minimumCoverage: 0,
    })
    expect(controls?.criteria.expiringWithinDays).toBeUndefined()
  })
})
