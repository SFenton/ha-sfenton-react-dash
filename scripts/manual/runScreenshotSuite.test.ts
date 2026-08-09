import {
  MANUAL_SCREENSHOT_PROJECTS,
  MANUAL_SCREENSHOT_SHARD_COUNT,
  manualScreenshotShardRuns,
} from './runScreenshotSuite'

describe('App Manual screenshot suite runner', () => {
  it('covers every phone and desktop shard exactly once', () => {
    const runs = manualScreenshotShardRuns()

    expect(runs).toHaveLength(MANUAL_SCREENSHOT_PROJECTS.length * MANUAL_SCREENSHOT_SHARD_COUNT)
    expect(new Set(runs.map((run) => `${run.project}:${run.shard}`)).size).toBe(runs.length)
    for (const project of MANUAL_SCREENSHOT_PROJECTS) {
      expect(runs.filter((run) => run.project === project).map((run) => run.shard)).toEqual(
        Array.from({ length: MANUAL_SCREENSHOT_SHARD_COUNT }, (_, index) => `${index + 1}/${MANUAL_SCREENSHOT_SHARD_COUNT}`),
      )
    }
  })
})
