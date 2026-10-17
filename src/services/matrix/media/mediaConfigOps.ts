import { createLogger } from '@/utils/Logger'
import type { MediaManager, MediaQuotaAlert } from '../sdk'

const logger = createLogger('MatrixMediaConfig')

/**
 * 媒体「配置 / 配额 / 删除」操作的实现。
 *
 * 从 `MatrixMediaService` 抽出：这部分只读媒体配置与配额、不涉及上传编排与压缩，
 * 与上传路径（`upload*`）无共享状态，独立成模块后两块可以分别演进。
 *
 * 统一通过 `getMedia` 访问器取 `MediaManager`：调用方负责在此之前完成客户端就绪校验。
 */

/** 读取媒体上传配置（含 `m.upload.size` 上限）；失败抛出。 */
export async function fetchMediaConfig(
  getMedia: () => MediaManager
): Promise<{ 'm.upload.size'?: number; [key: string]: unknown }> {
  try {
    const result = await getMedia().getMediaConfig(false)
    logger.info('[MatrixMedia] 获取上传配置成功')
    return result as { 'm.upload.size'?: number; [key: string]: unknown }
  } catch (err) {
    logger.error(`[MatrixMedia] 获取上传配置失败: ${err}`)
    throw err
  }
}

/** 删除指定服务器上的媒体；成功返回 true，失败抛出。 */
export async function deleteMediaById(
  getMedia: () => MediaManager,
  serverName: string,
  mediaId: string
): Promise<boolean> {
  try {
    await getMedia().deleteMedia(serverName, mediaId)
    logger.info(`[MatrixMedia] 媒体删除成功: ${serverName}/${mediaId}`)
    return true
  } catch (err) {
    logger.error(`[MatrixMedia] 媒体删除失败: ${serverName}/${mediaId}, ${err}`)
    throw err
  }
}

/** 获取媒体配额告警列表；失败返回空数组。 */
export async function fetchQuotaAlerts(getMedia: () => MediaManager): Promise<MediaQuotaAlert[]> {
  try {
    const response = await getMedia().getMediaQuotaAlerts()
    logger.info('[MatrixMedia] 获取配额告警成功')
    return response.alerts ?? []
  } catch (err) {
    logger.error(`[MatrixMedia] 获取配额告警失败: ${err}`)
    return []
  }
}

/** 检查媒体配额（上限/已用/剩余）；失败返回 null。 */
export async function fetchQuotaUsage(
  getMedia: () => MediaManager
): Promise<{ limit: number; used: number; remaining: number } | null> {
  try {
    const result = await getMedia().checkMediaQuota()
    return { limit: result.limit ?? 0, used: result.used ?? 0, remaining: result.remaining ?? 0 }
  } catch (err) {
    logger.error(`[MatrixMedia] 配额检查失败: ${err}`)
    return null
  }
}

/** 获取媒体配额统计（存储字节/媒体数/上限字节）；失败返回 null。 */
export async function fetchQuotaStats(
  getMedia: () => MediaManager
): Promise<{ storageBytes: number; mediaCount: number; limitBytes: number } | null> {
  try {
    const result = await getMedia().getMediaQuotaStats()
    return {
      storageBytes: result.storage_bytes ?? 0,
      mediaCount: result.media_count ?? 0,
      limitBytes: result.limit_bytes ?? 0
    }
  } catch (err) {
    logger.error(`[MatrixMedia] 获取配额统计失败: ${err}`)
    return null
  }
}

/** 获取认证媒体配置（是否启用 authenticated_media）；失败返回 null。 */
export async function fetchAuthenticatedMediaConfig(
  getMedia: () => MediaManager
): Promise<{ authenticated_media: boolean; [key: string]: unknown } | null> {
  try {
    const result = (await getMedia().getMediaConfig(true)) as Record<string, unknown>
    logger.info('[MatrixMedia] 获取认证媒体配置成功')
    return { authenticated_media: (result.authenticated_media as boolean) ?? false, ...result }
  } catch (err) {
    logger.error(`[MatrixMedia] 获取认证媒体配置失败: ${err}`)
    return null
  }
}
