import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { parseInnerText } from '@/composables/common/useCommon'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/composables/common/useUpload'
import { MsgEnum, UploadSceneEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { isVideoUrl } from '@/utils/FileType'
import { isMobile } from '@/utils/PlatformConstants'
import { removeTempFile } from '@/utils/TempFileManager'
import { generateVideoThumbnail } from '@/utils/VideoThumbnail'
import { AbstractMessageStrategy, strategyLogger as logger, type ReplyRef } from './base'

/**
 * 处理视频消息
 */
export class VideoMessageStrategyImpl extends AbstractMessageStrategy {
  // 最大上传文件大小 50MB
  private readonly MAX_UPLOAD_SIZE = 50 * 1024 * 1024
  // 支持的视频类型
  private readonly ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv']
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.VIDEO)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  // 暴露上传进度监听
  getUploadProgress(): { progress: Ref<number>; onChange: (callback: (progress: number) => void) => void } {
    return {
      progress: this.uploadHook.progress,
      onChange: (callback: (progress: number) => void) => {
        this.uploadHook.onChange((p: number) => callback(Number(p)))
      }
    }
  }

  /**
   * 验证视频文件
   * @param file 视频文件
   */
  private async validateVideo(file: File): Promise<File> {
    // 检查文件类型
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      throw new AppException('仅支持 MP4/MOV/AVI/WMV 格式的视频')
    }
    // 检查文件大小
    if (file.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException('视频大小不能超过50MB')
    }
    return file
  }

  async getMsg(
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ): Promise<Record<string, unknown>> {
    // 1. 优先处理fileList中的文件
    if (fileList && fileList.length > 0) {
      const file = fileList[0]

      // 验证视频文件
      const validatedFile = await this.validateVideo(file)
      const thumbnail = await generateVideoThumbnail(validatedFile)

      // 将文件保存到缓存目录
      const tempPath = `temp-video-${Date.now()}-${file.name}`
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, validatedFile.stream(), { baseDir })

      return {
        type: this.msgType,
        path: tempPath,
        url: '', // 上传后会更新
        thumbnail: thumbnail || '',
        size: validatedFile.size,
        duration: 0, // 实际项目中可解析视频时长
        reply: replyValue?.message?.body?.content
          ? { content: replyValue.message.body.content, key: replyValue.message.id }
          : undefined
      }
    }

    // 2. 处理远程视频URL的情况
    if (isVideoUrl(msgInputValue)) {
      return {
        type: this.msgType,
        url: msgInputValue,
        path: msgInputValue,
        reply: replyValue?.message?.body?.content
          ? { content: replyValue.message.body.content, key: replyValue.message.id }
          : undefined
      }
    }
    const actualFile = await this.convertToVideoFile(msgInputValue)

    // 4. 验证视频文件
    const validatedFile = await this.validateVideo(actualFile)
    const thumbnail = await generateVideoThumbnail(validatedFile)
    const path = parseInnerText(msgInputValue, 'temp-video')
    if (!path) {
      throw new AppException('文件不存在')
    }
    const normalizedPath = path.replace(/\\/g, '/')
    return {
      type: this.msgType,
      path: normalizedPath,
      url: '', // 上传后会更新
      thumbnail: thumbnail || '',
      size: validatedFile.size,
      duration: 0, // 实际项目中可解析视频时长
      reply: replyValue?.message?.body?.content
        ? { content: replyValue.message.body.content, key: replyValue.message.id }
        : undefined
    }
  }

  // 转换为视频文件
  private async convertToVideoFile(videoFile: string | File): Promise<File> {
    // 1. 如果已经是File对象直接返回
    if (videoFile instanceof File) {
      return videoFile
    }
    // 2. 检查是否是HTML标签（无效路径）
    if (videoFile.startsWith('<') || videoFile.includes('src="blob:')) {
      // 提取 Blob URL
      const blobUrlMatch = videoFile.match(/src="(blob:[^"]+)"/)
      if (!blobUrlMatch) {
        throw new AppException('无法提取视频 Blob URL')
      }
      const blobUrl = blobUrlMatch[1]

      // 3. 使用 fetch 获取 Blob 数据
      // blob: URL requires browser-native fetch
      try {
        const response = await fetch(blobUrl)
        const blob = await response.blob()

        // 4. 转换为 File 对象
        const fileName = `video_${Date.now()}.mp4` // 默认文件名
        return new File([blob], fileName, { type: blob.type || 'video/mp4' })
      } catch (error) {
        logger.error('Blob 转换失败:', error)
        throw new AppException('无法从 Blob URL 创建视频文件')
      }
    }

    // 5. 处理合法字符串路径的情况
    try {
      const normalizedPath = videoFile.replace(/\\/g, '/')
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, {
        baseDir
      })

      const fileName = normalizedPath.split('/').pop() || 'video.mp4'
      return new File([new Uint8Array(fileData)], fileName, {
        type: this.getVideoType(fileName)
      })
    } catch (error) {
      logger.error('视频文件读取失败:', error)
      throw new AppException('无法读取视频文件，请检查文件路径是否正确')
    }
  }

  private getVideoType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'mp4':
        return 'video/mp4'
      case 'mov':
        return 'video/quicktime'
      case 'avi':
        return 'video/x-msvideo'
      case 'wmv':
        return 'video/x-ms-wmv'
      default:
        return 'video/mp4' // 默认类型
    }
  }

  /**
   * 上传缩略图文件
   * @param thumbnailFile 缩略图文件
   * @param options 上传选项
   * @returns 上传结果
   */
  async uploadThumbnail(
    thumbnailFile: File,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> {
    try {
      // 创建临时文件路径用于上传
      const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT,
        enableDeduplication: true // 启用去重，使用哈希值计算
      }

      // 使用现有的getUploadAndDownloadUrl方法
      const result = await this.uploadHook.getUploadAndDownloadUrl(tempPath, uploadOptions)
      if (!result) {
        throw new AppException('获取缩略图上传链接失败，上传服务不可用')
      }
      return result
    } catch (error) {
      logger.error('获取缩略图上传链接失败:', error)
      throw new AppException('获取缩略图上传链接失败，请重试')
    }
  }

  /**
   * 执行缩略图上传
   * @param thumbnailFile 缩略图文件
   * @param uploadUrl 上传URL
   * @param options 上传选项
   * @returns 上传结果
   */
  async doUploadThumbnail(thumbnailFile: File, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    try {
      // 将File对象写入临时文件，然后使用现有的doUpload方法
      const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

      // 写入临时文件
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, thumbnailFile.stream(), { baseDir })

      const result = await this.uploadHook.doUpload(tempPath, uploadUrl, { ...options, enableDeduplication: true })

      // 清理临时文件
      await removeTempFile(tempPath, { baseDir })

      return result
    } catch (error) {
      logger.error('缩略图上传失败:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('缩略图上传失败，请重试')
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    // 为缩略图创建本地预览URL
    let thumbUrl = ''
    if (msg.thumbnail instanceof File) {
      thumbUrl = URL.createObjectURL(msg.thumbnail)
    }

    return {
      url: msg.url as string,
      path: msg.path as string,
      thumbnail: msg.thumbnail,
      thumbUrl: thumbUrl, // 本地预览URL，上传完成后会被替换为服务器URL
      thumbSize: (msg.thumbnail as File | undefined)?.size || 0,
      thumbWidth: 300,
      thumbHeight: 150,
      size: msg.size as number,
      duration: msg.duration as number,
      replyMsgId: (msg.reply as ReplyRef | undefined)?.key || void 0,
      reply: reply?.message?.body?.content
        ? {
            body: reply.message.body.content,
            id: reply.message.id,
            username: reply.fromUser.username,
            type: msg.type as string
          }
        : void 0
    }
  }

  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> {
    if (isVideoUrl(path)) {
      return { uploadUrl: '', downloadUrl: path }
    }

    try {
      const result = await this.uploadHook.getUploadAndDownloadUrl(path, {
        provider: options?.provider || UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT
      })
      if (!result) {
        throw new AppException('获取视频上传链接失败，上传服务不可用')
      }
      return result
    } catch {
      throw new AppException('获取视频上传链接失败')
    }
  }
  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    if (isVideoUrl(path)) {
      throw new AppException('检查是否是有效的视频URL')
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
}
