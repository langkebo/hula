import type { UserItem } from '@/services/types'
import type { MessageType } from '@/stores/domains/chat/chat'

export interface ChatHeaderState {
  sidebarShow: boolean
  modalShow: boolean
  showQRCodeModal: boolean
  showManageGroupMemberModal: boolean
  tips: string
  optionsType: RoomActEnum | undefined
  isEditingGroupName: boolean
  editingGroupName: string
  localMyName: string
  localRemark: string
  pendingGroupInfo: {
    groupName?: string
    myName?: string
    remark?: string
  } | null
}

export interface GroupQrData {
  bytes: Uint8Array
  width: number
  height: number
}

export interface GroupQrShareOptions {
  roomId: string
  tempMsgId: string
  bytes: Uint8Array
  previewUrl: string
  width: number
  height: number
  size: number
  mimeType: string
}

export interface UserInfo {
  uid: string
  name: string
  avatar: string
  locPlace?: string
}

export type { UserItem, MessageType }

import { RoomActEnum } from '@/enums'
