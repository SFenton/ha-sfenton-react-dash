import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MANUAL_SCREENSHOT_FORBIDDEN_TEXT, MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET, MANUAL_SCREENSHOTS, manualScreenshotCoverageIssues, manualScreenshotSurfaceIds } from './screenshots'
import { collectDerivedSurfaceInventory } from './surfaceInventory'
import { MANUAL_SURFACES } from './surfaces'

const NEW_SCREENSHOT_SURFACES = {
  'food-suggested-recipes': { role: 'overview', surfaceId: 'food.suggested-recipes' },
  'home-climate-overview': { role: 'modal', surfaceId: 'home.climate-sheet' },
  'home-climate-room-detail': { role: 'detail', surfaceId: 'home.climate-room-detail' },
  'home-occupancy-overview': { role: 'modal', surfaceId: 'home.occupancy-sheet' },
  'home-occupancy-room-detail': { role: 'detail', surfaceId: 'home.occupancy-room-detail' },
  'home-contact-overview': { role: 'modal', surfaceId: 'home.contact-sensors-sheet' },
  'home-contact-room-detail': { role: 'detail', surfaceId: 'home.contact-room-detail' },
  'home-air-quality-overview': { role: 'modal', surfaceId: 'home.air-quality-sheet' },
} as const

const STRICT_VISUAL_POLICY_SCREENSHOT_SURFACES = {
  'weather-precipitation': 'home.weather-mode-precipitation',
  'weather-wind': 'home.weather-mode-wind',
  'vacuum-controls': 'cleaning.vacuum-tab-controls',
  'vacuum-auto-clean': 'cleaning.vacuum-tab-autoClean',
  'humidifier-schedules': 'climate.humidifier-tab-schedules',
  'humidifier-info': 'climate.humidifier-tab-info',
  'sleepypod-modes': 'climate.sleepypod-tab-modes',
  'sleepypod-alarms': 'climate.sleepypod-tab-alarms',
  'sleepypod-status': 'climate.sleepypod-tab-status',
  'eight-sleep-schedule': 'climate.eight-sleep-tab-schedule',
  'eight-sleep-modes': 'climate.eight-sleep-tab-modes',
  'eight-sleep-alarms': 'climate.eight-sleep-tab-alarms',
  'eight-sleep-status': 'climate.eight-sleep-tab-status',
  'eight-sleep-settings': 'climate.eight-sleep-tab-settings',
  'daily-report-upcoming': 'chores.daily-report-tab-upcoming',
  'daily-report-expired-food': 'chores.daily-report-tab-expired-food',
  'recipe-detail-general': 'food.recipe-detail-general',
  'recipe-detail-ingredients': 'food.recipe-detail-ingredients',
  'recipe-detail-instructions': 'food.recipe-detail-instructions',
  'custom-light-mode-picker': 'option-picker.custom-light-mode',
  'thermostat-hub-mode-picker': 'option-picker.thermostat-hub-mode',
  'thermostat-hub-fan-picker': 'option-picker.thermostat-hub-fan',
  'thermostat-controls-automation': 'climate.thermostat-tab-automation',
  'thermostat-controls-tracking': 'climate.thermostat-tab-tracking',
} as const

const STATUS_CHIP_EVIDENCE = {
  'home.status-chip-lights': { screenshotId: 'home-status-rail-start', target: 'Lights' },
  'home.status-chip-security': { screenshotId: 'home-status-rail-start', target: 'Security' },
  'home.status-chip-climate': { screenshotId: 'home-status-rail-start', target: 'Climate' },
  'home.status-chip-occupancy': { screenshotId: 'home-occupancy-overview', target: 'Occupancy' },
  'home.status-chip-contact-sensors': { screenshotId: 'home-status-rail-end', target: 'Contact Sensors' },
  'home.status-chip-air-quality': { screenshotId: 'home-status-rail-end', target: 'Air Quality' },
} as const

function pngDimensions(path: string) {
  const bytes = readFileSync(path)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  }
}

