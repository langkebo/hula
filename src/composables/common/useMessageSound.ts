import { useSettingStore } from '@/stores/domains/settings/setting'
import { audioManager } from '@/utils/AudioManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageSound')

const MESSAGE_SOUND_SRC = '/sound/message.mp3'
const MESSAGE_SOUND_ID = 'message-notification'
const DEFAULT_VOLUME_PERCENT = 80

/**
 * 把设置里的 0-100 提示音音量换算成 HTMLAudioElement 需要的 0..1。
 * 未配置（undefined）时回落默认 80，与 `getDefaultNotificationSettings()` 一致；
 * 越界值按 0..1 截断，避免 `volume` 赋值抛 IndexSizeError。
 */
export function resolveNotificationVolume(volume?: number): number {
  const percent = typeof volume === 'number' ? volume : DEFAULT_VOLUME_PERCENT
  return Math.min(1, Math.max(0, percent / 100))
}

/**
 * 消息提示音播放器（桌面 `layout/index.vue` 与移动端 `MobileLayout.vue` 的同一条路径）。
 *
 * 音量与开关都来自 setting store（`notification.volume` / `notification.messageSound`），
 * 因此设置页的开关与音量滑块直接作用于播放行为；两条布局不再各自维护硬编码音量。
 */
export function useMessageSound() {
  const settingStore = useSettingStore()

  const playMessageSound = async () => {
    // 检查是否开启了消息提示音
    if (!settingStore.notification?.messageSound) {
      return
    }

    try {
      const audio = new Audio(MESSAGE_SOUND_SRC)
      audio.volume = resolveNotificationVolume(settingStore.notification?.volume)
      await audioManager.play(audio, MESSAGE_SOUND_ID)
    } catch (error) {
      logger.warn('播放消息音效失败:', error)
    }
  }

  return { playMessageSound }
}
