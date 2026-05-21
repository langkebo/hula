import { type ComputedRef, computed, nextTick, type Ref, ref } from 'vue'
import type { useChatMessageActions } from '@/composables/chat/useChatMessageActions'
import type { ActionFeedbackType } from '@/composables/common/useActionFeedback'
import { MergeMessageType, MittEnum, MsgEnum, PowerEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import type { useDownload } from '@/hooks/useDownload'
import { useMitt } from '@/hooks/useMitt.ts'
import { roomStateService } from '@/services/matrix/room/RoomStateService'
import type { RightMouseMessageItem } from '@/services/types.ts'
import type { MessageType, useChatStore } from '@/stores/domains/chat/chat'
import type { useEmojiStore } from '@/stores/domains/chat/emoji'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { useMessageSelectionStore } from '@/stores/domains/chat/messageSelection'
import type { useSettingStore } from '@/stores/domains/settings/setting'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { isDiffNow } from '@/utils/ComputedTime.ts'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { getSelectedText } from './selectionUtils'

type DownloadFileFn = ReturnType<typeof useDownload>['downloadFile']

const logger = createLogger('ChatContextMenu')

export interface UseChatContextMenuDeps {
  t: (key: string) => string
  showFeedback: (message: string, type: ActionFeedbackType) => void
  recallMessage: ReturnType<typeof useChatMessageActions>['recallMessage']
  handleCopy: (content: string | undefined, prioritizeSelection?: boolean, messageId?: string) => Promise<void>
  downloadFile: DownloadFileFn
  downloadAndRevealFile: (params: {
    fileUrl: string
    fileName: string
    encryptedFile?: Record<string, unknown>
    i18nKeys: { downloadPrompt: string; success: string; failed: string }
  }) => Promise<void>
  downloadAndRevealVideo: (params: {
    videoUrl: string
    fileName?: string
    encryptedFile?: Record<string, unknown>
  }) => Promise<void>
  previewFile: (item: RightMouseMessageItem) => Promise<void>
  selectionStore: ReturnType<typeof useMessageSelectionStore>
  settingStore: ReturnType<typeof useSettingStore>
  chatStore: ReturnType<typeof useChatStore>
  globalStore: ReturnType<typeof useGlobalStore>
  groupStore: ReturnType<typeof useGroupStore>
  emojiStore: ReturnType<typeof useEmojiStore>
  userStore: ReturnType<typeof useUserStore>
  userUid: ComputedRef<string>
  isHistoryMode: boolean
  disableHistoryActions: boolean
  tips: Ref<string>
  modalShow: Ref<boolean>
  delIndex: Ref<string>
  delRoomId: Ref<string>
}

export const useChatContextMenu = (deps: UseChatContextMenuDeps) => {
  const {
    t,
    showFeedback,
    recallMessage,
    handleCopy,
    downloadFile,
    downloadAndRevealFile,
    downloadAndRevealVideo,
    previewFile,
    selectionStore,
    settingStore,
    chatStore,
    globalStore,
    groupStore,
    emojiStore,
    userStore,
    userUid,
    isHistoryMode,
    disableHistoryActions,
    tips,
    modalShow,
    delIndex,
    delRoomId
  } = deps

  const showComingSoon = () => showFeedback(t('home.chat_main.feature.coming_soon'), 'warning')

  const copyDisabledTypes: MsgEnum[] = [MsgEnum.NOTICE, MsgEnum.MERGE, MsgEnum.LOCATION, MsgEnum.BEACON, MsgEnum.VOICE]
  const shouldHideCopy = (item: MessageType) => copyDisabledTypes.includes(item.message.type)
  const isNoticeMessage = (item: MessageType) => item.message.type === MsgEnum.NOTICE

  const handleForward = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.getMessage(item.message.id)
    if (!target) {
      return
    }
    selectionStore.clearMsgCheck(chatStore.chatMessageList)
    target.isCheck = true
    selectionStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: MergeMessageType.SINGLE
    })
  }

  const commonMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.select'),
      icon: 'list-checkbox',
      click: () => {
        selectionStore.setMsgMultiChoose(true)
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
        if (isMobile()) {
          showComingSoon()
          return
        }
        handleForward(item)
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    {
      label: () => t('menu.reply'),
      icon: 'reply',
      click: (item: MessageType) => {
        useMitt.emit(MittEnum.REPLY_MEG, item)
      }
    },
    {
      label: () => t('menu.recall'),
      icon: 'corner-down-left',
      click: async (item: MessageType) => {
        const msg = { ...item }
        const originalType = item.message.type
        const originalContent = item.message.body.content
        try {
          await recallMessage(globalStore.currentSessionRoomId, item.message.id)
        } catch (res: unknown) {
          showFeedback(String(res), 'error')
          return
        }
        chatStore.recordRecallMsg({
          recallUid: userStore.userInfo!.uid,
          msg,
          originalType,
          originalContent
        })
        await chatStore.updateRecallMsg({
          recallUid: userStore.userInfo!.uid,
          roomId: msg.message.roomId,
          msgId: msg.message.id
        })
      },
      visible: (item: MessageType) => {
        const isSystemAdmin = userStore.userInfo?.power === PowerEnum.ADMIN
        if (isSystemAdmin) {
          return true
        }

        const isGroupSession = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        const groupMembers = groupStore.userList
        const currentMember = isGroupSession ? groupMembers.find((member) => member.uid === userUid.value) : undefined
        const isGroupManager =
          isGroupSession &&
          (currentMember?.roleId === RoleEnum.LORD ||
            currentMember?.roleId === RoleEnum.ADMIN ||
            groupStore.currentLordId === userUid.value ||
            groupStore.adminUidList.includes(userUid.value))

        if (isGroupManager) {
          return true
        }

        const isCurrentUser = item.fromUser.uid === userUid.value
        if (!isCurrentUser) {
          return false
        }

        return !isDiffNow({ time: item.message.sendTime, unit: 'minute', diff: 2 })
      }
    }
  ])

  const videoMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: (item: MessageType) => {
        if (isMobile()) {
          showComingSoon()
          return
        }
        handleCopy(item.message.body.url, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: MessageType) => {
        if (isMobile()) {
          showComingSoon()
          return
        }
        const bodyRecord = item.message.body as Record<string, unknown>
        await saveVideoAttachmentAs({
          url: item.message.body.url,
          downloadFile,
          encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
          defaultFileName:
            (typeof bodyRecord.fileName === 'string' && bodyRecord.fileName) ||
            (typeof bodyRecord.filename === 'string' && bodyRecord.filename) ||
            undefined
        })
      }
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: MessageType) => {
        const bodyRecord = item.message.body as Record<string, unknown>
        await downloadAndRevealVideo({
          videoUrl: item.message.body.url || '',
          fileName:
            (typeof bodyRecord.fileName === 'string' && bodyRecord.fileName) ||
            (typeof bodyRecord.filename === 'string' && bodyRecord.filename) ||
            extractFileName(String(item.message.body.url || '')),
          encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined
        })
      }
    }
  ])

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
          const translatedText = await roomStateService.translateText(content)
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
                selectionStore.setMsgMultiChoose(true)
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
                if (isMobile()) {
                  showComingSoon()
                  return
                }
                const fileUrl = item.message.body.url
                const fileName = item.message.body.fileName
                const bodyRecord = item.message.body as Record<string, unknown>
                if (item.message.type === MsgEnum.VIDEO) {
                  await saveVideoAttachmentAs({
                    url: fileUrl,
                    downloadFile,
                    encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
                    defaultFileName: fileName
                  })
                } else {
                  await saveFileAttachmentAs({
                    url: fileUrl,
                    downloadFile,
                    encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
                    defaultFileName: fileName
                  })
                }
              }
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
              }
            }
          ]
          return [...baseMenus, ...mediaMenus]
        }

        return baseMenus
      } else {
        return [
          {
            label: () => t('menu.del'),
            icon: 'delete',
            click: (item: MessageType) => {
              tips.value = t('home.chat_main.delete.confirm')
              modalShow.value = true
              delIndex.value = item.message.id
              delRoomId.value = item.message.roomId
            }
          }
        ]
      }
    }
  })

  const fileMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.preview'),
      icon: 'preview-open',
      click: (item: RightMouseMessageItem) => {
        nextTick(async () => {
          await previewFile(item)
        })
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: RightMouseMessageItem) => {
        if (isMobile()) {
          showComingSoon()
          return
        }
        const bodyRecord = item.message.body as Record<string, unknown>
        await saveFileAttachmentAs({
          url: item.message.body.url,
          downloadFile,
          encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
          defaultFileName: item.message.body.fileName
        })
      }
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
      }
    }
  ])

  const imageMenuList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.copy'),
      icon: 'copy',
      click: async (item: MessageType) => {
        const imageUrl = item.message.body.url || item.message.body.content
        await handleCopy(imageUrl, true, item.message.id)
      }
    },
    ...commonMenuList.value,
    {
      label: () => t('menu.save_as'),
      icon: 'Importing',
      click: async (item: MessageType) => {
        if (isMobile()) {
          showComingSoon()
          return
        }
        try {
          const imageUrl = item.message.body.url
          if (!imageUrl) return
          const bodyRecord = item.message.body as Record<string, unknown>
          await saveFileAttachmentAs({
            url: imageUrl,
            downloadFile,
            encryptedFile: bodyRecord.encryptedFile as Record<string, unknown> | undefined,
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
      }
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
      }
    }
  ])

  const handleItemType = (type: MsgEnum) => {
    return type === MsgEnum.IMAGE || type === MsgEnum.EMOJI
      ? imageMenuList.value
      : type === MsgEnum.FILE
        ? fileMenuList.value
        : type === MsgEnum.VIDEO
          ? videoMenuList.value
          : menuList.value
  }

  return {
    commonMenuList,
    videoMenuList,
    menuList,
    specialMenuList,
    fileMenuList,
    imageMenuList,
    handleForward,
    handleItemType
  }
}
