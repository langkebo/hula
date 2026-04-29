import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  default: {
    uploadVoice: vi.fn()
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixEncryptionService: {
    isRoomEncrypted: vi.fn()
  },
  matrixMediaService: {
    uploadEncryptedFile: vi.fn(),
    getMediaUrl: vi.fn((url: string) => `https://cdn.example/${encodeURIComponent(url)}`)
  }
}))

import { readFile } from '@tauri-apps/plugin-fs'
import { matrixEncryptionService, matrixMediaService } from '@/services/matrix'
import matrixVoiceService from '@/services/matrix/media/MatrixVoiceService'
import { useVoiceInput } from '../useVoiceInput'

describe('useVoiceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads local file then delegates to matrixVoiceService.uploadVoice', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    vi.mocked(readFile).mockResolvedValueOnce(bytes)
    vi.mocked(matrixEncryptionService.isRoomEncrypted).mockResolvedValueOnce(false)
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
    vi.mocked(matrixEncryptionService.isRoomEncrypted).mockResolvedValueOnce(false)
    vi.mocked(matrixVoiceService.uploadVoice).mockRejectedValueOnce(new Error('upload failed'))
    const { uploadVoiceToMatrix } = useVoiceInput()
    await expect(uploadVoiceToMatrix('!r:s', '/p', 'v.webm', 'audio/webm')).rejects.toThrow('upload failed')
  })

  it('passes through custom filename + mimeType to the constructed File', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(new Uint8Array([9]))
    vi.mocked(matrixEncryptionService.isRoomEncrypted).mockResolvedValueOnce(false)
    vi.mocked(matrixVoiceService.uploadVoice).mockResolvedValueOnce({} as never)
    const { uploadVoiceToMatrix } = useVoiceInput()
    await uploadVoiceToMatrix('!r', '/a', 'custom.m4a', 'audio/mp4')
    const fileArg = vi.mocked(matrixVoiceService.uploadVoice).mock.calls[0][1] as File
    expect(fileArg.name).toBe('custom.m4a')
    expect(fileArg.type).toBe('audio/mp4')
  })

  it('uses encrypted upload pipeline when room encryption is enabled', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(new Uint8Array([7, 8]))
    vi.mocked(matrixEncryptionService.isRoomEncrypted).mockResolvedValueOnce(true)
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
          k: 'secret',
          kty: 'oct',
          ext: true,
          key_ops: ['encrypt', 'decrypt']
        }
      }
    } as never)

    const { uploadVoiceToMatrix } = useVoiceInput()
    const result = await uploadVoiceToMatrix('!r', '/voice', 'voice.webm', 'audio/webm')

    expect(matrixMediaService.uploadEncryptedFile).toHaveBeenCalledTimes(1)
    expect(matrixVoiceService.uploadVoice).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      mxcUrl: 'mxc://example.org/encrypted-voice',
      filename: 'voice.webm',
      encryptedFile: {
        v: 'v2'
      }
    })
  })
})
