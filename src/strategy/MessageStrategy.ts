import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import DOMPurify from 'dompurify'
import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MessageStatusEnum, MsgEnum, UploadSceneEnum } from '@/enums'
import { parseInnerText } from '@/hooks/useCommon.ts'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/hooks/useUpload'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { fixFileMimeType, isVideoUrl } from '@/utils/FileType'
import { getMimeTypeFromExtension, removeTag } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isMobile } from '@/utils/PlatformConstants'
import { generateVideoThumbnail } from '@/utils/VideoThumbnail'
import { useGroupStore } from '../stores/domains/chat/group'
import { removeTempFile } from '@/utils/TempFileManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageStrategy')

interface ReplyRef {
  content: string
  key: string
}

interface ImageInfo {
  width: number
  height: number
  size: number
}

interface CallInfo {
  duration: number
  reason: string
  startTime: number
  endTime: number
  creator: string
  isGroup: boolean
}

export interface MessageStrategy {
  getMsg: (
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
  buildMessageBody: (msg: Record<string, unknown>, reply: MessageType | null) => Record<string, unknown>
  buildMessageType: (
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ) => MessageType
  uploadFile: (
    path: string,
    options?: { provider?: UploadProviderEnum }
  ) => Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }>
  doUpload: (path: string, uploadUrl: string, options?: UploadOptions) => Promise<string | void>
  uploadThumbnail?: (
    thumbnailFile: File,
    options?: { provider?: UploadProviderEnum }
  ) => Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }>
  doUploadThumbnail?: (thumbnailFile: File, uploadUrl: string, options?: UploadOptions) => Promise<string | void>
  getUploadProgress?: () => { progress: Ref<number>; onChange: (callback: (progress: number) => void) => void }
}

/**
 * 消息策略抽象类，所有消息策略都必须实现这个接口
 */
abstract class AbstractMessageStrategy implements MessageStrategy {
  public readonly msgType: MsgEnum

  constructor(msgType: MsgEnum) {
    this.msgType = msgType
  }

  buildMessageType(
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ): MessageType {
    const currentTime = new Date().getTime()
    const groupStore = useGroupStore()
    return {
      fromUser: {
        uid: userUid.value || '',
        username: groupStore.getUserInfo(userUid.value)?.name || '',
        avatar: groupStore.getUserInfo(userUid.value)?.avatar || '',
        locPlace: groupStore.getUserInfo(userUid.value)?.locPlace || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: currentTime,
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }

  abstract buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown>

  abstract getMsg(
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ): Record<string, unknown> | Promise<Record<string, unknown>>

  uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    logger.debug('Base uploadFile method called with:', path, options)
    throw new AppException('该消息类型不支持文件上传')
  }

  doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    logger.debug('Base doUpload method called with:', path, uploadUrl, options)
    throw new AppException('该消息类型不支持文件上传')
  }
}

/**
 * 处理 Beacon 位置信标消息
 */
class BeaconMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.BEACON)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    try {
      const beaconData = JSON.parse(msgInputValue)

      if (!beaconData.description || beaconData.timeout === undefined || beaconData.isLive === undefined) {
        throw new AppException('无效的信标数据，缺少必要字段')
      }

      return {
        type: this.msgType,
        description: beaconData.description,
        timeout: beaconData.timeout,
        isLive: beaconData.isLive,
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('信标数据格式错误，必须是有效的JSON')
      }
      throw error
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      description: msg.description,
      timeout: msg.timeout,
      live: msg.isLive,
      // Matrix 规定的信标资产类型，通常是 'm.self' (自己的位置) 或 'm.pin' (放置的图钉)
      'org.matrix.msc3488.asset': {
        type: 'm.self'
      },
      // 必须包含一个初始的位置点以便向后兼容
      'org.matrix.msc3488.ts': Date.now(),
      msgtype: 'm.beacon_info',
      body: `开启了位置共享: ${msg.description}`,
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
}

class TextMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    // 处理&nbsp;为空格
    let content = removeTag(msgInputValue)
    if (content && typeof content === 'string') {
      content = content.replace(/&nbsp;/g, ' ')
    }

    const msg: Record<string, unknown> = {
      type: this.msgType,
      content: content,
      reply: replyValue?.message?.body?.content
        ? {
            content: replyValue.message.body.content,
            key: replyValue.message.id
          }
        : undefined
    }
    // 处理回复内容
    if (replyValue?.message?.body?.content) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(msg.content as string)
      const replyDiv = tempDiv.querySelector('#replyDiv')
      if (replyDiv) {
        replyDiv.parentNode?.removeChild(replyDiv)
      }
      tempDiv.innerHTML = DOMPurify.sanitize(removeTag(tempDiv.innerHTML), { RETURN_DOM: false })

      // 确保所有的&nbsp;都被替换为空格
      msg.content = tempDiv.innerHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }
    // 验证消息长度
    if ((msg.content as string).length > 500) {
      throw new AppException('消息内容超过限制500，请分段发送')
    }
    return msg
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      content: msg.content,
      msgtype: 'm.text',
      body: msg.content,
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
}

class ImageMessageStrategyImpl extends AbstractMessageStrategy {
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

/**
 * 处理位置消息的策略
 */
class LocationMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.LOCATION)
  }

  /**
   * 构建位置消息对象
   * @param msgInputValue 位置数据JSON字符串
   * @param replyValue 回复信息
   * @returns 位置消息对象
   */
  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    try {
      // 解析位置数据
      const locationData = JSON.parse(msgInputValue)

      // 验证必要字段
      if (!locationData.latitude || !locationData.longitude || !locationData.address) {
        throw new AppException('无效的位置数据，缺少必要字段')
      }

      return {
        type: this.msgType,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        precision: locationData.precision || '高精度',
        timestamp: locationData.timestamp || Date.now(),
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('位置数据格式错误，必须是有效的JSON')
      }
      throw error
    }
  }

  /**
   * 构建消息体
   * @param msg 位置消息对象
   * @param reply 回复信息
   * @returns 消息体
   */
  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      geo_uri: `geo:${msg.latitude},${msg.longitude};u=${msg.precision === '高精度' ? 10 : 100}`,
      msgtype: 'm.location',
      body: `位置: ${msg.address}`,
      info: {
        address: msg.address,
        timestamp: msg.timestamp
      },
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

  buildMessageType(
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ): MessageType {
    const groupStore = useGroupStore()
    const userInfo = groupStore.getUserInfo(userUid.value)

    return {
      fromUser: {
        uid: userUid.value || '',
        username: userInfo?.name || '',
        avatar: userInfo?.avatar || '',
        locPlace: userInfo?.locPlace || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: Date.now(),
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }
}

/**
 * 处理文件消息
 */
class FileMessageStrategyImpl extends AbstractMessageStrategy {
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

class EmojiMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.EMOJI)
  }

  // 验证是否是有效的表情包URL
  private isValidEmojiUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    // 检查是否是URL
    if (!this.isValidEmojiUrl(msgInputValue)) {
      throw new AppException('无效的表情包URL')
    }

    return {
      type: this.msgType,
      url: msgInputValue,
      path: msgInputValue,
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
      url: msg.url as string,
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
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    logger.debug('表情包使用原始URL:', path, options)
    return {
      uploadUrl: '',
      downloadUrl: path
    }
  }

  async doUpload(path?: string, uploadUrl?: string, options?: UploadOptions): Promise<void> {
    logger.debug('表情包无需上传，跳过上传步骤', path, uploadUrl, options)
    return Promise.resolve()
  }
}

/**
 * 处理视频消息
 */
