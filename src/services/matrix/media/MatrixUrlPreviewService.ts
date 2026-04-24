/**
 * URL 预览服务 (MSC2788)
 * 链接预览功能
 */
import { matrixClientService } from '../MatrixClientService'
import { createLogger } from '@/utils/Logger'
import type { MatrixEvent } from 'matrix-js-sdk'

const logger = createLogger('UrlPreview')

export interface UrlPreview {
  url: string
  title?: string
  description?: string
  image?: string
  imageType?: string
  imageSize?: number
  siteName?: string
  mediaId?: string
  mxContent?: string
  imageUrl?: string
}

/**
 * 简化 URL 显示
 */
export function simplifyUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    let display = urlObj.hostname + urlObj.pathname
    if (display.length > 50) {
      display = display.substring(0, 47) + '...'
    }
    return display
  } catch {
    return url.length > 50 ? url.substring(0, 47) + '...' : url
  }
}

/**
 * 获取域名
 */
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return ''
  }
}

export interface UrlPreviewParams {
  url: string
  timestamp?: number
}

type PreviewEventLike = MatrixEvent | { body?: string; formatted_body?: string }

class MatrixUrlPreviewService {
  private get client() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }
    return client
  }

  private getPreviewContent(event: PreviewEventLike): { body?: string; formatted_body?: string } {
    return 'getContent' in event ? (event.getContent() as { body?: string; formatted_body?: string }) : event
  }

  /**
   * 获取 URL 预览
   * 使用 Matrix API /_matrix/media/r0/preview_url
   */
  async getPreview(params: UrlPreviewParams): Promise<UrlPreview | null> {
    const { url, timestamp } = params

    try {
      const api = this.client.getMediaApiUrl('')
      let previewUrl = `${api}/_matrix/media/r0/preview_url?url=${encodeURIComponent(url)}`

      if (timestamp) {
        previewUrl += `&ts=${timestamp}`
      }

      const response = (await this.client.http.authedRequest({}, 'GET', previewUrl.replace(api, ''), undefined, {
        global: false
      })) as Record<string, unknown>

      if (!response || !Object.keys(response).length) {
        return null
      }

      // 处理 Matrix 0.6.1 格式的响应
      const result: UrlPreview = {
        url,
        title: (response['og:title'] ?? response.title) as string | undefined,
        description: (response['og:description'] ?? response.description) as string | undefined,
        image: (response['og:image'] ?? response.image) as string | undefined,
        imageType: (response['matrix:image:type'] ?? undefined) as string | undefined,
        imageSize: (response['matrix:image:size'] ?? undefined) as number | undefined,
        siteName: (response['og:site_name'] ?? response.site_name) as string | undefined,
        mediaId: (response['matrix:image_id'] ?? undefined) as string | undefined,
        mxContent: (response['matrix:content'] ?? undefined) as string | undefined,
        imageUrl: (response['og:image'] ?? response.image) as string | undefined
      }

      // 如果图片是 mxc:// URL，转换为完整 URL
      if (result.image && result.image.startsWith('mxc://')) {
        const mediaApi = this.client.getMediaApiUrl('')
        result.image = mediaApi + '/_matrix/media/r0/download/' + result.image.replace('mxc://', '')
        result.imageUrl = result.image
      }

      return result
    } catch (error) {
      logger.error('获取预览失败:', error)
      return null
    }
  }

  /**
   * 批量获取多个 URL 的预览
   */
  async getPreviews(urls: string[]): Promise<Map<string, UrlPreview | null>> {
    const results = new Map<string, UrlPreview | null>()

    // 限制并发请求数量
    const batchSize = 3
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      const promises = batch.map((url) => this.getPreview({ url }))
      const batchResults = await Promise.all(promises)

      batch.forEach((url, index) => {
        results.set(url, batchResults[index])
      })
    }

    return results
  }

  /**
   * 从消息内容中提取 URL 列表
   */
  extractUrlsFromMessage(content: { body?: string; formatted_body?: string }): string[] {
    const urls: Set<string> = new Set()

    const text = content.body || content.formatted_body || ''

    // 匹配 http/https URL
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g
    let match
    while ((match = urlRegex.exec(text)) !== null) {
      urls.add(match[1])
    }

    // 匹配 matrix.to 链接
    const matrixToRegex = /(https?:\/\/matrix\.to\/[^\s<>"{}|\\^`[\]]+)/g
    while ((match = matrixToRegex.exec(text)) !== null) {
      urls.add(match[1])
    }

    return Array.from(urls)
  }

  /**
   * 从事件中获取 URL 预览
   * 分析消息中的链接并获取预览
   */
  async getPreviewsFromEvent(
    event: PreviewEventLike,
    options: { excludeSelfUrl?: boolean } = {}
  ): Promise<Map<string, UrlPreview | null>> {
    const { excludeSelfUrl = true } = options

    let urls = this.extractUrlsFromMessage(this.getPreviewContent(event))

    // 排除自身 URL (图片、视频等媒体链接)
    if (excludeSelfUrl) {
      urls = urls.filter((url) => {
        const isMedia = url.includes('/_matrix/media/')
        const isMatrixTo = url.includes('matrix.to/')
        return !isMedia && !isMatrixTo
      })
    }

    if (urls.length === 0) {
      return new Map()
    }

    return this.getPreviews(urls)
  }

  /**
   * 缓存 URL 预览
   */
  private cache: Map<string, { preview: UrlPreview; timestamp: number }> = new Map()
  private cacheTimeout = 60 * 60 * 1000 // 1 小时

  /**
   * 获取缓存的预览
   */
  getCachedPreview(url: string): UrlPreview | null {
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.preview
    }
    this.cache.delete(url)
    return null
  }

  /**
   * 缓存预览
   */
  cachePreview(url: string, preview: UrlPreview): void {
    this.cache.set(url, { preview, timestamp: Date.now() })
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }
}

export const matrixUrlPreviewService = new MatrixUrlPreviewService()
