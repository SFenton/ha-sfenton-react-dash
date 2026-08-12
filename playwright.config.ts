import { defineConfig, devices } from '@playwright/test'

const usePrebuiltMock = process.env.PLAYWRIGHT_PREBUILT_MOCK === '1'
const serverPort = Number(process.env.PLAYWRIGHT_PORT ?? 5174)
const serverUrl = `http://127.0.0.1:${serverPort}`

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: serverUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: usePrebuiltMock
      ? `node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`
      : `node node_modules/vite/bin/vite.js build --mode test --outDir .playwright-dist && node node_modules/vite/bin/vite.js preview --outDir .playwright-dist --host 127.0.0.1 --port ${serverPort} --strictPort`,
    reuseExistingServer: false,
    url: serverUrl,
  },
})