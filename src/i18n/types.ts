import type { CopyNamespace, CopyResources } from './resources'

type StringKey<T> = Extract<keyof T, string>

type LeafKeys<T> = T extends string
  ? never
  : {
      [K in StringKey<T>]: T[K] extends string
        ? K
        : T[K] extends Record<string, unknown>
          ? `${K}.${LeafKeys<T[K]>}`
          : never
    }[StringKey<T>]

type PluralSuffix = 'few' | 'many' | 'one' | 'other' | 'two' | 'zero'
type StripPluralSuffix<T extends string> = T extends `${infer Base}_${PluralSuffix}` ? Base : T

export type CopyKey<N extends CopyNamespace> = StripPluralSuffix<LeafKeys<CopyResources[N]>>
export type CopyValues = Record<string, unknown>

interface NamespaceCopyRef<N extends CopyNamespace> {
  key: CopyKey<N>
  namespace: N
  values?: CopyValues
}

export type CopyRef<N extends CopyNamespace = CopyNamespace> = {
  [K in N]: NamespaceCopyRef<K>
}[N]

export type CopyText = CopyRef | string

export function copyRef<N extends CopyNamespace>(
  namespace: N,
  key: CopyKey<N>,
  values?: CopyValues,
): NamespaceCopyRef<N> {
  return { key, namespace, values }
}
