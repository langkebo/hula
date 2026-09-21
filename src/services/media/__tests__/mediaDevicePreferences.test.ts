import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MEDIA_DEVICE_PREFERENCES,
  loadMediaDevicePreferences,
  normalizeMediaDevicePreferences,
  normalizeVolumeToGain,
  saveMediaDevicePreferences,
  toAudioQualityConstraints,
  toDeviceConstraints
} from '../mediaDevicePreferences'

describe('mediaDevicePreferences', () => {
  beforeEach(() => localStorage.clear())

  it('默认不指定设备且音量 100', () => {
    const p = loadMediaDevicePreferences()
    expect(p.audioInputId).toBeNull()
    expect(p.inputVolume).toBe(100)
  })

  it('往返一致', () => {
    saveMediaDevicePreferences({ audioInputId: 'mic-1', noiseSuppression: false })
    const p = loadMediaDevicePreferences()
    expect(p.audioInputId).toBe('mic-1')
    expect(p.noiseSuppression).toBe(false)
  })

  it('音质约束里绝不能出现 deviceId（否则 applyConstraints 必然 reject）', () => {
    const c = toAudioQualityConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, audioInputId: 'mic-9' })
    expect(c.deviceId).toBeUndefined()
    expect(c.echoCancellation).toBe(true)
    expect(c.noiseSuppression).toBe(true)
    expect(c.autoGainControl).toBe(true)
  })

  it('音质约束里绝不能出现 volume（不是 MediaTrackConstraints 成员）', () => {
    const c = toAudioQualityConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, inputVolume: 50 })
    expect('volume' in c).toBe(false)
  })

  it('设备约束单独提供，且只在指定设备时带 exact deviceId', () => {
    expect(toDeviceConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES }).audio.deviceId).toBeUndefined()
    expect(toDeviceConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, audioInputId: 'mic-9' }).audio.deviceId).toEqual({
      exact: 'mic-9'
    })
  })

  it('音量 0..100 归一化为 0..1 线性增益', () => {
    expect(normalizeVolumeToGain(0)).toBe(0)
    expect(normalizeVolumeToGain(100)).toBe(1)
    expect(normalizeVolumeToGain(50)).toBeCloseTo(0.5)
    expect(normalizeVolumeToGain(999)).toBe(1)
  })

  it('音量收敛到 0..100', () => {
    expect(normalizeMediaDevicePreferences({ inputVolume: 999 }).inputVolume).toBe(100)
    expect(normalizeMediaDevicePreferences({ inputVolume: -5 }).inputVolume).toBe(0)
  })
})
