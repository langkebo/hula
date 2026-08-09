import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBurnAfterRead } from '../useBurnAfterRead'

vi.mock('@/services/matrix/messaging/MatrixBurnAfterReadService', () => ({
  matrixBurnAfterReadService: {
    cancelBurn: vi.fn().mockResolvedValue(true),
    getPendingBurns: vi
      .fn()
      .mockResolvedValue([{ eventId: '$evt1:server', createdAt: 1700000000000, deleteAt: 1700000060000 }]),
    setBurnConfig: vi.fn().mockResolvedValue(60000),
    getBurnStats: vi.fn().mockResolvedValue({
      totalBurned: 10,
      totalPending: 3,
      roomsWithBurnEnabled: 2
    }),
    enableBurn: vi.fn().mockResolvedValue({ enabled: true, burnAfterMs: 60000 }),
    disableBurn: vi.fn().mockResolvedValue({ enabled: false, burnAfterMs: 0 }),
    getBurnSettings: vi.fn().mockResolvedValue(null),
    isBurnEnabled: vi.fn().mockResolvedValue(false),
    markBurnRead: vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room1:server' })
}))

describe('useBurnAfterRead complete API surface', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exposes cancelBurn that delegates to service', async () => {
    const { cancelBurn } = useBurnAfterRead()
    const result = await cancelBurn('!room1:server', '$evt1:server')
    expect(result).toBe(true)
    const { matrixBurnAfterReadService } = await import('@/services/matrix/messaging/MatrixBurnAfterReadService')
    expect(matrixBurnAfterReadService.cancelBurn).toHaveBeenCalledWith('!room1:server', '$evt1:server')
  })

  it('exposes getPendingBurns that returns mapped BurnPendingEvent[]', async () => {
    const { getPendingBurns } = useBurnAfterRead()
    const result = await getPendingBurns('!room1:server')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      eventId: '$evt1:server',
      createdAt: 1700000000000,
      deleteAt: 1700000060000
    })
  })

  it('exposes setBurnConfig that returns defaultBurnMs', async () => {
    const { setBurnConfig } = useBurnAfterRead()
    const result = await setBurnConfig(60000)
    expect(result).toBe(60000)
  })

  it('exposes getBurnStats that returns real stats from service (not hardcoded 0)', async () => {
    const { getBurnStats } = useBurnAfterRead()
    const result = await getBurnStats()
    expect(result).toEqual({
      totalBurned: 10,
      totalPending: 3,
      roomsWithBurnEnabled: 2
    })
  })
})
