import type { MatrixEvent } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const logSpy = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpy
}))

import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixEventService } from '../../MatrixEventService'
import { matrixForwardService } from '../MatrixForwardService'

/**
 * 安全回归：转发加密附件时不得把解密后的附件描述符（含 AES key）发进明文房间。
 *
 * 历史缺陷：forwardEvent 直接复制 `event.getContent()`（SDK 返回的是**已解密**内容），
 * 加密房间的附件 `content.file.key.k` 因此会以明文事件发到目标房间，
 * 等于把附件解密密钥公开广播。
 */

/** 加密房间附件事件：file 里含 AES key */
function makeEncryptedFileEvent(): MatrixEvent {
  return {
    getType: () => 'm.room.message',
    getId: () => '$evt-encrypted',
    getContent: () => ({
      msgtype: 'm.image',
      body: 'photo.jpg',
      file: {
        url: 'mxc://example.com/encrypted-blob',
        key: {
          alg: 'A256CTR',
          key_ops: ['decrypt', 'encrypt'],
          kty: 'oct',
          k: 'SUPER_SECRET_AES_KEY',
          ext: true
        },
        iv: 'AAAAAAAAAAAAAAAAAAAAAA',
        hashes: { sha256: 'deadbeef' },
        v: 'v2'
      }
    })
  } as unknown as MatrixEvent
}

/** 明文事件：普通 gif url */
function makePlainEvent(): MatrixEvent {
  return {
    getType: () => 'm.room.message',
    getId: () => '$evt-plain',
    getContent: () => ({
      msgtype: 'm.text',
      body: 'hello'
    })
  } as unknown as MatrixEvent
}

describe('MatrixForwardService 加密附件转发防护', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    logSpy.error.mockClear()
  })

  it('拒绝把加密附件转发进明文房间，且不发送任何事件', async () => {
    vi.spyOn(cryptoSDKAdapter, 'isRoomEncrypted').mockImplementation(
      async (roomId: string) => roomId === '!enc:example.com'
    )
    const sendEvent = vi.spyOn(matrixEventService, 'sendEvent').mockResolvedValue('$sent')

    await expect(matrixForwardService.forwardEvent(makeEncryptedFileEvent(), '!plain:example.com')).rejects.toThrow()

    expect(sendEvent).not.toHaveBeenCalled()
  })

  it('加密附件转发进加密房间时保留加密描述符', async () => {
    vi.spyOn(cryptoSDKAdapter, 'isRoomEncrypted').mockImplementation(
      async (roomId: string) => roomId === '!enc2:example.com'
    )
    const sendEvent = vi.spyOn(matrixEventService, 'sendEvent').mockResolvedValue('$sent')

    await matrixForwardService.forwardEvent(makeEncryptedFileEvent(), '!enc2:example.com')

    expect(sendEvent).toHaveBeenCalledTimes(1)
    const [, , content] = sendEvent.mock.calls[0]
    expect((content as { file?: { key?: { k?: string } } }).file?.key?.k).toBe('SUPER_SECRET_AES_KEY')
  })

  it('明文消息转发不受影响', async () => {
    vi.spyOn(cryptoSDKAdapter, 'isRoomEncrypted').mockResolvedValue(false)
    const sendEvent = vi.spyOn(matrixEventService, 'sendEvent').mockResolvedValue('$sent')

    await matrixForwardService.forwardEvent(makePlainEvent(), '!plain:example.com')

    expect(sendEvent).toHaveBeenCalledTimes(1)
  })

  it('批量转发时逐个房间判定，明文目标失败不影响加密目标', async () => {
    vi.spyOn(cryptoSDKAdapter, 'isRoomEncrypted').mockImplementation(
      async (roomId: string) => roomId === '!enc2:example.com'
    )
    const sendEvent = vi.spyOn(matrixEventService, 'sendEvent').mockResolvedValue('$sent')

    const results = await matrixForwardService.forwardEventToMultipleRooms(makeEncryptedFileEvent(), [
      '!plain:example.com',
      '!enc2:example.com'
    ])

    expect(results.find((r) => r.roomId === '!plain:example.com')?.success).toBe(false)
    expect(results.find((r) => r.roomId === '!enc2:example.com')?.success).toBe(true)
    expect(sendEvent).toHaveBeenCalledTimes(1)
  })
})
