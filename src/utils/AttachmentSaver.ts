import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import type { useDownload } from '@/hooks/useDownload'
import { matrixMediaService } from '@/services/matrix'
import type { MatrixEncryptedAttachmentLike } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import { createLogger } from '@/utils/Logger'
import { extractFileName } from './Formatting'

const logger = createLogger('AttachmentSaver')

const VIDEO_FILE_EXTENSIONS = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'] as const

type DownloadFileFn = ReturnType<typeof useDownload>['downloadFile']

type SaveAttachmentOptions = {
  url?: string
  downloadFile: DownloadFileFn
  encryptedFile?: MatrixEncryptedAttachmentLike
  defaultFileName?: string
  filters?: Array<{ name: string; extensions: string[] }>
  successMessage?: string
  errorMessage?: string
}

const normalizeSavePath = (path: string) => path.replace(/\\/g, '/')

const saveAttachmentAs = async ({
  url,
  downloadFile,
  encryptedFile,
  defaultFileName,
  filters,
  successMessage,
  errorMessage
}: SaveAttachmentOptions) => {
  if (!url) {
    window.$message.error('未找到下载链接')
    return
  }

  const filename = defaultFileName || extractFileName(url)

  try {
    const savePath = await save({
      defaultPath: filename,
      filters
    })

    if (!savePath) return

    const normalizedPath = normalizeSavePath(savePath)
    if (encryptedFile) {
      const fileData = await matrixMediaService.downloadEncryptedFileBytes(encryptedFile)
      await writeFile(normalizedPath, fileData)
    } else {
      await downloadFile(url, normalizedPath)
    }

    if (successMessage) {
      window.$message.success(successMessage)
    }
  } catch (error) {
    logger.error(errorMessage || '保存文件失败:', error)
    if (errorMessage) {
      window.$message.error(errorMessage)
    }
  }
}

export const saveVideoAttachmentAs = async (options: SaveAttachmentOptions) => {
  await saveAttachmentAs({
    filters: options.filters || [
      {
        name: 'Video',
        extensions: [...VIDEO_FILE_EXTENSIONS]
      }
    ],
    successMessage: options.successMessage || '视频保存成功',
    errorMessage: options.errorMessage || '保存视频失败',
    ...options
  })
}

export const saveFileAttachmentAs = async (options: SaveAttachmentOptions) => {
  await saveAttachmentAs({
    successMessage: options.successMessage || '文件下载成功',
    errorMessage: options.errorMessage || '保存文件失败',
    ...options
  })
}
