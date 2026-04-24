/**
 * Matrix SDK Web Worker
 * 负责在独立线程中处理 Matrix SDK 初始化、同步、事件处理等耗时操作
 * 确保主线程阻塞时间 < 50ms
 */

import type { MatrixClientConfig, SyncOptions, LoginResult } from './matrixWorkerTypes'

export interface WorkerMessage {
  type: string
  id: string
  payload?: unknown
}

export interface WorkerResponse {
  type: string
  id: string
  success: boolean
  data?: unknown
  error?: string
}

let sdk: typeof import('matrix-js-sdk') | null = null
let client: import('matrix-js-sdk').MatrixClient | null = null
let slidingSyncInstance: unknown = null

const _pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
  }
>()

function _generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function sendResponse(type: string, id: string, success: boolean, data?: unknown, error?: string): Promise<void> {
  const response: WorkerResponse = { type, id, success, data, error }
  self.postMessage(response)
}

async function initSDK(): Promise<void> {
  if (sdk) return
  sdk = await import('matrix-js-sdk')
  const sdkModule = sdk as unknown as { initLogger?: () => void }
  if (typeof sdkModule.initLogger === 'function') {
    sdkModule.initLogger()
  }
}

async function handleInitialize(payload: MatrixClientConfig): Promise<void> {
  await initSDK()

  if (client) {
    client.stopClient()
    client = null
  }

  if (slidingSyncInstance) {
    ;(slidingSyncInstance as { stop?: () => void }).stop?.()
    slidingSyncInstance = null
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
    useAuthorizationHeader: true
  }

  const tempClient = sdk!.createClient(clientOpts)

  if (SlidingSyncCtor) {
    slidingSyncInstance = new SlidingSyncCtor(
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
    ;(clientOpts as Record<string, unknown>).slidingSync = slidingSyncInstance
  }

  client = sdk!.createClient(clientOpts)
}

async function handleLogin(payload: { username: string; password: string; deviceName?: string }): Promise<LoginResult> {
  if (!client) {
    throw new Error('客户端未初始化')
  }

  const loginResponse = await client.login('m.login.password', {
    user: payload.username,
    password: payload.password,
    initial_device_display_name: payload.deviceName || 'HuLa Client'
  })

  const loginResult: LoginResult = {
    success: true,
    userId: loginResponse.user_id,
    deviceId: loginResponse.device_id ?? undefined,
    accessToken: loginResponse.access_token
  }

  await handleInitialize({
    ...(client as unknown as MatrixClientConfig),
    accessToken: loginResponse.access_token,
    userId: loginResponse.user_id,
    deviceId: loginResponse.device_id ?? undefined
  })

  return loginResult
}

async function handleStartClient(): Promise<void> {
  if (!client) {
    throw new Error('客户端未初始化')
  }
  client.startClient({
    pendingEventOrdering: 'detached' as const,
    dustyOptions: {
      archive: true
    }
  })
}

async function handleStopClient(): Promise<void> {
  if (client) {
    client.stopClient()
  }
}

async function handleGetClient(): Promise<unknown> {
  return client
}

async function handleSyncOnce(options?: SyncOptions): Promise<void> {
  if (!client) {
    throw new Error('客户端未初始化')
  }
  await client.syncOnce(options as Record<string, unknown>)
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, payload } = event.data

  try {
    switch (type) {
      case 'initialize':
        await handleInitialize(payload as MatrixClientConfig)
        await sendResponse(type, id, true)
        break

      case 'login': {
        const loginResult = await handleLogin(payload as { username: string; password: string; deviceName?: string })
        await sendResponse(type, id, true, loginResult)
        break
      }

      case 'startClient':
        await handleStartClient()
        await sendResponse(type, id, true)
        break

      case 'stopClient':
        await handleStopClient()
        await sendResponse(type, id, true)
        break

      case 'getClient': {
        const clientData = await handleGetClient()
        await sendResponse(type, id, true, clientData)
        break
      }

      case 'syncOnce':
        await handleSyncOnce(payload as SyncOptions)
        await sendResponse(type, id, true)
        break

      case 'ping':
        await sendResponse(type, id, true, { timestamp: Date.now() })
        break

      default:
        await sendResponse(type, id, false, undefined, `Unknown message type: ${type}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await sendResponse(type, id, false, undefined, errorMessage)
  }
}

self.postMessage({ type: 'ready', id: 'init', success: true })
