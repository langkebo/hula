/**
 * 从异构的「用户信息」对象里取头像地址。
 *
 * 仓内三个来源的字段名不同：
 * - `UserInfoType` / `MatrixRoomMember`：`avatar`
 * - `MatrixContact`：`avatarUrl`（联系人侧已删除 `avatar` 别名，统一用 `avatarUrl`）
 *
 * 用结构化取值而不是类型断言：任何来源缺字段时返回空串，交给 `AvatarUtils` 兜底。
 * 放在 utils 而不是组件内，是因为「同一份数据在不同领域叫不同名字」这个适配
 * 不该在每个展示组件里各写一遍。
 */
export function pickAvatarFromUserInfo(info: unknown): string {
  if (!info || typeof info !== 'object') return ''
  const record = info as { avatar?: unknown; avatarUrl?: unknown }
  if (typeof record.avatarUrl === 'string' && record.avatarUrl) return record.avatarUrl
  if (typeof record.avatar === 'string' && record.avatar) return record.avatar
  return ''
}
