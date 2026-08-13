/**
 * Media 服务 — 上传辅助模块。
 *
 * 从 MatrixMediaService 抽离，包含上传选项构造、错误判断、直接 XHR 上传、
 * 分片回退逻辑。纯函数，接收 MatrixClient / MediaManager 作为依赖。
 */

import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import { createLogger } from '@/utils/Logger'
import type { MatrixClient, MediaManager } from '../sdk'
import type { UploadOpts } from './mediaTypes'

const logger = createLogger('MediaUploadHelpers')

/** 创建上传选项
 */
export function createUploadOptions(
  mimetype: string | undefined,
  onProgress?: (progress: number) => void,
  filename?: string,
  includeFilename: boolean = true
): UploadOpts {
  return {
    type: mimetype,
    name: filename,
    includeFilename,
    progressHandler: onProgress
      ? ({ loaded, total }) => {
          if (!total) return
          const percentage = Math.min(100, Math.max(0, Math.round((loaded / total) * 100)))
          onProgress(percentage)
        }
      : undefined
  }
}

/** 判断上传数据是否超出大小限制
 */
export function isPayloadTooLarge(err: unknown): boolean {
  const e = err as { httpStatus?: number; errcode?: string }
  return e?.httpStatus === 413 || e?.errcode === 'M_TOO_LARGE'
}

/**
 * 直接上传：绕过 SDK 的 uploadContent（XMLHttpRequest 跨域 CORS 阻止）
 * 用 XMLHttpRequest + 同源 Vite proxy URL，避免 CORS 问题
 */
export function uploadViaDirectFetch(
  client: MatrixClient,
  file: File,
  opts: { type?: string; name?: string }
): Promise<string> {
  const homeserverUrl = client.getHomeserverUrl()
  const accessToken = client.getAccessToken()
  const filename = opts.name || file.name || 'upload'
  const mimetype = opts.type || file.type || 'application/octet-stream'

  let uploadUrl = `${homeserverUrl}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}&content_type=${encodeURIComponent(mimetype)}`
  if (import.meta.env.DEV) {
    try {
      const parsed = new URL(uploadUrl)
      if (parsed.pathname.startsWith('/_matrix/')) {
        uploadUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`
      }
    } catch {
      // URL 解析失败，用原始 URL
    }
  }

  logger.info(`[MatrixMedia][AVATAR_DEBUG] 直接 XHR 上传: ${uploadUrl}, size=${file.size}`)

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('Content-Type', mimetype)
    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
    }
    const timeout = setTimeout(() => {
      xhr.abort()
      reject(new Error('上传超时（30s）'))
    }, 30000)

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return
      clearTimeout(timeout)
      if (xhr.status === 0) {
        reject(new Error('XMLHttpRequest 网络错误（CORS 或连接失败）'))
        return
      }
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result = JSON.parse(xhr.responseText) as { content_uri: string }
          logger.info(`[MatrixMedia][AVATAR_DEBUG] 直接上传成功: ${result.content_uri}`)
          resolve(result.content_uri)
        } else {
          reject(new Error(`上传失败: ${xhr.status} ${xhr.responseText}`))
        }
      } catch (err) {
        reject(new Error(`解析响应失败: ${err}`))
      }
    }

    xhr.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('XMLHttpRequest onerror'))
    }

    xhr.send(file)
  })
}

/**
 * 上传内容（带分片回退）：
 * 1. 先用 MediaManager.uploadContent
 * 2. 413 → 分片上传
 * 3. AbortError → 直接 XHR 上传（绕过 CORS）
 */
export async function uploadContentWithChunkFallback(
  getMedia: () => MediaManager,
  client: MatrixClient,
  file: File,
  opts: UploadOpts,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const uploadResponse = await getMedia().uploadContent(
      file,
      opts as unknown as { name?: string; type?: string; progress?: (p: { loaded: number; total: number }) => void }
    )
    return typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
  } catch (err) {
    if (isPayloadTooLarge(err)) {
      logger.warn(`[MatrixMedia] 上传返回 413,回退到分片上传: ${file.name}`)
      const result = await chunkUploadService.upload({
        file,
        onProgress: (p) => onProgress?.(p.percentage)
      })
      return result.mxcUrl
    }
    const errName = err instanceof Error ? err.name : ''
    if (errName === 'AbortError') {
      logger.warn(`[MatrixMedia][AVATAR_DEBUG] uploadContent AbortError, 回退到直接 XHR 上传`)
      logger.info(`[MatrixMedia][AVATAR_DEBUG] calling uploadViaDirectFetch, typeof=${typeof uploadViaDirectFetch}`)
      const result = await uploadViaDirectFetch(client, file, opts)
      logger.info(`[MatrixMedia][AVATAR_DEBUG] uploadViaDirectFetch returned: ${result}`)
      return result
    }
    throw err
  }
}
