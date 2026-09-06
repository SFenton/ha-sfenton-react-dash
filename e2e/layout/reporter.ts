import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError, TestResult } from '@playwright/test/reporter'
import type { Checkpoint, CollectedTest, ExecutionLedger, RunIdentity } from './types'
import { readJson, writeJson } from '../../scripts/layout/shared'

export default class LayoutReporter implements Reporter {
  private root = ''
  private run?: RunIdentity
  private ledger?: ExecutionLedger

  onBegin(config: FullConfig, suite: Suite) {
    this.root = process.env.LAYOUT_RUN_DIR ?? ''
    if (!this.root) throw new Error('Layout reporter requires a declared run directory')
    this.run = readJson<RunIdentity>(resolve(this.root, 'run.json'))
    const selected: CollectedTest[] = suite.allTests().map((test) => {
      const titlePath = [test.title]
      let parent = test.parent
      while (parent.type === 'describe') {
        titlePath.unshift(parent.title)
        parent = parent.parent!
      }
      return {
        id: test.id, file: relative(config.rootDir, test.location.file).replaceAll('\\', '/'),
        project: test.parent.project()!.name, titlePath,
        scenario: test.annotations.find((annotation) => annotation.type === 'layout-scenario')?.description,
      }
    })
    if (process.env.LAYOUT_COLLECTION_ONLY === '1') {
      writeJson(resolve(this.root, 'registered.json'), selected)
      return
    }
    this.ledger = {
      version: 1, runId: this.run.runId, planId: this.run.planId,
      sourceDigest: this.run.source.digest, selected, attempts: [], errors: [],
      status: 'running', complete: false,
    }
    this.save()
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!this.ledger) return
    const checkpoints: Checkpoint[] = []
    for (const attachment of result.attachments.filter((entry) => entry.name === 'layout-checkpoint')) {
      try {
        const content = attachment.body ?? (attachment.path ? readFileSync(attachment.path) : null)
        if (!content) throw new Error('Empty checkpoint attachment')
        checkpoints.push(JSON.parse(content.toString()) as Checkpoint)
      } catch (error) { this.ledger.errors.push(`Checkpoint decoding failed: ${String(error)}`) }
    }
    this.ledger.attempts.push({
      testId: test.id, expectedStatus: test.expectedStatus, status: result.status,
      retry: result.retry, workerIndex: result.workerIndex,
      annotations: result.annotations, checkpoints,
    })
    this.save()
  }

  onError(error: TestError) {
    this.ledger?.errors.push(error.message ?? error.value ?? 'Unknown runner error')
    this.save()
  }

  onEnd(result: FullResult) {
    if (!this.ledger) return
    this.ledger.status = result.status
    this.ledger.complete = true
    this.save()
  }

  private save() {
    if (this.ledger) writeJson(resolve(this.root, 'execution.json'), this.ledger)
  }
}
