type HulaAppReadyPhase = 'booting' | 'mounted' | 'router-ready'

type HulaAppReadyWindow = Window & {
  __HULA_APP_READY__?: boolean
  __HULA_APP_READY_PHASE__?: HulaAppReadyPhase
}

let currentPhase: HulaAppReadyPhase = 'booting'

function getReadyWindow(): HulaAppReadyWindow | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window as HulaAppReadyWindow
}

export function markHulaAppReady(phase: HulaAppReadyPhase = 'router-ready'): HulaAppReadyPhase {
  currentPhase = phase
  const readyWindow = getReadyWindow()
  if (readyWindow) {
    readyWindow.__HULA_APP_READY__ = phase === 'router-ready'
    readyWindow.__HULA_APP_READY_PHASE__ = phase
  }
  return currentPhase
}

export function getHulaAppReadyPhase(): HulaAppReadyPhase {
  const readyWindow = getReadyWindow()
  return readyWindow?.__HULA_APP_READY_PHASE__ ?? currentPhase
}

export function isHulaAppReady(): boolean {
  const readyWindow = getReadyWindow()
  return readyWindow?.__HULA_APP_READY__ ?? currentPhase === 'router-ready'
}

export function resetHulaAppReadyForTests(): void {
  currentPhase = 'booting'
  const readyWindow = getReadyWindow()
  if (readyWindow) {
    delete readyWindow.__HULA_APP_READY__
    delete readyWindow.__HULA_APP_READY_PHASE__
  }
}
