import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModalIconTabNav } from './ModalTabNav'
import { materialIconPath } from './iconPaths'
import { modalTabId, modalTabPanelId } from './modalTabIds'

type TestTab = 'actions' | 'auto-clean' | 'controls' | 'info' | 'rooms'

const FULL_TABS = [
  { icon: 'mdi:tune', label: 'Controls', tab: 'controls' },
  { icon: 'mdi:floor-plan', label: 'Rooms', tab: 'rooms' },
  { icon: 'mdi:home-automation', label: 'Auto-Clean', tab: 'auto-clean' },
  { icon: 'mdi:play-box-multiple-outline', label: 'Actions', tab: 'actions' },
  { icon: 'mdi:information-outline', label: 'Info', tab: 'info' },
] as const

const MINIMAL_TABS = [
  { icon: 'mdi:tune', label: 'Controls', tab: 'controls' },
  { icon: 'mdi:home-automation', label: 'Auto-Clean', tab: 'auto-clean' },
  { icon: 'mdi:information-outline', label: 'Info', tab: 'info' },
] as const

function contentLayer(node: HTMLElement) {
  const content = node.querySelector<HTMLElement>('[data-modal-tab-content="true"]')
  expect(content).toBeTruthy()
  return content!
}

const FULL_LAYOUT_RECTS: Partial<Record<string, DOMRect>> = {
  Actions: DOMRect.fromRect({ height: 48, width: 151.59375, x: 507, y: 0 }),
  'Auto-Clean': DOMRect.fromRect({ height: 48, width: 151.59375, x: 338, y: 0 }),
  Controls: DOMRect.fromRect({ height: 48, width: 151.59375, x: 0, y: 0 }),
  Info: DOMRect.fromRect({ height: 48, width: 151.59375, x: 676, y: 0 }),
  Rooms: DOMRect.fromRect({ height: 48, width: 151.59375, x: 169, y: 0 }),
}

const MINIMAL_LAYOUT_RECTS: Partial<Record<string, DOMRect>> = {
  'Auto-Clean': DOMRect.fromRect({ height: 48, width: 255.328125, x: 263, y: 0 }),
  Controls: DOMRect.fromRect({ height: 48, width: 255.328125, x: 0, y: 0 }),
  Info: DOMRect.fromRect({ height: 48, width: 255.328125, x: 526, y: 0 }),
}

const IN_FLIGHT_SHRINK_LAYOUT_RECTS: Partial<Record<string, DOMRect>> = {
  'Auto-Clean': DOMRect.fromRect({ height: 48, width: 217.8125, x: 313.265625, y: 0 }),
  Controls: DOMRect.fromRect({ height: 48, width: 217.8125, x: 0, y: 0 }),
  Info: DOMRect.fromRect({ height: 48, width: 217.8125, x: 626.53125, y: 0 }),
}

function installTabRectMock({ inFlightShrinkLayout = () => false }: {
  inFlightShrinkLayout?: () => boolean
} = {}) {
  const actual = HTMLElement.prototype.getBoundingClientRect
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mockTabRect() {
    if (!this.matches('[role="tab"]')) return actual.call(this)
    const label = this.getAttribute('aria-label') ?? this.textContent?.trim() ?? ''
    const tabList = this.closest<HTMLElement>('[data-modal-tab-nav="true"]')
    const phase = tabList?.getAttribute('data-membership-phase')
    const visualCount = tabList?.getAttribute('data-visual-count')
    if (phase === 'shrink-layout' && inFlightShrinkLayout()) {
      return IN_FLIGHT_SHRINK_LAYOUT_RECTS[label] ?? actual.call(this)
    }
    const rects = phase === 'shrink-layout' || (phase === 'idle' && visualCount === '3')
      ? MINIMAL_LAYOUT_RECTS
      : FULL_LAYOUT_RECTS
    return rects[label] ?? actual.call(this)
  })
}

