import { type AppError, toAppError } from '@/common/errors'
import { formatMatrixError } from '@/common/matrixErrorTranslator'

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
  level: 'toast' | 'dialog' | 'page'
  resolutionAction: 'retry' | 'relogin' | 'check_network' | 'none'
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

function appErrorToLevel(appError: AppError): 'toast' | 'dialog' | 'page' {
  if (appError.kind === 'auth') return 'dialog'
  if (appError.kind === 'fatal') return 'dialog'
  return 'toast'
}

function appErrorToAction(appError: AppError): 'retry' | 'relogin' | 'check_network' | 'none' {
  if (appError.kind === 'auth') return 'relogin'
  if (appError.kind === 'retryable') return 'retry'
  return 'none'
}

function isRecoverable(appError: AppError): boolean {
  if (appError.kind === 'retryable') return true
  if (appError.kind === 'auth') return appError.recoverable
  return false
}

export const createFriendDomainError = (action: FriendAction, err: unknown): FriendDomainError => {
  const appError = toAppError(err)
  const fallbackMessageKey = DEFAULT_ACTION_MESSAGE_KEY[action]
  const domainError = new Error(formatMatrixError(err)) as FriendDomainError

  domainError.name = 'FriendDomainError'
  domainError.code =
    (err as { errcode?: string; code?: string } | null)?.errcode ||
    (err as { errcode?: string; code?: string } | null)?.code ||
    'FRIEND_UNKNOWN'
  domainError.action = action
  domainError.userMessageKey = appError.i18nKey || appError.message || fallbackMessageKey
  domainError.recoverable = isRecoverable(appError)
  domainError.level = appErrorToLevel(appError)
  domainError.resolutionAction = appErrorToAction(appError)
  domainError.cause = err

  return domainError
}

export const resolveFriendErrorMessageKey = (action: FriendAction, err: unknown): string => {
  return createFriendDomainError(action, err).userMessageKey
}
