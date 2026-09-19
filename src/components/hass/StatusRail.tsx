import { useEntity } from '@hakit/core'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { HassEntity } from 'home-assistant-js-websocket'
import { GlassTile, type TileTone } from '../core/GlassTile'
import { Icon } from '../core/Icon'
import type { StatusChipConfig } from '../../constants/atAGlance'
import { useNavigationLayout } from '../shell/NavigationLayoutContext'
import { useCopy } from '../../i18n'
import { SHELL_COPY_NAMESPACE } from '../shell/AppHeader'
import { useDuoControlLane } from '../shell/DuoControlLaneContext'
import { derivedAirPurifierEntityIds, formatAirQualitySummary } from './airQualityState'
import { asEntityName, formatCompactEntityState, formatContactEntityState, formatOccupancyEntityState, isActiveState, isContactOpen, isOccupancyActive } from './entityState'
import { securityStateCssColor, securityStateIconName } from './securityState'
import styles from './StatusRail.module.css'

export interface StatusRailChip extends Omit<StatusChipConfig, 'hash' | 'icon' | 'tone'> {
  hash?: string
  icon: StatusChipConfig['icon'] | string
  stateKind?: 'contact' | 'presence' | 'security'
  tone: TileTone
}

interface StatusRailProps {
  chips: StatusRailChip[]
  onOpenHash: (hash: string) => void
  subtitleByHash?: Partial<Record<string, string>>
}

interface StatusChipPresentation {
  backgroundColor?: string
  icon: StatusRailChip['icon']
  iconColor?: string
  isOff: boolean
  subtitle: string
}

type HubState = 'closed' | 'closing' | 'open'

