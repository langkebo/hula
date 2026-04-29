import { computed, onUnmounted, type InjectionKey } from 'vue'
import { ErrorType } from '@/common/exception'
import {
  MergeMessageType,
  MittEnum,
  MsgEnum,
  PowerEnum,
  CallTypeEnum,
  RoleEnum,
  RoomTypeEnum,
  TauriCommand
} from '@/enums'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useDownload } from '@/hooks/useDownload'
import { useMitt } from '@/hooks/useMitt.ts'
import { useVideoViewer } from '@/hooks/useVideoViewer'
import type { RightMouseMessageItem } from '@/services/types.ts'
import { createLogger } from '@/utils/Logger'
import {
  extractMsgIdFromDataKey,
  resolveSelectionMessageId,
  getSelectedText,
  hasSelectedText,
  clearSelection
} from './chatMain/selectionUtils'
import { useGroupNicknameModal, type GroupNicknameModalPayload } from './chatMain/useGroupNicknameModal'
import { useChatCopy } from './chatMain/useChatCopy'
import { useChatFileDownload } from './chatMain/useChatFileDownload'
import { createEmojiList } from './chatMain/emojiMenuData'
const logger = createLogger('ChatMain')

type ContextMenuItem = { uid?: string; fromUser: { uid: string } } & Record<string, unknown>
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { saveFileAttachmentAs, saveVideoAttachmentAs } from '@/utils/AttachmentSaver'
import { isDiffNow } from '@/utils/ComputedTime.ts'
import { extractFileName } from '@/utils/Formatting'
import { matrixMessageService, matrixGroupService, reportService } from '@/services/matrix'
import { isMac, isMobile } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import { useWindow } from './useWindow'
import { useI18n } from 'vue-i18n'
import { matrixRoomService } from '@/services/matrix'

type UseChatMainOptions = {
  enableGroupNicknameModal?: boolean
  disableHistoryActions?: boolean
}

