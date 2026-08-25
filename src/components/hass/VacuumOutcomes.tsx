import { useId, useMemo, useState } from 'react'
import { MaterialIcon } from '../core/Icon'
import { SurfaceAccessory } from '../core/SurfaceAccessory'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { VACUUM_COPY_KEYS, VACUUM_COPY_NAMESPACE, formatDate, type CopyKey, type CopyValues, useCopy } from '../../i18n'
import {
  vacuumOutcomeEventsForRoom,
  type VacuumOutcomeAttemptMode,
  type VacuumOutcomeAttemptResult,
  type VacuumOutcomeContract,
  type VacuumOutcomeEvent,
  type VacuumOutcomeOperation,
  type VacuumOutcomeRoom,
  type VacuumOutcomeStatus,
} from './vacuumOutcomes'
import { countVacuumOutcomes, vacuumOutcomeDayValue, vacuumOutcomeReasonValue } from './vacuumOutcomePresentation'
import styles from './VacuumOutcomes.module.css'

type VacuumCopy = (key: CopyKey<'modalVacuum'>, values?: CopyValues) => string
type OutcomeGroupKey = 'needsAttention' | 'interrupted' | 'stillDue' | 'done'
type OutcomeTone = 'danger' | 'interrupted' | 'success' | 'warning'

interface OutcomeVisual {
  icon: string
  tone: OutcomeTone
}

interface OutcomeGroup {
  key: OutcomeGroupKey
  rooms: VacuumOutcomeRoom[]
}

const GROUP_ORDER: OutcomeGroupKey[] = ['needsAttention', 'interrupted', 'stillDue', 'done']
const OUTCOME_COPY_KEYS = VACUUM_COPY_KEYS.outcomes

const STATUS_VISUAL: Record<VacuumOutcomeStatus, OutcomeVisual> = {
  failed: { icon: 'mdi:alert-circle', tone: 'danger' },
  interrupted: { icon: 'mdi:pause-circle', tone: 'interrupted' },
  partial: { icon: 'mdi:progress-check', tone: 'warning' },
  deferred: { icon: 'mdi:clock-outline', tone: 'warning' },
  completed: { icon: 'mdi:check-circle', tone: 'success' },
}

const STATUS_COPY_KEYS: Record<VacuumOutcomeStatus, CopyKey<'modalVacuum'>> = {
  completed: OUTCOME_COPY_KEYS.statuses.completed,
  deferred: OUTCOME_COPY_KEYS.statuses.deferred,
  failed: OUTCOME_COPY_KEYS.statuses.failed,
  interrupted: OUTCOME_COPY_KEYS.statuses.interrupted,
  partial: OUTCOME_COPY_KEYS.statuses.partial,
}

const GROUP_COPY_KEYS: Record<OutcomeGroupKey, CopyKey<'modalVacuum'>> = {
  done: OUTCOME_COPY_KEYS.groups.done,
  interrupted: OUTCOME_COPY_KEYS.groups.interrupted,
  needsAttention: OUTCOME_COPY_KEYS.groups.needsAttention,
  stillDue: OUTCOME_COPY_KEYS.groups.stillDue,
}

const GROUP_VISUAL: Record<OutcomeGroupKey, OutcomeVisual> = {
  done: STATUS_VISUAL.completed,
  interrupted: STATUS_VISUAL.interrupted,
  needsAttention: STATUS_VISUAL.failed,
  stillDue: STATUS_VISUAL.deferred,
}

const PRIMARY_COPY_KEYS: Record<VacuumOutcomeAttemptResult, Record<VacuumOutcomeAttemptMode, CopyKey<'modalVacuum'>>> = {
  completed: {
    fallback_vacuum: OUTCOME_COPY_KEYS.primary.completed.fallbackVacuum,
    vacuum: OUTCOME_COPY_KEYS.primary.completed.vacuum,
    vacuum_mop: OUTCOME_COPY_KEYS.primary.completed.vacuumMop,
  },
  failed: {
    fallback_vacuum: OUTCOME_COPY_KEYS.primary.failed.fallbackVacuum,
    vacuum: OUTCOME_COPY_KEYS.primary.failed.vacuum,
    vacuum_mop: OUTCOME_COPY_KEYS.primary.failed.vacuumMop,
  },
  interrupted: {
    fallback_vacuum: OUTCOME_COPY_KEYS.primary.interrupted.fallbackVacuum,
    vacuum: OUTCOME_COPY_KEYS.primary.interrupted.vacuum,
    vacuum_mop: OUTCOME_COPY_KEYS.primary.interrupted.vacuumMop,
  },
}

