import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminRetentionService } from '../RetentionService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  getRetentionPolicy: vi.fn(),
  getRoomRetentionPolicy: vi.fn(),
  setRoomRetentionPolicy: vi.fn(),
  runRetention: vi.fn(),
  getRetentionStatus: vi.fn()
})

const makeClient = () => ({
  getStateEvent: vi.fn(),
  sendStateEvent: vi.fn(),
  redact: vi.fn(),
  getServerRetention: vi.fn()
})

describe('AdminRetentionService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let client: ReturnType<typeof makeClient>
  let service: AdminRetentionService

  beforeEach(() => {
    admin = makeAdmin()
    client = makeClient()
    service = new AdminRetentionService(
      async () => admin as unknown as AdminManager,
      () => client as unknown as MatrixClient
    )
  })

  it('getRetentionPolicies 将单一策略包装为列表，出错时降级为空', async () => {
    admin.getRetentionPolicy.mockResolvedValueOnce({ max_lifetime: 86400 })
    await expect(service.getRetentionPolicies()).resolves.toEqual({
      policies: [{ max_lifetime: 86400 }],
      nextToken: undefined
    })

    admin.getRetentionPolicy.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getRetentionPolicies()).resolves.toEqual({ policies: [] })
  })

  it('setRetentionPolicy 只携带已提供的生命周期字段', async () => {
    admin.setRoomRetentionPolicy.mockResolvedValue(undefined)

    await service.setRetentionPolicy('!r:hs', 1000)
    expect(admin.setRoomRetentionPolicy).toHaveBeenCalledWith('!r:hs', { max_lifetime: 1000 })

    await service.setRetentionPolicy('!r:hs', undefined, 500)
    expect(admin.setRoomRetentionPolicy).toHaveBeenLastCalledWith('!r:hs', { min_lifetime: 500 })
  })

  it('runRetentionTask 失败时向上抛出', async () => {
    admin.runRetention.mockRejectedValueOnce(new Error('task-fail'))
    await expect(service.runRetentionTask()).rejects.toThrow('task-fail')
  })

  it('getRoomRetention 读取 m.room.retention 状态事件', async () => {
    // SDK 的方法是 `client.getStateEvent(roomId, eventType, stateKey?)`（`client.d.ts:3279`）；
    // `getRoomStateEvent` 是早期被清理掉的幻影方法名，实现早已改成 `getStateEvent`，测试没跟上。
    client.getStateEvent.mockResolvedValueOnce({ min_lifetime: 100, max_lifetime: 200 })

    await expect(service.getRoomRetention('!r:hs')).resolves.toEqual({
      roomId: '!r:hs',
      policy: { min_lifetime: 100, max_lifetime: 200 }
    })
    expect(client.getStateEvent).toHaveBeenCalledWith('!r:hs', 'm.room.retention', '')
  })

  it('getRoomRetention 出错时仅返回 roomId', async () => {
    client.getStateEvent.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getRoomRetention('!r:hs')).resolves.toEqual({ roomId: '!r:hs' })
  })

  it('setRoomRetention 通过状态事件写入策略', async () => {
    client.sendStateEvent.mockResolvedValueOnce({})
    await service.setRoomRetention('!r:hs', { max_lifetime: 999 })
    expect(client.sendStateEvent).toHaveBeenCalledWith('!r:hs', 'm.room.retention', { max_lifetime: 999 }, '')
  })

  it('未提供 getClient 时 client API 方法抛错', async () => {
    const headlessService = new AdminRetentionService(async () => admin as unknown as AdminManager)
    await expect(headlessService.getRoomRetention('!r:hs')).rejects.toThrow('getClient not provided')
    await expect(headlessService.setRoomRetention('!r:hs', {})).rejects.toThrow('getClient not provided')
  })

  it('getDefaultRetention 出错时返回 null', async () => {
    client.getServerRetention.mockResolvedValueOnce({ max_lifetime: 1 })
    await expect(service.getDefaultRetention()).resolves.toEqual({ max_lifetime: 1 })

    client.getServerRetention.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getDefaultRetention()).resolves.toBeNull()
  })
})
