import i18n from './init'
import type { CopyKey, CopyRef, CopyText, CopyValues } from './types'
import { resources, type CopyNamespace } from './resources'

const loggedMissingKeys = new Set<string>()
type RuntimeTranslate = (key: string, values?: Record<string, unknown>) => unknown
const runtimeTranslate = i18n.t as unknown as RuntimeTranslate
const importMetaEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string } }).env
const strictCopyMode = Boolean(importMetaEnv?.DEV || importMetaEnv?.MODE === 'test')

function missingMarker(namespace: CopyNamespace, key: string) {
  return `[missing:${namespace}:${key}]`
}

function reportMissing(namespace: CopyNamespace, key: string) {
  const id = `${namespace}:${key}`
  if (!loggedMissingKeys.has(id)) {
    loggedMissingKeys.add(id)
    console.error(`Missing copy key: ${id}`)
  }
}

function invalidCopy(namespace: CopyNamespace, key: string, reason: string) {
  if (strictCopyMode) throw new Error(`Invalid copy (${reason}): ${namespace}:${key}`)
  reportMissing(namespace, key)
  return missingMarker(namespace, key)
}

function sourceTemplates(namespace: CopyNamespace, key: string) {
  const segments = key.split('.')
  const leaf = segments.pop()
  let current: unknown = resources.en[namespace]
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return []
    current = (current as Record<string, unknown>)[segment]
  }
  if (!leaf || !current || typeof current !== 'object' || Array.isArray(current)) return []
  const values = current as Record<string, unknown>
  const exact = values[leaf]
  if (typeof exact === 'string') return [exact]
  return Object.entries(values)
    .filter(([candidate, value]) => candidate.startsWith(`${leaf}_`) && typeof value === 'string')
    .map(([, value]) => value as string)
}

function interpolationNames(namespace: CopyNamespace, key: string) {
  return [...new Set(sourceTemplates(namespace, key).flatMap((template) =>
    [...template.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)[^}]*\}\}/g)].map((match) => match[1])))]
}

function interpolationValue(values: CopyValues | undefined, name: string) {
  let current: unknown = values
  for (const segment of name.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function validateInterpolationValues(
  namespace: CopyNamespace,
  key: string,
  values?: CopyValues,
) {
  const missing = interpolationNames(namespace, key)
    .filter((name) => interpolationValue(values, name) === undefined || interpolationValue(values, name) === null)
  return missing.length ? invalidCopy(namespace, key, 'missing interpolation value') : null
}

export function finalizeCopy(
  namespace: CopyNamespace,
  key: string,
  translated: unknown,
) {
  const result = typeof translated === 'string' ? translated : ''
  const missing = result === '' || result === key || result === `${namespace}:${key}`
  const unresolvedInterpolation = /\{\{[^{}]+\}\}/.test(result)

  if (missing || unresolvedInterpolation) {
    return invalidCopy(namespace, key, missing ? 'missing key' : 'missing interpolation value')
  }

  return result
}

export function copy<N extends CopyNamespace>(
  namespace: N,
  key: CopyKey<N>,
  values?: CopyValues,
) {
  const invalid = validateInterpolationValues(namespace, key, values)
  if (invalid) return invalid
  const translated = runtimeTranslate(key, { ...values, ns: namespace })
  return finalizeCopy(namespace, key, translated)
}

export function copyWithT<N extends CopyNamespace>(
  t: RuntimeTranslate,
  namespace: N,
  key: CopyKey<N>,
  values?: CopyValues,
) {
  const invalid = validateInterpolationValues(namespace, key, values)
  if (invalid) return invalid
  return finalizeCopy(namespace, key, t(key, values))
}

function resolveCopyRef(value: CopyRef) {
  const invalid = validateInterpolationValues(value.namespace, value.key, value.values)
  if (invalid) return invalid
  const translated = runtimeTranslate(value.key, { ...value.values, ns: value.namespace })
  return finalizeCopy(value.namespace, value.key, translated)
}

export function resolveCopy(value: CopyText) {
  if (typeof value === 'string') return value
  return resolveCopyRef(value)
}

export type { CopyKey, CopyRef, CopyText, CopyValues } from './types'
export { copyRef } from './types'
