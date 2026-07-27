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

enum CallResponseStatus {
  TIMEOUT = -1,
  REJECTED = 0,
  ACCEPTED = 1,
  DROPPED = 2,
  CANCEL = 3
}

const CallResponseStatusDesc: Record<CallResponseStatus, string> = {
  [CallResponseStatus.TIMEOUT]: '超时未接听',
  [CallResponseStatus.REJECTED]: '已拒绝',
  [CallResponseStatus.ACCEPTED]: '已接听',
  [CallResponseStatus.DROPPED]: '已挂断',
  [CallResponseStatus.CANCEL]: '已取消'
}

function getCallResponseStatus(code: number): CallResponseStatus | undefined {
  return Object.values(CallResponseStatus).includes(code) ? (code as CallResponseStatus) : undefined
}

function _getCallResponseStatusDesc(code: number): string {
  const status = getCallResponseStatus(code)
  return status !== undefined ? CallResponseStatusDesc[status] : '未知状态'
}
