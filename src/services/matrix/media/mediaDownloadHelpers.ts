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
import { matrixHttpClient } from '../MatrixHttpClient'
import type { MatrixClient } from '../sdk'

/** 归一化错误里是否带 404（`createMatrixTransportError` 统一写入 `httpStatus`） */
function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { httpStatus?: unknown }).httpStatus === 404
}

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
      const buffer = await matrixHttpClient.downloadRaw(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      return new Uint8Array(buffer)
    } catch (err) {
      if (isNotFoundError(err) && accessToken) {
        // Fallback: try authenticated download endpoint (MSC3916)
        //
        // 该 URL 由 SDK 的 media manager 按路由表构建（`/_matrix/client/v1/media/download/...`），
        // 不在客户端手拼 —— 手拼既会产生硬编码 `/_matrix` 字面量（`check:ratchet` 会拦），
        // 也曾经因为少一个 `/` 拼成 `hs.example.com_matrix/...`，使这条兜底永远 404。
        try {
          const authDownloadUrl = client.getMediaManager().getDownloadUrl(mediaUrl, { useAuthentication: true })
          const buffer = await matrixHttpClient.downloadRaw(authDownloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          return new Uint8Array(buffer)
        } catch {
          // fall through to the query-token fallback below
        }
        // Last fallback: access_token in query (only if all else fails)
        const separator = downloadUrl.includes('?') ? '&' : '?'
        const queryUrl = `${downloadUrl}${separator}access_token=${encodeURIComponent(accessToken)}`
        const buffer = await matrixHttpClient.downloadRaw(queryUrl)
        return new Uint8Array(buffer)
      }
      throw err
    }
  }

  // downloadUrl 可能为 homeserver 或外部媒体地址（动态 host）
  const buffer = await matrixHttpClient.downloadRaw(downloadUrl)
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
