import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useEntity, useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import type { MediaRemoteAction, MediaRemoteAppConfig, MediaRemoteButtonConfig, MediaRemoteConfig, MediaRemoteDeviceConfig, MediaRemoteIconColorRule } from '../../constants/mediaRemotes'
import { asEntityName, titleCaseState } from './entityState'
import styles from './MediaRemoteModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void
type TextPromptAction = Extract<MediaRemoteAction, { type: 'textPrompt' }>

const VOLUME_OPTIMISTIC_REVERT_MS = 2500
const REMOTE_ACCORDION_DEBUG_KEY = 'haDash.remoteAccordionDebug'

interface EntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
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
  let current = element.parentElement
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current)
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current
    current = current.parentElement
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement
}

function keepTextPromptVisible(input: HTMLInputElement | null, reason: string) {
  if (!input) return
  const scroller = scrollableAncestor(input)
  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
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
  if (!input) return
  keepTextPromptVisible(input, `${reason}:now`)
  window.requestAnimationFrame(() => keepTextPromptVisible(input, `${reason}:raf`))
  window.setTimeout(() => keepTextPromptVisible(input, `${reason}:80ms`), 80)
  window.setTimeout(() => keepTextPromptVisible(input, `${reason}:240ms`), 240)
  window.setTimeout(() => keepTextPromptVisible(input, `${reason}:520ms`), 520)
}

function resolveAction(action: MediaRemoteAction, entityId: string | undefined, entities: Record<string, EntityLike | undefined>) {
  if (action.type !== 'state') return action
  const stateEntityId = action.entityId ?? entityId
  const state = stateEntityId ? entities[stateEntityId]?.state : undefined
  const matchedCase = action.cases.find((candidate) => state !== undefined && candidate.states.includes(state))
  return matchedCase?.action ?? action.defaultAction
}

function runAction(callService: CallService, action: MediaRemoteAction, entities: Record<string, EntityLike | undefined>, entityId: string | undefined, onTextPrompt: (action: TextPromptAction) => void) {
  const resolvedAction = resolveAction(action, entityId, entities)

  if (resolvedAction.type === 'textPrompt') {
    onTextPrompt(resolvedAction)
    return
  }

  callService({ domain: resolvedAction.domain, service: resolvedAction.service, target: resolvedAction.target, serviceData: resolvedAction.serviceData })
}

