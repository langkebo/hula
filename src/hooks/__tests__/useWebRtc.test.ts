import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { CallTypeEnum } from '@/enums'
import { useWebRtc } from '../useWebRtc'

type TimerTask = {
  id: number
  callback: () => void | Promise<void>
  delay: number
}

const {
  showFeedbackMock,
  addListenerMock,
  getDevicesMock,
  resetDevicesMock,
  loadIceServersMock,
  currentWindowMock,
  timerTasks,
  stopBellMock,
  startBellMock,
  pauseBellMock,
  playBellMock,
  startCallTimerMock,
  stopCallTimerMock,
  switchAudioDeviceMock,
  switchVideoDeviceMock,
  switchCameraFacingMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  addListenerMock: vi.fn(async () => {}),
  getDevicesMock: vi.fn(async () => true),
  resetDevicesMock: vi.fn(),
  loadIceServersMock: vi.fn(async () => {}),
  currentWindowMock: {
    isVisible: vi.fn(async () => true),
    show: vi.fn(async () => {}),
    isMinimized: vi.fn(async () => false),
    unminimize: vi.fn(async () => {}),
    setFocus: vi.fn(async () => {}),
    close: vi.fn(async () => {})
  },
  timerTasks: [] as TimerTask[],
  stopBellMock: vi.fn(),
  startBellMock: vi.fn(),
  pauseBellMock: vi.fn(),
  playBellMock: vi.fn(),
  startCallTimerMock: vi.fn(),
  stopCallTimerMock: vi.fn(),
  switchAudioDeviceMock: vi.fn(),
  switchVideoDeviceMock: vi.fn(),
  switchCameraFacingMock: vi.fn()
}))

const mediaDevicesState = {
  audioDevices: ref<MediaDeviceInfo[]>([]),
  videoDevices: ref<MediaDeviceInfo[]>([]),
  selectedAudioDevice: ref<string | null | undefined>(null),
  selectedVideoDevice: ref<string | null | undefined>(null)
}

const useCameraSwitchArgs: Array<Record<string, unknown>> = []
const useScreenShareArgs: Array<Record<string, unknown>> = []

vi.mock('vue-router', () => ({
  useRouter: () => ({
    back: vi.fn()
  })
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {})
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => currentWindowMock
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  error: vi.fn(),
  info: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      uid: '@me:example.com'
    }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/TimerManager', () => ({
  TimerManager: class MockTimerManager {
    setTimeout(callback: () => void | Promise<void>, delay: number) {
      const id = timerTasks.length + 1
      timerTasks.push({ id, callback, delay })
      return id
    }
    clearAll() {
      timerTasks.length = 0
    }
    clearTimeout(id: number) {
      const index = timerTasks.findIndex((task) => task.id === id)
      if (index >= 0) {
        timerTasks.splice(index, 1)
      }
    }
  }
}))

vi.mock('../useMitt', () => ({
  useMitt: {
    off: vi.fn()
  }
}))

vi.mock('../useTauriListener', () => ({
  useTauriListener: () => ({
    addListener: addListenerMock
  })
}))

vi.mock('../webRtc/iceServers', () => ({
  getIceConfiguration: () => ({}),
  loadIceServers: loadIceServersMock
}))

vi.mock('../webRtc/useCallBell', () => ({
  useCallBell: () => ({
    startBell: startBellMock,
    stopBell: stopBellMock,
    pauseBell: pauseBellMock,
    playBell: playBellMock
  })
}))

vi.mock('../webRtc/useCallTimer', () => ({
  useCallTimer: () => ({
    callDuration: ref(0),
    startCallTimer: startCallTimerMock,
    stopCallTimer: stopCallTimerMock
  })
}))

vi.mock('../webRtc/useCameraSwitch', () => ({
  useCameraSwitch: (options: Record<string, unknown>) => {
    useCameraSwitchArgs.push(options)
    return {
      switchAudioDevice: switchAudioDeviceMock,
      switchVideoDevice: switchVideoDeviceMock,
      switchCameraFacing: switchCameraFacingMock
    }
  }
}))

vi.mock('../webRtc/useMediaDevices', () => ({
  useMediaDevices: () => ({
    audioDevices: mediaDevicesState.audioDevices,
    videoDevices: mediaDevicesState.videoDevices,
    selectedAudioDevice: mediaDevicesState.selectedAudioDevice,
    selectedVideoDevice: mediaDevicesState.selectedVideoDevice,
    getDevices: getDevicesMock,
    resetDevices: resetDevicesMock
  })
}))

vi.mock('../webRtc/useScreenShare', () => ({
  useScreenShare: (options: Record<string, unknown>) => {
    useScreenShareArgs.push(options)
    return {
      isScreenSharing: ref(false),
      startScreenShare: vi.fn(),
      stopScreenShare: vi.fn()
    }
  }
}))

vi.mock('../utils/PlatformConstants', () => ({
  isMobile: () => false
}))

