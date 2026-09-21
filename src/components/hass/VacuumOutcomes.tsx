import { useId, useMemo, useState } from 'react'
import { GlassTile, type TileTone } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { SectionHeader } from '../core/SectionHeader'
import { Separator } from '../core/Separator'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { VACUUM_COPY_KEYS, VACUUM_COPY_NAMESPACE, formatDate, formatNumber, type CopyKey, type CopyValues, useCopy } from '../../i18n'
import {
  vacuumOutcomeEventsForRoom,
  type VacuumOutcomeAttemptMode,
  type VacuumOutcomeAttemptResult,
  type VacuumOutcomeCompletionStatus,
  type VacuumOutcomeContract,
  type VacuumOutcomeEvidence,
  type VacuumOutcomeEvent,
  type VacuumOutcomeIterationStatus,
  type VacuumOutcomeMeasurementEvidence,
  type VacuumOutcomeMeasurementStatus,
  type VacuumOutcomeOperation,
  type VacuumOutcomePhysicalWorkStatus,
  type VacuumOutcomeRoom,
  type VacuumOutcomeStatus,
  type VacuumOutcomeTelemetryStatus,
  type VacuumWhileAwayPresentation,
} from './vacuumOutcomes'
import { countVacuumOutcomes, vacuumOutcomeDayValue, vacuumOutcomeReasonValue } from './vacuumOutcomePresentation'
import styles from './VacuumOutcomes.module.css'

type VacuumCopy = (key: CopyKey<'modalVacuum'>, values?: CopyValues) => string
type OutcomeGroupKey = 'needsAttention' | 'unverified' | 'interrupted' | 'stillDue' | 'done'
type OutcomeTone = 'danger' | 'interrupted' | 'success' | 'uncertain' | 'warning'

interface OutcomeVisual {
  icon: string
  tone: OutcomeTone
}

interface OutcomeGroup {
  key: OutcomeGroupKey
  rooms: VacuumOutcomeRoom[]
}

const GROUP_ORDER: OutcomeGroupKey[] = ['needsAttention', 'unverified', 'interrupted', 'stillDue', 'done']
const OUTCOME_COPY_KEYS = VACUUM_COPY_KEYS.outcomes

const STATUS_VISUAL: Record<VacuumOutcomeStatus, OutcomeVisual> = {
  failed: { icon: 'mdi:alert-circle', tone: 'danger' },
  interrupted: { icon: 'mdi:pause-circle', tone: 'interrupted' },
  partial: { icon: 'mdi:progress-check', tone: 'warning' },
  deferred: { icon: 'mdi:clock-outline', tone: 'warning' },
  completed: { icon: 'mdi:check-circle', tone: 'success' },
  uncertain: { icon: 'mdi:help-circle-outline', tone: 'uncertain' },
}

const STATUS_COPY_KEYS: Record<VacuumOutcomeStatus, CopyKey<'modalVacuum'>> = {
  completed: OUTCOME_COPY_KEYS.statuses.completed,
  deferred: OUTCOME_COPY_KEYS.statuses.deferred,
  failed: OUTCOME_COPY_KEYS.statuses.failed,
  interrupted: OUTCOME_COPY_KEYS.statuses.interrupted,
  partial: OUTCOME_COPY_KEYS.statuses.partial,
  uncertain: OUTCOME_COPY_KEYS.statuses.uncertain,
}

