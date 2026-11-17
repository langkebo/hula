type FriendListViewState = 'empty' | 'error' | 'normal'

type ResolveFriendListViewStateOptions = {
  hasError: boolean
  hasFriends: boolean
}

/**
 * 好友列表视图状态。
 *
 * 不按 `friend-list` 能力位隐藏列表：读取路径在 FriendManager 缺失时会回退
 * REST（见 MatrixConnectionManager），能力位只影响扩展写操作，不应把列表
 * 整体替换成「能力不可用」。
 */
export function resolveFriendListViewState({
  hasError,
  hasFriends
}: ResolveFriendListViewStateOptions): FriendListViewState {
  if (hasError && !hasFriends) {
    return 'error'
  }

  if (!hasFriends) {
    return 'empty'
  }

  return 'normal'
}
