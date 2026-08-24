import { useEntity, useHass } from '@hakit/core'
import { useState, type CSSProperties } from 'react'
import { DynamicGrid } from '../components/core/DynamicGrid'
import { MaterialIcon } from '../components/core/Icon'
import { OptionPickerDialog } from '../components/core/OptionPickerDialog'
import type { ModalSheetStyle } from '../components/core/ModalSheet'
import { Section } from '../components/core/Section'
import { asEntityName, isActiveState } from '../components/hass/entityState'
import { LightBrightnessCard, type LightTapAction } from '../components/hass/LightBrightnessCard'
import { LightMoreInfoSheet } from '../components/hass/LightMoreInfoSheet'
import { CUSTOM_LIGHTS_COPY_KEYS, CUSTOM_LIGHTS_COPY_NAMESPACE, useCopy } from '../i18n'
import styles from './CustomLightsPage.module.css'

const MANUAL_CONTROL_ENTITY = 'input_boolean.manually_control_front_yard_lights'
const MODE_SELECT_ENTITY = 'input_select.front_yard_custom_lights'
const LIGHTING_MODE_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}

interface CustomLight {
  entityId: string
  title: string
  tapAction: LightTapAction
}

const CUSTOM_LIGHTS: CustomLight[] = [
  { entityId: 'light.front_door_exterior_left_light', title: 'Left Door Light', tapAction: 'more-info' },
  { entityId: 'light.front_door_exterior_light_v2', title: 'Right Door Light', tapAction: 'more-info' },
  { entityId: 'light.front_door_bollard_1', title: 'Bollard 1', tapAction: 'more-info' },
  { entityId: 'light.front_door_bollard_2', title: 'Bollard 2', tapAction: 'more-info' },
  { entityId: 'light.front_door_bollard_3', title: 'Bollard 3', tapAction: 'more-info' },
  { entityId: 'light.front_door_bollard_4', title: 'Bollard 4', tapAction: 'more-info' },
  { entityId: 'light.front_door_bollard_5', title: 'Bollard 5', tapAction: 'more-info' },
  { entityId: 'light.front_door_bollard_6', title: 'Bollard 6', tapAction: 'more-info' },
]

// Source colors come from the HA automations that drive each mode:
// - Seahawks mode: green rgb(0,255,0) + blue rgb(0,0,255)
// - Valentine's Day mode: red rgb(255,0,0) + pink rgb(255,0,234)
// - Default mode: warm white (color_temp), shown as the default green selected state.
const SEAHAWKS_GRADIENT = 'linear-gradient(90deg, rgb(0 255 0), rgb(0 0 255))'
const VALENTINES_GRADIENT = 'linear-gradient(90deg, rgb(255 0 0), rgb(255 0 234))'

type Rgb = [number, number, number]
type LightingModeStyle = CSSProperties & {
  '--lighting-mode-background'?: string
}

function rgbLuminance([r, g, b]: Rgb) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

