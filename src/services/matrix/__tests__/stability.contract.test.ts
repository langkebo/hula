/**
 * 稳定性契约测试 — 合入门槛
 *
 * 强制断言：重复触发关键操作时，底层副作用（createClient / SDK startClient /
 * HTTP 请求 / event handler 注册）只发生一次。
 *
 * 覆盖的契约：
 * 1. initialize 相同配置重复 → createClient 调用次数 = 1
 * 2. startClient 并发/串行重复 → SDK startClient 调用次数 = 1
 * 3. startClient 失败后重试 → guard 不置 settled，允许重新执行
 * 4. stopClient 后 startClient → guard 已 reset，允许重新执行
 *
 * 使用 withDuplicateTrigger 助手统一重复触发模式。
 */
import * as sdk from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withDuplicateTrigger } from '@/testing/withDuplicateTrigger'
import { matrixClientService } from '../MatrixClientService'
import { __resetConnectionManagerSingletonForTesting } from '../MatrixConnectionManager'

// ─── Mocks（与 MatrixClientService.spec.ts 保持一致） ──────────────────────────

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn()
}))

vi.mock('../sdk-compat', () => ({
  ensureMatrixSdkCompat: vi.fn(),
  extendMatrixClientWithManagers: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('matrix-js-sdk/friend', () => ({
  extendMatrixClient: vi.fn()
}))

vi.mock('@/services/secure/cryptoStorageKey', () => ({
  getOrCreateCryptoStoragePassword: vi.fn().mockResolvedValue(null),
  clearCryptoStoragePasswordCache: vi.fn(),
  deleteCryptoStoragePassword: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/stores/domains/chat/capability', () => ({
  useCapabilityStore: () => ({
    setExtensionHealthBatch: vi.fn(),
    setExtensionHealth: vi.fn(),
    resetExtensionHealth: vi.fn()
  })
}))

vi.mock('matrix-js-sdk', () => {
  const mockClient = {
    login: vi.fn(),
    loginRequest: vi.fn(),
    loginWithPassword: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    startClient: vi.fn().mockResolvedValue(undefined),
    stopClient: vi.fn(),
    setAccessToken: vi.fn(),
    getFriendManager: vi.fn(() => ({ start: vi.fn() })),
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    getUserId: vi.fn().mockReturnValue('@user:example.com'),
    getDeviceId: vi.fn().mockReturnValue('DEVICE_ID'),
    getAccessToken: vi.fn().mockReturnValue('ACCESS_TOKEN'),
    isSlidingSyncSupported: vi.fn().mockResolvedValue(false),
    mxcUrlToHttp: vi.fn().mockReturnValue(null)
  }

  return {
    createClient: vi.fn(() => mockClient),
    initializeManagerExtensions: vi.fn().mockResolvedValue(undefined),
    PendingEventOrdering: { Detached: 'detached' },
    SlidingSync: class {
      start = vi.fn()
      stop = vi.fn()
    }
  }
})

// ─── 测试辅助 ──────────────────────────────────────────────────────────────────

type Internals = {
  connectionManager: {
    resetState: () => void
  }
  connectionState: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'
  startClientGuard: {
    isSettled: boolean
    reset(): void
  }
}

const internals = () => matrixClientService as unknown as Internals

const baseConfig = {
  homeserverUrl: 'https://matrix.example.com',
  userId: '@test:example.com',
  deviceId: 'TEST_DEVICE',
  accessToken: 'test_token'
}

const getMockClient = () =>
  sdk.createClient({ baseUrl: '' }) as unknown as {
    startClient: ReturnType<typeof vi.fn>
    stopClient: ReturnType<typeof vi.fn>
  }

beforeEach(() => {
  vi.clearAllMocks()
  __resetConnectionManagerSingletonForTesting()
  internals().connectionManager.resetState()
  internals().connectionState = 'DISCONNECTED'
  internals().startClientGuard.reset()
})

// ─── 契约 1: initialize 相同配置重复 → createClient 调用次数 = 1 ──────────────────
// 注：initialize 的并发去重依赖 shouldReuse 判断已存在的 client，
// 仅串行场景（首次完成后再次调用）受保护。并发场景需要 SingleFlight 强化，
// 属于 Phase 1 ① 单例强化的后续工作。

describe('稳定性契约 1: initialize 相同配置串行重复触发', () => {
  it('串行重复 3 次，createClient 只调用 1 次', async () => {
    const { results } = await withDuplicateTrigger(() => matrixClientService.initialize(baseConfig), {
      mode: 'serial',
      times: 3
    })

    expect(sdk.createClient).toHaveBeenCalledTimes(1)
    // 三次返回的 client 引用相同
    expect(results.every((r) => r === results[0])).toBe(true)
  })
})

// ─── 契约 2: startClient 并发/串行重复 → SDK startClient 调用次数 = 1 ────────────

describe('稳定性契约 2: startClient 重复触发', () => {
  it('串行重复 3 次，SDK startClient 只调用 1 次', async () => {
    await matrixClientService.initialize(baseConfig)
    const startSpy = vi.spyOn(getMockClient(), 'startClient')

    await withDuplicateTrigger(() => matrixClientService.startClient(), { mode: 'serial', times: 3 })

    expect(startSpy).toHaveBeenCalledTimes(1)
  })

  it('并发重复 3 次，SDK startClient 只调用 1 次', async () => {
    await matrixClientService.initialize(baseConfig)
    const startSpy = vi.spyOn(getMockClient(), 'startClient')

    const { allSameReference } = await withDuplicateTrigger(() => matrixClientService.startClient(), {
      mode: 'concurrent',
      times: 3
    })

    expect(startSpy).toHaveBeenCalledTimes(1)
    expect(allSameReference).toBe(true)
  })
})

// ─── 契约 3: startClient 失败后重试 → guard 不置 settled ─────────────────────────

describe('稳定性契约 3: startClient 失败后允许重试', () => {
  it('首次失败后 guard 未 settled，第二次成功后 settled', async () => {
    await matrixClientService.initialize(baseConfig)
    const startSpy = vi.spyOn(getMockClient(), 'startClient')

    // 第一次失败
    startSpy.mockRejectedValueOnce(new Error('network error'))
    await expect(matrixClientService.startClient()).rejects.toThrow('network error')
    expect(internals().startClientGuard.isSettled).toBe(false)

    // 第二次成功
    await matrixClientService.startClient()
    expect(internals().startClientGuard.isSettled).toBe(true)
    expect(startSpy).toHaveBeenCalledTimes(2)
  })
})

// ─── 契约 4: stopClient 后 startClient → guard 已 reset ──────────────────────────

describe('稳定性契约 4: stopClient 后 startClient 可重新执行', () => {
  it('stopClient 后 guard 已 reset，startClient 重新触发 SDK startClient', async () => {
    await matrixClientService.initialize(baseConfig)
    const startSpy = vi.spyOn(getMockClient(), 'startClient')

    await matrixClientService.startClient()
    expect(startSpy).toHaveBeenCalledTimes(1)

    await matrixClientService.stopClient()
    expect(internals().startClientGuard.isSettled).toBe(false)

    await matrixClientService.startClient()
    expect(startSpy).toHaveBeenCalledTimes(2)
  })
})
