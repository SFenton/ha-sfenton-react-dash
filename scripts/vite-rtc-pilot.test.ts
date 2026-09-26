// @covers vite.config.ts
// @covers vite.fold-bridge.config.ts
import { FOLD_TEST_CARD_BUNDLE_DIRECTORY, FOLD_TEST_CARD_TAG } from '../src/constants/rtcPilot'
import dashboardConfig, { dashboardCameraAliases } from '../vite.config'
import { foldBridgeBuildConfig } from '../vite.fold-bridge.config'

describe('isolated RTC pilot build', () => {
  it('keeps HA routing without the removed frontend chat development proxy', async () => {
    if (typeof dashboardConfig !== 'function') throw new Error('Expected function-backed Vite config')
    const config = await dashboardConfig({ command: 'serve', mode: 'test', isSsrBuild: false, isPreview: false })
    expect(config.server?.proxy).toHaveProperty('/api')
    expect(config.server?.proxy).not.toHaveProperty('/__home-mcp')
  })

  it('keeps HLS as the default and preserves the existing test mocks', () => {
    expect(dashboardCameraAliases('production')).toBeUndefined()
    expect(dashboardCameraAliases('test')).toMatchObject({
      '@hakit/core': expect.stringContaining('/src/test/mocks/hakitCore.ts'),
    })
  })

  it('resolves only the explicitly selected pilot build to the RTC adapter', () => {
    expect(dashboardCameraAliases('rtc-pilot')).toEqual([{
      find: './HlsCamera',
      replacement: expect.stringContaining('/src/components/hass/RtcPilotCamera.tsx'),
    }])
  })

  it('builds a standalone Fold card module without changing the production bridge entry', () => {
    const fold = foldBridgeBuildConfig()
    expect(fold.base).toBe('./')
    expect(fold.build.rollupOptions.output.entryFileNames).toBe(`${FOLD_TEST_CARD_TAG}.js`)
    expect(fold.build.outDir).toContain(FOLD_TEST_CARD_BUNDLE_DIRECTORY)
    expect(fold.build.rollupOptions.input).toContain('src/panel/sfentonReactAppCard.ts')
  })
})
