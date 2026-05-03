import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hassTarget = env.VITE_HA_URL || 'http://homeassistant.local:8123'

  return {
    base: './',
    plugins: [react()],
    server: {
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
