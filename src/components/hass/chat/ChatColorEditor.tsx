import { CHAT_COPY_KEYS as chatKeys, CHAT_COPY_NAMESPACE, useCopy } from '../../../i18n'
import { LightColorPicker, LightTemperaturePicker } from '../LightColorPicker'
import { type ChatColorDraft } from './chatColorDraft'
import type { ChatResponseControl } from './chatRecords'
import styles from './ChatColorEditor.module.css'

type ColorControl = Extract<ChatResponseControl, { kind: 'color-picker' }>

export function ChatColorEditor({ control, draft, onChange }: { control: ColorControl; draft: ChatColorDraft; onChange: (draft: ChatColorDraft) => void }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  if (control.colorMode === 'temperature') {
    const kelvin = draft.kind === 'temperature' ? draft.kelvin : control.currentTemperatureKelvin ?? 3000
    return <div className={styles.editor}>
      <LightTemperaturePicker
        kelvin={kelvin}
        label={copy(chatKeys.colorTemperature)}
        max={control.maxTemperatureKelvin}
        min={control.minTemperatureKelvin}
        onChange={(value) => onChange({ kind: 'temperature', kelvin: value })}
        step={50}
        valueText={copy(chatKeys.kelvinValue, { kelvin: kelvin.toString() })}
      />
    </div>
  }
  const rgb = draft.kind === 'rgb' ? draft.rgb : control.currentRgb ?? [255, 138, 61]
  return <div className={styles.editor}>
    <LightColorPicker
      ariaLabel={copy(chatKeys.customColor)}
      channelLabel={(channel) => copy(chatKeys.rgbChannel, { channel })}
      entityId={control.entityIds[0]}
      onHsChange={(value) => onChange({ kind: 'rgb', rgb: value })}
      onRgbChange={(value) => onChange({ kind: 'rgb', rgb: value })}
      rgb={rgb}
      valueText={copy(chatKeys.rgbValue, { red: rgb[0].toString(), green: rgb[1].toString(), blue: rgb[2].toString() })}
    />
  </div>
}
