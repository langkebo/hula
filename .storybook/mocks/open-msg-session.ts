import { completeStorybookPerfSample } from '../perf'

type OpenMsgSessionCall = {
  roomId: string
  completedAt: number
}

declare global {
  interface Window {
    __HULA_OPEN_MSG_SESSION_CALLS__?: OpenMsgSessionCall[]
  }
}

let latencyMs = 24

const ensureCalls = () => {
  if (typeof window === 'undefined') return []
  window.__HULA_OPEN_MSG_SESSION_CALLS__ ??= []
  return window.__HULA_OPEN_MSG_SESSION_CALLS__
}

export const resetOpenMsgSessionMock = () => {
  if (typeof window !== 'undefined') {
    window.__HULA_OPEN_MSG_SESSION_CALLS__ = []
  }
  latencyMs = 24
}

export const configureOpenMsgSessionMock = (options: { latencyMs?: number } = {}) => {
  latencyMs = options.latencyMs ?? 24
}

export const openMsgSessionByRoomId = async (roomId: string) => {
  await new Promise<void>((resolve: () => void) => window.setTimeout(resolve, latencyMs))
  const completedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  ensureCalls().push({ roomId, completedAt })
  completeStorybookPerfSample('ui-friend-request-jump')
}

export const openMsgSession = async () => {
  await new Promise<void>((resolve: () => void) => window.setTimeout(resolve, latencyMs))
}
