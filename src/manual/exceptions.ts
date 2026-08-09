export interface ManualException {
  capabilityId: string
  expiresOn: string
  issue: string
  owner: string
  reason: string
}

export const MANUAL_EXCEPTIONS: ManualException[] = []
