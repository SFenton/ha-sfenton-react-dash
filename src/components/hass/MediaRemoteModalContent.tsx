import { useState } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { MEDIA_COLOR, UNAVAILABLE_COLOR } from '../../constants/portedDashboard'
import type { MediaRemoteAction, MediaRemoteAppConfig, MediaRemoteButtonConfig, MediaRemoteConfig, MediaRemoteDeviceConfig, MediaRemoteIconColorRule } from '../../constants/mediaRemotes'
import { asEntityName, titleCaseState } from './entityState'
import styles from './MediaRemoteModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void

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

function isMediaActive(entity: EntityLike | null | undefined) {
  return !isUnavailable(entity) && entity?.state !== 'off'
}

function formatMediaState(entity: EntityLike | null | undefined, fallback = 'Unavailable') {
  if (!entity) return fallback
  if (entity.state === 'unavailable') return 'Unavailable'
  if (entity.state === 'unknown') return 'Unknown'
  return titleCaseState(entity.state)
}

function volumeLabel(entity: EntityLike | null | undefined) {
  if (isUnavailable(entity)) return 'Unavailable'
  const volumeLevel = entity?.attributes.volume_level
  const muted = entity?.attributes.is_volume_muted === true
  const parts = [formatMediaState(entity)]
  if (typeof volumeLevel === 'number') parts.push(`${Math.round(volumeLevel * 100)}%`)
  if (muted) parts.push('Muted')
  return parts.join(' • ')
}

function mediaLabel(entity: EntityLike | null | undefined) {
  if (isUnavailable(entity)) return 'Unavailable'
  const appName = entity?.attributes.app_name
  const mediaTitle = entity?.attributes.media_title
  const parts = [formatMediaState(entity)]
  if (typeof appName === 'string' && appName.trim()) parts.push(appName)
  if (typeof mediaTitle === 'string' && mediaTitle.trim()) parts.push(mediaTitle)
  return parts.join(' • ')
}

function textInputCommand(value: string) {
  return `input text '${value.replace(/'/g, "'\\''")}'`
}

function resolveAction(action: MediaRemoteAction, entityId: string | undefined, entities: Record<string, EntityLike | undefined>) {
  if (action.type !== 'state') return action
  const stateEntityId = action.entityId ?? entityId
  const state = stateEntityId ? entities[stateEntityId]?.state : undefined
  const matchedCase = action.cases.find((candidate) => state !== undefined && candidate.states.includes(state))
  return matchedCase?.action ?? action.defaultAction
}

