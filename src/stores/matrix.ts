import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixClientService, type ConnectionState, type MatrixClientConfig } from '@/services/matrix'

export const useMatrixStore = defineStore(StoresEnum.MATRIX, () => {
  const connectionState = ref<ConnectionState>('DISCONNECTED')
  const userId = ref<string | null>(null)
  const deviceId = ref<string | null>(null)
  const accessToken = ref<string | null>(null)
  const homeserverUrl = ref<string | null>(null)
  const isInitialized = ref(false)
  const syncState = ref<string | null>(null)

  const isLoggedIn = computed(() => !!userId.value && !!accessToken.value)
  const isConnected = computed(() => connectionState.value === 'CONNECTED')

  async function initialize(config: MatrixClientConfig): Promise<void> {
    try {
      await matrixClientService.initialize(config)
      homeserverUrl.value = config.homeserverUrl
      userId.value = config.userId ?? null
      deviceId.value = config.deviceId ?? null
      accessToken.value = config.accessToken ?? null
      isInitialized.value = true
      connectionState.value = 'CONNECTING'

      matrixClientService.on('connectionState', ({ state }: { state: string }) => {
        connectionState.value = state.toUpperCase() as ConnectionState
      })

      matrixClientService.on('sync', ({ state }: { state: string }) => {
        syncState.value = state
      })
    } catch (error) {
      console.error('[MatrixStore] 初始化失败:', error)
      connectionState.value = 'ERROR'
      throw error
    }
  }

  async function login(username: string, password: string, deviceName?: string): Promise<boolean> {
    try {
      connectionState.value = 'CONNECTING'
      const result = await matrixClientService.login(username, password, deviceName)

      if (result.success) {
        userId.value = result.userId ?? null
        deviceId.value = result.deviceId ?? null
        accessToken.value = result.accessToken ?? null
        connectionState.value = 'CONNECTED'

        await matrixClientService.startClient()
        return true
      } else {
        connectionState.value = 'ERROR'
        console.error('[MatrixStore] 登录失败:', result.error)
        return false
      }
    } catch (error) {
      connectionState.value = 'ERROR'
      console.error('[MatrixStore] 登录异常:', error)
      return false
    }
  }

  async function getSSOLoginUrl(identityProviderId?: string): Promise<string> {
    try {
      return await matrixClientService.getSSOLoginUrl(identityProviderId)
    } catch (error) {
      console.error('[MatrixStore] 获取 SSO 登录 URL 失败:', error)
      throw error
    }
  }

  async function completeSSOLogin(loginToken: string): Promise<boolean> {
    try {
      connectionState.value = 'CONNECTING'
      const result = await matrixClientService.completeSSOLogin(loginToken)

      if (result.success) {
        userId.value = result.userId ?? null
        deviceId.value = result.deviceId ?? null
        accessToken.value = result.accessToken ?? null
        connectionState.value = 'CONNECTED'

        await matrixClientService.startClient()
        return true
      } else {
        connectionState.value = 'ERROR'
        console.error('[MatrixStore] SSO 登录失败:', result.error)
        return false
      }
    } catch (error) {
      connectionState.value = 'ERROR'
      console.error('[MatrixStore] SSO 登录异常:', error)
      return false
    }
  }

  async function loginWithToken(token: string, uid: string): Promise<boolean> {
    try {
      connectionState.value = 'CONNECTING'
      const result = await matrixClientService.loginWithToken(token, uid)

      if (result.success) {
        userId.value = result.userId ?? null
        accessToken.value = result.accessToken ?? null
        connectionState.value = 'CONNECTED'

        await matrixClientService.startClient()
        return true
      } else {
        connectionState.value = 'ERROR'
        console.error('[MatrixStore] Token 登录失败:', result.error)
        return false
      }
    } catch (error) {
      connectionState.value = 'ERROR'
      console.error('[MatrixStore] Token 登录异常:', error)
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await matrixClientService.logout()
    } catch (error) {
      console.error('[MatrixStore] 登出异常:', error)
    } finally {
      userId.value = null
      deviceId.value = null
      accessToken.value = null
      connectionState.value = 'DISCONNECTED'
      syncState.value = null
      isInitialized.value = false
    }
  }

  async function startClient(): Promise<void> {
    if (!isInitialized.value) {
      throw new Error('客户端未初始化')
    }
    await matrixClientService.startClient()
  }

  async function stopClient(): Promise<void> {
    await matrixClientService.stopClient()
  }

  function getClient() {
    return matrixClientService.getClient()
  }

  return {
    connectionState,
    userId,
    deviceId,
    accessToken,
    homeserverUrl,
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
    stopClient,
    getClient
  }
})
