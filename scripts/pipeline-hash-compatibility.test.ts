// @covers .github/skills/house-style-copy/scripts/lib.mjs
// @covers .github/evals/pipeline-hash-compatibility.json
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { routedPipelineContractHash }
  from '../.github/skills/house-style-copy/scripts/lib.mjs'
import { describe, expect, it } from 'vitest'

type CompatibilityVector = {
  id: string
  opportunityId: string
  expectedHash: string
}

type CompatibilityArtifact = {
  version: number
  canonicalContract: string
  project: string
  vectors: CompatibilityVector[]
}

type Opportunity = {
  id: string
} & Record<string, unknown>

type OpportunityPolicy = {
  project: string
  opportunities: Opportunity[]
}

type ToolRegistry = Record<string, unknown>

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')) as T
}

describe('pipeline hash compatibility artifact', () => {
  it('keeps checked-in vectors aligned with the routed local implementation', () => {
    const artifact = readJson<CompatibilityArtifact>(
      '.github/evals/pipeline-hash-compatibility.json',
    )
    const policy = readJson<OpportunityPolicy>(
      '.github/agent-opportunities.json',
    )
    const registry = readJson<ToolRegistry>(
      '.github/agent-tools.json',
    )

    expect(artifact.version).toBe(1)
    expect(artifact.canonicalContract).toBe('team-pipeline/pipeline-contract-hash@v1')
    expect(artifact.project).toBe(policy.project)
    expect(artifact.vectors.length).toBeGreaterThan(0)

    for (const vector of artifact.vectors) {
      const opportunity = policy.opportunities.find((item) => item.id === vector.opportunityId)
      expect(opportunity, vector.id).toBeDefined()
      expect(routedPipelineContractHash(artifact.project, opportunity!, registry))
        .toBe(vector.expectedHash)
    }
  })
})
