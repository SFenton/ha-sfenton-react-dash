export function usesInheritedHassConnection(currentWindow: Window = window) {
  try {
    const topWindow = currentWindow.top
    return Boolean(topWindow && topWindow !== currentWindow && topWindow.hassConnection)
  } catch {
    return false
  }
}

export function hassConnectOptions(currentWindow: Window = window) {
  if (!usesInheritedHassConnection(currentWindow)) return undefined

  return {
    handleResumeOptions: {
      suspendWhenHidden: false,
    },
  }
}