class VideoMessageStrategyImpl extends AbstractMessageStrategy {
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

class UnsupportedMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.UNKNOWN)
  }

  getMsg(_msgInputValue: string, _replyValue: MessageType | null, _fileList?: File[]): Record<string, unknown> {
    throw new AppException('暂不支持该类型消息')
  }

  buildMessageBody(_msg: Record<string, unknown>, _reply: MessageType | null): Record<string, unknown> {
    throw new AppException('方法暂未实现')
  }

  buildMessageType(
    _messageId: string,
    _messageBody: Record<string, unknown>,
    _globalStore: { currentSessionRoomId: string },
    _userUid: Ref<string>
  ): MessageType {
    throw new AppException('方法暂未实现')
  }
}

class VoiceMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VOICE)
  }

  getMsg(): Record<string, unknown> {
    const voiceMessageDivs = document.querySelectorAll('.voice-message-placeholder')
    const lastVoiceDiv = voiceMessageDivs[voiceMessageDivs.length - 1] as HTMLElement

    const localPath = lastVoiceDiv.dataset.url || ''
    const assetUrl = `asset://${localPath}`

    return {
      type: MsgEnum.VOICE,
      localPath,
      url: assetUrl,
      size: parseInt(lastVoiceDiv.dataset.size || '0', 10),
      duration: parseFloat(lastVoiceDiv.dataset.duration || '0'),
      filename: lastVoiceDiv.dataset.filename || 'voice.mp3',
      mimeType: lastVoiceDiv.dataset.mimeType || 'audio/mpeg'
    }
  }

  buildMessageBody(msg: Record<string, unknown>): Record<string, unknown> {
    return {
      url: msg.url,
      size: msg.size,
      second: Math.round(msg.duration as number),
      fileName: msg.filename,
      mimeType: msg.mimeType
    }
  }

  buildMessageType(
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ): MessageType {
    const baseMessage = super.buildMessageType(messageId, messageBody, globalStore, userUid)
    return {
      ...baseMessage,
      message: {
        ...baseMessage.message,
        type: MsgEnum.VOICE,
        body: {
          url: messageBody.url as string,
          size: messageBody.size as number,
          second: messageBody.second as number,
          fileName: messageBody.fileName as string,
          mimeType: messageBody.mimeType as string
        }
      }
    }
  }

  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> {
    const uploadHook = useUpload()

    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT
      }

      const result = await uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      return result
    } catch {
      throw new AppException('获取语音上传链接失败，请重试')
    }
  }

  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    const uploadHook = useUpload()

    try {
      return await uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })
    } catch {
      throw new AppException('语音文件上传失败，请重试')
    }
  }
}

/**
 * 处理视频通话系统消息
 * 消息结构
 */
class VideoCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VIDEO_CALL)
  }

  getMsg(_msgInputValue: string, _replyValue: MessageType | null, _fileList?: File[]): Record<string, unknown> {
    const callInfo = _replyValue as unknown as CallInfo
    return {
      type: this.msgType,
      duration: callInfo.duration,
      reason: callInfo.reason,
      startTime: callInfo.startTime,
      endTime: callInfo.endTime,
      creator: callInfo.creator,
      isGroup: callInfo.isGroup
    }
  }

  buildMessageBody(msg: Record<string, unknown>): Record<string, unknown> {
    return {
      duration: msg.duration,
      reason: msg.reason,
      startTime: msg.startTime,
      endTime: msg.endTime,
      creator: msg.creator,
      isGroup: msg.isGroup
    }
  }

  async uploadFile(): Promise<{ uploadUrl: string; downloadUrl: string }> {
    return { uploadUrl: '', downloadUrl: '' }
  }

  async doUpload(): Promise<void> {}
}

class AudioCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.AUDIO_CALL)
  }

  getMsg(_msgInputValue: string, _replyValue: MessageType | null, _fileList?: File[]): Record<string, unknown> {
    const callInfo = _replyValue as unknown as CallInfo
    return {
      type: this.msgType,
      duration: callInfo.duration,
      reason: callInfo.reason,
      startTime: callInfo.startTime,
      endTime: callInfo.endTime,
      creator: callInfo.creator,
      isGroup: callInfo.isGroup
    }
  }

  buildMessageBody(msg: Record<string, unknown>): Record<string, unknown> {
    return {
      duration: msg.duration,
      reason: msg.reason,
      startTime: msg.startTime,
      endTime: msg.endTime,
      creator: msg.creator,
      isGroup: msg.isGroup
    }
  }

  async uploadFile(): Promise<{ uploadUrl: string; downloadUrl: string }> {
    return {
      uploadUrl: '',
      downloadUrl: ''
    }
  }

  async doUpload(): Promise<void> {
    return Promise.resolve()
  }
}

