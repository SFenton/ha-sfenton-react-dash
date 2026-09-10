// @covers scripts/release-machine/simulator.ts
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildReleasePlan,
  calculateReleaseScopeHash,
  sha256,
  validateReleaseContext,
  verifyAuthorizedReleaseContext,
  verifyPatch,
} from './contracts'
import { simulateFaultMatrix, simulateRelease } from './simulator'

async function repositoryContext() {
  const repository = await mkdtemp(join(tmpdir(), 'release-machine-'))
  const evidenceDirectory = join(repository, 'artifacts', 'release', 'test')
  await mkdir(evidenceDirectory, { recursive: true })
  const context = {
    version: 1 as const,
    variant: 'repository-only' as const,
    repository,
    baseRevision: 'a'.repeat(40),
    scopePaths: [
      'scripts/release-machine/contracts.ts',
      'scripts/release-machine/contracts.test.ts',
    ],
    branch: 'copilot/release-machine-test',
    evidenceDirectory,
  }
  return {
    ...context,
    scopeHash: await calculateReleaseScopeHash(context),
  }
}

async function dashboardContext() {
  const repository = await repositoryContext()
  const context = {
    ...repository,
    variant: 'dashboard-production' as const,
    scopePaths: [...repository.scopePaths, 'e2e/react-dash.spec.ts'],
    layoutRun: 'artifacts/layout/release-test',
    affectedPlaywrightSpecs: ['e2e/react-dash.spec.ts'],
    attestationPublicKeySha256: 'f'.repeat(64),
  }
  return {
    ...context,
    scopeHash: await calculateReleaseScopeHash(context),
  }
}

describe('release machine contracts', () => {
  it('builds distinct repository and dashboard plans', async () => {
    const repository = await validateReleaseContext(await repositoryContext())
    const repositoryPlan = buildReleasePlan(repository)
    expect(repositoryPlan.steps.map((step) => step.id)).toEqual([
      'validate-scope',
      'validate-change',
      'create-merge-pr',
      'build-merged-master',
      'rollback-git',
      'cleanup-release',
    ])

    const dashboard = await validateReleaseContext(await dashboardContext())
    const dashboardPlan = buildReleasePlan(dashboard)
    expect(dashboardPlan.steps.map((step) => step.id)).toContain(
      'capture-production',
    )
    expect(dashboardPlan.steps.map((step) => step.id)).toContain(
      'rollback-production',
    )
    expect(dashboardPlan.planHash).not.toBe(repositoryPlan.planHash)
  })

  it('rejects unsafe scope and incomplete dashboard evidence', async () => {
    await expect(
      validateReleaseContext({
        ...(await repositoryContext()),
        scopePaths: ['.env.development'],
      }),
    ).rejects.toThrow('unsafe path')
    await expect(
      validateReleaseContext({
        ...(await repositoryContext()),
        variant: 'dashboard-production',
      }),
    ).rejects.toThrow('layout run')
    await expect(
      validateReleaseContext({
        ...(await repositoryContext()),
        scopePaths: ['package-lock.json'],
      }),
    ).rejects.toThrow('dependency installation driver')
  })

  it('binds an optional patch by SHA-256', async () => {
    const patchPath = join((await repositoryContext()).repository, 'change.patch')
    await writeFile(patchPath, 'patch contents')
    const repository = await repositoryContext()
    const candidate = {
      ...repository,
      patch: {
        path: patchPath,
        sha256: sha256(await readFile(patchPath)),
      },
    }
    const context = await validateReleaseContext({
      ...candidate,
      scopeHash: await calculateReleaseScopeHash(candidate),
    })
    await expect(verifyPatch(context)).resolves.toBe(context.patch?.sha256)
    await writeFile(patchPath, 'changed')
    await expect(verifyPatch(context)).rejects.toThrow('hash mismatch')
  })

  it('requires trusted runner authorization to match the complete context', async () => {
    const context = await validateReleaseContext(await repositoryContext())
    const environment = {
      RELEASE_AUTHORIZED_REPOSITORY: context.repository,
      RELEASE_AUTHORIZED_BASE_REVISION: context.baseRevision,
      RELEASE_AUTHORIZED_SCOPE_HASH: context.scopeHash,
      RELEASE_AUTHORIZED_VARIANT: context.variant,
      RELEASE_AUTHORIZED_WORKFLOW_ID: 'release-workflow',
      RELEASE_AUTHORIZED_PLAN_HASH: 'c'.repeat(64),
      RELEASE_AUTHORIZATION_HASH: 'd'.repeat(64),
    }
    await expect(
      verifyAuthorizedReleaseContext(context, environment),
    ).resolves.toBeUndefined()
    await expect(
      verifyAuthorizedReleaseContext(context, {
        ...environment,
        RELEASE_AUTHORIZED_SCOPE_HASH: 'e'.repeat(64),
      }),
    ).rejects.toThrow('Authorized scope hash')
  })

  it('requires changed implementation tests and executes every changed Playwright spec', async () => {
    const repository = await repositoryContext()
    await expect(
      validateReleaseContext({
        ...repository,
        scopePaths: ['scripts/release-machine/contracts.ts'],
      }),
    ).rejects.toThrow('require changed tests')

    const dashboard = await dashboardContext()
    const candidate = {
      ...dashboard,
      affectedPlaywrightSpecs: ['e2e/other.spec.ts'],
    }
    await expect(
      validateReleaseContext({
        ...candidate,
        scopeHash: await calculateReleaseScopeHash(candidate),
      }),
    ).rejects.toThrow('must be included in the affected release specs')
  })

  it('rejects a build worktree that collides with the derived rollback worktree', async () => {
    const repository = await repositoryContext()
    const releaseWorktree = join(
      dirname(repository.repository),
      '.release-worktrees',
      'release-machine-test',
    )
    const candidate = {
      ...repository,
      releaseWorktree,
      buildWorktree: `${releaseWorktree}-revert`,
    }
    await expect(
      validateReleaseContext({
        ...candidate,
        scopeHash: await calculateReleaseScopeHash(candidate),
      }),
    ).rejects.toThrow('Rollback and build worktrees must be distinct')
  })

  it('fault-tests every normal step through rollback and cleanup', async () => {
    const context = await validateReleaseContext(await dashboardContext())
    const plan = buildReleasePlan(context)
    const matrix = simulateFaultMatrix(plan)
    expect(matrix).toHaveLength(
      plan.steps.length + 1,
    )
    expect(matrix[0]?.terminalStatus).toBe('accepted')

    const deployFailure = simulateRelease(plan, 'deploy-both-hosts')
    expect(deployFailure.receipts.map((receipt) => receipt.stepId)).toEqual(
      expect.arrayContaining(['rollback-production', 'cleanup-release']),
    )
    const buildFailure = simulateRelease(plan, 'build-merged-master')
    expect(buildFailure.receipts.map((receipt) => receipt.stepId)).toEqual(
      expect.arrayContaining(['rollback-git', 'cleanup-release']),
    )
    expect(
      simulateRelease(
        plan,
        'deploy-both-hosts',
        'rollback-production',
      ).terminalStatus,
    ).toBe('abnormal')
    expect(
      matrix.every(
        (result) => result.receipts.at(-1)?.stepId === 'cleanup-release',
      ),
    ).toBe(true)
  })
})
