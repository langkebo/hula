type TjgAppReadyPhase = 'booting' | 'mounted' | 'router-ready'

type TjgAppReadyWindow = Window & {
  __TJG_APP_READY__?: boolean
  __TJG_APP_READY_PHASE__?: TjgAppReadyPhase
}

let currentPhase: TjgAppReadyPhase = 'booting'

function getReadyWindow(): TjgAppReadyWindow | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window as TjgAppReadyWindow
}

export function markTjgAppReady(phase: TjgAppReadyPhase = 'router-ready'): TjgAppReadyPhase {
  currentPhase = phase
  const readyWindow = getReadyWindow()
  if (readyWindow) {
    readyWindow.__TJG_APP_READY__ = phase === 'router-ready'
    readyWindow.__TJG_APP_READY_PHASE__ = phase
  }
  return currentPhase
}

export function getTjgAppReadyPhase(): TjgAppReadyPhase {
  const readyWindow = getReadyWindow()
  return readyWindow?.__TJG_APP_READY_PHASE__ ?? currentPhase
}

export function isTjgAppReady(): boolean {
  const readyWindow = getReadyWindow()
  return readyWindow?.__TJG_APP_READY__ ?? currentPhase === 'router-ready'
}

export function resetTjgAppReadyForTests(): void {
  currentPhase = 'booting'
  const readyWindow = getReadyWindow()
  if (readyWindow) {
    delete readyWindow.__TJG_APP_READY__
    delete readyWindow.__TJG_APP_READY_PHASE__
  }
}
