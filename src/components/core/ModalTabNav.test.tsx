import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { ModalIconTabNav } from './ModalTabNav'
import { materialIconPath } from './iconPaths'
import { modalTabId, modalTabPanelId } from './modalTabIds'

type TestTab = 'general' | 'ingredients' | 'instructions'

const TABS = [
  { icon: 'mdi:information-outline', label: 'General', tab: 'general' },
  { icon: 'mdi:format-list-checkbox', label: 'Ingredients', tab: 'ingredients' },
  { icon: 'mdi:chef-hat', label: 'Instructions', tab: 'instructions' },
] as const

function Harness() {
  const [activeTab, setActiveTab] = useState<TestTab>('general')
  return (
    <>
      <ModalIconTabNav
        activeTab={activeTab}
        idPrefix="test-detail"
        label="Recipe sections"
        onTabChange={setActiveTab}
        tabs={TABS}
      />
      <div
        aria-labelledby={modalTabId('test-detail', activeTab)}
        id={modalTabPanelId('test-detail', activeTab)}
        role="tabpanel"
      >
        {activeTab}
      </div>
    </>
  )
}

describe('ModalIconTabNav', () => {
  it('renders named icon tabs with linked panels and a roving tab stop', () => {
    render(<Harness />)

    const tabList = screen.getByRole('tablist', { name: 'Recipe sections' })
    const tabs = within(tabList).getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.textContent)).toEqual(['General', 'Ingredients', 'Instructions'])
    expect(tabs.every((tab) => tab.querySelector('svg') !== null)).toBe(true)
    for (const [index, definition] of TABS.entries()) {
      expect(tabs[index]).toHaveAttribute('data-icon', definition.icon)
      expect(tabs[index].querySelector('path')).toHaveAttribute('d', materialIconPath(definition.icon))
    }

    const general = within(tabList).getByRole('tab', { name: 'General' })
    expect(general).toHaveAttribute('aria-selected', 'true')
    expect(general).toHaveAttribute('aria-controls', 'test-detail-panel-general')
    expect(general).toHaveAttribute('id', 'test-detail-tab-general')
    expect(general).toHaveAttribute('tabindex', '0')
    expect(within(tabList).getByRole('tab', { name: 'Ingredients' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: 'General' })).toHaveAttribute('id', 'test-detail-panel-general')
  })

  it('renders optional count badges and accessories without changing the accessible tab name', () => {
    render(
      <ModalIconTabNav
        activeTab="general"
        idPrefix="badged-detail"
        label="Recipe sections"
        onTabChange={() => undefined}
        tabs={[
          { accessory: <span data-testid="tab-accessory" />, badgeCount: 3, icon: 'mdi:information-outline', label: 'General', tab: 'general' },
        ]}
      />,
    )

    const tab = screen.getByRole('tab', { name: 'General' })
    expect(within(tab).getByText('3')).toBeInTheDocument()
    expect(within(tab).getByTestId('tab-accessory')).toBeInTheDocument()
  })

  it('selects and focuses tabs with ArrowLeft, ArrowRight, Home, and End', async () => {
    render(<Harness />)

    const general = screen.getByRole('tab', { name: 'General' })
    general.focus()
    fireEvent.keyDown(general, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Instructions' })).toHaveFocus())
    expect(screen.getByRole('tabpanel', { name: 'Instructions' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Instructions' }), { key: 'Home' })
    await waitFor(() => expect(general).toHaveFocus())
    expect(screen.getByRole('tabpanel', { name: 'General' })).toBeInTheDocument()

    fireEvent.keyDown(general, { key: 'End' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Instructions' })).toHaveFocus())

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Instructions' }), { key: 'ArrowRight' })
    await waitFor(() => expect(general).toHaveFocus())
    expect(general).toHaveAttribute('aria-selected', 'true')
  })
})
