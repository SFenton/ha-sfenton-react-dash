// @covers .github/workflows/deploy-dashboard.yml

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEPLOYMENT_FAILURE_RUN_MARKER_PREFIX,
  DEPLOYMENT_FAILURE_SIGNATURE_MARKER_PREFIX,
  deploymentFailureReport,
  deploymentFailureSignature,
  readDeploymentReceipt,
  selectedDeploymentFailure,
  writeDeploymentFailureReport,
} from './deployment-failure-report.mjs'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { force: true, recursive: true })),
  )
})

function environment(overrides: Record<string, string> = {}) {
  return {
    BUILD_RESULT: 'success',
    DEPLOY_RESULT: 'failure',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_RUN_ID: '35836001639',
    GITHUB_SHA: 'b'.repeat(40),
    RUN_URL: 'https://github.com/example/actions/runs/35836001639',
    ...overrides,
  }
}

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    deployedSha: 'a'.repeat(40),
    disposition: 'forward',
    error: 'Automatic deployment is blocked by Home Assistant runtime changes.',
    leaseReleased: true,
    mutationState: 'none',
    rollback: 'not-required',
    sourceSha: 'b'.repeat(40),
    status: 'failed',
    ...overrides,
  }
}

describe('deployment failure reporting', () => {
  it('deduplicates exact safe failure receipts across source runs', () => {
    const first = selectedDeploymentFailure(receipt(), environment())
    const second = selectedDeploymentFailure(
      receipt({ sourceSha: 'c'.repeat(40) }),
      environment({
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_RUN_ID: '99',
        GITHUB_SHA: 'c'.repeat(40),
      }),
    )
    expect(deploymentFailureSignature(first)).toBe(
      deploymentFailureSignature(second),
    )
    expect(
      deploymentFailureSignature({
        ...second,
        error: 'A different protected deployment failure.',
      }),
    ).not.toBe(deploymentFailureSignature(first))
    expect(
      deploymentFailureSignature({
        ...second,
        deployedSha: 'd'.repeat(40),
      }),
    ).not.toBe(deploymentFailureSignature(first))
  })

  it('does not signature-deduplicate receipts with uncertain mutation safety', () => {
    const failure = selectedDeploymentFailure(receipt(), environment())
    expect(deploymentFailureSignature(failure)).toMatch(/^[a-f0-9]{64}$/)
    expect(
      deploymentFailureSignature({ ...failure, mutationState: 'unknown' }),
    ).toBeUndefined()
    expect(
      deploymentFailureSignature({ ...failure, leaseReleased: false }),
    ).toBeUndefined()
    expect(
      deploymentFailureSignature({ ...failure, rollback: 'failed' }),
    ).toBeUndefined()
    expect(
      deploymentFailureSignature({ ...failure, deployedSha: null }),
    ).toBeUndefined()
    expect(
      deploymentFailureSignature({ ...failure, error: '' }),
    ).toBeUndefined()
  })

  it('writes stable run and signature markers into the issue body', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deployment-failure-report-'))
    temporaryDirectories.push(directory)
    await mkdir(directory, { recursive: true })
    await writeFile(
      join(directory, 'deployment-receipt.json'),
      JSON.stringify(receipt()),
    )

    const report = writeDeploymentFailureReport(directory, environment())
    const body = await readFile(join(directory, 'issue-body.md'), 'utf8')
    expect(report.runMarker).toBe(
      `<!-- ${DEPLOYMENT_FAILURE_RUN_MARKER_PREFIX}35836001639-1 -->`,
    )
    expect(report.signatureMarker).toBe(
      `<!-- ${DEPLOYMENT_FAILURE_SIGNATURE_MARKER_PREFIX}${report.signature} -->`,
    )
    expect(body).toContain(report.runMarker)
    expect(body).toContain(report.signatureMarker)
    expect(body).toContain(environment().RUN_URL)
    expect(body).toContain(`"sourceSha": "${'b'.repeat(40)}"`)
  })

  it('keeps invalid receipt failures visible without unsafe deduplication', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deployment-failure-invalid-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'deployment-receipt.json')
    await writeFile(path, '{invalid')

    const parsed = readDeploymentReceipt(path)
    const report = deploymentFailureReport(parsed, environment())
    expect(report.signature).toBeUndefined()
    expect(report.signatureMarker).toBe('')
    expect(report.body).toContain('Deployment receipt could not be parsed')

    await writeFile(path, 'null')
    expect(readDeploymentReceipt(path)).toMatchObject({
      status: 'invalid-receipt',
    })
  })
})
