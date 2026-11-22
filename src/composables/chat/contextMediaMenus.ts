import { nextTick, type Ref, ref } from 'vue'
import type { useI18n } from 'vue-i18n'
import type { useChatCopy } from '@/composables/chat/useChatCopy'
import type { useChatFileDownload } from '@/composables/chat/useChatFileDownload'
import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { useDownload } from '@/composables/common/useDownload'
import type { RightMouseMessageItem } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isMac } from '@/utils/PlatformConstants'

const logger = createLogger('ChatContextMenus')

/** 媒体菜单列表依赖（视频 / 文件 / 图片） */
type MediaMenuDeps = {
  t: ReturnType<typeof useI18n>['t']
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
  /** 平台事实（`usePlatform.isDesktop()` 取一次）：桌面专属项在构建期就不输出，移动端不渲染 */
  isDesktop: boolean
  downloadFile: ReturnType<typeof useDownload>['downloadFile']
  fileDownload: ReturnType<typeof useChatFileDownload>
  handleCopy: ReturnType<typeof useChatCopy>['handleCopy']
}

/** 视频 / 文件 / 图片类型右键菜单（复用通用菜单项） */
export const createMediaMenus = (deps: MediaMenuDeps, commonMenuList: Ref<OPT.RightMenu[]>) => {
  const { t, showFeedback, isDesktop, downloadFile, fileDownload, handleCopy } = deps
  const { downloadAndRevealFile, downloadAndRevealVideo, previewFile } = fileDownload

  const videoMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: (item: MessageType) => {
        handleCopy(item.message.body.url, true, item.message.id)
      },
      visible: () => isDesktop
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: MessageType) => {
        const bodyRecord = item.message.body as Record<string, unknown>
        const url = item.message.body.url
        const encryptedFile = bodyRecord.encryptedFile as Record<string, unknown> | undefined
        const defaultFileName =
          (typeof bodyRecord.fileName === 'string' && bodyRecord.fileName) ||
          (typeof bodyRecord.filename === 'string' && bodyRecord.filename) ||
          undefined
        await saveVideoAttachmentAs({
          downloadFile,
          ...(url === undefined ? {} : { url }),
          ...(encryptedFile === undefined ? {} : { encryptedFile }),
          ...(defaultFileName === undefined ? {} : { defaultFileName })
        })
      },
      visible: () => isDesktop
    },

    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: MessageType) => {
        const bodyRecord = item.message.body as Record<string, unknown>
        const encryptedFile = bodyRecord.encryptedFile as Record<string, unknown> | undefined
        await downloadAndRevealVideo({
          videoUrl: item.message.body.url || '',
          fileName:
            (typeof bodyRecord.fileName === 'string' && bodyRecord.fileName) ||
            (typeof bodyRecord.filename === 'string' && bodyRecord.filename) ||
            extractFileName(String(item.message.body.url || '')),
          ...(encryptedFile === undefined ? {} : { encryptedFile })
        })
      },
      visible: () => isDesktop
    }
  ])
  /** 文件类型右键菜单 */
  const fileMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.preview'),
      icon: 'preview-open',
      click: (item: RightMouseMessageItem) => {
        nextTick(async () => {
          await previewFile(item)
        })
      },
      visible: () => isDesktop
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: RightMouseMessageItem) => {
        const bodyRecord = item.message.body as Record<string, unknown>
        const encryptedFile = bodyRecord.encryptedFile as Record<string, unknown> | undefined
        await saveFileAttachmentAs({
          downloadFile,
          ...(item.message.body.url === undefined ? {} : { url: item.message.body.url }),
          ...(encryptedFile === undefined ? {} : { encryptedFile }),
          ...(item.message.body.fileName === undefined ? {} : { defaultFileName: item.message.body.fileName })
        })
      },
      visible: () => isDesktop
    },

    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: RightMouseMessageItem) => {
        const fileUrl = item.message.body.url
        const fileName = item.message.body.fileName || extractFileName(fileUrl)
        const bodyRecord = item.message.body as Record<string, unknown>
        await downloadAndRevealFile({
          fileUrl,
          fileName,
          encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
          i18nKeys: {
            downloadPrompt: 'home.chat_main.file.download_prompt',
            success: 'home.chat_main.file.save_success',
            failed: 'home.chat_main.file.download_failed'
          }
        })
      },
      visible: () => isDesktop
    }
  ])
  /** 图片类型右键菜单 */
  const imageMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: async (item: MessageType) => {
        // 对于图片消息，优先使用 url 字段，回退到 content 字段
        const imageUrl = item.message.body.url || item.message.body.content
        await handleCopy(imageUrl, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: MessageType) => {
        try {
          const imageUrl = item.message.body.url
          if (!imageUrl) return
          const bodyRecord = item.message.body as Record<string, unknown>
          const encryptedFile = bodyRecord.encryptedFile as Record<string, unknown> | undefined
          await saveFileAttachmentAs({
            url: imageUrl,
            downloadFile,
            ...(encryptedFile === undefined ? {} : { encryptedFile }),
            defaultFileName: item.message.body.fileName || extractFileName(imageUrl) || 'image.png',
            filters: [
              {
                name: '图片',
                extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
              }
            ],
            successMessage: t('home.chat_main.image.save_success'),
            errorMessage: t('home.chat_main.image.save_failed')
          })
        } catch (error) {
          logger.error('保存图片失败:', error)
          showFeedback(t('home.chat_main.image.save_failed'), 'error')
        }
      },
      visible: () => isDesktop
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: MessageType) => {
        const fileUrl = (item.message.body.url || item.message.body.content) as string | undefined
        if (!fileUrl) {
          showFeedback(t('home.chat_main.image.locate_failed'), 'warning')
          return
        }
        const fileName = item.message.body.fileName || extractFileName(fileUrl)
        const bodyRecord = item.message.body as Record<string, unknown>
        if (!fileName) {
          showFeedback(t('home.chat_main.image.locate_failed'), 'warning')
          return
        }
        await downloadAndRevealFile({
          fileUrl,
          fileName,
          encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
          i18nKeys: {
            downloadPrompt: 'home.chat_main.image.download_prompt',
            success: 'home.chat_main.image.save_success',
            failed: 'home.chat_main.image.download_failed'
          }
        })
      },
      visible: () => isDesktop
    }
  ])

  return { videoMenuList, fileMenuList, imageMenuList }
}
