import { useEntity, useHass } from '@hakit/core'
import { Icon } from '../core/Icon'
import { SECURITY_ACTIONS, SECURITY_ENTITY } from '../../constants/atAGlance'
import { asEntityName, titleCaseState } from './entityState'
import styles from './SecurityControls.module.css'

export function SecurityControls() {
  const alarm = useEntity(asEntityName(SECURITY_ENTITY), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService)

  const callAlarmService = (service: (typeof SECURITY_ACTIONS)[number]['service']) => {
    callService({ domain: 'alarm_control_panel', service, target: SECURITY_ENTITY })
  }

  return (
    <div>
      <section className={styles.summary}>
        <span className={styles.summaryLabel}>Current alarm state</span>
        <span className={styles.summaryState}>{titleCaseState(alarm?.state)}</span>
      </section>
      <div className={styles.actions}>
        {SECURITY_ACTIONS.map((action) => (
          <button className={styles.action} key={action.service} onClick={() => callAlarmService(action.service)} type="button">
            <Icon name={action.icon} size={24} />
            <span>{action.title}</span>
          </button>
        ))}
      </div>
      <p className={styles.note}>These controls call the same Home Assistant alarm panel services as the dashboard card.</p>
    </div>
  )
}