const DEFERRED_COPY_KEYS: Record<VacuumOutcomeOperation, CopyKey<'modalVacuum'>> = {
  mop: OUTCOME_COPY_KEYS.primary.deferred.mop,
  vacuum: OUTCOME_COPY_KEYS.primary.deferred.vacuum,
  vacuum_mop: OUTCOME_COPY_KEYS.primary.deferred.vacuumMop,
}

const OUTSTANDING_COPY_KEYS: Record<VacuumOutcomeOperation, CopyKey<'modalVacuum'>> = {
  mop: OUTCOME_COPY_KEYS.outstanding.mop,
  vacuum: OUTCOME_COPY_KEYS.outstanding.vacuum,
  vacuum_mop: OUTCOME_COPY_KEYS.outstanding.vacuumMop,
}

function outcomeGroupKey(status: VacuumOutcomeStatus): OutcomeGroupKey {
  if (status === 'failed') return 'needsAttention'
  if (status === 'interrupted') return 'interrupted'
  if (status === 'completed') return 'done'
  return 'stillDue'
}

function groupedRooms(contract: VacuumOutcomeContract): OutcomeGroup[] {
  return GROUP_ORDER.map((key) => ({
    key,
    rooms: contract.rooms.filter((room) => outcomeGroupKey(room.status) === key),
  })).filter((group) => group.rooms.length > 0)
}

function primaryAttemptSentence(copy: VacuumCopy, mode: VacuumOutcomeAttemptMode, result: VacuumOutcomeAttemptResult) {
  return copy(PRIMARY_COPY_KEYS[result][mode])
}

function deferredSentence(copy: VacuumCopy, operation: VacuumOutcomeOperation) {
  return copy(DEFERRED_COPY_KEYS[operation])
}

function outstandingSentence(copy: VacuumCopy, operation: VacuumOutcomeOperation) {
  return copy(OUTSTANDING_COPY_KEYS[operation])
}

function OutcomeReasonLine({
  label,
  value,
}: {
  label?: string
  value: string
}) {
  return (
    <div className={styles.reasonLine}>
      {label && <span>{label}</span>}
      <p>{value}</p>
    </div>
  )
}

function ExpandGlyph({ expanded }: { expanded: boolean }) {
  return <MaterialIcon name={expanded ? 'mdi:minus' : 'mdi:plus'} size={20} />
}

function vacuumOutcomeEventSentence(copy: VacuumCopy, event: VacuumOutcomeEvent) {
  return event.type === 'attempt'
    ? primaryAttemptSentence(copy, event.attempt_mode, event.attempt_result)
    : deferredSentence(copy, event.outstanding_operation)
}

function rawDiagnostics(events: VacuumOutcomeEvent[]) {
  return [...new Set(events.map((event) => event.reason?.raw).filter((value): value is string => Boolean(value)))]
}

function hasUsefulHistory(events: VacuumOutcomeEvent[]) {
  return events.length > 1 || events.some((event) => event.type === 'deferral' || event.reason !== null)
}

function vacuumOutcomeEventTime(value: string) {
  return formatDate(new Date(value), { hour: 'numeric', minute: '2-digit' })
}

