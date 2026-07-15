import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('CallBell')

const DEFAULT_BELL_URL = '/sound/hula_bell.mp3'

/**
 * 封装通话铃声：一个隐藏的 HTMLAudioElement + play/pause/stop 原语。
 * 静音场景（url 为空）下为 no-op，避免创建 Audio 对象。
 *
 * 从 useWebRtc 抽出，方便单测 stub。
 */
export const useCallBell = (url: string = DEFAULT_BELL_URL) => {
  const bellAudio = ref<HTMLAudioElement | null>(null)

  const startBell = () => {
    if (!url) {
      logger.debug('rtc通话已经静音')
      bellAudio.value = null
      return
    }
    const audio = new Audio(url)
    audio.loop = true
    bellAudio.value = audio
    audio.play?.()
  }

  const stopBell = () => {
    bellAudio.value?.pause?.()
    bellAudio.value = null
  }

  const pauseBell = () => {
    bellAudio.value?.pause?.()
  }

  const playBell = () => {
    bellAudio.value?.play?.()
  }

  return {
    bellAudio,
    startBell,
    stopBell,
    pauseBell,
    playBell
  }
}
