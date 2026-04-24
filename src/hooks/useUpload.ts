import { Channel, invoke } from '@tauri-apps/api/core'
import { BaseDirectory, stat, writeFile } from '@tauri-apps/plugin-fs'
import { createEventHook } from '@vueuse/core'
import { TauriCommand, UploadSceneEnum } from '@/enums'
import { useUserStore } from '@/stores/domains/user/user'
import { extractFileName } from '@/utils/Formatting'
import { getImageDimensions } from '@/utils/ImageUtils'
import { uploadService } from '@/services/UploadService'
import { isAndroid, isMobile } from '@/utils/PlatformConstants'
import { getWasmMd5 } from '@/utils/Md5Util'
import { removeTempFile } from '@/utils/TempFileManager'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('Upload')

/** 文件信息类型 */
export type FileInfoType = {
  name: string
  type: string
  size: number
  suffix: string
  width?: number
  height?: number
  downloadUrl?: string
  second?: number
  thumbWidth?: number
  thumbHeight?: number
  thumbUrl?: string
}

/** 上传方式 */
export enum UploadProviderEnum {
  /** 默认上传方式 */
  DEFAULT = 'default',
  /** MinIO 上传 */
  MINIO = 'minio'
}

/** 上传配置 */
export interface UploadOptions {
  /** 上传方式 */
  provider?: UploadProviderEnum
  /** 上传场景 */
  scene?: UploadSceneEnum
  /** 是否启用文件去重（使用文件哈希作为文件名） */
  enableDeduplication?: boolean
}

const Max = 500 // 单位M
const MAX_FILE_SIZE = Max * 1024 * 1024 // 最大上传限制

let cryptoJS: {
  lib: { WordArray: { create: (arr: ArrayBuffer | Uint8Array) => { words: number[]; sigBytes: number } } }
  MD5: (wordArray: string | { words: number[]; sigBytes: number }) => { toString: () => string }
} | null = null

const isAbsolutePath = (path: string): boolean => {
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(path)
}

const loadCryptoJS = async () => {
  if (!cryptoJS) {
    const module = await import('crypto-js')
    const loaded = module.default ?? module
    cryptoJS = loaded as unknown as NonNullable<typeof cryptoJS>
  }
  return cryptoJS
}

/**
 * 文件上传Hook
 */
