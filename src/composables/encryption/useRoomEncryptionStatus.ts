import { computed, getCurrentInstance, onMounted, type Ref, ref, watch } from 'vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomEncryptionStatus')

export type EncryptionWarningKey = 'crypto_init_failed' | 'backup_disabled' | 'keys_local_only'

/**
 * 单个房间的加密就绪度。
 *
 * 只读聚合：房间是否加密来自 SDK 状态事件；备份/4S 状态来自既有 EncryptionStore，
 * 不在这里重复请求 /room_keys/version。
 */
export const useRoomEncryptionStatus = (roomId: Ref<string>) => {
  const encryptionStore = useEncryptionStore()
  const isEncrypted = ref(false)
  const loading = ref(false)

  const reload = async (): Promise<void> => {
    if (!roomId.value) {
      isEncrypted.value = false
      return
    }
    loading.value = true
    try {
      isEncrypted.value = await matrixCryptoService.isRoomEncrypted(roomId.value)
      if (!encryptionStore.loaded) {
        await encryptionStore.loadEncryptionStatus()
      }
    } catch (err) {
      logger.warn(`加载房间加密状态失败: ${err}`)
    } finally {
      loading.value = false
    }
  }

  // 允许在组件外直接调用（单测）：没有实例时不注册生命周期钩子。
  if (getCurrentInstance()) {
    onMounted(() => {
      void reload()
    })
  }
  watch(roomId, () => {
    void reload()
  })

  const warnings = computed<EncryptionWarningKey[]>(() => {
    if (!isEncrypted.value) return []
    const result: EncryptionWarningKey[] = []
    if (encryptionStore.cryptoInitFailed) result.push('crypto_init_failed')
    if (!encryptionStore.backupEnabled) result.push('backup_disabled')
    if (encryptionStore.crossSigningKeysLocalOnly) result.push('keys_local_only')
    return result
  })

  return { isEncrypted, loading, warnings, reload }
}
