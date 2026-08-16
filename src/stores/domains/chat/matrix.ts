import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixCapabilityService } from '@/services/matrix/MatrixCapabilityService'
import {
  type ConnectionState,
  type MatrixClientConfig,
  matrixClientService
} from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixStore')
const POST_LOGIN_STARTUP_TIMEOUT_MS = 15_000

/**
 * 连接进入 CONNECTED（初始同步完成或重连成功）后恢复当前房间的活跃位置信标。
 * 动态导入 room/location store，避免静态循环依赖，也避免把重模块拉进 matrix store 的初始化路径。
 */
async function restoreActiveLocationBeacons(): Promise<void> {
  try {
    const { useRoomStore } = await import('./room')
    const { useLocationStore } = await import('./location')
    const roomId = useRoomStore().currentRoomId
    if (roomId) {
      await useLocationStore().restoreActiveBeacons(roomId)
    }
  } catch (error) {
    logger.warn('重连后恢复位置信标失败:', error)
  }
}

export const useMatrixStore = defineStore(
  StoresEnum.MATRIX,
  () => {
    const connectionState = ref<ConnectionState>('DISCONNECTED')
    const userId = ref<string | null>(null)
    const deviceId = ref<string | null>(null)
    const accessToken = ref<string | null>(null)
    const refreshToken = ref<string | null>(null)
    const homeserverUrl = ref<string | null>(null)
    const lastError = ref<string | null>(null)
    const isInitialized = ref(false)
    const syncState = ref<string | null>(null)

    const isLoggedIn = computed(() => !!userId.value && !!accessToken.value)
    const isConnected = computed(() => connectionState.value === 'CONNECTED')

    async function settlePostLoginStartup(): Promise<void> {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined
      let startupError: Error | null = null
      const startupTask = (async () => {
        try {
          await matrixClientService.startClient()
        } catch (error) {
          startupError = error instanceof Error ? error : new Error(String(error))
          logger.warn('登录后 Matrix 启动收尾失败:', error)
        } finally {
          // 无论 startClient 成功与否，都必须刷新能力（refreshCapabilities 内部已做空对象兜底），
          // 否则 FriendListView 的 isCapabilityLoading = !isLoaded 会永久为 true，导致 n-spin 无限转圈。
          try {
            await matrixCapabilityService.refreshCapabilities()
          } catch (capabilityErr) {
            logger.warn('refreshCapabilities 失败，使用空兜底:', capabilityErr)
          }
        }
      })()

      await Promise.race([
        startupTask,
        new Promise<void>((resolve) => {
          timeoutHandle = setTimeout(() => {
            logger.warn(`登录后 Matrix 启动收尾超过 ${POST_LOGIN_STARTUP_TIMEOUT_MS}ms，转为后台继续`)
            resolve()
          }, POST_LOGIN_STARTUP_TIMEOUT_MS)
        })
      ])

      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }

      if (startupError) {
        logger.error('Matrix startClient 失败，同步将不可用:', (startupError as Error).message)
        // 状态修正：startClient 失败时连接状态不应保持 CONNECTED，
        // 否则 UI 会显示"已连接"但实际 sync 未运行、消息永远不会到达。
        connectionState.value = 'ERROR'
        lastError.value = (startupError as Error).message
      }
    }

    // 具名监听器函数，支持重新登录时 .off() 移除旧监听器，避免叠加
    const onConnectionState = (data: unknown) => {
      const { state } = data as { state: string }
      connectionState.value = state.toUpperCase() as ConnectionState
      // 重连成功 / 初始同步完成（进入 CONNECTED）时恢复会话中的位置信标。
      if (connectionState.value === 'CONNECTED') {
        void restoreActiveLocationBeacons()
      }
    }
    const onSync = (data: unknown) => {
      const { state } = data as { state: string }
      syncState.value = state
    }

    async function initialize(config: MatrixClientConfig): Promise<void> {
      try {
        lastError.value = null

        // 移除上次 initialize 注册的监听器，防止重新登录时叠加
        matrixClientService.off('connectionState', onConnectionState)
        matrixClientService.off('sync', onSync)

        await matrixClientService.initialize(config)
        homeserverUrl.value = config.homeserverUrl
        userId.value = config.userId ?? null
        deviceId.value = config.deviceId ?? null
        accessToken.value = config.accessToken ?? null
        isInitialized.value = true
        connectionState.value = 'CONNECTING'

        matrixClientService.on('connectionState', onConnectionState)
        matrixClientService.on('sync', onSync)
      } catch (error) {
        logger.error('初始化失败:', error)
        connectionState.value = 'ERROR'
        throw error
      }
    }

    async function login(username: string, password: string, deviceName?: string): Promise<boolean> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        const result = await matrixClientService.login(username, password, deviceName)

        if (result.success) {
          userId.value = result.userId ?? null
          deviceId.value = result.deviceId ?? null
          accessToken.value = result.accessToken ?? null
          refreshToken.value = result.refreshToken ?? null
          connectionState.value = 'CONNECTED'

          await settlePostLoginStartup()
          return true
        } else {
          connectionState.value = 'ERROR'
          lastError.value = result.error ?? '登录失败'
          logger.error('登录失败:', result.error)
          return false
        }
      } catch (error) {
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : '登录失败'
        logger.error('登录异常:', error)
        return false
      }
    }

    async function getSSOLoginUrl(identityProviderId?: string): Promise<string> {
      try {
        return await matrixClientService.getSSOLoginUrl(identityProviderId)
      } catch (error) {
        logger.error('获取 SSO 登录 URL 失败:', error)
        throw error
      }
    }

    async function completeSSOLogin(loginToken: string): Promise<boolean> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        const result = await matrixClientService.completeSSOLogin(loginToken)

        if (result.success) {
          userId.value = result.userId ?? null
          deviceId.value = result.deviceId ?? null
          accessToken.value = result.accessToken ?? null
          refreshToken.value = result.refreshToken ?? null
          connectionState.value = 'CONNECTED'

          await settlePostLoginStartup()
          return true
        } else {
          connectionState.value = 'ERROR'
          lastError.value = result.error ?? 'SSO 登录失败'
          logger.error('SSO 登录失败:', result.error)
          return false
        }
      } catch (error) {
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : 'SSO 登录失败'
        logger.error('SSO 登录异常:', error)
        return false
      }
    }

    async function loginWithToken(token: string, uid: string, refreshTokenParam?: string): Promise<boolean> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        const result = await matrixClientService.loginWithToken(token, uid, refreshTokenParam)

        if (result.success) {
          userId.value = result.userId ?? null
          deviceId.value = result.deviceId ?? null
          accessToken.value = result.accessToken ?? null
          refreshToken.value = result.refreshToken ?? refreshTokenParam ?? null
          connectionState.value = 'CONNECTED'

          await settlePostLoginStartup()
          return true
        } else {
          connectionState.value = 'ERROR'
          lastError.value = result.error ?? 'Token 登录失败'
          logger.error('Token 登录失败:', result.error)
          return false
        }
      } catch (error) {
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : 'Token 登录失败'
        logger.error('Token 登录异常:', error)
        return false
      }
    }

    async function logout(): Promise<void> {
      try {
        await matrixClientService.logout()
      } catch (error) {
        logger.error('登出异常:', error)
      } finally {
        userId.value = null
        deviceId.value = null
        accessToken.value = null
        refreshToken.value = null
        connectionState.value = 'DISCONNECTED'
        syncState.value = null
        lastError.value = null
        isInitialized.value = false

        const { useAdminStore } = await import('../admin/admin')
        useAdminStore().clearAdminState()
      }
    }

    async function startClient(): Promise<void> {
      if (!isInitialized.value) {
        throw new Error('客户端未初始化')
      }
      await matrixClientService.startClient()
      matrixCapabilityService.refreshCapabilities()
    }

    async function stopClient(): Promise<void> {
      await matrixClientService.stopClient()
    }

    return {
      connectionState,
      userId,
      deviceId,
      accessToken,
      refreshToken,
      homeserverUrl,
      lastError,
      isInitialized,
      syncState,
      isLoggedIn,
      isConnected,
      initialize,
      login,
      loginWithToken,
      getSSOLoginUrl,
      completeSSOLogin,
      logout,
      startClient,
      stopClient
    }
  },
  {
    persist: {
      // accessToken 需要持久化以便 WEB 端页面刷新后恢复会话
      // 桌面端通过 Tauri SQLite 安全存储，WEB 端使用 localStorage（开发环境）
      pick: ['userId', 'deviceId', 'homeserverUrl', 'accessToken']
    }
  }
)
