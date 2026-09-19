import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { OFF, ON, useEntity, useHass } from '@hakit/core'
import { Description } from '../core/Description'
import { DynamicGrid } from '../core/DynamicGrid'
import { MaterialIcon } from '../core/Icon'
import { GlassTile, type TileTone } from '../core/GlassTile'
import type { ControlSemantics } from '../core/controlSemantics'
import { ModalIconTabNav } from '../core/ModalTabNav'
import { modalTabId, modalTabPanelId } from '../core/modalTabIds'
import { RangeField } from '../core/RangeField'
import { HUE_SYNC_OPTIMISTIC_REVERT_MS, type MediaRemoteAction, type MediaRemoteAppConfig, type MediaRemoteButtonConfig, type MediaRemoteConfig, type MediaRemoteDeviceConfig, type MediaRemoteHueSyncConfig, type MediaRemoteIconColorRule } from '../../constants/mediaRemotes'
import { HUE_SYNC_MEDIA_REMOTE_MODAL_TAB, mediaRemoteModalTabs, type MediaRemoteModalTab } from '../../constants/surfaceSemantics'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { CORE_COPY_KEYS, CORE_COPY_NAMESPACE, MEDIA_COPY_KEYS, MEDIA_COPY_NAMESPACE, useCopy } from '../../i18n'
import { asEntityName, titleCaseState } from './entityState'
import {
  OptimisticActionStateBoundary,
} from './OptimisticActionState'
import {
  optimisticStateValue,
  runOptimisticServiceCommand,
  useOptimisticActionStates,
  type OptimisticActionStateMap,
} from './optimisticActionState'
import styles from './MediaRemoteModalContent.module.css'

type CallService = (params: Record<string, unknown>) => unknown
type TextPromptAction = Extract<MediaRemoteAction, { type: 'textPrompt' }>
type TextPromptAccordionState = 'closed' | 'closing' | 'open' | 'opening'
type TextPromptState = { accordionState: TextPromptAccordionState; action: TextPromptAction }

const VOLUME_OPTIMISTIC_REVERT_MS = 2500
const REMOTE_ACCORDION_DEBUG_KEY = 'haDash.remoteAccordionDebug'
const HDMI_UNPLUGGED_STATE = 'unplugged'
const HUE_SYNC_MODE_ORDER = ['music', 'video', 'game'] as const
const HUE_SYNC_MODE_ICONS: Readonly<Record<string, string>> = {
  game: 'mdi:gamepad-variant',
  music: 'mdi:music',
  video: 'mdi:movie-open',
}

interface EntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

interface AcknowledgedServiceConnection {
  sendMessagePromise: <T>(message: Record<string, unknown>) => Promise<T>
}

function isUnavailable(entity: EntityLike | null | undefined) {
  return !entity || entity.state === 'unavailable' || entity.state === 'unknown'
}

function isOff(entity: EntityLike | null | undefined) {
  return isUnavailable(entity) || entity?.state === 'off'
}

function formatMediaState(entity: EntityLike | null | undefined, fallback = 'Unavailable') {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return 'Unavailable'
  if (entity.state === 'unknown') return 'Unknown'
  return titleCaseState(entity.state)
}

function textInputCommand(value: string) {
  return `input text '${value.replace(/'/g, "'\\''")}'`
}

function remoteAccordionDebugEnabled() {
  try {
    return window.localStorage.getItem(REMOTE_ACCORDION_DEBUG_KEY) === '1' || new URLSearchParams(window.location.search).has('debugRemoteAccordion')
  } catch {
    return false
  }
}

function logRemoteAccordion(event: string, details: Record<string, unknown>) {
  if (!remoteAccordionDebugEnabled()) return
  console.info(`[remote-accordion] ${event}`, details)
}

function scrollableAncestor(element: HTMLElement) {
  const ownerDocument = element.ownerDocument
  const view = ownerDocument.defaultView
  if (!view) return null

  let current = element.parentElement
  while (current && current !== ownerDocument.body) {
    const style = view.getComputedStyle(current)
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current
    current = current.parentElement
  }
  return ownerDocument.scrollingElement instanceof HTMLElement ? ownerDocument.scrollingElement : ownerDocument.documentElement
}

function keepTextPromptVisible(input: HTMLInputElement | null, reason: string) {
  if (!input || !input.isConnected) return
  const view = input.ownerDocument.defaultView
  if (!view) return
  const scroller = scrollableAncestor(input)
  if (!scroller) return
  const viewport = view.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewport ? viewport.offsetTop + viewport.height : view.innerHeight
  const scrollerRect = scroller.getBoundingClientRect()
  const inputRect = input.getBoundingClientRect()
  const visibleTop = Math.max(scrollerRect.top, viewportTop) + 16
  const visibleBottom = Math.min(scrollerRect.bottom, viewportBottom) - 28
  let delta = 0

  if (inputRect.bottom > visibleBottom) delta = inputRect.bottom - visibleBottom
  else if (inputRect.top < visibleTop) delta = inputRect.top - visibleTop

  if (Math.abs(delta) > 1) scroller.scrollTop += delta
  logRemoteAccordion('keep-visible', {
    delta: Number(delta.toFixed(2)),
    inputBottom: Number(inputRect.bottom.toFixed(2)),
    inputTop: Number(inputRect.top.toFixed(2)),
    reason,
    scrollerClass: scroller.className,
    scrollerScrollTop: Number(scroller.scrollTop.toFixed(2)),
    visibleBottom: Number(visibleBottom.toFixed(2)),
    visibleTop: Number(visibleTop.toFixed(2)),
    viewportBottom: Number(viewportBottom.toFixed(2)),
  })
}

function scheduleTextPromptVisibility(input: HTMLInputElement | null, reason: string) {
  if (!input || !input.isConnected) return () => undefined
  const view = input.ownerDocument.defaultView
  if (!view) return () => undefined

  keepTextPromptVisible(input, `${reason}:now`)
  const animationFrame = view.requestAnimationFrame(() => keepTextPromptVisible(input, `${reason}:raf`))
  const timers = [
    view.setTimeout(() => keepTextPromptVisible(input, `${reason}:80ms`), 80),
    view.setTimeout(() => keepTextPromptVisible(input, `${reason}:240ms`), 240),
    view.setTimeout(() => keepTextPromptVisible(input, `${reason}:520ms`), 520),
  ]

  return () => {
    view.cancelAnimationFrame(animationFrame)
    for (const timer of timers) view.clearTimeout(timer)
  }
}

function resolveAction(
  action: MediaRemoteAction,
  entityId: string | undefined,
  entities: Record<string, EntityLike | undefined>,
  optimisticStates: OptimisticActionStateMap,
  stateOverride?: string,
) {
  if (action.type !== 'state') return action
  const stateEntityId = action.entityId ?? entityId
  const state = stateOverride ?? (stateEntityId
    ? optimisticStateValue(stateEntityId, entities[stateEntityId]?.state, optimisticStates)
    : undefined)
  const matchedCase = action.cases.find((candidate) => state !== undefined && candidate.states.includes(state))
  return matchedCase?.action ?? action.defaultAction
}

