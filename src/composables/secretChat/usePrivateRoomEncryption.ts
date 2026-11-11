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
  /** 请求代次：列表快速切换时只认最后一次结果，避免旧响应覆盖新快照。 */
  let requestSeq = 0

  const refresh = async (roomIds: string[]): Promise<void> => {
    const seq = ++requestSeq
    const targets = roomIds.filter((id) => !!id)
    if (targets.length === 0) {
      encryptedRooms.value = {}
      loading.value = false
      return
    }
    loading.value = true
    try {
      const entries = await Promise.all(
        targets.map(async (roomId) => {
          try {
            return [roomId, await matrixCryptoService.isRoomEncrypted(roomId)] as const
          } catch (err) {
            // 单房间查询失败按未加密处理（fail-closed），并显式写入 false，
            // 不能沿用上一次快照里的 true 继续展示加密徽标。
            logger.warn(`加载房间加密状态失败: ${roomId} ${err}`)
            return [roomId, false] as const
          }
        })
      )
      if (seq !== requestSeq) return
      encryptedRooms.value = Object.fromEntries(entries)
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  const isEncrypted = (roomId: string): boolean => encryptedRooms.value[roomId] === true

  return { encryptedRooms, loading, refresh, isEncrypted }
}
