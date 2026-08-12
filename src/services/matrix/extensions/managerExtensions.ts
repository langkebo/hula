import type { MatrixClient } from '@/services/matrix/sdk'

/**
 * 单一真相：判断 MatrixClient 是否注册了 FriendManager 扩展。
 *
 * 此前该检查散落在 MatrixConnectionManager.assertCriticalExtensions 与
 * MatrixFriendService.getFriendManager 两处，存在逻辑漂移风险。提取为单一函数后，
 * 两处统一委托本函数，便于单测与后续演进。
 *
 * 判定规则（与 SDK initializeManagerExtensions 注入形态一致）：
 *  - client.getFriendManager 是函数（SDK 注入的访问器），或
 *  - client.friendManager 存在且具备 start 方法（直接挂载的回退形态）
 */
export function isFriendManagerRegistered(client: MatrixClient | null): boolean {
  if (!client) return false
  const c = client as unknown as Record<string, unknown>
  return (
    typeof c.getFriendManager === 'function' ||
    (c.friendManager != null && typeof (c.friendManager as Record<string, unknown>).start === 'function')
  )
}
