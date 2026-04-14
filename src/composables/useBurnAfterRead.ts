/**
 * 阅后即焚 Composable
 *
 * 管理阅后即焚消息的状态、倒计时和销毁逻辑
 * 集成 MatrixBurnAfterReadService
 */

import { ref, computed, onUnmounted } from 'vue'
import { useTimerManager } from '@/utils/TimerManager'
import matrixBurnAfterReadService from '@/services/matrix/MatrixBurnAfterReadService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useBurnAfterRead')

export interface BurnMessage {
  msgId: string
  roomId: string
  eventId: string
  burnAfterRead: boolean
  burnDuration: number
  burnStartTime?: number
  isBurning: boolean
  isBurned: boolean
  remainingSeconds?: number
}

export interface UseBurnAfterReadOptions {
  defaultDuration?: number
  onBurnStart?: (msg: BurnMessage) => void
  onBurnComplete?: (msg: BurnMessage) => void
  onBurnTick?: (msg: BurnMessage, remainingSeconds: number) => void
  syncWithBackend?: boolean
}

export function useBurnAfterRead(options: UseBurnAfterReadOptions = {}) {
  const defaultDuration = options.defaultDuration || 60
  const syncWithBackend = options.syncWithBackend ?? true
  const timerManager = useTimerManager()

  const burnMessages = ref<Map<string, BurnMessage>>(new Map())
  const burnTimers = new Map<string, number>()

  const activeBurnMessages = computed(() => {
    return Array.from(burnMessages.value.values()).filter((msg) => msg.isBurning && !msg.isBurned)
  })

  const burnedMessages = computed(() => {
    return Array.from(burnMessages.value.values()).filter((msg) => msg.isBurned)
  })

  async function addBurnMessage(
    msgId: string,
    roomId: string,
    eventId: string,
    burnAfterRead: boolean,
    burnDuration: number = defaultDuration
  ) {
    if (!burnAfterRead) return

    const burnMessage: BurnMessage = {
      msgId,
      roomId,
      eventId,
      burnAfterRead,
      burnDuration,
      isBurning: false,
      isBurned: false
    }

    burnMessages.value.set(msgId, burnMessage)
  }

  async function startBurn(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg || msg.isBurning || msg.isBurned) return

    msg.isBurning = true
    msg.burnStartTime = Date.now()
    msg.remainingSeconds = msg.burnDuration

    options.onBurnStart?.(msg)

    if (syncWithBackend) {
      try {
        await matrixBurnAfterReadService.markMessageRead(msg.roomId, msg.eventId)
        logger.info(`消息已标记为已读: ${msg.eventId}`)
      } catch (err) {
        logger.error('标记消息已读失败:', err)
      }
    }

    startCountdown(msgId)
  }

  function startCountdown(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg) return

    const intervalId = timerManager.setInterval(() => {
      const currentMsg = burnMessages.value.get(msgId)
      if (!currentMsg || !currentMsg.isBurning || currentMsg.isBurned) {
        const storedId = burnTimers.get(msgId)
        if (storedId) {
          timerManager.clearInterval(storedId)
          burnTimers.delete(msgId)
        }
        return
      }

      const elapsed = Math.floor((Date.now() - (currentMsg.burnStartTime || 0)) / 1000)
      currentMsg.remainingSeconds = Math.max(0, currentMsg.burnDuration - elapsed)

      options.onBurnTick?.(currentMsg, currentMsg.remainingSeconds)

      if (currentMsg.remainingSeconds <= 0) {
        const storedId = burnTimers.get(msgId)
        if (storedId) {
          timerManager.clearInterval(storedId)
          burnTimers.delete(msgId)
        }
        completeBurn(msgId)
      }
    }, 1000)
    burnTimers.set(msgId, intervalId)
  }

  async function completeBurn(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg) return

    msg.isBurned = true
    msg.isBurning = false
    msg.remainingSeconds = 0

    options.onBurnComplete?.(msg)
  }

  async function cancelBurn(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg || !msg.isBurning) return

    if (syncWithBackend) {
      try {
        await matrixBurnAfterReadService.cancelBurn(msg.roomId, msg.eventId)
        logger.info(`取消阅后即焚: ${msg.eventId}`)
      } catch (err) {
        logger.error('取消阅后即焚失败:', err)
      }
    }

    msg.isBurning = false
    msg.isBurned = false
    msg.remainingSeconds = msg.burnDuration
    msg.burnStartTime = undefined
  }

  function removeBurnMessage(msgId: string) {
    burnMessages.value.delete(msgId)
  }

  function getBurnMessage(msgId: string) {
    return burnMessages.value.get(msgId)
  }

  function isBurnActive(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    return msg?.isBurning && !msg?.isBurned
  }

  function isMessageBurned(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    return msg?.isBurned || false
  }

  function clearBurnedMessages() {
    for (const [msgId, msg] of burnMessages.value.entries()) {
      if (msg.isBurned) {
        burnMessages.value.delete(msgId)
      }
    }
  }

  async function loadRoomBurnConfig(roomId: string) {
    try {
      const config = await matrixBurnAfterReadService.getRoomBurnConfig(roomId)
      return config
    } catch (err) {
      logger.error('加载房间阅后即焚配置失败:', err)
      return null
    }
  }

  async function setRoomBurnConfig(roomId: string, enabled: boolean, timeoutMs: number = 60000) {
    try {
      const success = await matrixBurnAfterReadService.setRoomBurnConfig(roomId, {
        enabled,
        timeout_ms: timeoutMs,
        auto_delete: true
      })
      if (success) {
        logger.info(`房间阅后即焚配置已更新: ${roomId}`)
      }
      return success
    } catch (err) {
      logger.error('设置房间阅后即焚配置失败:', err)
      return false
    }
  }

  async function loadPendingBurnMessages(roomId: string) {
    try {
      const messages = await matrixBurnAfterReadService.getPendingBurnMessages(roomId)
      for (const msg of messages) {
        const existingMsg = burnMessages.value.get(msg.event_id)
        if (!existingMsg) {
          addBurnMessage(msg.event_id, msg.room_id, msg.event_id, true, Math.floor((msg.burn_at - Date.now()) / 1000))
        }
      }
      return messages
    } catch (err) {
      logger.error('加载待销毁消息失败:', err)
      return []
    }
  }

  function formatRemainingTime(seconds: number): string {
    if (seconds <= 0) return '已销毁'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  onUnmounted(() => {
    for (const [msgId, timerId] of burnTimers.entries()) {
      timerManager.clearInterval(timerId)
      burnTimers.delete(msgId)
    }
  })

  return {
    burnMessages: computed(() => Array.from(burnMessages.value.values())),
    activeBurnMessages,
    burnedMessages,
    addBurnMessage,
    startBurn,
    completeBurn,
    cancelBurn,
    removeBurnMessage,
    getBurnMessage,
    isBurnActive,
    isMessageBurned,
    clearBurnedMessages,
    loadRoomBurnConfig,
    setRoomBurnConfig,
    loadPendingBurnMessages,
    formatRemainingTime
  }
}
