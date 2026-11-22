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

/** i18n 翻译函数签名；`params` 仅承载文案插值标量。 */
type MediaTranslate = (key: string, params?: Record<string, string | number>) => string

/** 后端签名媒体下载参数（`expires` 为 Unix 秒，与 `media_link_signer.rs` 一致） */
export interface SignedMediaDownloadParams {
  serverName: string
  mediaId: string
  signature: string
  expires: number
  filename?: string
}

/** 媒体下载路径中的 `download_signed` / `download` 段标记 */
const SIGNED_DOWNLOAD_SEGMENTS = ['download_signed', 'download']

/**
 * 从已带 `signature` + `expires` 查询参数的 HTTP 媒体地址中解析签名下载参数。
 *
 * 用于消息内直接携带签名媒体链接（后端 `download_signed` 路由）的场景；
 * 不是签名媒体链接时返回 null，调用方回退普通下载通道即可。
 */
export function parseSignedMediaUrl(url: string): SignedMediaDownloadParams | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url, 'https://signed-media.invalid')
  } catch {
    return null
  }

  const signature = parsed.searchParams.get('signature')
  const expiresRaw = parsed.searchParams.get('expires')
  if (!signature || !expiresRaw) return null

  const expires = Number(expiresRaw)
  if (!Number.isFinite(expires) || expires <= 0) return null

  const segments = parsed.pathname.split('/').filter(Boolean)
  let markerIndex = -1
  for (let i = segments.length - 1; i >= 0; i--) {
    if (SIGNED_DOWNLOAD_SEGMENTS.includes(segments[i])) {
      markerIndex = i
      break
    }
  }
  if (markerIndex < 0 || segments.length < markerIndex + 3) return null

  try {
    const serverName = decodeURIComponent(segments[markerIndex + 1])
    const mediaId = decodeURIComponent(segments[markerIndex + 2])
    if (!serverName || !mediaId) return null

    const rawFilename = segments[markerIndex + 3]
    return {
      serverName,
      mediaId,
      signature,
      expires,
      ...(rawFilename ? { filename: decodeURIComponent(rawFilename) } : {})
    }
  } catch {
    return null
  }
}

/**
 * 构造后端 `download_signed` 地址。
 *
 * URL 由 SDK 的 media manager 按路由表构建（带 `signature` 时自动走 `download_signed`），
 * 不在客户端手拼 `/_matrix/...` 路径（R1 + `check:ratchet`）。
 */
export function buildSignedMediaDownloadUrl(
  client: MatrixClient,
  params: SignedMediaDownloadParams,
  t: MediaTranslate
): string {
  const { serverName, mediaId, signature, expires, filename } = params
  if (!serverName || !mediaId || !signature || !Number.isFinite(expires) || expires <= 0) {
    throw new Error(t('matrix_error.media.signed_params_missing'))
  }
  if (expires * 1000 <= Date.now()) {
    throw new Error(t('matrix_error.media.signed_expired'))
  }

  const mxcUrl = `mxc://${serverName}/${mediaId}`
  const downloadUrl = client.getMediaManager().getDownloadUrl(mxcUrl, {
    signature,
    timestamp: expires,
    ...(filename ? { filename } : {})
  })
  if (!downloadUrl) {
    throw new Error(t('matrix_error.media.url_parse_failed', { mediaUrl: mxcUrl }))
  }
  return downloadUrl
}

/** 通过后端 `download_signed` 端点下载媒体字节（签名即鉴权，不附加 Bearer） */
export async function downloadSignedMediaBytes(
  client: MatrixClient,
  params: SignedMediaDownloadParams,
  t: MediaTranslate
): Promise<Uint8Array> {
  const downloadUrl = buildSignedMediaDownloadUrl(client, params, t)
  const buffer = await matrixHttpClient.downloadRaw(downloadUrl)
  return new Uint8Array(buffer)
}

/** 解析媒体下载 URL
 */
export function resolveDownloadUrl(
  _client: MatrixClient,
  mediaUrl: string,
  getMediaUrl: (mxcUrl: string) => string | null,
  t: MediaTranslate
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
  t: MediaTranslate
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
  t: MediaTranslate
): Promise<Uint8Array> {
  const parsedEncryptedFile = matrixAttachmentDecryptionService.parseEncryptedFile(encryptedFile)
  const ciphertext = await downloadFileBytes(client, parsedEncryptedFile.url, getMediaUrl, t)
  return matrixAttachmentDecryptionService.decryptAttachment(ciphertext, parsedEncryptedFile)
}
