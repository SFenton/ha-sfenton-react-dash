import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  cacheDir: '.cache/vitest',
  plugins: [react()],
  resolve: {
    alias: {
      '@hakit/components': fileURLToPath(new URL('./src/test/mocks/hakitComponents.tsx', import.meta.url)),
      '@hakit/core': fileURLToPath(new URL('./src/test/mocks/hakitCore.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
