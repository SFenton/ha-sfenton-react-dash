import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { HomeMcpMetadata } from './types'

export function nextPatchVersion(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`Invalid Home MCP version: ${version}`)
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

export async function recordImprovementRelease(root: string, summary: string[], publishedAt = new Date().toISOString()) {
  const path = resolve(root, 'home-mcp/metadata.json')
  const metadata = JSON.parse(await readFile(path, 'utf8')) as HomeMcpMetadata
  const version = nextPatchVersion(metadata.serverVersion)
  const next: HomeMcpMetadata = {
    serverVersion: version,
    improvements: [{ version, publishedAt, summary: summary.slice(0, 3) }, ...metadata.improvements].slice(0, 5),
  }
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return version
}
