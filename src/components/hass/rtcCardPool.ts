export const RTC_CARD_POOL_LIMIT = 2

export interface RtcCardElement extends HTMLElement {
  hass: unknown
  setConfig: (config: Record<string, unknown>) => void
  video?: HTMLVideoElement | null
}

const rtcCardPool = new Map<string, RtcCardElement[]>()
const rtcStreamCards = new Map<string, Set<RtcCardElement>>()
const warmRtcStreams = new Set<string>()

// The pinned card reports `connected` as soon as it assigns the shared MediaStream, before the
// video element has decoded a frame, so callers check for a decoded frame before revealing it.
export function rtcVideoHasFrame(video: HTMLVideoElement | null | undefined) {
  return !!video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && video.videoWidth > 0 && video.videoHeight > 0
}

// Cards are pooled per configuration so a returning page or a reopened modal reattaches the
// same element, which resubscribes synchronously and keeps its decoded video frame.
export function rtcCardPoolKey(parts: (string | boolean)[]) {
  return JSON.stringify(parts)
}

export function takePooledRtcCard(key: string) {
  const pooled = rtcCardPool.get(key)
  const card = pooled?.pop() ?? null
  if (pooled && pooled.length === 0) rtcCardPool.delete(key)
  return card
}

export function parkRtcCard(key: string, streamId: string, card: RtcCardElement) {
  const pooled = rtcCardPool.get(key) ?? []
  if (pooled.length >= RTC_CARD_POOL_LIMIT) {
    forgetRtcStreamCard(streamId, card)
    return
  }
  pooled.push(card)
  rtcCardPool.set(key, pooled)
}

export function rememberRtcStreamCard(streamId: string, card: RtcCardElement) {
  const cards = rtcStreamCards.get(streamId) ?? new Set<RtcCardElement>()
  cards.add(card)
  rtcStreamCards.set(streamId, cards)
}

export function forgetRtcStreamCard(streamId: string, card: RtcCardElement) {
  const cards = rtcStreamCards.get(streamId)
  if (!cards) return
  cards.delete(card)
  if (cards.size === 0) rtcStreamCards.delete(streamId)
}

// While a card waits for its own first frame, another card of the same shared stream may already
// hold a decoded frame that can be painted as a poster instead of a black or gray placeholder.
export function rtcPosterSource(streamId: string, card: RtcCardElement) {
  for (const other of rtcStreamCards.get(streamId) ?? []) {
    if (other !== card && rtcVideoHasFrame(other.video)) return other.video ?? null
  }
  return null
}

export function setRtcStreamWarm(streamId: string, warm: boolean) {
  if (warm) warmRtcStreams.add(streamId)
  else warmRtcStreams.delete(streamId)
}

export function isRtcCameraWarm(streamId: string | undefined) {
  return !!streamId && warmRtcStreams.has(streamId)
}

export function resetRtcCardPoolForTests() {
  rtcCardPool.clear()
  rtcStreamCards.clear()
  warmRtcStreams.clear()
}