/**
 * 链接预览消息
 */
class LinkPreviewMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.LINK_PREVIEW)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    try {
      const linkData = JSON.parse(msgInputValue)

      if (!linkData.url || !linkData.title) {
        throw new AppException('无效的链接预览数据，缺少必要字段')
      }

      return {
        type: this.msgType,
        url: linkData.url,
        title: linkData.title,
        description: linkData.description || '',
        imageUrl: linkData.imageUrl || '',
        siteName: linkData.siteName || '',
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('链接数据格式错误，必须是有效的JSON')
      }
      throw error
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      msgtype: 'm.text',
      body: msg.url as string,
      format: 'org.matrix.custom.html',
      formatted_body: `<a href="${msg.url}">${msg.title}</a>`,
      'org.matrix.msc2788.room.message': {
        url: msg.url,
        title: msg.title,
        description: msg.description,
        image_url: msg.imageUrl,
        site_name: msg.siteName
      },
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
}

const textMessageStrategy = new TextMessageStrategyImpl()
const fileMessageStrategy = new FileMessageStrategyImpl()
const imageMessageStrategy = new ImageMessageStrategyImpl()
const emojiMessageStrategy = new EmojiMessageStrategyImpl()
const unsupportedMessageStrategy = new UnsupportedMessageStrategyImpl()
const videoMessageStrategy = new VideoMessageStrategyImpl()
const voiceMessageStrategy = new VoiceMessageStrategyImpl()
const videoCallMessageStrategy = new VideoCallMessageStrategyImpl()
const audioCallMessageStrategy = new AudioCallMessageStrategyImpl()
const locationMessageStrategy = new LocationMessageStrategyImpl()
const beaconMessageStrategy = new BeaconMessageStrategyImpl()
const linkPreviewMessageStrategy = new LinkPreviewMessageStrategyImpl()

export const messageStrategyMap: Record<MsgEnum, MessageStrategy> = {
  [MsgEnum.FILE]: fileMessageStrategy,
  [MsgEnum.IMAGE]: imageMessageStrategy,
  [MsgEnum.TEXT]: textMessageStrategy,
  [MsgEnum.NOTICE]: unsupportedMessageStrategy,
  [MsgEnum.MERGE]: unsupportedMessageStrategy,
  [MsgEnum.EMOJI]: emojiMessageStrategy,
  [MsgEnum.UNKNOWN]: unsupportedMessageStrategy,
  [MsgEnum.RECALL]: unsupportedMessageStrategy,
  [MsgEnum.VOICE]: voiceMessageStrategy,
  [MsgEnum.VIDEO]: videoMessageStrategy,
  [MsgEnum.SYSTEM]: unsupportedMessageStrategy,
  [MsgEnum.MIXED]: unsupportedMessageStrategy,
  [MsgEnum.AIT]: unsupportedMessageStrategy,
  [MsgEnum.REPLY]: unsupportedMessageStrategy,
  [MsgEnum.AI]: unsupportedMessageStrategy,
  [MsgEnum.BOT]: unsupportedMessageStrategy,
  [MsgEnum.VIDEO_CALL]: videoCallMessageStrategy,
  [MsgEnum.AUDIO_CALL]: audioCallMessageStrategy,
  [MsgEnum.LOCATION]: locationMessageStrategy,
  [MsgEnum.AUDIO]: voiceMessageStrategy,
  [MsgEnum.BEACON]: beaconMessageStrategy,
  [MsgEnum.LINK_PREVIEW]: linkPreviewMessageStrategy
}
