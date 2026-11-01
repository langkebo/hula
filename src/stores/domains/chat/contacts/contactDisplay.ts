/**
 * 联系人展示名（唯一口径）。
 *
 * `MatrixContact` 曾经的 `name` 字段就是「`displayName` 有值就用，否则退回 MXID 的
 * localpart」——它是**派生值**，不该作为独立字段存一份（存了就会与 `displayName` 漂移）。
 * 现在改为按需计算：
 *
 * - `displayName` 优先（服务端合并名：我设的备注名 → 对方昵称）
 * - 缺失时退回 MXID 的 localpart（`@alice:example.com` → `alice`）
 * - 再不行退回整个 userId，保证永远有可渲染的字符串
 *
 * 与 `FriendListItem` 的 `remark || displayName || name` 不冲突：那里优先的是
 * 「备注名」，这里只负责「没有备注名时叫什么」。
 */
export function getContactDisplayName(
  contact: { displayName?: string | null; userId?: string } | null | undefined
): string {
  if (!contact) return ''
  const displayName = contact.displayName?.trim()
  if (displayName) return displayName
  const userId = contact.userId ?? ''
  const localpart = userId.split(':')[0]?.replace(/^@/, '') ?? ''
  return localpart || userId
}
