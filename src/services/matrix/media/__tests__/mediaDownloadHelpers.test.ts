import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixAttachmentDecryptionService } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import type { EncryptedAttachmentFile } from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'
import type { MatrixClient } from '../../sdk'
import { downloadEncryptedFileBytes, downloadFileBytes, resolveDownloadUrl } from '../mediaDownloadHelpers'

vi.mock('@/services/matrix/MatrixHttpClient', () => ({
  matrixHttpClient: { downloadRaw: vi.fn() }
}))

/** 构造与 `createMatrixTransportError` 同形的传输错误（`httpStatus` 是判定契约） */
function transportError(status: number): Error & { httpStatus: number } {
  return Object.assign(new Error(`HTTP ${status}`), { httpStatus: status })
}

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

/**
 * 构造模拟 MatrixClient。
 *
 * MSC3916 兜底 URL 现在由 SDK 的 media manager 按路由表构建，
 * 因此 client 需要提供 `getMediaManager().getDownloadUrl()`。
 */
function createClient(overrides: { token?: string | null; homeserverUrl?: string } = {}) {
  const homeserverUrl = overrides.homeserverUrl ?? 'https://hs.example.com'
  const base = homeserverUrl.replace(/\/$/, '')
  return {
    getAccessToken: () => overrides.token ?? null,
    getHomeserverUrl: () => homeserverUrl,
    getMediaManager: () => ({
      getDownloadUrl: (mxcUrl: string, options?: { useAuthentication?: boolean }) =>
        options?.useAuthentication
          ? `${base}/_matrix/client/v1/media/download/${mxcUrl.replace('mxc://', '')}`
          : `${base}/_matrix/media/v3/download/${mxcUrl.replace('mxc://', '')}`
    })
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
  const downloadRaw = matrixHttpClient.downloadRaw as ReturnType<typeof vi.fn>

  beforeEach(() => {
    downloadRaw.mockReset()
  })

  it('should download without auth header when no token and url not on homeserver', async () => {
    downloadRaw.mockResolvedValue(new ArrayBuffer(0))
    const client = createClient({ token: null })

    const result = await downloadFileBytes(client, 'https://other.example/f.png', (m) => m, t)

    expect(downloadRaw).toHaveBeenCalledWith('https://other.example/f.png')
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('should attach Bearer header when token present and url on homeserver', async () => {
    downloadRaw.mockResolvedValue(new ArrayBuffer(0))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/a/b'

    await downloadFileBytes(client, downloadUrl, (m) => m, t)

    expect(downloadRaw).toHaveBeenCalledWith(downloadUrl, {
      headers: { Authorization: 'Bearer tok' }
    })
  })

  it('falls back to the SDK-provided MSC3916 authenticated download URL on 404', async () => {
    downloadRaw.mockRejectedValueOnce(transportError(404)).mockResolvedValueOnce(new ArrayBuffer(0))

    // 断言的是**契约**：必须向 SDK 的 media manager 要「带认证」的下载 URL，
    // 而不是在客户端手拼 `/_matrix/...`（手拼曾少一个 `/` ⇒ 永远 404，
    // 也违反 check:ratchet 的「不得新增硬编码路径」）。
    const getDownloadUrl = vi.fn(() => 'https://hs.example.com/_matrix/client/v1/media/download/server/media1')
    const client = {
      getAccessToken: () => 'tok',
      getHomeserverUrl: () => 'https://hs.example.com',
      getMediaManager: () => ({ getDownloadUrl })
    } as unknown as MatrixClient
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/server/media1'

    const result = await downloadFileBytes(client, 'mxc://server/media1', () => downloadUrl, t)

    expect(getDownloadUrl).toHaveBeenCalledWith('mxc://server/media1', { useAuthentication: true })
    expect(downloadRaw).toHaveBeenNthCalledWith(
      2,
      'https://hs.example.com/_matrix/client/v1/media/download/server/media1',
      { headers: { Authorization: 'Bearer tok' } }
    )
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('should fall back to access_token query param if auth endpoint also fails', async () => {
    downloadRaw
      .mockRejectedValueOnce(transportError(404))
      .mockRejectedValueOnce(transportError(404))
      .mockResolvedValueOnce(new ArrayBuffer(0))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/server/media1'

    await downloadFileBytes(client, 'mxc://server/media1', () => downloadUrl, t)

    const queryUrl = `${downloadUrl}?access_token=tok`
    expect(downloadRaw).toHaveBeenLastCalledWith(queryUrl)
  })

  it('should rethrow non-404 errors', async () => {
    downloadRaw.mockRejectedValue(transportError(500))
    const client = createClient({ token: 'tok', homeserverUrl: 'https://hs.example.com' })
    const downloadUrl = 'https://hs.example.com/_matrix/media/v3/download/a/b'

    await expect(downloadFileBytes(client, downloadUrl, (m) => m, t)).rejects.toThrow()
  })
})

describe('downloadEncryptedFileBytes', () => {
  const parseEncryptedFile = matrixAttachmentDecryptionService.parseEncryptedFile as ReturnType<typeof vi.fn>
  const decryptAttachment = matrixAttachmentDecryptionService.decryptAttachment as ReturnType<typeof vi.fn>
  const downloadRaw = matrixHttpClient.downloadRaw as ReturnType<typeof vi.fn>

  beforeEach(() => {
    downloadRaw.mockReset()
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
    downloadRaw.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    decryptAttachment.mockResolvedValue(new Uint8Array([9, 9]))
    const client = createClient({ token: null })

    const result = await downloadEncryptedFileBytes(client, parsed, (m) => m, t)

    expect(parseEncryptedFile).toHaveBeenCalledWith(parsed)
    expect(downloadRaw).toHaveBeenCalledTimes(1)
    expect(decryptAttachment).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), parsed)
    expect(result).toEqual(new Uint8Array([9, 9]))
  })
})
