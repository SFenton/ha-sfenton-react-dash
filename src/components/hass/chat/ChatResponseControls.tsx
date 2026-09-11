import { useMemo, useState, type CSSProperties } from 'react'
import { CHAT_COPY_KEYS as chatKeys, CHAT_COPY_NAMESPACE, useCopy } from '../../../i18n'
import { RangeField } from '../../core/RangeField'
import type { ControlSemantics } from '../../core/controlSemantics'
import type { ChatClient } from './chatClient'
import { initialChatColorDraft, type ChatColorDraft } from './chatColorDraft'
import type { ChatResponseControl } from './chatRecords'
import styles from './Chat.module.css'

const COMMAND_SEMANTICS = { kind: 'command' } satisfies ControlSemantics
const isNamedDraft = (draft: ChatColorDraft): draft is Extract<ChatColorDraft, { kind: 'named' }> => /^named$/.test(draft.kind)
const isTemperatureDraft = (draft: ChatColorDraft): draft is Extract<ChatColorDraft, { kind: 'temperature' }> => /^temperature$/.test(draft.kind)
const isRgbDraft = (draft: ChatColorDraft): draft is Extract<ChatColorDraft, { kind: 'rgb' }> => /^rgb$/.test(draft.kind)

function RoomPicker({ client, control, ownerResultId, used }: { client: ChatClient; control: Extract<ChatResponseControl, { kind: 'room-picker' }>; ownerResultId: string; used: boolean }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const [selected, setSelected] = useState(control.options[0]?.value ?? '')
  const selectedOption = control.options.find((option) => option.value === selected)
  return <section aria-label={copy(chatKeys.rooms)} className={styles.responseControl}>
    <div className={styles.roomCarousel} role="listbox" aria-label={copy(chatKeys.rooms)}>
      {control.options.map((option) => {
        const semantics = { kind: 'selection', selected: selected === option.value } satisfies ControlSemantics
        return <button
        aria-selected={semantics.selected}
        className={styles.roomChoice}
        data-action-kind={semantics.kind}
        key={option.value}
        onClick={() => setSelected(option.value)}
        role="option"
        type="button"
      >{option.label}</button>
      })}
    </div>
    <button className={styles.controlSend} data-action-kind={COMMAND_SEMANTICS.kind} disabled={used || !selectedOption} onClick={() => selectedOption && void client.sendControl(control.id, selectedOption.message, ownerResultId)} type="button">
      {copy(used ? chatKeys.controlAlreadySent : chatKeys.sendSelection)}
    </button>
  </section>
}

function ColorControl({ client, control, draft, onDraftChange, onOpenCustom, ownerResultId, used }: {
  client: ChatClient
  control: Extract<ChatResponseControl, { kind: 'color-picker' }>
  draft?: ChatColorDraft
  onDraftChange?: (controlId: string, draft: ChatColorDraft) => void
  onOpenCustom?: (control: Extract<ChatResponseControl, { kind: 'color-picker' }>, draft: ChatColorDraft) => void
  ownerResultId: string
  used: boolean
}) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const [localDraft, setLocalDraft] = useState<ChatColorDraft>(() => initialChatColorDraft(control))
  const selected = draft ?? localDraft
  const setSelected = (next: ChatColorDraft) => {
    setLocalDraft(next)
    onDraftChange?.(control.id, next)
  }
  const message = useMemo(() => {
    const target = control.subject
    if (isNamedDraft(selected)) return target
      ? copy(chatKeys.turnTargetToColor, { target, colorName: selected.name })
      : copy(chatKeys.turnLightsToColor, { room: control.room, colorName: selected.name })
    if (isTemperatureDraft(selected)) return target
      ? copy(chatKeys.turnTargetToKelvin, { target, kelvin: selected.kelvin.toString() })
      : copy(chatKeys.turnLightsToKelvin, { room: control.room, kelvin: selected.kelvin.toString() })
    const [red, green, blue] = selected.rgb
    return target
      ? copy(chatKeys.turnTargetToRgb, { target, red: red.toString(), green: green.toString(), blue: blue.toString() })
      : copy(chatKeys.turnLightsToRgb, { room: control.room, red: red.toString(), green: green.toString(), blue: blue.toString() })
  }, [control.room, control.subject, copy, selected])
  const customStyle = isRgbDraft(selected)
    ? { '--chat-custom-color': `rgb(${selected.rgb.join(' ')})` } as CSSProperties
    : isTemperatureDraft(selected)
      ? { '--chat-custom-color': `linear-gradient(90deg, rgb(255 147 41), rgb(143 181 255))`, '--chat-custom-position': `${((selected.kelvin - control.minTemperatureKelvin) / (control.maxTemperatureKelvin - control.minTemperatureKelvin)) * 100}%` } as CSSProperties
      : undefined
  return <section aria-label={copy(chatKeys.color)} className={styles.responseControl}>
    <div className={styles.colorChoices}>
      {control.palette.map((color) => {
        const semantics = { kind: 'selection', selected: isNamedDraft(selected) && selected.name === color } satisfies ControlSemantics
        return <button aria-label={color} aria-pressed={semantics.selected} className={styles.colorChoice} data-action-kind={semantics.kind} key={color} onClick={() => setSelected({ kind: 'named', name: color })} type="button">{color}</button>
      })}
      <button
        aria-label={copy(chatKeys.customColor)}
        aria-pressed={!isNamedDraft(selected)}
        className={`${styles.colorChoice} ${styles.customColorChoice}`}
        data-action-kind="modal"
        data-modal-detail-trigger={`chat-color-${control.id}`}
        onClick={() => onOpenCustom?.(control, isNamedDraft(selected) ? initialChatColorDraft(control) : selected)}
        style={customStyle}
        type="button"
      >{copy(chatKeys.customColor)}</button>
    </div>
    <button className={styles.controlSend} data-action-kind={COMMAND_SEMANTICS.kind} disabled={used} onClick={() => void client.sendControl(control.id, message, ownerResultId)} type="button">
      {copy(used ? chatKeys.controlAlreadySent : chatKeys.sendColor)}
    </button>
  </section>
}

