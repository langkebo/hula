import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { AppException } from '@/common/exception.ts'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/composables/common/useUpload'
import { MsgEnum, UploadSceneEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { fixFileMimeType } from '@/utils/FileType'
import { getMimeTypeFromExtension } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isMobile } from '@/utils/PlatformConstants'
import { AbstractMessageStrategy, type ImageInfo, strategyLogger as logger, type ReplyRef } from './base'

export class ImageMessageStrategyImpl extends AbstractMessageStrategy {
  // 最大上传图片大小 2MB
  private readonly MAX_UPLOAD_SIZE = 2 * 1024 * 1024
  // 支持的图片类型
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.IMAGE)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  /**
   * 验证图片文件是否符合上传条件要求
   * @param file 图片文件
   * @returns 验证后的图片文件
   */
  private async validateImage(file: File): Promise<File> {
    // 先修复可能缺失或错误的MIME类型
    const fixedFile = fixFileMimeType(file)

    // 检查文件类型
    if (!this.ALLOWED_TYPES.includes(fixedFile.type)) {
      throw new AppException('仅支持 JPEG、PNG、WebP 格式的图片')
    }

    // 检查文件大小
    if (fixedFile.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException('图片大小不能超过2MB', { showError: true })
    }

    return fixedFile
  }

  /**
   * 获取图片信息(宽度、高度、预览地址)
   * @param file 图片文件
   * @returns 图片信息
   */
  private async getImageInfo(file: File): Promise<{ width: number; height: number; previewUrl: string }> {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        previewUrl: result.previewUrl!
      }
    } catch {
      throw new AppException('图片加载失败')
    }
  }

  /**
   * 检查是否是有效的图片URL
   * @param url 图片地址
   * @returns 是否是有效的图片URL
   */
  private isImageUrl(url: string): boolean {
    // 检查是否是有效的URL
    try {
      new URL(url)
      // 检查是否以常见图片扩展名结尾
      return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
    } catch {
      return false
    }
  }

  /**
   * 获取表情图片信息(宽度、高度、大小)
   * @param url 图片地址
   * @returns 图片信息
   */
  private async getRemoteImageInfo(url: string): Promise<{ width: number; height: number; size: number }> {
    try {
      const result = await getImageDimensions(url, { includeSize: true })
      return {
        width: result.width,
        height: result.height,
        size: result.size || 0
      }
    } catch {
      throw new AppException('图片加载失败')
    }
  }

  /**
   * 处理图片消息
   * @param msgInputValue 图片消息内容
   * @param replyValue 回复消息
   * @param fileList 附件文件列表
   * @returns 处理后的消息
   */
  async getMsg(
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ): Promise<Record<string, unknown>> {
    // 优先处理fileList中的文件
    if (fileList && fileList.length > 0) {
      const file = fileList[0]

      // 验证图片
      await this.validateImage(file)

      // 获取图片信息（宽度、高度）和预览URL
      const { width, height, previewUrl } = await this.getImageInfo(file)

      // 将文件保存到缓存目录
      const tempPath = `temp-image-${Date.now()}-${file.name}`
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, file.stream(), { baseDir })

      return {
        type: this.msgType,
        path: tempPath, // 用于上传
        url: previewUrl, // 用于预览显示
        imageInfo: {
          width, // 原始图片宽度
          height, // 原始图片高度
          size: file.size // 原始文件大小
        },
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    }

    // 检查是否是图片URL
    if (this.isImageUrl(msgInputValue)) {
      try {
        // 获取远程图片信息
        const { width, height, size } = await this.getRemoteImageInfo(msgInputValue)

        return {
          type: this.msgType,
          url: msgInputValue, // 直接使用原始URL
          path: msgInputValue, // 为了保持一致性，也设置path
          imageInfo: {
            width,
            height,
            size
          },
          reply: replyValue?.message?.body?.content
            ? {
                content: replyValue.message.body.content,
                key: replyValue.message.id
              }
            : undefined
        }
      } catch (error) {
        logger.error('处理图片URL失败:', error)
        if (error instanceof AppException) {
          throw error
        }
        throw new AppException('图片预览失败')
      }
    }

    // 原有的本地图片处理逻辑（从HTML解析）
    const doc = new DOMParser().parseFromString(msgInputValue, 'text/html')
    const imgElement = doc.getElementById('temp-image')
    if (!imgElement) {
      throw new AppException('文件不存在')
    }

    const path = imgElement.getAttribute('data-path')
    if (!path) {
      throw new AppException('文件不存在')
    }

    // 标准化路径
    const normalizedPath = path.replace(/\\/g, '/')
    logger.debug('标准化路径:', normalizedPath)

    try {
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, { baseDir })

      const fileName = path.split('/').pop() || 'image.png'
      const fileType = getMimeTypeFromExtension(fileName)

      // 创建文件对象
      const originalFile = new File([new Uint8Array(fileData)], fileName, {
        type: fileType
      })

      // 验证图片
      await this.validateImage(originalFile)

      // 获取图片信息（宽度、高度）和预览URL
      const { width, height, previewUrl } = await this.getImageInfo(originalFile)

      return {
        type: this.msgType,
        path: normalizedPath, // 用于上传
        url: previewUrl, // 用于预览显示
        imageInfo: {
          width, // 原始图片宽度
          height, // 原始图片高度
          size: originalFile.size // 原始文件大小
        },
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      logger.error('处理图片失败:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('图片预览失败')
    }
  }

  /**
   * 上传文件
   * @param path 文件路径
   * @param options 上传选项
   * @returns 上传结果
   */
  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> {
    // 如果是URL，直接返回相同的URL作为下载链接
    if (this.isImageUrl(path)) {
      return {
        uploadUrl: '', // 不需要上传URL
        downloadUrl: path // 直接使用原始URL
      }
    }

    logger.debug('开始上传图片:', path)
    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT
      }

      const result = await this.uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      if (!result) {
        throw new AppException('获取上传链接失败，上传服务不可用')
      }
      return result
    } catch (error) {
      logger.error('获取上传链接失败:', error)
      throw new AppException('获取上传链接失败，请重试')
    }
  }

  /**
   * 执行实际的文件上传
   * @param path 文件路径
   * @param uploadUrl 上传URL
   * @param options 上传选项
   * @returns 上传结果
   */
  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    // 如果是URL，跳过上传
    if (this.isImageUrl(path)) {
      return
    }

    try {
      return await this.uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })
    } catch (error) {
      logger.error('文件上传失败:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('文件上传失败，请重试')
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      url: msg.url as string,
      path: msg.path as string,
      width: (msg.imageInfo as ImageInfo).width,
      height: (msg.imageInfo as ImageInfo).height,
      size: (msg.imageInfo as ImageInfo).size,
      replyMsgId: (msg.reply as ReplyRef | undefined)?.key || void 0,
      reply: reply?.message?.body?.content
        ? {
            body: reply.message.body.content,
            id: reply.message.id,
            username: reply.fromUser.username,
            type: msg.type
          }
        : void 0
    }
  }
}
