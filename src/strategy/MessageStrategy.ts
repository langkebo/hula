import { BaseDirectory, readFile, writeFile } from '@tauri-apps/plugin-fs'
import DOMPurify from 'dompurify'
import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MessageStatusEnum, MsgEnum, UploadSceneEnum } from '@/enums'
import { parseInnerText } from '@/hooks/useCommon.ts'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/hooks/useUpload'
import type { MessageType } from '@/stores/chat/message'
import { fixFileMimeType, isVideoUrl } from '@/utils/FileType'
import { getMimeTypeFromExtension, removeTag } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isMobile } from '@/utils/PlatformConstants'
import { generateVideoThumbnail } from '@/utils/VideoThumbnail'
import { useGroupStore } from '../stores/group'
import { removeTempFile } from '@/utils/TempFileManager'
import { createLogger } from '@/utils/Logger'
import type { MessageBody, UploadResult, UploadProgress, GlobalStore } from '@/types/message-strategy'

const logger = createLogger('MessageStrategy')

export interface MessageStrategy {
  getMsg: (
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ) => MessageBody | Promise<MessageBody>
  buildMessageBody: (msg: MessageBody, reply: MessageType | null) => MessageBody
  buildMessageType: (
    messageId: string,
    messageBody: MessageBody,
    globalStore: GlobalStore,
    userUid: Ref<string>
  ) => MessageType
  uploadFile: (path: string, options?: { provider?: UploadProviderEnum }) => Promise<UploadResult>
  doUpload: (path: string, uploadUrl: string, options?: UploadOptions) => Promise<{ qiniuUrl?: string } | void>
  uploadThumbnail?: (thumbnailFile: File, options?: { provider?: UploadProviderEnum }) => Promise<UploadResult>
  doUploadThumbnail?: (
    thumbnailFile: File,
    uploadUrl: string,
    options?: UploadOptions
  ) => Promise<{ qiniuUrl?: string } | void>
  getUploadProgress?: () => UploadProgress
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
    messageBody: MessageBody,
    globalStore: GlobalStore,
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

  abstract buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody

  abstract getMsg(
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ): MessageBody | Promise<MessageBody>

  uploadFile(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
    logger.debug('Base uploadFile method called with:', path, options)
    throw new AppException('该消息类型不支持文件上传')
  }

  doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<{ qiniuUrl?: string } | void> {
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

  getMsg(msgInputValue: string, replyValue: MessageType | null): MessageBody {
    try {
      const beaconData = JSON.parse(msgInputValue)

      if (!beaconData.description || beaconData.timeout === undefined || beaconData.isLive === undefined) {
        throw new AppException('无效的信标数据，缺少必要字段')
      }

      return {
        msgtype: 'm.beacon_info',
        body: beaconData.description,
        description: beaconData.description,
        timeout: beaconData.timeout,
        isLive: beaconData.isLive,
        'm.relates_to': replyValue?.message?.body?.body
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
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

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.beacon_info',
      body: `开启了位置共享: ${msg.description || ''}`,
      description: msg.description,
      timeout: msg.timeout,
      live: msg.isLive,
      'org.matrix.msc3488.asset': {
        type: 'm.self'
      },
      'org.matrix.msc3488.ts': Date.now(),
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
    }
  }
}

/**
 * 处理文本消息
 */
class TextMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): MessageBody {
    // 处理&nbsp;为空格
    let content = removeTag(msgInputValue)
    if (content && typeof content === 'string') {
      content = content.replace(/&nbsp;/g, ' ')
    }

    // 处理回复内容
    if (replyValue?.message?.body?.body) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(content)
      const replyDiv = tempDiv.querySelector('#replyDiv')
      if (replyDiv) {
        replyDiv.parentNode?.removeChild(replyDiv)
      }
      tempDiv.innerHTML = DOMPurify.sanitize(removeTag(tempDiv.innerHTML), { RETURN_DOM: false })

