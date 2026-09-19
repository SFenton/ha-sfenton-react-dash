import { useEffect, useState } from "react"
import { useEntity, useHass } from "@hakit/core"
import { Card, type CardColor } from "../core/Card"
import { Description } from "../core/Description"
import { MaterialIcon } from "../core/Icon"
import { SectionHeader } from "../core/SectionHeader"
import { useOptimisticState } from "../../hooks/useOptimisticState"
import { asEntityName } from "./entityState"
import { isSleepypodAlarmActive, sleepypodAlarmState, sleepypodSnoozeRemainingText, type SleepypodAlarmState } from "./sleepypodAlarmState"
import styles from "./SleepypodActiveAlarmSection.module.css"

interface SleepypodActiveAlarmSectionProps {
  command?: (action: "snooze_alarm" | "stop_alarm") => void
  readOnly?: boolean
  side: "left" | "right"
  sideTitle: string
  snoozeButtonEntityId: string
  stateEntityId: string
  stopButtonEntityId: string
}

type CallService = (params: Record<string, unknown>) => void

const SNOOZE_COLOR: CardColor = { r: 10, g: 132, b: 255 }
const SNOOZING_COLOR: CardColor = { r: 122, g: 122, b: 128 }
const STOP_COLOR: CardColor = { r: 229, g: 57, b: 53 }
const SNOOZE_SECONDS = 5 * 60

export function SleepypodActiveAlarmSection({ command, readOnly = false, side, sideTitle, snoozeButtonEntityId, stateEntityId, stopButtonEntityId }: SleepypodActiveAlarmSectionProps) {
  const entity = useEntity(asEntityName(stateEntityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const liveState = sleepypodAlarmState(entity?.state)
  const [displayState, commitDisplayState] = useOptimisticState(liveState)
  const [optimisticSnoozedUntil, setOptimisticSnoozedUntil] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (displayState !== "snoozed") return undefined
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [displayState])

  if (!isSleepypodAlarmActive(displayState)) return null

  const press = (action: "snooze_alarm" | "stop_alarm", target: string, optimisticState: SleepypodAlarmState) => {
    if (readOnly) return
    commitDisplayState(optimisticState)
    if (command) command(action)
    else callService({ domain: "button", service: "press", target })
  }

  const snoozing = displayState === "snoozed"
  const liveRemainingText = liveState === "snoozed"
    ? sleepypodSnoozeRemainingText(entity?.attributes.snoozed_until, nowMs)
    : null
  const snoozeRemainingText = liveRemainingText
    ?? sleepypodSnoozeRemainingText(optimisticSnoozedUntil, nowMs)
    ?? "5:00 Remaining"

  const snooze = () => {
    const now = Date.now()
    setNowMs(now)
    setOptimisticSnoozedUntil((now + SNOOZE_SECONDS * 1000) / 1000)
    press("snooze_alarm", snoozeButtonEntityId, "snoozed")
  }

  const stop = () => {
    setOptimisticSnoozedUntil(null)
    press("stop_alarm", stopButtonEntityId, "idle")
  }

  return (
    <section className={styles.section} data-alarm-state={displayState} data-sleepypod-side={side}>
      <SectionHeader title="Alarm Active" />
      {displayState === "ringing" && (
        <div aria-live="polite" className={styles.status}>
          <Description>Ringing</Description>
        </div>
      )}
      <div aria-label={`${sideTitle} active alarm controls`} className={styles.actions} role="group">
        <Card
          ariaLabel={snoozing ? `Snoozing, ${snoozeRemainingText}` : "Snooze"}
          color={snoozing ? SNOOZING_COLOR : SNOOZE_COLOR}
          disabled={readOnly || snoozing}
          icon={<MaterialIcon name="mdi:sleep" size={30} />}
          onClick={snooze}
          size="compact"
          subtitle={snoozing ? snoozeRemainingText : undefined}
          title={snoozing ? "Snoozing" : "Snooze"}
        />
        <Card
          color={STOP_COLOR}
          disabled={readOnly}
          icon={<MaterialIcon name="mdi:power" size={30} />}
          onClick={stop}
          size="compact"
          title="Stop Alarm"
        />
      </div>
    </section>
  )
}
