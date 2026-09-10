import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildReleasePlan,
  loadReleaseContext,
  verifyPatch,
} from './contracts'
import { simulateFaultMatrix } from './simulator'

export async function runShadowRelease(contextPath: string) {
  const context = await loadReleaseContext(contextPath)
  await verifyPatch(context)
  const plan = buildReleasePlan(context)
  const faultMatrix = simulateFaultMatrix(plan)
  await mkdir(context.evidenceDirectory, { recursive: true })
  await writeFile(
    join(context.evidenceDirectory, 'shadow-plan.json'),
    `${JSON.stringify({ plan, faultMatrix }, null, 2)}\n`,
  )
  return {
    status: 'shadow-ready' as const,
    variant: plan.variant,
    planHash: plan.planHash,
    steps: plan.steps.map((step) => step.id),
    faultScenarios: faultMatrix.length,
  }
}

const contextPath = process.argv[2] ?? process.env.DASHBOARD_RELEASE_CONTEXT
if (contextPath) {
  console.log(JSON.stringify(await runShadowRelease(contextPath)))
} else if (process.argv[1]?.endsWith('shadow.ts')) {
  throw new Error('Usage: tsx scripts/release-machine/shadow.ts CONTEXT.json')
}
