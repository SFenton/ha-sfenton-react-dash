import type { ChatResponseControl } from './chatRecords'

type ColorControl = Extract<ChatResponseControl, { kind: 'color-picker' }>

export type ChatColorDraft =
  | { kind: 'named'; name: string }
  | { kind: 'rgb'; rgb: [number, number, number] }
  | { kind: 'temperature'; kelvin: number }

export function initialChatColorDraft(control: ColorControl): ChatColorDraft {
  if (control.colorMode === 'rgb' && control.currentRgb) return { kind: 'rgb', rgb: control.currentRgb }
  if (control.currentTemperatureKelvin) return { kind: 'temperature', kelvin: control.currentTemperatureKelvin }
  return { kind: 'named', name: control.palette[0] ?? 'warm white' }
}
