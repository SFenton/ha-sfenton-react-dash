import { useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MaterialIcon } from '../../core/Icon'
import type { ControlSemantics } from '../../core/controlSemantics'
import { CHAT_COPY_KEYS as chatKeys, CHAT_COPY_NAMESPACE, useCopy } from '../../../i18n'
import type { ChatClient } from './chatClient'
import { CHAT_MESSAGE_LIMIT } from './chatRecords'
import { useChatSnapshot } from './useDashboardChat'
import styles from './Chat.module.css'

const SEND_SEMANTICS = { kind: 'command' } satisfies ControlSemantics

export function ChatComposer({ client, active = true }: { client: ChatClient; active?: boolean }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const state = useChatSnapshot(client)
  const id = useId()
  const composing = useRef(false)
  const measureRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  useLayoutEffect(() => {
    if (!active || !measureRef.current) return
    const element = measureRef.current
    const measure = () => {
      const style = getComputedStyle(element)
      const oneLine = parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      setExpanded(element.scrollHeight > oneLine + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [active, state.draft])
  const canContinue = ['fresh', 'current'].includes(state.availability) || (state.availability === 'confirm' && state.consented)
  const thread = state.threads.find((item) => item.record.id === state.selectedId)
  const availableAgent = state.agents.some((agent) => agent.id === (thread?.record.agentId ?? state.agentId))
  const invalidLength = state.draft.length > CHAT_MESSAGE_LIMIT
  const unavailable = state.status !== 'ready' || !state.connected || (!canContinue && state.availability !== 'pending') || !availableAgent
  const blocked = unavailable || !canContinue || state.busy || Boolean(state.issue) || state.unsavedKeys.size > 0 || invalidLength || !state.draft.trim()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!blocked && !composing.current) void client.send()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return
    event.preventDefault()
    if (!blocked && !event.repeat) void client.send()
  }
  return (
    <form aria-label={copy(chatKeys.message)} className={styles.composer} data-chat-composer="true" data-expanded={expanded} onSubmit={submit}>
      <label className={styles.srOnly} htmlFor={id}>{copy(chatKeys.message)}</label>
      <label className={styles.inputSlot} htmlFor={id}>
      <div aria-hidden="true" className={`${styles.input} ${styles.inputMeasure}`} ref={measureRef}>{state.draft}<br /></div>
      <textarea
        aria-invalid={invalidLength ? true : undefined}
        aria-keyshortcuts="Enter"
        autoComplete="off"
        className={styles.input}
        disabled={unavailable}
        id={id}
        onChange={(event) => client.setDraft(event.target.value)}
        onCompositionEnd={() => { composing.current = false }}
        onCompositionStart={() => { composing.current = true }}
        onKeyDown={onKeyDown}
        placeholder={copy(chatKeys.placeholder)}
        readOnly={state.busy && state.waitingId === null}
        rows={1}
        value={state.draft}
      />
      </label>
      <button aria-label={copy(chatKeys.send)} className={styles.send} data-action-kind={SEND_SEMANTICS.kind} disabled={blocked} type="submit">
        <MaterialIcon name="mdi:arrow-up" size={24} />
      </button>
    </form>
  )
}
