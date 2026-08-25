import { hassConnectOptions, usesInheritedHassConnection } from './hassConnectionOptions'

function embeddedWindow(withConnection: boolean) {
  const topWindow = { hassConnection: withConnection ? Promise.resolve({}) : undefined }
  return { top: topWindow } as unknown as Window
}

describe('HAKit connection options', () => {
  it('leaves standalone connection suspension unchanged', () => {
    expect(usesInheritedHassConnection(window)).toBe(false)
    expect(hassConnectOptions(window)).toBeUndefined()
  })

  it('lets Home Assistant exclusively manage an inherited connection', () => {
    const currentWindow = embeddedWindow(true)

    expect(usesInheritedHassConnection(currentWindow)).toBe(true)
    expect(hassConnectOptions(currentWindow)).toEqual({
      handleResumeOptions: {
        suspendWhenHidden: false,
      },
    })
  })

  it('does not disable suspension for an iframe without an inherited connection', () => {
    expect(usesInheritedHassConnection(embeddedWindow(false))).toBe(false)
  })
})
