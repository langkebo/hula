import { createLogger } from '@/utils/Logger'

const logger = createLogger('MediaDevicePreferences')

/**
 * 音视频设备与音质偏好（本地偏好，不参与账号同步）。
 *
 * 背景：设置窗口此前把这 8 个偏好直接写进 localStorage，但没有任何运行时消费方
 * —— 服务层刻意不自己调 `getUserMedia`（避免与 SDK 内部采集竞争设备），本地流由
 * SDK 拥有。治理后：3 个音质布尔经 `applyConstraints` 在真实通话上生效；麦克风/
 * 摄像头选择影响设置页的测试与预览；`audioOutputId` / `inputVolume` / `outputVolume`
 * 全仓零消费方，已按用户裁决（M1）连同控件一起删除。
 *
 * 两类约束必须分开，这是本模块存在的核心原因：
 * - {@link toAudioQualityConstraints} 只含三个音质布尔，可安全喂给 `track.applyConstraints()`；
 * - {@link toDeviceConstraints} 含 `deviceId: { exact }`，**只能用于重建轨道**
 *   （`getUserMedia` / `replaceTrack`）。`deviceId` 是不可变约束，喂给
 *   `applyConstraints` 必然 reject，且 `applyConstraints` 是原子的——一次 reject
 *   会让同一对象里的音质布尔一起静默失效。
 *
 * **如实标注的未接线范围**：设备选择目前只作用于设置页的测试/预览，
 * 应用到真实通话需要 `replaceTrack`（尚未实现）。
 */
export interface MediaDevicePreferences {
  /** 麦克风设备 id；null 表示交给浏览器默认设备。 */
  audioInputId: string | null
  /** 摄像头设备 id；null 表示交给浏览器默认设备。 */
  videoInputId: string | null
  /** 自动增益（映射为 `autoGainControl` 约束）。 */
  autoGain: boolean
  /** 回声消除。 */
  echoCancellation: boolean
  /** 降噪。 */
  noiseSuppression: boolean
}

/** 无任何已保存偏好时的默认值：不指定设备、三个音质开关全开。 */
export const DEFAULT_MEDIA_DEVICE_PREFERENCES: MediaDevicePreferences = {
  audioInputId: null,
  videoInputId: null,
  autoGain: true,
  echoCancellation: true,
  noiseSuppression: true
}

/**
 * localStorage key 映射。沿用历史 key，保证老用户已保存的值继续生效。
 *
 * 已删除字段的旧 key（`tjg-audio-output` / `tjg-input-volume` / `tjg-output-volume`）
 * 不再读取：那些值没有任何消费方，留着只会伪装成"已接线"。读取侧不再返回它们即可，
 * 残留的旧值不影响行为。
 */
const STORAGE_KEYS: Record<keyof MediaDevicePreferences, string> = {
  audioInputId: 'tjg-audio-input',
  videoInputId: 'tjg-video-input',
  echoCancellation: 'tjg-echo-cancellation',
  noiseSuppression: 'tjg-noise-suppression',
  autoGain: 'tjg-auto-gain'
}

/**
 * 读取设备 id：缺失/空白视为"未指定"（null）。
 */
