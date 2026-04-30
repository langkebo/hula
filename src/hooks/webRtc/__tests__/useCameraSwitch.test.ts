import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useCameraSwitch } from '../useCameraSwitch'

const makeTrack = (kind: 'video' | 'audio'): MediaStreamTrack => {
  const t: any = { kind, label: `mock-${kind}`, enabled: true, stop: vi.fn() }
  return t as MediaStreamTrack
}

const makeStream = (tracks: MediaStreamTrack[] = []): MediaStream => {
  const live = [...tracks]
  const s: any = {
    getTracks: vi.fn(() => live.slice()),
    getVideoTracks: vi.fn(() => live.filter((x) => x.kind === 'video')),
    getAudioTracks: vi.fn(() => live.filter((x) => x.kind === 'audio')),
    addTrack: vi.fn((t: MediaStreamTrack) => {
      live.push(t)
    }),
    removeTrack: vi.fn((t: MediaStreamTrack) => {
      const i = live.indexOf(t)
      if (i >= 0) live.splice(i, 1)
    })
  }
  return s as MediaStream
}

const makeSender = (kind: 'video' | 'audio'): RTCRtpSender => {
  const s: any = { track: { kind } as MediaStreamTrack, replaceTrack: vi.fn() }
  return s as RTCRtpSender
}

const makePeer = (senders: RTCRtpSender[] = []): RTCPeerConnection => {
  const pc: any = { addTrack: vi.fn(), getSenders: vi.fn(() => senders.slice()) }
  return pc as RTCPeerConnection
}

const setup = (
  opts: Partial<{
    isVideoCall: boolean
    isMobile: boolean
    initialAudio: string | null
    initialVideo: string | null
    videoDevices: MediaDeviceInfo[]
    senders: RTCRtpSender[]
    localTracks: MediaStreamTrack[]
  }> = {}
) => {
  const localStream = ref<MediaStream | null>(makeStream(opts.localTracks ?? [makeTrack('video'), makeTrack('audio')]))
  const peerConnection = ref<RTCPeerConnection | null>(makePeer(opts.senders ?? []))
  const selectedAudioDevice = ref<string | null | undefined>(opts.initialAudio ?? 'mic-1')
  const selectedVideoDevice = ref<string | null | undefined>(opts.initialVideo ?? 'cam-1')
  const videoDevices = ref<MediaDeviceInfo[]>(opts.videoDevices ?? [])
  const notify = { error: vi.fn() }

  const hook = useCameraSwitch({
    localStream,
    peerConnection,
    selectedAudioDevice,
    selectedVideoDevice,
    videoDevices,
    isVideoCall: () => opts.isVideoCall ?? true,
    isMobile: () => opts.isMobile ?? false,
    notify
  })

  return { hook, localStream, peerConnection, selectedAudioDevice, selectedVideoDevice, videoDevices, notify }
}

