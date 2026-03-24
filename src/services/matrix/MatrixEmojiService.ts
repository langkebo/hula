import { matrixClientService } from './MatrixClientService'
import { matrixMediaService } from './MatrixMediaService'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { Method, ClientPrefix } from '@/types/matrix-js-sdk'

/**
 * 表情包/贴纸包项
 */
export interface EmojiItem {
  id: string
  name: string
  url: string
  type: 'emoji' | 'sticker'
  createdTs: number
}

/**
 * 表情包/贴纸包
 */
export interface EmojiPack {
  id: string
  name: string
  iconUrl?: string
  items: EmojiItem[]
  createdTs: number
  updatedTs: number
}

/**
 * 上传自定义表情结果
 */
export interface EmojiUploadResult {
  id: string
  name: string
  url: string
  mxcUrl: string
}

/**
 * 获取表情包列表选项
 */
export interface GetEmojiPacksOptions {
  userId?: string
  packId?: string
}

/**
 * Matrix 表情包服务
 *
 * 负责表情包/贴纸包的获取、上传、删除等管理功能。
 *
 * @example
 * ```typescript
 * const service = matrixEmojiService;
 *
 * // 获取用户的表情包列表
 * const packs = await service.emojiList();
 *
 * // 上传自定义表情
 * const result = await service.emojiUpload(file, 'my_emoji');
 *
 * // 删除自定义表情
 * await service.emojiDelete('emoji_id');
 * ```
 */
class MatrixEmojiService {
  /**
   * 获取客户端实例
   */
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix 客户端未初始化')
    }
    return client
  }

  /**
   * 获取用户的表情包/贴纸包列表
   *
   * @param options - 获取选项
   * @param options.userId - 指定用户 ID（不传则获取当前用户）
   * @param options.packId - 指定表情包 ID
   * @returns 表情包列表
   */
  async emojiList(options?: GetEmojiPacksOptions): Promise<EmojiPack[]> {
    try {
      const client = this.getClient()
      const userId = options?.userId || client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      const response = await client.http.request(Method.Get, '/user_emotes', { userId }, undefined, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 获取表情包列表成功，用户: ${userId}`)
      return this.parseEmojiResponse(response)
    } catch (err) {
      logError(`[MatrixEmoji] 获取表情包列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 上传自定义表情
   *
   * @param file - 表情图片文件（支持 PNG、GIF、WebP）
   * @param name - 表情名称
   * @param packId - 表情包 ID（可选，不传则使用默认包）
   * @returns 上传结果
   */
  async emojiUpload(file: File, name: string, packId?: string): Promise<EmojiUploadResult> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      const supportedTypes = ['image/png', 'image/gif', 'image/webp']
      if (!supportedTypes.includes(file.type)) {
        throw new Error(`不支持的图片格式: ${file.type}，支持的格式: PNG、GIF、WebP`)
      }

      const uploadResult = await matrixMediaService.uploadFile(file)
      const mxcUrl = uploadResult.contentUri

      const emojiData = {
        url: mxcUrl,
        name: name,
        pack_id: packId || 'default'
      }

      const response = await client.http.request(Method.Put, '/user_emotes/emote', { userId }, emojiData, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 上传自定义表情成功: ${name}, URL: ${mxcUrl}`)

      return {
        id: (response as any).id || `emote_${Date.now()}`,
        name,
        url: matrixMediaService.getMediaUrl(mxcUrl) || mxcUrl,
        mxcUrl
      }
    } catch (err) {
      logError(`[MatrixEmoji] 上传自定义表情失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除自定义表情
   *
   * @param emojiId - 表情 ID
   * @param packId - 表情包 ID（可选）
   */
  async emojiDelete(emojiId: string, packId?: string): Promise<void> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      await client.http.request(Method.Delete, '/user_emotes/emote', { userId, emojiId, packId }, undefined, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 删除自定义表情成功: ${emojiId}`)
    } catch (err) {
      logError(`[MatrixEmoji] 删除自定义表情失败: ${err}`)
      throw err
    }
  }

  /**
   * 创建表情包
   *
   * @param name - 表情包名称
   * @param iconFile - 封面图标（可选）
   * @returns 创建的表情包
   */
  async createPack(name: string, iconFile?: File): Promise<EmojiPack> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      let iconUrl: string | undefined
      if (iconFile) {
        const uploadResult = await matrixMediaService.uploadFile(iconFile)
        iconUrl = uploadResult.contentUri
      }

      const packData: Record<string, any> = {
        name,
        created_at: Date.now()
      }
      if (iconUrl) {
        packData.icon_url = iconUrl
      }

      const response = await client.http.request(Method.Put, '/user_emotes/pack', { userId }, packData, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 创建表情包成功: ${name}`)

      return {
        id: (response as any).pack_id || `pack_${Date.now()}`,
        name,
        iconUrl,
        items: [],
        createdTs: Date.now(),
        updatedTs: Date.now()
      }
    } catch (err) {
      logError(`[MatrixEmoji] 创建表情包失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除表情包
   *
   * @param packId - 表情包 ID
   */
  async deletePack(packId: string): Promise<void> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      await client.http.request(Method.Delete, '/user_emotes/pack', { userId, packId }, undefined, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 删除表情包成功: ${packId}`)
    } catch (err) {
      logError(`[MatrixEmoji] 删除表情包失败: ${err}`)
      throw err
    }
  }

  /**
   * 添加表情到表情包
   *
   * @param packId - 表情包 ID
   * @param emojiId - 表情 ID
   */
  async addEmojiToPack(packId: string, emojiId: string): Promise<void> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      await client.http.request(Method.Put, '/user_emotes/pack/emote', { userId, packId, emojiId }, undefined, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 添加表情到表情包成功: pack=${packId}, emoji=${emojiId}`)
    } catch (err) {
      logError(`[MatrixEmoji] 添加表情到表情包失败: ${err}`)
      throw err
    }
  }

  /**
   * 从表情包移除表情
   *
   * @param packId - 表情包 ID
   * @param emojiId - 表情 ID
   */
  async removeEmojiFromPack(packId: string, emojiId: string): Promise<void> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户未登录')
      }

      await client.http.request(Method.Delete, '/user_emotes/pack/emote', { userId, packId, emojiId }, undefined, {
        prefix: ClientPrefix.V3
      })

      info(`[MatrixEmoji] 从表情包移除表情成功: pack=${packId}, emoji=${emojiId}`)
    } catch (err) {
      logError(`[MatrixEmoji] 从表情包移除表情失败: ${err}`)
      throw err
    }
  }

  /**
   * 解析表情响应数据
   */
  private parseEmojiResponse(response: any): EmojiPack[] {
    if (!response || !response.packs) {
      return []
    }

    const packs: EmojiPack[] = []

    for (const [packId, packData] of Object.entries(response.packs as Record<string, any>)) {
      const items: EmojiItem[] = []

      if (packData.emoticons && Array.isArray(packData.emoticons)) {
        for (const [emojiId, emojiData] of Object.entries(packData.emoticons as Record<string, any>)) {
          items.push({
            id: emojiId,
            name: emojiData.name || emojiId,
            url: emojiData.url || '',
            type: 'emoji',
            createdTs: emojiData.created_at || Date.now()
          })
        }
      }

      packs.push({
        id: packId,
        name: packData.name || packId,
        iconUrl: packData.icon_url,
        items,
        createdTs: packData.created_at || Date.now(),
        updatedTs: packData.updated_at || Date.now()
      })
    }

    return packs
  }
}

export const matrixEmojiService = new MatrixEmojiService()
export default matrixEmojiService
