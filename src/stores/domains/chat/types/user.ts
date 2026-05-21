import type { OnlineEnum } from '@/enums'

export interface MatrixUserBase {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  uid: string
  name: string
  account: string
  avatar: string
  activeStatus: OnlineEnum
  lastOptTime: number
  hideMyPosts?: boolean
  hideTheirPosts?: boolean
}
