// @covers src/constants/rtcPilot.ts
import { RTC_CAMERA_RESOURCE, RTC_PILOT_RESOURCE_PATH } from '../../constants/rtcPilot'
import { rtcCardResourceUrl } from './rtcCardResource'

describe('RTC card resource', () => {
  it('imports the pinned card from beside each host folder', () => {
    expect(RTC_CAMERA_RESOURCE).toBe('rtc/webrtc-camera.js?v=v3.10.3')
    expect(rtcCardResourceUrl(0, 'https://ha.example/local/ha-sfenton-react-dash/index.html?v=1234'))
      .toBe('https://ha.example/local/ha-sfenton-react-dash/rtc/webrtc-camera.js?v=v3.10.3')
    expect(rtcCardResourceUrl(0, 'https://ha.example/local/ha-sfenton-react-dash-fold-test/'))
      .toBe(`https://ha.example${RTC_PILOT_RESOURCE_PATH}`)
    expect(rtcCardResourceUrl(2, 'https://ha.example/local/ha-sfenton-react-dash/'))
      .toBe('https://ha.example/local/ha-sfenton-react-dash/rtc/webrtc-camera.js?v=v3.10.3&retry=2')
  })

  it('loads the production copy through the Home Assistant proxy on the dev server', () => {
    expect(rtcCardResourceUrl()).toBe(
      `${window.location.origin}/local/ha-sfenton-react-dash/rtc/webrtc-camera.js?v=v3.10.3`,
    )
  })

  it('anchors built hosts to the folder above the loaded app chunk, not the routed document', () => {
    vi.stubEnv('DEV', false)
    window.history.pushState(null, '', '/at-a-glance/security')
    try {
      // This module sits in src/components/hass/, so its parent folder stands in for a host folder.
      expect(rtcCardResourceUrl()).toMatch(/\/src\/components\/rtc\/webrtc-camera\.js\?v=v3\.10\.3$/)
    } finally {
      window.history.pushState(null, '', '/')
      vi.unstubAllEnvs()
    }
  })
})
