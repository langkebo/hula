/**
 * Media 服务 — 上传辅助模块。
 *
 * 从 MatrixMediaService 抽离，包含上传选项构造、错误判断、网关直传回退、
 * 分片回退逻辑。纯函数，接收 MatrixClient / MediaManager 作为依赖。
 */

import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import { createLogger } from '@/utils/Logger'
import { matrixHttpClient } from '../MatrixHttpClient'
import type { MediaManager } from '../sdk'
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
 * 网关直传：经 `matrixHttpClient.uploadRaw` 把文件字节原样 POST 到 media v3 upload。
 *
 * 用于 SDK `uploadContent` 抛 `AbortError`（其内部 XHR 在 `status === 0` 时会产生该错误，
 * 典型是浏览器 dev 下的跨域失败）后的回退。原实现是就地 `new XMLHttpRequest`，问题：
 * ① 绕过 `MatrixRateLimitInterceptor` 的限流/熔断与网络级重试；
 * ② 自带一份与 `MatrixHttpClient`/`runtimeFetch` 重复的 URL 解析与 dev-proxy 改写；
 * ③ 错误对象是自定义 `Error`，不带 `httpStatus`，无法被既有错误分流识别。
 * 现在这三件事都归 `MatrixHttpClient`（dev 同源改写也在其中）统一承担。
 *
 * 该分支**不支持进度回调**（与迁移前一致；进度只在 SDK 主路径的 `progressHandler` 上）。
 */
export async function uploadViaGateway(file: File, opts: { type?: string; name?: string }): Promise<string> {
  const filename = opts.name || file.name || 'upload'
  const mimetype = opts.type || file.type || 'application/octet-stream'

  logger.info(`[MatrixMedia] 网关直传: size=${file.size}, type=${mimetype}`)

  const result = await matrixHttpClient.uploadRaw<{ content_uri: string }>('_matrix/media/v3/upload', file, {
    contentType: mimetype,
    queryParams: { filename, content_type: mimetype }
  })

  if (!result?.content_uri) {
    throw new Error('上传响应缺少 content_uri')
  }

  logger.info(`[MatrixMedia] 网关直传成功: ${result.content_uri}`)
  return result.content_uri
}

/**
 * 上传内容（带分片回退）：
 * 1. 先用 MediaManager.uploadContent
 * 2. 413 → 分片上传
 * 3. AbortError → 网关直传（经 MatrixHttpClient）
 */
export async function uploadContentWithChunkFallback(
  getMedia: () => MediaManager,
  file: File,
  opts: UploadOpts,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const uploadResponse = await getMedia().uploadContent(
      file,
      opts as { name?: string; type?: string; progress?: (p: { loaded: number; total: number }) => void }
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
      logger.warn('[MatrixMedia] uploadContent 抛 AbortError（SDK 内部 XHR status=0），回退到网关直传')
      return await uploadViaGateway(file, opts)
    }
    throw err
  }
}
