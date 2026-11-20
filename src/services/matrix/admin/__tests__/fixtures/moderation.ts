/**
 * admin 内容审核域测试夹具。
 *
 * 类型来自 `AdminTypes.ts` 的 `ContentFilter`，该接口逐字对照
 * `ModerationManager.addContentFilter()` 的真实返回形状：
 * `id` / `type` / `pattern` / `action` / `enabled` / `createdAt` / `updatedAt` / `hitCount`
 * 均为必填。旧测试 mock `{ id: 'f1' }`，与服务契约不符（缺 7 个必填键）。
 */
import type { ContentFilter } from '@/services/matrix/admin/AdminTypes'

/** 生成 `addContentFilter()` 返回的完整内容过滤器。 */
export function makeContentFilter(overrides: Partial<ContentFilter> = {}): ContentFilter {
  return {
    id: 'f1',
    type: 'keyword',
    pattern: 'badword',
    action: 'flag',
    enabled: true,
    createdAt: 1795000000000,
    updatedAt: 1795000000000,
    hitCount: 0,
    ...overrides
  }
}
