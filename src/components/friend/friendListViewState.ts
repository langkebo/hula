export type FriendListViewState = 'capability' | 'empty' | 'error' | 'normal'

type ResolveFriendListViewStateOptions = {
  isCapabilityReady: boolean
  canUseFriendList: boolean
  hasError: boolean
  hasFriends: boolean
}

export function resolveFriendListViewState({
  isCapabilityReady,
  canUseFriendList,
  hasError,
  hasFriends
}: ResolveFriendListViewStateOptions): FriendListViewState {
  if (isCapabilityReady && !canUseFriendList) {
    return 'capability'
  }

  if (hasError && !hasFriends) {
    return 'error'
  }

  if (!hasFriends) {
    return 'empty'
  }

  return 'normal'
}
