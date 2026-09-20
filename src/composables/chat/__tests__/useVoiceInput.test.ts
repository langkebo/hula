import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  default: {
    uploadVoice: vi.fn(),
    registerEncryptedVoice: vi.fn()
  }
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => {
  // requireRoomEncryptionState 基于 getRoomEncryptionState 派生，保留真实语义（unknown → 抛错）
  const getRoomEncryptionState = vi.fn()
  const isRoomEncrypted = vi.fn(async (roomId: string) => (await getRoomEncryptionState(roomId)) === 'encrypted')
  const requireRoomEncryptionState = vi.fn(async (roomId: string) => {
    const state = await getRoomEncryptionState(roomId)
    if (state === 'unknown') {
      throw new Error('无法确定房间加密状态，已阻止上传以避免明文外发。请重试或重新进入该房间。')
    }
    return state === 'encrypted'
  })
  return { cryptoSDKAdapter: { getRoomEncryptionState, isRoomEncrypted, requireRoomEncryptionState } }
})

vi.mock('@/services/matrix/media/mediaMetadata', () => ({
  // jsdom 不会触发 Audio.onloadedmetadata，真实实现要等 10s 超时；测试中直接返回时长
  getAudioDuration: vi.fn(async () => 1234)
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    uploadEncryptedFile: vi.fn(),
    getMediaUrl: vi.fn((url: string) => `https://cdn.example/${encodeURIComponent(url)}`)
  }
}))

import { readFile } from '@tauri-apps/plugin-fs'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import matrixVoiceService from '@/services/matrix/media/MatrixVoiceService'
import { useVoiceInput } from '../useVoiceInput'

describe('useVoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads local file then delegates to matrixVoiceService.uploadVoice', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    vi.mocked(readFile).mockResolvedValueOnce(bytes)
    vi.mocked(cryptoSDKAdapter.getRoomEncryptionState).mockResolvedValueOnce('plaintext')
    const fakeResult = { eventId: 'evt', httpUrl: 'http://x', mxcUrl: 'mxc://y', filename: 'voice.webm' }
    vi.mocked(matrixVoiceService.uploadVoice).mockResolvedValueOnce(fakeResult as never)

    const { uploadVoiceToMatrix } = useVoiceInput()
    const result = await uploadVoiceToMatrix('!room:srv', '/tmp/v.webm', 'voice.webm', 'audio/webm')

    expect(readFile).toHaveBeenCalledWith('/tmp/v.webm')
    expect(matrixVoiceService.uploadVoice).toHaveBeenCalledTimes(1)
    const [roomId, fileArg] = vi.mocked(matrixVoiceService.uploadVoice).mock.calls[0]
    expect(roomId).toBe('!room:srv')
    expect(fileArg).toBeInstanceOf(File)
    expect((fileArg as File).name).toBe('voice.webm')
    expect((fileArg as File).type).toBe('audio/webm')
    expect(result).toBe(fakeResult)
  })

  it('propagates readFile errors', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('enoent'))
    const { uploadVoiceToMatrix } = useVoiceInput()
    await expect(uploadVoiceToMatrix('!r:s', '/missing', 'v.webm', 'audio/webm')).rejects.toThrow('enoent')
    expect(matrixVoiceService.uploadVoice).not.toHaveBeenCalled()
  })

  it('propagates uploadVoice errors', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(new Uint8Array())
    vi.mocked(cryptoSDKAdapter.getRoomEncryptionState).mockResolvedValueOnce('plaintext')
    vi.mocked(matrixVoiceService.uploadVoice).mockRejectedValueOnce(new Error('upload failed'))
    const { uploadVoiceToMatrix } = useVoiceInput()
    await expect(uploadVoiceToMatrix('!r:s', '/p', 'v.webm', 'audio/webm')).rejects.toThrow('upload failed')
  })

  it('passes through custom filename + mimeType to the constructed File', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(new Uint8Array([9]))
    vi.mocked(cryptoSDKAdapter.getRoomEncryptionState).mockResolvedValueOnce('plaintext')
    vi.mocked(matrixVoiceService.uploadVoice).mockResolvedValueOnce({} as never)
    const { uploadVoiceToMatrix } = useVoiceInput()
    await uploadVoiceToMatrix('!r', '/a', 'custom.m4a', 'audio/mp4')
    const fileArg = vi.mocked(matrixVoiceService.uploadVoice).mock.calls[0][1] as File
    expect(fileArg.name).toBe('custom.m4a')
    expect(fileArg.type).toBe('audio/mp4')
  })

  it('uses encrypted upload pipeline when room encryption is enabled', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(new Uint8Array([7, 8]))
    vi.mocked(cryptoSDKAdapter.getRoomEncryptionState).mockResolvedValueOnce('encrypted')
    vi.mocked(matrixMediaService.uploadEncryptedFile).mockResolvedValueOnce({
      contentUri: 'mxc://example.org/encrypted-voice',
      size: 2,
      mimetype: 'audio/webm',
      encryptedFile: {
        url: 'mxc://example.org/encrypted-voice',
        iv: 'iv',
        hashes: { sha256: 'hash' },
        v: 'v2',
        key: {
          alg: 'A256CTR',
          ext: true,
          kty: 'oct',
          k: 'test-key',
          key_ops: ['encrypt', 'decrypt']
        }
      }
    })
    vi.mocked(matrixVoiceService.uploadVoice).mockResolvedValueOnce({} as never)
    const { uploadVoiceToMatrix } = useVoiceInput()
    await uploadVoiceToMatrix('!r', '/p', 'voice.webm', 'audio/webm')
    expect(matrixMediaService.uploadEncryptedFile).toHaveBeenCalledTimes(1)
  })

  it('加密状态无法判定时拒绝上传，绝不降级为明文上传', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(new Uint8Array([9, 9]))
    vi.mocked(cryptoSDKAdapter.getRoomEncryptionState).mockResolvedValueOnce('unknown')

    const { uploadVoiceToMatrix } = useVoiceInput()

    await expect(uploadVoiceToMatrix('!r', '/p', 'voice.webm', 'audio/webm')).rejects.toThrow(/无法确定房间加密状态/)

    // 两种上传通道都不得被调用
    expect(matrixMediaService.uploadEncryptedFile).not.toHaveBeenCalled()
    expect(matrixVoiceService.uploadVoice).not.toHaveBeenCalled()
  })
})
