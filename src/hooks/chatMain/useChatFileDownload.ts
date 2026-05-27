import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import type { FileTypeResult } from 'file-type'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import type { MatrixEncryptedAttachmentLike } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import type { FilesMeta, RightMouseMessageItem } from '@/services/types.ts'
import { useUserStore } from '@/stores/domains/user/user'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { detectRemoteFileType, getFilesMeta } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('ChatFileDownload')

export interface UseChatFileDownloadOptions {
  t: (key: string) => string
  downloadFile: (url: string, savePath: string, baseDir?: BaseDirectory) => Promise<unknown>
  getLocalVideoPath: (url: string) => Promise<string>
  checkVideoDownloaded: (url: string) => Promise<boolean>
  createWebviewWindow: (
    title: string,
    label: string,
    width: number,
    height: number,
    wantCloseWindow?: string,
    resizable?: boolean,
    minW?: number,
    minH?: number,
    transparent?: boolean,
    visible?: boolean,
    queryParams?: Record<string, string | number | boolean>
  ) => Promise<unknown>
  sendWindowPayload: (windowLabel: string, payload: Record<string, unknown>) => Promise<void>
}

export const useChatFileDownload = (options: UseChatFileDownloadOptions) => {
  const { t, downloadFile, getLocalVideoPath, checkVideoDownloaded, createWebviewWindow, sendWindowPayload } = options
  const { showFeedback, showProgressFeedback } = useActionFeedback()

  const fileDownloadStore = useFileDownloadStore()
  const globalStore = useGlobalStore()
  const userStore = useUserStore()

  const revealInDirSafely = async (targetPath?: string | null) => {
    if (!targetPath) {
      showFeedback(t('home.chat_main.file.missing_local'), 'error')
      return
    }
    try {
      await revealItemInDir(targetPath)
    } catch (error) {
      logger.error('在文件夹中显示文件失败:', error)
      showFeedback(t('home.chat_main.file.show_failed'), 'error')
    }
  }

  const downloadFileToLocal = async (
    fileUrl: string,
    fileName: string,
    encryptedFile?: MatrixEncryptedAttachmentLike
  ) => {
    if (encryptedFile) {
      return fileDownloadStore.downloadEncryptedFile(fileUrl, fileName, encryptedFile)
    }

    return fileDownloadStore.downloadFile(fileUrl, fileName)
  }

  const downloadAndRevealFile = async (params: {
    fileUrl: string
    fileName: string
    encryptedFile?: MatrixEncryptedAttachmentLike
    i18nKeys: {
      downloadPrompt: string
      success: string
      failed: string
    }
  }) => {
    const { fileUrl, fileName, encryptedFile, i18nKeys } = params
    const fileStatus = fileDownloadStore.getFileStatus(fileUrl)
    const currentChatRoomId = globalStore.currentSessionRoomId
    const currentUserUid = (userStore.userInfo?.uid ?? '') as string

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    let absolutePath = await join(resourceDirPath, fileName)

    const [fileMeta] = await getFilesMeta<FilesMeta>([fileStatus?.absolutePath || absolutePath || fileUrl])

    if (!fileMeta.exists) {
      const downloadMessage = showProgressFeedback(t(i18nKeys.downloadPrompt), 'info')
      const _absolutePath = await downloadFileToLocal(fileUrl, fileName, encryptedFile)

      if (_absolutePath) {
        absolutePath = _absolutePath
        downloadMessage.destroy()
        showFeedback(t(i18nKeys.success), 'success')
        await revealInDirSafely(_absolutePath)
        await fileDownloadStore.refreshFileDownloadStatus({
          fileUrl,
          roomId: currentChatRoomId,
          userId: currentUserUid,
          fileName,
          exists: true
        })
        return
      } else {
        absolutePath = ''
        showFeedback(t(i18nKeys.failed), 'error')
        return
      }
    }

    await revealInDirSafely(absolutePath)
  }

  const downloadAndRevealVideo = async (params: {
    videoUrl: string
    fileName?: string
    encryptedFile?: MatrixEncryptedAttachmentLike
  }) => {
    try {
      const { videoUrl, fileName, encryptedFile } = params

      if (encryptedFile) {
        const targetFileName = fileName || 'video.mp4'
        const absolutePath = await fileDownloadStore.downloadEncryptedFile(videoUrl, targetFileName, encryptedFile)
        await revealInDirSafely(absolutePath)
        return
      }

      const localPath = await getLocalVideoPath(videoUrl)
      const isDownloaded = await checkVideoDownloaded(videoUrl)

      if (!isDownloaded) {
        const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
        await downloadFile(videoUrl, localPath, baseDir)
        useMitt.emit(MittEnum.VIDEO_DOWNLOAD_STATUS_UPDATED, { url: videoUrl, downloaded: true })
      }

      const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
      const absolutePath = await join(baseDirPath, localPath)
      await revealInDirSafely(absolutePath)
    } catch (error) {
      logger.error('Failed to show video in folder:', error)
    }
  }

  const previewFile = async (item: RightMouseMessageItem) => {
    const path = 'previewFile'
    const LABEL = 'previewFile'
    const bodyRecord = item.message.body as Record<string, unknown>

    const getCurrentFileStatus = () => fileDownloadStore.getFileStatus(item.message.body.url)
    const currentChatRoomId = globalStore.currentSessionRoomId
    const currentUserUid = (userStore.userInfo?.uid ?? '') as string
    const encryptedFile =
      bodyRecord.encryptedFile && typeof bodyRecord.encryptedFile === 'object'
        ? (bodyRecord.encryptedFile as MatrixEncryptedAttachmentLike)
        : undefined

    const buildPayload = (item: RightMouseMessageItem, type: FileTypeResult | undefined, localExists: boolean) => {
      const fileStatus = getCurrentFileStatus()
      const payload = {
        userId: currentUserUid,
        roomId: currentChatRoomId,
        messageId: item.message.id,
        resourceFile: {
          fileName: item.message.body.fileName,
          absolutePath: fileStatus?.absolutePath,
          nativePath: fileStatus?.nativePath,
          url: item.message.body.url,
          type,
          localExists
        }
      }
      return payload
    }

    const fallbackToRemotePayload = async () => {
      const remoteType = await detectRemoteFileType({
        url: item.message.body.url,
        fileSize: Number(item.message.body.size)
      })
      const fallbackPayload = buildPayload(item, remoteType, false)
      await sendWindowPayload(LABEL, fallbackPayload)
    }

    const resourceDirPath = await userStore.getUserRoomAbsoluteDir()
    const absolutePath = await join(resourceDirPath, item.message.body.fileName)

    const result = await getFilesMeta<FilesMeta>([
      getCurrentFileStatus()?.absolutePath || absolutePath || item.message.body.url
    ])
    const fileMeta = result[0]

    try {
      if (!fileMeta.exists) {
        if (encryptedFile) {
          const downloadedPath = await downloadFileToLocal(
            item.message.body.url,
            item.message.body.fileName,
            encryptedFile
          )
          if (downloadedPath) {
            const [downloadedMeta] = await getFilesMeta<FilesMeta>([downloadedPath])
            const payload = buildPayload(
              item,
              {
                ext: downloadedMeta.file_type,
                mime: downloadedMeta.mime_type
              },
              downloadedMeta.exists
            )
            await sendWindowPayload(LABEL, payload)
          } else {
            await fallbackToRemotePayload()
          }
        } else {
          await fallbackToRemotePayload()
        }
      } else {
        const payload = buildPayload(
          item,
          {
            ext: fileMeta.file_type,
            mime: fileMeta.mime_type
          },
          fileMeta.exists
        )
        await sendWindowPayload(LABEL, payload)
      }
    } catch (error) {
      await fallbackToRemotePayload()
      logger.error('检查文件出错:', error)
    }

    await fileDownloadStore.refreshFileDownloadStatus({
      fileUrl: item.message.body.url,
      roomId: currentChatRoomId,
      userId: currentUserUid,
      fileName: item.message.body.fileName,
      exists: fileMeta.exists
    })

    await createWebviewWindow(t('common.window_titles.preview_file'), path, 860, 720, '', true)
  }

  return {
    revealInDirSafely,
    downloadAndRevealFile,
    downloadAndRevealVideo,
    previewFile
  }
}