      // 确保所有的&nbsp;都被替换为空格
      content = tempDiv.innerHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }

    // 验证消息长度
    if (content.length > 500) {
      throw new AppException('消息内容超过限制500，请分段发送')
    }

    return {
      msgtype: 'm.text',
      body: content,
      'm.relates_to': replyValue?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: replyValue.message.id
            }
          }
        : undefined
    }
  }

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.text',
      body: msg.body || '',
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
    }
  }
}

/** 处理图片消息 */
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
    } catch (_error) {
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
    } catch (_error) {
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
  async getMsg(msgInputValue: string, replyValue: MessageType | null, fileList?: File[]): Promise<MessageBody> {
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
        msgtype: 'm.image',
        body: file.name,
        url: previewUrl,
        info: {
          w: width,
          h: height,
          size: file.size,
          mimetype: file.type
        },
        path: tempPath,
        'm.relates_to': replyValue?.message?.id
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
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
          msgtype: 'm.image',
          body: 'image',
          url: msgInputValue,
          info: {
            w: width,
            h: height,
            size,
            mimetype: 'image/jpeg'
          },
          path: msgInputValue,
          'm.relates_to': replyValue?.message?.id
            ? {
                'm.in_reply_to': {
                  event_id: replyValue.message.id
                }
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
        msgtype: 'm.image',
        body: fileName,
        url: previewUrl,
        info: {
          w: width,
          h: height,
          size: originalFile.size,
          mimetype: originalFile.type
        },
        path: normalizedPath,
        'm.relates_to': replyValue?.message?.id
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
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
  async uploadFile(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
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
        provider: options?.provider || UploadProviderEnum.QINIU,
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
  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<{ qiniuUrl?: string } | void> {
    // 如果是URL，跳过上传
    if (this.isImageUrl(path)) {
      return
    }

    try {
      // enableDeduplication启用文件去重
      const uploadOptions: UploadOptions = { ...options, enableDeduplication: true }
      const result = await this.uploadHook.doUpload(path, uploadUrl, uploadOptions)
      // 如果是七牛云上传，返回qiniuUrl
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      logger.error('文件上传失败:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('文件上传失败，请重试')
    }
  }

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.image',
      body: msg.body || 'image',
      url: msg.url,
      info: msg.info,
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
    }
  }

  getUploadProgress(): UploadProgress {
    return {
      progress: this.uploadHook.progress,
      onChange: (callback: (progress: number) => void) => {
        this.uploadHook.onChange(() => callback(this.uploadHook.progress.value))
      }
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
  getMsg(msgInputValue: string, replyValue: MessageType | null): MessageBody {
    try {
      // 解析位置数据
      const locationData = JSON.parse(msgInputValue)

      // 验证必要字段
      if (!locationData.latitude || !locationData.longitude || !locationData.address) {
        throw new AppException('无效的位置数据，缺少必要字段')
      }

      const precision = locationData.precision || '高精度'
      const geoUri = `geo:${locationData.latitude},${locationData.longitude};u=${precision === '高精度' ? 10 : 100}`

      return {
        msgtype: 'm.location',
        body: `位置: ${locationData.address}`,
        geo_uri: geoUri,
        info: {
          address: locationData.address,
          timestamp: locationData.timestamp || Date.now()
        },
        'm.relates_to': replyValue?.message?.id
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
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
  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.location',
      body: msg.body || '位置',
      geo_uri: msg.geo_uri,
      info: msg.info,
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
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

  async getMsg(msgInputValue: string, replyValue: MessageType | null, fileList?: File[]): Promise<MessageBody> {
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
      msgtype: 'm.file',
      body: validatedFile.name,
      filename: validatedFile.name,
      info: {
        size: validatedFile.size,
        mimetype: validatedFile.type
      },
      path: tempPath,
      'm.relates_to': replyValue?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: replyValue.message.id
            }
          }
        : undefined
    }
  }

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.file',
      body: msg.body || (msg.filename as string) || 'file',
      filename: msg.filename as string,
      url: (msg.url as string) || '',
      info: msg.info,
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
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
  async uploadFile(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
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
  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<{ qiniuUrl?: string } | void> {
    try {
      // enableDeduplication启用文件去重
      const uploadOptions: UploadOptions = { ...options, enableDeduplication: true }
      const result = await this.uploadHook.doUpload(path, uploadUrl, uploadOptions)

      // 如果是七牛云上传，返回qiniuUrl
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      logger.error('文件上传失败:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('文件上传失败，请重试')
    }
  }

  getUploadProgress(): UploadProgress {
    return {
      progress: this.uploadHook.progress,
      onChange: (callback: (progress: number) => void) => {
        this.uploadHook.onChange(() => callback(this.uploadHook.progress.value))
      }
    }
  }
}

/**
 * 处理表情包消息
 */
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

  getMsg(msgInputValue: string, replyValue: MessageType | null): MessageBody {
    // 检查是否是URL
    if (!this.isValidEmojiUrl(msgInputValue)) {
      throw new AppException('无效的表情包URL')
    }

    return {
      msgtype: 'm.sticker',
      body: 'sticker',
      url: msgInputValue,
      'm.relates_to': replyValue?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: replyValue.message.id
            }
          }
        : undefined
    }
  }

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.sticker',
      body: msg.body || 'sticker',
      url: msg.url,
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
    }
  }

  async uploadFile(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
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
  getUploadProgress(): UploadProgress {
    return {
      progress: this.uploadHook.progress,
      onChange: (callback: (progress: number) => void) => {
        this.uploadHook.onChange(() => callback(this.uploadHook.progress.value))
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

  async getMsg(msgInputValue: string, replyValue: MessageType | null, fileList?: File[]): Promise<MessageBody> {
    // 1. 优先处理fileList中的文件
    if (fileList && fileList.length > 0) {
      const file = fileList[0]

      // 验证视频文件
      const validatedFile = await this.validateVideo(file)
      const thumbnailFile = await generateVideoThumbnail(validatedFile)

      // 创建预览 URL
      const thumbnailUrl = URL.createObjectURL(thumbnailFile)

      // 将文件保存到缓存目录
      const tempPath = `temp-video-${Date.now()}-${file.name}`
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, validatedFile.stream(), { baseDir })

      return {
        msgtype: 'm.video',
        body: validatedFile.name,
        url: '',
        info: {
          size: validatedFile.size,
          mimetype: validatedFile.type,
          duration: 0,
          thumbnail_url: thumbnailUrl,
          thumbnail_info: {
            mimetype: 'image/jpeg',
            size: thumbnailFile.size
          }
        },
        path: tempPath,
        thumbnailFile,
        'm.relates_to': replyValue?.message?.id
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
            }
          : undefined
      }
    }

    // 2. 处理远程视频URL的情况
    if (isVideoUrl(msgInputValue)) {
      return {
        msgtype: 'm.video',
        body: 'video',
        url: msgInputValue,
        path: msgInputValue,
        'm.relates_to': replyValue?.message?.id
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
            }
          : undefined
      }
    }

    // 3. 处理本地视频文件
    const actualFile = await this.convertToVideoFile(msgInputValue)

    // 4. 验证视频文件
    const validatedFile = await this.validateVideo(actualFile)
    const thumbnailFile = await generateVideoThumbnail(validatedFile)
    const thumbnailUrl = URL.createObjectURL(thumbnailFile)

    const path = parseInnerText(msgInputValue, 'temp-video')
    if (!path) {
      throw new AppException('文件不存在')
    }
    const normalizedPath = path.replace(/\\/g, '/')
    return {
      msgtype: 'm.video',
      body: validatedFile.name,
      url: '',
      info: {
        size: validatedFile.size,
        mimetype: validatedFile.type,
        duration: 0,
        thumbnail_url: thumbnailUrl,
        thumbnail_info: {
          mimetype: 'image/jpeg',
          size: thumbnailFile.size
        }
      },
      path: normalizedPath,
      thumbnailFile,
      'm.relates_to': replyValue?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: replyValue.message.id
            }
          }
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
  async uploadThumbnail(thumbnailFile: File, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
    try {
      // 创建临时文件路径用于上传
      const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT,
        enableDeduplication: true
      }

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
  async doUploadThumbnail(
    thumbnailFile: File,
    uploadUrl: string,
    options?: UploadOptions
  ): Promise<{ qiniuUrl?: string } | void> {
    try {
      // 将File对象写入临时文件，然后使用现有的doUpload方法
      const tempPath = `temp-thumbnail-${Date.now()}-${thumbnailFile.name}`

      // 写入临时文件
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      await writeFile(tempPath, thumbnailFile.stream(), { baseDir })

      const uploadOptions: UploadOptions = { ...options, enableDeduplication: true }
      const result = await this.uploadHook.doUpload(tempPath, uploadUrl, uploadOptions)

      // 清理临时文件
      await removeTempFile(tempPath, { baseDir })

      // 如果是七牛云上传，返回qiniuUrl
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (error) {
      logger.error('缩略图上传失败:', error)
      if (error instanceof AppException) {
        throw error
      }
      throw new AppException('缩略图上传失败，请重试')
    }
  }

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.video',
      body: msg.body || 'video',
      url: msg.url,
      info: msg.info,
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
    }
  }

  async uploadFile(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
    // 远程视频直接返回URL
    if (isVideoUrl(path)) {
      return { uploadUrl: '', downloadUrl: path }
    }

    try {
      const result = await this.uploadHook.getUploadAndDownloadUrl(path, {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT
      })
      return result
    } catch (_error) {
      throw new AppException('获取视频上传链接失败')
    }
  }

  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<{ qiniuUrl?: string } | void> {
    if (isVideoUrl(path)) {
      return
    }

    try {
      const uploadOptions: UploadOptions = { ...options, enableDeduplication: true }
      const result = await this.uploadHook.doUpload(path, uploadUrl, uploadOptions)
      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
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

  getMsg(_msgInputValue: string, _replyValue: MessageType | null, _fileList?: File[]): never {
    throw new AppException('暂不支持该类型消息')
  }

  buildMessageBody(_msg: MessageBody, _reply: MessageType | null): never {
    throw new AppException('方法暂未实现')
  }

  buildMessageType(
    _messageId: string,
    _messageBody: MessageBody,
    _globalStore: GlobalStore,
    _userUid: Ref<string>
  ): never {
    throw new AppException('方法暂未实现')
  }
}

class VoiceMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VOICE)
  }

  getMsg(): MessageBody {
    const voiceMessageDivs = document.querySelectorAll('.voice-message-placeholder')
    const lastVoiceDiv = voiceMessageDivs[voiceMessageDivs.length - 1] as HTMLElement

    // 将相对路径转换为 Tauri 资源路径
    const localPath = lastVoiceDiv.dataset.url
    const assetUrl = `asset://${localPath}`

    return {
      msgtype: 'm.audio',
      body: lastVoiceDiv.dataset.filename || 'voice.mp3',
      url: assetUrl,
      info: {
        size: parseInt(lastVoiceDiv.dataset.size || '0', 10),
        duration: parseFloat(lastVoiceDiv.dataset.duration || '0'),
        mimetype: 'audio/mpeg'
      }
    }
  }

  buildMessageBody(msg: MessageBody): MessageBody {
    return {
      msgtype: 'm.audio',
      body: msg.body || 'voice',
      url: msg.url,
      info: msg.info
    }
  }

  async uploadFile(path: string, options?: { provider?: UploadProviderEnum }): Promise<UploadResult> {
    const uploadHook = useUpload()

    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.QINIU,
        scene: UploadSceneEnum.CHAT
      }

      const result = await uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      return result
    } catch (_error) {
      throw new AppException('获取语音上传链接失败，请重试')
    }
  }

  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<{ qiniuUrl?: string } | void> {
    const uploadHook = useUpload()

    try {
      const uploadOptions: UploadOptions = { ...options, enableDeduplication: true }
      const result = await uploadHook.doUpload(path, uploadUrl, uploadOptions)

      if (options?.provider === UploadProviderEnum.QINIU) {
        return { qiniuUrl: result as string }
      }
    } catch (_error) {
      throw new AppException('语音文件上传失败，请重试')
    }
  }
}

