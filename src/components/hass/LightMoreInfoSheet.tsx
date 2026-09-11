import { useEntity, useHass } from '@hakit/core'
import type { CSSProperties } from 'react'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import {
  lightRgbCss,
  readLightHs,
  readLightRgb,
  type LightHs,
  type LightRgb,
} from './lightColor'
import { LightColorPicker } from './LightColorPicker'
import { LightBrightnessCard } from './LightBrightnessCard'
import { asEntityName } from './entityState'
import styles from './LightMoreInfoSheet.module.css'

const FRONT_YARD_GROUP = 'light.front_yard_lights'
const COLOR_MODES = ['hs', 'rgb', 'rgbw', 'rgbww', 'xy']
const LIGHT_COLOR_PICKER_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'light-more-info',
  inlineSize: '700px',
} satisfies ModalCenteredGeometry

interface LightRef {
  entityId: string
  title: string
}

// Hue (deg) + saturation (0-100) → normalized wheel coordinates in [-1, 1],
// matching HAKit's color wheel orientation (0° at +x, clockwise with screen y).
function hsToXY([hue, saturation]: LightHs) {
  const radius = Math.min(1, saturation / 100)
  const phi = (hue * Math.PI) / 180
  return { x: radius * Math.cos(phi), y: radius * Math.sin(phi) }
}

function xyKey({ x, y }: { x: number; y: number }) {
  return `${x.toFixed(4)},${y.toFixed(4)}`
}

function parseXyKey(key: string): { x: number; y: number } | null {
  if (!key) return null
  const [x, y] = key.split(',').map(Number)
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  return { x, y }
}

interface LightMoreInfoSheetProps {
  entityId: string | null
  title: string
  open: boolean
  onClose: () => void
  /** All custom lights, used to drive the "apply another light's color" buttons. */
  lights?: LightRef[]
}

// A tile that copies another light's current color onto the open light.
function OtherLightButton({ light, onApply }: { light: LightRef; onApply: (rgb: LightRgb) => void }) {
  const entity = useEntity(asEntityName(light.entityId), { returnNullIfNotFound: true })
  const rgb = readLightRgb(entity?.attributes?.rgb_color)
  const style = {
    '--other-light-color': rgb ? lightRgbCss(rgb) : undefined,
  } as CSSProperties

  return (
    <button
      aria-label={`Apply ${light.title} Color`}
      className={styles.otherSwatch}
      data-has-color={rgb ? 'true' : 'false'}
      data-icon="mdi:outdoor-lamp"
      data-icon-color="#ffffff"
      disabled={!rgb}
      onClick={() => rgb && onApply(rgb)}
      style={style}
      type="button"
    >
      <span aria-hidden="true" className={styles.otherIcon}>
        <MaterialIcon name="mdi:outdoor-lamp" size={28} />
      </span>
    </button>
  )
}

export function LightMoreInfoSheet({ entityId, title, open, onClose, lights = [] }: LightMoreInfoSheetProps) {
  const callService = useHass((state) => state.helpers.callService)
  const entity = useEntity(asEntityName(entityId ?? 'light.unavailable'), { returnNullIfNotFound: true })
  const supportsColor = Array.isArray(entity?.attributes?.supported_color_modes)
    && (entity.attributes.supported_color_modes as string[]).some((mode) => COLOR_MODES.includes(mode))

  const liveRgb = readLightRgb(entity?.attributes?.rgb_color)
  const liveHs = readLightHs(entity?.attributes?.hs_color)
  const liveXyKey = entity?.state === 'on' && liveHs ? xyKey(hsToXY(liveHs)) : ''
  const [optimisticXyKey, commitXyKey] = useOptimisticState(liveXyKey)
  const optimisticXy = parseXyKey(optimisticXyKey)
  const optimisticHs = optimisticXy
    ? [((Math.atan2(optimisticXy.y, optimisticXy.x) * 180 / Math.PI) + 360) % 360, Math.min(100, Math.hypot(optimisticXy.x, optimisticXy.y) * 100)] as LightHs
    : liveHs
  const applyColor = (rgb: LightRgb, target: string) => {
    callService({ domain: 'light', service: 'turn_on', target, serviceData: { rgb_color: rgb } })
  }

  const handleReset = () => {
    if (!entityId) return
    // Mirrors the page-level reset: warm white (2000K) at full brightness.
    callService({ domain: 'light', service: 'turn_on', target: entityId, serviceData: { color_temp_kelvin: 2000, brightness: 255, transition: 1 } })
  }

  const handleApplyAll = () => {
    if (!liveRgb) return
    applyColor(liveRgb, FRONT_YARD_GROUP)
  }

  const otherLights = lights.filter((light) => light.entityId !== entityId)
  const hasOtherColorLights = supportsColor && otherLights.length > 0

  return (
    <ModalSheet centeredGeometry={LIGHT_COLOR_PICKER_CENTERED_GEOMETRY} onClose={onClose} open={open} size="standard" title={title}>
      <div className={styles.body} data-has-other-lights={hasOtherColorLights ? 'true' : 'false'}>
        {entityId && (
          <section aria-label={`${title} light slider`} className={styles.sliderPane} data-layout="light-slider">
            <LightBrightnessCard entityId={entityId} showStatus tapAction="toggle" title={title} />
          </section>
        )}
        {entityId && supportsColor && (
          <section aria-label={`${title} color controls`} className={styles.controlsPane}>
            <LightColorPicker
              ariaLabel={title}
              channelLabel={(channel) => `${title} ${channel} channel`}
              entityId={entityId}
              hs={optimisticHs}
              onHsChange={(_rgb, hs) => {
                commitXyKey(xyKey(hsToXY(hs)))
                callService({ domain: 'light', service: 'turn_on', target: entityId, serviceData: { hs_color: hs } })
              }}
              onRgbChange={(rgb) => applyColor(rgb, entityId)}
              rgb={liveRgb ?? [255, 255, 255]}
              valueText={liveRgb ? `RGB ${liveRgb.join(', ')}` : title}
            />

            <div className={styles.actionRow}>
              <GlassTile
                backgroundColor="rgb(255 197 143)"
                icon="mdi:restore"
                iconColor="#ffffff"
                onClick={handleReset}
                title="Reset"
                tone="light"
              />
              <GlassTile
                backgroundColor={liveRgb ? lightRgbCss(liveRgb) : undefined}
                icon="mdi:lightbulb-group"
                iconColor="#ffffff"
                onClick={handleApplyAll}
                title="Apply to All Lights"
                tone="light"
              />
            </div>
          </section>
        )}
        {entityId && hasOtherColorLights && (
          <section aria-label="Other Lights" className={styles.otherPane}>
            <div className={styles.separator}>Other Lights</div>
            <div className={styles.otherGrid} data-layout="color-swatch-grid">
              {otherLights.map((light) => (
                <OtherLightButton key={light.entityId} light={light} onApply={(rgb) => applyColor(rgb, entityId)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </ModalSheet>
  )
}
