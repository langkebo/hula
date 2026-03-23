/**
 * 阅后即焚 Composable
 *
 * 管理阅后即焚消息的状态、倒计时和销毁逻辑
 */

import { ref, computed, onUnmounted } from 'vue'

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
}

export function useBurnAfterRead(options: UseBurnAfterReadOptions = {}) {
  const defaultDuration = options.defaultDuration || 60

  const burnMessages = ref<Map<string, BurnMessage>>(new Map())

  const activeBurnMessages = computed(() => {
    return Array.from(burnMessages.value.values()).filter((msg) => msg.isBurning && !msg.isBurned)
  })

  const burnedMessages = computed(() => {
    return Array.from(burnMessages.value.values()).filter((msg) => msg.isBurned)
  })

  function addBurnMessage(
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

  function startBurn(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg || msg.isBurning || msg.isBurned) return

    msg.isBurning = true
    msg.burnStartTime = Date.now()
    msg.remainingSeconds = msg.burnDuration

    options.onBurnStart?.(msg)

    startCountdown(msgId)
  }

  function startCountdown(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg) return

    const intervalId = setInterval(() => {
      const currentMsg = burnMessages.value.get(msgId)
      if (!currentMsg || !currentMsg.isBurning || currentMsg.isBurned) {
        clearInterval(intervalId)
        return
      }

      const elapsed = Math.floor((Date.now() - (currentMsg.burnStartTime || 0)) / 1000)
      currentMsg.remainingSeconds = Math.max(0, currentMsg.burnDuration - elapsed)

      options.onBurnTick?.(currentMsg, currentMsg.remainingSeconds)

      if (currentMsg.remainingSeconds <= 0) {
        clearInterval(intervalId)
        completeBurn(msgId)
      }
    }, 1000)

    onUnmounted(() => {
      clearInterval(intervalId)
    })
  }

  function completeBurn(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg) return

    msg.isBurned = true
    msg.isBurning = false
    msg.remainingSeconds = 0

    options.onBurnComplete?.(msg)
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

  return {
    burnMessages: computed(() => Array.from(burnMessages.value.values())),
    activeBurnMessages,
    burnedMessages,
    addBurnMessage,
    startBurn,
    completeBurn,
    removeBurnMessage,
    getBurnMessage,
    isBurnActive,
    isMessageBurned,
    clearBurnedMessages,
    formatRemainingTime
  }
}