const GROUP_COPY_KEYS: Record<OutcomeGroupKey, CopyKey<'modalVacuum'>> = {
  done: OUTCOME_COPY_KEYS.groups.done,
  interrupted: OUTCOME_COPY_KEYS.groups.interrupted,
  needsAttention: OUTCOME_COPY_KEYS.groups.needsAttention,
  stillDue: OUTCOME_COPY_KEYS.groups.stillDue,
  unverified: OUTCOME_COPY_KEYS.groups.unverified,
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
  partial: {
    fallback_vacuum: OUTCOME_COPY_KEYS.primary.partial.fallbackVacuum,
    vacuum: OUTCOME_COPY_KEYS.primary.partial.vacuum,
    vacuum_mop: OUTCOME_COPY_KEYS.primary.partial.vacuumMop,
  },
  uncertain: {
    fallback_vacuum: OUTCOME_COPY_KEYS.primary.uncertain.fallbackVacuum,
    vacuum: OUTCOME_COPY_KEYS.primary.uncertain.vacuum,
    vacuum_mop: OUTCOME_COPY_KEYS.primary.uncertain.vacuumMop,
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

const PHYSICAL_WORK_COPY_KEYS: Record<VacuumOutcomePhysicalWorkStatus, CopyKey<'modalVacuum'>> = {
  not_observed: OUTCOME_COPY_KEYS.evidence.statuses.notObserved,
  observed: OUTCOME_COPY_KEYS.evidence.statuses.observed,
  substantial: OUTCOME_COPY_KEYS.evidence.statuses.substantial,
}

const MEASUREMENT_STATUS_COPY_KEYS: Record<VacuumOutcomeMeasurementStatus, CopyKey<'modalVacuum'>> = {
  failed: OUTCOME_COPY_KEYS.evidence.statuses.failed,
  not_required: OUTCOME_COPY_KEYS.evidence.statuses.notRequired,
  passed: OUTCOME_COPY_KEYS.evidence.statuses.passed,
  passed_lower_bound: OUTCOME_COPY_KEYS.evidence.statuses.passedLowerBound,
  unknown: OUTCOME_COPY_KEYS.evidence.statuses.unknown,
}

const ITERATION_STATUS_COPY_KEYS: Record<VacuumOutcomeIterationStatus, CopyKey<'modalVacuum'>> = {
  unverified: OUTCOME_COPY_KEYS.evidence.statuses.unverified,
  verified: OUTCOME_COPY_KEYS.evidence.statuses.verified,
}

const COMPLETION_STATUS_COPY_KEYS: Record<VacuumOutcomeCompletionStatus, CopyKey<'modalVacuum'>> = {
  completed: OUTCOME_COPY_KEYS.evidence.statuses.completed,
  incomplete: OUTCOME_COPY_KEYS.evidence.statuses.incomplete,
  uncertain: OUTCOME_COPY_KEYS.evidence.statuses.uncertain,
}

const TELEMETRY_STATUS_COPY_KEYS: Record<VacuumOutcomeTelemetryStatus, CopyKey<'modalVacuum'>> = {
  recovered: OUTCOME_COPY_KEYS.evidence.statuses.recovered,
  unresolved: OUTCOME_COPY_KEYS.evidence.statuses.unresolved,
}

function outcomeGroupKey(status: VacuumOutcomeStatus): OutcomeGroupKey {
  if (status === 'failed') return 'needsAttention'
  if (status === 'uncertain') return 'unverified'
  if (status === 'interrupted') return 'interrupted'
  if (status === 'completed') return 'done'
  return 'stillDue'
}

function roomStatusIsRedundant(status: VacuumOutcomeStatus) {
  return status === 'completed' || status === 'failed' || status === 'interrupted'
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

function evidenceUnit(copy: VacuumCopy, measurement: VacuumOutcomeMeasurementEvidence) {
  return copy(
    measurement.unit === 'seconds'
      ? OUTCOME_COPY_KEYS.evidence.units.seconds
      : OUTCOME_COPY_KEYS.evidence.units.squareInches,
  )
}

function evidenceValue(label: string, value: string | number) {
  return `${label}: ${value}`
}

function measurementEvidenceValue(copy: VacuumCopy, measurement: VacuumOutcomeMeasurementEvidence) {
  const unit = evidenceUnit(copy, measurement)
  const values = [copy(MEASUREMENT_STATUS_COPY_KEYS[measurement.status])]
  if (measurement.observed !== null) {
    values.push(evidenceValue(
      copy(OUTCOME_COPY_KEYS.evidence.labels.observed),
      `${formatNumber(measurement.observed)} ${unit}`,
    ))
  }
  if (measurement.lower_bound !== undefined) {
    values.push(evidenceValue(
      copy(OUTCOME_COPY_KEYS.evidence.labels.lowerBound),
      `${formatNumber(measurement.lower_bound)} ${unit}`,
    ))
  }
  if (measurement.status !== 'not_required') {
    values.push(evidenceValue(
      copy(OUTCOME_COPY_KEYS.evidence.labels.minimum),
      `${formatNumber(measurement.minimum)} ${unit}`,
    ))
  }
  values.push(evidenceValue(
    copy(OUTCOME_COPY_KEYS.evidence.labels.resetCount),
    formatNumber(measurement.reset_count),
  ))
  if (measurement.attribution_uncertain) {
    values.push(copy(OUTCOME_COPY_KEYS.evidence.attributionUncertain))
  }
  return values.join(' • ')
}

function failedProgressSentence(copy: VacuumCopy, room: VacuumOutcomeRoom) {
  if (
    room.credit.status === 'partial'
    && room.credit.operation === 'vacuum'
    && room.outstanding?.operation === 'mop'
  ) {
    return copy(OUTCOME_COPY_KEYS.errorProgress.vacuumCompleteMoppingRemaining)
  }
  if (room.credit.status === 'none' && room.outstanding?.operation === 'vacuum_mop') {
    return copy(OUTCOME_COPY_KEYS.errorProgress.vacuumingAndMoppingRemaining)
  }
  return null
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

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function VacuumOutcomeEvidencePanel({
  evidence,
}: {
  evidence: VacuumOutcomeEvidence
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const targetDwell = `${formatNumber(evidence.physical_work.target_room_dwell_seconds)} ${copy(OUTCOME_COPY_KEYS.evidence.units.seconds)}`
  const iterationValue = [
    copy(ITERATION_STATUS_COPY_KEYS[evidence.iterations.status]),
    evidenceValue(copy(OUTCOME_COPY_KEYS.evidence.labels.observed), formatNumber(evidence.iterations.observed)),
    evidenceValue(copy(OUTCOME_COPY_KEYS.evidence.labels.requested), formatNumber(evidence.iterations.requested)),
  ].join(' • ')

  return (
    <dl className={styles.evidenceGrid}>
      <EvidenceRow
        label={copy(OUTCOME_COPY_KEYS.evidence.labels.physicalWork)}
        value={copy(PHYSICAL_WORK_COPY_KEYS[evidence.physical_work.status])}
      />
      <EvidenceRow
        label={copy(OUTCOME_COPY_KEYS.evidence.labels.targetRoomDwell)}
        value={targetDwell}
      />
      <EvidenceRow
        label={copy(OUTCOME_COPY_KEYS.evidence.labels.duration)}
        value={measurementEvidenceValue(copy, evidence.duration)}
      />
      <EvidenceRow
        label={copy(OUTCOME_COPY_KEYS.evidence.labels.area)}
        value={measurementEvidenceValue(copy, evidence.area)}
      />
      <EvidenceRow
        label={copy(OUTCOME_COPY_KEYS.evidence.labels.iterations)}
        value={iterationValue}
      />
      <EvidenceRow
        label={copy(OUTCOME_COPY_KEYS.evidence.labels.completion)}
        value={copy(COMPLETION_STATUS_COPY_KEYS[evidence.completion.status])}
      />
      {evidence.telemetry && (
        <>
          <EvidenceRow
            label={copy(OUTCOME_COPY_KEYS.evidence.labels.telemetry)}
            value={copy(TELEMETRY_STATUS_COPY_KEYS[evidence.telemetry.status])}
          />
          <EvidenceRow
            label={copy(OUTCOME_COPY_KEYS.evidence.labels.sourceOutages)}
            value={formatNumber(evidence.telemetry.source_outage_count)}
          />
          <EvidenceRow
            label={copy(OUTCOME_COPY_KEYS.evidence.labels.sourceOutageDuration)}
            value={`${formatNumber(evidence.telemetry.source_outage_seconds)} ${copy(OUTCOME_COPY_KEYS.evidence.units.seconds)}`}
          />
        </>
      )}
    </dl>
  )
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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
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
              {event.reason && (
                <OutcomeReasonLine
                  value={vacuumOutcomeReasonValue(
                    copy,
                    event.reason,
                    roomNames,
                    event.type === 'attempt' && event.attempt_result === 'uncertain' ? 'uncertain' : 'default',
                  )}
                />
              )}
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
  const isFailed = room.status === 'failed'
  const isInterrupted = room.status === 'interrupted'
  const reasonVariant = room.status === 'uncertain' ? 'uncertain' : 'default'
  const historyAvailable = !isFailed && !isInterrupted && hasUsefulHistory(events)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const historyId = useId()
  const evidenceId = useId()
  const attemptsId = useId()
  const roomNameId = useId()
  const statusId = useId()
  const visual = STATUS_VISUAL[room.status]
  const reconciled = Boolean(
    room.reconciled_event_id
    && room.latest_attempt?.event_id === room.reconciled_event_id,
  )
  const evidenceResult = room.latest_attempt?.evidence
  const availableEvidence = evidenceResult?.kind === 'available' ? evidenceResult.data : null
  const evidenceMalformed = evidenceResult?.kind === 'malformed'
  const resultReason = reconciled ? null : room.latest_attempt?.reason ?? null
  const outstandingReason = reconciled ? null : room.outstanding?.reason ?? null
  const resultReasonValue = resultReason && !(room.status === 'uncertain' && resultReason.code === 'unknown')
    ? vacuumOutcomeReasonValue(copy, resultReason, roomNames, reasonVariant)
    : null
  const outstandingReasonValue = outstandingReason && !(room.status === 'uncertain' && outstandingReason.code === 'unknown')
    ? vacuumOutcomeReasonValue(copy, outstandingReason, roomNames, reasonVariant)
    : null
  const bothReasons = Boolean(resultReasonValue && outstandingReasonValue)
  const reasonsDiffer = bothReasons && resultReasonValue !== outstandingReasonValue
  const primary = room.latest_attempt
    ? primaryAttemptSentence(copy, room.latest_attempt.mode, reconciled ? 'completed' : room.latest_attempt.result)
    : deferredSentence(copy, room.required_operation)
  const compactReason = isFailed || isInterrupted
    ? resultReasonValue ?? outstandingReasonValue ?? primary
    : null
  const errorProgress = isFailed ? failedProgressSentence(copy, room) : null
  const showPartialCredit = room.credit.status === 'partial'
    && (room.status !== 'partial' || room.latest_attempt?.result === 'partial')
  const showStatusLabel = !roomStatusIsRedundant(room.status)
  const historyLabel = historyOpen
    ? copy(OUTCOME_COPY_KEYS.history.hide, { room: room.room_name })
    : copy(OUTCOME_COPY_KEYS.history.show, { room: room.room_name })
  const evidenceLabel = evidenceOpen
    ? copy(OUTCOME_COPY_KEYS.evidence.hide, { room: room.room_name })
    : copy(OUTCOME_COPY_KEYS.evidence.show, { room: room.room_name })

  return (
    <article
      aria-labelledby={[roomNameId, statusId].join(' ')}
      className={styles.roomRow}
      data-action-kind="state"
      data-reconciled={reconciled ? 'true' : undefined}
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
          <span className={showStatusLabel ? styles.statusLabel : styles.visuallyHidden} id={statusId}>{copy(STATUS_COPY_KEYS[room.status])}</span>
        </div>
        {compactReason ? (
          <>
            <OutcomeReasonLine value={compactReason} />
            {errorProgress && (
              <p className={styles.errorOutstandingLine}>{errorProgress}</p>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
        {availableEvidence && (
          <p className={styles.evidenceSummary}>
            <span>{copy(OUTCOME_COPY_KEYS.evidence.labels.physicalWork)}</span>
            <strong>{copy(PHYSICAL_WORK_COPY_KEYS[availableEvidence.physical_work.status])}</strong>
          </p>
        )}
        {evidenceMalformed && (
          <p className={styles.evidenceUnavailable}>{copy(OUTCOME_COPY_KEYS.evidence.unavailable)}</p>
        )}
      </div>
      {availableEvidence && (
        <button
          aria-controls={evidenceId}
          aria-expanded={evidenceOpen}
          aria-label={evidenceLabel}
          className={styles.evidenceButton}
          data-action-kind="command"
          onClick={() => setEvidenceOpen((current) => !current)}
          type="button"
        >
          <span>{copy(OUTCOME_COPY_KEYS.evidence.title)}</span>
          <ExpandGlyph expanded={evidenceOpen} />
        </button>
      )}
      {availableEvidence && (
        <div className={styles.evidencePanel} hidden={!evidenceOpen} id={evidenceId}>
          <VacuumOutcomeEvidencePanel evidence={availableEvidence} />
        </div>
      )}
      {historyAvailable && (
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
          <span className={styles.historyButtonLabel}>{copy(OUTCOME_COPY_KEYS.history.title)}</span>
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
      {historyAvailable && (
        <div className={styles.history} hidden={!historyOpen} id={historyId}>
          <VacuumOutcomeHistory events={events} room={room} roomNames={roomNames} />
        </div>
      )}
    </article>
  )
}

function VacuumOutcomeGroup({
  contract,
  group,
  roomNames,
}: {
  contract: VacuumOutcomeContract
  group: OutcomeGroup
  roomNames: Record<string, string>
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const label = copy(GROUP_COPY_KEYS[group.key])

  return (
    <section className={styles.group} data-group={group.key}>
      <div className={styles.groupHeader}>
        <h3>{label}</h3>
        <Separator className={styles.groupRule} />
      </div>
      <div className={styles.groupRows}>
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

type VacuumOutcomeProtocolPresentation = Extract<
  VacuumWhileAwayPresentation,
  { kind: 'incompatible' | 'incomplete' | 'malformed' }
>

function protocolCopyKeys(kind: VacuumOutcomeProtocolPresentation['kind']) {
  if (kind === 'incomplete') {
    return {
      description: OUTCOME_COPY_KEYS.protocol.incompleteDescription,
      title: OUTCOME_COPY_KEYS.protocol.incompleteTitle,
    }
  }
  if (kind === 'incompatible') {
    return {
      description: OUTCOME_COPY_KEYS.protocol.incompatibleDescription,
      title: OUTCOME_COPY_KEYS.protocol.incompatibleTitle,
    }
  }
  return {
    description: OUTCOME_COPY_KEYS.protocol.malformedDescription,
    title: OUTCOME_COPY_KEYS.protocol.malformedTitle,
  }
}

export function VacuumOutcomeProtocolNotice({
  presentation,
  vacuum,
}: {
  presentation: VacuumOutcomeProtocolPresentation
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const legacyId = useId()
  const protocolCopy = protocolCopyKeys(presentation.kind)
  const hasLegacy = presentation.cleaned.length > 0 || presentation.issues.length > 0
  const legacyLabel = legacyOpen
    ? copy(OUTCOME_COPY_KEYS.protocol.hideLegacyDetails, { room: vacuum.title })
    : copy(OUTCOME_COPY_KEYS.protocol.showLegacyDetails, { room: vacuum.title })

  return (
    <section className={styles.overviewSection} data-vacuum-outcome-protocol={presentation.kind}>
      <SectionHeader title={copy(OUTCOME_COPY_KEYS.sectionTitle, { room: vacuum.title })} />
      <div className={styles.protocolNotice} data-action-kind="state" role="note">
        <h4>{copy(protocolCopy.title)}</h4>
        <p>{copy(protocolCopy.description)}</p>
        {hasLegacy && (
          <button
            aria-controls={legacyId}
            aria-expanded={legacyOpen}
            aria-label={legacyLabel}
            className={styles.protocolButton}
            data-action-kind="command"
            onClick={() => setLegacyOpen((current) => !current)}
            type="button"
          >
            <span>{copy(OUTCOME_COPY_KEYS.protocol.legacyDetailsTitle)}</span>
            <ExpandGlyph expanded={legacyOpen} />
          </button>
        )}
        {hasLegacy && (
          <div className={styles.legacyDiagnostics} hidden={!legacyOpen} id={legacyId}>
            <p>{copy(OUTCOME_COPY_KEYS.protocol.legacyWarning)}</p>
            {presentation.cleaned.length > 0 && (
              <div>
                <h5>{copy(VACUUM_COPY_KEYS.cleaned)}</h5>
                <ul>{presentation.cleaned.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            )}
            {presentation.issues.length > 0 && (
              <div>
                <h5>{copy(VACUUM_COPY_KEYS.issues)}</h5>
                <ul>{presentation.issues.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function summaryTileTone(tone: OutcomeTone): TileTone {
  if (tone === 'danger') return 'danger'
  if (tone === 'interrupted') return 'security'
  if (tone === 'uncertain' || tone === 'warning') return 'warning'
  return 'presence'
}

export function VacuumOutcomeOverview({
  contract,
  onOpen,
  vacuum,
}: {
  contract: VacuumOutcomeContract
  onOpen?: () => void
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const summary = countVacuumOutcomes(contract)
  const formattedDay = vacuumOutcomeDayValue(contract.day)
  const visual = summary.attention > 0
    ? STATUS_VISUAL.failed
    : summary.unverified > 0
      ? STATUS_VISUAL.uncertain
      : summary.interrupted > 0
        ? STATUS_VISUAL.interrupted
        : summary.due > 0
          ? STATUS_VISUAL.deferred
          : STATUS_VISUAL.completed
  const subtitle = [
    summary.completed > 0 ? copy(OUTCOME_COPY_KEYS.summary.completedRooms, { count: summary.completed }) : null,
    summary.unverified > 0 ? copy(OUTCOME_COPY_KEYS.summary.unverifiedRooms, { count: summary.unverified }) : null,
    summary.needsAttention > 0 ? copy(OUTCOME_COPY_KEYS.summary.roomsNeedAttention, { count: summary.needsAttention }) : null,
    summary.attention > 0 ? copy(OUTCOME_COPY_KEYS.summary.errors, { count: summary.attention }) : null,
  ].filter((value): value is string => Boolean(value)).join(' • ')

  return (
    <section className={styles.overviewSection}>
      <SectionHeader title={copy(OUTCOME_COPY_KEYS.sectionTitle, { room: vacuum.title })} />
      <div data-modal-detail-trigger={onOpen ? 'vacuum-outcomes' : undefined}>
        <GlassTile
          ariaLabel={onOpen ? copy(OUTCOME_COPY_KEYS.openDetail, { date: formattedDay, room: vacuum.title }) : undefined}
          icon={visual.icon}
          onClick={onOpen}
          semantics={onOpen ? { kind: 'modal' } : { kind: 'state' }}
          subtitle={subtitle || undefined}
          title={formattedDay}
          tone={summaryTileTone(visual.tone)}
        />
      </div>
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
  const groups = groupedRooms(contract)
  const roomNames = reasonRoomNames(contract, vacuum)

  return (
    <div className={styles.detail} data-modal-detail-autofocus="true" data-vacuum-outcome-detail="true" tabIndex={-1}>
      <div className={styles.groups}>
        {groups.map((group) => (
          <VacuumOutcomeGroup
            contract={contract}
            group={group}
            key={group.key}
            roomNames={roomNames}
          />
        ))}
      </div>
    </div>
  )
}
