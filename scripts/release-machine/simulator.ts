import type { ReleasePlan, ReleaseStep } from './contracts'
import { sha256 } from './contracts'

export type SimulatedReceipt = {
  stepId: string
  status: 'accepted' | 'rejected' | 'abnormal'
  previousReceiptHash: string | null
  receiptHash: string
}

export type SimulationResult = {
  terminalStatus: 'accepted' | 'rejected' | 'abnormal'
  failedStep: string | null
  receipts: SimulatedReceipt[]
}

function appendReceipt(
  receipts: SimulatedReceipt[],
  step: ReleaseStep,
  status: SimulatedReceipt['status'],
) {
  const unsigned = {
    stepId: step.id,
    status,
    previousReceiptHash: receipts.at(-1)?.receiptHash ?? null,
  }
  receipts.push({ ...unsigned, receiptHash: sha256(unsigned) })
}

export function simulateRelease(
  plan: ReleasePlan,
  faultStep: string | null = null,
  secondaryFaultStep: string | null = null,
): SimulationResult {
  const receipts: SimulatedReceipt[] = []
  const normal = plan.steps.filter(
    (step) => !step.rollbackOnly && step.id !== 'cleanup-release',
  )
  const cleanup = plan.steps.find((step) => step.id === 'cleanup-release')
  if (!cleanup) throw new Error('Release plan requires cleanup')

  for (const step of normal) {
    if (step.id !== faultStep) {
      appendReceipt(receipts, step, 'accepted')
      continue
    }

    appendReceipt(receipts, step, 'rejected')
    let abnormal = false
    if (step.failure === 'rollback-git' || step.failure === 'rollback-production') {
      const rollback = plan.steps.find((candidate) => candidate.id === step.failure)
      if (!rollback) throw new Error(`Missing rollback step: ${step.failure}`)
      const rollbackStatus =
        rollback.id === secondaryFaultStep ? 'abnormal' : 'accepted'
      appendReceipt(
        receipts,
        rollback,
        rollbackStatus,
      )
      abnormal ||= rollbackStatus === 'abnormal'
    }
    const cleanupStatus =
      cleanup.id === secondaryFaultStep ? 'abnormal' : 'accepted'
    appendReceipt(
      receipts,
      cleanup,
      cleanupStatus,
    )
    abnormal ||= cleanupStatus === 'abnormal'
    return {
      terminalStatus: abnormal ? 'abnormal' : 'rejected',
      failedStep: step.id,
      receipts,
    }
  }

  appendReceipt(
    receipts,
    cleanup,
    cleanup.id === faultStep ? 'abnormal' : 'accepted',
  )
  return {
    terminalStatus: receipts.at(-1)?.status === 'accepted' ? 'accepted' : 'abnormal',
    failedStep: faultStep === cleanup.id ? cleanup.id : null,
    receipts,
  }
}

export function simulateFaultMatrix(plan: ReleasePlan) {
  const primary = [
    simulateRelease(plan),
    ...plan.steps
      .filter((step) => !step.rollbackOnly)
      .map((step) => simulateRelease(plan, step.id)),
  ]
  const rollbackFailures = plan.steps
    .filter((step) => step.rollbackOnly)
    .map((rollback) => {
      const trigger = plan.steps.find((step) => step.failure === rollback.id)
      if (!trigger) {
        throw new Error(`Rollback step ${rollback.id} has no triggering step`)
      }
      return simulateRelease(plan, trigger.id, rollback.id)
    })
  return [...primary, ...rollbackFailures]
}
