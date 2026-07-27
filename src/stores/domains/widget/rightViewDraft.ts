import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 右侧栏表单视图草稿 Store（会话级别，非 localStorage）
 *
 * 参考需求文档 7.3 节：弹窗改为内嵌面板后，用户切换视图时表单数据需要保留。
 *
 * 草稿存储内容：
 * - addFriend: 搜索词 + 验证消息
 * - createRoom: 房间名称 + 主题 + 头像 + 类型 + 加密等
 * - joinRoom: 房间 ID/别名 + 申请理由
 * - createSpace: 空间名称 + 主题 + 头像
 *
 * 清除时机：
 * - 表单提交成功后清除对应 draft
 * - 用户手动点击"清空"按钮
 * - 不在视图切换时清除（保留草稿）
 */

export interface AddFriendDraft {
  searchValue: string
  searchMode: 'fuzzy' | 'exact'
  requestMessage: string
}

export interface CreateRoomDraft {
  name: string
  topic: string
  avatarUrl: string
  roomType: 'room' | 'private_room' | 'space'
  alias: string
  isEncrypted: boolean
  historyVisibility: 'shared' | 'invited' | 'joined' | 'world_readable'
  joinRule: 'invite' | 'knock' | 'public' | 'restricted'
}

export interface JoinRoomDraft {
  roomIdOrAlias: string
  reason: string
}

export interface CreateSpaceDraft {
  name: string
  topic: string
  avatarUrl: string
}

export type RightViewDraftKey = 'addFriend' | 'createRoom' | 'joinRoom' | 'createSpace'

const EMPTY_ADD_FRIEND: AddFriendDraft = {
  searchValue: '',
  searchMode: 'fuzzy',
  requestMessage: ''
}

const EMPTY_CREATE_ROOM: CreateRoomDraft = {
  name: '',
  topic: '',
  avatarUrl: '',
  roomType: 'private_room',
  alias: '',
  isEncrypted: true,
  historyVisibility: 'shared',
  joinRule: 'invite'
}

const EMPTY_JOIN_ROOM: JoinRoomDraft = {
  roomIdOrAlias: '',
  reason: ''
}

const EMPTY_CREATE_SPACE: CreateSpaceDraft = {
  name: '',
  topic: '',
  avatarUrl: ''
}

export const useRightViewDraftStore = defineStore('rightViewDraft', () => {
  const addFriend = ref<AddFriendDraft>({ ...EMPTY_ADD_FRIEND })
  const createRoom = ref<CreateRoomDraft>({ ...EMPTY_CREATE_ROOM })
  const joinRoom = ref<JoinRoomDraft>({ ...EMPTY_JOIN_ROOM })
  const createSpace = ref<CreateSpaceDraft>({ ...EMPTY_CREATE_SPACE })

  /** 已恢复草稿提示：在面板挂载时若发现非空草稿则置 true，3 秒后由面板自行清除 */
  const restoredHint = ref<RightViewDraftKey | null>(null)

  function saveAddFriend(patch: Partial<AddFriendDraft>) {
    addFriend.value = { ...addFriend.value, ...patch }
  }

  function saveCreateRoom(patch: Partial<CreateRoomDraft>) {
    createRoom.value = { ...createRoom.value, ...patch }
  }

  function saveJoinRoom(patch: Partial<JoinRoomDraft>) {
    joinRoom.value = { ...joinRoom.value, ...patch }
  }

  function saveCreateSpace(patch: Partial<CreateSpaceDraft>) {
    createSpace.value = { ...createSpace.value, ...patch }
  }

  function clearAddFriend() {
    addFriend.value = { ...EMPTY_ADD_FRIEND }
  }

  function clearCreateRoom() {
    createRoom.value = { ...EMPTY_CREATE_ROOM }
  }

  function clearJoinRoom() {
    joinRoom.value = { ...EMPTY_JOIN_ROOM }
  }

  function clearCreateSpace() {
    createSpace.value = { ...EMPTY_CREATE_SPACE }
  }

  function clearAll() {
    clearAddFriend()
    clearCreateRoom()
    clearJoinRoom()
    clearCreateSpace()
    restoredHint.value = null
  }

  function setRestoredHint(key: RightViewDraftKey | null) {
    restoredHint.value = key
  }

  return {
    addFriend,
    createRoom,
    joinRoom,
    createSpace,
    restoredHint,
    saveAddFriend,
    saveCreateRoom,
    saveJoinRoom,
    saveCreateSpace,
    clearAddFriend,
    clearCreateRoom,
    clearJoinRoom,
    clearCreateSpace,
    clearAll,
    setRestoredHint
  }
})
