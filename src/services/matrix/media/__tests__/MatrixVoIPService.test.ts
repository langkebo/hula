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
    localStorage.clear()
    // 音质偏好按 callId 缓存，测试间必须清空，否则 call-1 会复用上个用例的偏好
    ;(
      matrixVoIPService as unknown as { callAudioQualityPreferences?: Map<string, unknown> }
    ).callAudioQualityPreferences?.clear()
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

  type FakeTrack = MediaStreamTrack & { applyConstraints: ReturnType<typeof vi.fn> }

  function makeFakeTrack(kind: 'audio' | 'video'): FakeTrack {
    return {
      kind,
      applyConstraints: vi.fn().mockResolvedValue(undefined)
    } as unknown as FakeTrack
  }

  function feedOf(track: MediaStreamTrack, isLocal: boolean) {
    return { stream: { getTracks: () => [track] } as unknown as MediaStream, isLocal: () => isLocal }
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

  it('feeds_changed 应对本地音轨 applyConstraints 三个音质布尔，远端轨道不受影响', async () => {
    // 非默认值：证明约束真的来自已持久化的偏好，而不是硬编码的默认 true
    localStorage.setItem('tjg-echo-cancellation', 'false')
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    await matrixVoIPService.startCall('!room:example.com', { audio: true, video: false })
    const feedsHandler = mockCall.handlers.get('feeds_changed')

    const localAudio = makeFakeTrack('audio')
    const remoteAudio = makeFakeTrack('audio')
    feedsHandler?.([feedOf(localAudio, true), feedOf(remoteAudio, false)])

    expect(localAudio.applyConstraints).toHaveBeenCalledTimes(1)
    const applied = localAudio.applyConstraints.mock.calls[0]?.[0] as Record<string, unknown>
    // 精确断言：deviceId 不可变、volume 不是合法约束，混进来都会让整次调用 reject
    expect(Object.keys(applied).sort()).toEqual(['autoGainControl', 'echoCancellation', 'noiseSuppression'])
    expect(applied).toEqual({ echoCancellation: false, noiseSuppression: true, autoGainControl: true })
    expect(remoteAudio.applyConstraints).not.toHaveBeenCalled()
  })

  it('本地视频轨道不会被施加音频约束（视频轨道会 reject 整次调用）', async () => {
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    await matrixVoIPService.startCall('!room:example.com', { audio: true, video: true })
    const feedsHandler = mockCall.handlers.get('feeds_changed')

    const localVideo = makeFakeTrack('video')
    const localAudio = makeFakeTrack('audio')
    feedsHandler?.([
      { stream: { getTracks: () => [localVideo, localAudio] } as unknown as MediaStream, isLocal: () => true }
    ])

    // 同一 feed 里音频轨道必须被处理，才能证明"视频没被处理"不是因为整条路径没跑
    expect(localAudio.applyConstraints).toHaveBeenCalledTimes(1)
    expect(localVideo.applyConstraints).not.toHaveBeenCalled()
  })

  it('重复 feeds_changed 不重复施加约束，且偏好每通话只读一次', async () => {
    localStorage.setItem('tjg-echo-cancellation', 'false')
    const getItemSpy = vi.spyOn(localStorage, 'getItem')
    const mockCall = makeMockCall('call-1')
    vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient(mockCall))

    await matrixVoIPService.startCall('!room:example.com', { audio: true, video: false })
    const feedsHandler = mockCall.handlers.get('feeds_changed')

    const firstTrack = makeFakeTrack('audio')
    feedsHandler?.([feedOf(firstTrack, true)])
    const readsAfterFirstFeed = getItemSpy.mock.calls.length
    expect(readsAfterFirstFeed).toBeGreaterThan(0)

    // 同一轨道再次下发：不重复施加
    feedsHandler?.([feedOf(firstTrack, true)])
    expect(firstTrack.applyConstraints).toHaveBeenCalledTimes(1)

    // 通话中途改设置：新轨道仍沿用通话开始时读到的偏好，说明没有重新读
    localStorage.setItem('tjg-echo-cancellation', 'true')
    const secondTrack = makeFakeTrack('audio')
    feedsHandler?.([feedOf(secondTrack, true)])

    expect(secondTrack.applyConstraints).toHaveBeenCalledWith({
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true
    })
    expect(getItemSpy.mock.calls.length).toBe(readsAfterFirstFeed)
    getItemSpy.mockRestore()
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
