import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Description } from '../../core/Description'
import { EmptyState } from '../../core/EmptyState'
import { FieldActionButton } from '../../core/FieldActionButton'
import { InlineAlert } from '../../core/InlineAlert'
import { NativeSelectField } from '../../core/NativeSelectField'
import { SurfaceAccessory } from '../../core/SurfaceAccessory'
import type { ControlSemantics } from '../../core/controlSemantics'
import { CHAT_COPY_KEYS as chatKeys, CHAT_COPY_NAMESPACE, formatDate, useCopy } from '../../../i18n'
import { CHAT_MESSAGE_LIMIT, CHAT_REPLY_LIMIT, chatRecordKey, type ChatThread, type ChatTurn } from './chatRecords'
import type { ChatClient, ChatSnapshot } from './chatClient'
import { useChatSnapshot } from './useDashboardChat'
import styles from './Chat.module.css'

const HISTORY_SEMANTICS = { kind: 'navigate' } satisfies ControlSemantics
const HISTORY_DATE_OPTIONS: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }

function displayAgentName(name: string, id: string, fallback: string) {
  return name === id ? fallback : name
}

function hasUnsavedOversizedReply(thread: ChatThread, state: ChatSnapshot) {
  return thread.turns.some((turn) => turn.result
    && state.unsavedKeys.has(chatRecordKey(turn.result)) && (turn.result.text?.length ?? 0) > CHAT_REPLY_LIMIT)
}

function ChatErrors({ client, state, inlineOversizedReply = false }: { client: ChatClient; state: ChatSnapshot; inlineOversizedReply?: boolean }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const issue = state.status === 'error' ? 'load' : state.issue
  const oversizedReply = state.threads.some((thread) => hasUnsavedOversizedReply(thread, state))
  const alert = issue === 'load' ? copy(chatKeys.loadError)
    : issue === 'save' ? copy(chatKeys.saveError)
      : issue === 'limit' ? oversizedReply && inlineOversizedReply ? null : copy(oversizedReply ? chatKeys.replyTooLarge : chatKeys.limitError)
        : issue === 'unreadable' ? copy(chatKeys.unreadable)
          : issue === 'message-limit' ? copy(chatKeys.messageLimit, { count: CHAT_MESSAGE_LIMIT }) : null
  const loadFailed = issue === 'load' || issue === 'limit' || issue === 'unreadable'
  const saveFailed = issue === 'save' && state.unsavedKeys.size > 0
  return (
    <>
      {!state.connected && <Description>{copy(chatKeys.disconnected)}</Description>}
      {alert && <InlineAlert>{alert}</InlineAlert>}
      {loadFailed && <FieldActionButton disabled={state.busy} label={copy(chatKeys.reload)} onClick={() => void client.reload()} />}
      {saveFailed && (
        <FieldActionButton disabled={state.busy || !state.connected} label={copy(chatKeys.retrySave)} onClick={() => void client.retrySave()} />
      )}
    </>
  )
}

function ThinkingBubble({ remote = false }: { remote?: boolean }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  return (
    <div aria-label={copy(remote ? chatKeys.remotePending : chatKeys.thinking)} className={styles.thinking} data-chat-thinking="true" role="status">
      <span aria-hidden="true" className={styles.dot} />
      <span aria-hidden="true" className={styles.dot} />
      <span aria-hidden="true" className={styles.dot} />
    </div>
  )
}

function ChatTurnBubbles({ turn, thread, state }: { turn: ChatTurn; thread: ChatThread; state: ChatSnapshot }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const result = turn.result
  const speaker = displayAgentName(thread.record.agentName, thread.record.agentId, copy(chatKeys.assistant))
  const notSent = turn.state === 'not-sent'
  const failedReply = result?.response === 'error'
  const emptyReply = result?.response === 'empty'
  return (
    <li className={styles.turn} data-chat-turn={turn.request.id}>
      <article aria-label={copy(chatKeys.you)} className={styles.bubble} data-chat-role="user">
        <div className={styles.message}>{turn.request.text}</div>
        {notSent && <span className={styles.messageState}>{copy(chatKeys.notSent)}</span>}
      </article>
      {result?.contextReset && <Description className={styles.notice}>{copy(chatKeys.contextReset)}</Description>}
      {result?.text && (
        <article aria-label={speaker} className={styles.bubble} data-chat-role="assistant">
          <div className={styles.message}>{result.text}</div>
          {state.unsavedKeys.has(chatRecordKey(result)) && <span className={styles.messageState}>{copy(chatKeys.unsaved)}</span>}
        </article>
      )}
      {failedReply && <Description>{copy(chatKeys.replyError)}</Description>}
      {emptyReply && <Description>{copy(chatKeys.emptyReply)}</Description>}
    </li>
  )
}