function runAction(
  callService: CallService,
  action: MediaRemoteAction,
  entities: Record<string, EntityLike | undefined>,
  entityId: string | undefined,
  onTextPrompt: (action: TextPromptAction) => void,
  optimisticStates: OptimisticActionStateMap,
  stateOverride?: string,
) {
  const resolvedAction = resolveAction(action, entityId, entities, optimisticStates, stateOverride)

  if (resolvedAction.type === 'textPrompt') {
    onTextPrompt(resolvedAction)
    return
  }

  runOptimisticServiceCommand(
    callService,
    { domain: resolvedAction.domain, service: resolvedAction.service, target: resolvedAction.target, serviceData: resolvedAction.serviceData },
    resolvedAction.optimisticState,
    resolvedAction.optimisticResetState,
    optimisticStates,
  )
}

function iconColorFromRule(rule: MediaRemoteIconColorRule | undefined, entities: Record<string, EntityLike | undefined>, optimisticStates: OptimisticActionStateMap) {
  if (!rule) return undefined
  const inactive = rule.entityIds.every((entityId) => {
    const entity = entities[entityId]
    const inactiveStates = rule.inactiveStatesByEntity?.[entityId] ?? rule.inactiveStates
    const state = optimisticStateValue(entityId, entity?.state, optimisticStates)
    return state ? inactiveStates.includes(state) : false
  })
  return inactive ? rule.inactiveColor : rule.activeColor
}

function withOptimisticState(entity: EntityLike | null, entityId: string, optimisticStates: OptimisticActionStateMap) {
  const state = optimisticStateValue(entityId, entity?.state, optimisticStates)
  if (!entity || !state || state === entity.state) return entity
  return { ...entity, state }
}

function deviceStateIsActive(state: string, activeStates: readonly string[] | undefined) {
  return activeStates?.length ? activeStates.includes(state) : !['off', 'unavailable', 'unknown'].includes(state)
}

function useHeldDeviceState(
  liveState: string,
  displayedState: string,
  activeStates: readonly string[] | undefined,
  hasOptimisticOverride: boolean,
  holdMs = 0,
  resetKey = '',
) {
  const liveActive = deviceStateIsActive(liveState, activeStates)
  const [holdState, setHoldState] = useState(() => ({
    holdingActive: false,
    liveActive,
    resetKey,
  }))
  let holdingActive = holdState.holdingActive

  if (
    resetKey !== holdState.resetKey
    || liveActive !== holdState.liveActive
    || ((!holdMs || hasOptimisticOverride) && holdingActive)
  ) {
    holdingActive = resetKey !== holdState.resetKey || !holdMs || hasOptimisticOverride
      ? false
      : liveActive || holdState.liveActive || holdingActive
    setHoldState({ holdingActive, liveActive, resetKey })
  }

  useEffect(() => {
    if (!holdMs || hasOptimisticOverride || liveActive || !holdingActive) return undefined
    const timer = window.setTimeout(() => {
      setHoldState((current) => current.holdingActive && !current.liveActive
        ? { ...current, holdingActive: false }
        : current)
    }, holdMs)
    return () => window.clearTimeout(timer)
  }, [hasOptimisticOverride, holdMs, holdingActive, liveActive, resetKey])

  if (hasOptimisticOverride || !holdMs || liveActive || !holdingActive) return displayedState
  return activeStates?.[0] ?? displayedState
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h3>{title}</h3>
      <span />
    </div>
  )
}

function RemoteButton({ button, disabled = false, onTextPrompt, size = 'large' }: { button: MediaRemoteButtonConfig; disabled?: boolean; onTextPrompt: (action: TextPromptAction) => void; size?: 'large' | 'round' | 'small' }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const optimisticStates = useOptimisticActionStates()
  const semantics: ControlSemantics = button.semantics?.(undefined) ?? { kind: 'command' }
  const iconColor = iconColorFromRule(button.iconColorRule, entities, optimisticStates)
  const iconSize = size === 'large' ? 42 : button.icon === 'mdi:circle' ? 24 : 30
  const iconRotation = button.iconRotationDegrees ? `rotate(${button.iconRotationDegrees} 12 12)` : undefined
  const hasIcon = button.icon.trim().length > 0

  return (
    <button
      aria-label={button.label}
      aria-checked={semantics.kind === 'toggle' ? semantics.checked : undefined}
      className={styles.remoteButton}
      data-action-kind={semantics.kind}
      data-icon={button.icon}
      data-size={size}
      disabled={disabled}
      onClick={() => runAction(callService, button.action, entities, undefined, onTextPrompt, optimisticStates)}
      role={semantics.kind === 'toggle' ? 'switch' : undefined}
      style={iconColor ? { color: iconColor } : undefined}
      type="button"
    >
      {hasIcon ? <MaterialIcon name={button.icon} pathTransform={iconRotation} size={iconSize} /> : null}
    </button>
  )
}

function RemoteSpacer({ size = 'large' }: { size?: 'large' | 'round' | 'small' }) {
  return <span aria-hidden="true" className={styles.remoteSpacer} data-size={size} />
}

function RemoteGrid({ config, disabled, onTextPrompt }: { config: MediaRemoteConfig; disabled: boolean; onTextPrompt: (action: TextPromptAction) => void }) {
  const cells = [
    undefined, config.upButton, undefined,
    config.leftButton, config.selectButton, config.rightButton,
    undefined, config.downButton, undefined,
  ]

  return (
    <div className={styles.remoteGrid} role="group" aria-label={`${config.title} remote controls`}>
      {cells.map((button, index) => button ? <RemoteButton button={button} disabled={disabled} key={`${button.label}-${index}`} onTextPrompt={onTextPrompt} size="large" /> : <RemoteSpacer key={`spacer-${index}`} />)}
    </div>
  )
}

function ButtonRow({ buttons, disabled, onTextPrompt, size = 'small' }: { buttons: Array<MediaRemoteButtonConfig | undefined>; disabled: boolean; onTextPrompt: (action: TextPromptAction) => void; size?: 'round' | 'small' }) {
  return (
    <div className={styles.buttonRow} data-size={size}>
      {buttons.map((button, index) => button ? <RemoteButton button={button} disabled={disabled} key={button.label} onTextPrompt={onTextPrompt} size={size} /> : <RemoteSpacer key={`empty-${index}`} size={size} />)}
    </div>
  )
}

