import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

const getClientMock = vi.hoisted(() => vi.fn())
vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: getClientMock },
  default: { getClient: getClientMock }
}))

import { cryptoSDKAdapter } from '../CryptoSDKAdapter'

/**
 * 安全回归：房间加密状态查询不得在"未知"时静默返回"未加密"。
 *
 * 历史缺陷（A3）：`isRoomEncrypted` 在 `client.getRoom(roomId)` 为 null 时直接
 * `return false`。"房间尚未加载"与"房间确实未加密"无法区分，而上传路径形如
 * `if (isEncrypted) 加密上传 else 明文上传`，于是任何查询失败都会**静默降级为明文上传**，
 * 包括本应加密房间的附件。
 *
 * 正确语义是三态：encrypted / plaintext / unknown，由调用方显式处理 unknown。
 */

function mockClientWithRoom(room: unknown): void {
  getClientMock.mockReturnValue({ getRoom: () => room })
}

describe('cryptoSDKAdapter.getRoomEncryptionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('房间未加载时返回 unknown，而不是 plaintext', async () => {
    mockClientWithRoom(null)

    await expect(cryptoSDKAdapter.getRoomEncryptionState('!missing:example.com')).resolves.toBe('unknown')
  })

  it('房间有 m.room.encryption 状态时返回 encrypted', async () => {
    mockClientWithRoom({
      currentState: {
        getStateEvents: () => ({ getContent: () => ({ algorithm: 'm.megolm.v1.aes-sha2' }) })
      }
    })

    await expect(cryptoSDKAdapter.getRoomEncryptionState('!enc:example.com')).resolves.toBe('encrypted')
  })

  it('房间无加密状态时返回 plaintext', async () => {
    mockClientWithRoom({ currentState: { getStateEvents: () => null } })

    await expect(cryptoSDKAdapter.getRoomEncryptionState('!plain:example.com')).resolves.toBe('plaintext')
  })

  it('状态读取抛错时返回 unknown（不得当作 plaintext）', async () => {
    mockClientWithRoom({
      currentState: {
        getStateEvents: () => {
          throw new Error('state unavailable')
        }
      }
    })

    await expect(cryptoSDKAdapter.getRoomEncryptionState('!broken:example.com')).resolves.toBe('unknown')
  })

  it('isRoomEncrypted 对 unknown 返回 false（未知不算已加密）', async () => {
    mockClientWithRoom(null)

    await expect(cryptoSDKAdapter.isRoomEncrypted('!missing:example.com')).resolves.toBe(false)
  })

  it('未知状态下 isRoomEncrypted 会错误地允许明文上传，因此上传路径必须用 requireRoomEncryptionState', async () => {
    mockClientWithRoom(null)

    await expect(cryptoSDKAdapter.requireRoomEncryptionState('!missing:example.com')).rejects.toThrow(
      /无法确定房间加密状态/
    )
  })

  it('requireRoomEncryptionState 对确认未加密返回 false（可走明文通道）', async () => {
    mockClientWithRoom({ currentState: { getStateEvents: () => null } })

    await expect(cryptoSDKAdapter.requireRoomEncryptionState('!plain:example.com')).resolves.toBe(false)
  })

  it('requireRoomEncryptionState 对已加密返回 true', async () => {
    mockClientWithRoom({
      currentState: {
        getStateEvents: () => ({ getContent: () => ({ algorithm: 'm.megolm.v1.aes-sha2' }) })
      }
    })

    await expect(cryptoSDKAdapter.requireRoomEncryptionState('!enc:example.com')).resolves.toBe(true)
  })
})