function iconColorFromRule(rule: MediaRemoteIconColorRule | undefined, entities: Record<string, EntityLike | undefined>) {
  if (!rule) return undefined
  const inactive = rule.entityIds.every((entityId) => {
    const entity = entities[entityId]
    const inactiveStates = rule.inactiveStatesByEntity?.[entityId] ?? rule.inactiveStates
    return entity ? inactiveStates.includes(entity.state) : false
  })
  return inactive ? rule.inactiveColor : rule.activeColor
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
  const iconColor = iconColorFromRule(button.iconColorRule, entities)
  const iconSize = size === 'large' ? 42 : button.icon === 'mdi:circle' ? 24 : 30
  const iconRotation = button.iconRotationDegrees ? `rotate(${button.iconRotationDegrees} 12 12)` : undefined
  const hasIcon = button.icon.trim().length > 0

  return (
    <button
      aria-label={button.label}
      className={styles.remoteButton}
      data-icon={button.icon}
      data-size={size}
      disabled={disabled}
      onClick={() => runAction(callService, button.action, entities, undefined, onTextPrompt)}
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

function remoteGridButtonSize(config: MediaRemoteConfig, button: MediaRemoteButtonConfig): 'large' | 'round' | 'small' {
  if (button === config.powerButton) return 'small'
  if (button === config.backButton || button === config.homeButton || button === config.keyboardButton) return 'round'
  return 'large'
}

function RemoteGrid({ config, disabled, hideKeyboard, onTextPrompt }: { config: MediaRemoteConfig; disabled: boolean; hideKeyboard: boolean; onTextPrompt: (action: TextPromptAction) => void }) {
  const keyboardButton = hideKeyboard ? undefined : config.keyboardButton
  const cells = [
    undefined, undefined, config.powerButton,
    undefined, config.upButton, undefined,
    config.leftButton, config.selectButton, config.rightButton,
    undefined, config.downButton, undefined,
    config.backButton, config.homeButton, keyboardButton,
  ]

  return (
    <div className={styles.remoteGrid} role="group" aria-label={`${config.title} remote controls`}>
      {cells.map((button, index) => button ? <RemoteButton button={button} disabled={button === config.powerButton ? false : disabled} key={`${button.label}-${index}`} onTextPrompt={onTextPrompt} size={remoteGridButtonSize(config, button)} /> : <RemoteSpacer key={`spacer-${index}`} />)}
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

function TextPromptForm({ action, inputRef, onCancel, onExited, onSubmit, open }: { action: TextPromptAction; inputRef: RefObject<HTMLInputElement | null>; onCancel: () => void; onExited: () => void; onSubmit: (action: TextPromptAction, text: string) => void; open: boolean }) {
  const [text, setText] = useState('')
  const [accordionState, setAccordionState] = useState<'closed' | 'closing' | 'open' | 'opening'>('closed')
  const accordionRef = useRef<HTMLDivElement | null>(null)
  const interactive = accordionState !== 'closed'

  useEffect(() => {
    if (!open) {
      logRemoteAccordion('close-request', { state: accordionState })
      setAccordionState('closing')
      return undefined
    }

    logRemoteAccordion('open-request', { state: accordionState })
    setAccordionState('closed')
    const frame = window.requestAnimationFrame(() => setAccordionState('opening'))
    return () => window.cancelAnimationFrame(frame)
  }, [open])

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
    setText('')
  }, [action])

  useEffect(() => {
    if (!open) return undefined
    const viewport = window.visualViewport
    const handleViewportChange = () => scheduleTextPromptVisibility(inputRef.current, 'visual-viewport')
    const handleFocus = () => scheduleTextPromptVisibility(inputRef.current, 'input-focus')

    inputRef.current?.addEventListener('focus', handleFocus)
    viewport?.addEventListener('resize', handleViewportChange)
    viewport?.addEventListener('scroll', handleViewportChange)
    window.addEventListener('resize', handleViewportChange)

    return () => {
      inputRef.current?.removeEventListener('focus', handleFocus)
      viewport?.removeEventListener('resize', handleViewportChange)
      viewport?.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [inputRef, open])

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
          setAccordionState('open')
          inputRef.current?.focus()
          scheduleTextPromptVisibility(inputRef.current, 'transition-focus')
          logRemoteAccordion('focus-after-open', { activeElement: document.activeElement instanceof HTMLElement ? document.activeElement.id || document.activeElement.tagName : null })
        } else if (accordionState === 'closing') {
          setAccordionState('closed')
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
  const [optimisticPercent, setOptimisticPercent] = useState<number | null>(null)
  const revertTimerRef = useRef<number | null>(null)
  const unavailable = isUnavailable(entity)
  const volumeLevel = typeof entity?.attributes.volume_level === 'number' ? entity.attributes.volume_level : 0
  const volumePercent = Math.round(volumeLevel * 100)
  const displayedPercent = optimisticPercent ?? volumePercent
  const sliderStyle = { '--volume-percent': `${displayedPercent}%` } as CSSProperties

  useEffect(() => {
    if (optimisticPercent === null) return
    if (Math.abs(volumePercent - optimisticPercent) > 1) return
    if (revertTimerRef.current !== null) {
      window.clearTimeout(revertTimerRef.current)
      revertTimerRef.current = null
    }
    setOptimisticPercent(null)
  }, [optimisticPercent, volumePercent])

  useEffect(() => () => {
    if (revertTimerRef.current !== null) window.clearTimeout(revertTimerRef.current)
  }, [])

  const commitVolume = (nextPercent: number) => {
    setOptimisticPercent(nextPercent)
    if (revertTimerRef.current !== null) window.clearTimeout(revertTimerRef.current)
    revertTimerRef.current = window.setTimeout(() => {
      revertTimerRef.current = null
      setOptimisticPercent(null)
    }, VOLUME_OPTIMISTIC_REVERT_MS)
    callService({ domain: 'media_player', service: 'volume_set', target: entityId, serviceData: { volume_level: nextPercent / 100 } })
  }

  return (
    <label className={styles.volumeSlider} data-muted={unavailable ? 'true' : 'false'}>
      <span className={styles.srOnly}>{title} volume</span>
      <input
        aria-label={`${title} volume`}
        disabled={unavailable}
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
  const entity = useEntity(asEntityName(device.entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const unavailable = isUnavailable(entity)
  const subtitle = formatMediaState(entity)

  return (
    <button aria-label={`${device.title} ${subtitle}`} className={styles.deviceButton} disabled={unavailable} onClick={() => runAction(callService, device.action, entities, device.entityId, () => undefined)} type="button">
      <span className={styles.deviceIcon}>
        <MaterialIcon name={device.icon} size={22} />
      </span>
      <span>
        <strong>{device.title}</strong>
        <span>{subtitle}</span>
      </span>
    </button>
  )
}

function AppButton({ app }: { app: MediaRemoteAppConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button aria-label={app.title} className={styles.appButton} data-background={app.background} onClick={() => runAction(callService, app.action, entities, undefined, () => undefined)} type="button">
      {imageFailed ? <MaterialIcon name={app.icon ?? 'mdi:play-box'} size={34} /> : <img alt="" className={styles.appImage} onError={() => setImageFailed(true)} src={app.imageUrl} />}
    </button>
  )
}

export function MediaRemoteModalContent({ config }: { config: MediaRemoteConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const controlEntity = useEntity(asEntityName(config.controlEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const volumeEntity = useEntity(asEntityName(config.volumeEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const [textPrompt, setTextPrompt] = useState<{ action: TextPromptAction; open: boolean } | null>(null)
  const textPromptInputRef = useRef<HTMLInputElement | null>(null)
  const controlEntityOff = isOff(controlEntity)
  const controlsDisabled = controlEntityOff
  const hideKeyboard = Boolean(config.hideKeyboardWhenOff && controlEntityOff)
  const showVolumeControls = !isOff(volumeEntity)
  const showMediaControls = !isOff(controlEntity)

  const openTextPrompt = (action: TextPromptAction) => {
    let shouldFocus = false
    flushSync(() => {
      setTextPrompt((current) => {
        if (current?.open && current.action.targetEntityId === action.targetEntityId) return { ...current, open: false }
        shouldFocus = true
        return { action, open: true }
      })
    })
    if (shouldFocus) textPromptInputRef.current?.focus()
    if (shouldFocus) scheduleTextPromptVisibility(textPromptInputRef.current, 'sync-focus')
    else textPromptInputRef.current?.blur()
  }
  const closeTextPrompt = () => {
    textPromptInputRef.current?.blur()
    setTextPrompt((current) => current ? { ...current, open: false } : null)
  }

  const submitTextPrompt = (action: TextPromptAction, text: string) => {
    callService({ domain: 'androidtv', service: 'adb_command', target: action.targetEntityId, serviceData: { command: textInputCommand(text) } })
    closeTextPrompt()
  }

  return (
    <div className={styles.remoteModal}>
      <section className={`${styles.section} ${styles.remoteControlSection}`}>
        <RemoteGrid config={config} disabled={controlsDisabled} hideKeyboard={hideKeyboard} onTextPrompt={openTextPrompt} />
        {textPrompt ? <TextPromptForm action={textPrompt.action} inputRef={textPromptInputRef} onCancel={closeTextPrompt} onExited={() => setTextPrompt(null)} onSubmit={submitTextPrompt} open={textPrompt.open} /> : null}
      </section>

      {showVolumeControls ? (
        <section className={styles.section}>
          <SectionHeader title={config.volumeTitle} />
          <VolumeSlider entityId={config.volumeEntityId} title={config.volumeTitle} />
          <ButtonRow buttons={[config.volumeDownButton, config.volumeMuteButton, config.volumeUpButton]} disabled={isUnavailable(controlEntity)} onTextPrompt={openTextPrompt} size="round" />
        </section>
      ) : null}

      {showMediaControls ? (
        <section className={styles.section}>
          <SectionHeader title="Controls" />
          <ButtonRow buttons={[config.pauseButton, undefined, config.playButton]} disabled={controlsDisabled} onTextPrompt={openTextPrompt} size="round" />
        </section>
      ) : null}

      {config.appCards?.length ? (
        <section className={styles.section}>
          <SectionHeader title={config.appSectionTitle ?? 'Media'} />
          <div className={styles.appGrid}>
            {config.appCards.map((app) => <AppButton app={app} key={app.title} />)}
          </div>
        </section>
      ) : null}

      {config.devices?.length ? (
        <section className={styles.section}>
          <SectionHeader title="Devices" />
          <div className={styles.deviceGrid}>
            {config.devices.map((device) => <DeviceButton device={device} key={device.title} />)}
          </div>
        </section>
      ) : null}
    </div>
  )
}
