import { useId, useState } from 'react'
import { DynamicGrid } from '../core/DynamicGrid'
import { GlassTile, type TileTone } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { SectionHeader } from '../core/SectionHeader'
import { StatusPill, type StatusPillTone } from '../core/StatusPill'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { VACUUM_COPY_KEYS, VACUUM_COPY_NAMESPACE, formatNumber, type CopyKey, type CopyValues, useCopy } from '../../i18n'
import {
  type VacuumOutcomeAttemptMode,
  type VacuumOutcomeAttemptResult,
  type VacuumOutcomeContract,
  type VacuumOutcomeOperation,
  type VacuumOutcomeRoom,
  type VacuumOutcomeStatus,
  type VacuumWhileAwayPresentation,
} from './vacuumOutcomes'
import { countVacuumOutcomes, vacuumOutcomeDayValue, vacuumOutcomeReasonValue } from './vacuumOutcomePresentation'
import styles from './VacuumOutcomes.module.css'

type VacuumCopy = (key: CopyKey<'modalVacuum'>, values?: CopyValues) => string

interface OutcomeVisual {
  icon: string
  tone: StatusPillTone
}

const OUTCOME_COPY_KEYS = VACUUM_COPY_KEYS.outcomes

const STATUS_VISUAL: Record<VacuumOutcomeStatus, OutcomeVisual> = {
  failed: { icon: 'mdi:alert-circle', tone: 'danger' },
  interrupted: { icon: 'mdi:pause-circle', tone: 'warning' },
  partial: { icon: 'mdi:progress-check', tone: 'warning' },
  deferred: { icon: 'mdi:clock-outline', tone: 'warning' },
  completed: { icon: 'mdi:check-circle', tone: 'ok' },
  uncertain: { icon: 'mdi:help-circle-outline', tone: 'warning' },
}

const STATUS_COPY_KEYS: Record<VacuumOutcomeStatus, CopyKey<'modalVacuum'>> = {
  completed: OUTCOME_COPY_KEYS.statuses.completed,
  deferred: OUTCOME_COPY_KEYS.statuses.deferred,
  failed: OUTCOME_COPY_KEYS.statuses.failed,
  interrupted: OUTCOME_COPY_KEYS.statuses.interrupted,
  partial: OUTCOME_COPY_KEYS.statuses.partial,
  uncertain: OUTCOME_COPY_KEYS.statuses.uncertain,
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

function primaryAttemptSentence(copy: VacuumCopy, mode: VacuumOutcomeAttemptMode, result: VacuumOutcomeAttemptResult) {
  return copy(PRIMARY_COPY_KEYS[result][mode])
}

function deferredSentence(copy: VacuumCopy, operation: VacuumOutcomeOperation) {
  return copy(DEFERRED_COPY_KEYS[operation])
}

function outstandingSentence(copy: VacuumCopy, operation: VacuumOutcomeOperation) {
  return copy(OUTSTANDING_COPY_KEYS[operation])
}

function ExpandGlyph({ expanded }: { expanded: boolean }) {
  return <MaterialIcon name={expanded ? 'mdi:minus' : 'mdi:plus'} size={20} />
}

function reconciledRoom(room: VacuumOutcomeRoom) {
  return Boolean(
    room.reconciled_event_id
    && room.latest_attempt?.event_id === room.reconciled_event_id,
  )
}

function knownReasonValue(
  copy: VacuumCopy,
  room: VacuumOutcomeRoom,
  roomNames: Record<string, string>,
  source: 'outstanding' | 'result',
) {
  const reason = source === 'result' ? room.latest_attempt?.reason : room.outstanding?.reason
  if (!reason || reason.code === 'unknown' || reconciledRoom(room)) return null
  return vacuumOutcomeReasonValue(
    copy,
    reason,
    roomNames,
    room.status === 'uncertain' ? 'uncertain' : 'default',
  )
}

function roomOutcomeDetail(copy: VacuumCopy, room: VacuumOutcomeRoom, roomNames: Record<string, string>) {
  const reconciled = reconciledRoom(room)
  const primary = room.latest_attempt
    ? primaryAttemptSentence(copy, room.latest_attempt.mode, reconciled ? 'completed' : room.latest_attempt.result)
    : deferredSentence(copy, room.required_operation)
  const resultReason = knownReasonValue(copy, room, roomNames, 'result')
  const outstandingReason = knownReasonValue(copy, room, roomNames, 'outstanding')

  if (room.status === 'failed') return resultReason ?? outstandingReason ?? primary
  if (room.status === 'interrupted') return resultReason ?? outstandingReason ?? primary
  if (room.status === 'partial') {
    return room.outstanding ? outstandingSentence(copy, room.outstanding.operation) : resultReason ?? primary
  }
  if (room.status === 'deferred') return outstandingReason ?? primary
  if (room.status === 'uncertain') return resultReason ?? outstandingReason ?? primary
  return primary
}

function VacuumOutcomeChip({
  room,
  roomNames,
}: {
  room: VacuumOutcomeRoom
  roomNames: Record<string, string>
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const visual = STATUS_VISUAL[room.status]

  return (
    <div
      className={styles.roomChip}
      data-action-kind="state"
      data-reconciled={reconciledRoom(room) ? 'true' : undefined}
      data-room-id={room.room_id}
      data-status={room.status}
      data-vacuum-outcome-chip="true"
    >
      <StatusPill
        detail={roomOutcomeDetail(copy, room, roomNames)}
        grouped
        icon={visual.icon}
        label={room.room_name}
        tone={visual.tone}
        value={copy(STATUS_COPY_KEYS[room.status])}
      />
    </div>
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

function summaryTileTone(tone: StatusPillTone, interrupted: boolean): TileTone {
  if (tone === 'danger') return 'danger'
  if (interrupted) return 'security'
  if (tone === 'warning') return 'warning'
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
      <SectionHeader title={copy(OUTCOME_COPY_KEYS.sectionTitle, { room: vacuum.title }).concat(' (', formatNumber(contract.rooms.length), ')')} />
      <div data-modal-detail-trigger={onOpen ? 'vacuum-outcomes' : undefined}>
        <GlassTile
          ariaLabel={onOpen ? copy(OUTCOME_COPY_KEYS.openDetail, { date: formattedDay, room: vacuum.title }) : undefined}
          icon={visual.icon}
          onClick={onOpen}
          semantics={onOpen ? { kind: 'modal' } : { kind: 'state' }}
          subtitle={subtitle || undefined}
          title={formattedDay}
          tone={summaryTileTone(visual.tone, visual === STATUS_VISUAL.interrupted)}
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
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const roomNames = reasonRoomNames(contract, vacuum)

  return (
    <div className={styles.detail} data-modal-detail-autofocus="true" data-vacuum-outcome-detail="true" tabIndex={-1}>
      <DynamicGrid
        ariaLabel={copy(OUTCOME_COPY_KEYS.sectionTitle, { room: vacuum.title })}
        className={styles.outcomeGrid}
        columns={2}
        gap={8}
        itemSizing="uniform"
        layout="fill"
      >
        {contract.rooms.map((room) => (
          <VacuumOutcomeChip key={room.room_id} room={room} roomNames={roomNames} />
        ))}
      </DynamicGrid>
    </div>
  )
}
