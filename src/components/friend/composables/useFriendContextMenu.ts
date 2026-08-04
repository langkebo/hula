import { computed, h, type Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { matrixSpecialFriendService } from '@/services/matrix/friends/MatrixSpecialFriendService'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'

interface UseFriendContextMenuOptions {
  /** ContextMenu 组件的模板引用，需暴露 show(event) 方法 */
  contextMenuRef: Ref<{ show: (event: MouseEvent) => void } | undefined>
}

/**
 * 好友右键菜单与好友操作 Composable
 *
 * 负责：
 * - 右键菜单项构建（contextMenuItems）
 * - 右键菜单触发与选中项分发（handleContextMenu / handleContextMenuSelect）
 * - 共享操作：发起 DM（performSendMessage）、移除好友（performRemoveFriend）
 * - FriendListItem 动作按钮入口（handleSendMessage / handleRemoveFriend）
 * - 设置密友 / 备注 / 备注名（handleSetSecretFriend / handleSetNote / handleSetDisplayName）
 */
export function useFriendContextMenu({ contextMenuRef }: UseFriendContextMenuOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const contactStore = useContactStore()

  const selectedFriend = ref<MatrixContact | null>(null)

  const contextMenuItems = computed(() => {
    const items = [
      { label: t('friend.context.send_message'), icon: 'message' },
      { label: t('friend.context.encrypted_chat'), icon: 'lock' },
      { label: t('friend.context.secret_chat'), icon: 'eye-close' },
      { label: 'divider', icon: '' },
      { label: t('friend.context.set_note'), icon: 'edit' },
      { label: t('friend.context.set_display_name'), icon: 'tag' },
      { label: 'divider', icon: '' },
      { label: t('friend.context.set_favorite'), icon: 'star' },
      { label: t('friend.context.set_normal'), icon: 'user' },
      { label: t('friend.context.set_blocked'), icon: 'block' },
      { label: 'divider', icon: '' },
      { label: t('friend.context.remove'), icon: 'delete' }
    ]
    return items
  })

  // 共享：发起直接消息会话（FriendListItem 发送消息按钮与右键菜单 send_message 复用同一逻辑）
  const performSendMessage = async (friend: MatrixContact) => {
    const dmInfo = await matrixFriendService.getFriendDmRoom(friend.userId)
    if (dmInfo.room_id) {
      const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
      await openMsgSessionByRoomId(dmInfo.room_id)
    } else {
      const roomId = await contactStore.startDirectRoom(friend.userId, false)
      if (roomId) {
        const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
        await openMsgSessionByRoomId(roomId)
      }
    }
  }

  // 共享：移除好友（FriendListItem 移除按钮与右键菜单 remove 复用同一逻辑）
  const performRemoveFriend = async (friend: MatrixContact) => {
    await contactStore.removeFromContacts(friend.userId)
  }

  // FriendListItem 发送消息按钮
  const handleSendMessage = (friend: MatrixContact) => performSendMessage(friend)

  // FriendListItem 移除好友按钮
  const handleRemoveFriend = (friend: MatrixContact) => performRemoveFriend(friend)

  const handleContextMenu = (event: MouseEvent, friend: MatrixContact) => {
    event.preventDefault()
    selectedFriend.value = friend
    contextMenuRef.value?.show(event)
  }

  const handleSetSecretFriend = async (friend: MatrixContact) => {
    try {
      await matrixSpecialFriendService.addSpecialFriend(friend.userId)
      showFeedback(t('friend.secret_chat.success'), 'success')
    } catch (e) {
      showFeedback(String(e), 'error')
    }
  }

  const handleSetNote = async (friend: MatrixContact) => {
    window.$dialog?.create({
      title: t('friend.context.set_note'),
      content: () =>
        h('div', { style: 'padding: 8px 0' }, [
          h('input', {
            id: 'friend-note-input',
            value: friend.note ?? friend.remark ?? '',
            placeholder: t('friend.detail.note_placeholder'),
            style:
              'width: 100%; padding: 8px 12px; border: 1px solid var(--tjg-border-default); border-radius: 6px; font-size: 14px; outline: none; background: var(--tjg-surface-panel); color: inherit;',
            maxlength: 1000
          })
        ]),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        const input = document.querySelector('#friend-note-input') as HTMLInputElement
        const note = input?.value?.trim() ?? ''
        if (note) {
          await contactStore.setFriendNote(friend.userId, note)
        }
      }
    })
  }

  const handleSetDisplayName = async (friend: MatrixContact) => {
    window.$dialog?.create({
      title: t('friend.context.set_display_name'),
      content: () =>
        h('div', { style: 'padding: 8px 0' }, [
          h('input', {
            id: 'friend-displayname-input',
            value: friend.remark ?? friend.displayName ?? '',
            placeholder: t('friend.detail.display_name_placeholder'),
            style:
              'width: 100%; padding: 8px 12px; border: 1px solid var(--tjg-border-default); border-radius: 6px; font-size: 14px; outline: none; background: var(--tjg-surface-panel); color: inherit;',
            maxlength: 256
          })
        ]),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: async () => {
        const input = document.querySelector('#friend-displayname-input') as HTMLInputElement
        const name = input?.value?.trim() ?? ''
        await contactStore.setFriendDisplayName(friend.userId, name)
      }
    })
  }

  const handleContextMenuSelect = async (item: { label: string }) => {
    if (!selectedFriend.value) return

    const friend = selectedFriend.value

    switch (item.label) {
      case t('friend.context.send_message'):
        await performSendMessage(friend)
        break
      case t('friend.context.encrypted_chat'): {
        const roomId = await contactStore.startDirectRoom(friend.userId, true)
        if (roomId) {
          const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
          await openMsgSessionByRoomId(roomId)
        }
        break
      }
      case t('friend.context.secret_chat'):
        await handleSetSecretFriend(friend)
        break
      case t('friend.context.set_note'):
        await handleSetNote(friend)
        break
      case t('friend.context.set_display_name'):
        await handleSetDisplayName(friend)
        break
      case t('friend.context.set_favorite'):
        await contactStore.setFriendStatus(friend.userId, 'favorite')
        break
      case t('friend.context.set_normal'):
        await contactStore.setFriendStatus(friend.userId, 'accepted')
        break
      case t('friend.context.set_blocked'):
        await contactStore.setFriendStatus(friend.userId, 'blocked')
        break
      case t('friend.context.remove'):
        await performRemoveFriend(friend)
        break
    }

    selectedFriend.value = null
  }

  return {
    selectedFriend,
    contextMenuItems,
    handleContextMenu,
    handleContextMenuSelect,
    performSendMessage,
    performRemoveFriend,
    handleSendMessage,
    handleRemoveFriend,
    handleSetSecretFriend,
    handleSetNote,
    handleSetDisplayName
  }
}
