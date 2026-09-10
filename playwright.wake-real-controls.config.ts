import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

const port = process.env.PLAYWRIGHT_PORT
if (!port || process.env.LAYOUT_RUN_DIR) throw new Error('Supplementary real-controls checks require an explicit unused port and no managed-run impersonation.')
const origin = `http://127.0.0.1:${Number(port)}`

export default defineConfig({
  ...baseConfig,
  use: { ...baseConfig.use, baseURL: origin },
  webServer: {
    command: `node node_modules/vite/bin/vite.js build --config vite.wake-preview.config.ts --mode test --outDir artifacts/wake-real-controls-dist && node node_modules/vite/bin/vite.js preview --config vite.wake-preview.config.ts --mode test --outDir artifacts/wake-real-controls-dist --host 127.0.0.1 --port ${Number(port)} --strictPort`,
    env: {
      WAKE_PREVIEW_REAL_CONTROLS: '1',
      VITE_HA_URL: 'http://mock-hass.local',
      VITE_HA_TOKEN: '',
      EVERSHELF_DEV_URL: 'http://127.0.0.1:1',
    },
    reuseExistingServer: false,
    url: origin,
  },
})