export function ChatPanel({ client, bodyElementRef, active, showLatestAction = false }: {
  client: ChatClient
  bodyElementRef: RefObject<HTMLDivElement | null>
  active: boolean
  showLatestAction?: boolean
}) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const state = useChatSnapshot(client)
  const thread = state.threads.find((item) => item.record.id === state.selectedId)
  const oversizedReply = Boolean(thread && hasUnsavedOversizedReply(thread, state))
  const hasThread = Boolean(thread)
  const followsEnd = useRef(true)
  const previousWaiting = useRef<string | null>(null)
  const [showLatest, setShowLatest] = useState(false)
  const contentKey = thread?.turns.map((turn) => `${turn.request.id}:${turn.state}:${turn.result?.text?.length ?? 0}`).join('|') ?? ''
  const loading = state.status === 'idle' || state.status === 'loading'
  const ready = state.status === 'ready'
  const needsConsent = state.availability === 'confirm'
  const expired = state.availability === 'expired'
  const conflicted = state.availability === 'conflict'
  const uncertain = state.availability === 'unknown'
  const unavailable = state.availability === 'unavailable'
  const notSent = state.availability === 'not-sent'
  const lastTurn = thread?.turns.at(-1)
  const waiting = !thread?.conflict && lastTurn?.state === 'pending'
  const preparing = lastTurn?.state === 'saving' && state.busy && state.waitingId === null

  useEffect(() => {
    if (!active) return
    const body = bodyElementRef.current
    if (!body) return
    const syncPosition = () => {
      const end = body.querySelector<HTMLElement>('[data-chat-end]')
      followsEnd.current = !end || end.getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 1
      setShowLatest(!followsEnd.current)
    }
    const end = body.querySelector<HTMLElement>('[data-chat-end]')
    let geometry = { height: body.clientHeight, width: body.clientWidth, content: end?.clientHeight ?? 0 }
    const onGeometryOrScroll = () => {
      const next = { height: body.clientHeight, width: body.clientWidth, content: end?.clientHeight ?? 0 }
      const resized = next.height !== geometry.height || next.width !== geometry.width || next.content !== geometry.content
      if (resized && hasThread && followsEnd.current) body.scrollTop = body.scrollHeight
      geometry = next
      syncPosition()
    }
    body.addEventListener('scroll', onGeometryOrScroll, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onGeometryOrScroll)
    observer?.observe(body)
    if (end) observer?.observe(end)
    syncPosition()
    return () => { body.removeEventListener('scroll', onGeometryOrScroll); observer?.disconnect() }
  }, [active, bodyElementRef, hasThread, state.selectedId])

  useLayoutEffect(() => {
    if (state.waitingId && state.waitingId !== previousWaiting.current) followsEnd.current = true
    previousWaiting.current = state.waitingId
    if (active && hasThread && followsEnd.current && bodyElementRef.current) {
      bodyElementRef.current.scrollTop = bodyElementRef.current.scrollHeight
    }
  }, [active, bodyElementRef, contentKey, hasThread, state.availability, state.waitingId])

  return (
    <div aria-busy={loading} className={styles.panel} data-chat-panel="true">
      <ChatErrors client={client} state={state} inlineOversizedReply={oversizedReply} />
      {state.waitingId && !thread?.turns.some((turn) => turn.request.id === state.waitingId) && (
        <div className={styles.loading} role="status">{copy(chatKeys.thinking)}</div>
      )}
      {loading && <div className={styles.empty}>
        <EmptyState description={copy(chatKeys.emptyDescription)} layout="compact" title={copy(chatKeys.emptyTitle)} />
        <div className={styles.srOnly} role="status">{copy(chatKeys.loading)}</div>
      </div>}
      {ready && !thread && !state.issue && (
        <div className={styles.empty}>
          <EmptyState
            description={copy(state.agents.length ? chatKeys.emptyDescription : chatKeys.unavailableDescription)}
            layout="compact"
            title={copy(state.agents.length ? chatKeys.emptyTitle : chatKeys.unavailableTitle)}
          />
          {state.agents.length > 1 ? (
            <NativeSelectField
              emptyLabel={copy(chatKeys.chooseAgent)}
              label={copy(chatKeys.agent)}
              onChange={(value) => client.selectAgent(value)}
              options={[{ label: copy(chatKeys.chooseAgent), value: '' }, ...state.agents.map((agent) => ({ label: displayAgentName(agent.name, agent.id, copy(chatKeys.assistant)), value: agent.id }))]}
              value={state.agentId}
            />
          ) : !state.agents.length && (
            <FieldActionButton label={copy(chatKeys.reload)} onClick={() => void client.reload()} />
          )}
        </div>
      )}
      {thread && (
        <>
          <div className={styles.threadContent} data-chat-end="true">
          <div aria-label={copy(chatKeys.transcript)} aria-live="polite" aria-relevant="additions text" role="log">
            <ol className={styles.transcript} data-chat-transcript="true">
              {thread.turns.map((turn) => <ChatTurnBubbles key={turn.request.id} state={state} thread={thread} turn={turn} />)}
            </ol>
          </div>
          {oversizedReply && <InlineAlert>{copy(chatKeys.replyTooLarge)}</InlineAlert>}
          {waiting && <ThinkingBubble remote={state.waitingId !== lastTurn?.request.id} />}
          {preparing && <div className={styles.srOnly} role="status">{copy(chatKeys.saving)}</div>}
          {needsConsent && (
            <div className={styles.notice} data-chat-resume-warning="true">
              <Description>{copy(chatKeys.resumeWarning)}</Description>
              {!state.consented && <FieldActionButton label={copy(chatKeys.allowResume)} onClick={() => client.allowResume()} />}
            </div>
          )}
          {expired && !thread.tail?.contextReset && <Description className={styles.notice}>{copy(chatKeys.expired)}</Description>}
          {conflicted && <Description className={styles.notice}>{copy(chatKeys.conflict)}</Description>}
          {uncertain && <Description className={styles.notice}>{copy(chatKeys.unknown)}</Description>}
          {unavailable && <Description className={styles.notice}>{copy(chatKeys.agentRemoved)}</Description>}
          {notSent && <Description className={styles.notice} data-chat-not-sent="true">{copy(chatKeys.notSentDescription)}</Description>}
          </div>
          {showLatestAction && showLatest && (
            <FieldActionButton className={styles.latest} label={copy(chatKeys.latest)} onClick={() => {
              followsEnd.current = true
              if (bodyElementRef.current) bodyElementRef.current.scrollTop = bodyElementRef.current.scrollHeight
              setShowLatest(false)
            }} />
          )}
        </>
      )}
    </div>
  )
}

