import { useState } from 'react'
import { ModalSheet } from '../core/ModalSheet'
import { SectionHeader } from '../core/SectionHeader'
import { DailyReportModalContent, DailyReportModalNav } from './DailyReportModalContent'
import { DAILY_REPORT_MODAL_STYLE, useDailyReportContext } from './dailyReportModal'
import { DAILY_REPORT_HASH, dailyReportTabLabel, type DailyReportTab } from '../../constants/dailyReport'
import { useHashModal } from '../../hooks/useHashModal'

/** App-level summary modal. Rendered once by the shell so any route can open `#daily-report`. */
export function DailyReportModal() {
  const { closeHash, hash } = useHashModal({ appLevel: true })
  const context = useDailyReportContext()
  const [activeTab, setActiveTab] = useState<DailyReportTab>('overdue')
  const open = hash === DAILY_REPORT_HASH

  return (
    <ModalSheet
      bodyHeader={context.user ? <SectionHeader title={dailyReportTabLabel(activeTab)} /> : undefined}
      contentStyle={DAILY_REPORT_MODAL_STYLE}
      footer={context.user ? <DailyReportModalNav activeTab={activeTab} onTabChange={setActiveTab} /> : undefined}
      onClose={closeHash}
      open={open}
      scrollResetKey={activeTab}
      title={context.title}
    >
      <DailyReportModalContent activeTab={activeTab} context={context} />
    </ModalSheet>
  )
}