function PowerButton({ button, controlEntity, onTextPrompt }: { button: MediaRemoteButtonConfig; controlEntity: EntityLike | null; onTextPrompt: (action: TextPromptAction) => void }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const optimisticStates = useOptimisticActionStates()
  const displayedControlEntity = controlEntity
    ? withOptimisticState(controlEntity, controlEntity.entity_id, optimisticStates)
    : controlEntity
  const semantics: ControlSemantics = button.semantics?.(displayedControlEntity?.state) ?? { kind: 'command' }
  const iconColor = iconColorFromRule(button.iconColorRule, entities, optimisticStates)
  const iconRotation = button.iconRotationDegrees ? `rotate(${button.iconRotationDegrees} 12 12)` : undefined
  const powerLabel = isOff(displayedControlEntity) ? 'Power On' : 'Power Off'

  return (
    <button
      aria-checked={semantics.kind === 'toggle' ? semantics.checked : undefined}
      aria-label={button.label}
      className={`${styles.remoteButton} ${styles.powerButton}`}
      data-action-kind={semantics.kind}
      data-icon={button.icon}
      data-size="power"
      onClick={() => runAction(callService, button.action, entities, undefined, onTextPrompt, optimisticStates)}
      role={semantics.kind === 'toggle' ? 'switch' : undefined}
      style={iconColor ? { color: iconColor } : undefined}
      type="button"
    >
      <MaterialIcon name={button.icon} pathTransform={iconRotation} size={30} />
      <span aria-hidden="true" className={styles.powerButtonLabel}>{powerLabel}</span>
    </button>
  )
}

function PowerSection({ config, controlEntity, onTextPrompt }: { config: MediaRemoteConfig; controlEntity: EntityLike | null; onTextPrompt: (action: TextPromptAction) => void }) {
  return (
    <section className={`${styles.section} ${styles.powerSection}`} data-section="remote-power">
      <PowerButton button={config.powerButton} controlEntity={controlEntity} onTextPrompt={onTextPrompt} />
    </section>
  )
}

function RemoteShortcutSection({
  config,
  controlsDisabled,
  hideKeyboard,
  onTextPrompt,
  onTextPromptCancel,
  onTextPromptExited,
  onTextPromptOpened,
  onTextPromptSubmit,
  textPrompt,
  textPromptInputRef,
}: {
  config: MediaRemoteConfig
  controlsDisabled: boolean
  hideKeyboard: boolean
  onTextPrompt: (action: TextPromptAction) => void
  onTextPromptCancel: () => void
  onTextPromptExited: () => void
  onTextPromptOpened: () => void
  onTextPromptSubmit: (action: TextPromptAction, text: string) => void
  textPrompt: TextPromptState | null
  textPromptInputRef: RefObject<HTMLInputElement | null>
}) {
  const keyboardButton = hideKeyboard ? undefined : config.keyboardButton

  return (
    <section className={styles.section} data-section="remote-shortcuts">
      <SectionHeader title="Navigation" />
      <ButtonRow buttons={[config.backButton, config.homeButton, keyboardButton]} disabled={controlsDisabled} onTextPrompt={onTextPrompt} size="round" />
      {textPrompt ? <TextPromptForm accordionState={textPrompt.accordionState} action={textPrompt.action} inputRef={textPromptInputRef} key={textPrompt.action.targetEntityId} onCancel={onTextPromptCancel} onExited={onTextPromptExited} onOpened={onTextPromptOpened} onSubmit={onTextPromptSubmit} /> : null}
    </section>
  )
}

function TextPromptForm({ accordionState, action, inputRef, onCancel, onExited, onOpened, onSubmit }: { accordionState: TextPromptAccordionState; action: TextPromptAction; inputRef: RefObject<HTMLInputElement | null>; onCancel: () => void; onExited: () => void; onOpened: () => void; onSubmit: (action: TextPromptAction, text: string) => void }) {
  const [text, setText] = useState('')
  const accordionRef = useRef<HTMLDivElement | null>(null)
  const visibilityScheduleCleanupRef = useRef<(() => void) | null>(null)
  const interactive = accordionState !== 'closed'
  const open = accordionState !== 'closing'
  const scheduleVisibility = useCallback((reason: string) => {
    visibilityScheduleCleanupRef.current?.()
    visibilityScheduleCleanupRef.current = scheduleTextPromptVisibility(inputRef.current, reason)
  }, [inputRef])

  useEffect(() => () => {
    visibilityScheduleCleanupRef.current?.()
    visibilityScheduleCleanupRef.current = null
  }, [])

  useEffect(() => {
    if (!remoteAccordionDebugEnabled()) return undefined
    if (accordionState !== 'opening' && accordionState !== 'closing') return undefined

    const accordion = accordionRef.current
    if (!accordion) return undefined
    let animationFrame = 0
    let frame = 0
    const startedAt = performance.now()
    let previousAt = startedAt

    const tick = () => {
      const now = performance.now()
      const style = window.getComputedStyle(accordion)
      const form = accordion.querySelector('form')
      const formStyle = form ? window.getComputedStyle(form) : null
      const rect = accordion.getBoundingClientRect()

      console.info('[remote-accordion-frame]', {
        activeElement: document.activeElement instanceof HTMLElement ? document.activeElement.id || document.activeElement.tagName : null,
        computedHeight: style.height,
        dataState: accordion.dataset.state,
        dt: Number((now - previousAt).toFixed(2)),
        frame,
        formOpacity: formStyle?.opacity,
        formTransform: formStyle?.transform,
        opacity: style.opacity,
        open,
        rectHeight: Number(rect.height.toFixed(2)),
        state: accordionState,
        t: Number((now - startedAt).toFixed(2)),
      })

      previousAt = now
      frame += 1
      if (now - startedAt < 360) animationFrame = window.requestAnimationFrame(tick)
    }

    logRemoteAccordion('frame-log-start', { open, state: accordionState })
    animationFrame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [accordionState, open])

  useEffect(() => {
    if (!open) return undefined
    const viewport = window.visualViewport
    const input = inputRef.current
    const handleViewportChange = () => scheduleVisibility('visual-viewport')
    const handleFocus = () => scheduleVisibility('input-focus')

    input?.addEventListener('focus', handleFocus)
    viewport?.addEventListener('resize', handleViewportChange)
    viewport?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      input?.removeEventListener('focus', handleFocus)
      viewport?.removeEventListener('resize', handleViewportChange)
      viewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [inputRef, open, scheduleVisibility])

  return (
    <div
      aria-hidden={!open}
      className={styles.textPromptAccordion}
      data-state={accordionState}
      ref={accordionRef}
      onTransitionEnd={(event) => {
        if (event.currentTarget !== event.target) return
        if (event.propertyName !== 'height') return
        logRemoteAccordion('transition-end', { state: accordionState })
        if (accordionState === 'opening') {
          onOpened()
          inputRef.current?.focus()
          scheduleVisibility('transition-focus')
          logRemoteAccordion('focus-after-open', { activeElement: document.activeElement instanceof HTMLElement ? document.activeElement.id || document.activeElement.tagName : null })
        } else if (accordionState === 'closing') {
          onExited()
        }
      }}
    >
      <form className={styles.textPromptForm} onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim()) return
        onSubmit(action, text)
      }}>
        <label className={styles.textPromptLabel} htmlFor="media-remote-text-prompt">Text to send</label>
        <div className={styles.textPromptRow}>
          <input
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className={styles.textPromptInput}
            id="media-remote-text-prompt"
            inputMode="text"
            onChange={(event) => setText(event.currentTarget.value)}
            placeholder="Enter text"
            ref={inputRef}
            tabIndex={interactive ? 0 : -1}
            type="text"
            value={text}
          />
          <button className={styles.textPromptButton} tabIndex={interactive ? 0 : -1} type="submit">Send</button>
          <button className={styles.textPromptButton} tabIndex={interactive ? 0 : -1} onClick={onCancel} type="button">Cancel</button>
        </div>
      </form>
    </div>
  )
}

