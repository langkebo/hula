import { computed, getCurrentInstance, onMounted, onUnmounted, type Ref, ref, watch } from 'vue'
import type { RoomEncryptionState } from '@/services/matrix/crypto/cryptoAdapterTypes'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomEncryptionStatus')

export type EncryptionWarningKey = 'crypto_init_failed' | 'backup_disabled' | 'keys_local_only'

/**
 * 乐观冷启动时房间可能尚未进入 client store（三态中的 `unknown`），
 * 下面的有限重试只是 UI 状态补偿，不属于协议逻辑，也不会发起新的协议请求。
 */
const ROOM_ENCRYPTION_RETRY_LIMIT = 5
const ROOM_ENCRYPTION_RETRY_DELAY_MS = 1000

/**
 * 单个房间的加密就绪度。
 *
 * 只读聚合：房间加密状态来自 SDK 状态事件（三态），备份/4S 状态来自既有 EncryptionStore，
 * 不在这里重复请求 /room_keys/version。
 */
export const useRoomEncryptionStatus = (roomId: Ref<string>) => {
  const encryptionStore = useEncryptionStore()
  const matrixStore = useMatrixStore()
  const state = ref<RoomEncryptionState>('unknown')
  const loading = ref(false)
  let retryAttempts = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  /** 请求代次：并发 reload（快速切房）时只允许最后一次写状态/排重试。 */
  let loadSeq = 0

  const cancelRetry = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const scheduleRetry = () => {
    if (state.value !== 'unknown') return
    if (retryAttempts >= ROOM_ENCRYPTION_RETRY_LIMIT) return
    // 并发 load 各自排定时器会覆盖句柄，旧定时器既取消失效又会多触发一轮查询
    cancelRetry()
    retryAttempts += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void load()
    }, ROOM_ENCRYPTION_RETRY_DELAY_MS)
  }

  const load = async (): Promise<void> => {
    const seq = ++loadSeq
    const currentRoomId = roomId.value
    if (!currentRoomId) {
      state.value = 'unknown'
      return
    }
    loading.value = true
    try {
      try {
        const next = await matrixCryptoService.getRoomEncryptionState(currentRoomId)
        if (seq === loadSeq) state.value = next
      } catch (err) {
        logger.warn(`加载房间加密状态失败: ${err}`)
        if (seq === loadSeq) state.value = 'unknown'
      }
      if (!encryptionStore.loaded) {
        try {
          await encryptionStore.loadEncryptionStatus()
        } catch (err) {
          logger.warn(`加载加密配置状态失败: ${err}`)
        }
      }
    } finally {
      if (seq === loadSeq) loading.value = false
    }
    // 已有更新的请求在途或等待期间已切换房间：交给它负责，避免覆盖或排重试
    if (seq !== loadSeq) return
    if (roomId.value !== currentRoomId) return
    scheduleRetry()
  }

  const reload = async (): Promise<void> => {
    cancelRetry()
    retryAttempts = 0
    await load()
  }

  // 允许在组件外直接调用（单测）：没有实例时不注册生命周期钩子。
  const instance = getCurrentInstance()
  const stopRoomWatch = watch(roomId, () => {
    void reload()
  })
  // 断线期间的重试必然拿不到新状态；连接恢复后立即重判一次，而不是等用户切房。
  const stopConnectionWatch = watch(
    () => matrixStore.connectionState,
    (next, prev) => {
      if (next === 'CONNECTED' && prev !== 'CONNECTED') {
        void reload()
      }
    }
  )
  if (instance) {
    onMounted(() => {
      void reload()
    })
    onUnmounted(() => {
      cancelRetry()
      stopRoomWatch()
      stopConnectionWatch()
    })
  }

  const isEncrypted = computed(() => state.value === 'encrypted')

  const warnings = computed<EncryptionWarningKey[]>(() => {
    if (state.value !== 'encrypted') return []
    const result: EncryptionWarningKey[] = []
    // 由 loadCryptoInitStatus 单独维护，不依赖 encryption store 的 loaded 状态
    if (encryptionStore.cryptoInitFailed) result.push('crypto_init_failed')
    // 备份/4S 默认值为 false：未加载完成前不能据此报风险，否则每次进房都会闪现误报
    if (!encryptionStore.loaded) return result
    if (!encryptionStore.backupEnabled) result.push('backup_disabled')
    if (encryptionStore.crossSigningKeysLocalOnly) result.push('keys_local_only')
    return result
  })

  return { isEncrypted, loading, warnings, reload }
}
