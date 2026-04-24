import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useScreenShare } from '../useScreenShare'

const makeTrack = (kind: 'video' | 'audio'): MediaStreamTrack => {
  const track: any = {
    kind,
    label: `mock-${kind}`,
    enabled: true,
    stop: vi.fn(),
    onended: null
  }
  return track as MediaStreamTrack
}

const makeStream = (tracks: MediaStreamTrack[] = []): MediaStream => {
  const live = [...tracks]
  const stream: any = {
    id: 'mock-stream',
    active: true,
    getTracks: vi.fn(() => live.slice()),
    getVideoTracks: vi.fn(() => live.filter((t) => t.kind === 'video')),
    getAudioTracks: vi.fn(() => live.filter((t) => t.kind === 'audio')),
    addTrack: vi.fn((t: MediaStreamTrack) => {
      live.push(t)
    }),
    removeTrack: vi.fn((t: MediaStreamTrack) => {
      const i = live.indexOf(t)
      if (i >= 0) live.splice(i, 1)
    })
  }
  return stream as MediaStream
}

const makeSender = (kind: 'video' | 'audio'): RTCRtpSender => {
  const s: any = {
    track: { kind } as MediaStreamTrack,
    replaceTrack: vi.fn()
  }
  return s as RTCRtpSender
}

const makePeer = (senders: RTCRtpSender[] = []): RTCPeerConnection => {
  const pc: any = {
    addTrack: vi.fn(),
    getSenders: vi.fn(() => senders.slice())
  }
  return pc as RTCPeerConnection
}

const setup = (
  opts: Partial<{
    callType: number | undefined
    selectedVideoDevice: string | null | undefined
    senders: RTCRtpSender[]
    initialStream: MediaStream | null
  }> = {}
) => {
  const localStream = ref<MediaStream | null>(
    opts.initialStream ?? makeStream([makeTrack('video'), makeTrack('audio')])
  )
  const peerConnection = ref<RTCPeerConnection | null>(makePeer(opts.senders ?? [makeSender('video')]))
  const selectedVideoDevice = ref<string | null | undefined>(
    'selectedVideoDevice' in opts ? opts.selectedVideoDevice : 'cam-1'
  )
  const getLocalStream = vi.fn()
  const switchVideoDevice = vi.fn()
  const notify = { warning: vi.fn(), error: vi.fn() }

  const hook = useScreenShare({
    localStream,
    peerConnection,
    selectedVideoDevice,
    getCurrentCallType: () => ('callType' in opts ? opts.callType : 1),
    getLocalStream,
    switchVideoDevice,
    notify
  })

  return { hook, localStream, peerConnection, selectedVideoDevice, getLocalStream, switchVideoDevice, notify }
}

describe('useScreenShare', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  describe('stopScreenShare', () => {
    it('returns false and is a no-op when not currently sharing', () => {
      const { hook, getLocalStream, switchVideoDevice } = setup()
      expect(hook.stopScreenShare()).toBe(false)
      expect(getLocalStream).not.toHaveBeenCalled()
      expect(switchVideoDevice).not.toHaveBeenCalled()
    })

    it('stops local tracks, restores normal stream and re-applies selected video device', () => {
      const { hook, localStream, getLocalStream, switchVideoDevice } = setup()
      hook.isScreenSharing.value = true
      const tracks = localStream.value!.getTracks()

      const ok = hook.stopScreenShare()

      expect(ok).toBe(true)
      expect(hook.isScreenSharing.value).toBe(false)
      tracks.forEach((t) => expect(t.stop).toHaveBeenCalled())
      expect(getLocalStream).toHaveBeenCalledWith(1)
      expect(switchVideoDevice).toHaveBeenCalledWith('cam-1')
    })

    it('returns false when there is no selected video device (cannot resume)', () => {
      const { hook, getLocalStream } = setup({ selectedVideoDevice: null })
      hook.isScreenSharing.value = true
      expect(hook.stopScreenShare()).toBe(false)
      expect(getLocalStream).not.toHaveBeenCalled()
    })

    it('returns false when current call type is unknown', () => {
      const { hook, getLocalStream } = setup({ callType: undefined })
      hook.isScreenSharing.value = true
      expect(hook.stopScreenShare()).toBe(false)
      expect(getLocalStream).not.toHaveBeenCalled()
    })
  })

  describe('startScreenShare', () => {
    it('warns when getDisplayMedia is unsupported and does not flip flag', async () => {
      vi.stubGlobal('navigator', { mediaDevices: {} })
      const { hook, notify } = setup()
      await hook.startScreenShare()
      expect(notify.warning).toHaveBeenCalledWith('当前设备不支持桌面共享功能！')
      expect(hook.isScreenSharing.value).toBe(false)
    })

    it('replaces video sender with new screen track and flips flag on success', async () => {
      const screenTrack = makeTrack('video')
      const screenStream = makeStream([screenTrack])
      vi.stubGlobal('navigator', {
        mediaDevices: { getDisplayMedia: vi.fn(async () => screenStream) }
      })
      const sender = makeSender('video')
      const { hook, peerConnection } = setup({ senders: [sender] })

      await hook.startScreenShare()

      expect(hook.isScreenSharing.value).toBe(true)
      expect(peerConnection.value!.addTrack).toHaveBeenCalled()
      expect(sender.replaceTrack).toHaveBeenCalledWith(screenTrack)
    })

    it('treats NotAllowedError as user cancel: warns and resets flag', async () => {
      const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
      vi.stubGlobal('navigator', {
        mediaDevices: { getDisplayMedia: vi.fn(async () => Promise.reject(err)) }
      })
      const { hook, notify } = setup()
      await hook.startScreenShare()
      expect(hook.isScreenSharing.value).toBe(false)
      expect(notify.warning).toHaveBeenCalledWith('已取消屏幕共享...')
      expect(notify.error).not.toHaveBeenCalled()
    })

    it('shows generic error toast on unknown failure', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: { getDisplayMedia: vi.fn(async () => Promise.reject(new Error('boom'))) }
      })
      const { hook, notify } = setup()
      await hook.startScreenShare()
      expect(hook.isScreenSharing.value).toBe(false)
      expect(notify.error).toHaveBeenCalledWith('桌面共享失败，请检查权限设置!')
    })

    it('errors when screenStream has no video track', async () => {
      const audioOnly = makeStream([makeTrack('audio')])
      vi.stubGlobal('navigator', {
        mediaDevices: { getDisplayMedia: vi.fn(async () => audioOnly) }
      })
      const { hook, notify } = setup()
      await hook.startScreenShare()
      expect(notify.error).toHaveBeenCalledWith('桌面共享失败，请检查权限设置!')
      expect(hook.isScreenSharing.value).toBe(false)
    })
  })
})
