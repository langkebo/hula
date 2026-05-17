import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { useDownload } from '@/hooks/useDownload'
import { useI18nGlobal } from '@/services/i18n'
import type { MatrixEncryptedAttachmentLike } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
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
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  if (!url) {
    showFeedback(t('utils.download_link_not_found'), 'error')
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
      showFeedback(successMessage, 'success')
    }
  } catch (error) {
    logger.error(errorMessage || '保存文件失败:', error)
    if (errorMessage) {
      showFeedback(errorMessage, 'error')
    }
  }
}

export const saveVideoAttachmentAs = async (options: SaveAttachmentOptions) => {
  const { t } = useI18nGlobal()
  await saveAttachmentAs({
    filters: options.filters || [
      {
        name: 'Video',
        extensions: [...VIDEO_FILE_EXTENSIONS]
      }
    ],
    successMessage: options.successMessage || t('utils.video_save_success'),
    errorMessage: options.errorMessage || t('utils.video_save_failed'),
    ...options
  })
}

export const saveFileAttachmentAs = async (options: SaveAttachmentOptions) => {
  const { t } = useI18nGlobal()
  await saveAttachmentAs({
    successMessage: options.successMessage || t('utils.file_download_success'),
    errorMessage: options.errorMessage || t('utils.file_save_failed'),
    ...options
  })
}
