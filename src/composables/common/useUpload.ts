import { Channel } from '@tauri-apps/api/core'
import { stat } from '@tauri-apps/plugin-fs'
import { createEventHook } from '@vueuse/core'
import { probeAudioDuration, probeImageDimensions } from '@/composables/common/mediaFileProbe'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useTempObjectUrls } from '@/composables/common/useTempObjectUrls'
import { TauriCommand, type UploadSceneEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import {
  isAbsoluteFsPath,
  uploadFileViaMatrix,
  uploadPathViaMatrix,
  uploadPresignedPut
} from '@/services/media/uploadTransports'
import { uploadService } from '@/services/performance/UploadService'
import { renderWorker } from '@/services/renderWorker'
import { useUserStore } from '@/stores/domains/user/user'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { getCacheBaseDir, getCacheBaseDirName } from '@/utils/PathUtil'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

const logger = createLogger('Upload')

/** 文件信息类型 */
type FileInfoType = {
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

/** 路径判定与原生上传通道共用同一口径（见 services/media/matrixNativeUpload.ts） */
const isAbsolutePath = isAbsoluteFsPath

/**
 * 文件上传Hook
 */
export const useUpload = () => {
  const userStore = useUserStore()
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const isUploading = ref(false) // 是否正在上传
  const progress = ref(0) // 进度
  const fileInfo = ref<FileInfoType | null>(null) // 文件信息
  const currentProvider = ref<UploadProviderEnum>(UploadProviderEnum.DEFAULT) // 当前上传方式

  const { on: onChange, trigger } = createEventHook()
  const onStart = createEventHook()

  // 图片/音频预览临时 URL：替换与 scope 销毁时统一释放
  const tempUrls = useTempObjectUrls()

  /** Matrix 原生上传（见 `services/media/uploadTransports.ts`）：后端只给 POST 端点，没有预签名地址。 */
  const uploadViaMatrixNative = (file: File, downloadUrlPrefix?: string): Promise<string> =>
    uploadFileViaMatrix(
      file,
      (pct) => {
        progress.value = pct
        trigger('progress')
      },
      downloadUrlPrefix ? { downloadUrlPrefix } : {}
    )

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

      const result = await renderWorker.executeWithTransfer<{ buffer: ArrayBuffer }, { hash: string }>(
        'calculate-hash',
        { buffer: arrayBuffer },
        [arrayBuffer]
      )

      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      logger.debug(`MD5计算完成，耗时: ${duration}ms，哈希值: ${result.hash}`)
      return result.hash
    } catch (error) {
      const endTime = performance.now()
      const duration = (endTime - startTime).toFixed(2)
      logger.error(`计算文件哈希值失败，耗时: ${duration}ms:`, error)
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
      const account = userStore.userInfo?.account ?? userStore.userInfo?.uid ?? 'anonymous'
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
      const providerConfig = await uploadService.getUploadProvider()
      currentProvider.value =
        providerConfig?.provider === 'minio' ? UploadProviderEnum.MINIO : UploadProviderEnum.DEFAULT
    } catch {
      currentProvider.value = UploadProviderEnum.DEFAULT
    }

    return currentProvider.value
  }

  const getUploadCredential = async (fileName: string, scene?: UploadSceneEnum) => {
    const credential = await uploadService.getOssToken({
      filename: fileName,
      ...(scene === undefined ? {} : { scene })
    })
    if (!credential) {
      // 端点不可用 / 未登录：由调用方降级到 Matrix 原生上传，不再直接报错
      return null
    }
    // 只有 OSS 通道才要求预签名地址；matrix 通道的 uploadUrl 恒为空串
    if (credential.provider === 'oss' && !credential.uploadUrl) {
      throw new Error(t('hooks.upload.credential_failed'))
    }
    return credential
  }

  /**
   * 获取图片宽高
   */
  const getImgWH = (file: File) => probeImageDimensions(file, tempUrls)

  /**
   * 获取音频时长
   */
  const getAudioDuration = (file: File) => probeAudioDuration(file, tempUrls)

  /**
   * 解析文件
   * @param file 文件
   * @param addParams 参数
   * @returns 文件大小、文件类型、文件名、文件后缀...
   */
  const parseFile = async (file: File, addParams: Partial<UploadOptions> | Record<string, unknown> = {}) => {
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
      showFeedback(t('hooks.upload.file_size_exceeded', { max: Max }), 'error')
      return
    }

    try {
      const credential = await getUploadCredential(file.name, options?.scene)
      // matrix 通道（含端点不可用）：直接走 Matrix 原生上传，不再要求预签名地址
      if (!credential || credential.provider === 'matrix') {
        fileInfo.value = { ...info }
        await onStart.trigger(fileInfo)
        isUploading.value = true
        progress.value = 0
        const downloadUrl = await uploadViaMatrixNative(file, credential?.downloadUrlPrefix)
        isUploading.value = false
        progress.value = 100
        fileInfo.value = { ...fileInfo.value!, downloadUrl }
        trigger('success')
        return { downloadUrl }
      }

      fileInfo.value = { ...info }
      await onStart.trigger(fileInfo)

      const contentType = file.type || 'application/octet-stream'
      isUploading.value = true
      progress.value = 0

      await uploadPresignedPut(credential.uploadUrl, file, contentType, (pct) => {
        progress.value = pct
        trigger('progress')
      })

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
   *
   * `provider === 'matrix'`（或端点不可用）时返回 `uploadUrl: ''` 的占位对象：
   * 策略层会把空 `uploadUrl` 透传给 `doUpload`，由它改走 Matrix 原生上传。
   * 这里**不再返回 null**——那会让所有策略抛「上传服务不可用」，即使原生通道可用。
   *
   * @param path 文件路径
   * @param options 上传选项
   */
  const getUploadAndDownloadUrl = async (
    _path: string,
    options?: UploadOptions
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> => {
    const provider = await resolveProvider(options?.provider)
    const credential = await getUploadCredential(extractFileName(_path), options?.scene)
    if (!credential || credential.provider === 'matrix') {
      return {
        uploadUrl: '',
        downloadUrl: '',
        config: { provider, transport: 'matrix-native' }
      }
    }
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
      const baseDir = getCacheBaseDir()
      const fileStat = absolutePath ? await stat(path) : await stat(path, { baseDir })

      if (fileStat.size > MAX_FILE_SIZE) {
        throw new Error(`文件大小不能超过${Max}MB`)
      }

      isUploading.value = true
      progress.value = 0

      // 无预签名地址 ⇒ Matrix 原生上传（旧实现直接抛错，附件全发不出去）
      if (!uploadUrl) {
        const downloadUrl = await uploadPathViaMatrix(path)
        isUploading.value = false
        progress.value = 100
        logger.debug('文件经 Matrix 原生通道上传成功')
        trigger('success')
        return downloadUrl
      }

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

      await invokeWithErrorHandler(TauriCommand.UPLOAD_FILE_PUT, {
        url: uploadUrl,
        path,
        ...(absolutePath ? {} : { baseDir: getCacheBaseDirName() }),
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
      throw new Error(t('hooks.upload.upload_failed'))
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
