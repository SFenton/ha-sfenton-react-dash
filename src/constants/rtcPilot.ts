export const RTC_CAMERA_FRONTEND_VERSION = 'v3.10.3'
// Every dashboard host folder serves the pinned SFenton-RTC card in rtc/ beside its index.html
// and assets/, so the module resolves per host rather than through one absolute folder.
export const RTC_CAMERA_RESOURCE = `rtc/webrtc-camera.js?v=${RTC_CAMERA_FRONTEND_VERSION}`
// The Vite dev server is not a Home Assistant host; its /local proxy reaches the production copy.
export const RTC_CAMERA_DEV_BASE = '/local/ha-sfenton-react-dash/'
export const RTC_PILOT_FRONTEND_VERSION = RTC_CAMERA_FRONTEND_VERSION
export const FOLD_TEST_ASSET_FOLDER = 'ha-sfenton-react-dash-fold-test'
export const FOLD_TEST_CARD_TAG = 'sfenton-react-fold-app-card'
export const FOLD_TEST_CARD_BUNDLE_DIRECTORY = '.cache/rtc-fold-bridge'
export const FOLD_TEST_CARD_RESOURCE_PATH = `/local/${FOLD_TEST_ASSET_FOLDER}/${FOLD_TEST_CARD_TAG}.js`
export const RTC_PILOT_STAGE_DIRECTORY = '.deploy/fold-rtc-dashboard'
export const RTC_PILOT_RESOURCE_PATH =
  '/local/ha-sfenton-react-dash-fold-test/rtc/webrtc-camera.js?v=v3.10.3'
