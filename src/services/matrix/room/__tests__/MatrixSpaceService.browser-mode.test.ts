/**
 * M-2 反馈循环测试：MatrixSpaceService.getUserSpaces 在浏览器模式下的行为
 *
 * 测试报告根因：
 *   - 浏览器 dev 模式下 test1 导航到空间页 → "无数据，未显示空状态组件"
 *   - 推测：SpaceManager.getUserSpaces() 的 Promise 长时间不 resolve（等待 sync），
 *     导致 useSpaces.load 卡住，loading 永远为 true，骨架屏常驻而非空状态。
 *
 * 本测试验证：
 *   1. 当 manager.getUserSpaces() 挂起时，getUserSpaces() 应在合理时间内超时返回 []（而非永久挂起）
 *   2. 当 client 未就绪时，getUserSpaces() 应立即返回 []（已实现，回归保护）
 *   3. 当 manager.getUserSpaces() 抛错时，fallback 到 client.getRooms()（已实现，回归保护）
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixSpaceService } from '../MatrixSpaceService'

const asMatrixClient = <T extends object>(client: T) => client as unknown as MatrixClient

describe('MatrixSpaceService M-2: 浏览器模式下 getUserSpaces 抗挂起', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
  })

  it('client 为 null 时应立即返回空数组（不抛错、不挂起）', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    const result = await matrixSpaceService.getUserSpaces()

    expect(result).toEqual([])
  })

  it('manager.getUserSpaces() 永不 resolve 时，应在 5s 内超时返回空数组', async () => {
    // 模拟浏览器模式下 SDK 等待 sync 导致的挂起
    const hangingPromise = new Promise<never>(() => {
      // 永不 resolve
    })
    const mockClient = asMatrixClient({
      getSpaceManager: () => ({
        getUserSpaces: () => hangingPromise
      }),
      getRooms: () => []
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const start = Date.now()
    const result = await matrixSpaceService.getUserSpaces()
    const elapsed = Date.now() - start

    // 修复后：3s 超时 + fallback，总耗时应在 4s 内
    expect(elapsed).toBeLessThan(4000)
    // 挂起时应返回空数组
    expect(result).toEqual([])
  }, 10000)

  it('manager.getUserSpaces() 抛错时，应 fallback 到 client.getRooms() 并返回空间房间', async () => {
    const mockSpaceRoom = {
      roomId: '!space:server',
      name: 'Main Space',
      topic: 'Topic',
      getMxcAvatarUrl: () => 'mxc://avatar',
      getJoinedMembers: () => [{ userId: '@u:server' }],
      currentState: { getStateEvents: () => [] },
      isSpaceRoom: () => true
    }
    const mockNormalRoom = {
      isSpaceRoom: () => false
    }
    const mockClient = asMatrixClient({
      getSpaceManager: () => ({
        getUserSpaces: () => Promise.reject(new Error('sync not ready'))
      }),
      getRooms: () => [mockSpaceRoom, mockNormalRoom]
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const result = await matrixSpaceService.getUserSpaces()

    expect(result).toHaveLength(1)
    expect(result[0].spaceId).toBe('!space:server')
  })

  it('manager.getUserSpaces() 抛错且 client.getRooms() 也失败时，应返回空数组', async () => {
    const mockClient = asMatrixClient({
      getSpaceManager: () => ({
        getUserSpaces: () => Promise.reject(new Error('manager error'))
      }),
      getRooms: () => {
        throw new Error('client not ready')
      }
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient)

    const result = await matrixSpaceService.getUserSpaces()

    expect(result).toEqual([])
  })
})