// Builds the Custom-mode swatch from the live light colors, sorted darkest to
// brightest with duplicate colors removed.
function buildCustomGradient(colors: Rgb[]): string | undefined {
  if (colors.length === 0) return undefined
  const seen = new Set<string>()
  const unique: Rgb[] = []
  for (const color of colors) {
    const key = color.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(color)
  }
  unique.sort((a, b) => rgbLuminance(a) - rgbLuminance(b))
  const stops = unique.map(([r, g, b]) => `rgb(${r} ${g} ${b})`)
  if (stops.length === 1) return stops[0]
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

// Subscribes to the eight custom lights (fixed list => stable hook order) and
// collects their current rgb_color so the Custom option can preview them.
function useCustomLightGradient(): string | undefined {
  const entities = [
    useEntity(asEntityName(CUSTOM_LIGHTS[0].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[1].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[2].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[3].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[4].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[5].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[6].entityId), { returnNullIfNotFound: true }),
    useEntity(asEntityName(CUSTOM_LIGHTS[7].entityId), { returnNullIfNotFound: true }),
  ]
  const colors: Rgb[] = []
  for (const candidate of entities) {
    const rgb = candidate?.attributes?.rgb_color as unknown
    if (Array.isArray(rgb) && rgb.length === 3 && rgb.every((value) => typeof value === 'number')) {
      colors.push([rgb[0] as number, rgb[1] as number, rgb[2] as number])
    }
  }
  return buildCustomGradient(colors)
}

function ModeToggleCard({ mode, modeBackground, modeTitle, onOpenModePicker }: { mode: string; modeBackground?: string; modeTitle: string; onOpenModePicker: () => void }) {
  const callService = useHass((state) => state.helpers.callService)
  const manualEntity = useEntity(asEntityName(MANUAL_CONTROL_ENTITY), { returnNullIfNotFound: true })
  const active = isActiveState(manualEntity)

  const toggle = () => {
    callService({ domain: 'homeassistant', service: 'toggle', target: MANUAL_CONTROL_ENTITY })
  }

  return (
    <div className={styles.modeCard} data-active={active}>
      <button aria-label="Manually control front yard lights" aria-pressed={active} className={styles.modeToggle} onClick={toggle} type="button">
        <span aria-hidden="true" className={styles.modeIcon}>
          <MaterialIcon name="mdi:lightbulb" size={26} />
        </span>
        <span className={styles.modeCopy}>
          <span className={styles.modeTitle}>Manually Control Front Yard Lights</span>
          <span className={styles.modeSubtitle}>{active ? 'On' : 'Off'}</span>
        </span>
      </button>
      {active && (
        <button
          aria-label="Select lighting mode"
          className={styles.modeSelect}
          onClick={onOpenModePicker}
          style={{ '--lighting-mode-background': modeBackground } as LightingModeStyle}
          type="button"
        >
          <MaterialIcon name="mdi:palette" size={20} />
          <span className={styles.modeSelectCopy}>
            <span className={styles.modeTitle}>{modeTitle}</span>
            <span className={styles.modeSubtitle}>{mode}</span>
          </span>
          <MaterialIcon name="mdi:chevron-down" size={18} />
        </button>
      )}
    </div>
  )
}

export function CustomLightsPage() {
  const copy = useCopy(CUSTOM_LIGHTS_COPY_NAMESPACE)
  const callService = useHass((state) => state.helpers.callService)
  const manualEntity = useEntity(asEntityName(MANUAL_CONTROL_ENTITY), { returnNullIfNotFound: true })
  const modeEntity = useEntity(asEntityName(MODE_SELECT_ENTITY), { returnNullIfNotFound: true })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [moreInfo, setMoreInfo] = useState<{ entityId: string; title: string } | null>(null)

  const manualOn = isActiveState(manualEntity)
  const mode = modeEntity?.state ?? 'Default'
  const modeOptions = (modeEntity?.attributes?.options as string[] | undefined) ?? ['Default', 'Custom', 'Seahawks', "Valentine's Day"]
  const showCustomGrid = manualOn && mode === 'Custom'
  const customGradient = useCustomLightGradient()
  const frontYardTitle = copy(CUSTOM_LIGHTS_COPY_KEYS.frontYard)
  const lightingModeTitle = copy(CUSTOM_LIGHTS_COPY_KEYS.lightingMode)

  const modeBackground = (option: string): string | undefined => {
    if (option === 'Seahawks') return SEAHAWKS_GRADIENT
    if (option === "Valentine's Day") return VALENTINES_GRADIENT
    if (option === 'Custom') return customGradient
    return undefined
  }

  const selectMode = (option: string) => {
    callService({ domain: 'input_select', service: 'select_option', target: MODE_SELECT_ENTITY, serviceData: { option } })
  }

  // Matches the default front-yard warm-white scene at full brightness.
  const resetAllLights = () => {
    callService({ domain: 'light', service: 'turn_on', target: 'light.front_yard_lights', serviceData: { color_temp_kelvin: 2000, brightness: 255, transition: 1 } })
  }

  return (
    <div className={styles.stack}>
      <Section className={styles.section} gap={12} span="full" title={frontYardTitle}>
        <ModeToggleCard mode={mode} modeBackground={modeBackground(mode)} modeTitle={lightingModeTitle} onOpenModePicker={() => setPickerOpen(true)} />
        {showCustomGrid && (
          <DynamicGrid className={styles.lightGrid} columns={2} fillRows={false} gap={12} itemSizing="uniform" layout="bounded" maxCellWidth={280} maxColumns={4}>
            {CUSTOM_LIGHTS.map((light) => (
              <div className={styles.lightCell} key={light.entityId}>
                <LightBrightnessCard
                  entityId={light.entityId}
                  onMoreInfo={(entityId, title) => setMoreInfo({ entityId, title })}
                  showStatus
                  tapAction={light.tapAction}
                  title={light.title}
                />
              </div>
            ))}
          </DynamicGrid>
        )}
        {showCustomGrid && (
          <button className={styles.resetAllButton} onClick={resetAllLights} type="button">
            Reset All Lights
          </button>
        )}
      </Section>

      <OptionPickerDialog
        icon="mdi:palette"
        onClose={() => setPickerOpen(false)}
        onSelect={selectMode}
        open={pickerOpen}
        options={modeOptions.map((option) => ({ label: option, value: option, activeBackground: modeBackground(option) }))}
        presentation="sheet"
        sheetLayout="compact-grid"
        sheetStyle={LIGHTING_MODE_MODAL_STYLE}
        title={lightingModeTitle}
        value={mode}
      />

      <LightMoreInfoSheet
        entityId={moreInfo?.entityId ?? null}
        lights={CUSTOM_LIGHTS.map((light) => ({ entityId: light.entityId, title: light.title }))}
        onClose={() => setMoreInfo(null)}
        open={moreInfo !== null}
        title={moreInfo?.title ?? ''}
      />
    </div>
  )
}
