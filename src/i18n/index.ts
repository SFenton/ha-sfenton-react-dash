export { copy, copyRef, resolveCopy, type CopyKey, type CopyRef, type CopyText, type CopyValues } from './copy'
export { APP_LANGUAGE, APP_LOCALE, formatDate, formatList, formatNumber } from './formatters'
export { copyNamespaces, resources, type CopyNamespace, type CopyResources } from './resources'
export { useCopy } from './useCopy'

export const COMMON_COPY_NAMESPACE = 'common' as const
export const GARAGE_DOOR_COPY_KEYS = {
  sendingClose: 'garageDoor.sendingClose',
  sendingOpen: 'garageDoor.sendingOpen',
} as const