export function ChatHistory({ client, onSelect }: { client: ChatClient; onSelect: () => void }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const state = useChatSnapshot(client)
  const loading = state.status === 'idle' || state.status === 'loading'
  const threads = state.threads.filter((thread) => thread.turns.length > 0)
  const empty = state.status === 'ready' && !threads.length && !state.issue
  return (
    <div className={styles.panel} data-chat-history="true" data-modal-detail-autofocus="true" tabIndex={-1}>
      {threads.length > 0 && <Description>{copy(chatKeys.scope)}</Description>}
      <ChatErrors client={client} state={state} />
      {loading ? (
        <div className={styles.loading} role="status">{copy(chatKeys.loading)}</div>
      ) : empty ? (
        <div className={styles.empty}><EmptyState description={copy(chatKeys.historyEmptyDescription)} layout="compact" title={copy(chatKeys.historyEmptyTitle)} /></div>
      ) : (
        <ul className={styles.history}>
          {threads.map((thread) => (
            <li key={thread.record.id}>
              <button
                className={styles.historyRow}
                data-action-kind={HISTORY_SEMANTICS.kind}
                data-chat-history-thread={thread.record.id}
                onClick={() => { client.selectThread(thread.record.id); onSelect() }}
                type="button"
              >
                <span className={styles.historyCopy}>
                  <span className={styles.historyTitle}>{thread.title || copy(chatKeys.emptyTitle)}</span>
                  <span className={styles.historyMeta}>
                    <span>{displayAgentName(thread.record.agentName, thread.record.agentId, copy(chatKeys.assistant))}</span>
                    <time dateTime={new Date(thread.updatedAt).toISOString()}>{formatDate(thread.updatedAt, HISTORY_DATE_OPTIONS)}</time>
                  </span>
                </span>
                <SurfaceAccessory semantics={HISTORY_SEMANTICS} size="compact" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ChatUnavailable() {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  return <EmptyState description={copy(chatKeys.loadError)} layout="modal" title={copy(chatKeys.unavailableTitle)} />
}
