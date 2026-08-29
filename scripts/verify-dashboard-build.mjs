import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function verifyDashboardBuild(rootDirectory = process.cwd()) {
  const distDirectory = resolve(rootDirectory, 'dist')
  const bridgeFiles = [
    'sfenton-react-app-card.js',
    'sfenton-react-panel.js',
  ]

  for (const bridgeFile of bridgeFiles) {
    const source = await readFile(resolve(distDirectory, bridgeFile), 'utf8')
    if (/^\s*import\b/m.test(source)) {
      throw new Error(`${bridgeFile} imports a hashed chunk and is not deployment-safe.`)
    }
  }

  const assetFiles = await readdir(resolve(distDirectory, 'assets'))
  const appFiles = assetFiles.filter((fileName) => /^app-.+\.js$/.test(fileName))
  if (appFiles.length !== 1) {
    throw new Error(`Expected one built app JavaScript asset, found ${appFiles.length}.`)
  }

  const appSource = await readFile(resolve(distDirectory, 'assets', appFiles[0]), 'utf8')
  if (!appSource.includes('__sfentonReactDashboardLifecycle')) {
    throw new Error('The built app is missing the React dashboard lifecycle registry.')
  }
  if (!appSource.includes('window.top!==window')) {
    throw new Error('The built app is missing the embedded websocket collection teardown patch.')
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : ''

if (import.meta.url === invokedPath) {
  verifyDashboardBuild().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
