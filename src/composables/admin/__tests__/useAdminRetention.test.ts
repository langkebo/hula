import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRetention } from '../useAdminRetention'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getRetentionPolicies: vi.fn().mockResolvedValue({ policies: [] }),
    getRetentionStatus: vi.fn().mockResolvedValue({ running: false }),
    getDefaultRetention: vi.fn().mockResolvedValue(null),
    getRoomRetention: vi.fn().mockResolvedValue({ roomId: '!x:s' }),
    setRoomRetention: vi.fn().mockResolvedValue(undefined),
    deleteRoomRetention: vi.fn().mockResolvedValue(undefined),
    setRetentionPolicy: vi.fn().mockResolvedValue(undefined),
    runRetentionTask: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix/admin'

describe('useAdminRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadAll 同时加载策略列表、状态与默认策略', async () => {
    vi.mocked(adminService.getRetentionPolicies).mockResolvedValueOnce({
      policies: [{ room_id: '!x:s', min_lifetime: 1000, max_lifetime: 2000 }]
    } as never)
    vi.mocked(adminService.getRetentionStatus).mockResolvedValueOnce({ running: true })
    vi.mocked(adminService.getDefaultRetention).mockResolvedValueOnce({ max_lifetime: 9000 })

    const c = useAdminRetention()
    await c.loadAll()

    expect(adminService.getRetentionPolicies).toHaveBeenCalledTimes(1)
    expect(adminService.getRetentionStatus).toHaveBeenCalledTimes(1)
    expect(adminService.getDefaultRetention).toHaveBeenCalledTimes(1)
    expect(c.policies.value).toEqual([{ roomId: '!x:s', minLifetime: 1000, maxLifetime: 2000 }])
    expect(c.retentionStatus.value).toEqual({ running: true })
    expect(c.defaultRetention.value).toEqual({ max_lifetime: 9000 })
    expect(c.loading.value).toBe(false)
  })

  it('loadDefaultRetention 复位 loading', async () => {
    const c = useAdminRetention()
    await c.loadDefaultRetention()
    expect(c.defaultRetention.value).toBeNull()
    expect(c.defaultLoading.value).toBe(false)
  })

  it('loadRoomPolicy 裁剪空白并写入读取结果', async () => {
    vi.mocked(adminService.getRoomRetention).mockResolvedValueOnce({
      roomId: '!x:s',
      policy: { min_lifetime: 1000 }
    })
    const c = useAdminRetention()
    await c.loadRoomPolicy('  !x:s  ')
    expect(adminService.getRoomRetention).toHaveBeenCalledWith('!x:s')
    expect(c.roomPolicy.value?.policy).toEqual({ min_lifetime: 1000 })
    expect(c.roomPolicyLoading.value).toBe(false)
  })

  it('loadRoomPolicy 空白房间 ID 清空结果且不请求', async () => {
    const c = useAdminRetention()
    await c.loadRoomPolicy('   ')
    expect(adminService.getRoomRetention).not.toHaveBeenCalled()
    expect(c.roomPolicy.value).toBeNull()
  })

  it('loadRoomPolicy 失败时抛出并复位 loading', async () => {
    vi.mocked(adminService.getRoomRetention).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminRetention()
    await expect(c.loadRoomPolicy('!x:s')).rejects.toThrow('boom')
    expect(c.roomPolicyLoading.value).toBe(false)
  })

  it('setRoomPolicy 写入后回读服务端策略', async () => {
    vi.mocked(adminService.getRoomRetention).mockResolvedValueOnce({
      roomId: '!x:s',
      policy: { min_lifetime: 500, max_lifetime: 800 }
    })
    const c = useAdminRetention()
    await c.setRoomPolicy('!x:s', { min_lifetime: 500, max_lifetime: 800 })

    expect(adminService.setRoomRetention).toHaveBeenCalledWith('!x:s', {
      min_lifetime: 500,
      max_lifetime: 800
    })
    expect(adminService.getRoomRetention).toHaveBeenCalledWith('!x:s')
    expect(c.roomPolicy.value?.policy).toEqual({ min_lifetime: 500, max_lifetime: 800 })
    expect(c.roomWriteLoading.value).toBe(false)
  })

  it('setRoomPolicy 失败时抛出并复位 loading', async () => {
    vi.mocked(adminService.setRoomRetention).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminRetention()
    await expect(c.setRoomPolicy('!x:s', { min_lifetime: 500 })).rejects.toThrow('boom')
    expect(c.roomWriteLoading.value).toBe(false)
  })

  it('deleteRoomPolicy 删除后回读，回读为空表示回落默认策略', async () => {
    const c = useAdminRetention()
    await c.deleteRoomPolicy('!x:s')

    expect(adminService.deleteRoomRetention).toHaveBeenCalledWith('!x:s')
    expect(adminService.getRoomRetention).toHaveBeenCalledWith('!x:s')
    expect(c.roomPolicy.value).toEqual({ roomId: '!x:s' })
    expect(c.roomWriteLoading.value).toBe(false)
  })

  it('deleteRoomPolicy 失败时抛出并复位 loading', async () => {
    vi.mocked(adminService.deleteRoomRetention).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminRetention()
    await expect(c.deleteRoomPolicy('!x:s')).rejects.toThrow('boom')
    expect(c.roomWriteLoading.value).toBe(false)
  })
})
