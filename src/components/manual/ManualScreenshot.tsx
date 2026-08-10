import { manualScreenshotConfig, manualScreenshotUrl } from '../../manual/screenshots'
import type { CSSProperties } from 'react'
import styles from './ManualScreenshot.module.css'

const DESKTOP_MEDIA = [
  '(any-hover: hover) and (any-pointer: fine)',
  '(min-width: 900px) and (min-height: 600px)',
  '(min-width: 700px) and (min-height: 700px)',
].join(', ')

export function ManualScreenshot({ eager = false, id }: { eager?: boolean; id: string }) {
  const config = manualScreenshotConfig(id)
  if (!config) return null
  const style = {
    '--manual-screenshot-desktop-max-width': `${config.desktopMaxWidth}px`,
    '--manual-screenshot-mobile-max-width': `${config.mobileMaxWidth ?? config.desktopMaxWidth}px`,
  } as CSSProperties

  return (
    <figure className={styles.figure} data-manual-screenshot={id} data-screenshot-role={config.role} style={style}>
      <picture className={styles.frame}>
        <source media={DESKTOP_MEDIA} srcSet={manualScreenshotUrl(id, 'manual-desktop')} />
        <img
          alt={config.alt}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          src={manualScreenshotUrl(id, 'manual-mobile')}
        />
      </picture>
      <figcaption className={styles.caption}>{config.caption}</figcaption>
    </figure>
  )
}