function colorState(entity: HassEntity | null | undefined) {
  const state = entity?.state ?? ''
  return /^(#|rgb\(|rgba\(|hsl\(|hsla\()/i.test(state) ? state : undefined
}

function useStatusChipPresentation(chip: StatusRailChip, subtitleOverride?: string): StatusChipPresentation {
  const entity = useEntity(asEntityName(chip.entityId), { returnNullIfNotFound: true })
  const airEntityIds = chip.tone === 'air' ? derivedAirPurifierEntityIds(chip.entityId) : null
  const airQualityEntity = useEntity(asEntityName(airEntityIds?.aqiEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const secondaryEntity = useEntity(asEntityName(chip.secondaryEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const colorEntity = useEntity(asEntityName(chip.colorEntityId ?? chip.entityId), { returnNullIfNotFound: true })
  const stateKind = chip.stateKind ?? (chip.tone === 'security' ? 'security' : chip.tone === 'presence' ? 'presence' : chip.tone === 'contact' ? 'contact' : undefined)
  let primaryState = stateKind === 'presence' ? formatOccupancyEntityState(entity) : stateKind === 'contact' ? formatContactEntityState(entity) : formatCompactEntityState(entity)
  if (stateKind === 'contact' && !isContactOpen(entity) && chip.title.endsWith('s')) primaryState = 'All Closed'
  const secondaryState = chip.secondaryEntityId ? formatCompactEntityState(secondaryEntity) : null
  const airQualityState = chip.tone === 'air' ? formatAirQualitySummary(airQualityEntity, entity) : null
  const subtitle = subtitleOverride ?? airQualityState ?? (secondaryState ? `${primaryState} / ${secondaryState}` : primaryState)
  const presenceActive = stateKind === 'presence' ? isOccupancyActive(entity) : false
  const isOff = stateKind === 'security' ? false : stateKind === 'presence' ? !presenceActive && !chip.secondaryEntityId : !isActiveState(entity) && !chip.secondaryEntityId
  const securityBackgroundColor = stateKind === 'security' ? securityStateCssColor(entity?.state, 0.44) : undefined
  const securityIcon = stateKind === 'security' ? securityStateIconName(entity?.state) : undefined
  const dynamicColor = chip.colorEntityId ? colorState(colorEntity) : undefined
  const icon = securityIcon ?? (stateKind === 'presence' ? (presenceActive ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off') : stateKind === 'contact' && isContactOpen(entity) ? 'mdi:door-open' : chip.icon)
  return {
    backgroundColor: securityBackgroundColor,
    icon,
    iconColor: securityIcon ? 'white' : dynamicColor,
    isOff,
    subtitle,
  }
}

function StatusChip({ chip, onActivate, subtitleOverride }: { chip: StatusRailChip; onActivate?: () => void; subtitleOverride?: string }) {
  const presentation = useStatusChipPresentation(chip, subtitleOverride)
  return (
    <div className={styles.chip} data-status-chip={chip.title} style={{ '--chip-width': `${chip.width ?? 150}px` } as CSSProperties}>
      <GlassTile
        backgroundColor={presentation.backgroundColor}
        compact
        icon={presentation.icon}
        iconColor={presentation.iconColor}
        isOff={presentation.isOff}
        onClick={onActivate}
        subtitle={presentation.subtitle}
        title={chip.title}
        tone={chip.tone}
        variant="header"
      />
    </div>
  )
}

function StatusHubVisual({ active, chip, subtitleOverride }: { active: boolean; chip: StatusRailChip; subtitleOverride?: string }) {
  const presentation = useStatusChipPresentation(chip, subtitleOverride)
  const style = {
    '--status-hub-background': presentation.backgroundColor,
    '--status-hub-icon-color': presentation.iconColor,
  } as CSSProperties

  return (
    <span
      className={styles.hubVisual}
      data-active={active ? 'true' : 'false'}
      data-muted={presentation.isOff ? 'true' : 'false'}
      data-tone={chip.tone}
      style={style}
    >
      <Icon name={presentation.icon} size={27} />
    </span>
  )
}

function StatusHubTrigger({
  chip,
  onOpen,
  previousChip,
  previousSubtitleOverride,
  subtitleOverride,
}: {
  chip: StatusRailChip
  onOpen: () => void
  previousChip?: StatusRailChip
  previousSubtitleOverride?: string
  subtitleOverride?: string
}) {
  const copy = useCopy(SHELL_COPY_NAMESPACE)
  const presentation = useStatusChipPresentation(chip, subtitleOverride)

  return (
    <button
      aria-haspopup="dialog"
      aria-label={copy('status.open')}
      className={styles.hubTrigger}
      data-action-kind="modal"
      data-icon={typeof presentation.icon === 'string' ? presentation.icon : undefined}
      data-status-hub-trigger="true"
      data-tone={chip.tone}
      onClick={onOpen}
      title={copy('status.preview', { state: presentation.subtitle, title: chip.title })}
      type="button"
    >
      <span aria-hidden="true" className={styles.hubVisualStack}>
        {previousChip && previousChip.title !== chip.title && (
          <StatusHubVisual active={false} chip={previousChip} key={`previous-${previousChip.title}`} subtitleOverride={previousSubtitleOverride} />
        )}
        <StatusHubVisual active chip={chip} key={`active-${chip.title}`} subtitleOverride={subtitleOverride} />
      </span>
    </button>
  )
}

export function StatusRail({ chips, onOpenHash, subtitleByHash }: StatusRailProps) {
  const copy = useCopy(SHELL_COPY_NAMESPACE)
  const navigationLayout = useNavigationLayout()
  const duoControlLane = useDuoControlLane()
  const [cycle, setCycle] = useState<{ activeIndex: number; previousIndex: number | null }>({
    activeIndex: 0,
    previousIndex: null,
  })
  const [hubState, setHubState] = useState<HubState>('closed')
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef(false)
  const pendingHashRef = useRef<string | null>(null)
  const duo = navigationLayout === 'duo'
  const hubMounted = hubState !== 'closed'
  const hubDataState = hubState === 'closing' ? 'closed' : 'open'
  const triggerDataState = hubMounted ? 'open' : 'closed'
  const activeChip = chips.length > 0 ? chips[cycle.activeIndex % chips.length] : undefined
  const previousChip = chips.length > 1 && cycle.previousIndex !== null
    ? chips[cycle.previousIndex % chips.length]
    : undefined

  useEffect(() => {
    if (!duo || hubState !== 'closed' || chips.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const interval = window.setInterval(() => {
      setCycle((current) => ({
        activeIndex: (current.activeIndex + 1) % chips.length,
        previousIndex: current.activeIndex,
      }))
    }, 5_000)
    return () => window.clearInterval(interval)
  }, [chips.length, duo, hubState])

  useEffect(() => {
    if (duo) return
    pendingHashRef.current = null
    restoreFocusRef.current = false
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setHubState('closed')
    })
    return () => {
      cancelled = true
    }
  }, [duo])

  useEffect(() => {
    if (hubState !== 'open') return undefined
    panelRef.current?.querySelector<HTMLButtonElement>('[data-status-grid-chip="true"] button')?.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        restoreFocusRef.current = true
        setHubState('closing')
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hubState])

  const closeHub = (restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus
    setHubState((current) => (current === 'open' ? 'closing' : current))
  }

  const finishHubClose = useCallback(() => {
    if (hubState !== 'closing') return
    const pendingHash = pendingHashRef.current
    pendingHashRef.current = null
    setHubState('closed')
    if (pendingHash) {
      onOpenHash(pendingHash)
      return
    }
    if (restoreFocusRef.current) {
      restoreFocusRef.current = false
      triggerRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    }
  }, [hubState, onOpenHash])

  useEffect(() => {
    if (hubState !== 'closing') return undefined
    const fallback = window.setTimeout(finishHubClose, 320)
    return () => window.clearTimeout(fallback)
  }, [finishHubClose, hubState])

  if (!duo) {
    return (
      <div className={styles.rail} data-status-rail="true">
        {chips.map((chip) => (
          <StatusChip chip={chip} key={chip.title} onActivate={chip.hash ? () => onOpenHash(chip.hash as string) : undefined} subtitleOverride={chip.hash ? subtitleByHash?.[chip.hash] : undefined} />
        ))}
      </div>
    )
  }

  const hub = hubMounted ? (
    <div className={styles.hubScrim} data-state={hubDataState} onClick={() => closeHub(true)}>
      <div
        aria-label={copy('status.title')}
        aria-modal="true"
        className={styles.hubPanel}
        data-state={hubDataState}
        onAnimationEnd={(event) => {
          if (event.currentTarget === event.target) finishHubClose()
        }}
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
      >
        <div className={styles.hubHeader}>
          <h2>{copy('status.title')}</h2>
          <button aria-label={copy('status.close')} className={styles.hubClose} onClick={() => closeHub(true)} type="button">
            <Icon name="mdi:close" size={24} />
          </button>
        </div>
        <div className={styles.hubGrid} data-status-hub-grid="true">
          {chips.map((chip) => (
            <div className={styles.gridChip} data-status-grid-chip={chip.hash ? 'true' : undefined} key={chip.title}>
              <StatusChip
                chip={chip}
                onActivate={chip.hash ? () => {
                  pendingHashRef.current = chip.hash as string
                  closeHub(false)
                } : undefined}
                subtitleOverride={chip.hash ? subtitleByHash?.[chip.hash] : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null

  const trigger = activeChip && duoControlLane ? createPortal(
        <div className={styles.hubRoot} data-state={triggerDataState} data-status-hub="true" ref={triggerRef}>
          <StatusHubTrigger
            chip={activeChip}
            onOpen={() => setHubState('open')}
            previousChip={previousChip}
            previousSubtitleOverride={previousChip?.hash ? subtitleByHash?.[previousChip.hash] : undefined}
            subtitleOverride={activeChip.hash ? subtitleByHash?.[activeChip.hash] : undefined}
          />
        </div>,
        duoControlLane,
      ) : null

  return (
    <>
      {trigger}
      {hub && createPortal(hub, document.body)}
    </>
  )
}
