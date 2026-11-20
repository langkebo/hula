/**
 * admin 邀请名单域测试夹具。
 *
 * 类型全部由 SDK 方法签名推导（`AdminConfigManager`）：
 * - 全局名单读取：`getInviteAllowlist/getInviteBlocklist`
 *   → `{allowlist|blocklist, limit, offset, total_count}`
 * - 全局单条增删：`addToInvite*` → `{status, action, user_id, already_present, removed_from_other_list}`；
 *   `removeFromInvite*` → `{status, action, user_id, already_absent}`
 */
import type { AdminConfigManager } from '@/services/matrix/sdk'
import type { GlobalInviteListKind } from '../../AdminInvitePolicyService'

/** `getInviteAllowlist()` 的 wire 响应 */
type GlobalAllowlistWire = Awaited<ReturnType<AdminConfigManager['getInviteAllowlist']>>
/** `getInviteBlocklist()` 的 wire 响应 */
type GlobalBlocklistWire = Awaited<ReturnType<AdminConfigManager['getInviteBlocklist']>>
/** `addToInviteAllowlist()` 的 wire 响应（黑名单同构，仅 `action` 取值不同） */
type GlobalListAddWire = Awaited<ReturnType<AdminConfigManager['addToInviteAllowlist']>>
/** `removeFromInviteAllowlist()` 的 wire 响应（黑名单同构，仅 `action` 取值不同） */
type GlobalListRemoveWire = Awaited<ReturnType<AdminConfigManager['removeFromInviteAllowlist']>>

/** `getInviteAllowlist()` 响应 */
export function makeGlobalInviteAllowlistPage(overrides: Partial<GlobalAllowlistWire> = {}): GlobalAllowlistWire {
  return { allowlist: ['@a:example.org'], limit: 100, offset: 0, total_count: 1, ...overrides }
}

/** `getInviteBlocklist()` 响应 */
export function makeGlobalInviteBlocklistPage(overrides: Partial<GlobalBlocklistWire> = {}): GlobalBlocklistWire {
  return { blocklist: ['@b:example.org'], limit: 100, offset: 0, total_count: 1, ...overrides }
}

/**
 * 后端缺失名单字段时的畸形响应。
 *
 * 真实契约里 `allowlist` / `blocklist` 是必填字段，`{}` 属于非契约输入；
 * 服务层 `allow?.allowlist ?? []` 的降级分支专门靠它覆盖，因此保留 `as never` 语义。
 */
export const emptyGlobalInvitePage: GlobalAllowlistWire = {} as never

/** `addToInvite{Allow,Block}list()` 响应 */
export function makeGlobalInviteAddResult(
  kind: GlobalInviteListKind,
  overrides: Partial<GlobalListAddWire> = {}
): GlobalListAddWire {
  return {
    status: 'ok',
    action: kind === 'allowlist' ? 'add_global_invite_allowlist_user' : 'add_global_invite_blocklist_user',
    user_id: '@a:example.org',
    already_present: false,
    removed_from_other_list: false,
    ...overrides
  }
}

/** `removeFromInvite{Allow,Block}list()` 响应 */
export function makeGlobalInviteRemoveResult(
  kind: GlobalInviteListKind,
  overrides: Partial<GlobalListRemoveWire> = {}
): GlobalListRemoveWire {
  return {
    status: 'ok',
    action: kind === 'allowlist' ? 'remove_global_invite_allowlist_user' : 'remove_global_invite_blocklist_user',
    user_id: '@a:example.org',
    already_absent: false,
    ...overrides
  }
}
