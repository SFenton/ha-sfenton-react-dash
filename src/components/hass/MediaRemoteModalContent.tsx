import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useEntity, useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import { GlassTile, type TileTone } from '../core/GlassTile'
import type { MediaRemoteAction, MediaRemoteAppConfig, MediaRemoteButtonConfig, MediaRemoteConfig, MediaRemoteDeviceConfig, MediaRemoteIconColorRule } from '../../constants/mediaRemotes'
import { mediaRemoteModalTabs, type MediaRemoteModalTab } from '../../constants/surfaceSemantics'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { asEntityName, titleCaseState } from './entityState'
import styles from './MediaRemoteModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void
type TextPromptAction = Extract<MediaRemoteAction, { type: 'textPrompt' }>
type TextPromptAccordionState = 'closed' | 'closing' | 'open' | 'opening'
type TextPromptState = { accordionState: TextPromptAccordionState; action: TextPromptAction }

const VOLUME_OPTIMISTIC_REVERT_MS = 2500
const REMOTE_ACCORDION_DEBUG_KEY = 'haDash.remoteAccordionDebug'
const DESKTOP_MODAL_QUERY = '(min-width: 760px)'

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

function shouldResetScrollOnTabChange() {
  return typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_MODAL_QUERY).matches
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
  const iconColor = iconColorFromRule(button.iconColorRule, entities)
  const iconRotation = button.iconRotationDegrees ? `rotate(${button.iconRotationDegrees} 12 12)` : undefined
  const powerLabel = isOff(controlEntity) ? 'Power On' : 'Power Off'

  return (
    <button
      aria-label={button.label}
      className={`${styles.remoteButton} ${styles.powerButton}`}
      data-icon={button.icon}
      data-size="power"
      onClick={() => runAction(callService, button.action, entities, undefined, onTextPrompt)}
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
  const interactive = accordionState !== 'closed'
  const open = accordionState !== 'closing'

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
    const handleViewportChange = () => scheduleTextPromptVisibility(inputRef.current, 'visual-viewport')
    const handleFocus = () => scheduleTextPromptVisibility(inputRef.current, 'input-focus')

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
          onOpened()
          inputRef.current?.focus()
          scheduleTextPromptVisibility(inputRef.current, 'transition-focus')
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
  const entity = useEntity(asEntityName(device.entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const unavailable = isUnavailable(entity)
  const subtitle = formatMediaState(entity)
  const tone: TileTone = device.entityId.startsWith('input_boolean.') ? 'switch' : 'media'
  const runDeviceAction = unavailable ? undefined : () => runAction(callService, device.action, entities, device.entityId, () => undefined)

  return (
    <GlassTile icon={device.icon} isOff={isOff(entity)} onClick={runDeviceAction} subtitle={subtitle} title={device.title} tone={tone} />
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

export function MediaRemoteModalNav({ activeTab, onTabChange, remoteTitle, showDevices = false }: { activeTab: MediaRemoteModalTab; onTabChange: (tab: MediaRemoteModalTab) => void; remoteTitle: string; showDevices?: boolean }) {
  const tabs = mediaRemoteModalTabs(showDevices)
  const effectiveActiveTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(effectiveActiveTab)

  return (
    <nav aria-label={`${remoteTitle} modal sections`} className={styles.remoteModalNav} style={{ '--remote-nav-tab-count': tabs.length } as CSSProperties}>
      {tabs.map((item) => {
        const isActive = visualActiveTab === item.tab
        const isCurrent = effectiveActiveTab === item.tab
        return (
          <button
            aria-current={isCurrent ? 'page' : undefined}
            aria-label={item.label}
            className={[styles.remoteModalNavButton, isActive ? styles.remoteModalNavButtonActive : ''].filter(Boolean).join(' ')}
            data-active={isActive}
            key={item.tab}
            onBlur={clearVisualTab}
            onClick={() => {
              setVisualTabNow(item.tab)
              onTabChange(item.tab)
            }}
            onPointerCancel={clearVisualTab}
            onPointerDown={() => setVisualTabNow(item.tab)}
            type="button"
          >
            <MaterialIcon name={item.icon} size={22} />
          </button>
        )
      })}
    </nav>
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
  const controlEntity = useEntity(asEntityName(config.controlEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const modalBodyRef = useRef<HTMLDivElement | null>(null)
  const modalPanelRef = useRef<HTMLDivElement | null>(null)
  const tabContentRef = useRef<HTMLDivElement | null>(null)
  const availableTabs = mediaRemoteModalTabs(Boolean(config.devices?.length))
  const targetTab = availableTabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { displayedTab: effectiveActiveTab, transitionState } = useSmoothDisplayedModalTab(targetTab)
  const selectedTabLabel = availableTabs.find((tab) => tab.tab === effectiveActiveTab)?.label ?? 'Controls'

  useEffect(() => {
    if (!shouldResetScrollOnTabChange()) return

    const scrollContainers = [
      modalPanelRef.current,
      tabContentRef.current,
      modalBodyRef.current,
      modalBodyRef.current ? scrollableAncestor(modalBodyRef.current) : null,
    ]
    for (const scrollContainer of scrollContainers) {
      if (!scrollContainer || typeof scrollContainer.scrollTo !== 'function') continue
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [effectiveActiveTab])

  return (
    <div className={styles.modalBody} ref={modalBodyRef}>
      <div aria-label={`${config.title} ${selectedTabLabel}`} className={styles.rightPane} role="group">
        <PowerSection config={config} controlEntity={controlEntity} onTextPrompt={onTextPrompt} />

        <div className={styles.tabPanel} data-scroll-region="media-remote-panel" data-tab={effectiveActiveTab} ref={modalPanelRef}>
          <section className={`${styles.section} ${styles.remoteControlSection}`}>
            <RemoteGrid config={config} disabled={controlsDisabled} onTextPrompt={onTextPrompt} />
          </section>

          <div className={styles.tabContent} data-modal-tab-transition-state={transitionState} ref={tabContentRef}>
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
                <div className={styles.deviceGrid}>
                  {config.devices.map((device) => <DeviceButton device={device} key={device.title} />)}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MediaRemoteModalContent({ activeTab: controlledActiveTab, config, onTabChange }: { activeTab?: MediaRemoteModalTab; config: MediaRemoteConfig; onTabChange?: (tab: MediaRemoteModalTab) => void }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const controlEntity = useEntity(asEntityName(config.controlEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const volumeEntity = useEntity(asEntityName(config.volumeEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const [localActiveTab, setLocalActiveTab] = useState<MediaRemoteModalTab>('controls')
  const [textPrompt, setTextPrompt] = useState<TextPromptState | null>(null)
  const textPromptInputRef = useRef<HTMLInputElement | null>(null)
  const textPromptAnimationFrameRef = useRef<number | null>(null)
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
  }, [])

  const cancelTextPromptAnimationFrame = () => {
    if (textPromptAnimationFrameRef.current === null) return
    window.cancelAnimationFrame(textPromptAnimationFrameRef.current)
    textPromptAnimationFrameRef.current = null
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
    if (shouldFocus) scheduleTextPromptVisibility(textPromptInputRef.current, 'sync-focus')
    else textPromptInputRef.current?.blur()
  }
  const closeTextPrompt = () => {
    cancelTextPromptAnimationFrame()
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
      {!hasExternalNav ? <MediaRemoteModalNav activeTab={activeTab} onTabChange={setActiveTab} remoteTitle={config.title} showDevices={Boolean(config.devices?.length)} /> : null}
    </div>
  )
}
