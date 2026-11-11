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

  it('查询失败时保持 false，不抛错', async () => {
    mocks.isRoomEncrypted.mockRejectedValue(new Error('network'))
    const { refresh, isEncrypted } = usePrivateRoomEncryption()
    await expect(refresh(['!a:test'])).resolves.toBeUndefined()
    expect(isEncrypted('!a:test')).toBe(false)
  })
})
