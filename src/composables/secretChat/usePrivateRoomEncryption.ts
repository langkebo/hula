import { ref } from 'vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PrivateRoomEncryption')

/**
 * 私密列表的加密状态只读缓存。
 *
 * 单独成 composable 而不是塞进 store：数据是「当前列表快照」，随页面进出即可丢弃，
 * 放进持久化 store 反而会留下过期状态。
 */
export const usePrivateRoomEncryption = () => {
  const encryptedRooms = ref<Record<string, boolean>>({})
  const loading = ref(false)

  const refresh = async (roomIds: string[]): Promise<void> => {
    const targets = roomIds.filter((id) => !!id)
    if (targets.length === 0) {
      encryptedRooms.value = {}
      return
    }
    loading.value = true
    try {
      const entries = await Promise.all(
        targets.map(async (roomId) => [roomId, await matrixCryptoService.isRoomEncrypted(roomId)] as const)
      )
      encryptedRooms.value = Object.fromEntries(entries)
    } catch (err) {
      logger.warn(`加载私密会话加密状态失败: ${err}`)
    } finally {
      loading.value = false
    }
  }

  const isEncrypted = (roomId: string): boolean => encryptedRooms.value[roomId] === true

  return { encryptedRooms, loading, refresh, isEncrypted }
}
