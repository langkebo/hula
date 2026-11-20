/**
 * 邀请策略页签测试夹具。
 *
 * 类型来自 `useAdminInvitePolicy()` 暴露的 `importGlobalUsers` 动作返回值：
 * `{ success: number; failed: number }`。
 */
import type { useAdminInvitePolicy } from '@/composables/admin/useAdminInvitePolicy'

/** `importGlobalUsers()` 的返回值 */
type ImportGlobalUsersResult = Awaited<ReturnType<ReturnType<typeof useAdminInvitePolicy>['importGlobalUsers']>>

/** 生成批量导入用户的统计结果。 */
export function makeImportGlobalUsersResult(success = 0, failed = 0): ImportGlobalUsersResult {
  return { success, failed }
}
