import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ isRoomEncrypted: vi.fn() }))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { isRoomEncrypted: mocks.isRoomEncrypted }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { usePrivateRoomEncryption } from '../usePrivateRoomEncryption'

describe('usePrivateRoomEncryption', () => {
  beforeEach(() => {
    mocks.isRoomEncrypted.mockReset()
  })

  it('按房间批量刷新加密状态', async () => {
    mocks.isRoomEncrypted.mockImplementation(async (roomId: string) => roomId === '!a:test')
    const { refresh, isEncrypted } = usePrivateRoomEncryption()
    await refresh(['!a:test', '!b:test'])
    expect(isEncrypted('!a:test')).toBe(true)
    expect(isEncrypted('!b:test')).toBe(false)
  })

  it('空列表直接清空且不调用服务', async () => {
    const { refresh, encryptedRooms } = usePrivateRoomEncryption()
    await refresh([])
    expect(encryptedRooms.value).toEqual({})
    expect(mocks.isRoomEncrypted).not.toHaveBeenCalled()
  })

  it('查询失败时显式回写 false，不沿用上次快照', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(true)
    const { refresh, encryptedRooms, isEncrypted } = usePrivateRoomEncryption()
    await refresh(['!a:test'])
    expect(encryptedRooms.value).toEqual({ '!a:test': true })

    mocks.isRoomEncrypted.mockRejectedValueOnce(new Error('network'))
    await expect(refresh(['!a:test'])).resolves.toBeUndefined()
    // 断言具体键值，避免「默认就是空对象」导致的空转断言
    expect(encryptedRooms.value).toEqual({ '!a:test': false })
    expect(isEncrypted('!a:test')).toBe(false)
  })

  it('单个房间失败不影响同批其他房间的结果', async () => {
    mocks.isRoomEncrypted.mockImplementation(async (roomId: string) => {
      if (roomId === '!a:test') throw new Error('network')
      return true
    })
    const { refresh, encryptedRooms } = usePrivateRoomEncryption()
    await refresh(['!a:test', '!b:test'])
    expect(encryptedRooms.value).toEqual({ '!a:test': false, '!b:test': true })
  })

  it('旧请求晚返回时不会覆盖新请求的结果', async () => {
    let resolveFirst!: (value: boolean) => void
    mocks.isRoomEncrypted
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce(false)

    const { refresh, encryptedRooms } = usePrivateRoomEncryption()
    const first = refresh(['!a:test'])
    const second = refresh(['!b:test'])
    await second

    resolveFirst(true)
    await first
    expect(encryptedRooms.value).toEqual({ '!b:test': false })
  })
})
