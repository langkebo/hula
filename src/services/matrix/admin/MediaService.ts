import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { stripMatrixPrefix } from '../MatrixHttpClient'

const logger = createLogger('MediaService')

type RawMediaItem = {
  media_id?: string
  media_type?: string
  content_uri?: string
  created_ts?: number
  upload_name?: string
  media_length?: number
}

type MediaAdminSdk = {
  getMedia(limit: number, from?: string): Promise<{ media?: RawMediaItem[]; next_token?: string }>
  deleteMedia(mediaId: string): Promise<void>
  purgeMediaCache?(beforeTs?: number): Promise<{ deleted?: number }>
  getMediaStats?(): Promise<Record<string, unknown>>
}

type MediaDomainSdkGetter = () => Promise<MediaAdminSdk>

export class AdminMediaService {
  constructor(private readonly sdkAdmin: MediaDomainSdkGetter) {}

  async getMediaList(
    limit = 100,
    from?: string,
    _orderBy?: string,
    _search?: string
  ): Promise<{
    media: Array<{
      mediaId: string
      mediaType: string
      contentUri: string
      createdAt: number
      uploadName?: string
      mediaLength?: number
    }>
    nextToken?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getMedia(limit, from)
      return {
        media: (result?.media ?? []).map((m) => ({
          mediaId: m.media_id ?? '',
          mediaType: m.media_type ?? '',
          contentUri: m.content_uri ?? '',
          createdAt: m.created_ts ?? 0,
          uploadName: m.upload_name,
          mediaLength: m.media_length
        })),
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体列表失败: ${err}`)
      return { media: [] }
    }
  }

  async deleteMedia(mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteMedia(mediaId)
      logger.info(`[AdminMedia] 媒体已删除: ${mediaId}`)
    } catch (err) {
      logger.error(`[AdminMedia] 删除媒体失败: ${err}`)
      throw err
    }
  }

  async purgeRemoteMedia(beforeTs: number, includeProfiles: boolean = false): Promise<{ deleted: number }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[AdminMedia] 客户端未初始化')
    }

    try {
      const { path, prefix } = stripMatrixPrefix('/_matrix/client/v1/admin/purge_remote_media')
      const result = await client.http.authedRequest(
        'POST',
        path,
        undefined,
        {
          before_ts: beforeTs,
          include_profiles: includeProfiles
        },
        { prefix }
      )
      logger.info(`[AdminMedia] 清理远程媒体成功: ${(result as { deleted?: number }).deleted ?? 0} 个`)
      return { deleted: (result as { deleted?: number }).deleted ?? 0 }
    } catch (err) {
      logger.error(`[AdminMedia] 清理远程媒体失败: ${err}`)
      throw err
    }
  }

  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    try {
      const admin = await this.sdkAdmin()
      const result = (await admin.purgeMediaCache?.(beforeTs)) ?? {}
      logger.info(`[AdminMedia] 清理媒体缓存: ${result?.deleted ?? 0}个`)
      return { deleted: result?.deleted ?? 0 }
    } catch (err) {
      logger.error(`[AdminMedia] 清理媒体缓存失败: ${err}`)
      throw err
    }
  }

  async getMediaStats(): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getMediaStats?.()) ?? null
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体统计失败: ${err}`)
      return null
    }
  }
}
