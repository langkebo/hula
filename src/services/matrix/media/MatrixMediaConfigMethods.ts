import type { MediaManager, MediaQuotaAlert } from '@/services/matrix/sdk'
import { BaseMatrixService } from '../BaseMatrixService'
import {
  deleteMediaById,
  fetchAuthenticatedMediaConfig,
  fetchMediaConfig,
  fetchQuotaAlerts,
  fetchQuotaStats,
  fetchQuotaUsage,
  fetchUrlPreview,
  type MediaQuotaStatsResult
} from './mediaConfigOps'
import { notifyMediaQuotaChanged } from './mediaQuotaEvents'
import type { MediaUrlPreview } from './mediaTypes'
import { resolveMxcToHttp } from './mxcUrl'

/**
 * MatrixMediaService 的媒体基础能力：mxc 地址解析与媒体配置/配额访问。
 *
 * 上传编排、压缩控制与下载委托保留在 `MatrixMediaService`，此处只承载
 * 与上传流程无耦合的配置/配额端点，避免单文件超出体量门槛。
 */
export abstract class MatrixMediaConfigMethods extends BaseMatrixService {
  protected getMedia(): MediaManager {
    const client = this.getClient()
    const fn = (client as { getMediaManager?: () => MediaManager }).getMediaManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getMediaManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  /**
   * 将 mxc:// 地址解析为 HTTP 地址，可选指定缩略图尺寸。
   * 解析失败时返回 null。
   */
  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    // 统一走 resolveMxcToHttp（优先 client 级 mxcUrlToHttp，ProfileManager 仅回退）
    return resolveMxcToHttp(this.getClient(), mxcUrl, width, height)
  }

  /**
   * 将 mxc:// 地址解析为指定尺寸的缩略图 HTTP 地址。
   * 解析失败时返回 null。
   */
  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    return resolveMxcToHttp(this.getClient(), mxcUrl, width, height)
  }

  /** 获取媒体上传配置（含 `m.upload.size` 上限）；失败抛出。 */
  async getMediaConfig(): Promise<{ 'm.upload.size'?: number; [key: string]: unknown }> {
    return fetchMediaConfig(() => this.getMedia())
  }

  /** 删除指定服务器上的媒体；成功返回 true，失败抛出。 */
  async deleteMedia(serverName: string, mediaId: string): Promise<boolean> {
    const deleted = await deleteMediaById(() => this.getMedia(), serverName, mediaId)
    if (deleted) notifyMediaQuotaChanged()
    return deleted
  }

  /** 获取媒体配额告警列表；失败返回空数组。 */
  async getQuotaAlerts(): Promise<MediaQuotaAlert[]> {
    return fetchQuotaAlerts(() => this.getMedia())
  }

  /** 检查媒体配额（上限/已用/剩余）；失败返回 null。 */
  async checkQuota(): Promise<{ limit: number; used: number; remaining: number } | null> {
    return fetchQuotaUsage(() => this.getMedia())
  }

  /** 获取媒体配额统计；失败时带原因返回（区分「服务端无配额」与「本次取不到」）。 */
  async getQuotaStats(): Promise<MediaQuotaStatsResult> {
    return fetchQuotaStats(() => this.getMedia())
  }

  /** 获取认证媒体配置（是否启用 authenticated_media）；失败返回 null。 */
  async getAuthenticatedMediaConfig(): Promise<{ authenticated_media: boolean; [key: string]: unknown } | null> {
    return fetchAuthenticatedMediaConfig(() => this.getMedia())
  }

  /** 获取链接预览（标题/描述/缩略图）；服务端不支持或抓取失败时返回 null。 */
  async getUrlPreview(url: string, ts?: number): Promise<MediaUrlPreview | null> {
    return fetchUrlPreview(() => this.getMedia(), url, ts)
  }
}
