import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { resolveNotificationVolume, useMessageSound } from '../useMessageSound'

const { playMock } = vi.hoisted(() => ({ playMock: vi.fn() }))

vi.mock('@/utils/AudioManager', () => ({
  audioManager: { play: playMock }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

describe('resolveNotificationVolume', () => {
  it('falls back to the 80 percent default when the setting is unset', () => {
    expect(resolveNotificationVolume(undefined)).toBe(0.8)
  })

  it('reads the configured volume instead of a constant', () => {
    expect(resolveNotificationVolume(30)).toBeCloseTo(0.3)
    expect(resolveNotificationVolume(100)).toBe(1)
    expect(resolveNotificationVolume(0)).toBe(0)
  })

  it('clamps out-of-range values into 0..1', () => {
    expect(resolveNotificationVolume(500)).toBe(1)
    expect(resolveNotificationVolume(-20)).toBe(0)
  })
})

describe('useMessageSound', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    playMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('plays the message sound at the volume configured in the setting store', async () => {
    const settingStore = useSettingStore()
    settingStore.setNotificationVolume(30)

    await useMessageSound().playMessageSound()

    expect(playMock).toHaveBeenCalledTimes(1)
    const [audio, audioId] = playMock.mock.calls[0] as [HTMLAudioElement, string]
    expect(audioId).toBe('message-notification')
    expect(audio.volume).toBeCloseTo(0.3)
  })

  it('follows a volume change made after the composable is created', async () => {
    const settingStore = useSettingStore()
    const { playMessageSound } = useMessageSound()

    settingStore.setNotificationVolume(10)
    await playMessageSound()
    expect(playMock.mock.calls[0][0].volume).toBeCloseTo(0.1)

    settingStore.setNotificationVolume(100)
    await playMessageSound()
    expect(playMock.mock.calls[1][0].volume).toBe(1)
  })

  it('does not play anything while the message sound toggle is off', async () => {
    const settingStore = useSettingStore()
    settingStore.setMessageSoundEnabled(false)

    await useMessageSound().playMessageSound()

    expect(playMock).not.toHaveBeenCalled()
  })

  it('swallows playback failures instead of rejecting the caller', async () => {
    playMock.mockRejectedValue(new Error('play blocked'))

    await expect(useMessageSound().playMessageSound()).resolves.toBeUndefined()
  })
})
