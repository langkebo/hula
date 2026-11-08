import type { SessionItem } from './session'

/**
 * 会话列表按 [top, activeTime] 降序维护，当 activeTime 刚被更新为当前最大值时，
 * 该会话在分组内的目标位置即为同 top 分组首位，只需一次 O(n) 移动，无需全量排序。
 * 列表内不存在该会话时不做插入，返回 false。
 */
export const moveSessionToGroupHead = (list: SessionItem[], session: SessionItem): boolean => {
  const from = list.indexOf(session)
  if (from === -1) return false

  list.splice(from, 1)
  let to = 0
  while (to < list.length && list[to].top !== session.top) to += 1
  list.splice(to, 0, session)
  return true
}
