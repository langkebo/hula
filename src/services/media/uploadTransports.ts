import { Channel } from '@tauri-apps/api/core'
import { readFile, writeFile } from '@tauri-apps/plugin-fs'
import { TauriCommand } from '@/enums'
import { extractFileName, getMimeTypeFromExtension } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { getCacheBaseDir, getCacheBaseDirName } from '@/utils/PathUtil'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { removeTempFile } from '@/utils/TempFileManager'

const logger = createLogger('UploadTransport')

/**
 * 上传传输层：两条互斥通道，由后端 `upload/token` 的 `storage_type` 决定走哪条。
 *
 * - **presigned**：后端返回可直接 PUT 的绝对 URL（OSS/MinIO 预签名）。
 * - **matrix-native**：后端返回 `storage_type: "matrix"`，`upload_url` 是媒体上传的
 *   **POST** 端点（不是 PUT 目标）⇒ 必须走 Matrix 原生上传。旧实现对任何凭证都做
 *   `upload_file_put`，语义上就发不出去，导致所有附件发送失败。
 */

/** 是否绝对文件系统路径 */
export const isAbsoluteFsPath = (path: string): boolean => /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(path)

/** 上传选项：`downloadUrlPrefix` 来自后端 `upload/token` 的 `download_url_prefix` */
interface MatrixNativeUploadOptions {
  /** 下载地址前缀（`/_matrix/client/v1/media/download/<server>/`）；有值时优先使用 */
  downloadUrlPrefix?: string
}

/** 从 `mxc://server/mediaId` 取 mediaId */
function extractMediaId(mxcUrl: string): string {
  const idx = mxcUrl.lastIndexOf('/')
  return idx >= 0 ? mxcUrl.slice(idx + 1) : ''
}

/**
 * 上传一个 `File` 并返回可访问的 HTTP 地址。
 *
 * 地址优先级：后端 `download_url_prefix` + mediaId > mxc→http 解析 > 原始 mxc URI。
 * 之所以优先用 prefix：它是后端**显式声明**的下载路径，即便 SDK 未就绪
 * （`getProfileManager` 不可用导致 mxc 解析返回 null）也能给出可用地址。
 */
export async function uploadFileViaMatrix(
  file: File,
  onProgress?: (pct: number) => void,
  options: MatrixNativeUploadOptions = {}
): Promise<string> {
  // 动态 import：`useUpload` 被大量首屏组件引用，静态引入会拖入整个媒体服务依赖图
  const { matrixMediaService } = await import('@/services/matrix/media/MatrixMediaService')
  const result = await matrixMediaService.uploadFile(file, onProgress)
  const mediaId = extractMediaId(result.contentUri)
  if (options.downloadUrlPrefix && mediaId) {
    return `${options.downloadUrlPrefix}${mediaId}`
  }
  const httpUrl = matrixMediaService.getMediaUrl(result.contentUri)
  if (!httpUrl) logger.warn(`[UploadTransport] mxc 解析失败，回退原始 URI: ${result.contentUri}`)
  return httpUrl ?? result.contentUri
}

/** 从本地路径上传（策略层只有路径，没有 `File`）。 */
export async function uploadPathViaMatrix(
  path: string,
  mimeType?: string,
  options: MatrixNativeUploadOptions = {}
): Promise<string> {
  const bytes = isAbsoluteFsPath(path) ? await readFile(path) : await readFile(path, { baseDir: getCacheBaseDir() })
  const name = extractFileName(path) || `upload-${Date.now()}`
  const resolvedType = mimeType || getMimeTypeFromExtension(name) || 'application/octet-stream'
  return await uploadFileViaMatrix(new File([bytes], name, { type: resolvedType }), undefined, options)
}

/**
 * 预签名 PUT 通道（Tauri 侧流式上传，带进度）。
 *
 * 文件先落到缓存目录再交给 Rust 端流式发送，避免把整文件读进 JS 内存。
 */
export async function uploadPresignedPut(
  targetUrl: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const baseDir = getCacheBaseDir()
  const baseDirName = getCacheBaseDirName()
  const safeFileName = file.name.replace(/[\\/]/g, '_')
  const tempPath = `temp-upload-${Date.now()}-${safeFileName}`

  try {
    await writeFile(tempPath, file.stream(), { baseDir })
    const channel = new Channel<{ progressTotal: number; total: number }>()
    let lastProgress = -1
    channel.onmessage = ({ progressTotal, total }) => {
      const pct = total > 0 ? Math.floor((progressTotal / total) * 100) : 0
      if (pct === lastProgress) return
      lastProgress = pct
      onProgress?.(pct)
    }
    await invokeWithErrorHandler(TauriCommand.UPLOAD_FILE_PUT, {
      url: targetUrl,
      path: tempPath,
      baseDir: baseDirName,
      headers: { 'Content-Type': contentType },
      onProgress: channel
    })
  } finally {
    await removeTempFile(tempPath, { baseDir, silent: true })
  }
}
