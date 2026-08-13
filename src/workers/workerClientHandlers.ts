/**
 * Worker 客户端生命周期处理器
 *
 * 负责 Matrix SDK 客户端的初始化、登录、启动、停止、同步等操作。
 *
 * 从 matrixSdk.worker.ts 拆分，保持原有逻辑不变。
 */

import type { StoreStats } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import type { LoginResult, MatrixClientConfig, SyncOptions } from './matrixWorkerTypes'
import { extractClientConfig, initSDK, state } from './workerState'

/**
 * 初始化 Matrix 客户端（创建新实例，替换旧实例）
 */
export async function handleInitialize(payload: MatrixClientConfig): Promise<void> {
  await initSDK()
  const sdk = state.sdk!

  if (state.client) {
    state.client.stopClient()
    state.client = null
  }

  if (state.slidingSyncInstance) {
    ;(state.slidingSyncInstance as { stop?: () => void }).stop?.()
    state.slidingSyncInstance = null
  }

  const SlidingSyncCtor = (
    sdk as unknown as {
      SlidingSync?: new (
        homeserverUrl: string,
        lists: Map<string, unknown>,
        options: Record<string, unknown>,
        client: import('matrix-js-sdk').MatrixClient,
        timeout?: number
      ) => unknown
    }
  ).SlidingSync

  const lists = new Map()
  lists.set('default', {
    ranges: [[0, 20]],
    sort: ['by_recency'],
    timeline_limit: 10,
    required_state: [
      ['m.room.name', ''],
      ['m.room.avatar', ''],
      ['m.room.encryption', ''],
      ['m.room.member', '*']
    ]
  })

  const clientOpts = {
    baseUrl: payload.homeserverUrl,
    deviceId: payload.deviceId,
    accessToken: payload.accessToken,
    userId: payload.userId,
    useAuthorizationHeader: true,
    allowInsecureHttp: payload.allowInsecureHttp
  }

  const tempClient = sdk.createClient(clientOpts)

  if (SlidingSyncCtor) {
    state.slidingSyncInstance = new SlidingSyncCtor(
      payload.homeserverUrl,
      lists,
      {
        timeline_limit: 10,
        required_state: [
          ['m.room.name', ''],
          ['m.room.avatar', ''],
          ['m.room.encryption', ''],
          ['m.room.member', '*']
        ]
      },
      tempClient,
      2000
    )
    ;(clientOpts as Record<string, unknown>).slidingSync = state.slidingSyncInstance
  }

  state.client = sdk.createClient(clientOpts)
}

/**
 * 使用用户名密码登录
 */
export async function handleLogin(payload: {
  username: string
  password: string
  deviceName?: string
}): Promise<LoginResult> {
  if (!state.client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }

  const loginResponse = await state.client.login('m.login.password', {
    user: payload.username,
    password: payload.password,
    initial_device_display_name: payload.deviceName || 'Tjg Client'
  })

  const loginResult: LoginResult = {
    success: true,
    userId: loginResponse.user_id,
    deviceId: loginResponse.device_id ?? undefined,
    accessToken: loginResponse.access_token
  }

  await handleInitialize({
    ...(extractClientConfig() as MatrixClientConfig),
    accessToken: loginResponse.access_token,
    userId: loginResponse.user_id,
    deviceId: loginResponse.device_id ?? undefined
  })

  return loginResult
}

/**
 * 启动客户端同步
 */
export async function handleStartClient(): Promise<void> {
  if (!state.client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }
  state.client.startClient({
    pendingEventOrdering: 'detached' as const,
    dustyOptions: {
      archive: true
    }
  })
}

/**
 * 停止客户端
 */
export async function handleStopClient(): Promise<void> {
  if (state.client) {
    state.client.stopClient()
  }
}

/**
 * 清理 SDK 持久化存储（IndexedDB store + legacy crypto store + rust-crypto store）。
 * 用于退出登录 / 切换账号时清除本地缓存数据，避免残留。
 */
export async function handleClearStores(): Promise<void> {
  if (state.client) {
    state.client.stopClient()
    await state.client.clearStores()
  }
}

/**
 * 获取 SDK store 缓存统计（对齐后端 CacheStats：hits/misses/evictions/total_entries/memory_usage_bytes/hit_rate）。
 */
export async function handleGetStats(): Promise<StoreStats | null> {
  if (state.client) {
    return state.client.store.getStats()
  }
  return null
}

/**
 * 获取当前 client 实例
 */
export async function handleGetClient(): Promise<unknown> {
  return state.client
}

/**
 * 执行一次同步
 */
export async function handleSyncOnce(options?: SyncOptions): Promise<void> {
  if (!state.client) {
    throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
  }
  await state.client.syncOnce(options as Record<string, unknown>)
}
