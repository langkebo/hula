/** 媒体设备（麦克风/相机）启动失败的分类，用于把浏览器错误名转成可读引导 */
type MediaErrorKind = 'permission_denied' | 'device_not_found' | 'device_busy' | 'unknown'

/** 错误文案面向的设备目标：音频通话只涉及麦克风，视频通话两者都涉及 */
export type MediaErrorTarget = 'mic' | 'camera' | 'av'

interface MediaErrorText {
  messageKey: string
  guideKey?: string
}

export function classifyMediaError(err: unknown): MediaErrorKind {
  const name = typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'permission_denied'
    case 'NotFoundError':
      return 'device_not_found'
    case 'NotReadableError':
      return 'device_busy'
    default:
      return 'unknown'
  }
}

export function resolveMediaErrorText(kind: MediaErrorKind, target: MediaErrorTarget): MediaErrorText {
  if (kind === 'permission_denied') {
    if (target === 'mic') {
      return {
        messageKey: 'voip.errors.mic_permission_denied',
        guideKey: 'voip.errors.mic_permission_guide'
      }
    }
    if (target === 'camera') {
      return {
        messageKey: 'voip.errors.camera_permission_denied',
        guideKey: 'voip.errors.camera_permission_guide'
      }
    }
    return {
      messageKey: 'voip.errors.media_permission_denied',
      guideKey: 'voip.errors.media_permission_guide'
    }
  }
  if (kind === 'device_not_found') {
    return {
      messageKey:
        target === 'mic'
          ? 'voip.errors.mic_not_found'
          : target === 'camera'
            ? 'voip.errors.camera_not_found'
            : 'voip.errors.media_not_found'
    }
  }
  if (kind === 'device_busy') {
    return {
      messageKey:
        target === 'mic'
          ? 'voip.errors.mic_busy'
          : target === 'camera'
            ? 'voip.errors.camera_busy'
            : 'voip.errors.media_busy'
    }
  }
  return { messageKey: 'voip.errors.media_failed' }
}
