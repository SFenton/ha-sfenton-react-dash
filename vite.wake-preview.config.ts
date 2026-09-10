import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import baseConfig from './vite.config'
import copy from './src/i18n/locales/en/modals/wakeLight.json' with { type: 'json' }

export default defineConfig(async environment => {
  if (environment.mode !== 'test') throw new Error('The Wake review preview requires mock mode.')
  const base = typeof baseConfig === 'function' ? await baseConfig(environment) : await baseConfig
  const realControls = process.env.WAKE_PREVIEW_REAL_CONTROLS === '1'
  return {
    ...base,
    cacheDir: realControls ? 'artifacts/wake-real-controls-cache' : 'artifacts/wake-preview-cache',
    resolve: realControls ? {
      ...base.resolve,
      alias: {
        '@hakit/core': fileURLToPath(new URL('./src/test/mocks/hakitCoreWithRealControls.ts', import.meta.url)),
        '@wake-preview/real-core': fileURLToPath(new URL('./node_modules/@hakit/core/dist/es/index.js', import.meta.url)),
      },
    } : base.resolve,
    define: {
      ...base.define,
      'import.meta.env.VITE_HA_URL': JSON.stringify('http://mock-hass.invalid'),
      'import.meta.env.VITE_HA_TOKEN': JSON.stringify(''),
    },
    server: {
      ...base.server,
      host: '0.0.0.0',
      strictPort: true,
      proxy: undefined,
      headers: { 'X-Dashboard-Data': 'mock', 'X-Dashboard-Controls': realControls ? 'real' : 'test-stubs' },
    },
    plugins: [
      ...base.plugins ?? [],
      {
        name: 'wake-review-identity',
        enforce: 'pre' as const,
        transform: (source: string, id: string) => {
          if (!id.split('?')[0].endsWith('/src/i18n/locales/en.json')) return undefined
          const catalog = JSON.parse(source)
          return {
            code: JSON.stringify({ ...catalog, app: { ...catalog.app, title: copy.preview.title } }),
            map: null,
          }
        },
        transformIndexHtml: (html: string) => html.replace(
          /<title>[^<]*<\/title>/,
          `<title>${copy.preview.title}</title>`,
        ),
      },
    ],
  }
})
