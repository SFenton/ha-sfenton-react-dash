import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import type { ServerOptions as HttpsServerOptions } from 'node:https'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const DEFAULT_DEV_HTTPS_CERT = '.certs/localhost.pem'
const DEFAULT_DEV_HTTPS_KEY = '.certs/localhost-key.pem'

function devHttpsOptions(mode: string, env: Record<string, string>): HttpsServerOptions | undefined {
  if (mode !== 'https' && env.VITE_DEV_HTTPS !== 'true') return undefined

  const certPath = resolve(env.VITE_DEV_HTTPS_CERT || DEFAULT_DEV_HTTPS_CERT)
  const keyPath = resolve(env.VITE_DEV_HTTPS_KEY || DEFAULT_DEV_HTTPS_KEY)
  if (!existsSync(certPath) || !existsSync(keyPath)) {
    throw new Error(`Missing dev HTTPS certificate. Run npm run dev:https:cert or set VITE_DEV_HTTPS_CERT and VITE_DEV_HTTPS_KEY.`)
  }

  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hassTarget = env.VITE_HA_URL || 'http://homeassistant.local:8123'
  const everShelfDevTarget = env.EVERSHELF_DEV_URL || 'http://127.0.0.1:8083'
  const https = devHttpsOptions(mode, env)

  return {
    base: mode === 'test' ? '/' : './',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          app: resolve(process.cwd(), 'index.html'),
          'sfenton-react-panel': resolve(process.cwd(), 'src/panel/sfentonReactPanel.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => (
            chunkInfo.name === 'sfenton-react-panel'
              ? 'sfenton-react-panel.js'
              : 'assets/[name]-[hash].js'
          ),
        },
      },
    },
    resolve: {
      alias: mode === 'test'
        ? {
            '@hakit/components': fileURLToPath(new URL('./src/test/mocks/hakitComponents.tsx', import.meta.url)),
            '@hakit/core': fileURLToPath(new URL('./src/test/mocks/hakitCore.ts', import.meta.url)),
          }
        : undefined,
    },
    server: {
      host: '0.0.0.0',
      https,
      proxy: {
        '/__evershelf': {
          target: everShelfDevTarget,
          changeOrigin: true,
          headers: {
            'X-Forwarded-Proto': 'https',
          },
          rewrite: (path) => path.replace(/^\/__evershelf/, ''),
          secure: false,
        },
        '/assets/valetudo': {
          target: hassTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api': {
          target: hassTarget,
          changeOrigin: true,
          secure: false,
        },
        '/hacsfiles': {
          target: hassTarget,
          changeOrigin: true,
          secure: false,
        },
        '/webrtc': {
          target: hassTarget,
          changeOrigin: true,
          secure: false,
        },
        '/local': {
          target: hassTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
