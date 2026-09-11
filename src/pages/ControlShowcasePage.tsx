import { useState, type CSSProperties } from 'react'
import { Description } from '../components/core/Description'
import { ResponsiveSectionGrid } from '../components/core/ResponsiveSectionGrid'
import { Section } from '../components/core/Section'
import {
  lightRgbCss,
  type LightRgb,
} from '../components/hass/lightColor'
import { LightColorPicker, LightTemperaturePicker } from '../components/hass/LightColorPicker'
import { CONTROL_SHOWCASE_COPY_KEYS, CONTROL_SHOWCASE_COPY_NAMESPACE, useCopy } from '../i18n'
import styles from './ControlShowcasePage.module.css'

type PreviewStyle = CSSProperties & {
  '--showcase-preview-color': string
}

const INITIAL_RGB: LightRgb = [255, 138, 61]
const INITIAL_KELVIN = 3000
const MIN_KELVIN = 2000
const MAX_KELVIN = 6500

export function ControlShowcasePage() {
  const copy = useCopy(CONTROL_SHOWCASE_COPY_NAMESPACE)
  const [rgb, setRgb] = useState<LightRgb>(INITIAL_RGB)
  const [kelvin, setKelvin] = useState(INITIAL_KELVIN)
  const rgbValue = copy(CONTROL_SHOWCASE_COPY_KEYS.rgbValue, {
    red: rgb[0].toString(),
    green: rgb[1].toString(),
    blue: rgb[2].toString(),
  })

  return (
    <div className={styles.page} data-control-showcase="true">
      <Description>{copy(CONTROL_SHOWCASE_COPY_KEYS.description)}</Description>
      <ResponsiveSectionGrid className={styles.grid}>
        <Section
          description={copy(CONTROL_SHOWCASE_COPY_KEYS.rgbDescription)}
          title={copy(CONTROL_SHOWCASE_COPY_KEYS.rgbTitle)}
        >
          <div className={styles.controlSurface}>
            <LightColorPicker
              ariaLabel={copy(CONTROL_SHOWCASE_COPY_KEYS.rgbControl)}
              channelLabel={(channel) => copy(CONTROL_SHOWCASE_COPY_KEYS.rgbChannel, { channel })}
              onHsChange={setRgb}
              onRgbChange={setRgb}
              rgb={rgb}
              valueText={rgbValue}
            />
            <div aria-live="polite" className={styles.preview}>
              <span aria-hidden="true" className={styles.swatch} style={{ '--showcase-preview-color': lightRgbCss(rgb) } as PreviewStyle} />
              <span>{rgbValue}</span>
            </div>
          </div>
        </Section>
        <Section
          description={copy(CONTROL_SHOWCASE_COPY_KEYS.temperatureDescription)}
          title={copy(CONTROL_SHOWCASE_COPY_KEYS.temperatureTitle)}
        >
          <div className={styles.controlSurface}>
            <LightTemperaturePicker
              kelvin={kelvin}
              label={copy(CONTROL_SHOWCASE_COPY_KEYS.temperatureControl)}
              max={MAX_KELVIN}
              min={MIN_KELVIN}
              onChange={setKelvin}
              step={50}
              valueText={copy(CONTROL_SHOWCASE_COPY_KEYS.kelvinValue, { kelvin: kelvin.toString() })}
            />
          </div>
        </Section>
      </ResponsiveSectionGrid>
    </div>
  )
}