function runAction(callService: CallService, action: MediaRemoteAction, entities: Record<string, EntityLike | undefined>, entityId?: string) {
  const resolvedAction = resolveAction(action, entityId, entities)

  if (resolvedAction.type === 'textPrompt') {
    const text = window.prompt('Enter text to send to SHIELD:')
    if (!text) return
    callService({ domain: 'androidtv', service: 'adb_command', target: resolvedAction.targetEntityId, serviceData: { command: textInputCommand(text) } })
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

function RemoteButton({ button, disabled = false, size = 'normal' }: { button: MediaRemoteButtonConfig; disabled?: boolean; size?: 'normal' | 'small' }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const iconColor = iconColorFromRule(button.iconColorRule, entities)
  const iconSize = button.icon === 'mdi:circle' ? 22 : 30
  const iconRotation = button.iconRotationDegrees ? `rotate(${button.iconRotationDegrees} 12 12)` : undefined

  return (
    <button
      aria-label={button.label}
      className={styles.remoteButton}
      data-icon={button.icon}
      data-size={size}
      disabled={disabled}
      onClick={() => runAction(callService, button.action, entities)}
      style={iconColor ? { color: iconColor } : undefined}
      type="button"
    >
      <MaterialIcon name={button.icon} pathTransform={iconRotation} size={iconSize} />
    </button>
  )
}

function RemotePad({ config, disabled }: { config: MediaRemoteConfig; disabled: boolean }) {
  return (
    <div className={styles.remotePad} role="group" aria-label={`${config.title} direction pad`}>
      <span />
      <RemoteButton button={config.upButton} disabled={disabled} />
      <span />
      <RemoteButton button={config.leftButton} disabled={disabled} />
      <RemoteButton button={config.selectButton} disabled={disabled} />
      <RemoteButton button={config.rightButton} disabled={disabled} />
      <span />
      <RemoteButton button={config.downButton} disabled={disabled} />
      <span />
    </div>
  )
}

function ButtonRow({ buttons, disabled }: { buttons: Array<MediaRemoteButtonConfig | undefined>; disabled: boolean }) {
  return (
    <div className={styles.buttonRow}>
      {buttons.map((button) => button ? <RemoteButton button={button} disabled={disabled} key={button.label} size="small" /> : <span key="empty" />)}
    </div>
  )
}

function MediaSummary({ entityId, title }: { entityId: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const unavailable = isUnavailable(entity)

  return (
    <Card
      ariaLabel={`${title} ${mediaLabel(entity)}`}
      color={unavailable ? UNAVAILABLE_COLOR : MEDIA_COLOR}
      disabled={unavailable}
      icon={<MaterialIcon name="mdi:remote" size={34} />}
      muted={unavailable || !isMediaActive(entity)}
      size="compact"
      subtitle={mediaLabel(entity)}
      title={title}
    />
  )
}

function VolumeSummary({ entityId, title }: { entityId: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const unavailable = isUnavailable(entity)

  return (
    <Card
      ariaLabel={`${title} ${volumeLabel(entity)}`}
      color={unavailable ? UNAVAILABLE_COLOR : MEDIA_COLOR}
      disabled={unavailable}
      icon={<MaterialIcon name="mdi:speaker" size={34} />}
      muted={unavailable || !isMediaActive(entity)}
      size="compact"
      subtitle={volumeLabel(entity)}
      title={title}
    />
  )
}

function DeviceButton({ device }: { device: MediaRemoteDeviceConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const entity = useEntity(asEntityName(device.entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const unavailable = isUnavailable(entity)
  const subtitle = formatMediaState(entity)

  return (
    <button aria-label={`${device.title} ${subtitle}`} className={styles.deviceButton} disabled={unavailable} onClick={() => runAction(callService, device.action, entities, device.entityId)} type="button">
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
    <button aria-label={app.title} className={styles.appButton} data-background={app.background} onClick={() => runAction(callService, app.action, entities)} type="button">
      {imageFailed ? <MaterialIcon name={app.icon ?? 'mdi:play-box'} size={34} /> : <img alt="" className={styles.appImage} onError={() => setImageFailed(true)} src={app.imageUrl} />}
    </button>
  )
}

export function MediaRemoteModalContent({ config }: { config: MediaRemoteConfig }) {
  const controlEntity = useEntity(asEntityName(config.controlEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const volumeEntity = useEntity(asEntityName(config.volumeEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const controlsDisabled = isOff(controlEntity)
  const showVolumeControls = !isOff(volumeEntity)
  const showMediaControls = !isOff(controlEntity)

  return (
    <div className={styles.remoteModal}>
      <section className={styles.section}>
        <SectionHeader title={config.remoteTitle} />
        <div className={styles.powerRow}>
          <MediaSummary entityId={config.mediaEntityId} title={config.title} />
          <RemoteButton button={config.powerButton} />
        </div>
        <RemotePad config={config} disabled={controlsDisabled} />
        <ButtonRow buttons={[config.backButton, config.homeButton, config.keyboardButton]} disabled={controlsDisabled} />
      </section>

      {showVolumeControls ? (
        <section className={styles.section}>
          <SectionHeader title={config.volumeTitle} />
          <VolumeSummary entityId={config.volumeEntityId} title={config.volumeTitle} />
          <ButtonRow buttons={[config.volumeDownButton, config.volumeMuteButton, config.volumeUpButton]} disabled={isUnavailable(controlEntity)} />
        </section>
      ) : null}

      {showMediaControls ? (
        <section className={styles.section}>
          <SectionHeader title="Controls" />
          <ButtonRow buttons={[config.pauseButton, undefined, config.playButton]} disabled={controlsDisabled} />
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
