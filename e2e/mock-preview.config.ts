import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  cacheDir: '.cache/preview',
  build: { outDir: '.playwright-dist' },
  server: { proxy: {} },
  preview: {
    host: '127.0.0.1', proxy: {}, strictPort: true,
    headers: process.env.LAYOUT_SERVER_NONCE ? { 'X-Layout-Server': process.env.LAYOUT_SERVER_NONCE } : {},
  },
})
