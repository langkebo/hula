import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum, NotificationTypeEnum, RoomTypeEnum, SessionOperateEnum, UserType } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import { roomListService } from '@/services/matrix/room/RoomListService'
import { roomNavigationService } from '@/services/matrix/room/RoomNavigationService'
import { roomStateService } from '@/services/matrix/room/RoomStateService'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { invokeWithErrorHandler } from '../utils/TauriInvokeHandler'

const msgBoxShow = ref(false)
const shrinkStatus = ref(false)

// 模块级别注册事件监听，避免 hook 被多次调用时重复注册
let isShrinkListenerRegistered = false
const registerShrinkListener = () => {
  if (isShrinkListenerRegistered) return
  isShrinkListenerRegistered = true
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event: unknown) => {
    shrinkStatus.value = event as boolean
  })
}

import { createLogger } from '@/utils/Logger'

const logger = createLogger('Message')

export const useMessage = () => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const settingStore = useSettingStore()
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const roomStore = useRoomStore()
  const userStore = useUserStore()
  const BOT_ALLOWED_MENU_INDEXES = new Set([0, 1, 2, 3])

  // 确保监听器只注册一次
  registerShrinkListener()

  /**
   * 处理点击选中消息
   * 如果本地缓存中找不到自己，说明尚未同步服务端数据，此时强制刷新群成员信息。
   */
  const ensureGroupMembersSynced = async (roomId: string, sessionType: RoomTypeEnum) => {
    if (sessionType !== RoomTypeEnum.GROUP) return

    const currentUid = userStore.userInfo?.uid
    if (!currentUid) return

    const memberList = groupStore.getUserListByRoomId(roomId)
    const alreadyHasCurrentUser = memberList.some((member) => member.uid === currentUid)

    if (!alreadyHasCurrentUser) {
      await groupStore.getGroupUserList(roomId, true)
    }
  }

  const handleMsgClick = async (item: SessionItem) => {
    msgBoxShow.value = true
    // 更新当前会话信息
    const roomId = item.roomId
    logger.debug('点击会话:', roomId, 'UI未读数:', item.unreadCount)

    globalStore.updateCurrentSessionRoomId(roomId)

    chatStore.getSession(roomId)
    chatStore.markSessionRead(roomId)

    // 再根据是否存在自身成员做一次兜底刷新，防止批量切换账号后看到旧数据
    try {
      await ensureGroupMembersSynced(roomId, item.type)
    } catch (error) {
      logger.error('同步群成员失败:', error)
    }
  }

  /**
   * 预加载聊天室
   * @param roomId
   */
  const preloadChatRoom = (roomId: string = '1') => {
    globalStore.updateCurrentSessionRoomId(roomId)
  }

  /**
   * 删除会话
   * @param roomId 会话信息
   */
  const handleMsgDelete = async (roomId: string) => {
    const currentSessions = chatStore.sessionList
    const currentIndex = currentSessions.findIndex((session) => session.roomId === roomId)

    // 检查是否是当前选中的会话
    const isCurrentSession = roomId === globalStore.currentSessionRoomId

    chatStore.removeSession(roomId)
    // 隐藏会话接口已通过 invokeWithErrorHandler 调用
    await invokeWithErrorHandler('hide_contact_command', { data: { roomId, hide: true } })

    // 如果不是当前选中的会话，直接返回
    if (!isCurrentSession) {
      return
    }

    const updatedSessions = chatStore.sessionList

    // 选择下一个或上一个会话
    const nextIndex = Math.min(currentIndex, updatedSessions.length - 1)
    const nextSession = updatedSessions[nextIndex]
    if (nextSession) {
      await handleMsgClick(nextSession)
    }
  }

  /** 处理双击事件 */
  const handleMsgDblclick = (item: SessionItem) => {
    if (!settingStore.messageDoubleClickEnabled) return
    logger.debug('双击消息项:', item)
  }

  const menuList = ref<OPT.RightMenu[]>([
    {
      label: (item: SessionItem) => (item.top ? t('menu.unpin') : t('menu.pin')),
      icon: (item: SessionItem) => (item.top ? 'to-bottom' : 'to-top'),
      click: (item: SessionItem) => {
        roomListService
          .setSessionTop(item.roomId, !item.top)
          .then(() => {
            chatStore.updateSession(item.roomId, { top: !item.top })
            showFeedback(
              item.top ? t('message.message_menu.unpin_success') : t('message.message_menu.pin_success'),
              'success'
            )
          })
          .catch(() => {
            showFeedback(item.top ? t('message.message_menu.unpin_fail') : t('message.message_menu.pin_fail'), 'error')
          })
      }
    },
    {
      label: (item: SessionItem) =>
        roomStore.hasTag(item.roomId, 'm.lowpriority') ? t('menu.remove_low_priority') : t('menu.set_low_priority'),
      icon: 'arrow-down',
      click: (item: SessionItem) => {
        const hasLow = roomStore.hasTag(item.roomId, 'm.lowpriority')
        const action = hasLow
          ? roomStore.removeRoomTag(item.roomId, 'm.lowpriority')
          : roomStore.addRoomTag(item.roomId, 'm.lowpriority')
        action
          .then(() => {
            showFeedback(
              hasLow
                ? t('message.message_menu.remove_low_priority_success')
                : t('message.message_menu.set_low_priority_success'),
              'success'
            )
          })
          .catch(() => {
            showFeedback(
              hasLow
                ? t('message.message_menu.remove_low_priority_fail')
                : t('message.message_menu.set_low_priority_fail'),
              'error'
            )
          })
      }
    },
    {
      label: () => t('menu.copy_account'),
      icon: 'copy',
      click: (item: SessionItem) => {
        navigator.clipboard.writeText(item.account ?? '')
        showFeedback(t('message.message_menu.copy_success', { account: item.account ?? '' }), 'success')
      }
    },
    {
      label: () => t('menu.mark_unread'),
      icon: 'message-unread'
    },
    {
      label: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) {
          return t('menu.group_message_setting')
        }

        return item.muteNotification === NotificationTypeEnum.RECEPTION
          ? t('menu.set_do_not_disturb')
          : t('menu.unset_do_not_disturb')
      },
      icon: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) {
          return 'peoples-two'
        }
        return item.muteNotification === NotificationTypeEnum.RECEPTION ? 'close-remind' : 'remind'
      },
      children: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return null

        return [
          {
            label: () => t('menu.allow_notifications'),
            icon: !item.shield && item.muteNotification === NotificationTypeEnum.RECEPTION ? 'check-small' : '',
            click: async () => {
              // 如果当前是屏蔽状态，需要先取消屏蔽
              if (item.shield) {
                await roomStateService.setRoomShield(item.roomId, false)
                chatStore.updateSession(item.roomId, { shield: false })
              }
              await handleNotificationChange(item, NotificationTypeEnum.RECEPTION)
            }
          },
          {
            label: () => t('menu.receive_silently'),
            icon: !item.shield && item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'check-small' : '',
            click: async () => {
              // 如果当前是屏蔽状态，需要先取消屏蔽
              if (item.shield) {
                await roomStateService.setRoomShield(item.roomId, false)
                chatStore.updateSession(item.roomId, { shield: false })
              }
              await handleNotificationChange(item, NotificationTypeEnum.NOT_DISTURB)
            }
          },
          {
            label: () => t('menu.block_group_messages'),
            icon: item.shield ? 'check-small' : '',
            click: async () => {
              await roomStateService.setRoomShield(item.roomId, !item.shield)

              // 更新本地会话状态
              chatStore.updateSession(item.roomId, {
                shield: !item.shield
              })

              showFeedback(
                item.shield ? t('message.message_menu.unshield_success') : t('message.message_menu.shield_success'),
                'success'
              )
            }
          }
        ]
      },
      click: async (item: SessionItem) => {
        if (item.type === RoomTypeEnum.GROUP) return // 群聊不执行点击事件

        const newType =
          item.muteNotification === NotificationTypeEnum.RECEPTION
            ? NotificationTypeEnum.NOT_DISTURB
            : NotificationTypeEnum.RECEPTION

        await handleNotificationChange(item, newType)
      }
    }
  ])

  const specialMenuList = ref<OPT.RightMenu[]>([
    {
      label: (item: SessionItem) => (item.shield ? t('menu.unblock_user_messages') : t('menu.block_user_messages')),
      icon: (item: SessionItem) => (item.shield ? 'message-success' : 'people-unknown'),
      click: async (item: SessionItem) => {
        await roomStateService.setRoomShield(item.roomId, !item.shield)

        // 更新本地会话状态
        chatStore.updateSession(item.roomId, {
          shield: !item.shield
        })

        showFeedback(
          item.shield ? t('message.message_menu.unshield_success') : t('message.message_menu.shield_success'),
          'success'
        )
      },
      // 只在单聊时显示
      visible: (item: SessionItem) => item.type === RoomTypeEnum.SINGLE
    },
    {
      label: () => t('menu.remove_from_list'),
      icon: 'delete',
      click: async (item: SessionItem) => {
        await handleMsgDelete(item.roomId)
      }
    },
    {
      label: (item: SessionItem) => (item.hide ? t('menu.secret_chat_cancel') : t('menu.secret_chat')),
      icon: (item: SessionItem) => (item.hide ? 'eye' : 'eye-close'),
      click: async (item: SessionItem) => {
        const newHideState = !item.hide
        try {
          await invokeWithErrorHandler('hide_contact_command', { data: { roomId: item.roomId, hide: newHideState } })
          chatStore.updateSession(item.roomId, { hide: newHideState })
          showFeedback(newHideState ? t('menu.secret_chat_success') : t('menu.secret_chat_cancel'), 'success')
        } catch (e) {
          showFeedback(String(e), 'error')
        }
      }
    },
    {
      label: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return t('menu.delete_friend')
        if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return t('menu.dissolve_group')
        return t('menu.leave_group')
      },
      icon: (item: SessionItem) => {
        if (item.type === RoomTypeEnum.SINGLE) return 'forbid'
        if (item.operate === SessionOperateEnum.DISSOLUTION_GROUP) return 'logout'
        return 'logout'
      },
      click: async (item: SessionItem) => {
        logger.debug('删除好友或退出群聊执行')
        // 单聊：删除好友
        if (item.type === RoomTypeEnum.SINGLE) {
          if (!item.detailId) return
          await contactStore.onDeleteFriend(item.detailId)
          await handleMsgDelete(item.roomId)
          showFeedback(t('message.message_menu.delete_friend_success'), 'success')
          return
        }

        // 群聊：检查是否是频道
        if (item.roomId === '1') {
          showFeedback(
            item.operate === SessionOperateEnum.DISSOLUTION_GROUP
              ? t('message.message_menu.cannot_dissolve_channel')
              : t('message.message_menu.cannot_quit_channel'),
            'warning'
          )
          return
        }

        // 群聊：解散或退出
        await roomNavigationService.leaveRoom(item.roomId)
        await handleMsgDelete(item.roomId)
        showFeedback(
          item.operate === SessionOperateEnum.DISSOLUTION_GROUP
            ? t('message.message_menu.dissolve_group_success')
            : t('message.message_menu.quit_group_success'),
          'success'
        )
      },
      visible: (item: SessionItem) => {
        // 单聊：只在operate为DELETE_FRIEND时显示
        if (item.type === RoomTypeEnum.SINGLE) {
          return item.operate === SessionOperateEnum.DELETE_FRIEND
        }

        // 群聊：不显示频道选项
        if (item.roomId === '1') return false

        // 群聊：始终显示退出选项，如果是群主则显示解散选项
        return true
      }
    }
  ])

  const handleNotificationChange = async (item: SessionItem, newType: NotificationTypeEnum) => {
    try {
      await roomStateService.setRoomNotification(item.roomId, newType)

      // 更新本地会话状态
      chatStore.updateSession(item.roomId, {
        muteNotification: newType
      })

      // 如果从免打扰切换到允许提醒，需要重新计算全局未读数
      if (item.muteNotification === NotificationTypeEnum.NOT_DISTURB && newType === NotificationTypeEnum.RECEPTION) {
        chatStore.updateTotalUnreadCount()
      }

      // 显示操作成功提示
      let message = ''
      switch (newType) {
        case NotificationTypeEnum.RECEPTION:
          message = t('message.message_menu.notification_allowed')
          break
        case NotificationTypeEnum.NOT_DISTURB:
          message = t('message.message_menu.notification_silent')
          // 设置免打扰时也需要更新全局未读数，因为该会话的未读数将不再计入
          chatStore.updateTotalUnreadCount()
          break
      }
      showFeedback(message, 'success')
    } catch (e) {
      showFeedback(String(e), 'error')
    }
  }

  const _visibleMenu = (item: SessionItem) => {
    if (item.account === UserType.BOT) {
      return menuList.value.filter((_, index) => BOT_ALLOWED_MENU_INDEXES.has(index))
    }
    return menuList.value
  }

  const _visibleSpecialMenu = (item: SessionItem) => {
    if (item.account === UserType.BOT) {
      return []
    }
    return specialMenuList.value
  }

  return {
    msgBoxShow,
    handleMsgClick,
    handleMsgDelete,
    handleMsgDblclick,
    menuList,
    specialMenuList,
    visibleMenu: _visibleMenu,
    visibleSpecialMenu: _visibleSpecialMenu,
    preloadChatRoom
  }
}