const makeTrack = (kind: 'audio' | 'video', stopImpl?: () => void): MediaStreamTrack =>
  ({
    kind,
    label: `${kind}-track`,
    enabled: true,
    muted: false,
    readyState: 'live',
    stop: vi.fn(stopImpl)
  }) as unknown as MediaStreamTrack

const makeStream = (tracks: MediaStreamTrack[]): MediaStream => {
  const live = [...tracks]
  return {
    id: 'stream-1',
    active: true,
    getTracks: vi.fn(() => live),
    getAudioTracks: vi.fn(() => live.filter((track) => track.kind === 'audio')),
    getVideoTracks: vi.fn(() => live.filter((track) => track.kind === 'video')),
    addTrack: vi.fn((track: MediaStreamTrack) => live.push(track)),
    removeTrack: vi.fn((track: MediaStreamTrack) => {
      const index = live.indexOf(track)
      if (index >= 0) live.splice(index, 1)
    })
  } as unknown as MediaStream
}

class MockRTCPeerConnection {
  connectionState: RTCPeerConnectionState = 'new'
  ontrack: ((event: RTCTrackEvent) => void) | null = null
  onconnectionstatechange: ((event: Event) => void) | null = null
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null

  createDataChannel() {
    return {
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
      close: vi.fn()
    } as unknown as RTCDataChannel
  }

  addTrack = vi.fn()
  getSenders = vi.fn(() => [])
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'mock-offer' }))
  setLocalDescription = vi.fn(async () => {})
  setRemoteDescription = vi.fn(async () => {})
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'mock-answer' }))
  addIceCandidate = vi.fn(async () => {})
  close = vi.fn()
}

const mountComposable = (overrides?: Partial<{ isReceiver: boolean; callType: CallTypeEnum }>) => {
  let api!: ReturnType<typeof useWebRtc>

  const Comp = defineComponent({
    setup() {
      api = useWebRtc(
        '!room:example.com',
        '@remote:example.com',
        overrides?.callType ?? CallTypeEnum.VIDEO,
        overrides?.isReceiver ?? true
      )
      return () => null
    }
  })

  const wrapper = mount(Comp)
  return { api, wrapper }
}

describe('useWebRtc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection as unknown as typeof RTCPeerConnection)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => makeStream([makeTrack('audio'), makeTrack('video')])),
        enumerateDevices: vi.fn(async () => [])
      }
    })
    mediaDevicesState.audioDevices.value = []
    mediaDevicesState.videoDevices.value = []
    mediaDevicesState.selectedAudioDevice.value = 'mic-1'
    mediaDevicesState.selectedVideoDevice.value = 'cam-1'
    timerTasks.length = 0
    useCameraSwitchArgs.length = 0
    useScreenShareArgs.length = 0
    getDevicesMock.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('无可用设备时在 getLocalStream 中播报 error', async () => {
    const { api } = mountComposable()

    const result = await api.getLocalStream(CallTypeEnum.VIDEO)

    expect(result).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.webrtc.no_device', 'error')
  })

  it('获取设备失败时 startCall 播报 error', async () => {
    getDevicesMock.mockResolvedValue(false)
    const { api } = mountComposable()

    await api.startCall('!room:example.com', CallTypeEnum.VIDEO)

    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.webrtc.get_devices_failed', 'error')
  })

  it('通话超时时播报 warning', async () => {
    mediaDevicesState.audioDevices.value = [
      { deviceId: 'mic-1', kind: 'audioinput', label: 'Mic', groupId: '' } as MediaDeviceInfo
    ]
    const { api } = mountComposable({ callType: CallTypeEnum.AUDIO })

    await api.startCall('!room:example.com', CallTypeEnum.AUDIO)
    const timeoutTask = timerTasks.find((task) => task.delay === 30000)
    expect(timeoutTask).toBeDefined()

    await timeoutTask?.callback()

    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.webrtc.call_timeout', 'warning')
  })

  it('重新获取视频轨道失败时在 toggleVideo 中播报 error', async () => {
    mediaDevicesState.videoDevices.value = [
      { deviceId: 'cam-1', kind: 'videoinput', label: 'Cam', groupId: '' } as MediaDeviceInfo
    ]
    const getUserMediaMock = vi.fn(async () => Promise.reject(new Error('camera denied')))
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: getUserMediaMock,
        enumerateDevices: vi.fn(async () => [])
      }
    })
    const { api } = mountComposable()
    api.localStream.value = makeStream([makeTrack('audio')])
    api.peerConnection.value = new MockRTCPeerConnection() as unknown as RTCPeerConnection

    await api.toggleVideo()

    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.webrtc.camera_failed', 'error')
  })

  it('清理资源失败时播报 error', async () => {
    const { api } = mountComposable()
    api.localStream.value = makeStream([
      makeTrack('audio', () => {
        throw new Error('stop failed')
      })
    ])

    await api.handleCallResponse(0)

    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.webrtc.cleanup_failed', 'error')
  })
})
