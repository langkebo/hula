import { ref } from 'vue'

/**
 * 纯状态通话计时器：基于 requestAnimationFrame + performance.now，
 * 对外暴露只读秒数 callDuration，以及 start/stop 两个原语。
 *
 * 从 useWebRtc 抽出，独立于 SDK / WebRTC 对象，便于单测。
 */
export const useCallTimer = () => {
  const callDuration = ref(0)
  const animationFrameId = ref<number | null>(null)
  const startTime = ref<number>(0)

  const start = () => {
    startTime.value = performance.now()
    const animate = (currentTime: number) => {
      callDuration.value = Math.floor((currentTime - startTime.value) / 1000)
      animationFrameId.value = requestAnimationFrame(animate)
    }
    animationFrameId.value = requestAnimationFrame(animate)
  }

  const stop = () => {
    if (animationFrameId.value !== null) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }
    callDuration.value = 0
    startTime.value = 0
  }

  return {
    callDuration,
    startCallTimer: start,
    stopCallTimer: stop
  }
}
