import type { BathroomFanConfig } from '../../constants/bathroomFans'
import { BATHROOM_FAN_COPY_KEYS, BATHROOM_FAN_COPY_NAMESPACE, useCopy } from '../../i18n'
import { GlassTile, type GlassTileControls } from '../core/GlassTile'
import { type BathroomFanCommandController, useSharedBathroomFanCommand } from './bathroomFanCommandContext'
import { useBathroomFanCommand } from './useBathroomFanCommand'
import styles from './BathroomFanTile.module.css'

interface BathroomFanTileProps {
  config: BathroomFanConfig
  onOpen: () => void
  preload?: boolean
}

const NOOP = () => undefined

function BathroomFanTileView({ config, fan, onOpen }: BathroomFanTileProps & { fan: BathroomFanCommandController }) {
  const copy = useCopy(BATHROOM_FAN_COPY_NAMESPACE)
  const subtitle = fan.powerAvailable
    ? fan.powerOn ? copy(BATHROOM_FAN_COPY_KEYS.states.on) : copy(BATHROOM_FAN_COPY_KEYS.states.off)
    : copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)
  const controls: GlassTileControls = [
    {
      ariaLabel: copy(BATHROOM_FAN_COPY_KEYS.lock),
      disabled: !fan.lockAvailable,
      icon: fan.locked ? 'mdi:lock' : 'mdi:lock-open-variant',
      id: 'lock',
      onPress: () => fan.setLocked(!fan.locked),
      semantics: { kind: 'toggle', checked: fan.locked },
    },
    {
      ariaLabel: copy(BATHROOM_FAN_COPY_KEYS.power),
      disabled: !fan.powerAvailable,
      icon: 'mdi:power',
      id: 'power',
      onPress: () => fan.setPower(!fan.powerOn),
      semantics: { kind: 'toggle', checked: fan.powerOn },
    },
  ]

  return (
    <div className={styles.root} data-bathroom-fan-tile={config.id}>
      <GlassTile
        controls={controls}
        icon="mdi:fan"
        isOff={!fan.powerOn || !fan.powerAvailable}
        onClick={onOpen}
        semantics={{ kind: 'modal' }}
        subtitle={subtitle}
        title={copy(BATHROOM_FAN_COPY_KEYS.fan)}
        tone="switch"
      />
    </div>
  )
}

function BathroomFanTilePreload({ config }: Pick<BathroomFanTileProps, 'config'>) {
  const copy = useCopy(BATHROOM_FAN_COPY_NAMESPACE)
  const controls: GlassTileControls = [
    {
      ariaLabel: copy(BATHROOM_FAN_COPY_KEYS.lock),
      disabled: true,
      icon: 'mdi:lock-open-variant',
      id: 'lock',
      onPress: NOOP,
      semantics: { kind: 'toggle', checked: false },
    },
    {
      ariaLabel: copy(BATHROOM_FAN_COPY_KEYS.power),
      disabled: true,
      icon: 'mdi:power',
      id: 'power',
      onPress: NOOP,
      semantics: { kind: 'toggle', checked: false },
    },
  ]

  return (
    <div className={styles.root} data-bathroom-fan-tile={config.id} data-preload="true">
      <GlassTile
        ariaDisabled
        controls={controls}
        icon="mdi:fan"
        isOff
        onClick={NOOP}
        semantics={{ kind: 'modal' }}
        subtitle={copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)}
        title={copy(BATHROOM_FAN_COPY_KEYS.fan)}
        tone="switch"
      />
    </div>
  )
}

function StandaloneBathroomFanTile(props: BathroomFanTileProps) {
  const fan = useBathroomFanCommand(props.config)
  return <BathroomFanTileView {...props} fan={fan} />
}

export function BathroomFanTile(props: BathroomFanTileProps) {
  const sharedFan = useSharedBathroomFanCommand(props.config)
  if (props.preload) return <BathroomFanTilePreload config={props.config} />
  return sharedFan
    ? <BathroomFanTileView {...props} fan={sharedFan} />
    : <StandaloneBathroomFanTile {...props} />
}
