/**
 * Media 服务 — 下载辅助模块。
 *
 * 从 MatrixMediaService 抽离，包含 URL 解析、文件下载、加密文件下载逻辑。
 * 纯函数，接收 MatrixClient 作为依赖。
 */

import {
  type MatrixEncryptedAttachmentLike,
  matrixAttachmentDecryptionService
} from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import type { MatrixClient } from '../sdk'

const _logger = createLogger('MediaDownloadHelpers')

/** 解析媒体下载 URL
 */
export function resolveDownloadUrl(
  _client: MatrixClient,
  mediaUrl: string,
  getMediaUrl: (mxcUrl: string) => string | null,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (!mediaUrl) {
    throw new Error(t('matrix_error.media.url_empty'))
  }

  if (mediaUrl.startsWith('mxc://')) {
    const downloadUrl = getMediaUrl(mediaUrl)
    if (!downloadUrl) {
      throw new Error(t('matrix_error.media.url_parse_failed', { mediaUrl }))
    }
    return downloadUrl
  }

  return mediaUrl
}

/** 下载文件字节数据
 */
export async function downloadFileBytes(
  client: MatrixClient,
  mediaUrl: string,
  getMediaUrl: (mxcUrl: string) => string | null,
  t: (key: string, params?: Record<string, unknown>) => string
): Promise<Uint8Array> {
  const downloadUrl = resolveDownloadUrl(client, mediaUrl, getMediaUrl, t)

  const accessToken = client.getAccessToken()
  if (accessToken && downloadUrl.startsWith(client.getHomeserverUrl())) {
    try {
      const buffer = await HttpClient.downloadBytes(downloadUrl, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      })
      return new Uint8Array(buffer)
    } catch (err) {
      if (err instanceof HttpClientError && err.status === 404 && accessToken) {
        // Fallback: try authenticated download endpoint (MSC3916)
        const mxcMatch = mediaUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/)
        if (mxcMatch) {
          const serverName = mxcMatch[1]
          const mediaId = mxcMatch[2]
          const authDownloadUrl = `${client.getHomeserverUrl()}_matrix/client/v1/media/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`
          try {
            const buffer = await HttpClient.downloadBytes(authDownloadUrl, {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
            return new Uint8Array(buffer)
          } catch {
            // fall through to error
          }
        }
        // Last fallback: access_token in query (only if all else fails)
        const separator = downloadUrl.includes('?') ? '&' : '?'
        const queryUrl = `${downloadUrl}${separator}access_token=${encodeURIComponent(accessToken)}`
        const buffer = await HttpClient.downloadBytes(queryUrl)
        return new Uint8Array(buffer)
      }
      throw err
    }
  }

  const buffer = await HttpClient.downloadBytes(downloadUrl)
  return new Uint8Array(buffer)
}

/** 下载加密文件字节数据
 */
export async function downloadEncryptedFileBytes(
  client: MatrixClient,
  encryptedFile: MatrixEncryptedAttachmentLike,
  getMediaUrl: (mxcUrl: string) => string | null,
  t: (key: string, params?: Record<string, unknown>) => string
): Promise<Uint8Array> {
  const parsedEncryptedFile = matrixAttachmentDecryptionService.parseEncryptedFile(encryptedFile)
  const ciphertext = await downloadFileBytes(client, parsedEncryptedFile.url, getMediaUrl, t)
  return matrixAttachmentDecryptionService.decryptAttachment(ciphertext, parsedEncryptedFile)
}
