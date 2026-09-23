import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEPLOYMENT_FAILURE_RUN_MARKER_PREFIX =
  'dashboard-deployment-failure-run-'
export const DEPLOYMENT_FAILURE_SIGNATURE_MARKER_PREFIX =
  'dashboard-deployment-failure-signature-'

function requiredEnvironment(environment, name) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`Missing ${name}.`)
  return value
}

export function selectedDeploymentFailure(receipt, environment) {
  const githubSha = requiredEnvironment(environment, 'GITHUB_SHA')
  return {
    buildResult: requiredEnvironment(environment, 'BUILD_RESULT'),
    deployResult: requiredEnvironment(environment, 'DEPLOY_RESULT'),
    deployedSha: receipt.deployedSha ?? null,
    disposition: receipt.disposition ?? null,
    error: String(
      receipt.error ?? 'Deployment failed without a receipt error.',
    ).slice(0, 4000),
    leaseReleased: receipt.leaseReleased ?? null,
    mutationState: receipt.mutationState ?? null,
    rollback: receipt.rollback ?? null,
    sourceSha: receipt.sourceSha ?? githubSha,
    status: receipt.status ?? 'failed',
  }
}

export function deploymentFailureSignature(failure) {
  if (
    failure.status !== 'failed' ||
    failure.mutationState !== 'none' ||
    failure.leaseReleased !== true ||
    failure.rollback !== 'not-required' ||
    typeof failure.deployedSha !== 'string' ||
    !/^[a-f0-9]{40}$/.test(failure.deployedSha) ||
    typeof failure.disposition !== 'string' ||
    !failure.disposition ||
    typeof failure.error !== 'string' ||
    !failure.error
  ) {
    return undefined
  }
  return createHash('sha256')
    .update(JSON.stringify({
      buildResult: failure.buildResult,
      deployResult: failure.deployResult,
      deployedSha: failure.deployedSha,
      disposition: failure.disposition,
      error: failure.error,
      leaseReleased: failure.leaseReleased,
      mutationState: failure.mutationState,
      rollback: failure.rollback,
      status: failure.status,
    }))
    .digest('hex')
}

export function deploymentFailureReport(receipt, environment) {
  const runId = requiredEnvironment(environment, 'GITHUB_RUN_ID')
  const runAttempt = requiredEnvironment(environment, 'GITHUB_RUN_ATTEMPT')
  const githubSha = requiredEnvironment(environment, 'GITHUB_SHA')
  const runUrl = requiredEnvironment(environment, 'RUN_URL')
  const failure = selectedDeploymentFailure(receipt, environment)
  const signature = deploymentFailureSignature(failure)
  const runMarker =
    `<!-- ${DEPLOYMENT_FAILURE_RUN_MARKER_PREFIX}${runId}-${runAttempt} -->`
  const signatureMarker = signature
    ? `<!-- ${DEPLOYMENT_FAILURE_SIGNATURE_MARKER_PREFIX}${signature} -->`
    : ''
  return {
    body: [
      runMarker,
      ...(signatureMarker ? [signatureMarker] : []),
      '',
      '## Automated dashboard deployment failure',
      '',
      `The protected dashboard deployment workflow failed for \`${githubSha}\`.`,
      '',
      `**Workflow:** ${runUrl}`,
      '',
      '```json',
      JSON.stringify(failure, null, 2),
      '```',
      '',
      'Investigate the failure, repair repository-owned deployment behavior when appropriate, and retain the no-mutation and rollback safety boundaries.',
    ].join('\n'),
    failure,
    runMarker,
    signature,
    signatureMarker,
  }
}

export function readDeploymentReceipt(receiptPath) {
  if (!existsSync(receiptPath)) return {}
  try {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
      throw new Error('receipt root must be an object')
    }
    return receipt
  } catch (error) {
    return {
      error: `Deployment receipt could not be parsed: ${String(error).slice(0, 1000)}`,
      status: 'invalid-receipt',
    }
  }
}

export function writeDeploymentFailureReport(
  outputDirectory = 'deployment-failure',
  environment = process.env,
) {
  mkdirSync(outputDirectory, { recursive: true })
  const report = deploymentFailureReport(
    readDeploymentReceipt(resolve(outputDirectory, 'deployment-receipt.json')),
    environment,
  )
  writeFileSync(resolve(outputDirectory, 'issue-body.md'), report.body)
  writeFileSync(resolve(outputDirectory, 'run-marker.txt'), report.runMarker)
  writeFileSync(
    resolve(outputDirectory, 'signature-marker.txt'),
    report.signatureMarker,
  )
  return report
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  writeDeploymentFailureReport()
}
