import { computed, ref } from 'vue'
import type { useI18n } from 'vue-i18n'
import { getSelectedText } from '@/composables/chat/selectionUtils'
import type { useChatCopy } from '@/composables/chat/useChatCopy'
import type { useChatFileDownload } from '@/composables/chat/useChatFileDownload'
import type { useGroupRoleGuard } from '@/composables/chat/useGroupRoleGuard'
import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useClipboard } from '@/composables/common/useClipboard'
import type { useDownload } from '@/composables/common/useDownload'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, MsgEnum } from '@/enums'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import type { RightMouseMessageItem } from '@/services/types.ts'
import type { MessageType, useChatStore } from '@/stores/domains/chat/chat'
import type { useEmojiStore } from '@/stores/domains/chat/emoji'
import type { useSettingStore } from '@/stores/domains/settings/setting'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isMac } from '@/utils/PlatformConstants'
import type { ContextMenuHelpers } from './contextMenuHelpers'
import { deleteLocalMessage, isLocalOrFailedMessage } from './contextMessageLocalActions'

const logger = createLogger('ChatContextMenus')

/** 消息菜单列表依赖（通用 / 消息 / 历史模式） */
export type MessageMenuDeps = {
  t: ReturnType<typeof useI18n>['t']
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
  /** 平台事实（`usePlatform.isDesktop()` 取一次）：桌面专属项在构建期就不输出，移动端不渲染 */
  isDesktop: boolean
  /** 历史记录模式：specialMenuList 输出复制/转发/另存为，正常模式只输出删除 */
  isHistoryMode: boolean
  /** 历史模式下禁用选择/转发动作（多窗口场景） */
  disableHistoryActions: boolean
  downloadFile: ReturnType<typeof useDownload>['downloadFile']
  fileDownload: ReturnType<typeof useChatFileDownload>
  handleCopy: ReturnType<typeof useChatCopy>['handleCopy']
  /** 打开删除确认弹窗（由 useMsgDeleteConfirm 提供，正常模式 specialMenuList 的唯一动作） */
  openDeleteConfirm: (item: MessageType) => void
  helpers: ContextMenuHelpers
  chatStore: ReturnType<typeof useChatStore>
  emojiStore: ReturnType<typeof useEmojiStore>
  userStore: ReturnType<typeof useUserStore>
  globalStore: ReturnType<typeof useGlobalStore>
  settingStore: ReturnType<typeof useSettingStore>
  groupRoleGuard: ReturnType<typeof useGroupRoleGuard>
}

