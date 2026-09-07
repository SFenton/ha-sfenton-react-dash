export interface LayoutMockController {
  calls: Record<string, unknown>[]
  clearWeatherForecasts: () => void
  reset: () => void
  setEntityState: (entityId: string, state: string) => void
  setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
  setCallServiceOutcome: (domain: string, service: string, outcome: 'pending' | 'reject' | 'resolve') => void
}

declare global {
  interface Window {
    __mockHass?: LayoutMockController
  }
}
