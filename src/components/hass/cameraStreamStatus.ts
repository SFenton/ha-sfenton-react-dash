export const CAMERA_STREAM_PHASE = {
  ERROR: 'error',
  LIVE: 'live',
  LOADING: 'loading',
} as const

export type CameraStreamStatus = typeof CAMERA_STREAM_PHASE[keyof typeof CAMERA_STREAM_PHASE]
