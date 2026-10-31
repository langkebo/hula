import type { MatrixContact } from './types'

/**
 * 合并好友快照时**保留本地已同步的在线状态**。
 *
 * 为什么需要：好友接口返回的是静态快照，且其中的 `online/presence` 不可靠。
 * 若直接用快照覆盖本地联系人，会把已在线的好友刷回离线；更糟的是后续 presence
 * 同步只在「联系人 id 集合变化」时重跑，于是这些好友会一直显示离线。
 *
 * 从 `contacts/list.ts` 抽出：该文件有 400 行硬限，且这里是**纯函数**，
 * 单独放便于测试（不在 store 闭包里）。
 */
const PRESENCE_FIELDS = ['activeStatus', 'lastOptTime', 'presence', 'statusMessage'] as const

export function mergeContactPreservingPresence(existing: MatrixContact, next: MatrixContact): MatrixContact {
  const merged: MatrixContact = { ...existing, ...next }
  for (const field of PRESENCE_FIELDS) {
    // 逐字段回填：不能整体保留 existing，否则快照里真正更新的资料会被吞掉
    Object.assign(merged, { [field]: existing[field] })
  }
  return merged
}

/**
 * 全量列表合并：按 userId 匹配上一次的本地联系人，保留其在线状态。
 *
 * 新出现的联系人直接用快照；消失的（已被删除）自然不进入结果。
 */
export function mergeContactListPreservingPresence(previous: MatrixContact[], next: MatrixContact[]): MatrixContact[] {
  const previousMap = new Map(previous.map((contact) => [contact.userId, contact]))
  return next.map((contact) => {
    const existing = previousMap.get(contact.userId)
    return existing ? mergeContactPreservingPresence(existing, contact) : contact
  })
}
