import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixMediaService } from '../media/MatrixMediaService'

const logger = createLogger('MatrixEmojiService')

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

interface RawEmojiData {
  name?: string
  url?: string
  created_at?: number
}

interface RawEmojiPackData {
  name?: string
  icon_url?: string
  emoticons?: Record<string, RawEmojiData>
  created_at?: number
  updated_at?: number
}

interface RawEmojiResponse {
  packs?: Record<string, RawEmojiPackData>
}

const EMOJI_ACCOUNT_DATA_TYPE = 'im.hula.user_emotes'
const DEFAULT_PACK_ID = 'default'

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
class MatrixEmojiService extends BaseMatrixService {
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
      const userId = this.assertSupportedUser(options?.userId)
      const response = await this.loadEmojiResponse(userId)

      logger.info(`[MatrixEmoji] 获取表情包列表成功，用户: ${userId}`)
      return this.parseEmojiResponse(response)
    } catch (err) {
      logger.error(`[MatrixEmoji] 获取表情包列表失败: ${err}`)
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
      this.assertSupportedUser()

      const supportedTypes = ['image/png', 'image/gif', 'image/webp']
      if (!supportedTypes.includes(file.type)) {
        throw new Error(this.t('matrix_error.messaging.unsupported_image_format', { type: file.type }))
      }

      const uploadResult = await matrixMediaService.uploadFile(file)
      const mxcUrl = uploadResult.contentUri
      const response = await this.loadEmojiResponse()
      const targetPackId = packId || DEFAULT_PACK_ID
      const now = Date.now()
      const emojiId = this.createId('emote')
      const pack = this.ensurePack(response, targetPackId, now)
      pack.emoticons ??= {}
      pack.emoticons[emojiId] = {
        name,
        url: mxcUrl,
        created_at: now
      }
      pack.updated_at = now

      await this.saveEmojiResponse(response)

      logger.info(`[MatrixEmoji] 上传自定义表情成功: ${name}, URL: ${mxcUrl}`)

      return {
        id: emojiId,
        name,
        url: matrixMediaService.getMediaUrl(mxcUrl) || mxcUrl,
        mxcUrl
      }
    } catch (err) {
      logger.error(`[MatrixEmoji] 上传自定义表情失败: ${err}`)
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
      this.assertSupportedUser()
      const response = await this.loadEmojiResponse()
      const now = Date.now()
      let changed = false

      if (packId) {
        const targetPack = response.packs?.[packId]
        if (targetPack?.emoticons?.[emojiId]) {
          delete targetPack.emoticons[emojiId]
          targetPack.updated_at = now
          changed = true
        }
      } else if (response.packs) {
        for (const pack of Object.values(response.packs)) {
          if (pack.emoticons?.[emojiId]) {
            delete pack.emoticons[emojiId]
            pack.updated_at = now
            changed = true
            break
          }
        }
      }

      if (changed) {
        await this.saveEmojiResponse(response)
      }

      logger.info(`[MatrixEmoji] 删除自定义表情成功: ${emojiId}`)
    } catch (err) {
      logger.error(`[MatrixEmoji] 删除自定义表情失败: ${err}`)
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
      this.assertSupportedUser()

      let iconUrl: string | undefined
      if (iconFile) {
        const uploadResult = await matrixMediaService.uploadFile(iconFile)
        iconUrl = uploadResult.contentUri
      }

      const response = await this.loadEmojiResponse()
      const now = Date.now()
      const packId = this.createId('pack')
      response.packs ??= {}
      response.packs[packId] = {
        name,
        icon_url: iconUrl,
        emoticons: {},
        created_at: now,
        updated_at: now
      }

      await this.saveEmojiResponse(response)

      logger.info(`[MatrixEmoji] 创建表情包成功: ${name}`)

      return {
        id: packId,
        name,
        iconUrl,
        items: [],
        createdTs: now,
        updatedTs: now
      }
    } catch (err) {
      logger.error(`[MatrixEmoji] 创建表情包失败: ${err}`)
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
      this.assertSupportedUser()
      const response = await this.loadEmojiResponse()
      if (response.packs?.[packId]) {
        delete response.packs[packId]
        await this.saveEmojiResponse(response)
      }

      logger.info(`[MatrixEmoji] 删除表情包成功: ${packId}`)
    } catch (err) {
      logger.error(`[MatrixEmoji] 删除表情包失败: ${err}`)
      throw err
    }
  }

  /**
   * 重命名表情包
   *
   * @param packId - 表情包 ID
   * @param name - 新名称
   */
  async renamePack(packId: string, name: string): Promise<void> {
    try {
      this.assertSupportedUser()
      const response = await this.loadEmojiResponse()
      const pack = response.packs?.[packId]
      if (!pack) {
        throw new Error(this.t('matrix_error.messaging.pack_not_found', { packId }))
      }

      pack.name = name
      pack.updated_at = Date.now()
      await this.saveEmojiResponse(response)

      logger.info(`[MatrixEmoji] 重命名表情包成功: ${packId} -> ${name}`)
    } catch (err) {
      logger.error(`[MatrixEmoji] 重命名表情包失败: ${err}`)
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
      this.assertSupportedUser()
      const response = await this.loadEmojiResponse()
      const now = Date.now()
      const sourceEmoji = this.findEmoji(response, emojiId)

      if (!sourceEmoji) {
        throw new Error(this.t('matrix_error.messaging.emoji_not_found', { emojiId }))
      }

      const targetPack = this.ensurePack(response, packId, now)
      targetPack.emoticons ??= {}
      targetPack.emoticons[emojiId] = { ...sourceEmoji }
      targetPack.updated_at = now

      await this.saveEmojiResponse(response)

      logger.info(`[MatrixEmoji] 添加表情到表情包成功: pack=${packId}, emoji=${emojiId}`)
    } catch (err) {
      logger.error(`[MatrixEmoji] 添加表情到表情包失败: ${err}`)
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
      this.assertSupportedUser()
      const response = await this.loadEmojiResponse()
      const targetPack = response.packs?.[packId]
      if (targetPack?.emoticons?.[emojiId]) {
        delete targetPack.emoticons[emojiId]
        targetPack.updated_at = Date.now()
        await this.saveEmojiResponse(response)
      }

      logger.info(`[MatrixEmoji] 从表情包移除表情成功: pack=${packId}, emoji=${emojiId}`)
    } catch (err) {
      logger.error(`[MatrixEmoji] 从表情包移除表情失败: ${err}`)
      throw err
    }
  }

  /**
   * 解析表情响应数据
   */
  private parseEmojiResponse(response: RawEmojiResponse): EmojiPack[] {
    if (!response?.packs) {
      return []
    }

    const packs: EmojiPack[] = []

    for (const [packId, packData] of Object.entries(response.packs)) {
      const items: EmojiItem[] = []

      if (packData.emoticons) {
        for (const [emojiId, emojiData] of Object.entries(packData.emoticons)) {
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

  private assertSupportedUser(userId?: string): string {
    const client = this.getClient()
    const currentUserId = client.getUserId()

    if (!currentUserId) {
      throw new Error(this.t('matrix_error.common.user_not_logged_in'))
    }

    if (userId && userId !== currentUserId) {
      throw new Error(this.t('matrix_error.messaging.other_user_emoji_unsupported'))
    }

    return currentUserId
  }

  private async loadEmojiResponse(userId?: string): Promise<RawEmojiResponse> {
    const client = this.getClient()
    this.assertSupportedUser(userId)
    const response = await client.getAccountDataFromServer(EMOJI_ACCOUNT_DATA_TYPE)

    if (!response || typeof response !== 'object') {
      return { packs: {} }
    }

    const raw = response as RawEmojiResponse
    return { packs: raw.packs ? { ...raw.packs } : {} }
  }

  private async saveEmojiResponse(response: RawEmojiResponse): Promise<void> {
    const client = this.getClient()
    await client.setAccountData(EMOJI_ACCOUNT_DATA_TYPE, response)
  }

  private ensurePack(response: RawEmojiResponse, packId: string, now: number): RawEmojiPackData {
    response.packs ??= {}
    const existingPack = response.packs[packId]
    if (existingPack) {
      existingPack.emoticons ??= {}
      existingPack.created_at ||= now
      existingPack.updated_at ||= now
      existingPack.name ||= packId
      return existingPack
    }

    const pack: RawEmojiPackData = {
      name: packId,
      emoticons: {},
      created_at: now,
      updated_at: now
    }
    response.packs[packId] = pack
    return pack
  }

  private findEmoji(response: RawEmojiResponse, emojiId: string): RawEmojiData | null {
    if (!response.packs) {
      return null
    }

    for (const pack of Object.values(response.packs)) {
      const emoji = pack.emoticons?.[emojiId]
      if (emoji) {
        return emoji
      }
    }

    return null
  }

  private createId(prefix: 'pack' | 'emote'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }
}

export const matrixEmojiService = new MatrixEmojiService()
export default matrixEmojiService
