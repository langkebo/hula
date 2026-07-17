import { beforeEach, describe, expect, it, vi } from 'vitest'

const { voipMock, showFeedbackMock } = vi.hoisted(() => ({
  voipMock: {
    startCall: vi.fn(),
    answerCall: vi.fn(),
    hangupCall: vi.fn(),
    rejectCall: vi.fn(),
    toggleMute: vi.fn(),
    toggleVideo: vi.fn(),
    toggleSpeaker: vi.fn(),
    startScreenshare: vi.fn(),
    stopScreenshare: vi.fn(),
    onCallUpdate: vi.fn(() => () => {})
  },
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: voipMock
}))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

import { useVoIPCallFlow } from '../useVoIPCallFlow'

describe('useVoIPCallFlow concurrent protection', () => {
  beforeEach(() => {
    voipMock.startCall.mockReset()
    voipMock.hangupCall.mockReset()
    voipMock.onCallUpdate.mockClear()
  })

  it('startCall double-click only initiates one call', async () => {
    let resolveCall!: (v: string) => void
    voipMock.startCall.mockImplementation(() => new Promise<string>((r) => (resolveCall = r)))
    const flow = useVoIPCallFlow()

    const first = flow.startCall('!room:hs', { audio: true, video: false })
    const second = flow.startCall('!room:hs', { audio: true, video: false })
    resolveCall('c1')
    await Promise.all([first, second])

    expect(voipMock.startCall).toHaveBeenCalledTimes(1)
  })

  it('snapshot in hangup protects call state when callId changes during hangup', async () => {
    voipMock.startCall.mockResolvedValue('c1')
    let resolveHangup!: () => void
    voipMock.hangupCall.mockImplementation(() => new Promise<void>((r) => (resolveHangup = r)))
    const flow = useVoIPCallFlow()

    await flow.startCall('!room:hs', { audio: true, video: false })
    const hanging = flow.hangup()

    // Simulate a concurrent redial by changing callId during hangup
    flow.callId.value = 'c2'

    resolveHangup()
    await hanging

    // Old hangup must not clear state because the snapshot no longer matches
    expect(flow.callId.value).toBe('c2')
  })
})
