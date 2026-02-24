import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum, OnlineEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { matrixRoomService } from '@/services/matrix'
import { matrixClientService } from '@/services/matrix'
import { info, error } from '@tauri-apps/plugin-log'

export interface MatrixContact {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  presence?: string
  statusMessage?: string
  directRoomId?: string
  uid: string
  name: string
  account: string
  avatar: string
  activeStatus: OnlineEnum
  remark: string
  lastOptTime: number
  hideMyPosts: boolean
  hideTheirPosts: boolean
}

export interface ContactInvite {
  roomId: string
  fromUserId: string
  fromDisplayName: string | null
  timestamp: number
  isGroup: boolean
}

export const useContactStore = defineStore(StoresEnum.CONTACTS, () => {
  const globalStore = useGlobalStore()

  const contactsList = ref<MatrixContact[]>([])
  const pendingInvites = ref<ContactInvite[]>([])
  const isLoading = ref(false)
  const contactsOptions = ref({ isLast: false, isLoading: false, cursor: '' })
  const requestFriendsList = ref<any[]>([])
  const applyPageOptions = ref({ isLast: false, cursor: '', pageNo: 1 })

  const directContacts = computed(() => contactsList.value.filter((c) => c.directRoomId))

  async function loadContacts(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      error('[ContactStore] 客户端未初始化')
      return
    }

    isLoading.value = true
    try {
      const directRooms = await matrixRoomService.getDirectRooms()
      const contacts: MatrixContact[] = []

      for (const [userId, roomIds] of directRooms) {
        if (roomIds.length > 0) {
          const roomId = roomIds[0]
          const room = client.getRoom(roomId)

          contacts.push({
            userId,
            uid: userId,
            displayName: room?.name || userId.split(':')[0],
            name: room?.name || userId.split(':')[0],
            avatarUrl: room?.getMxcAvatarUrl?.() || null,
            avatar: room?.getMxcAvatarUrl?.() || '',
            directRoomId: roomId,
            account: userId.split(':')[0],
            activeStatus: OnlineEnum.ONLINE,
            remark: '',
            lastOptTime: Date.now(),
            hideMyPosts: false,
            hideTheirPosts: false
          })
        }
      }

      contactsList.value = contacts
      info(`[ContactStore] 加载联系人成功: ${contacts.length} 个`)
    } catch (err) {
      error(`[ContactStore] 加载联系人失败: ${err}`)
    } finally {
      isLoading.value = false
    }
  }

  async function getContactList(isFresh = false): Promise<void> {
    if (isFresh) {
      contactsOptions.value.cursor = ''
      contactsOptions.value.isLast = false
    }
    await loadContacts()
  }

  async function getUserProfile(userId: string): Promise<MatrixContact | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      return null
    }

    try {
      const profile = await client.getProfileInfo(userId)
      return {
        userId,
        uid: userId,
        displayName: profile.displayname || null,
        name: profile.displayname || userId.split(':')[0],
        avatarUrl: profile.avatar_url || null,
        avatar: profile.avatar_url || '',
        account: userId.split(':')[0],
        activeStatus: OnlineEnum.ONLINE,
        remark: '',
        lastOptTime: Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false
      }
    } catch (err) {
      error(`[ContactStore] 获取用户资料失败: ${userId}`)
      return null
    }
  }

  async function startDirectRoom(userId: string): Promise<string | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      error('[ContactStore] 客户端未初始化')
      return null
    }

    try {
      const existingContact = contactsList.value.find((c) => c.userId === userId)
      if (existingContact?.directRoomId) {
        return existingContact.directRoomId
      }

      const roomId = await matrixRoomService.createDirectRoom(userId)

      contactsList.value.push({
        userId,
        uid: userId,
        displayName: null,
        name: userId.split(':')[0],
        avatarUrl: null,
        avatar: '',
        directRoomId: roomId,
        account: userId.split(':')[0],
        activeStatus: OnlineEnum.ONLINE,
        remark: '',
        lastOptTime: Date.now(),
        hideMyPosts: false,
        hideTheirPosts: false
      })

      await matrixRoomService.setDirectRoom(userId, roomId)

      info(`[ContactStore] 创建直接消息房间成功: ${roomId}`)
      return roomId
    } catch (err) {
      error(`[ContactStore] 创建直接消息房间失败: ${err}`)
      return null
    }
  }

  async function removeFromContacts(userId: string): Promise<boolean> {
    const contact = contactsList.value.find((c) => c.userId === userId)
    if (!contact?.directRoomId) {
      return false
    }

    try {
      await matrixRoomService.leaveRoom(contact.directRoomId)
      contactsList.value = contactsList.value.filter((c) => c.userId !== userId)
      info(`[ContactStore] 移除联系人成功: ${userId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 移除联系人失败: ${err}`)
      return false
    }
  }

  async function onDeleteFriend(uid: string): Promise<void> {
    await removeFromContacts(uid)
  }

  function deleteContact(uid: string): void {
    contactsList.value = contactsList.value.filter((c) => c.userId !== uid && c.uid !== uid)
  }

  async function loadPendingInvites(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      const rooms = client.getRooms()
      const invites: ContactInvite[] = []

      for (const room of rooms) {
        const membership = room.getMyMembership()
        if (membership === 'invite') {
          const inviteState = room.getLiveTimeline().getState('f' as any)
          const inviteFrom = inviteState?.getStateEvents('m.room.member' as any, client.getUserId() ?? '')?.getSender()

          invites.push({
            roomId: room.roomId,
            fromUserId: inviteFrom || 'unknown',
            fromDisplayName: room.name || inviteFrom?.split(':')[0] || 'Unknown',
            timestamp: Date.now(),
            isGroup: !room.isSpaceRoom() && room.getJoinedMembers().length > 2
          })
        }
      }

      pendingInvites.value = invites
      globalStore.unReadMark.newFriendUnreadCount = invites.filter((i) => !i.isGroup).length
      globalStore.unReadMark.newGroupUnreadCount = invites.filter((i) => i.isGroup).length
    } catch (err) {
      error(`[ContactStore] 加载邀请列表失败: ${err}`)
    }
  }

  async function acceptInvite(roomId: string): Promise<boolean> {
    try {
      await matrixRoomService.joinRoom(roomId)
      pendingInvites.value = pendingInvites.value.filter((i) => i.roomId !== roomId)
      info(`[ContactStore] 接受邀请成功: ${roomId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 接受邀请失败: ${err}`)
      return false
    }
  }

  async function rejectInvite(roomId: string): Promise<boolean> {
    try {
      await matrixRoomService.leaveRoom(roomId)
      pendingInvites.value = pendingInvites.value.filter((i) => i.roomId !== roomId)
      info(`[ContactStore] 拒绝邀请成功: ${roomId}`)
      return true
    } catch (err) {
      error(`[ContactStore] 拒绝邀请失败: ${err}`)
      return false
    }
  }

  function getContactByUserId(userId: string): MatrixContact | undefined {
    return contactsList.value.find((c) => c.userId === userId || c.uid === userId)
  }

  function clearContacts(): void {
    contactsList.value = []
    pendingInvites.value = []
    requestFriendsList.value = []
  }

  async function getApplyUnReadCount(): Promise<void> {
    await loadPendingInvites()
  }

  async function getApplyPage(_applyType: string, _isFresh = false, _click = false): Promise<void> {
    // TODO: 实现获取申请列表
  }

  async function onHandleInvite(_apply: any): Promise<void> {
    // TODO: 实现处理邀请
  }

  return {
    contactsList,
    pendingInvites,
    isLoading,
    contactsOptions,
    requestFriendsList,
    applyPageOptions,
    directContacts,
    loadContacts,
    getContactList,
    getUserProfile,
    startDirectRoom,
    removeFromContacts,
    onDeleteFriend,
    deleteContact,
    loadPendingInvites,
    acceptInvite,
    rejectInvite,
    getContactByUserId,
    clearContacts,
    getApplyUnReadCount,
    getApplyPage,
    onHandleInvite
  }
})