function VolumeSlider({ entityId, title }: { entityId: string; title: string }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const disabled = isOff(entity)
  const volumeLevel = typeof entity?.attributes.volume_level === 'number' ? entity.attributes.volume_level : 0
  const volumePercent = Math.round(volumeLevel * 100)
  const [displayedPercent, commitDisplayedPercent] = useOptimisticState(volumePercent, { clearOn: 'confirmation', revertMs: VOLUME_OPTIMISTIC_REVERT_MS })
  const sliderStyle = { '--volume-percent': `${displayedPercent}%` } as CSSProperties

  const commitVolume = (nextPercent: number) => {
    commitDisplayedPercent(nextPercent)
    callService({ domain: 'media_player', service: 'volume_set', target: entityId, serviceData: { volume_level: nextPercent / 100 } })
  }

  return (
    <label className={styles.volumeSlider} data-muted={disabled ? 'true' : 'false'}>
      <span className={styles.srOnly}>{title} volume</span>
      <input
        aria-label={`${title} volume`}
        disabled={disabled}
        max={100}
        min={0}
        onChange={(event) => commitVolume(Number(event.currentTarget.value))}
        style={sliderStyle}
        type="range"
        value={displayedPercent}
      />
    </label>
  )
}

function DeviceButton({ device }: { device: MediaRemoteDeviceConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const optimisticStates = useOptimisticActionStates()
  const stateEntityIds = device.stateEntityIds ?? [device.entityId]
  const liveStates = Object.fromEntries(stateEntityIds.map((entityId) => [entityId, entities[entityId]?.state]))
  const displayedStates = Object.fromEntries(stateEntityIds.map((entityId) => [
    entityId,
    optimisticStateValue(entityId, entities[entityId]?.state, optimisticStates),
  ]))
  const liveState = device.stateResolver?.(liveStates) ?? liveStates[device.entityId] ?? 'unavailable'
  const optimisticDisplayedState = device.stateResolver?.(displayedStates) ?? displayedStates[device.entityId] ?? liveState
  const hasOptimisticOverride = stateEntityIds.some((entityId) => {
    const optimisticState = optimisticStates[entityId]
    return Boolean(optimisticState && optimisticState.displayedState !== optimisticState.liveState)
  })
  const activeHoldResetKey = device.activeHoldResetEntityIds?.map((entityId) => entities[entityId]?.state ?? 'unavailable').join('|') ?? ''
  const displayedState = useHeldDeviceState(
    liveState,
    optimisticDisplayedState,
    device.activeStates,
    hasOptimisticOverride,
    device.activeHoldMs,
    activeHoldResetKey,
  )
  const baseEntity = entities[device.entityId] ?? stateEntityIds.map((entityId) => entities[entityId]).find(Boolean)
  const liveEntity: EntityLike = {
    attributes: baseEntity?.attributes ?? {},
    entity_id: device.entityId,
    state: liveState,
  }
  const entity: EntityLike = { ...liveEntity, state: displayedState }
  const unavailable = isUnavailable(liveEntity)
  const active = device.activeStates?.length ? Boolean(entity && device.activeStates.includes(entity.state)) : !isOff(entity)
  const subtitle = entity ? device.stateLabels?.[entity.state] ?? formatMediaState(entity) : formatMediaState(entity)
  const tone: TileTone = device.entityId.startsWith('input_boolean.') ? 'switch' : 'media'
  const semantics: ControlSemantics = device.semantics?.(entity?.state) ?? (device.action ? { kind: 'command' } : { kind: 'state' })
  const runDeviceAction = device.action
    ? () => runAction(callService, device.action!, entities, device.entityId, () => undefined, optimisticStates, device.stateResolver ? displayedState : undefined)
    : undefined

  return (
    <GlassTile disabled={unavailable && Boolean(device.action)} icon={device.icon} isOff={unavailable || !active} onClick={runDeviceAction} semantics={semantics} subtitle={subtitle} title={device.title} tone={tone} />
  )
}

function AppButton({ app }: { app: MediaRemoteAppConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const optimisticStates = useOptimisticActionStates()
  const [imageFailed, setImageFailed] = useState(false)
  const liveState = app.stateEntityId ? entities[app.stateEntityId]?.state : undefined
  const displayedState = app.stateEntityId
    ? optimisticStateValue(app.stateEntityId, liveState, optimisticStates)
    : undefined
  const active = Boolean(displayedState && app.activeStates?.includes(displayedState))
  const unavailable = Boolean(app.stateEntityId && (!liveState || ['unavailable', 'unknown'].includes(liveState)))
  const semantics: ControlSemantics = app.semantics?.(displayedState) ?? { kind: 'command' }

  return (
    <button
      aria-label={app.title}
      aria-checked={semantics.kind === 'toggle' ? semantics.checked : undefined}
      aria-pressed={semantics.kind === 'selection' ? semantics.selected : undefined}
      className={styles.appButton}
      data-action-kind={semantics.kind}
      data-active={active ? 'true' : 'false'}
      data-background={app.background}
      disabled={unavailable}
      onClick={() => runAction(callService, app.action, entities, undefined, () => undefined, optimisticStates)}
      role={semantics.kind === 'toggle' ? 'switch' : undefined}
      type="button"
    >
      {!app.imageUrl || imageFailed
        ? (
            <span className={styles.appFallback}>
              <MaterialIcon name={app.icon ?? 'mdi:play-box'} size={34} />
              <span>{app.title}</span>
            </span>
          )
        : <img alt="" className={styles.appImage} onError={() => setImageFailed(true)} src={app.imageUrl} />}
    </button>
  )
}

function entityOptionValues(entity: EntityLike | null) {
  const options = entity?.attributes.options
  if (!Array.isArray(options)) return []
  return options.filter((option): option is string => typeof option === 'string')
}

function hueSyncIntent(entityId: string, value: string) {
  return { entityId, revertMs: HUE_SYNC_OPTIMISTIC_REVERT_MS, value }
}

function useHueSyncCallService(): CallService {
  const connection = useHass((state) => state.connection) as unknown as AcknowledgedServiceConnection | null

  return useCallback((params: Record<string, unknown>) => {
    if (!connection) return Promise.reject()
    const message: Record<string, unknown> = {
      domain: params.domain,
      service: params.service,
      type: 'call_service',
    }
    if (params.serviceData !== undefined) message.service_data = params.serviceData
    if (typeof params.target === 'string') message.target = { entity_id: params.target }
    else if (params.target !== undefined) message.target = params.target
    return connection.sendMessagePromise(message)
  }, [connection])
}

function runHueSyncCommand(
  callService: CallService,
  optimisticStates: OptimisticActionStateMap,
  params: Record<string, unknown>,
  intents: ReturnType<typeof hueSyncIntent>[],
) {
  runOptimisticServiceCommand(callService, params, intents, undefined, optimisticStates, { requestResponse: false })
}

function HueSyncToggleTile({
  entityId,
  icon,
  offProjections = [],
  onProjections = [],
  title,
  tone,
}: {
  entityId: string
  icon: string
  offProjections?: string[]
  onProjections?: string[]
  title: string
  tone: TileTone
}) {
  const callService = useHueSyncCallService()
  const optimisticStates = useOptimisticActionStates()
  const liveEntity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const displayedState = optimisticStateValue(entityId, liveEntity?.state, optimisticStates) ?? liveEntity?.state ?? 'unavailable'
  const unavailable = isUnavailable(liveEntity)
  const checked = displayedState === ON
  const nextState = checked ? OFF : ON
  const projections = checked ? offProjections : onProjections

  return (
    <GlassTile
      compact
      disabled={unavailable}
      icon={icon}
      isOff={!checked}
      onClick={() => runHueSyncCommand(
        callService,
        optimisticStates,
        { domain: 'switch', service: checked ? 'turn_off' : 'turn_on', target: entityId },
        [hueSyncIntent(entityId, nextState), ...projections.map((projectionEntityId) => hueSyncIntent(projectionEntityId, nextState))],
      )}
      semantics={{ kind: 'toggle', checked }}
      subtitle={formatMediaState({ ...liveEntity, attributes: liveEntity?.attributes ?? {}, entity_id: entityId, state: displayedState })}
      title={title}
      tone={tone}
    />
  )
}

interface HueSyncSelectCommandOptions {
  allowSameValue?: boolean
  optimisticOnEntityIds?: string[]
  resetEntityId?: string
}

function useHueSyncSelectControl(entityId: string) {
  const callService = useHueSyncCallService()
  const optimisticStates = useOptimisticActionStates()
  const liveEntity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const options = entityOptionValues(liveEntity)
  const displayedState = optimisticStateValue(entityId, liveEntity?.state, optimisticStates) ?? ''
  const unavailable = isUnavailable(liveEntity) || options.length === 0
  const selectOption = (nextValue: string, {
    allowSameValue = false,
    optimisticOnEntityIds = [],
    resetEntityId,
  }: HueSyncSelectCommandOptions = {}) => {
    if (unavailable || (!allowSameValue && nextValue === displayedState)) return
    if (resetEntityId) optimisticStates[resetEntityId]?.reset()
    runHueSyncCommand(
      callService,
      optimisticStates,
      { domain: 'select', service: 'select_option', target: entityId, serviceData: { option: nextValue } },
      [
        hueSyncIntent(entityId, nextValue),
        ...optimisticOnEntityIds.map((projectionEntityId) => hueSyncIntent(projectionEntityId, ON)),
      ],
    )
  }

  return { displayedState, options, selectOption, unavailable }
}

function orderedHueSyncModes(options: string[]) {
  return [...options].sort((left, right) => {
    const leftIndex = HUE_SYNC_MODE_ORDER.indexOf(left.toLowerCase() as (typeof HUE_SYNC_MODE_ORDER)[number])
    const rightIndex = HUE_SYNC_MODE_ORDER.indexOf(right.toLowerCase() as (typeof HUE_SYNC_MODE_ORDER)[number])
    return (leftIndex < 0 ? HUE_SYNC_MODE_ORDER.length : leftIndex) - (rightIndex < 0 ? HUE_SYNC_MODE_ORDER.length : rightIndex)
  })
}

function HueSyncModeButtons({
  intensityEntityId,
  label,
  lightSyncEntityId,
  powerEntityId,
  syncModeEntityId,
}: {
  intensityEntityId: string
  label: string
  lightSyncEntityId: string
  powerEntityId: string
  syncModeEntityId: string
}) {
  const optimisticStates = useOptimisticActionStates()
  const livePowerEntity = useEntity(asEntityName(powerEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const liveLightSyncEntity = useEntity(asEntityName(lightSyncEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const { displayedState, options, selectOption, unavailable } = useHueSyncSelectControl(syncModeEntityId)
  const syncing = optimisticStateValue(powerEntityId, livePowerEntity?.state, optimisticStates) === ON
    && optimisticStateValue(lightSyncEntityId, liveLightSyncEntity?.state, optimisticStates) === ON

  return (
    <div aria-label={label} className={styles.hueSyncModeRow} role="group">
      {orderedHueSyncModes(options).map((option) => {
        const selected = displayedState === option
        const semantics = { kind: 'selection', selected } as const
        const title = titleCaseState(option)
        return (
          <div className={styles.hueSyncModeOption} data-selected={selected ? 'true' : 'false'} key={option}>
            <button
              aria-label={title}
              aria-pressed={selected}
              className={`${styles.remoteButton} ${styles.hueSyncModeButton}`}
              data-action-kind={semantics.kind}
              data-selected={selected ? 'true' : 'false'}
              data-size="round"
              disabled={unavailable}
              onClick={() => selectOption(option, {
                allowSameValue: !syncing,
                optimisticOnEntityIds: [powerEntityId, lightSyncEntityId],
                resetEntityId: intensityEntityId,
              })}
              type="button"
            >
              <MaterialIcon name={HUE_SYNC_MODE_ICONS[option.toLowerCase()] ?? 'mdi:lightbulb-multiple'} size={30} />
            </button>
            <span className={styles.hueSyncModeLabel}>{title}</span>
          </div>
        )
      })}
    </div>
  )
}

function HueSyncSelectionTile({
  disabled,
  icon,
  inactive = false,
  onSelect,
  selected,
  selectedTone,
  subtitle,
  title,
}: {
  disabled: boolean
  icon: string
  inactive?: boolean
  onSelect: () => void
  selected: boolean
  selectedTone: TileTone
  subtitle?: string
  title: string
}) {
  const semantics = { kind: 'selection', selected } as const

  return (
    <div className={styles.hueSyncSelectionTile} data-disabled={disabled ? 'true' : 'false'}>
      <GlassTile
        disabled={disabled}
        icon={icon}
        isOff={inactive || !selected}
        onClick={onSelect}
        semantics={semantics}
        subtitle={subtitle}
        title={title}
        tone={selected ? selectedTone : 'neutral'}
      />
    </div>
  )
}

function HueSyncIntensityGrid({ entityId, label }: { entityId: string; label: string }) {
  const { displayedState, options, selectOption, unavailable } = useHueSyncSelectControl(entityId)

  return (
    <DynamicGrid ariaLabel={label} className={styles.hueSyncChoiceGrid} columns={2} fillRows={false} layout="bounded" maxCellWidth={260} maxColumns={2}>
      {options.map((option) => (
        <HueSyncSelectionTile
          disabled={unavailable}
          icon="mdi:gauge"
          key={option}
          onSelect={() => selectOption(option)}
          selected={displayedState === option}
          selectedTone="light"
          title={titleCaseState(option)}
        />
      ))}
    </DynamicGrid>
  )
}

function numericAttribute(entity: EntityLike | null, key: string, fallback: number) {
  const value = entity?.attributes[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function HueSyncBrightnessField({ entityId, label }: { entityId: string; label: string }) {
  const callService = useHueSyncCallService()
  const optimisticStates = useOptimisticActionStates()
  const liveEntity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const min = numericAttribute(liveEntity, 'min', 1)
  const max = numericAttribute(liveEntity, 'max', 100)
  const step = numericAttribute(liveEntity, 'step', 1)
  const liveValue = Math.min(max, Math.max(min, Number(liveEntity?.state) || min))
  const optimisticValue = Math.min(max, Math.max(min, Number(optimisticStateValue(entityId, liveEntity?.state, optimisticStates)) || liveValue))
  const [draftValue, setDraftValue] = useState<number | null>(null)
  const displayedValue = draftValue ?? optimisticValue
  const unavailable = isUnavailable(liveEntity)

  return (
    <RangeField
      disabled={unavailable}
      label={label}
      max={max}
      min={min}
      onChange={setDraftValue}
      onCommit={(nextValue) => {
        setDraftValue(null)
        if (nextValue === optimisticValue) return
        runHueSyncCommand(
          callService,
          optimisticStates,
          { domain: 'number', service: 'set_value', target: entityId, serviceData: { value: nextValue } },
          [hueSyncIntent(entityId, String(nextValue))],
        )
      }}
      step={step}
      value={displayedValue}
      valueText={unavailable ? formatMediaState(liveEntity) : undefined}
    />
  )
}

function HueSyncHdmiInputTile({
  disabled,
  entityId,
  onSelect,
  selected,
  title,
}: {
  disabled: boolean
  entityId: string
  onSelect: () => void
  selected: boolean
  title: string
}) {
  const copy = useCopy(MEDIA_COPY_NAMESPACE)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const disconnected = isUnavailable(entity) || entity?.state === HDMI_UNPLUGGED_STATE
  const status = formatMediaState(entity)

  return (
    <HueSyncSelectionTile
      disabled={disabled || disconnected}
      icon={disconnected ? 'mdi:television-off' : 'mdi:television'}
      inactive={disconnected}
      onSelect={onSelect}
      selected={selected}
      selectedTone="switch"
      subtitle={selected ? copy(MEDIA_COPY_KEYS.hueSync.selectedStatus, { status }) : status}
      title={title}
    />
  )
}

function HueSyncTab({ config }: { config: MediaRemoteHueSyncConfig }) {
  const copy = useCopy(MEDIA_COPY_NAMESPACE)
  const inputControl = useHueSyncSelectControl(config.hdmiInputEntityId)
  const inputOptions = inputControl.options.length
    ? inputControl.options
    : config.hdmiStatusEntityIds.map((_, index) => copy(MEDIA_COPY_KEYS.hueSync.hdmiPort, { port: index + 1 }))

  return (
    <div className={styles.hueSyncStack} data-hue-sync-tab="true">
      <section className={styles.section}>
        <SectionHeader title={copy(MEDIA_COPY_KEYS.hueSync.powerAndSync)} />
        <DynamicGrid className={styles.hueSyncToggleGrid} columns={2} fillRows={false} layout="bounded" maxCellWidth={260} maxColumns={2}>
          <HueSyncToggleTile
            entityId={config.powerEntityId}
            icon="mdi:power"
            offProjections={[config.lightSyncEntityId]}
            title={copy(MEDIA_COPY_KEYS.hueSync.syncBoxPower)}
            tone="media"
          />
          <HueSyncToggleTile
            entityId={config.lightSyncEntityId}
            icon="mdi:lightbulb-multiple"
            onProjections={[config.powerEntityId]}
            title={copy(MEDIA_COPY_KEYS.hueSync.lightSync)}
            tone="light"
          />
        </DynamicGrid>
        <Description>{copy(MEDIA_COPY_KEYS.hueSync.powerBehaviorHelp)}</Description>
      </section>

      <section className={styles.section}>
        <SectionHeader title={copy(MEDIA_COPY_KEYS.hueSync.syncMode)} />
        <HueSyncModeButtons
          intensityEntityId={config.intensityEntityId}
          label={copy(MEDIA_COPY_KEYS.hueSync.syncMode)}
          lightSyncEntityId={config.lightSyncEntityId}
          powerEntityId={config.powerEntityId}
          syncModeEntityId={config.syncModeEntityId}
        />
      </section>

      <section className={styles.section}>
        <SectionHeader title={copy(MEDIA_COPY_KEYS.hueSync.intensity)} />
        <HueSyncIntensityGrid entityId={config.intensityEntityId} label={copy(MEDIA_COPY_KEYS.hueSync.intensity)} />
        <HueSyncBrightnessField entityId={config.brightnessEntityId} label={copy(MEDIA_COPY_KEYS.hueSync.brightness)} />
      </section>

      <section className={styles.section}>
        <SectionHeader title={copy(MEDIA_COPY_KEYS.hueSync.hdmiInput)} />
        <DynamicGrid ariaLabel={copy(MEDIA_COPY_KEYS.hueSync.hdmiInput)} className={styles.hueSyncChoiceGrid} columns={2} fillRows={false} layout="bounded" maxCellWidth={260} maxColumns={2}>
          {inputOptions.map((option, index) => (
            <HueSyncHdmiInputTile
              disabled={inputControl.unavailable}
              entityId={config.hdmiStatusEntityIds[index] ?? config.hdmiStatusEntityIds[config.hdmiStatusEntityIds.length - 1]}
              key={option}
              onSelect={() => inputControl.selectOption(option)}
              selected={inputControl.displayedState === option}
              title={option}
            />
          ))}
        </DynamicGrid>
      </section>
    </div>
  )
}

export function MediaRemoteModalNav({ activeTab, onTabChange, remoteTitle, showApps = true, showDevices = false, showHueSync = false }: { activeTab: MediaRemoteModalTab; onTabChange: (tab: MediaRemoteModalTab) => void; remoteTitle: string; showApps?: boolean; showDevices?: boolean; showHueSync?: boolean }) {
  const copy = useCopy(CORE_COPY_NAMESPACE)
  const tabs = mediaRemoteModalTabs(showApps, showDevices, showHueSync)
  const effectiveActiveTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const idPrefix = `media-${remoteTitle.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`

  return (
    <ModalIconTabNav
      activeTab={effectiveActiveTab}
      idPrefix={idPrefix}
      label={copy(CORE_COPY_KEYS.modal.sectionNavigation, { title: remoteTitle })}
      onTabChange={onTabChange}
      panelId={modalTabPanelId(idPrefix, 'content')}
      tabs={tabs}
    />
  )
}

function MediaRemoteModalTabContent({
  activeTab,
  config,
  controlsDisabled,
  hideKeyboard,
  onTextPrompt,
  showMediaControls,
  showVolumeControls,
  volumeControlsDisabled,
  textPrompt,
  textPromptInputRef,
  onTextPromptCancel,
  onTextPromptExited,
  onTextPromptOpened,
  onTextPromptSubmit,
}: {
  activeTab: MediaRemoteModalTab
  config: MediaRemoteConfig
  controlsDisabled: boolean
  hideKeyboard: boolean
  onTextPrompt: (action: TextPromptAction) => void
  showMediaControls: boolean
  showVolumeControls: boolean
  volumeControlsDisabled: boolean
  textPrompt: TextPromptState | null
  textPromptInputRef: RefObject<HTMLInputElement | null>
  onTextPromptCancel: () => void
  onTextPromptExited: () => void
  onTextPromptOpened: () => void
  onTextPromptSubmit: (action: TextPromptAction, text: string) => void
}) {
  const optimisticStates = useOptimisticActionStates()
  const liveControlEntity = useEntity(asEntityName(config.controlEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const controlEntity = withOptimisticState(liveControlEntity, config.controlEntityId, optimisticStates)
  const modalBodyRef = useRef<HTMLDivElement | null>(null)
  const modalPanelRef = useRef<HTMLDivElement | null>(null)
  const availableTabs = mediaRemoteModalTabs(Boolean(config.appCards?.length), Boolean(config.devices?.length), Boolean(config.hueSync))
  const targetTab = availableTabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { displayedTab: effectiveActiveTab, transitionState } = useSmoothDisplayedModalTab(targetTab)
  const selectedTabLabel = availableTabs.find((tab) => tab.tab === effectiveActiveTab)?.label ?? 'Controls'
  const tabIdPrefix = `media-${config.title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
  const previousDisplayedTabRef = useRef(effectiveActiveTab)

  useLayoutEffect(() => {
    if (previousDisplayedTabRef.current === effectiveActiveTab) return undefined
    previousDisplayedTabRef.current = effectiveActiveTab
    const scrollContainers = [
      modalPanelRef.current,
      modalBodyRef.current,
      modalBodyRef.current?.closest<HTMLElement>('[data-modal-sheet-body="true"]') ?? null,
    ]
    const reset = () => {
      for (const scrollContainer of scrollContainers) {
        if (scrollContainer) scrollContainer.scrollTop = 0
      }
    }
    reset()
    const frame = window.requestAnimationFrame(reset)
    return () => window.cancelAnimationFrame(frame)
  }, [effectiveActiveTab])

  return (
    <div className={styles.modalBody} ref={modalBodyRef}>
      <div aria-label={`${config.title} ${selectedTabLabel}`} className={styles.rightPane} data-tab={effectiveActiveTab} role="group">
        <PowerSection config={config} controlEntity={controlEntity} onTextPrompt={onTextPrompt} />

        <div className={styles.tabPanel} data-tab={effectiveActiveTab}>
          <section className={`${styles.section} ${styles.remoteControlSection}`}>
            <RemoteGrid config={config} disabled={controlsDisabled} onTextPrompt={onTextPrompt} />
          </section>

          <div aria-labelledby={modalTabId(tabIdPrefix, effectiveActiveTab)} className={styles.tabContent} data-modal-tab-transition-state={transitionState} data-scroll-region="media-remote-panel" data-tab={effectiveActiveTab} id={modalTabPanelId(tabIdPrefix, 'content')} ref={modalPanelRef} role="tabpanel">
            {effectiveActiveTab === 'controls' ? (
              <>
                {showVolumeControls ? (
                  <section className={styles.section}>
                    <SectionHeader title={config.volumeTitle} />
                    <VolumeSlider entityId={config.volumeEntityId} title={config.volumeTitle} />
                    <ButtonRow buttons={[config.volumeDownButton, config.volumeMuteButton, config.volumeUpButton]} disabled={volumeControlsDisabled} onTextPrompt={onTextPrompt} size="round" />
                  </section>
                ) : null}

                <RemoteShortcutSection
                  config={config}
                  controlsDisabled={controlsDisabled}
                  hideKeyboard={hideKeyboard}
                  onTextPrompt={onTextPrompt}
                  onTextPromptCancel={onTextPromptCancel}
                  onTextPromptExited={onTextPromptExited}
                  onTextPromptOpened={onTextPromptOpened}
                  onTextPromptSubmit={onTextPromptSubmit}
                  textPrompt={textPrompt}
                  textPromptInputRef={textPromptInputRef}
                />

                <section className={styles.section} data-desktop-muted-only={showMediaControls ? 'false' : 'true'} data-muted={showMediaControls ? 'false' : 'true'}>
                  <SectionHeader title="Controls" />
                  <ButtonRow buttons={[config.pauseButton, undefined, config.playButton]} disabled={controlsDisabled} onTextPrompt={onTextPrompt} size="round" />
                </section>
              </>
            ) : null}

            {effectiveActiveTab === 'apps' && config.appCards?.length ? (
              <section className={styles.section}>
                <SectionHeader title={config.appSectionTitle ?? 'Media'} />
                <div className={styles.appGrid}>
                  {config.appCards.map((app) => <AppButton app={app} key={app.title} />)}
                </div>
              </section>
            ) : null}

            {effectiveActiveTab === 'devices' && config.devices?.length ? (
              <section className={styles.section}>
                <SectionHeader title="Devices" />
                <DynamicGrid className={styles.deviceGrid} columns={2} fillRows={false} layout="bounded" maxCellWidth={260} maxColumns={4}>
                  {config.devices.map((device) => <DeviceButton device={device} key={device.title} />)}
                </DynamicGrid>
              </section>
            ) : null}

            {effectiveActiveTab === HUE_SYNC_MEDIA_REMOTE_MODAL_TAB.tab && config.hueSync ? <HueSyncTab config={config.hueSync} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function MediaRemoteModalInteractiveContent({ activeTab: controlledActiveTab, config, onTabChange }: { activeTab?: MediaRemoteModalTab; config: MediaRemoteConfig; onTabChange?: (tab: MediaRemoteModalTab) => void }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const optimisticStates = useOptimisticActionStates()
  const liveControlEntity = useEntity(asEntityName(config.controlEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const controlEntity = withOptimisticState(liveControlEntity, config.controlEntityId, optimisticStates)
  const volumeEntity = useEntity(asEntityName(config.volumeEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const [localActiveTab, setLocalActiveTab] = useState<MediaRemoteModalTab>('controls')
  const [textPrompt, setTextPrompt] = useState<TextPromptState | null>(null)
  const textPromptInputRef = useRef<HTMLInputElement | null>(null)
  const textPromptAnimationFrameRef = useRef<number | null>(null)
  const textPromptVisibilityCleanupRef = useRef<(() => void) | null>(null)
  const activeTab = controlledActiveTab ?? localActiveTab
  const setActiveTab = onTabChange ?? setLocalActiveTab
  const hasExternalNav = Boolean(onTabChange)
  const controlEntityOff = isOff(controlEntity)
  const controlsDisabled = controlEntityOff
  const hideKeyboard = Boolean(config.hideKeyboardWhenOff && controlEntityOff)
  const volumeControlsDisabled = isOff(volumeEntity)
  const showVolumeControls = config.showVolumeWhenOff ? Boolean(volumeEntity) : !volumeControlsDisabled
  const showMediaControls = !isOff(controlEntity)

  useEffect(() => () => {
    if (textPromptAnimationFrameRef.current !== null) window.cancelAnimationFrame(textPromptAnimationFrameRef.current)
    textPromptVisibilityCleanupRef.current?.()
  }, [])

  const cancelTextPromptAnimationFrame = () => {
    if (textPromptAnimationFrameRef.current === null) return
    window.cancelAnimationFrame(textPromptAnimationFrameRef.current)
    textPromptAnimationFrameRef.current = null
  }
  const schedulePromptVisibility = (reason: string) => {
    textPromptVisibilityCleanupRef.current?.()
    textPromptVisibilityCleanupRef.current = scheduleTextPromptVisibility(textPromptInputRef.current, reason)
  }

  const openTextPrompt = (action: TextPromptAction) => {
    cancelTextPromptAnimationFrame()
    let shouldFocus = false
    let shouldAnimateOpen = false
    flushSync(() => {
      setTextPrompt((current) => {
        if (current?.action.targetEntityId === action.targetEntityId && current.accordionState !== 'closing') {
          logRemoteAccordion('close-request', { state: current.accordionState })
          return current.accordionState === 'closed' ? null : { ...current, accordionState: 'closing' }
        }
        shouldFocus = true
        if (current && current.accordionState !== 'closed' && current.accordionState !== 'closing') {
          return { accordionState: current.accordionState, action }
        }
        shouldAnimateOpen = true
        logRemoteAccordion('open-request', { state: current?.accordionState ?? 'unmounted' })
        return { accordionState: 'closed', action }
      })
    })
    if (shouldAnimateOpen) {
      textPromptAnimationFrameRef.current = window.requestAnimationFrame(() => {
        textPromptAnimationFrameRef.current = null
        setTextPrompt((current) => current?.action.targetEntityId === action.targetEntityId && current.accordionState === 'closed'
          ? { ...current, accordionState: 'opening' }
          : current)
      })
    }
    if (shouldFocus) textPromptInputRef.current?.focus()
    if (shouldFocus) schedulePromptVisibility('sync-focus')
    else textPromptInputRef.current?.blur()
  }
  const closeTextPrompt = () => {
    cancelTextPromptAnimationFrame()
    textPromptVisibilityCleanupRef.current?.()
    textPromptVisibilityCleanupRef.current = null
    textPromptInputRef.current?.blur()
    setTextPrompt((current) => {
      if (!current || current.accordionState === 'closed') return null
      logRemoteAccordion('close-request', { state: current.accordionState })
      return { ...current, accordionState: 'closing' }
    })
  }

  const submitTextPrompt = (action: TextPromptAction, text: string) => {
    callService({ domain: 'androidtv', service: 'adb_command', target: action.targetEntityId, serviceData: { command: textInputCommand(text) } })
    closeTextPrompt()
  }

  return (
    <div className={styles.remoteContainer}>
      <div className={styles.remoteModal} data-inline-nav={hasExternalNav ? 'false' : 'true'}>
        <MediaRemoteModalTabContent
          activeTab={activeTab}
          config={config}
          controlsDisabled={controlsDisabled}
          hideKeyboard={hideKeyboard}
          onTextPrompt={openTextPrompt}
          onTextPromptCancel={closeTextPrompt}
          onTextPromptExited={() => setTextPrompt((current) => current?.accordionState === 'closing' ? null : current)}
          onTextPromptOpened={() => setTextPrompt((current) => current?.accordionState === 'opening' ? { ...current, accordionState: 'open' } : current)}
          onTextPromptSubmit={submitTextPrompt}
          showMediaControls={showMediaControls}
          showVolumeControls={showVolumeControls}
          volumeControlsDisabled={volumeControlsDisabled}
          textPrompt={textPrompt}
          textPromptInputRef={textPromptInputRef}
        />
        {!hasExternalNav ? (
          <MediaRemoteModalNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            remoteTitle={config.title}
            showApps={Boolean(config.appCards?.length)}
            showDevices={Boolean(config.devices?.length)}
            showHueSync={Boolean(config.hueSync)}
          />
        ) : null}
      </div>
    </div>
  )
}

function MediaRemotePreloadContent({ config }: { config: MediaRemoteConfig }) {
  return (
    <div className={styles.remoteContainer} data-media-remote-preload={config.hash}>
      <div aria-hidden="true" className={styles.preloadRemoteGeometry} />
    </div>
  )
}

export function MediaRemoteModalContent({
  activeTab,
  config,
  onTabChange,
  preload = false,
}: {
  activeTab?: MediaRemoteModalTab
  config: MediaRemoteConfig
  onTabChange?: (tab: MediaRemoteModalTab) => void
  preload?: boolean
}) {
  if (preload) return <MediaRemotePreloadContent config={config} />

  const content = <MediaRemoteModalInteractiveContent activeTab={activeTab} config={config} onTabChange={onTabChange} />
  return config.optimisticStateEntityIds?.length
    ? <OptimisticActionStateBoundary entityIds={config.optimisticStateEntityIds} liveChangeEntityIds={config.optimisticLiveChangeEntityIds}>{content}</OptimisticActionStateBoundary>
    : content
}
