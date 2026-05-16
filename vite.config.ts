import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hassTarget = env.VITE_HA_URL || 'http://homeassistant.local:8123'

  return {
    base: './',
    plugins: [react()],
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
      proxy: {
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
