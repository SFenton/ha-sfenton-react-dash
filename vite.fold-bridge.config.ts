import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { FOLD_TEST_CARD_BUNDLE_DIRECTORY, FOLD_TEST_CARD_TAG } from './src/constants/rtcPilot'

export function foldBridgeBuildConfig() {
  return {
    base: './',
    cacheDir: resolve('.cache/vite-fold-bridge'),
    build: {
      emptyOutDir: true,
      outDir: resolve(FOLD_TEST_CARD_BUNDLE_DIRECTORY),
      rollupOptions: {
        input: resolve('src/panel/sfentonReactAppCard.ts'),
        output: { entryFileNames: `${FOLD_TEST_CARD_TAG}.js` },
      },
    },
  }
}

export default defineConfig(foldBridgeBuildConfig())
