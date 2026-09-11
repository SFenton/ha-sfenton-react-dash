import { mdiHistory, mdiMessagePlusOutline } from '@mdi/js'
import { CHAT_COPY_KEYS as chatKeys, CHAT_COPY_NAMESPACE, useCopy } from '../../../i18n'
import { MaterialIcon } from '../../core/Icon'
import type { ControlSemantics } from '../../core/controlSemantics'
import styles from './Chat.module.css'

const HISTORY_SEMANTICS = { kind: 'navigate' } satisfies ControlSemantics
const NEW_CHAT_SEMANTICS = { kind: 'command' } satisfies ControlSemantics

export function ChatHeaderActions({ history, onHistory, onNewChat, onSettings }: {
  history: boolean
  onHistory: () => void
  onNewChat: () => void
  onSettings: () => void
}) {
  const copy = useCopy(CHAT_COPY_NAMESPACE)
  return (
    <>
      <button
        aria-label={copy(chatKeys.settingsAction)}
        className={styles.headerAction}
        data-action-kind={HISTORY_SEMANTICS.kind}
        data-chat-header-action="settings"
        data-modal-detail-trigger="chat-settings"
        onClick={onSettings}
        title={copy(chatKeys.settingsAction)}
        type="button"
      >
        <MaterialIcon name="mdi:cog" size={21} />
      </button>
      {!history && (
        <button
          aria-label={copy(chatKeys.historyAction)}
          className={styles.headerAction}
          data-action-kind={HISTORY_SEMANTICS.kind}
          data-chat-header-action="history"
          data-modal-detail-trigger="chat-history"
          onClick={onHistory}
          title={copy(chatKeys.historyAction)}
          type="button"
        >
          <MaterialIcon path={mdiHistory} size={21} />
        </button>
      )}
      <button
        aria-label={copy(chatKeys.newChat)}
        className={styles.headerAction}
        data-action-kind={NEW_CHAT_SEMANTICS.kind}
        data-chat-header-action="new"
        onClick={onNewChat}
        title={copy(chatKeys.newChat)}
        type="button"
      >
        <MaterialIcon path={mdiMessagePlusOutline} size={21} />
      </button>
    </>
  )
}
