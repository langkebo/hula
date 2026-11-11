import { computed, getCurrentInstance, onMounted, onUnmounted, type Ref, ref, watch } from 'vue'
import type { RoomEncryptionState } from '@/services/matrix/crypto/cryptoAdapterTypes'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
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
  const state = ref<RoomEncryptionState>('unknown')
  const loading = ref(false)
  let retryAttempts = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const cancelRetry = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const scheduleRetry = () => {
    if (state.value !== 'unknown') return
    if (retryAttempts >= ROOM_ENCRYPTION_RETRY_LIMIT) return
    retryAttempts += 1
    retryTimer = setTimeout(() => {
      retryTimer = null
      void load()
    }, ROOM_ENCRYPTION_RETRY_DELAY_MS)
  }

  const load = async (): Promise<void> => {
    const currentRoomId = roomId.value
    if (!currentRoomId) {
      state.value = 'unknown'
      return
    }
    loading.value = true
    try {
      try {
        state.value = await matrixCryptoService.getRoomEncryptionState(currentRoomId)
      } catch (err) {
        logger.warn(`加载房间加密状态失败: ${err}`)
        state.value = 'unknown'
      }
      if (!encryptionStore.loaded) {
        try {
          await encryptionStore.loadEncryptionStatus()
        } catch (err) {
          logger.warn(`加载加密配置状态失败: ${err}`)
        }
      }
    } finally {
      loading.value = false
    }
    // 等待期间已切换房间：交给新的 reload 负责，避免为旧房间排重试
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
  if (instance) {
    onMounted(() => {
      void reload()
    })
    onUnmounted(() => {
      cancelRetry()
      stopRoomWatch()
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