function Harness() {
  const [activeTab, setActiveTab] = useState<TestTab>('controls')
  return (
    <>
      <ModalIconTabNav
        activeTab={activeTab}
        idPrefix="test-detail"
        label="Recipe sections"
        onTabChange={setActiveTab}
        tabs={FULL_TABS}
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

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ModalIconTabNav', () => {
  it('renders named icon tabs with linked panels and a roving tab stop', () => {
    render(<Harness />)

    const tabList = screen.getByRole('tablist', { name: 'Recipe sections' })
    expect(tabList).toHaveAttribute('data-tab-count', '5')
    expect(tabList).toHaveAttribute('data-membership-phase', 'idle')
    const tabs = within(tabList).getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])
    expect(tabs.every((tab) => tab.querySelector('svg') !== null)).toBe(true)
    for (const [index, definition] of FULL_TABS.entries()) {
      expect(tabs[index]).toHaveAttribute('data-icon', definition.icon)
      expect(tabs[index].querySelector('path')).toHaveAttribute('d', materialIconPath(definition.icon))
    }

    const controls = within(tabList).getByRole('tab', { name: 'Controls' })
    expect(controls).toHaveAttribute('aria-selected', 'true')
    expect(controls).toHaveAttribute('aria-controls', 'test-detail-panel-controls')
    expect(controls).toHaveAttribute('id', 'test-detail-tab-controls')
    expect(controls).toHaveAttribute('tabindex', '0')
    expect(within(tabList).getByRole('tab', { name: 'Rooms' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tabpanel', { name: 'Controls' })).toHaveAttribute('id', 'test-detail-panel-controls')
  })

  it('renders optional count badges and accessories without changing the accessible tab name', () => {
    render(
      <ModalIconTabNav
        activeTab="controls"
        idPrefix="badged-detail"
        label="Recipe sections"
        onTabChange={() => undefined}
        tabs={[
          { accessory: <span data-testid="tab-accessory" />, badgeCount: 3, icon: 'mdi:tune', label: 'Controls', tab: 'controls' },
        ]}
      />,
    )

    const tab = screen.getByRole('tab', { name: 'Controls' })
    expect(within(tab).getByText('3')).toBeInTheDocument()
    expect(within(tab).getByTestId('tab-accessory')).toBeInTheDocument()
  })

  it('selects and focuses tabs with ArrowLeft, ArrowRight, Home, and End', async () => {
    render(<Harness />)

    const controls = screen.getByRole('tab', { name: 'Controls' })
    controls.focus()
    fireEvent.keyDown(controls, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Info' })).toHaveFocus())
    expect(screen.getByRole('tabpanel', { name: 'Info' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Info' }), { key: 'Home' })
    await waitFor(() => expect(controls).toHaveFocus())
    expect(screen.getByRole('tabpanel', { name: 'Controls' })).toBeInTheDocument()

    fireEvent.keyDown(controls, { key: 'End' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Info' })).toHaveFocus())

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Info' }), { key: 'ArrowRight' })
    await waitFor(() => expect(controls).toHaveFocus())
    expect(controls).toHaveAttribute('aria-selected', 'true')
  })

  it('uses the current tab count and keyboard order when reduced motion skips membership animation', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      removeEventListener: vi.fn(),
    })))
    const onTabChange = vi.fn()
    const { rerender } = render(
      <ModalIconTabNav
        activeTab="auto-clean"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={onTabChange}
        tabs={FULL_TABS}
      />,
    )

    rerender(
      <ModalIconTabNav
        activeTab="auto-clean"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={onTabChange}
        tabs={MINIMAL_TABS}
      />,
    )

    const tabList = screen.getByRole('tablist', { name: 'Vacuum sections' })
    expect(tabList).toHaveAttribute('data-membership-phase', 'idle')
    expect(tabList).toHaveAttribute('data-semantic-count', '3')
    expect(tabList).toHaveAttribute('data-visual-count', '3')
    expect(tabList.style.getPropertyValue('--modal-tab-nav-count')).toBe('3')

    const autoClean = screen.getByRole('tab', { name: 'Auto-Clean' })
    autoClean.focus()
    fireEvent.keyDown(autoClean, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Info' })).toHaveFocus())
    expect(onTabChange).toHaveBeenLastCalledWith('info')
  })

  it('shrinks by removing tab semantics first, fading ghosts, then collapsing the grid', () => {
    vi.useFakeTimers()
    const actualGetComputedStyle = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const style = actualGetComputedStyle(element, pseudoElement)
      if (!(element instanceof HTMLElement) || !element.matches('[data-modal-tab-label="true"], [data-modal-tab-accessory="true"]')) return style
      const tabList = element.closest<HTMLElement>('[data-modal-tab-nav="true"]')
      if (tabList?.getAttribute('data-membership-phase') === 'shrink-fade') {
        return { ...style, display: 'none' } as CSSStyleDeclaration
      }
      if (tabList?.getAttribute('data-membership-phase') === 'shrink-layout') {
        return {
          ...style,
          display: 'block',
          opacity: element.style.opacity || '1',
          transition: element.style.transition,
        } as CSSStyleDeclaration
      }
      return style
    })

    const { container, rerender } = render(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )

    const tabList = screen.getByRole('tablist', { name: 'Vacuum sections' })
    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={MINIMAL_TABS}
      />,
    )

    expect(tabList).toHaveAttribute('data-membership-phase', 'shrink-fade')
    expect(tabList).toHaveAttribute('data-visual-count', '5')
    expect(tabList).toHaveAttribute('data-semantic-count', '3')
    expect(tabList).toHaveAttribute('data-content-count', '5')
    expect(tabList).toHaveAttribute('data-content-count-from', '5')
    expect(tabList).toHaveAttribute('data-content-count-to', '3')
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(screen.queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Actions' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Auto-Clean' })).toHaveStyle({ gridColumn: '3', gridRow: '1' })
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveStyle({ gridColumn: '5', gridRow: '1' })
    const ghosts = [...container.querySelectorAll<HTMLElement>('[data-modal-tab-ghost="true"]')]
    expect(ghosts.map((ghost) => ghost.getAttribute('data-tab'))).toEqual(['rooms', 'actions'])
    expect(ghosts.every((ghost) => contentLayer(ghost).style.opacity === '1')).toBe(true)
    expect(ghosts[0]).toHaveStyle({ gridColumn: '2', gridRow: '1' })
    expect(ghosts[1]).toHaveStyle({ gridColumn: '4', gridRow: '1' })
    expect(ghosts.every((ghost) => ghost.querySelector('[data-modal-tab-icon="true"]') !== null)).toBe(true)

    act(() => {
      vi.advanceTimersByTime(48)
    })
    expect(ghosts.every((ghost) => contentLayer(ghost).style.opacity === '0')).toBe(true)
    expect(ghosts.every((ghost) => contentLayer(ghost).style.transition.includes('opacity 340ms linear'))).toBe(true)
    expect(ghosts.every((ghost) => ghost.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')?.style.opacity === '')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(292)
    })
    expect(tabList).toHaveAttribute('data-membership-phase', 'shrink-layout')
    expect(tabList).toHaveAttribute('data-visual-count', '3')
    expect(tabList).toHaveAttribute('data-content-count', '3')
    expect(container.querySelector('[data-modal-tab-ghost="true"]')).not.toBeInTheDocument()
    const controlsLabel = screen.getByRole('tab', { name: 'Controls' }).querySelector<HTMLElement>('[data-modal-tab-label="true"]')
    expect(controlsLabel).toBeTruthy()
    expect(window.getComputedStyle(controlsLabel!).display).toBe('block')
    expect(controlsLabel?.style.opacity).toBe('0')

    act(() => {
      vi.advanceTimersByTime(32)
    })
    expect(controlsLabel?.style.opacity).toBe('1')
    expect(controlsLabel?.style.transition).toContain('opacity 340ms linear')
    expect(screen.getByRole('tab', { name: 'Controls' }).querySelector<HTMLElement>('[data-modal-tab-icon="true"]')?.style.opacity).toBe('')

    act(() => {
      vi.advanceTimersByTime(412)
    })
    expect(tabList).toHaveAttribute('data-membership-phase', 'idle')
    expect(tabList).toHaveAttribute('data-tab-count', '3')
    expect(screen.getByRole('tab', { name: 'Controls' }).querySelector<HTMLElement>('[data-modal-tab-content="true"]')?.style.opacity).toBe('')
  })

  it('expands the grid before adding new tab semantics, then fades the new tabs in', () => {
    vi.useFakeTimers()
    const { rerender } = render(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={MINIMAL_TABS}
      />,
    )

    const tabList = screen.getByRole('tablist', { name: 'Vacuum sections' })
    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )

    expect(tabList).toHaveAttribute('data-membership-phase', 'expand-layout')
    expect(tabList).toHaveAttribute('data-visual-count', '5')
    expect(tabList).toHaveAttribute('data-semantic-count', '3')
    expect(tabList).toHaveAttribute('data-content-count', '3')
    expect(tabList).toHaveAttribute('data-content-count-from', '3')
    expect(tabList).toHaveAttribute('data-content-count-to', '5')
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls', 'Auto-Clean', 'Info'])
    expect(screen.queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Actions' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveStyle({ gridColumn: '1', gridRow: '1' })
    expect(screen.getByRole('tab', { name: 'Auto-Clean' })).toHaveStyle({ gridColumn: '3', gridRow: '1' })
    expect(screen.getByRole('tab', { name: 'Info' })).toHaveStyle({ gridColumn: '5', gridRow: '1' })

    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(tabList).toHaveAttribute('data-membership-phase', 'expand-fade')
    expect(tabList).toHaveAttribute('data-semantic-count', '5')
    expect(tabList).toHaveAttribute('data-content-count', '5')
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])
    const enteringTabs = [
      screen.getByRole('tab', { name: 'Rooms' }),
      screen.getByRole('tab', { name: 'Actions' }),
    ]
    expect(enteringTabs.every((tab) => contentLayer(tab).style.opacity === '0')).toBe(true)
    expect(enteringTabs.every((tab) => tab.querySelector('[data-modal-tab-icon="true"]') !== null)).toBe(true)
    expect(enteringTabs.every((tab) => tab.querySelector<HTMLElement>('[data-modal-tab-icon="true"]')?.style.opacity === '')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(48)
    })
    expect(enteringTabs.every((tab) => contentLayer(tab).style.opacity === '1')).toBe(true)
    expect(enteringTabs.every((tab) => contentLayer(tab).style.transition.includes('opacity 340ms linear'))).toBe(true)

    act(() => {
      vi.advanceTimersByTime(412)
    })
    expect(tabList).toHaveAttribute('data-membership-phase', 'idle')
    expect(tabList).toHaveAttribute('data-tab-count', '5')
    expect(screen.getByRole('tab', { name: 'Rooms' }).querySelector<HTMLElement>('[data-modal-tab-content="true"]')?.style.opacity).toBe('')
  })

  it('animates surviving tab widths during layout and removes inline width alignment after settling', () => {
    vi.useFakeTimers()
    installTabRectMock()
    const { rerender } = render(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )

    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={MINIMAL_TABS}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(340)
    })

    const controls = screen.getByRole('tab', { name: 'Controls' })
    expect(controls.style.width).toBe('151.59375px')
    expect(controls.style.justifySelf).toBe('start')
    expect(controls.style.willChange).toContain('width')
    expect(controls.style.transition).toBe('')

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(controls.style.width).toBe('255.328125px')
    expect(controls.style.justifySelf).toBe('start')
    expect(controls.style.transition).toContain('width 180ms ease-out')

    act(() => {
      vi.advanceTimersByTime(380)
    })

    expect(screen.getByRole('tablist', { name: 'Vacuum sections' })).toHaveAttribute('data-membership-phase', 'idle')
    expect(controls.style.width).toBe('')
    expect(controls.style.justifySelf).toBe('')
    expect(controls.style.transition).toBe('')
    expect(controls.style.willChange).toBe('')
  })

  it('cancels an in-flight shrink and settles the final reversed membership without duplicate tabs', () => {
    vi.useFakeTimers()
    installTabRectMock()
    const { rerender } = render(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )

    const tabList = screen.getByRole('tablist', { name: 'Vacuum sections' })
    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={MINIMAL_TABS}
      />,
    )
    expect(tabList).toHaveAttribute('data-membership-phase', 'shrink-fade')

    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )
    expect(tabList).toHaveAttribute('data-membership-phase', 'expand-layout')
    expect(tabList).toHaveAttribute('data-content-count', '5')
    expect(screen.getAllByRole('tab')).toHaveLength(3)

    act(() => {
      vi.advanceTimersByTime(180)
    })
    expect(tabList).toHaveAttribute('data-membership-phase', 'expand-fade')
    expect(screen.getAllByRole('tab')).toHaveLength(5)

    act(() => {
      vi.advanceTimersByTime(380)
    })
    expect(tabList).toHaveAttribute('data-membership-phase', 'idle')
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.style.width).toBe('')
      expect(tab.style.justifySelf).toBe('')
      expect(tab.style.transition).toBe('')
      expect(tab.style.willChange).toBe('')
      expect(tab.querySelector<HTMLElement>('[data-modal-tab-content="true"]')?.style.opacity).toBe('')
      expect(tab.querySelector<HTMLElement>('[data-modal-tab-content="true"]')?.style.transition).toBe('')
    }
  })

  it('reuses the painted in-flight shrink width when a reversal starts mid-layout', () => {
    vi.useFakeTimers()
    let useInFlightShrinkLayout = false
    installTabRectMock({ inFlightShrinkLayout: () => useInFlightShrinkLayout })
    const { rerender } = render(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )

    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={MINIMAL_TABS}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(340)
    })

    const shrinkingControls = screen.getByRole('tab', { name: 'Controls' })
    expect(shrinkingControls.style.width).toBe('151.59375px')

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(shrinkingControls.style.width).toBe('255.328125px')
    useInFlightShrinkLayout = true

    rerender(
      <ModalIconTabNav
        activeTab="controls"
        animateMembership
        idPrefix="vacuum-detail"
        label="Vacuum sections"
        onTabChange={() => undefined}
        tabs={FULL_TABS}
      />,
    )

    const reversingControls = screen.getByRole('tab', { name: 'Controls' })
    expect(screen.getByRole('tablist', { name: 'Vacuum sections' })).toHaveAttribute('data-membership-phase', 'expand-layout')
    expect(reversingControls.style.width).toBe('217.8125px')
    expect(reversingControls.style.width).not.toBe('255.328125px')

    act(() => {
      vi.advanceTimersByTime(16)
    })

    expect(reversingControls.style.width).toBe('151.59375px')
    expect(reversingControls.style.transition).toContain('width 180ms')
  })
})
