import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MEDIA_DEVICE_PREFERENCES,
  loadMediaDevicePreferences,
  normalizeMediaDevicePreferences,
  saveMediaDevicePreferences,
  toAudioQualityConstraints,
  toDeviceConstraints
} from '../mediaDevicePreferences'

describe('mediaDevicePreferences', () => {
  beforeEach(() => localStorage.clear())

  it('默认不指定设备且三个音质开关全开', () => {
    const p = loadMediaDevicePreferences()
    expect(p.audioInputId).toBeNull()
    expect(p.autoGain).toBe(true)
    expect(p.echoCancellation).toBe(true)
    expect(p.noiseSuppression).toBe(true)
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
    const c = toAudioQualityConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES })
    expect('volume' in c).toBe(false)
  })

  it('设备约束单独提供，且只在指定设备时带 exact deviceId', () => {
    expect(toDeviceConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES }).audio.deviceId).toBeUndefined()
    expect(toDeviceConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, audioInputId: 'mic-9' }).audio.deviceId).toEqual({
      exact: 'mic-9'
    })
  })

  /**
   * I9 / 用户裁决 M1：audioOutputId / inputVolume / outputVolume 全仓零消费方，
   * 已连同控件与 key 删除。这里把"字段确实消失、旧磁盘值被忽略"钉死。
   */
  it('不再包含零消费方的输出设备与音量字段', () => {
    expect(Object.keys(DEFAULT_MEDIA_DEVICE_PREFERENCES).sort()).toEqual([
      'audioInputId',
      'autoGain',
      'echoCancellation',
      'noiseSuppression',
      'videoInputId'
    ])
  })

  it('忽略磁盘上残留的旧输出设备/音量 key', () => {
    localStorage.setItem('tjg-audio-output', 'speaker-1')
    localStorage.setItem('tjg-input-volume', '80')
    localStorage.setItem('tjg-output-volume', '60')

    expect(loadMediaDevicePreferences()).toEqual(DEFAULT_MEDIA_DEVICE_PREFERENCES)
    // 归一化不会把这些字段重新引入
    expect(Object.keys(normalizeMediaDevicePreferences({}))).not.toContain('inputVolume')
  })
})