/**
 * 处理视频通话系统消息
 */
class VideoCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VIDEO_CALL)
  }

  getMsg(_msgInputValue: string, callInfo: MessageType | null): MessageBody {
    const info = callInfo as unknown as {
      duration: number
      reason: string
      startTime: number
      endTime: number
      creator: string
      isGroup: boolean
    }
    return {
      msgtype: 'm.call.hangup',
      body: '视频通话',
      duration: info.duration,
      reason: info.reason,
      startTime: info.startTime,
      endTime: info.endTime,
      creator: info.creator,
      isGroup: info.isGroup
    }
  }

  buildMessageBody(msg: MessageBody): MessageBody {
    return {
      msgtype: 'm.call.hangup',
      body: '视频通话',
      duration: msg.duration,
      reason: msg.reason,
      startTime: msg.startTime,
      endTime: msg.endTime,
      creator: msg.creator,
      isGroup: msg.isGroup
    }
  }

  async uploadFile(): Promise<UploadResult> {
    return { uploadUrl: '', downloadUrl: '' }
  }

  async doUpload() {}
}

/**
 * 处理音频通话系统消息
 */
class AudioCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.AUDIO_CALL)
  }

  getMsg(_msgInputValue: string, callInfo: MessageType | null): MessageBody {
    const info = callInfo as unknown as {
      duration: number
      reason: string
      startTime: number
      endTime: number
      creator: string
      isGroup: boolean
    }
    return {
      msgtype: 'm.call.hangup',
      body: '语音通话',
      duration: info.duration,
      reason: info.reason,
      startTime: info.startTime,
      endTime: info.endTime,
      creator: info.creator,
      isGroup: info.isGroup
    }
  }

  buildMessageBody(msg: MessageBody): MessageBody {
    return {
      msgtype: 'm.call.hangup',
      body: '语音通话',
      duration: msg.duration,
      reason: msg.reason,
      startTime: msg.startTime,
      endTime: msg.endTime,
      creator: msg.creator,
      isGroup: msg.isGroup
    }
  }

  async uploadFile(): Promise<UploadResult> {
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

  getMsg(msgInputValue: string, replyValue: MessageType | null): MessageBody {
    try {
      const linkData = JSON.parse(msgInputValue)

      if (!linkData.url || !linkData.title) {
        throw new AppException('无效的链接预览数据，缺少必要字段')
      }

      return {
        msgtype: 'm.text',
        body: linkData.url,
        format: 'org.matrix.custom.html',
        formatted_body: `<a href="${linkData.url}">${linkData.title}</a>`,
        'org.matrix.msc2788.room.message': {
          url: linkData.url,
          title: linkData.title,
          description: linkData.description || '',
          image_url: linkData.imageUrl || '',
          site_name: linkData.siteName || ''
        },
        'm.relates_to': replyValue?.message?.id
          ? {
              'm.in_reply_to': {
                event_id: replyValue.message.id
              }
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

  buildMessageBody(msg: MessageBody, reply: MessageType | null): MessageBody {
    return {
      msgtype: 'm.text',
      body: msg.body || '',
      format: msg.format,
      formatted_body: msg.formatted_body,
      'org.matrix.msc2788.room.message': msg['org.matrix.msc2788.room.message'],
      'm.relates_to': reply?.message?.id
        ? {
            'm.in_reply_to': {
              event_id: reply.message.id
            }
          }
        : undefined
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
