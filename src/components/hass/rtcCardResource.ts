import { RTC_CAMERA_DEV_BASE, RTC_CAMERA_RESOURCE } from '../../constants/rtcPilot'

// Built chunks live in <host folder>/assets/, so the chunk URL anchors the sibling rtc/ folder
// even if standalone routing later rewrites the document URL.
const HOST_FOLDER_FROM_CHUNK = '../'

function defaultBase() {
  if (import.meta.env.DEV) return new URL(RTC_CAMERA_DEV_BASE, window.location.href).href
  return new URL(HOST_FOLDER_FROM_CHUNK, import.meta.url).href
}

export function rtcCardResourceUrl(retry = 0, base = defaultBase()) {
  const url = new URL(RTC_CAMERA_RESOURCE, new URL(base, window.location.href))
  if (retry > 0) url.searchParams.set('retry', String(retry))
  return url.href
}
