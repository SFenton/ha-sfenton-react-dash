import { SprinklerController } from '../components/hass/SprinklerController'
import { SectionHeader } from '../components/core/SectionHeader'
import { ResponsiveSectionGrid, ResponsiveSectionItem } from '../components/core/ResponsiveSectionGrid'
import { BACKYARD_SPRINKLER, FRONT_YARD_SPRINKLER } from '../constants/sprinklers'
import { useCopy } from '../i18n'
import styles from './SprinklersPage.module.css'

export function SprinklersPage({ preload = false }: { preload?: boolean }) {
  if (preload) {
    return (
      <div aria-hidden="true" className={styles.preload}>
        <div className={styles.preloadController} />
        <div className={styles.preloadController} />
        <div className={styles.preloadStatusGrid}>
          {Array.from({ length: 8 }, (_, index) => <div className={styles.preloadStatus} key={index} />)}
        </div>
      </div>
    )
  }

  return <SprinklersPageContent />
}

function SprinklersPageContent() {
  const t = useCopy('pageSprinklers')
  const sectionName = t('sections.controllers')

  return (
    <div className={styles.content}>
      <SectionHeader title={sectionName} />
      <ResponsiveSectionGrid className={styles.controllerList} gap={24}>
        <ResponsiveSectionItem><SprinklerController config={FRONT_YARD_SPRINKLER} /></ResponsiveSectionItem>
        <ResponsiveSectionItem><SprinklerController config={BACKYARD_SPRINKLER} /></ResponsiveSectionItem>
      </ResponsiveSectionGrid>
    </div>
  )
}