export const useChatMain = (isHistoryMode = false, options: UseChatMainOptions = {}) => {
  const { t } = useI18n()
  const { createWebviewWindow, sendWindowPayload, startRtcCall } = useWindow()
  const { getLocalVideoPath, checkVideoDownloaded } = useVideoViewer()
  const settingStore = useSettingStore()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const chatStore = useChatStore()
  const emojiStore = useEmojiStore()
  const userStore = useUserStore()
  const userUid = computed(() => userStore.userInfo!.uid)
  const { downloadFile } = useDownload()
  const enableGroupNicknameModal = options.enableGroupNicknameModal ?? false
  const disableHistoryActions = options.disableHistoryActions ?? false

  const { downloadAndRevealFile, downloadAndRevealVideo, previewFile } = useChatFileDownload({
    t,
    downloadFile,
    getLocalVideoPath,
    checkVideoDownloaded,
    createWebviewWindow,
    sendWindowPayload
  })
  /** 滚动条位置 */
  const scrollTop = ref(-1)
  /** 提醒框标题 */
  const tips = ref()
  /** 是否显示删除信息的弹窗 */
  const modalShow = ref(false)
  /** 需要删除信息的下标 */
  const delIndex = ref('')
  const delRoomId = ref('')
  /** 选中的气泡消息 */
  const activeBubble = ref('')
  /** 记录历史消息下标 */
  const historyIndex = ref(0)
  /** 当前点击的用户的key */
  const selectKey = ref()

  /** 修改群昵称弹窗（抽离到 useGroupNicknameModal） */
  const {
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    handleGroupNicknameConfirm
  } = useGroupNicknameModal({
    userUid,
    t,
    enableMitt: enableGroupNicknameModal
  })

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
          window.$message.error(t('home.chat_main.image.fetch_failed'))
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
          window.$message.warning(t('home.chat_main.feature.coming_soon'))
          return
        }
        handleForward(item)
      },
      visible: (item: MessageType) => !isNoticeMessage(item)
    },
    // {
    //   label: '收藏',
    //   icon: 'collection-files',
    //   click: () => {
    //     window.$message.warning('暂未实现')
    //   }
    // },
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
          window.$message.error(String(res))
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
          window.$message.warning(t('home.chat_main.feature.coming_soon'))
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
          window.$message.warning(t('home.chat_main.feature.coming_soon'))
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
          window.$message?.warning(t('home.chat_main.translate.empty'))
          return
        }

        item.message.body.translatedText = { provider: settingStore.chatTranslateProvider || 'client', text: '' }
        try {
          const translatedText = await matrixRoomService.translateText(content, settingStore.chatTranslateProvider)
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
            // {
            //   label: '收藏',
            //   icon: 'collection-files',
            //   click: () => {
            //     window.$message.warning('暂未实现')
            //   }
            // },
            {
              label: () => t('menu.save_as'),
              icon: 'Importing',
              click: async (item: MessageType) => {
                if (isMobile()) {
                  window.$message.warning(t('home.chat_main.feature.coming_soon'))
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
          window.$message.warning(t('home.chat_main.feature.coming_soon'))
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
          window.$message.warning(t('home.chat_main.feature.coming_soon'))
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
          window.$message.error(t('home.chat_main.image.save_failed'))
        }
      }
    },
    {
      label: () => (isMac() ? t('menu.show_in_finder') : t('menu.show_in_folder')),
      icon: 'file2',
      click: async (item: MessageType) => {
        const fileUrl = (item.message.body.url || item.message.body.content) as string | undefined
        if (!fileUrl) {
          window.$message.warning(t('home.chat_main.image.locate_failed'))
          return
        }
        const fileName = item.message.body.fileName || extractFileName(fileUrl)
        const bodyRecord = item.message.body as Record<string, unknown>
        if (!fileName) {
          window.$message.warning(t('home.chat_main.image.locate_failed'))
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
        await createWebviewWindow('申请加好友', 'addFriendVerify', 380, 300, '', false, 380, 300)
        globalStore.openAddFriendModal(item.uid || item.fromUser.uid)
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
          window.$message.success(t('menu.set_admin_success'))
        } catch {
          window.$message.error(t('menu.set_admin_fail'))
        }
      },
      visible: (item: ContextMenuItem) => {
        // 1. 检查是否在群聊中
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 检查房间号是否为1(频道)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 获取目标用户ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 检查目标用户角色
        let targetRoleId = item.roleId as number | undefined

        // 如果item中没有roleId，则通过uid从群成员列表中查找
        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        // 检查目标用户是否已经是管理员或群主
        if (targetRoleId === RoleEnum.ADMIN || targetRoleId === RoleEnum.LORD) return false

        // 5. 检查当前用户是否是群主
        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        return currentUser?.roleId === RoleEnum.LORD
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
          window.$message.success(t('menu.revoke_admin_success'))
        } catch {
          window.$message.error(t('menu.revoke_admin_fail'))
        }
      },
      visible: (item: ContextMenuItem) => {
        // 1. 检查是否在群聊中
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 检查房间号是否为1(频道)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 获取目标用户ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 检查目标用户角色
        let targetRoleId = item.roleId as number | undefined

        // 如果item中没有roleId，则通过uid从群成员列表中查找
        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        // 检查目标用户是否是管理员(只能撤销管理员,不能撤销群主)
        if (targetRoleId !== RoleEnum.ADMIN) return false

        // 5. 检查当前用户是否是群主
        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        return currentUser?.roleId === RoleEnum.LORD
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
          await matrixGroupService.removeGroupMember(roomId, targetUid)
          // 从群成员列表中移除该用户
          groupStore.removeUserItem(targetUid, roomId)
          window.$message.success(t('menu.remove_from_group_success'))
        } catch {
          window.$message.error(t('menu.remove_from_group_fail'))
        }
      },
      visible: (item: ContextMenuItem) => {
        // 1. 检查是否在群聊中
        const isInGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
        if (!isInGroup) return false

        // 2. 检查房间号是否为1(频道)
        const roomId = globalStore.currentSessionRoomId
        if (!roomId || roomId === '1') return false

        // 3. 获取目标用户ID
        const targetUid = item.uid || item.fromUser?.uid
        if (!targetUid) return false

        // 4. 检查目标用户角色
        let targetRoleId = item.roleId as number | undefined

        // 如果item中没有roleId，则通过uid从群成员列表中查找
        if (targetRoleId === void 0) {
          const targetUser = groupStore.userList.find((user) => user.uid === targetUid)
          targetRoleId = targetUser?.roleId
        }

        // 检查目标用户是否是群主(群主不能被移出)
        if (targetRoleId === RoleEnum.LORD) return false

        // 5. 检查当前用户是否有权限(群主或管理员)
        const currentUser = groupStore.userList.find((user) => user.uid === userUid.value)
        const isLord = currentUser?.roleId === RoleEnum.LORD
        const isAdmin = currentUser?.roleId === RoleEnum.ADMIN

        // 6. 如果当前用户是管理员,则不能移出其他管理员
        if (isAdmin && targetRoleId === RoleEnum.ADMIN) return false

        return isLord || isAdmin
      }
    },
    {
      label: () => t('menu.report'),
      icon: 'caution',
      click: async (item: ContextMenuItem & { message?: { id: string } }) => {
        const roomId = globalStore.currentSessionRoomId
        const eventId = item.message?.id
        if (!roomId || !eventId) {
          window.$message.warning('无法获取消息信息')
          return
        }
        try {
          await reportService.reportEvent({
            roomId,
            eventId,
            reason: 'user_report',
            explanation: ''
          })
          window.$message.success('举报已提交')
        } catch (err) {
          logger.error('举报失败:', err)
          window.$message.error('举报失败，请稍后重试')
        }
      }
    }
  ])
  const emojiList = computed(() => createEmojiList(t))

  /**
   * 检查用户关系
   * @param uid 用户ID
   * @param type 检查类型: 'friend' - 仅好友, 'all' - 好友或自己
   */
  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    const contactStore = useContactStore()
    const userStore = useUserStore()
    const myUid = userStore.userInfo!.uid
    const isFriend = contactStore.contactsList.some((item) => item.uid === uid)
    return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
  }

  // Selection utilities moved to ./chatMain/selectionUtils.ts
  // `extractMsgIdFromDataKey` / `resolveSelectionMessageId` / `getSelectedText`
  // / `hasSelectedText` / `clearSelection` are imported at the top of the file.
  void extractMsgIdFromDataKey
  void resolveSelectionMessageId
  void hasSelectedText
  void clearSelection

  /** 消息复制（抽离到 useChatCopy） */
  const { handleCopy } = useChatCopy()

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

  /** 删除信息事件 */
  const handleConfirm = async () => {
    if (!delIndex.value) return
    const targetRoomId = delRoomId.value || globalStore.currentSessionRoomId
    if (!targetRoomId) {
      window.$message?.error('无法确定消息所属的会话')
      return
    }
    try {
      await invokeWithErrorHandler(
        TauriCommand.DELETE_MESSAGE,
        {
          messageId: delIndex.value,
          roomId: targetRoomId
        },
        {
          customErrorMessage: '删除消息失败',
          errorType: ErrorType.Client
        }
      )
      chatStore.deleteMsg(delIndex.value)
      useMitt.emit(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: targetRoomId })
      delIndex.value = ''
      delRoomId.value = ''
      modalShow.value = false
      window.$message?.success('消息已删除')
    } catch (error) {
      logger.error('删除消息失败:', error)
    }
  }

  let activeKeyPressListener: ((e: KeyboardEvent) => void) | null = null

  const removeKeyPressListener = () => {
    if (activeKeyPressListener) {
      document.removeEventListener('keydown', activeKeyPressListener)
      activeKeyPressListener = null
    }
  }

  /** 点击气泡消息时候监听用户是否按下ctrl+c来复制内容 */
  const handleMsgClick = (item: MessageType) => {
    if (item.message.type === MsgEnum.VIDEO_CALL) {
      startRtcCall(CallTypeEnum.VIDEO)
      return
    } else if (item.message.type === MsgEnum.AUDIO_CALL) {
      startRtcCall(CallTypeEnum.AUDIO)
      return
    }

    // 移动端不触发 active 效果
    if (!isMobile()) {
      if (chatStore.msgMultiChooseMode === 'forward') {
        activeBubble.value = ''
      } else {
        activeBubble.value = item.message.id
      }
    }

    // 先移除可能残留的监听，避免重复绑定
    removeKeyPressListener()

    // 启用键盘监听
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'c') || (e.metaKey && e.key === 'c')) {
        // 优先复制用户选中的文本，如果没有选中则复制整个消息内容
        // 对于图片或其他类型的消息，优先使用 url 字段
        const contentToCopy = item.message.body.url || item.message.body.content
        handleCopy(contentToCopy, true, item.message.id)
        // 取消监听键盘事件，以免多次绑定
        removeKeyPressListener()
      }
    }
    activeKeyPressListener = handleKeyPress
    // 绑定键盘事件到 document
    document.addEventListener('keydown', handleKeyPress)
  }

  onUnmounted(() => {
    removeKeyPressListener()
  })

  return {
    handleMsgClick,
    handleConfirm,
    handleItemType,
    handleCopy,
    videoMenuList,
    getSelectedText,
    hasSelectedText,
    clearSelection,
    historyIndex,
    tips,
    modalShow,
    specialMenuList,
    optionsList,
    report,
    selectKey,
    emojiList,
    commonMenuList,
    scrollTop,
    groupNicknameModalVisible,
    groupNicknameValue,
    groupNicknameError,
    groupNicknameSubmitting,
    handleGroupNicknameConfirm,
    activeBubble
  }
}

export type UseChatMainContext = ReturnType<typeof useChatMain>
export const chatMainInjectionKey = Symbol('chatMainInjectionKey') as InjectionKey<UseChatMainContext>
