import { computed, onUnmounted, ref } from 'vue'
import { type BurnStats, matrixBurnAfterReadService } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

export type { BurnStats } from '@/services/matrix/messaging/MatrixBurnAfterReadService'

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
}

const DEFAULT_BURN_DURATION_SEC = 60

const roomBurnState = ref<Map<string, boolean>>(new Map())
const roomBurnDuration = ref<Map<string, number>>(new Map())

export function useBurnAfterRead(options: UseBurnAfterReadOptions = {}) {
  const defaultDuration = options.defaultDuration || DEFAULT_BURN_DURATION_SEC
  const globalStore = useGlobalStore()

  const burnMessages = ref<Map<string, BurnMessage>>(new Map())
  const countdownTimers = ref<Map<string, ReturnType<typeof setInterval>>>(new Map())

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

    const existingTimer = countdownTimers.value.get(msgId)
    if (existingTimer) clearInterval(existingTimer)

    const intervalId = setInterval(() => {
      const currentMsg = burnMessages.value.get(msgId)
      if (!currentMsg || !currentMsg.isBurning || currentMsg.isBurned) {
        const timer = countdownTimers.value.get(msgId)
        if (timer) {
          clearInterval(timer)
          countdownTimers.value.delete(msgId)
        }
        return
      }

      const elapsed = Math.floor((Date.now() - (currentMsg.burnStartTime || 0)) / 1000)
      currentMsg.remainingSeconds = Math.max(0, currentMsg.burnDuration - elapsed)

      options.onBurnTick?.(currentMsg, currentMsg.remainingSeconds)

      if (currentMsg.remainingSeconds <= 0) {
        const timer = countdownTimers.value.get(msgId)
        if (timer) {
          clearInterval(timer)
          countdownTimers.value.delete(msgId)
        }
        completeBurn(msgId)
      }
    }, 1000)

    countdownTimers.value.set(msgId, intervalId)
  }

  async function completeBurn(msgId: string) {
    const msg = burnMessages.value.get(msgId)
    if (!msg) return

    msg.isBurned = true
    msg.isBurning = false
    msg.remainingSeconds = 0

    try {
      await matrixBurnAfterReadService.burnMessage(msg.eventId)
    } catch (error) {
      logger.error(`焚毁消息失败: ${error}`)
    }

    options.onBurnComplete?.(msg)
  }

  function removeBurnMessage(msgId: string) {
    const timer = countdownTimers.value.get(msgId)
    if (timer) {
      clearInterval(timer)
      countdownTimers.value.delete(msgId)
    }
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
        const timer = countdownTimers.value.get(msgId)
        if (timer) {
          clearInterval(timer)
          countdownTimers.value.delete(msgId)
        }
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

  async function toggleRoomBurn(roomId?: string) {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return

    const currentEnabled = roomBurnState.value.get(targetRoomId) || false
    const newEnabled = !currentEnabled

    try {
      if (newEnabled) {
        const burnMs = (roomBurnDuration.value.get(targetRoomId) || defaultDuration) * 1000
        await matrixBurnAfterReadService.enableBurn(targetRoomId, burnMs)
      } else {
        await matrixBurnAfterReadService.disableBurn(targetRoomId)
      }
      roomBurnState.value.set(targetRoomId, newEnabled)
    } catch (error) {
      logger.error(`切换阅后即焚失败: ${error}`)
      throw error
    }
  }

  async function loadRoomBurnState(roomId?: string) {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return

    try {
      const settings = await matrixBurnAfterReadService.getBurnSettings(targetRoomId)
      if (settings) {
        roomBurnState.value.set(targetRoomId, settings.enabled)
        roomBurnDuration.value.set(targetRoomId, Math.round(settings.burnAfterMs / 1000))
      }
    } catch {
      roomBurnState.value.set(targetRoomId, false)
    }
  }

  function isRoomBurnEnabled(roomId?: string): boolean {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return false
    return roomBurnState.value.get(targetRoomId) || false
  }

  function getRoomBurnDuration(roomId?: string): number {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return defaultDuration
    return roomBurnDuration.value.get(targetRoomId) || defaultDuration
  }

  async function markMessageRead(roomId: string, eventId: string) {
    try {
      await matrixBurnAfterReadService.markBurnRead(roomId, eventId)
    } catch (error) {
      logger.error(`标记已读失败: ${error}`)
    }
  }

  async function getBurnStats(): Promise<BurnStats> {
    return await matrixBurnAfterReadService.getBurnStats()
  }

  async function enableBurn(roomId: string, burnAfterMs?: number): Promise<void> {
    await matrixBurnAfterReadService.enableBurn(roomId, burnAfterMs)
  }

  async function disableBurn(roomId: string): Promise<void> {
    await matrixBurnAfterReadService.disableBurn(roomId)
  }

  function cleanup() {
    for (const timer of countdownTimers.value.values()) {
      clearInterval(timer)
    }
    countdownTimers.value.clear()
    burnMessages.value.clear()
  }

  onUnmounted(() => {
    cleanup()
  })

  return {
    burnMessages: computed(() => Array.from(burnMessages.value.values())),
    activeBurnMessages,
    burnedMessages,
    roomBurnState,
    roomBurnDuration,
    addBurnMessage,
    startBurn,
    completeBurn,
    removeBurnMessage,
    getBurnMessage,
    isBurnActive,
    isMessageBurned,
    clearBurnedMessages,
    formatRemainingTime,
    toggleRoomBurn,
    loadRoomBurnState,
    isRoomBurnEnabled,
    getRoomBurnDuration,
    markMessageRead,
    getBurnStats,
    enableBurn,
    disableBurn,
    cleanup
  }
}
