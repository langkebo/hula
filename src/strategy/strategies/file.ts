import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MsgEnum, UploadSceneEnum } from '@/enums'
import { parseInnerText } from '@/hooks/useCommon.ts'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/hooks/useUpload'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { getMimeTypeFromExtension } from '@/utils/Formatting'
import { isMobile } from '@/utils/PlatformConstants'
import { AbstractMessageStrategy, strategyLogger as logger, type ReplyRef } from './base'

/**
 * 处理文件消息
 */
export class FileMessageStrategyImpl extends AbstractMessageStrategy {
  // 最大上传文件大小 500MB
  private readonly MAX_UPLOAD_SIZE = 500 * 1024 * 1024
  private _uploadHook: ReturnType<typeof useUpload> | null = null

  constructor() {
    super(MsgEnum.FILE)
  }

  private get uploadHook() {
    if (!this._uploadHook) {
      this._uploadHook = useUpload()
    }
    return this._uploadHook
  }

  /**
   * 验证文件是否符合上传条件
   * @param file 文件对象
   * @returns 验证后的文件
   */
  private async validateFile(file: File): Promise<File> {
    // 检查文件大小
    if (file.size > this.MAX_UPLOAD_SIZE) {
      throw new AppException('文件大小不能超过500MB')
    }
    return file
  }

  /**
   * 从文件路径读取文件信息
   * @param path 文件路径
   * @returns 文件信息
   */
  private async getFileFromPath(path: string): Promise<File> {
    try {
      const normalizedPath = path.replace(/\\/g, '/')
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const fileData = await readFile(normalizedPath, { baseDir })

      const fileName = normalizedPath.split('/').pop() || 'unknown'
      const fileType = getMimeTypeFromExtension(fileName)

      return new File([new Uint8Array(fileData)], fileName, { type: fileType })
    } catch (error) {
      logger.error('读取文件失败:', error)
      throw new AppException('无法读取文件，请检查文件是否存在')
    }
  }

  async getMsg(
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ): Promise<Record<string, unknown>> {
    logger.debug('开始处理文件消息:', msgInputValue, replyValue, fileList?.length ? '有附件文件' : '无附件文件')

    let file: File | null = null

    // 优先使用fileList中的文件
    if (fileList && fileList.length > 0) {
      file = fileList[0]
    } else {
      // 尝试从msgInputValue解析文件路径
      const path = parseInnerText(msgInputValue, 'temp-file')
      if (!path) {
        throw new AppException('请选择要发送的文件')
      }
      file = await this.getFileFromPath(path)
    }

    // 验证文件
    const validatedFile = await this.validateFile(file)

    // 创建临时路径用于上传
    const tempPath = `temp-file-${Date.now()}-${validatedFile.name}`

    // 将文件保存到临时位置
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    await writeFile(tempPath, validatedFile.stream(), { baseDir })

    return {
      type: this.msgType,
      path: tempPath,
      fileName: validatedFile.name,
      size: validatedFile.size,
      mimeType: validatedFile.type,
      reply: replyValue?.message?.body?.content
        ? {
            content: replyValue.message.body.content,
            key: replyValue.message.id
          }
        : undefined
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      url: '', // 上传后会被设置
      path: msg.path as string,
      fileName: msg.fileName as string,
      size: msg.size as number,
      mimeType: msg.mimeType as string,
      replyMsgId: (msg.reply as ReplyRef | undefined)?.key || undefined,
      reply: reply?.message?.body?.content
        ? {
            body: reply.message.body.content,
            id: reply.message.id,
            username: reply.fromUser.username,
            type: msg.type
          }
        : undefined
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
    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT
      }

      const result = await this.uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      if (!result) {
        throw new AppException('获取文件上传链接失败，上传服务不可用')
      }
      return result
    } catch (error) {
      logger.error('获取文件上传链接失败:', error)
      throw new AppException('获取文件上传链接失败，请重试')
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

  getUploadProgress(): { progress: Ref<number>; onChange: (callback: (progress: number) => void) => void } {
    return {
      progress: this.uploadHook.progress,
      onChange: (callback: (progress: number) => void) => {
        this.uploadHook.onChange((p: number) => callback(Number(p)))
      }
    }
  }
}
