export interface OptimisticStateIntent {
  entityId: string
  revertMs: number
  value: string
}

export interface OptimisticResetIntent {
  entityId: string
  values: readonly string[]
}

export interface OptimisticActionMetadata {
  optimisticResetState?: readonly OptimisticResetIntent[]
  optimisticState?: readonly OptimisticStateIntent[]
}