/** 通用菜单 + 消息菜单 + 历史模式菜单 */
export const createMessageMenus = (deps: MessageMenuDeps) => {
  const {
    t,
    showFeedback,
    isDesktop,
    isHistoryMode,
    disableHistoryActions,
    downloadFile,
    fileDownload,
    handleCopy,
    openDeleteConfirm,
    helpers,
    chatStore,
    emojiStore,
    userStore,
    globalStore,
    settingStore,
    groupRoleGuard
  } = deps
  const { downloadAndRevealFile } = fileDownload
  const { handleForward, shouldHideCopy, isNoticeMessage } = helpers
  const { canRecallMessage, isRecallExpired } = groupRoleGuard

  const commonMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.select'),
      icon: 'list-checkbox',
      click: () => {
        chatStore.setMsgMultiChoose(true)
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    {
      label: () => t('menu.add_sticker'),
      icon: 'add-expression',
      click: async (item: MessageType) => {
        const imageUrl = item.message.body.url || item.message.body.content
        if (!imageUrl) {
          showFeedback(t('home.chat_main.image.fetch_failed'), 'error')
          return
        }
        await emojiStore.addEmoji(imageUrl)
      },
      visible: (item: MessageType) => {
        return item.message.type === MsgEnum.IMAGE || item.message.type === MsgEnum.EMOJI
      }
    },
    {
      label: () => t('menu.forward'),
      icon: 'share',
      click: (item: MessageType) => {
        handleForward(item)
      },
      visible: (item: MessageType) => isDesktop && !isNoticeMessage(item)
    },
    {
      label: () => t('menu.reply'),
      icon: 'reply',
      click: (item: MessageType) => {
        useMitt.emit(MittEnum.REPLY_MEG, item)
      }
    },
    {
      label: (item: MessageType) => (isRecallExpired(item) ? t('menu.recall_expired') : t('menu.recall')),
      icon: 'corner-down-left',
      click: async (item: MessageType) => {
        const msg = { ...item }
        const originalType = item.message.type
        const originalContent = item.message.body.content
        try {
          await matrixMessageService.recallMessage(globalStore.currentSessionRoomId, item.message.id)
        } catch (res: unknown) {
          showFeedback(String(res), 'error')
          return
        }
        chatStore.recordRecallMsg({
          recallUid: userStore.userInfo?.uid ?? '',
          msg,
          originalType,
          ...(originalContent === undefined ? {} : { originalContent })
        })
        await chatStore.updateRecallMsg({
          recallUid: userStore.userInfo?.uid ?? '',
          roomId: msg.message.roomId,
          msgId: msg.message.id
        })
      },
      visible: (item: MessageType) => canRecallMessage(item),
      disabled: (item: MessageType) => isRecallExpired(item)
    }
  ])
  /** 右键消息菜单列表 */
  const menuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: (item: MessageType) => {
        handleCopy(item.message.body.content, true, item.message.id)
      },
      visible: (item: MessageType) => !shouldHideCopy(item)
    },
    {
      label: () => t('menu.copy_media_link'),
      icon: 'link',
      click: async (item: MessageType) => {
        const roomId = item.message.roomId || globalStore.currentSessionRoomId
        if (!roomId) {
          showFeedback(t('menu.copy_media_link_failed'), 'error')
          return
        }
        const outcome = await matrixRoomReadFacade.getRoomEventMediaUrls(roomId, item.message.id)
        if (outcome.status === 'empty') {
          showFeedback(t('menu.copy_media_link_empty'), 'warning')
          return
        }
        if (outcome.status === 'unsupported') {
          showFeedback(t('menu.copy_media_link_unsupported'), 'warning')
          return
        }
        if (outcome.status === 'error') {
          showFeedback(t('menu.copy_media_link_failed'), 'error')
          return
        }
        const first = outcome.urls[0]
        try {
          await useClipboard().write(first.httpUrl || first.url)
          showFeedback(t('menu.copy_media_link_success'), 'success')
        } catch (err) {
          logger.error(`[ChatContextMenus] 复制媒体链接失败: ${err}`)
          showFeedback(t('menu.copy_media_link_failed'), 'error')
        }
      },
      visible: (item: MessageType) =>
        !isLocalOrFailedMessage(item) &&
        [MsgEnum.IMAGE, MsgEnum.VIDEO, MsgEnum.FILE, MsgEnum.EMOJI].includes(item.message.type)
    },
    {
      label: () => t('menu.translate'),
      icon: 'translate',
      click: async (item: MessageType) => {
        const selectedText = getSelectedText(item.message.id)
        if (!selectedText && item.message.body.translatedText) {
          delete item.message.body.translatedText
          return
        }

        const content = selectedText || item.message.body.content
        if (!content) {
          showFeedback(t('home.chat_main.translate.empty'), 'warning')
          return
        }

        item.message.body.translatedText = { provider: settingStore.chatTranslateProvider || 'client', text: '' }
        try {
          const translatedText = await matrixRoomReadFacade.translateText(content)
          item.message.body.translatedText = {
            provider: settingStore.chatTranslateProvider || 'client',
            text: translatedText || content
          }
        } catch (error) {
          logger.error('翻译失败:', error)
          item.message.body.translatedText = { provider: 'error', text: t('home.chat_main.translate.failed') }
        }
      },
      visible: (item: MessageType) => item.message.type === MsgEnum.TEXT
    },

    ...commonMenuList.value
  ])
  const specialMenuList = computed(() => {
    return (messageType?: MsgEnum): OPT.RightMenu[] => {
      if (isHistoryMode) {
        // 历史记录模式：基础菜单（复制、转发）
        const baseMenus: OPT.RightMenu[] = [
          {
            label: () => t('menu.copy'),
            icon: 'copy',
            click: (item: MessageType) => {
              const content = item.message.body.url || item.message.body.content
              handleCopy(content, true, item.message.id)
            }
          }
        ]

        if (!disableHistoryActions) {
          baseMenus.push(
            {
              label: () => t('menu.select'),
              icon: 'list-checkbox',
              click: () => {
                chatStore.setMsgMultiChoose(true)
              }
            },
            {
              label: () => t('menu.forward'),
              icon: 'share',
              click: (item: MessageType) => {
                handleForward(item)
              }
            }
          )
        }

        // 媒体文件额外菜单（收藏、另存为、在文件中打开）
        if (
          messageType === MsgEnum.IMAGE ||
          messageType === MsgEnum.EMOJI ||
          messageType === MsgEnum.VIDEO ||
          messageType === MsgEnum.FILE
        ) {
          const mediaMenus: OPT.RightMenu[] = [
            {
              label: () => t('menu.save_as'),
              icon: 'Importing',
              click: async (item: MessageType) => {
                const fileUrl = item.message.body.url
                const fileName = item.message.body.fileName
                const bodyRecord = item.message.body as Record<string, unknown>
                const encryptedFile = bodyRecord.encryptedFile as Record<string, unknown> | undefined
                if (item.message.type === MsgEnum.VIDEO) {
                  await saveVideoAttachmentAs({
                    downloadFile,
                    ...(fileUrl === undefined ? {} : { url: fileUrl }),
                    ...(encryptedFile === undefined ? {} : { encryptedFile }),
                    ...(fileName === undefined ? {} : { defaultFileName: fileName })
                  })
                } else {
                  await saveFileAttachmentAs({
                    downloadFile,
                    ...(fileUrl === undefined ? {} : { url: fileUrl }),
                    ...(encryptedFile === undefined ? {} : { encryptedFile }),
                    ...(fileName === undefined ? {} : { defaultFileName: fileName })
                  })
                }
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
                    success: 'home.chat_main.file.download_success',
                    failed: 'home.chat_main.file.download_failed'
                  }
                })
              },
              visible: () => isDesktop
            }
          ]
          return [...baseMenus, ...mediaMenus]
        }

        return baseMenus
      } else {
        // 正常聊天模式：删除 + 消息视角（G-08，只读统计浮层）
        return [
          {
            label: () => t('menu.del'),
            icon: 'delete',
            /** 移动端长按菜单也展示删除（仅声明该标记的项会渲染） */
            mobile: true,
            /** 已发送的消息移动端保持无删除入口，避免本地删除后同步又“复活” */
            mobileVisible: (item: MessageType) => isLocalOrFailedMessage(item),
            click: (item: MessageType) => {
              if (isLocalOrFailedMessage(item)) {
                deleteLocalMessage(item, (msgId) => chatStore.deleteMsg(msgId))
                showFeedback(t('message.delete_success'), 'success')
                return
              }
              openDeleteConfirm(item)
            }
          },
          {
            label: () => t('menu.event_perspective'),
            icon: 'info',
            click: (item: MessageType) => {
              const roomId = item.message.roomId || globalStore.currentSessionRoomId
              if (!roomId) return
              useMitt.emit(MittEnum.OPEN_EVENT_PERSPECTIVE, { roomId, eventId: item.message.id })
            }
          },
          {
            label: () => t('menu.read_receipts'),
            icon: 'check',
            click: (item: MessageType) => {
              const roomId = item.message.roomId || globalStore.currentSessionRoomId
              if (!roomId) return
              useMitt.emit(MittEnum.OPEN_EVENT_RECEIPTS, { roomId, eventId: item.message.id })
            },
            // 仅自己发出的消息能看「谁读过」
            visible: (item: MessageType) =>
              Boolean(userStore.userInfo?.uid) && item.fromUser?.uid === userStore.userInfo?.uid
          }
        ]
      }
    }
  })

  return { commonMenuList, menuList, specialMenuList }
}