describe('manual screenshot shared surface coverage', () => {
  const derivedSurfaceIds = collectDerivedSurfaceInventory().surfaces.map((surface) => surface.id)
  const registeredSurfaceIds = new Set([...MANUAL_SURFACES.map((surface) => surface.id), ...derivedSurfaceIds])

  it('validates every primary and covered surface claim with visible target evidence', () => {
    const coveredSurfaceIds = MANUAL_SCREENSHOTS.flatMap((screenshot) => screenshot.coveredSurfaceIds ?? [])

    expect(new Set(coveredSurfaceIds).size).toBe(45)
    expect(coveredSurfaceIds).toHaveLength(45)
    for (const screenshot of MANUAL_SCREENSHOTS) {
      expect(manualScreenshotCoverageIssues(screenshot, registeredSurfaceIds)).toEqual([])
    }
  })

  it('rejects unknown, duplicate, primary-repeated, and targetless covered surfaces', () => {
    const base = {
      id: 'coverage-test',
      requiredTargets: ['Visible target'],
      surfaceId: 'home.status-rail',
    }

    expect(manualScreenshotCoverageIssues({
      ...base,
      coveredSurfaceIds: ['missing.surface'],
      surfaceTargetEvidence: {
        'home.status-rail': ['Visible target'],
        'missing.surface': ['Visible target'],
      },
    }, registeredSurfaceIds)).toContain('claims unknown surface missing.surface')

    expect(manualScreenshotCoverageIssues({
      ...base,
      coveredSurfaceIds: ['home.status-chip-lights', 'home.status-chip-lights'],
      surfaceTargetEvidence: {
        'home.status-rail': ['Visible target'],
        'home.status-chip-lights': ['Visible target'],
      },
    }, registeredSurfaceIds)).toContain('duplicates covered surface ids: home.status-chip-lights')

    expect(manualScreenshotCoverageIssues({
      ...base,
      coveredSurfaceIds: ['home.status-rail'],
      surfaceTargetEvidence: {
        'home.status-rail': ['Visible target'],
      },
    }, registeredSurfaceIds)).toContain('repeats primary surface home.status-rail as covered')

    expect(manualScreenshotCoverageIssues({
      ...base,
      coveredSurfaceIds: ['home.status-chip-lights'],
      surfaceTargetEvidence: {
        'home.status-rail': ['Visible target'],
        'home.status-chip-lights': ['Not required'],
      },
    }, registeredSurfaceIds)).toContain('uses "Not required" for home.status-chip-lights without requiring that visible target')
  })

  it('covers all six Home status chips with exact target proof', () => {
    for (const [surfaceId, expected] of Object.entries(STATUS_CHIP_EVIDENCE)) {
      const screenshot = MANUAL_SCREENSHOTS.find((candidate) => candidate.id === expected.screenshotId)
      expect(screenshot && manualScreenshotSurfaceIds(screenshot)).toContain(surfaceId)
      expect(screenshot?.surfaceTargetEvidence?.[surfaceId]).toEqual([expected.target])
      expect(screenshot?.requiredTargets).toContain(expected.target)
    }
  })

  it('registers the eight new synthetic overview and detail scenarios', () => {
    for (const [id, expected] of Object.entries(NEW_SCREENSHOT_SURFACES)) {
      const screenshot = MANUAL_SCREENSHOTS.find((candidate) => candidate.id === id)
      expect(screenshot).toMatchObject({
        id,
        privacyClass: 'synthetic',
        role: expected.role,
        scenarioId: id,
        surfaceId: expected.surfaceId,
      })
      expect(screenshot?.requiredTargets.length).toBeGreaterThanOrEqual(4)
      const publicCopy = [screenshot?.alt, screenshot?.caption, ...(screenshot?.requiredTargets ?? [])].join(' ')
      for (const forbidden of MANUAL_SCREENSHOT_FORBIDDEN_TEXT) expect(publicCopy).not.toContain(forbidden)
      expect(publicCopy).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/)
      expect(publicCopy.toLowerCase()).not.toContain('live camera')
    }
  })

  it('stores phone and desktop variants for every new subject', () => {
    for (const id of Object.keys(NEW_SCREENSHOT_SURFACES)) {
      const mobilePath = resolve(process.cwd(), `public/manual/manual-mobile/${id}.png`)
      const desktopPath = resolve(process.cwd(), `public/manual/manual-desktop/${id}.png`)
      expect(existsSync(mobilePath), mobilePath).toBe(true)
      expect(existsSync(desktopPath), desktopPath).toBe(true)
      const mobile = pngDimensions(mobilePath)
      const desktop = pngDimensions(desktopPath)
      expect(mobile.width).toBeLessThanOrEqual(393)
      expect(mobile.width).toBeGreaterThanOrEqual(280)
      expect(mobile.height).toBeGreaterThanOrEqual(220)
      expect(desktop.width).toBeLessThanOrEqual(1280)
      expect(desktop.width).toBeGreaterThanOrEqual(560)
      expect(desktop.height).toBeGreaterThanOrEqual(220)
      expect(readFileSync(mobilePath).equals(readFileSync(desktopPath))).toBe(false)
    }
  })

  it('registers every stricter visual-policy subject with synthetic evidence and owner metadata', () => {
    for (const [id, surfaceId] of Object.entries(STRICT_VISUAL_POLICY_SCREENSHOT_SURFACES)) {
      const screenshot = MANUAL_SCREENSHOTS.find((candidate) => candidate.id === id)
      expect(screenshot).toMatchObject({
        id,
        privacyClass: 'synthetic',
        role: 'modal',
        scenarioId: id,
        surfaceId,
      })
      expect(screenshot?.articleId).toBeTruthy()
      expect(screenshot?.requiredTargets.length).toBeGreaterThanOrEqual(4)
      const publicCopy = [screenshot?.alt, screenshot?.caption, ...(screenshot?.requiredTargets ?? [])].join(' ')
      for (const forbidden of MANUAL_SCREENSHOT_FORBIDDEN_TEXT) expect(publicCopy).not.toContain(forbidden)
      expect(publicCopy).not.toMatch(/\b[A-HJ-NPR-Z0-9]{17}\b/)
    }
  })

  it('stores distinct phone and desktop variants for every stricter visual-policy subject', () => {
    for (const id of Object.keys(STRICT_VISUAL_POLICY_SCREENSHOT_SURFACES)) {
      const mobilePath = resolve(process.cwd(), `public/manual/manual-mobile/${id}.png`)
      const desktopPath = resolve(process.cwd(), `public/manual/manual-desktop/${id}.png`)
      expect(existsSync(mobilePath), mobilePath).toBe(true)
      expect(existsSync(desktopPath), desktopPath).toBe(true)
      const mobile = pngDimensions(mobilePath)
      const desktop = pngDimensions(desktopPath)
      expect(mobile.width).toBeLessThanOrEqual(393)
      expect(mobile.width).toBeGreaterThanOrEqual(280)
      expect(mobile.height).toBeGreaterThanOrEqual(220)
      expect(desktop.width).toBeLessThanOrEqual(1280)
      expect(desktop.width).toBeGreaterThanOrEqual(280)
      expect(desktop.height).toBeGreaterThanOrEqual(220)
      expect(readFileSync(mobilePath).equals(readFileSync(desktopPath))).toBe(false)
    }
  })

  it('requires an explicit reason for every none-policy surface', () => {
    for (const surface of MANUAL_SURFACES) {
      if (surface.screenshotPolicy === 'none') {
        expect(surface.screenshotPolicyReason?.trim().split(/\s+/).length ?? 0).toBeGreaterThanOrEqual(8)
      } else {
        expect(surface.screenshotPolicyReason).toBeUndefined()
      }
    }
  })

  it('requires zero screenshot-policy backlog', () => {
    const evidencedSurfaceIds = new Set(MANUAL_SCREENSHOTS.flatMap(manualScreenshotSurfaceIds))
    const missing = MANUAL_SURFACES.filter((surface) => surface.screenshotPolicy !== 'none' && !evidencedSurfaceIds.has(surface.id))

    expect(MANUAL_SCREENSHOT_POLICY_REMAINING_BUDGET).toBe(0)
    expect(missing).toEqual([])
  })
})
