import { useEffect, useState } from 'react'
import { Description } from '../../core/Description'
import { FieldActionButton } from '../../core/FieldActionButton'
import { SectionHeader } from '../../core/SectionHeader'
import { CHAT_COPY_KEYS as chatKeys, CHAT_COPY_NAMESPACE, useCopy } from '../../../i18n'
import type { HomeMcpInfo } from './homeMcpClient'
import { CHAT_UX_VERSION } from './chatVersion'
import styles from './ChatSettingsPanel.module.css'

export interface ChatSystemInfoClient {
  systemInfo: () => Promise<HomeMcpInfo | null>
}

const INFO_LOADING = 0
const INFO_READY = 1
const INFO_ERROR = 2
type InfoStatus = typeof INFO_LOADING | typeof INFO_READY | typeof INFO_ERROR

function queueText(info: HomeMcpInfo, copy: ReturnType<typeof useCopy>) {
  if (info.queue.processing) return copy(chatKeys.queueProcessing)
  if (info.queue.pending > 0) return copy(chatKeys.queueWaiting, { count: info.queue.pending })
  return copy(chatKeys.queueIdle)
}

export function ChatSettingsPanel({ client }: { client: ChatSystemInfoClient }) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  const [state, setState] = useState<{ status: InfoStatus; info: HomeMcpInfo | null }>({
    status: INFO_LOADING,
    info: null,
  })

  const load = () => {
    setState((current) => ({ ...current, status: INFO_LOADING }))
    void client.systemInfo().then(
      (info) => setState(info ? { status: INFO_READY, info } : { status: INFO_ERROR, info: null }),
      () => setState({ status: INFO_ERROR, info: null }),
    )
  }

  useEffect(() => {
    let current = true
    void client.systemInfo().then(
      (info) => {
        if (current) setState(info ? { status: INFO_READY, info } : { status: INFO_ERROR, info: null })
      },
      () => {
        if (current) setState({ status: INFO_ERROR, info: null })
      },
    )
    return () => { current = false }
  }, [client])

  return (
    <div className={styles.panel} data-chat-settings="true" data-modal-detail-autofocus="true" tabIndex={-1}>
      {state.status === INFO_LOADING && <div role="status">{copy(chatKeys.settingsLoading)}</div>}
      {state.status === INFO_ERROR && (
        <>
          <Description>{copy(chatKeys.settingsError)}</Description>
          <FieldActionButton label={copy(chatKeys.reload)} onClick={load} />
        </>
      )}
      {state.info && (
        <>
          <section>
            <SectionHeader separator title={copy(chatKeys.modelVersionsTitle)} />
            <dl className={styles.facts}>
              <div className={styles.fact}><dt>{copy(chatKeys.chatModel)}</dt><dd>{state.info.chatModel}</dd></div>
              <div className={styles.fact}><dt>{copy(chatKeys.chatUxVersion)}</dt><dd>{CHAT_UX_VERSION}</dd></div>
              <div className={styles.fact}><dt>{copy(chatKeys.chatMcpVersion)}</dt><dd>{state.info.mcpVersion}</dd></div>
              <div className={styles.fact}><dt>{copy(chatKeys.improvementQueue)}</dt><dd>{queueText(state.info, copy)}</dd></div>
            </dl>
            {state.info.queue.lastError && <Description>{copy(chatKeys.queueError)}</Description>}
          </section>
          <section>
            <SectionHeader separator title={copy(chatKeys.recentImprovementsTitle)} />
            {state.info.improvements.length ? (
              <ol className={styles.improvements}>
                {state.info.improvements.slice(0, 5).map((improvement) => (
                  <li className={styles.improvement} key={`${improvement.version}:${improvement.publishedAt}`}>
                    <h3 className={styles.improvementTitle}>{copy(chatKeys.improvedVersion, { version: improvement.version })}</h3>
                    <ul className={styles.summary}>
                      {improvement.summary.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : <Description>{copy(chatKeys.noImprovements)}</Description>}
          </section>
        </>
      )}
    </div>
  )
}