describe('useCameraSwitch', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  describe('switchAudioDevice', () => {
    it('updates selectedAudioDevice and replaces sender track', async () => {
      const newAudio = makeTrack('audio')
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([newAudio])) }
      })
      const sender = makeSender('audio')
      const { hook, selectedAudioDevice } = setup({ senders: [sender] })

      await hook.switchAudioDevice('mic-2')

      expect(selectedAudioDevice.value).toBe('mic-2')
      expect(sender.replaceTrack).toHaveBeenCalledWith(newAudio)
    })

    it('errors via notify when getUserMedia returns no audio track', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([])) }
      })
      const { hook, notify } = setup()
      await hook.switchAudioDevice('mic-2')
      expect(notify.error).toHaveBeenCalledWith('切换设备不存在或不支持，请重新选择！')
    })

    it('catches getUserMedia rejection and surfaces a generic error', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => Promise.reject(new Error('denied'))) }
      })
      const { hook, notify } = setup()
      await hook.switchAudioDevice('mic-2')
      expect(notify.error).toHaveBeenCalledWith('切换音频设备失败！')
    })
  })

  describe('switchVideoDevice', () => {
    it('updates selectedVideoDevice and replaces sender track', async () => {
      const newVideo = makeTrack('video')
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([newVideo])) }
      })
      const sender = makeSender('video')
      const { hook, selectedVideoDevice } = setup({ senders: [sender] })

      await hook.switchVideoDevice('cam-2')

      expect(selectedVideoDevice.value).toBe('cam-2')
      expect(sender.replaceTrack).toHaveBeenCalledWith(newVideo)
    })

    it('skips when local stream has no video tracks', async () => {
      const getUserMedia = vi.fn()
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
      const { hook, selectedVideoDevice } = setup({ localTracks: [makeTrack('audio')] })

      await hook.switchVideoDevice('cam-2')

      expect(selectedVideoDevice.value).toBe('cam-2')
      expect(getUserMedia).not.toHaveBeenCalled()
    })

    it('adds track when no existing video track on stream', async () => {
      const newVideo = makeTrack('video')
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([newVideo])) }
      })
      const { hook, localStream, peerConnection } = setup({
        localTracks: [makeTrack('video'), makeTrack('audio')]
      })
      // simulate "no existing video track" by stubbing the local getter
      ;(localStream.value!.getVideoTracks as any) = vi
        .fn()
        // first call inside `if (length === 0)` guard returns 1 to bypass
        .mockReturnValueOnce([{ kind: 'video' }])
        // second call inside body returns []
        .mockReturnValueOnce([])

      await hook.switchVideoDevice('cam-2')

      expect(localStream.value!.addTrack).toHaveBeenCalledWith(newVideo)
      expect(peerConnection.value!.addTrack).toHaveBeenCalledWith(newVideo, localStream.value!)
    })
  })

  describe('switchCameraFacing', () => {
    it('is a no-op on desktop', async () => {
      const getUserMedia = vi.fn()
      vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
      const { hook } = setup({ isMobile: false })
      await hook.switchCameraFacing()
      expect(getUserMedia).not.toHaveBeenCalled()
    })

    it('falls back to switchVideoDevice("user") when front/back cannot be detected', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([makeTrack('video')])) }
      })
      const { hook, selectedVideoDevice } = setup({ isMobile: true, videoDevices: [] })
      await hook.switchCameraFacing()
      expect(selectedVideoDevice.value).toBe('user')
    })

    it('toggles to back camera when currently on front', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([makeTrack('video')])) }
      })
      const devices: MediaDeviceInfo[] = [
        { deviceId: 'front-1', label: 'Front Camera', kind: 'videoinput', groupId: '' } as any,
        { deviceId: 'back-1', label: 'Back Camera', kind: 'videoinput', groupId: '' } as any
      ]
      const { hook, selectedVideoDevice } = setup({
        isMobile: true,
        videoDevices: devices,
        initialVideo: 'front-1'
      })
      await hook.switchCameraFacing()
      expect(selectedVideoDevice.value).toBe('back-1')
    })

    it('toggles to front camera when not currently on front', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: { getUserMedia: vi.fn(async () => makeStream([makeTrack('video')])) }
      })
      const devices: MediaDeviceInfo[] = [
        { deviceId: 'front-1', label: '前置摄像头', kind: 'videoinput', groupId: '' } as any,
        { deviceId: 'back-1', label: '后置摄像头', kind: 'videoinput', groupId: '' } as any
      ]
      const { hook, selectedVideoDevice } = setup({
        isMobile: true,
        videoDevices: devices,
        initialVideo: 'back-1'
      })
      await hook.switchCameraFacing()
      expect(selectedVideoDevice.value).toBe('front-1')
    })
  })

  describe('getFrontAndBackCameras', () => {
    it('matches by english/chinese/facing keywords case-insensitively', () => {
      const devices: MediaDeviceInfo[] = [
        { deviceId: 'a', label: 'USER Front', kind: 'videoinput', groupId: '' } as any,
        { deviceId: 'b', label: 'environment cam', kind: 'videoinput', groupId: '' } as any
      ]
      const { hook } = setup({ videoDevices: devices })
      const { frontCamera, backCamera } = hook.getFrontAndBackCameras()
      expect(frontCamera?.deviceId).toBe('a')
      expect(backCamera?.deviceId).toBe('b')
    })

    it('returns undefined for both when no devices match', () => {
      const devices: MediaDeviceInfo[] = [
        { deviceId: 'x', label: 'Webcam Pro', kind: 'videoinput', groupId: '' } as any
      ]
      const { hook } = setup({ videoDevices: devices })
      const { frontCamera, backCamera } = hook.getFrontAndBackCameras()
      expect(frontCamera).toBeUndefined()
      expect(backCamera).toBeUndefined()
    })
  })
})
