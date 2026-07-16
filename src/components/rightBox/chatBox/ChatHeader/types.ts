import type { UserItem } from '@/services/types'
import type { MessageType } from '@/stores/domains/chat/chat'
import type { RoomActEnum } from '@/enums'

export interface ChatHeaderState {
  sidebarShow: boolean
  modalShow: boolean
  showQRCodeModal: boolean
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

export interface UserInfo {
  uid: string
  name: string
  avatar: string
}
