import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { copyWithT } from './copy'
import type { CopyKey, CopyValues } from './types'
import type { CopyNamespace } from './resources'

export function useCopy<N extends CopyNamespace>(namespace: N) {
  const { t } = useTranslation(namespace as string, { useSuspense: false })

  return useCallback(
    <K extends CopyKey<N>,>(key: K, values?: CopyValues) =>
      copyWithT(t as unknown as (runtimeKey: string, runtimeValues?: Record<string, unknown>) => unknown, namespace, key, values),
    [namespace, t],
  )
}
