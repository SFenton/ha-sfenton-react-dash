export type WebRtcStatus = 'loading' | 'live' | 'error'

// The card reports its transport in a shadow-DOM `.mode` node rather than an event, so the
// only reliable "is the stream actually playing" signal is that node's text.
export function readStatusFromMode(mode: string | null | undefined): WebRtcStatus {
  const normalized = (mode ?? '').trim().toLowerCase()
  if (normalized === '') return 'loading'
  if (normalized === 'error') return 'error'
  if (normalized.startsWith('loading') || normalized.startsWith('waiting') || normalized.startsWith('reconnecting')) return 'loading'
  return 'live'
}
