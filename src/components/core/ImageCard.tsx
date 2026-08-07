import { useState } from 'react'
import { MaterialIcon } from './Icon'
import styles from './ImageCard.module.css'

interface ImageCardProps {
  fallbackImageUrl?: string | null
  imageUrl: string | null
  loading?: 'eager' | 'lazy'
  subtitle?: string
  title: string
}

export function ImageCard({ fallbackImageUrl, imageUrl, loading = 'lazy', subtitle, title }: ImageCardProps) {
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(() => new Set())
  const resolvedImageUrl = [imageUrl, fallbackImageUrl]
    .find((candidate, index, candidates): candidate is string => (
      Boolean(candidate)
      && candidates.indexOf(candidate) === index
      && !failedUrls.has(candidate as string)
    )) ?? null
  const showImage = Boolean(resolvedImageUrl)

  return (
    <article aria-label={title} className={styles.card} data-image-card="true" data-image-state={showImage ? 'loaded' : 'fallback'}>
      <div className={styles.imageBox}>
        {showImage ? (
          <img
            alt=""
            decoding="async"
            loading={loading}
            onError={() => {
              if (!resolvedImageUrl) return
              setFailedUrls((current) => new Set(current).add(resolvedImageUrl))
            }}
            src={resolvedImageUrl ?? undefined}
          />
        ) : (
          <span aria-hidden="true" className={styles.fallback}>
            <MaterialIcon name="mdi:chef-hat" size={34} />
          </span>
        )}
        <span aria-hidden="true" className={styles.scrim} />
        <span className={styles.copy}>
          <strong>{title}</strong>
          {subtitle && <small>{subtitle}</small>}
        </span>
      </div>
    </article>
  )
}