function normalizeDeviceId(value: unknown, fallback: string | null): string | null {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * 读取布尔开关：非布尔值回退默认。
 */
function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * 把任意（可能残缺、可能越界的）偏好补全并收敛为完整合法值。
 */
export function normalizeMediaDevicePreferences(partial: Partial<MediaDevicePreferences> = {}): MediaDevicePreferences {
  return {
    audioInputId: normalizeDeviceId(partial.audioInputId, DEFAULT_MEDIA_DEVICE_PREFERENCES.audioInputId),
    videoInputId: normalizeDeviceId(partial.videoInputId, DEFAULT_MEDIA_DEVICE_PREFERENCES.videoInputId),
    autoGain: normalizeBoolean(partial.autoGain, DEFAULT_MEDIA_DEVICE_PREFERENCES.autoGain),
    echoCancellation: normalizeBoolean(partial.echoCancellation, DEFAULT_MEDIA_DEVICE_PREFERENCES.echoCancellation),
    noiseSuppression: normalizeBoolean(partial.noiseSuppression, DEFAULT_MEDIA_DEVICE_PREFERENCES.noiseSuppression)
  }
}

/**
 * 从 localStorage 读取全部音视频偏好。
 *
 * 解析规则刻意与重构前的设置窗口保持一致（老数据语义不变）：
 * - 设备 id：空/缺失 → null；
 * - 布尔：只有字面量 `'true'` 为真，其余非空值一律为假，缺失 → 默认。
 */
export function loadMediaDevicePreferences(storage: Pick<Storage, 'getItem'> = localStorage): MediaDevicePreferences {
  const read = (key: string): string | null => {
    try {
      return storage.getItem(key)
    } catch (error) {
      logger.warn(`读取音视频偏好失败: ${key}`, error)
      return null
    }
  }

  const readDeviceId = (key: string): string | null => {
    const value = read(key)
    return value === null || value.trim() === '' ? null : value
  }

  const readBoolean = (key: string): boolean | undefined => {
    const value = read(key)
    if (value === null || value === '') return undefined
    return value === 'true'
  }

  return normalizeMediaDevicePreferences({
    audioInputId: readDeviceId(STORAGE_KEYS.audioInputId),
    videoInputId: readDeviceId(STORAGE_KEYS.videoInputId),
    autoGain: readBoolean(STORAGE_KEYS.autoGain),
    echoCancellation: readBoolean(STORAGE_KEYS.echoCancellation),
    noiseSuppression: readBoolean(STORAGE_KEYS.noiseSuppression)
  })
}

/**
 * 保存部分偏好：只写传入的字段，值经归一化后落盘；设备 id 为 null 时删除该 key。
 *
 * 只写传入字段是刻意的——设置窗口每个控件只改自己那一项，不能把其余默认值覆盖掉用户已存的设置。
 */
export function saveMediaDevicePreferences(
  partial: Partial<MediaDevicePreferences>,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage
): void {
  const normalized = normalizeMediaDevicePreferences(partial)

  for (const field of Object.keys(partial) as (keyof MediaDevicePreferences)[]) {
    const key = STORAGE_KEYS[field]
    const value = normalized[field]
    try {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, String(value))
    } catch (error) {
      logger.warn(`保存音视频偏好失败: ${key}`, error)
    }
  }
}

/**
 * 构造可安全喂给 `track.applyConstraints()` 的音质约束。
 *
 * **只含三个布尔**：`deviceId` 不可变、`volume` 不是 `MediaTrackConstraintSet` 成员，
 * 任何一个混进来都会让整次 `applyConstraints` reject，导致三个音质布尔一起静默失效。
 */
export function toAudioQualityConstraints(preferences: MediaDevicePreferences): MediaTrackConstraintSet {
  return {
    echoCancellation: preferences.echoCancellation,
    noiseSuppression: preferences.noiseSuppression,
    autoGainControl: preferences.autoGain
  }
}

/**
 * 重建轨道用的设备约束（`getUserMedia` / `replaceTrack` 的入参）。
 *
 * **禁止喂给 `applyConstraints`**：`deviceId` 是不可变约束，`applyConstraints` 必然 reject。
 * 未指定设备时不输出 `deviceId`，让浏览器用默认设备。
 */
export interface MediaDeviceConstraintSets {
  /** 音频采集约束（未指定设备时为空对象）。 */
  audio: MediaTrackConstraintSet
  /** 视频采集约束（未指定设备时为空对象）。 */
  video: MediaTrackConstraintSet
}

/**
 * 把设备偏好转为重建轨道用的约束对，只含 `deviceId: { exact }`。
 */
export function toDeviceConstraints(preferences: MediaDevicePreferences): MediaDeviceConstraintSets {
  const audio: MediaTrackConstraintSet = {}
  if (preferences.audioInputId) audio.deviceId = { exact: preferences.audioInputId }

  const video: MediaTrackConstraintSet = {}
  if (preferences.videoInputId) video.deviceId = { exact: preferences.videoInputId }

  return { audio, video }
}
