import { Channel, invoke } from '@tauri-apps/api/core'
import { BaseDirectory, writeFile } from '@tauri-apps/plugin-fs'
import { createEventHook } from '@vueuse/core'
import { TauriCommand } from '@/enums'
import { useConfigStore } from '@/stores/config'
import { useUserStore } from '@/stores/user'
import { getImageDimensions } from '@/utils/ImageUtils'
import { isAndroid, isMobile } from '@/utils/PlatformConstants'
import { getWasmMd5 } from '@/utils/Md5Util'
import { removeTempFile } from '@/utils/TempFileManager'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '@/services/matrix'
const logger = createLogger('Upload')

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

export enum UploadProviderEnum {
  DEFAULT = 'default'
}

export interface UploadOptions {
  provider?: UploadProviderEnum
  scene?: string
  enableDeduplication?: boolean
}

const Max = 500
const MAX_FILE_SIZE = Max * 1024 * 1024

let cryptoJS: any | null = null

const _isAbsolutePath = (path: string): boolean => {
  return /^(\/|[A-Za-z]:[\\/]|\\\\)/.test(path)
}

const loadCryptoJS = async () => {
  if (!cryptoJS) {
    const module = await import('crypto-js')
    cryptoJS = module.default ?? module
  }
  return cryptoJS as {
    lib: { WordArray: { create: (arr: ArrayBuffer | Uint8Array) => any } }
    MD5: (wordArray: any) => { toString: () => string }
  }
}

export const useUpload = () => {
  const _configStore = useConfigStore()
  const userStore = useUserStore()
  const isUploading = ref(false)
  const progress = ref(0)
  const fileInfo = ref<FileInfoType | null>(null)

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
      return Date.now().toString()
    }
  }

  const generateHashKey = async (
    options: { scene: string; enableDeduplication: boolean },
    fileObj: File,
    fileName: string
  ) => {
    let key: string

    if (options.enableDeduplication) {
      const fileHash = await calculateFileHash(fileObj)
      const fileSuffix = fileName.split('.').pop() || ''
      const account = userStore.userInfo!.account
      key = `${options.scene}/${account}/${fileHash}.${fileSuffix}`
      logger.debug('使用文件去重模式，文件哈希:', fileHash)
    } else {
      key = `${options.scene}/${Date.now()}_${fileName}`
    }
    return key
  }

  const getImgWH = async (file: File) => {
    try {
      const result = await getImageDimensions(file, { includePreviewUrl: true })
      return {
        width: result.width,
        height: result.height,
        tempUrl: result.previewUrl!
      }
    } catch (_error) {
      return { width: 0, height: 0, url: null }
    }
  }

  const getAudioDuration = (file: File) => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const tempUrl = URL.createObjectURL(file)
      audio.src = tempUrl
      const countAudioTime = async () => {
        while (isNaN(audio.duration) || audio.duration === Infinity) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          audio.currentTime = 100000 * Math.random()
        }
        const second = Math.round(audio.duration || 0)
        resolve({ second, tempUrl })
      }
      countAudioTime()
      audio.onerror = () => {
        reject({ second: 0, tempUrl })
      }
    })
  }

  const parseFile = async (file: File, addParams: Record<string, any> = {}) => {
    const { name, size, type } = file
    const suffix = name.split('.').pop()?.trim().toLowerCase() || ''
    const baseInfo = { name, size, type, suffix, ...addParams }

    if (type.includes('image')) {
      const result = (await getImgWH(file)) as { width: number; height: number; tempUrl: string }
      return { ...baseInfo, width: result.width, height: result.height, tempUrl: result.tempUrl }
    }

    if (type.includes('audio')) {
      const result = (await getAudioDuration(file)) as { second: number; tempUrl: string }
      return { second: result.second, tempUrl: result.tempUrl, ...baseInfo }
    }
    if (type.includes('video')) {
      return { ...baseInfo }
    }

    return baseInfo
  }

  const uploadFile = async (file: File, options?: UploadOptions): Promise<{ downloadUrl: string } | undefined> => {
    if (isUploading.value || !file) return undefined

    const info = await parseFile(file, options)

    if (info.size > MAX_FILE_SIZE) {
      window.$message.error(`文件大小不能超过 ${Max}MB`)
      return undefined
    }

    try {
      fileInfo.value = { ...info }
      await onStart.trigger(fileInfo)

      isUploading.value = true
      progress.value = 0

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const result = await client.uploadContent(file, { type: file.type || 'application/octet-stream' })
      const contentUri = typeof result === 'string' ? result : result.content_uri

      isUploading.value = false
      progress.value = 100

      const downloadUrl = client.mxcUrlToHttp(contentUri) || contentUri
      fileInfo.value = { ...fileInfo.value!, downloadUrl }
      trigger('success')
      return { downloadUrl }
    } catch (error) {
      isUploading.value = false
      logger.error('文件上传失败:', error)
      await trigger('fail')
      return undefined
    }
  }

  const getUploadAndDownloadUrl = async (
    _path: string,
    _options?: UploadOptions
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: any }> => {
    return { uploadUrl: '', downloadUrl: '' }
  }

  const doUpload = async (_path: string, _uploadUrl: string, _options?: any): Promise<{ mxcUrl: string } | string> => {
    return ''
  }

  const cancelUpload = () => {
    isUploading.value = false
    progress.value = 0
  }

  const clearFileInfo = () => {
    fileInfo.value = null
  }

  return {
    isUploading,
    progress,
    fileInfo,
    onChange,
    onStart,
    uploadFile,
    uploadFileWithTauriPut,
    getUploadAndDownloadUrl,
    doUpload,
    cancelUpload,
    clearFileInfo,
    parseFile,
    calculateFileHash,
    generateHashKey
  }
}
