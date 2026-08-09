import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { useDownload } from '@/composables/common/useDownload'
import { useMitt } from '@/composables/common/useMitt'
import { MergeMessageType, MittEnum, MsgEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
import type { RightMouseMessageItem } from '@/services/types.ts'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { getSelectedText } from './selectionUtils'
import type { useChatCopy } from './useChatCopy'
import type { useChatFileDownload } from './useChatFileDownload'
import type { GroupNicknameModalPayload } from './useGroupNicknameModal'
import { type GroupRoleMenuItem, useGroupRoleGuard } from './useGroupRoleGuard'

const logger = createLogger('ChatContextMenus')

/** 右键菜单项的公共形状（消息项或群成员项） */
export type ContextMenuItem = GroupRoleMenuItem

type UseChatContextMenusOptions = {
  /** 历史记录模式：specialMenuList 输出复制/转发/另存为，正常模式只输出删除 */
  isHistoryMode: boolean
  /** 历史模式下禁用选择/转发动作（多窗口场景） */
  disableHistoryActions: boolean
  downloadFile: ReturnType<typeof useDownload>['downloadFile']
  fileDownload: ReturnType<typeof useChatFileDownload>
  handleCopy: ReturnType<typeof useChatCopy>['handleCopy']
  /** 打开删除确认弹窗（由 useMsgDeleteConfirm 提供，正常模式 specialMenuList 的唯一动作） */
  openDeleteConfirm: (item: MessageType) => void
}

/**
 * 聊天右键菜单工厂
 *
 * 从 useChatMain 抽离（原文件 69% 的篇幅）：消息菜单（通用/视频/文件/图片/文本）、
 * 历史模式菜单、群成员管理菜单（optionsList/report）。
 * 群角色权限判断统一走 useGroupRoleGuard，不再各自重复实现。
 */
export const useChatContextMenus = (options: UseChatContextMenusOptions) => {
  const { isHistoryMode, disableHistoryActions, downloadFile, fileDownload, handleCopy, openDeleteConfirm } = options
  const { downloadAndRevealFile, downloadAndRevealVideo, previewFile } = fileDownload

  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const chatStore = useChatStore()
  const emojiStore = useEmojiStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const settingStore = useSettingStore()
  const {
    userUid,
    isGroupManagementContext,
    resolveTargetRoleId,
    currentUserRoleId,
    isCurrentUserLord,
    canRecallMessage
  } = useGroupRoleGuard()

  /**
   * 检查用户关系
   * @param uid 用户ID
   * @param type 检查类型: 'friend' - 仅好友, 'all' - 好友或自己
   */
  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    const contactStore = useContactStore()
    const userStore = useUserStore()
    const myUid = userStore.userInfo?.uid ?? ''
    const isFriend = contactStore.contactsList.some((item) => item.uid === uid)
    return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
  }

  /** 通用右键菜单 */
  const handleForward = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.getMessage(item.message.id)
    if (!target) {
      return
    }
    chatStore.clearMsgCheck()
    target.isCheck = true
    chatStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: MergeMessageType.SINGLE
    })
  }

  // 不能复制的消息类型
  const copyDisabledTypes: MsgEnum[] = [MsgEnum.NOTICE, MsgEnum.MERGE, MsgEnum.LOCATION, MsgEnum.BEACON, MsgEnum.VOICE]

  // 不能回复的消息类型
  const shouldHideCopy = (item: MessageType) => copyDisabledTypes.includes(item.message.type)
  const isNoticeMessage = (item: MessageType) => item.message.type === MsgEnum.NOTICE
  const showComingSoon = () => showFeedback(t('home.chat_main.feature.coming_soon'), 'warning')

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
          await matrixMessageService.recallMessage(globalStore.currentSessionRoomId, item.message.id)
        } catch (res: unknown) {
          showFeedback(String(res), 'error')
          return
        }
        chatStore.recordRecallMsg({
          recallUid: userStore.userInfo?.uid ?? '',
          msg,
          originalType,
          originalContent
        })
        await chatStore.updateRecallMsg({
          recallUid: userStore.userInfo?.uid ?? '',
          roomId: msg.message.roomId,
          msgId: msg.message.id
        })
      },
      visible: (item: MessageType) => canRecallMessage(item)
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
        // 正常聊天模式：只显示删除
        return [
          {
            label: () => t('menu.del'),
            icon: 'delete',
            click: (item: MessageType) => {
              openDeleteConfirm(item)
            }
          }
        ]
      }
    }
  })
  /** 文件类型右键菜单 */
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
  /** 右键用户信息菜单(群聊的时候显示) */
  const optionsList = ref<OPT.RightMenu[]>([
    {
      label: () => t('menu.send_message'),
      icon: 'message-action',
      click: (item: ContextMenuItem) => {
        openMsgSession(item.uid || item.fromUser.uid)
      },
      visible: (item: ContextMenuItem) => checkFriendRelation(item.uid || item.fromUser.uid, 'friend')
    },
    {
      label: 'TA',
      icon: 'aite',
      click: (item: ContextMenuItem) => {
        useMitt.emit(MittEnum.AT, item.uid || item.fromUser.uid)
      },
      visible: (item: ContextMenuItem) => (item.uid ? item.uid !== userUid.value : item.fromUser.uid !== userUid.value)
    },
    {
      label: () => t('menu.get_user_info'),
      icon: 'notes',
      click: (item: ContextMenuItem & { message?: { id: string }; type?: string }) => {
        // 如果是聊天框内的资料就使用的是消息的key，如果是群聊成员的资料就使用的是uid
        const uid = (item.uid || item.message?.id) as string
        const type = item.type ?? 'Main'
        useMitt.emit(`${MittEnum.INFO_POPOVER}-${type}`, { uid: uid, type: type })
      }
    },
    {
      label: () => t('menu.modify_group_nickname'),
      icon: 'edit',
      click: (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser?.uid
        const currentUid = userUid.value
        const roomId = globalStore.currentSessionRoomId
        const isGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP

        if (!isGroup || targetUid !== currentUid) {
          return
        }

        const currentUserInfo = groupStore.getUserInfo(currentUid, roomId)
        const currentNickname = currentUserInfo?.myName || ''

        useMitt.emit(MittEnum.OPEN_GROUP_NICKNAME_MODAL, {
          roomId,
          currentUid,
          originalNickname: currentNickname
        } as GroupNicknameModalPayload)
      },
      visible: (item: ContextMenuItem) => (item.uid ? item.uid === userUid.value : item.fromUser.uid === userUid.value)
    },
    {
      label: () => t('menu.add_friend'),
      icon: 'people-plus',
      click: async (item: ContextMenuItem) => {
        const uid = item.uid || item.fromUser.uid
        const { default: router } = await import('@/router')
        void router.push({ name: 'friend-add', query: { uid } })
      },
      visible: (item: ContextMenuItem) => !checkFriendRelation(item.uid || item.fromUser.uid, 'all')
    },
    {
      label: () => t('menu.set_admin'),
      icon: 'people-safe',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await groupStore.addAdmin([targetUid])
          showFeedback(t('menu.set_admin_success'), 'success')
        } catch {
          showFeedback(t('menu.set_admin_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        if (!isGroupManagementContext()) return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 已经是管理员或群主的用户不能再设为管理员
        const targetRoleId = resolveTargetRoleId(item)
        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        // 只有群主可以设管理员
        return isCurrentUserLord()
      }
    },
    {
      label: () => t('menu.revoke_admin'),
      icon: 'reduce-user',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await groupStore.revokeAdmin([targetUid])
          showFeedback(t('menu.revoke_admin_success'), 'success')
        } catch {
          showFeedback(t('menu.revoke_admin_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        if (!isGroupManagementContext()) return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 只能撤销管理员，不能撤销群主
        const targetRoleId = resolveTargetRoleId(item)
        if (targetRoleId !== RoleEnum.ADMIN) return false

        // 只有群主可以撤管理员
        return isCurrentUserLord()
      }
    }
  ])
  /** 举报选项 */
  const report = ref([
    {
      label: () => t('menu.remove_from_group'),
      icon: 'people-delete-one',
      click: async (item: ContextMenuItem) => {
        const targetUid = item.uid || item.fromUser.uid
        const roomId = globalStore.currentSessionRoomId
        if (!roomId) return

        try {
          await matrixRoomActionFacade.kickUser(roomId, targetUid)
          // 从群成员列表中移除该用户
          groupStore.removeUserItem(targetUid, roomId)
          showFeedback(t('menu.remove_from_group_success'), 'success')
        } catch {
          showFeedback(t('menu.remove_from_group_fail'), 'error')
        }
      },
      visible: (item: ContextMenuItem) => {
        if (!isGroupManagementContext()) return false

        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 群主不能被移出
        const targetRoleId = resolveTargetRoleId(item)
        if (targetRoleId === RoleEnum.LORD) return false

        // 当前用户是否群主或管理员
        const roleId = currentUserRoleId()
        const isLord = roleId === RoleEnum.LORD
        const isAdmin = roleId === RoleEnum.ADMIN

        // 管理员不能移出其他管理员
        if (isAdmin && targetRoleId === RoleEnum.ADMIN) return false

        return isLord || isAdmin
      }
    },
    {
      label: () => t('menu.report'),
      icon: 'caution',
      click: async (item: ContextMenuItem & { message?: { id: string; body?: { content?: string } } }) => {
        const roomId = globalStore.currentSessionRoomId
        const eventId = item.message?.id
        if (!roomId || !eventId) {
          showFeedback('无法获取消息信息', 'warning')
          return
        }
        useMitt.emit(MittEnum.OPEN_EVENT_REPORT, {
          roomId,
          eventId,
          eventContent: item.message?.body?.content || ''
        })
      }
    }
  ])

  /**
   * 根据消息类型获取右键菜单列表
   * @param type 消息类型
   */
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
    specialMenuList,
    optionsList,
    report,
    handleItemType
  }
}
