import type { Page } from '@playwright/test'
import type { SafeAreaInsets } from './responsive-acceptance-data'

function safeAreaInitScript(insets: SafeAreaInsets) {
  const apply = () => {
    const root = document.documentElement
    if (!root) return false
    for (const [edge, value] of Object.entries(insets)) {
      root.style.setProperty(`--safe-area-inset-${edge}`, `${value}px`)
    }
    root.dataset.safeAreaProfile = 'synthetic'
    return true
  }

  if (apply()) return
  const observer = new MutationObserver(() => {
    if (!apply()) return
    observer.disconnect()
  })
  observer.observe(document, { childList: true })
}

export async function installSafeAreaInsets(page: Page, insets: SafeAreaInsets) {
  await page.addInitScript(safeAreaInitScript, insets)
}

export async function setSafeAreaInsets(page: Page, insets: SafeAreaInsets) {
  await page.evaluate(safeAreaInitScript, insets)
}

export async function setBrowserSafeAreaInsets(page: Page, insets: SafeAreaInsets) {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setSafeAreaInsetsOverride', { insets })
  return async () => {
    await session.send('Emulation.setSafeAreaInsetsOverride', { insets: {} })
    await session.detach()
  }
}
