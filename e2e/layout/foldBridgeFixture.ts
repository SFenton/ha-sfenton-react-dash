import { build } from 'esbuild'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { FOLD_TEST_CARD_TAG } from '../../src/constants/rtcPilot'

export async function serveFoldBridge(page: Page) {
  const bundle = await build({
    bundle: true,
    define: { 'import.meta.env.MODE': JSON.stringify('fold-bridge') },
    entryPoints: [resolve('src/panel/sfentonReactAppCard.ts')],
    format: 'esm',
    logLevel: 'silent',
    platform: 'browser',
    write: false,
  })
  if (bundle.outputFiles.length !== 1) throw new Error('The isolated Fold bridge must build as one module.')
  const source = bundle.outputFiles[0].text
  if (!source.includes(FOLD_TEST_CARD_TAG) || /^\s*import\b/m.test(source)) {
    throw new Error('The isolated Fold bridge must register its own tag without chunk imports.')
  }
  const script = `/${FOLD_TEST_CARD_TAG}.js`
  await page.route(`**${script}`, (route) => route.fulfill({
    body: source,
    contentType: 'application/javascript',
  }))
  return script
}
