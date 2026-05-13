import { formatMatrixError, type TranslatedError, translateMatrixError } from '@/common/matrixErrorTranslator'

export type FriendAction =
  | 'initialize'
  | 'loadFriends'
  | 'loadRequests'
  | 'sendRequest'
  | 'acceptRequest'
  | 'rejectRequest'
  | 'cancelRequest'
  | 'removeFriend'
  | 'updateStatus'
  | 'updateProfile'
  | 'subscribePresence'

export interface FriendDomainError extends Error {
  code: string
  action: FriendAction
  userMessageKey: string
  recoverable: boolean
  level: TranslatedError['level']
  resolutionAction: TranslatedError['action']
  cause: unknown
}

const DEFAULT_ACTION_MESSAGE_KEY: Record<FriendAction, string> = {
  initialize: 'error.matrix.unknown',
  loadFriends: 'error.matrix.unknown',
  loadRequests: 'error.matrix.unknown',
  sendRequest: 'friend.add.error',
  acceptRequest: 'friend.request.error.accept',
  rejectRequest: 'friend.request.error.reject',
  cancelRequest: 'friend.request.error.cancel',
  removeFriend: 'friend.detail.remove_error',
  updateStatus: 'friend.detail.status_error',
  updateProfile: 'friend.detail.note_error',
  subscribePresence: 'error.matrix.network'
}

export const createFriendDomainError = (action: FriendAction, err: unknown): FriendDomainError => {
  const translated = translateMatrixError(err)
  const fallbackMessageKey = DEFAULT_ACTION_MESSAGE_KEY[action]
  const domainError = new Error(formatMatrixError(err)) as FriendDomainError

  domainError.name = 'FriendDomainError'
  domainError.code =
    (err as { errcode?: string; code?: string } | null)?.errcode ||
    (err as { errcode?: string; code?: string } | null)?.code ||
    'FRIEND_UNKNOWN'
  domainError.action = action
  domainError.userMessageKey = translated.userMessage || fallbackMessageKey
  domainError.recoverable = translated.recoverable
  domainError.level = translated.level
  domainError.resolutionAction = translated.action
  domainError.cause = err

  return domainError
}

export const resolveFriendErrorMessageKey = (action: FriendAction, err: unknown): string => {
  return createFriendDomainError(action, err).userMessageKey
}
