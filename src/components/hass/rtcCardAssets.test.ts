// @covers public/rtc/webrtc-camera.js
// @covers public/rtc/stream-manager.js
// @covers public/rtc/video-rtc.js
// @covers public/rtc/digital-ptz.js
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RTC_CAMERA_FRONTEND_VERSION } from '../../constants/rtcPilot'

// Vendored verbatim from custom_components/webrtc/www in SFenton/WebRTC at
// b6c37a0588 (manifest v3.10.3). Vite copies public/rtc/ into every build, so
// each dashboard host serves the card from the rtc/ folder beside index.html.
const PINNED_RTC_FILES: Record<string, string> = {
  'digital-ptz.js': '0a80c41c58b1796fc3f1423cb78a1fa991dea95da66a7017c588ddaba7eccc59',
  'stream-manager.js': '9c5420543eda74ebb81b556baa3c4df953a290ea54daabe2484ccf6046fd3c2a',
  'video-rtc.js': '90cb8743ef693980b85984c99860d598159fb1dcb2e3458e882e3a7de3e0b9ca',
  'webrtc-camera.js': '89236dbdfdacf14e421e47aab0b6c6bc10b021665ede9b6b0c4da3fff4ccec42',
}

const rtcDirectory = resolve(process.cwd(), 'public/rtc')

describe('vendored SFenton-RTC card assets', () => {
  it('ships exactly the pinned v3.10.3 frontend files', () => {
    expect(readdirSync(rtcDirectory).sort()).toEqual(Object.keys(PINNED_RTC_FILES).sort())
    for (const [file, sha256] of Object.entries(PINNED_RTC_FILES)) {
      const digest = createHash('sha256').update(readFileSync(resolve(rtcDirectory, file))).digest('hex')
      expect({ file, digest }).toEqual({ file, digest: sha256 })
    }
  })

  it('matches the card version the dashboard requests', () => {
    const card = readFileSync(resolve(rtcDirectory, 'webrtc-camera.js'), 'utf8')
    expect(card).toContain(`const WEBRTC_VERSION = '${RTC_CAMERA_FRONTEND_VERSION.slice(1)}'`)
    expect(card).toContain("from './stream-manager.js?v=1.3.0'")
  })
})