function BrightnessControl({ client, control, ownerResultId, used }: { client: ChatClient; control: Extract<ChatResponseControl, { kind: 'brightness-slider' }>; ownerResultId: string; used: boolean }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const [value, setValue] = useState(control.value)
  return <section aria-label={copy(chatKeys.brightness)} className={styles.responseControl}>
    <RangeField disabled={false} label={copy(chatKeys.brightness)} max={control.max} min={control.min} onChange={setValue} step={control.step} value={value} />
    <button className={styles.controlSend} data-action-kind={COMMAND_SEMANTICS.kind} disabled={used} onClick={() => void client.sendControl(control.id, control.subject
      ? copy(chatKeys.turnTargetToBrightness, { target: control.subject, value: value.toString() })
      : copy(chatKeys.turnLightsToBrightness, { room: control.room, value: value.toString() }), ownerResultId)} type="button">
      {copy(used ? chatKeys.controlAlreadySent : chatKeys.sendBrightness)}
    </button>
  </section>
}

function Suggestions({ client, control, ownerResultId, used }: { client: ChatClient; control: Extract<ChatResponseControl, { kind: 'suggestions' }>; ownerResultId: string; used: boolean }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  return <section aria-label={copy(chatKeys.suggestedResponses)} className={styles.responseControl}>
    <strong className={styles.controlTitle}>{copy(chatKeys.suggestedResponses)}</strong>
    <div className={styles.suggestions}>
      {control.options.map((option) => <button className={styles.suggestion} data-action-kind={COMMAND_SEMANTICS.kind} disabled={used} key={option.message} onClick={() => void client.sendControl(control.id, option.message, ownerResultId)} type="button">{option.label}</button>)}
    </div>
  </section>
}

export function ChatResponseControls({ client, colorDrafts, controls = [], onColorDraftChange, onOpenCustomColor, ownerResultId }: {
  client: ChatClient
  colorDrafts?: ReadonlyMap<string, ChatColorDraft>
  controls?: ChatResponseControl[]
  onColorDraftChange?: (controlId: string, draft: ChatColorDraft) => void
  onOpenCustomColor?: (control: Extract<ChatResponseControl, { kind: 'color-picker' }>, draft: ChatColorDraft) => void
  ownerResultId: string
}) {
  if (!controls.length) return null
  return <div className={styles.responseControls}>
    {controls.map((control) => {
      const used = client.controlUsed(control.id, ownerResultId)
      if (control.kind === 'room-picker') return <RoomPicker client={client} control={control} key={control.id} ownerResultId={ownerResultId} used={used} />
      if (control.kind === 'color-picker') return <ColorControl client={client} control={control} draft={colorDrafts?.get(control.id)} key={control.id} onDraftChange={onColorDraftChange} onOpenCustom={onOpenCustomColor} ownerResultId={ownerResultId} used={used} />
      if (control.kind === 'brightness-slider') return <BrightnessControl client={client} control={control} key={control.id} ownerResultId={ownerResultId} used={used} />
      return <Suggestions client={client} control={control} key={control.id} ownerResultId={ownerResultId} used={used} />
    })}
  </div>
}
