import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MANUAL_SCREENSHOT_FORBIDDEN_TEXT, MANUAL_SCREENSHOTS } from './screenshots'
import { MANUAL_WORKFLOW_SCREENSHOT_IDS, MANUAL_WORKFLOW_SCREENSHOTS } from './workflowScreenshots'

function pngDimensions(path: string) {
  const bytes = readFileSync(path)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  }
}

describe('manual workflow screenshot evidence', () => {
  it('registers the 70 deterministic workflow subjects exactly once', () => {
    expect(MANUAL_WORKFLOW_SCREENSHOT_IDS).toHaveLength(70)
    expect(MANUAL_WORKFLOW_SCREENSHOTS).toHaveLength(70)
    expect(new Set(MANUAL_WORKFLOW_SCREENSHOT_IDS).size).toBe(70)
    expect(MANUAL_WORKFLOW_SCREENSHOTS.map((screenshot) => screenshot.id)).toEqual(MANUAL_WORKFLOW_SCREENSHOT_IDS)

    for (const screenshot of MANUAL_WORKFLOW_SCREENSHOTS) {
      expect(screenshot.scenarioId).toBe(screenshot.id)
      expect(screenshot.privacyClass).toBe('synthetic')
      expect(screenshot.requiredTargets.length).toBeGreaterThanOrEqual(2)
      const publicCopy = [screenshot.alt, screenshot.caption, ...screenshot.requiredTargets].join(' ')
      for (const forbidden of MANUAL_SCREENSHOT_FORBIDDEN_TEXT) expect(publicCopy).not.toContain(forbidden)
      expect(publicCopy).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/)
      expect(publicCopy).not.toMatch(/\b[a-z_]+\.[a-z0-9_]+\b/)
    }
  })

  it('reuses five existing subjects only with exact visible target evidence', () => {
    const reused = {
      'food-scan-review': 'food.scan-item-sheet',
      'presence-lighting-states': 'admin.presence-overrides-sheet',
      'recipe-detail': 'food.recipe-detail',
      'status-lights-detail': 'room.light-sheet',
      'vacation-confirmation': 'vacation.confirmation-sheet',
    } as const

    for (const [screenshotId, surfaceId] of Object.entries(reused)) {
      const screenshot = MANUAL_SCREENSHOTS.find((candidate) => candidate.id === screenshotId)
      expect(screenshot?.coveredSurfaceIds).toContain(surfaceId)
      expect(screenshot?.surfaceTargetEvidence?.[surfaceId]?.length).toBeGreaterThan(0)
      for (const target of screenshot?.surfaceTargetEvidence?.[surfaceId] ?? []) {
        expect(screenshot?.requiredTargets).toContain(target)
      }
    }
  })

  it('stores distinct phone and desktop PNGs for every workflow subject', () => {
    for (const id of MANUAL_WORKFLOW_SCREENSHOT_IDS) {
      const mobilePath = resolve(process.cwd(), `public/manual/manual-mobile/${id}.png`)
      const desktopPath = resolve(process.cwd(), `public/manual/manual-desktop/${id}.png`)
      expect(existsSync(mobilePath), mobilePath).toBe(true)
      expect(existsSync(desktopPath), desktopPath).toBe(true)

      const mobile = pngDimensions(mobilePath)
      const desktop = pngDimensions(desktopPath)
      expect(mobile.width).toBeGreaterThanOrEqual(280)
      expect(mobile.width).toBeLessThanOrEqual(393)
      expect(mobile.height).toBeGreaterThanOrEqual(220)
      expect(desktop.width).toBeGreaterThanOrEqual(280)
      expect(desktop.width).toBeLessThanOrEqual(1280)
      expect(desktop.height).toBeGreaterThanOrEqual(220)
      expect(readFileSync(mobilePath).equals(readFileSync(desktopPath))).toBe(false)
    }
  })
})
