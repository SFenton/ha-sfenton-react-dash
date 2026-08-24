import { useMemo, useState } from 'react'
import { OptionPickerDialog } from '../components/core/OptionPickerDialog'
import { BedTemperatureScopePrompt } from '../components/hass/BedTemperatureScopePrompt'
import { LightMoreInfoSheet } from '../components/hass/LightMoreInfoSheet'
import type { SleepypodSchedulePhase } from '../components/hass/bedTemperatureScope'

export function ModalAcceptanceHarness() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [open, setOpen] = useState(true)
  const harness = params.get('__modalAcceptance')
  const [title = '', firstValue = '', secondValue = '', ...remainingValues] = params.getAll('__modalValue')
  const options = [firstValue, secondValue, ...remainingValues].filter(Boolean).map((label, index) => ({
    label,
    value: String(index),
  }))

  if (harness === 'bed-temperature-scope') {
    return (
      <main data-modal-acceptance-harness={harness}>
        <BedTemperatureScopePrompt
          onChoose={() => undefined}
          onClose={() => setOpen(false)}
          open={open}
          phase={secondValue as SleepypodSchedulePhase}
          sideTitle={title}
          targetText={firstValue}
        />
      </main>
    )
  }

  if (harness === 'light-more-info') {
    return (
      <main data-modal-acceptance-harness={harness}>
        <LightMoreInfoSheet
          entityId={firstValue}
          onClose={() => setOpen(false)}
          open={open}
          title={title}
        />
      </main>
    )
  }

  return (
    <main data-modal-acceptance-harness={harness}>
      <OptionPickerDialog
        onClose={() => setOpen(false)}
        onSelect={() => undefined}
        open={open}
        options={options}
        presentation="sheet"
        title={title}
        value="0"
      />
    </main>
  )
}
