/**
 * 同步状态监控 Composable
 *
 * 用于移动端同步页面，提供同步状态、进度、token 等信息
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { matrixSyncService } from '@/services/matrix/MatrixSyncService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SyncMonitor')

export interface SyncMonitorState {
  status: 'idle' | 'syncing' | 'error' | 'catchup'
  progress: number
  syncedRooms: number
  totalRooms: number
  lastSyncTime: Date | null
  syncToken: string | null
  errorMessage: string | null
}

export function useSyncMonitor() {
  const status = ref<SyncMonitorState['status']>('idle')
  const progress = ref(0)
  const syncedRooms = ref(0)
  const totalRooms = ref(0)
  const lastSyncTime = ref<Date | null>(null)
  const syncToken = ref<string | null>(null)
  const errorMessage = ref<string | null>(null)

  let syncStateInterval: number | null = null

  const updateSyncState = () => {
    const state = matrixSyncService.getSyncState()
    syncedRooms.value = state.roomCount
    totalRooms.value = matrixSyncService.getRooms().length
    progress.value = totalRooms.value > 0 ? (syncedRooms.value / totalRooms.value) * 100 : 0
    status.value = state.isSyncing ? 'syncing' : 'idle'
    if (state.lastSyncTime > 0) {
      lastSyncTime.value = new Date(state.lastSyncTime)
    }
  }

  const loadSyncToken = () => {
    try {
      const token = localStorage.getItem('hula_sync_token')
      syncToken.value = token ? token.substring(0, 20) + '...' : null
    } catch (err) {
      logger.error('加载 sync token 失败:', err)
    }
  }

  const handleSyncComplete = () => {
    updateSyncState()
    loadSyncToken()
    errorMessage.value = null
  }

  const handleSyncError = (err: unknown) => {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : '同步失败'
    logger.error('同步错误:', err)
  }

  const setupListeners = () => {
    // 监听同步服务事件
    matrixSyncService.onSync('sync_complete', handleSyncComplete)
    matrixSyncService.onSync('sync_error', handleSyncError)

    // 定时更新状态
    syncStateInterval = window.setInterval(() => {
      updateSyncState()
    }, 2000)
  }

  const cleanupListeners = () => {
    if (syncStateInterval) {
      clearInterval(syncStateInterval)
      syncStateInterval = null
    }
  }

  const manualSync = async () => {
    status.value = 'syncing'
    errorMessage.value = null
    try {
      await matrixSyncService.startSync({ fullState: false })
      updateSyncState()
      loadSyncToken()
    } catch (err) {
      handleSyncError(err)
      throw err
    }
  }

  const clearCache = async () => {
    try {
      // 清空消息缓存
      const { messageCacheDB } = await import('@/utils/storage/messageCache')
      await messageCacheDB.clearAll()
      logger.info('缓存已清理')
    } catch (err) {
      logger.error('清理缓存失败:', err)
      throw err
    }
  }

  const clearSyncToken = () => {
    matrixSyncService.clearSyncToken()
    syncToken.value = null
  }

  onMounted(() => {
    setupListeners()
    updateSyncState()
    loadSyncToken()
  })

  onUnmounted(() => {
    cleanupListeners()
  })

  return {
    status,
    progress,
    syncedRooms,
    totalRooms,
    lastSyncTime,
    syncToken,
    errorMessage,
    manualSync,
    clearCache,
    clearSyncToken,
    updateSyncState
  }
}
