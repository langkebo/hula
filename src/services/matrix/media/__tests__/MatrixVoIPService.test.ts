import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import matrixClientService from '../../MatrixClientService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { matrixVoIPService } = await import('../MatrixVoIPService')

describe('MatrixVoIPService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    ;(matrixVoIPService as unknown as { calls: Map<string, unknown> }).calls.clear()
    ;(matrixVoIPService as unknown as { callHandlers: Map<string, unknown> }).callHandlers.clear()
    ;(matrixVoIPService as unknown as { callMediaState: Map<string, unknown> }).callMediaState.clear()
    ;(matrixVoIPService as unknown as { screenStream: unknown }).screenStream = null
    ;(matrixVoIPService as unknown as { observedClient: unknown }).observedClient = null
  })

  it('rebinds call listeners and clears runtime calls when matrix client changes', async () => {
    const oldListeners = new Map<string, (...args: unknown[]) => void>()
    const newListeners = new Map<string, (...args: unknown[]) => void>()
    const oldClient = {
      callEventHandler: {},
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        oldListeners.set(event, handler)
      }),
      off: vi.fn((event: string) => {
        oldListeners.delete(event)
      })
    }
    const newClient = {
      callEventHandler: {},
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        newListeners.set(event, handler)
      }),
      off: vi.fn((event: string) => {
        newListeners.delete(event)
      })
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue(oldClient as unknown as MatrixClient)
    await matrixVoIPService.initialize()

    oldListeners.get('Call.incoming')?.({
      callId: 'old-call',
      roomId: '!old:example.com',
      isVideo: false
    })

    expect(matrixVoIPService.getActiveCalls()).toHaveLength(1)

    vi.mocked(matrixClientService.getClient).mockReturnValue(newClient as unknown as MatrixClient)
    await matrixVoIPService.initialize()

    expect(oldClient.off).toHaveBeenCalledWith('Call.incoming', expect.any(Function))
    expect(oldClient.off).toHaveBeenCalledWith('Call.hangup', expect.any(Function))
    expect(oldClient.off).toHaveBeenCalledWith('Call.replaced', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('Call.incoming', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('Call.hangup', expect.any(Function))
    expect(newClient.on).toHaveBeenCalledWith('Call.replaced', expect.any(Function))
    expect(matrixVoIPService.getActiveCalls()).toEqual([])
  })
})

describe('MatrixVoIPService media layer (SDK v40 契约)', () => {
  beforeEach(() => {
    // 测试环境缺少真实 MediaStream 实现，提供最小桩以支持 new MediaStream().getTracks()/addTrack()
    class FakeMediaStream {
      private tracks: MediaStreamTrack[] = []
      getTracks(): MediaStreamTrack[] {
        return this.tracks
      }
      addTrack(track: MediaStreamTrack): void {
        this.tracks.push(track)
      }
    }
    vi.stubGlobal('MediaStream', FakeMediaStream)
  })

  function makeMockCall(callId: string) {
    const handlers = new Map<string, (...args: unknown[]) => void>()
    return {
      callId,
      roomId: '!room:example.com',
      isVideo: true,
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        handlers.set(event, cb)
      }),
      off: vi.fn(),
      hangup: vi.fn(),
      answer: vi.fn().mockResolvedValue(undefined),
      placeCall: vi.fn().mockResolvedValue(undefined),
      setLocalVideoMuted: vi.fn().mockResolvedValue(true),
      setMicrophoneMuted: vi.fn().mockResolvedValue(true),
      setScreensharingEnabled: vi.fn().mockResolvedValue(true),
      peerConn: undefined,
      handlers
    }
  }

  function makeClient(mockCall: ReturnType<typeof makeMockCall> | null) {
    const callsMap = new Map<string, unknown>()
    if (mockCall) callsMap.set(mockCall.callId, mockCall)
    return {
      createCall: vi.fn(() => mockCall),
      callEventHandler: { calls: callsMap }
    } as unknown as MatrixClient
  }

  it('startCall 应通过 placeCall(audio, video) 触发 SDK 采集，而非传入 MediaStream', async () => {
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    const id = await matrixVoIPService.startCall('!room:example.com', { audio: true, video: true })

    expect(id).toBe('call-1')
    expect(mockCall.placeCall).toHaveBeenCalledTimes(1)
    expect(mockCall.placeCall).toHaveBeenCalledWith(true, true)
    // 守卫：首参必须是布尔，绝不能把本地 MediaStream 当 audio 布尔传入
    const firstArg = mockCall.placeCall.mock.calls[0]?.[0]
    expect(typeof firstArg).toBe('boolean')
  })

  it('answerCall 应通过 answer(audio, video) 触发 SDK 采集', async () => {
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    await matrixVoIPService.answerCall('call-1', { audio: true, video: false })

    expect(mockCall.answer).toHaveBeenCalledTimes(1)
    expect(mockCall.answer).toHaveBeenCalledWith(true, false)
  })

  it('feeds_changed 应按 isLocal() 拆分本地预览流与远端流', async () => {
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    await matrixVoIPService.startCall('!room:example.com', { audio: true, video: true })
    const feedsHandler = mockCall.handlers.get('feeds_changed')
    expect(feedsHandler).toBeTypeOf('function')

    const localTrack = {} as MediaStreamTrack
    const remoteTrack = {} as MediaStreamTrack
    feedsHandler?.([
      { stream: { getTracks: () => [localTrack] } as unknown as MediaStream, isLocal: () => true },
      { stream: { getTracks: () => [remoteTrack] } as unknown as MediaStream, isLocal: () => false }
    ])

    const info = matrixVoIPService.getCall('call-1')
    expect(info?.localStream?.getTracks()).toHaveLength(1)
    expect(info?.remoteStream?.getTracks()).toHaveLength(1)
    expect(info?.localStream?.getTracks()[0]).toBe(localTrack)
    expect(info?.remoteStream?.getTracks()[0]).toBe(remoteTrack)
  })

  it('toggleMute 应通过 setMicrophoneMuted 作用在真实发送轨道并返回新状态', async () => {
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    const muted = await matrixVoIPService.toggleMute('call-1')
    expect(mockCall.setMicrophoneMuted).toHaveBeenCalledWith(true)
    expect(muted).toBe(true)

    const unmuted = await matrixVoIPService.toggleMute('call-1')
    expect(mockCall.setMicrophoneMuted).toHaveBeenCalledWith(false)
    expect(unmuted).toBe(false)
  })

  it('toggleVideo 应通过 setLocalVideoMuted 作用在真实发送轨道', async () => {
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    const on = await matrixVoIPService.toggleVideo('call-1')
    expect(mockCall.setLocalVideoMuted).toHaveBeenCalledWith(true)
    expect(on).toBe(true)
  })
})
