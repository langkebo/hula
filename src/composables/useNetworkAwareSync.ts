import { ref, onMounted, onUnmounted } from 'vue'
import { useOnline } from '@vueuse/core'
import { matrixSyncService } from '@/services/matrix/MatrixSyncService'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export function useNetworkAwareSync() {
  const isOnline = useOnline()
  const networkType = ref<string>('unknown')
  const isSlowNetwork = ref(false)
  let connection: any = null
  let syncIntervalTimer: number | null = null

  const getNetworkType = (): string => {
    const conn = (navigator as any).connection
    if (!conn) return 'unknown'
    return conn.effectiveType || conn.type || 'unknown'
  }

  const updateNetworkStatus = () => {
    networkType.value = getNetworkType()
    isSlowNetwork.value = networkType.value === '2g' || networkType.value === '3g'

    // 根据网络质量调整同步间隔
    if (matrixSyncService) {
      const interval = isSlowNetwork.value ? 60000 : 30000
      matrixSyncService.setSyncInterval?.(interval)
      info(`[NetworkAwareSync] 网络类型: ${networkType.value}, 同步间隔: ${interval}ms`)
    }
  }

  const handleOnline = async () => {
    info('[NetworkAwareSync] 网络已恢复，触发同步')
    updateNetworkStatus()

    if (matrixClientService.isConnected() && !matrixSyncService.getSyncState().isSyncing) {
      try {
        // 网络恢复后执行增量同步
        await matrixSyncService.startSync({ fullState: false })
        info('[NetworkAwareSync] 网络恢复后同步完成')
      } catch (err) {
        error(`[NetworkAwareSync] 网络恢复后同步失败: ${err}`)
      }
    }
  }

  const handleOffline = () => {
    info('[NetworkAwareSync] 网络已断开')
  }

  const setupNetworkListeners = () => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener('change', updateNetworkStatus)
    }

    updateNetworkStatus()
  }

  const cleanupNetworkListeners = () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)

    if (connection) {
      connection.removeEventListener('change', updateNetworkStatus)
    }

    if (syncIntervalTimer) {
      clearInterval(syncIntervalTimer)
      syncIntervalTimer = null
    }
  }

  const startPeriodicSync = () => {
    if (syncIntervalTimer) clearInterval(syncIntervalTimer)
    syncIntervalTimer = window.setInterval(() => {
      if (isOnline.value && !matrixSyncService.getSyncState().isSyncing) {
        matrixSyncService.startSync({ fullState: false }).catch((err) => {
          error(`[NetworkAwareSync] 定时同步失败: ${err}`)
        })
      }
    }, 30000)
  }

  onMounted(() => {
    setupNetworkListeners()
    startPeriodicSync()
    info('[NetworkAwareSync] 网络感知同步已初始化')
  })

  onUnmounted(() => {
    cleanupNetworkListeners()
  })

  return {
    isOnline,
    networkType,
    isSlowNetwork,
    updateNetworkStatus
  }
}