export const useUpload = () => {
  const userStore = useUserStore()
  const isUploading = ref(false) // 是否正在上传
  const progress = ref(0) // 进度
  const fileInfo = ref<FileInfoType | null>(null) // 文件信息
  const currentProvider = ref<UploadProviderEnum>(UploadProviderEnum.DEFAULT) // 当前上传方式

  const { on: onChange, trigger } = createEventHook()
  const onStart = createEventHook()

  const uploadFileWithTauriPut = async (targetUrl: string, file: File, contentType: string) => {
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
    const baseDirName = isMobile() ? 'AppData' : 'AppCache'
    const safeFileName = file.name.replace(/[\\/]/g, '_')
    const tempPath = `temp-upload-${Date.now()}-${safeFileName}`

    try {
      await writeFile(tempPath, file.stream(), { baseDir })

      const onProgress = new Channel<{ progressTotal: number; total: number }>()
      let lastProgress = -1
      onProgress.onmessage = ({ progressTotal, total }) => {
        const pct = total > 0 ? Math.floor((progressTotal / total) * 100) : 0
        if (pct !== lastProgress) {
          lastProgress = pct
          progress.value = pct
          trigger('progress')
        }
      }

      await invoke(TauriCommand.UPLOAD_FILE_PUT, {
        url: targetUrl,
        path: tempPath,
        baseDir: baseDirName,
        headers: { 'Content-Type': contentType },
        onProgress
      })
    } finally {
      await removeTempFile(tempPath, { baseDir, silent: true })
    }
  }

  /**
   * 计算文件的MD5哈希值
   * @param file 文件
   * @returns MD5哈希值
   */
  const calculateFileHash = async (file: File): Promise<string> => {
    const startTime = performance.now()
    try {
      logger.debug('开始计算MD5哈希值，文件大小:', file.size, 'bytes')
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let hash: string

      if (isAndroid()) {
        const CryptoJS = await loadCryptoJS()
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as ArrayBuffer)
        hash = CryptoJS.MD5(wordArray).toString()
      } else {
        const Md5 = await getWasmMd5()
        hash = await Md5.digest_u8(uint8Array)
      }
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      logger.debug(`MD5计算完成，耗时: ${duration}ms，哈希值: ${hash}`)
      return hash.toLowerCase()
    } catch (error) {
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      logger.error(`计算文件哈希值失败，耗时: ${duration}ms:`, error)
      // 如果计算失败，返回时间戳作为备用方案
      return Date.now().toString()
    }
  }

  /**
   * 生成文件哈希
   * @param options 上传配置
   * @param fileObj 文件对象
   * @param fileName 文件名
   * @returns 文件哈希
   */
  const generateHashKey = async (
    options: { scene: UploadSceneEnum; enableDeduplication: boolean },
    fileObj: File,
    fileName: string
  ) => {
    let key: string

    if (options.enableDeduplication) {
      // 使用文件哈希作为文件名的一部分，实现去重
      const fileHash = await calculateFileHash(fileObj)
      const fileSuffix = fileName.split('.').pop() || ''
      // 获取当前登录用户的account
      const account = userStore.userInfo!.account
      key = `${options.scene}/${account}/${fileHash}.${fileSuffix}`
      logger.debug('使用文件去重模式，文件哈希:', fileHash)
    } else {
      // 使用时间戳生成唯一的文件名
      key = `${options.scene}/${Date.now()}_${fileName}`
    }
    return key
  }

  const resolveProvider = async (provider?: UploadProviderEnum): Promise<UploadProviderEnum> => {
    if (provider) {
      currentProvider.value = provider
      return currentProvider.value
    }

    try {
      const res = await uploadService.getUploadProvider()
      currentProvider.value = res?.provider === 'minio' ? UploadProviderEnum.MINIO : UploadProviderEnum.DEFAULT
    } catch {
      currentProvider.value = UploadProviderEnum.DEFAULT
    }

    return currentProvider.value
  }

  const getUploadCredential = async (fileName: string, scene?: UploadSceneEnum) => {
    const credential = await uploadService.getOssToken({ scene, fileName })
    if (!credential?.uploadUrl || !credential?.downloadUrl) {
      throw new Error('获取上传凭证失败，请重试')
    }
    return credential
  }

  /**
   * 获取图片宽高
   */
  const getImgWH = async (file: File) => {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        tempUrl: result.previewUrl!
      }
    } catch {
      return { width: 0, height: 0, url: null }
    }
  }

  /**
   * 获取音频时长
   */
  const getAudioDuration = (file: File) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const tempUrl = URL.createObjectURL(file)
      audio.src = tempUrl
      // 计算音频的时长
      const countAudioTime = async () => {
        while (isNaN(audio.duration) || audio.duration === Infinity) {
          // 防止浏览器卡死
          await new Promise((resolve) => setTimeout(resolve, 100))
          // 随机进度条位置
          audio.currentTime = 100000 * Math.random()
        }
        // 取整
        const second = Math.round(audio.duration || 0)
        resolve({ second, tempUrl })
      }
      countAudioTime()
      audio.onerror = () => {
        reject({ second: 0, tempUrl })
      }
    })
  }

  /**
   * 解析文件
   * @param file 文件
   * @param addParams 参数
   * @returns 文件大小、文件类型、文件名、文件后缀...
   */
  const parseFile = async (file: File, addParams: Record<string, any> = {}) => {
    const { name, size, type } = file
    const suffix = name.split('.').pop()?.trim().toLowerCase() || ''
    const baseInfo = { name, size, type, suffix, ...addParams }

    // 根据文件类型获取额外的元数据（图片需要宽高，音频需要时长）
    if (type.includes('image')) {
      const { width, height, tempUrl } = (await getImgWH(file)) as { width: number; height: number; tempUrl: string }
      return { ...baseInfo, width, height, tempUrl }
    }

    if (type.includes('audio')) {
      const { second, tempUrl } = (await getAudioDuration(file)) as { second: number; tempUrl: string }
      return { second, tempUrl, ...baseInfo }
    }
    // 如果是视频
    if (type.includes('video')) {
      return { ...baseInfo }
    }

    return baseInfo
  }

  /**
   * 上传文件
   * @param file 文件
   * @param options 上传选项
   */
  const uploadFile = async (file: File, options?: UploadOptions) => {
    if (isUploading.value || !file) return

    await resolveProvider(options?.provider)

    const info = await parseFile(file, options)

    // 限制文件大小
    if (info.size > MAX_FILE_SIZE) {
      window.$message.error(`文件大小不能超过 ${Max}MB`)
      return
    }

    try {
      const credential = await getUploadCredential(file.name, options?.scene)
      fileInfo.value = { ...info }
      await onStart.trigger(fileInfo)

      const contentType = file.type || 'application/octet-stream'
      isUploading.value = true
      progress.value = 0

      await uploadFileWithTauriPut(credential.uploadUrl, file, contentType)

      isUploading.value = false
      progress.value = 100
      fileInfo.value = { ...fileInfo.value!, downloadUrl: credential.downloadUrl }
      trigger('success')
      return { downloadUrl: credential.downloadUrl }
    } catch (error) {
      isUploading.value = false
      logger.error('文件上传失败:', error)
      await trigger('fail')
    }
  }

  /**
   * 获取上传和下载URL
   * 获取当前后端支持的上传凭证与下载地址
   * @param path 文件路径
   * @param options 上传选项
   */
  const getUploadAndDownloadUrl = async (
    _path: string,
    options?: UploadOptions
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> => {
    const provider = await resolveProvider(options?.provider)
    const credential = await getUploadCredential(extractFileName(_path), options?.scene)
    return {
      uploadUrl: credential.uploadUrl,
      downloadUrl: credential.downloadUrl,
      config: { objectKey: credential.objectKey, provider }
    }
  }

  /**
   * 执行实际的文件上传
   * @param path 文件路径
   * @param uploadUrl 上传URL
   * @param options 上传选项
   */
  const doUpload = async (
    path: string,
    uploadUrl: string,
    options?: {
      progressCallback?: (pct: number) => void
      objectKey?: string
      provider?: string
      downloadUrl?: string
      [key: string]: unknown
    }
  ): Promise<string> => {
    const absolutePath = isAbsolutePath(path)
    logger.debug('执行文件上传:', path)
    try {
      if (!uploadUrl) {
        throw new Error('获取上传链接失败，请重试')
      }

      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.AppCache
      const baseDirName = isMobile() ? 'AppData' : 'AppCache'
      const fileStat = absolutePath ? await stat(path) : await stat(path, { baseDir })

      if (fileStat.size > MAX_FILE_SIZE) {
        throw new Error(`文件大小不能超过${Max}MB`)
      }

      isUploading.value = true
      progress.value = 0

      const onProgress = new Channel<{ progressTotal: number; total: number }>()
      let lastProgress = -1
      onProgress.onmessage = ({ progressTotal, total }) => {
        const pct = total > 0 ? Math.floor((progressTotal / total) * 100) : 0
        if (pct !== lastProgress) {
          lastProgress = pct
          progress.value = pct
          trigger('progress')
          options?.progressCallback?.(pct)
        }
      }

      await invoke(TauriCommand.UPLOAD_FILE_PUT, {
        url: uploadUrl,
        path,
        ...(absolutePath ? {} : { baseDir: baseDirName }),
        headers: { 'Content-Type': 'application/octet-stream' },
        onProgress
      })

      isUploading.value = false
      progress.value = 100
      logger.debug('文件上传成功')
      trigger('success')
      return options?.downloadUrl || ''
    } catch (error) {
      isUploading.value = false
      trigger('fail')
      logger.error('文件上传失败:', error)
      throw new Error('文件上传失败，请重试')
    }
  }

  return {
    fileInfo,
    isUploading,
    progress,
    onStart: onStart.on,
    onChange,
    uploadFile,
    parseFile,
    getUploadAndDownloadUrl,
    doUpload,
    UploadProviderEnum,
    generateHashKey
  }
}
