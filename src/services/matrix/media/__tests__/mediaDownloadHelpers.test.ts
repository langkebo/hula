import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixAttachmentDecryptionService } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import type { MatrixClient } from '../../sdk'
import { downloadEncryptedFileBytes, downloadFileBytes, resolveDownloadUrl } from '../mediaDownloadHelpers'

vi.mock('@/utils/HttpClient', async () => {
  const actual = await vi.importActual<typeof import('@/utils/HttpClient')>('@/utils/HttpClient')
  return {
    ...actual,
    HttpClient: {
      downloadBytes: vi.fn()
    }
  }
})

vi.mock('@/services/matrix/crypto/MatrixAttachmentDecryptionService', async () => {
  const actual = await vi.importActual<typeof import('@/services/matrix/crypto/MatrixAttachmentDecryptionService')>(
    '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
  )
  return {
    ...actual,
    matrixAttachmentDecryptionService: {
      parseEncryptedFile: vi.fn(),
      decryptAttachment: vi.fn()
    }
  }
})

/** 构造模拟 MatrixClient */
function createClient(overrides: { token?: string | null; homeserverUrl?: string } = {}) {
  return {
    getAccessToken: () => overrides.token ?? null,
    getHomeserverUrl: () => overrides.homeserverUrl ?? 'https://hs.example.com'
  } as unknown as MatrixClient
}

/** t 翻译函数：返回 key 本身便于断言 */
const t = (key: string) => key

describe('resolveDownloadUrl', () => {
  const client = createClient()

  it('should return getMediaUrl result for mxc:// urls', () => {
    const url = resolveDownloadUrl(client, 'mxc://server/media1', (m) => `https://cdn/${m}`, t)
    expect(url).toBe('https://cdn/mxc://server/media1')
  })

  it('should throw t(key) when mediaUrl is empty', () => {
    expect(() => resolveDownloadUrl(client, '', () => 'x', t)).toThrow('matrix_error.media.url_empty')
  })

  it('should throw t(key) when mxc url cannot be resolved', () => {
    expect(() => resolveDownloadUrl(client, 'mxc://server/media1', () => null, t)).toThrow(
      'matrix_error.media.url_parse_failed'
    )
  })

  it('should return http url unchanged', () => {
    const url = resolveDownloadUrl(client, 'https://other.example/file.png', () => 'x', t)
    expect(url).toBe('https://other.example/file.png')
  })
})

describe('downloadFileBytes', () => {
  const downloadBytes = HttpClient.downloadBytes as ReturnType<typeof vi.fn>

  beforeEach(() => {
    downloadBytes.mockReset()
  })

  it('should download without auth header when no token and url not on homeserver', async () => {
    downloadBytes.mockResolvedValue(new ArrayBuffer(0))
    const client = createClient({ token: null })

    const result = await downloadFileBytes(client, 'https://other.example/f.png', (m) => m, t)

    expect(downloadBytes).toHaveBeenCalledWith('https://other.example/f.png')
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('should attach Bearer header when token present and url on homeserver', async () => {
    downloadBytes.mockResolvedValue(new ArrayBuffer(0))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/a/b'

    await downloadFileBytes(client, downloadUrl, (m) => m, t)

    expect(downloadBytes).toHaveBeenCalledWith(downloadUrl, {
      headers: { Authorization: 'Bearer tok' }
    })
  })

  it('should fall back to MSC3916 auth download endpoint on 404', async () => {
    downloadBytes
      .mockRejectedValueOnce(new HttpClientError('not found', 404, 'Not Found', ''))
      .mockResolvedValueOnce(new ArrayBuffer(0))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/server/media1'

    const result = await downloadFileBytes(client, 'mxc://server/media1', () => downloadUrl, t)

    // 第二次调用为 MSC3916 auth endpoint
    const authUrl = 'https://hs.example.com_matrix/client/v1/media/download/server/media1'
    expect(downloadBytes).toHaveBeenNthCalledWith(2, authUrl, {
      headers: { Authorization: 'Bearer tok' }
    })
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('should fall back to access_token query param if auth endpoint also fails', async () => {
    downloadBytes
      .mockRejectedValueOnce(new HttpClientError('not found', 404, 'Not Found', ''))
      .mockRejectedValueOnce(new HttpClientError('not found', 404, 'Not Found', ''))
      .mockResolvedValueOnce(new ArrayBuffer(0))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/server/media1'

    await downloadFileBytes(client, 'mxc://server/media1', () => downloadUrl, t)

    const queryUrl = `${downloadUrl}?access_token=tok`
    expect(downloadBytes).toHaveBeenLastCalledWith(queryUrl)
  })

  it('should rethrow non-404 errors', async () => {
    downloadBytes.mockRejectedValue(new HttpClientError('bad', 500, 'Server', ''))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/a/b'

    await expect(downloadFileBytes(client, downloadUrl, (m) => m, t)).rejects.toThrow()
  })
})

describe('downloadEncryptedFileBytes', () => {
  const parseEncryptedFile = matrixAttachmentDecryptionService.parseEncryptedFile as ReturnType<typeof vi.fn>
  const decryptAttachment = matrixAttachmentDecryptionService.decryptAttachment as ReturnType<typeof vi.fn>
  const downloadBytes = HttpClient.downloadBytes as ReturnType<typeof vi.fn>

  beforeEach(() => {
    downloadBytes.mockReset()
    parseEncryptedFile.mockReset()
    decryptAttachment.mockReset()
  })

  it('should parse, download ciphertext and decrypt', async () => {
    const parsed: EncryptedAttachmentFile = {
      url: 'mxc://server/enc',
      key: { kty: 'oct', key_ops: ['decrypt'], alg: 'A256CTR', k: 'a', ext: true },
      iv: 'a',
      hashes: { sha256: 'a' },
      v: 'v2'
    }
    parseEncryptedFile.mockReturnValue(parsed)
    downloadBytes.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    decryptAttachment.mockResolvedValue(new Uint8Array([9, 9]))
    const client = createClient({ token: null })

    const result = await downloadEncryptedFileBytes(client, parsed, (m) => m, t)

    expect(parseEncryptedFile).toHaveBeenCalledWith(parsed)
    expect(downloadBytes).toHaveBeenCalledTimes(1)
    expect(decryptAttachment).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), parsed)
    expect(result).toEqual(new Uint8Array([9, 9]))
  })
})
