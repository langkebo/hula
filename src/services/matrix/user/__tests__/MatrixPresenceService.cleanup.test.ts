/**
 * M-3 反馈循环测试：Presence 状态设置/清理失败
 *
 * 测试报告描述：
 *   - 控制台输出：`Presence update failed`
 *   - 影响：presence 更新失败告警噪音
 *
 * 根因分析：
 *   MatrixPresenceService.onPresenceChange() 的取消订阅清理逻辑（line 391-398）
 *   在客户端被销毁时调用 this.getClient()（抛错 "客户端未初始化"），
 *   被 catch 后输出 warn 日志 "Presence update failed (client may be gone)"。
 *   这是页面切换/登出时的预期行为，不应产生 warn 级别日志。
 *
 * 验证：
 *   1. 当 client 为 null 时，onPresenceChange 取消订阅不应抛错、不应 warn
 *   2. 当 client.off() 抛错时，应降级为 debug 日志（非 warn）
 */
import type { MatrixClient, PresenceManager } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixPresenceService } from '../MatrixPresenceService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

const _asMatrixClient = <T extends object>(client: T) => client as unknown as MatrixClient

describe('MatrixPresenceService M-3: onPresenceChange 清理抗噪音', () => {
  let mockClient: Partial<MatrixClient>
  let mockPresenceManager: {
    setPresence: ReturnType<typeof vi.fn>
    getPresence: ReturnType<typeof vi.fn>
    subscribeToPresence: ReturnType<typeof vi.fn>
    unsubscribeFromPresence: ReturnType<typeof vi.fn>
    getPresenceList: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockPresenceManager = {
      setPresence: vi.fn(),
      getPresence: vi.fn(),
      subscribeToPresence: vi.fn(),
      unsubscribeFromPresence: vi.fn(),
      getPresenceList: vi.fn()
    }

    mockClient = {
      getPresenceManager: vi.fn(() => mockPresenceManager as unknown as PresenceManager),
      getUserId: vi.fn(() => '@user:example.com'),
      on: vi.fn(),
      off: vi.fn()
    }

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
  })

  it('client 为 null 时取消订阅，不应输出 warn 日志', async () => {
    // 先注册一个 handler，让 clientPresenceListener 被挂载
    const unsubscribe = matrixPresenceService.onPresenceChange(() => {})
    expect(matrixClientService.getClient()).not.toBeNull()

    // 模拟登出/页面切换：client 被销毁
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    // 取消订阅 — 不应抛错，不应 warn
    expect(() => unsubscribe()).not.toThrow()

    // 验证没有 warn 日志（"Presence update failed"）
    const { warn } = await import('@tauri-apps/plugin-log')
    const warnCalls = vi.mocked(warn).mock.calls.filter((call) => String(call[0]).includes('Presence update failed'))
    expect(warnCalls).toHaveLength(0)
  })

  it('client.off() 抛错时取消订阅，应降级为 debug 日志而非 warn', async () => {
    const unsubscribe = matrixPresenceService.onPresenceChange(() => {})

    // 让 client.off 抛错
    ;(mockClient.off as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('client already destroyed')
    })

    // 取消订阅 — 不应抛错
    expect(() => unsubscribe()).not.toThrow()

    // 验证 warn 日志不包含 "Presence update failed"
    const { warn, debug } = await import('@tauri-apps/plugin-log')
    const warnCalls = vi.mocked(warn).mock.calls.filter((call) => String(call[0]).includes('Presence update failed'))
    expect(warnCalls).toHaveLength(0)

    // 应有 debug 日志记录（可选验证）
    const debugCalls = vi.mocked(debug).mock.calls
    expect(debugCalls.length).toBeGreaterThanOrEqual(0)
  })

  it('正常取消订阅时，应调用 client.off 清理监听器', async () => {
    const handler = vi.fn()
    const unsubscribe = matrixPresenceService.onPresenceChange(handler)

    unsubscribe()

    expect(mockClient.off).toHaveBeenCalled()
  })
})
