import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    outDir: '.playwright-dist',
  },
  server: {
    proxy: {},
  },
  preview: {
    host: '127.0.0.1',
    proxy: {},
    strictPort: true,
  },
})
