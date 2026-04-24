import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

const { useMediaDevices } = await import('../useMediaDevices')

const makeDevice = (kind: MediaDeviceKind, deviceId: string, label = deviceId): MediaDeviceInfo =>
  ({ kind, deviceId, label, groupId: 'g' }) as MediaDeviceInfo

const fakeStream = () =>
  ({
    getTracks: () => [{ stop: vi.fn() }, { stop: vi.fn() }]
  }) as unknown as MediaStream

describe('useMediaDevices', () => {
  let getUserMedia: ReturnType<typeof vi.fn>
  let enumerateDevices: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMedia = vi.fn().mockResolvedValue(fakeStream())
    enumerateDevices = vi.fn().mockResolvedValue([])
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('starts with empty lists and null selections', () => {
    const d = useMediaDevices()
    expect(d.audioDevices.value).toEqual([])
    expect(d.videoDevices.value).toEqual([])
    expect(d.selectedAudioDevice.value).toBeNull()
    expect(d.selectedVideoDevice.value).toBeNull()
    expect(d.isDeviceLoad.value).toBe(false)
  })

  it('getDevices filters into audio/video and prefers the "default" deviceId', async () => {
    enumerateDevices.mockResolvedValueOnce([
      makeDevice('audioinput', 'a-1'),
      makeDevice('audioinput', 'default'),
      makeDevice('videoinput', 'v-1'),
      makeDevice('videoinput', 'default'),
      makeDevice('audiooutput', 'out-1')
    ])

    const d = useMediaDevices()
    const ok = await d.getDevices()

    expect(ok).toBe(true)
    expect(d.audioDevices.value.map((x) => x.deviceId)).toEqual(['a-1', 'default'])
    expect(d.videoDevices.value.map((x) => x.deviceId)).toEqual(['v-1', 'default'])
    expect(d.selectedAudioDevice.value).toBe('default')
    expect(d.selectedVideoDevice.value).toBe('default')
    expect(d.isDeviceLoad.value).toBe(false)
  })

  it('falls back to first device when there is no "default"', async () => {
    enumerateDevices.mockResolvedValueOnce([makeDevice('audioinput', 'a-1'), makeDevice('videoinput', 'v-1')])

    const d = useMediaDevices()
    await d.getDevices()

    expect(d.selectedAudioDevice.value).toBe('a-1')
    expect(d.selectedVideoDevice.value).toBe('v-1')
  })

  it('getDevices still proceeds when getUserMedia permission is denied', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowed'))
    enumerateDevices.mockResolvedValueOnce([makeDevice('audioinput', 'a-1')])

    const d = useMediaDevices()
    const ok = await d.getDevices()

    expect(ok).toBe(true)
    expect(d.audioDevices.value).toHaveLength(1)
  })

  it('getDevices returns false when enumerate returns empty', async () => {
    const d = useMediaDevices()
    const ok = await d.getDevices()

    expect(ok).toBe(false)
    expect(d.audioDevices.value).toEqual([])
    expect(d.isDeviceLoad.value).toBe(false)
  })

  it('getDevices returns false and clears load flag on thrown error', async () => {
    enumerateDevices.mockRejectedValueOnce(new Error('boom'))

    const d = useMediaDevices()
    const ok = await d.getDevices()

    expect(ok).toBe(false)
    expect(d.isDeviceLoad.value).toBe(false)
    expect(d.selectedAudioDevice.value).toBeNull()
  })

  it('resetDevices clears all state', async () => {
    enumerateDevices.mockResolvedValueOnce([makeDevice('audioinput', 'a-1'), makeDevice('videoinput', 'v-1')])

    const d = useMediaDevices()
    await d.getDevices()
    expect(d.audioDevices.value).toHaveLength(1)

    d.resetDevices()
    expect(d.audioDevices.value).toEqual([])
    expect(d.videoDevices.value).toEqual([])
    expect(d.selectedAudioDevice.value).toBeNull()
    expect(d.selectedVideoDevice.value).toBeNull()
  })
})
