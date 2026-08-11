import type { CopyText } from './types'

export const validCopyReference = {
  namespace: 'modalCamera',
  key: 'controls',
} satisfies CopyText

// @ts-expect-error The key must belong to the selected namespace.
export const invalidCopyReference: CopyText = { namespace: 'common', key: 'controls' }
