import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import { clearSenderDeviceCache } from '@/services/matrix/crypto/messageTrustCache'
import { matrixCapabilityService } from '@/services/matrix/MatrixCapabilityService'
import {
  type ConnectionState,
  type LoginResult,
  type MatrixClientConfig,
  matrixClientService
} from '@/services/matrix/MatrixClientService'
import { getMatrixAccessToken } from '@/services/matrix/matrixClientAccessor'
import { persistWebAccessToken } from '@/services/matrix/matrixClientPlatform'
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
    /**
     * AR-07b / B1：token 不再作为 store 状态存在（不做 ref，也不做 computed）。
     *
     * 为什么连 computed 都不行：`computed(() => getMatrixAccessToken())` 没有任何
     * 响应式依赖 ⇒ Pinia 里首次取值后永久缓存，等价于又一份更隐蔽的陈旧副本
     * （首次读在 client 就绪前还会永久得到 null）。改为对外暴露方法，每次现取。
     *
     * B1 续：**refreshToken 也不再存**。它只在登录响应里出现一次，此前为了让
     * `SessionLoginService` 能持久化而在 store 里存了一份 ref，但 `MatrixTokenManager`
     * 续期后只更新 Rust 侧、不回写这份 ref ⇒ 又是一份会陈旧的副本。
     * 现在由 `login/completeSSOLogin/registerGuest` 的返回值直接交给调用方。
     */
    const homeserverUrl = ref<string | null>(null)
    const lastError = ref<string | null>(null)
    const isInitialized = ref(false)
    const syncState = ref<string | null>(null)
    /** 当前会话是否为访客账号（升级为正式账号后置 false） */
    const isGuest = ref(false)

    /**
     * 是否已登录。
     *
     * **只依赖 userId**，刻意不把 token 放进依赖链：
     * - 任何 `computed` 里读 `getMatrixAccessToken()` 都是**非响应式读**，Pinia 会永久缓存首次结果。
     *   冷启动首个读取点若早于 client 就绪，就会缓存 `false` 且再也不会翻转（管理员入口会永久关闭）；
     * - 语义上 userId 只在登录/恢复成功后写入、登出时清空，已足够表达「有会话」。
     *   token 是否存在由会话生命周期保证，不再作为 UI 门控的独立条件。
     */
    const isLoggedIn = computed(() => !!userId.value)
    const isConnected = computed(() => connectionState.value === 'CONNECTED')

    /**
     * 登录/升级/登出时同步浏览器 at-rest 凭证（Tauri 运行期 no-op，凭证由 Rust 保管）。
     *
     * 存在理由：`SessionRestoreService.getStoredTokens()` 的浏览器分支需要冷启动可读的 token；
     * 此前该职责由 `persist.pick` 里的 token 副本顺手承担，现改为显式存储层 + 刷新时同步更新。
     */
    function rememberWebToken(token: string | null | undefined): void {
      persistWebAccessToken(token ?? null)
    }

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
        rememberWebToken(config.accessToken)
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

    async function login(username: string, password: string, deviceName?: string): Promise<LoginResult> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        const result = await matrixClientService.login(username, password, deviceName)

        if (result.success) {
          userId.value = result.userId ?? null
          deviceId.value = result.deviceId ?? null
          rememberWebToken(result.accessToken)
          connectionState.value = 'CONNECTED'
          isGuest.value = false

          await settlePostLoginStartup()
          return { success: true, refreshToken: result.refreshToken }
        } else {
          connectionState.value = 'ERROR'
          lastError.value = result.error ?? '登录失败'
          logger.error('登录失败:', result.error)
          return { success: false }
        }
      } catch (error) {
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : '登录失败'
        logger.error('登录异常:', error)
        return { success: false }
      }
    }

    async function getSSOLoginUrl(): Promise<string> {
      try {
        return await matrixClientService.getSSOLoginUrl()
      } catch (error) {
        logger.error('获取 SSO 登录 URL 失败:', error)
        throw error
      }
    }

    async function completeSSOLogin(loginToken: string): Promise<LoginResult> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        const result = await matrixClientService.completeSSOLogin(loginToken)

        if (result.success) {
          userId.value = result.userId ?? null
          deviceId.value = result.deviceId ?? null
          rememberWebToken(result.accessToken)
          connectionState.value = 'CONNECTED'
          isGuest.value = false

          await settlePostLoginStartup()
          return { success: true, refreshToken: result.refreshToken }
        } else {
          connectionState.value = 'ERROR'
          lastError.value = result.error ?? 'SSO 登录失败'
          logger.error('SSO 登录失败:', result.error)
          return { success: false }
        }
      } catch (error) {
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : 'SSO 登录失败'
        logger.error('SSO 登录异常:', error)
        return { success: false }
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
          rememberWebToken(result.accessToken)
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

    /**
     * 注册并登录访客账号。
     * 仅有服务端支持访客注册时由登录页调用（入口门控见 MatrixAuthService.getGuestSupport）。
     */
    async function registerGuest(deviceName?: string): Promise<LoginResult> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        const result = await matrixClientService.registerGuest(deviceName)

        if (result.success) {
          userId.value = result.userId ?? null
          deviceId.value = result.deviceId ?? null
          rememberWebToken(result.accessToken)
          connectionState.value = 'CONNECTED'
          isGuest.value = true

          await settlePostLoginStartup()
          return { success: true, refreshToken: result.refreshToken }
        }

        connectionState.value = 'ERROR'
        lastError.value = result.error ?? '访客登录失败'
        logger.error('访客登录失败:', result.error)
        return { success: false }
      } catch (error) {
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : '访客登录失败'
        logger.error('访客登录异常:', error)
        return { success: false }
      }
    }

    /**
     * 访客升级为正式账号后同步本地会话身份（client 的 token 已由 MatrixAuthService 切换）。
     *
     * 这不只是「改两个字段」——**MXID 变了就是换账号**，所有带账号维度的缓存都必须失效：
     * - 消息信任缓存 key 是 `${accountUserId}:${senderId}`，不清则旧访客 MXID 的条目永久残留
     *   （登出流程已按同一理由调用 clearSenderDeviceCache，升级属同类身份切换）；
     * - 服务端能力快照（/versions + /capabilities + /client_config）是**以访客凭证取的**，
     *   而 `canUseFriendList()` 直接门控好友扩展、`canUseE2EE()` 门控加密，
     *   不刷新则升级成功后这些能力仍停留在访客判定，必须重启应用才恢复。
     */
    function applyGuestUpgrade(uid: string, token: string): void {
      userId.value = uid
      rememberWebToken(token)
      isGuest.value = false

      clearSenderDeviceCache()

      // 与 startClient 同样采用 fire-and-forget：refreshCapabilities 内部对 HTTP 失败已做
      // null 兜底，这里只需兜住「capability store 尚未就绪」这类同步抛出，不能让它中断升级流程。
      void matrixCapabilityService.refreshCapabilities().catch((error) => {
        logger.warn('访客升级后刷新服务端能力失败（将沿用旧快照）:', error)
      })
    }

    async function logout(): Promise<void> {
      try {
        await matrixClientService.logout()
      } catch (error) {
        logger.error('登出异常:', error)
      } finally {
        userId.value = null
        deviceId.value = null
        rememberWebToken(null)
        connectionState.value = 'DISCONNECTED'
        syncState.value = null
        lastError.value = null
        isInitialized.value = false
        isGuest.value = false

        const { resetAdminState } = await import('@/stores/domains/admin/bridge')
        await resetAdminState()
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

    async function reconnect(): Promise<void> {
      try {
        lastError.value = null
        connectionState.value = 'CONNECTING'
        await matrixClientService.startClient()
        connectionState.value = 'CONNECTED'
      } catch (error) {
        logger.error('重连失败:', error)
        connectionState.value = 'ERROR'
        lastError.value = error instanceof Error ? error.message : '重连失败'
      }
    }

    return {
      connectionState,
      userId,
      deviceId,
      /** token 现取，不作为状态（见上方注释）；消费方切勿缓存其返回值 */
      getAccessToken: getMatrixAccessToken,
      homeserverUrl,
      lastError,
      isInitialized,
      syncState,
      isGuest,
      isLoggedIn,
      isConnected,
      initialize,
      login,
      loginWithToken,
      registerGuest,
      applyGuestUpgrade,
      getSSOLoginUrl,
      completeSSOLogin,
      logout,
      startClient,
      stopClient,
      reconnect
    }
  },
  {
    persist: {
      // AR-07b / B1：accessToken 已移出持久化 —— token 不是应用状态。
      // 桌面走 Rust 安全存储（update_token），浏览器走 matrixClientPlatform 的
      // at-rest 存储（persistWebAccessToken，刷新时同步更新）。
      pick: ['userId', 'deviceId', 'homeserverUrl', 'isGuest']
    }
  }
)
