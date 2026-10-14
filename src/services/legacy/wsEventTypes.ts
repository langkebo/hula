import type { UserInfoType } from '@/services/types'

export type LoginSuccessResType = Pick<UserInfoType, 'avatar' | 'name' | 'uid' | 'account'> & {
  token: string
}

export type OnStatusChangeType = {
  uid: string
  type: number
  roomId: string
  lastOptTime: number
}

export type WsTokenExpire = {
  uid: string
  ip: string
  client: string
}