function VacuumOutcomeHistory({
  events,
  room,
  roomNames,
}: {
  events: VacuumOutcomeEvent[]
  room: VacuumOutcomeRoom
  roomNames: Record<string, string>
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const diagnostics = useMemo(() => rawDiagnostics(events), [events])
  const hasUnknownReason = events.some((event) => event.reason?.code === 'unknown')
  // Events come from the contract captured when detail opened, so this initial disclosure state stays stable.
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(hasUnknownReason)
  const diagnosticsId = useId()
  const diagnosticsLabel = diagnosticsOpen
    ? copy(OUTCOME_COPY_KEYS.history.hideDiagnostics, { room: room.room_name })
    : copy(OUTCOME_COPY_KEYS.history.showDiagnostics, { room: room.room_name })

  return (
    <div className={styles.historyPanel}>
      <h5>{copy(OUTCOME_COPY_KEYS.history.title)}</h5>
      <ol className={styles.timeline}>
        {events.map((event) => (
          <li key={event.id}>
            <time dateTime={event.occurred_at}>
              {vacuumOutcomeEventTime(event.occurred_at)}
            </time>
            <div>
              <p>{vacuumOutcomeEventSentence(copy, event)}</p>
              {event.reason && <OutcomeReasonLine value={vacuumOutcomeReasonValue(copy, event.reason, roomNames)} />}
            </div>
          </li>
        ))}
      </ol>
      {diagnostics.length > 0 && (
        <div className={styles.diagnostics}>
          <button
            aria-controls={diagnosticsId}
            aria-expanded={diagnosticsOpen}
            aria-label={diagnosticsLabel}
            className={styles.diagnosticsButton}
            data-action-kind="command"
            onClick={() => setDiagnosticsOpen((current) => !current)}
            type="button"
          >
            <span>{copy(OUTCOME_COPY_KEYS.history.diagnosticsTitle)}</span>
            <ExpandGlyph expanded={diagnosticsOpen} />
          </button>
          <ul hidden={!diagnosticsOpen} id={diagnosticsId}>
            {diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export function VacuumOutcomeRow({
  contract,
  room,
  roomNames,
}: {
  contract: VacuumOutcomeContract
  room: VacuumOutcomeRoom
  roomNames: Record<string, string>
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const events = vacuumOutcomeEventsForRoom(contract, room)
  const usefulHistory = hasUsefulHistory(events)
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyId = useId()
  const attemptsId = useId()
  const roomNameId = useId()
  const statusId = useId()
  const visual = STATUS_VISUAL[room.status]
  const resultReason = room.latest_attempt?.reason ?? null
  const outstandingReason = room.outstanding?.reason ?? null
  const resultReasonValue = resultReason ? vacuumOutcomeReasonValue(copy, resultReason, roomNames) : null
  const outstandingReasonValue = outstandingReason ? vacuumOutcomeReasonValue(copy, outstandingReason, roomNames) : null
  const bothReasons = Boolean(resultReasonValue && outstandingReasonValue)
  const reasonsDiffer = bothReasons && resultReasonValue !== outstandingReasonValue
  const primary = room.latest_attempt
    ? primaryAttemptSentence(copy, room.latest_attempt.mode, room.latest_attempt.result)
    : deferredSentence(copy, room.required_operation)
  const showPartialCredit = room.credit.status === 'partial' && room.status !== 'partial'
  const historyLabel = historyOpen
    ? copy(OUTCOME_COPY_KEYS.history.hide, { room: room.room_name })
    : copy(OUTCOME_COPY_KEYS.history.show, { room: room.room_name })

  return (
    <article
      aria-labelledby={[roomNameId, statusId].join(' ')}
      className={styles.roomRow}
      data-action-kind="state"
      data-room-id={room.room_id}
      data-status={room.status}
      data-tone={visual.tone}
    >
      <span aria-hidden="true" className={styles.roomIcon}>
        <MaterialIcon name={visual.icon} size={22} />
      </span>
      <div className={styles.roomCopy}>
        <div className={styles.roomHeading}>
          <h4 id={roomNameId}>{room.room_name}</h4>
          <span className={styles.statusLabel} id={statusId}>{copy(STATUS_COPY_KEYS[room.status])}</span>
        </div>
        <p className={styles.primaryLine}>{primary}</p>
        {showPartialCredit && (
          <p className={styles.creditLine}>{copy(OUTCOME_COPY_KEYS.primary.partialCredit)}</p>
        )}
        {resultReasonValue && (
          <OutcomeReasonLine
            label={reasonsDiffer ? copy(OUTCOME_COPY_KEYS.reasonLabels.attempt) : undefined}
            value={resultReasonValue}
          />
        )}
        {room.outstanding && <p className={styles.outstandingLine}>{outstandingSentence(copy, room.outstanding.operation)}</p>}
        {outstandingReasonValue && (!resultReasonValue || reasonsDiffer) && (
          <OutcomeReasonLine
            label={reasonsDiffer ? copy(OUTCOME_COPY_KEYS.reasonLabels.outstanding) : undefined}
            value={outstandingReasonValue}
          />
        )}
      </div>
      {usefulHistory && (
        <button
          aria-controls={historyId}
          aria-describedby={room.occurrence_count > 1 ? attemptsId : undefined}
          aria-expanded={historyOpen}
          aria-label={historyLabel}
          className={styles.historyButton}
          data-action-kind="command"
          data-has-attempt-count={room.occurrence_count > 1 ? 'true' : undefined}
          onClick={() => setHistoryOpen((current) => !current)}
          type="button"
        >
          {room.occurrence_count > 1 && (
            <>
              <span aria-hidden="true" className={styles.attemptBadge}>{room.occurrence_count}</span>
              <span className={styles.visuallyHidden} id={attemptsId}>
                {copy(OUTCOME_COPY_KEYS.attempts, { count: room.occurrence_count })}
              </span>
            </>
          )}
          <ExpandGlyph expanded={historyOpen} />
        </button>
      )}
      {usefulHistory && (
        <div className={styles.history} hidden={!historyOpen} id={historyId}>
          <VacuumOutcomeHistory events={events} room={room} roomNames={roomNames} />
        </div>
      )}
    </article>
  )
}

function VacuumOutcomeGroup({
  autofocus,
  contract,
  defaultExpanded,
  group,
  roomNames,
}: {
  autofocus: boolean
  contract: VacuumOutcomeContract
  defaultExpanded: boolean
  group: OutcomeGroup
  roomNames: Record<string, string>
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()
  const label = copy(GROUP_COPY_KEYS[group.key])

  return (
    <section className={styles.group} data-group={group.key}>
      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className={styles.groupButton}
        data-action-kind="command"
        data-modal-detail-autofocus={autofocus ? 'true' : undefined}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span>{label}</span>
        <strong>{group.rooms.length}</strong>
        <ExpandGlyph expanded={expanded} />
      </button>
      <div className={styles.groupRows} hidden={!expanded} id={contentId}>
        {group.rooms.map((room) => (
          <VacuumOutcomeRow contract={contract} key={room.room_id} room={room} roomNames={roomNames} />
        ))}
      </div>
    </section>
  )
}

function reasonRoomNames(contract: VacuumOutcomeContract, vacuum: VacuumConfig) {
  const names: Record<string, string> = {}
  for (const event of contract.events) {
    if (event.room_name) names[event.room_id] = event.room_name
  }
  for (const room of contract.rooms) names[room.room_id] = room.room_name
  return { ...names, ...vacuum.outcomeRoomNames }
}

function groupStartsExpanded(group: OutcomeGroup, hasIncompleteGroup: boolean) {
  return group.key !== 'done' || !hasIncompleteGroup
}

export function VacuumOutcomeOverview({
  contract,
  onOpen,
  vacuum,
}: {
  contract: VacuumOutcomeContract
  onOpen: () => void
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const summary = countVacuumOutcomes(contract)
  const formattedDay = vacuumOutcomeDayValue(contract.day)
  const allComplete = summary.completed === contract.rooms.length && summary.due === 0
  const visual = summary.attention > 0
    ? STATUS_VISUAL.failed
    : summary.interrupted > 0
      ? STATUS_VISUAL.interrupted
      : summary.due > 0
        ? STATUS_VISUAL.deferred
        : STATUS_VISUAL.completed

  return (
    <section className={styles.overviewSection}>
      <div className={styles.sectionHeader}>
        <h3>{copy(OUTCOME_COPY_KEYS.sectionTitle)}</h3>
        <span />
      </div>
      <button
        aria-label={copy(OUTCOME_COPY_KEYS.openDetail, { date: formattedDay, room: vacuum.title })}
        className={styles.summaryButton}
        data-action-kind="modal"
        data-modal-detail-trigger="vacuum-outcomes"
        data-tone={visual.tone}
        onClick={onOpen}
        type="button"
      >
        <span aria-hidden="true" className={styles.summaryIcon}>
          <MaterialIcon name={visual.icon} size={22} />
        </span>
        <span className={styles.summaryCopy}>
          <span className={styles.summaryPrimary}>
            <span>{copy(OUTCOME_COPY_KEYS.summary.completedRooms, { count: summary.completed })}</span>
            <span aria-hidden="true">•</span>
            <span>{copy(OUTCOME_COPY_KEYS.summary.roomsDue, { count: summary.due })}</span>
          </span>
          <span className={styles.summarySecondary}>
            {allComplete ? copy(OUTCOME_COPY_KEYS.allRoomsComplete) : (
              <>
                {summary.attention > 0 && <span>{copy(OUTCOME_COPY_KEYS.summary.attention, { count: summary.attention })}</span>}
                {summary.attention > 0 && summary.interrupted > 0 && <span aria-hidden="true">•</span>}
                {summary.interrupted > 0 && <span>{copy(OUTCOME_COPY_KEYS.summary.interrupted, { count: summary.interrupted })}</span>}
              </>
            )}
          </span>
        </span>
        <SurfaceAccessory semantics={{ kind: 'modal' }} size="compact" />
      </button>
    </section>
  )
}

export function VacuumOutcomeDetail({
  contract,
  vacuum,
}: {
  contract: VacuumOutcomeContract
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const groups = groupedRooms(contract)
  const hasIncompleteGroup = groups.some((group) => group.key !== 'done')
  const roomNames = useMemo(() => reasonRoomNames(contract, vacuum), [contract, vacuum])

  return (
    <div className={styles.detail} data-vacuum-outcome-detail="true">
      <div aria-label={copy(OUTCOME_COPY_KEYS.sectionTitle)} className={styles.detailSummary} role="group">
        {groups.map((group) => {
          const visual = GROUP_VISUAL[group.key]
          return (
            <div data-tone={visual.tone} key={group.key}>
              <MaterialIcon name={visual.icon} size={18} />
              <span>{copy(GROUP_COPY_KEYS[group.key])}</span>
              <strong>{group.rooms.length}</strong>
            </div>
          )
        })}
      </div>
      <div className={styles.groups}>
        {groups.map((group, index) => (
          <VacuumOutcomeGroup
            autofocus={index === 0}
            contract={contract}
            defaultExpanded={groupStartsExpanded(group, hasIncompleteGroup)}
            group={group}
            key={group.key}
            roomNames={roomNames}
          />
        ))}
      </div>
    </div>
  )
}
