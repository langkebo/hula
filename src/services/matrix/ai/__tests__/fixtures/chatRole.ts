/**
 * ChatRole 域测试夹具。
 *
 * 类型来源是 `ChatRoleService` 自己导出的真实契约：
 * - `ChatRole`：服务层具名导出，`id / name / avatar / category / sort /
 *   description / systemMessage / publicStatus / status` 均为必填；
 * - 分页壳与分类项：从 `page()` / `categoryList()` 方法签名推导。
 *
 * 手写字面量缺字段（如 `{ id, name }`）会被 `vue-tsc` 直接拦下。
 */
import type { ChatRole, chatRoleService } from '../../ChatRoleService'

export type ChatRolePageFixture = Awaited<ReturnType<typeof chatRoleService.page>>
export type ChatRoleCategoryFixture = Awaited<ReturnType<typeof chatRoleService.categoryList>>[number]

export function makeChatRole(overrides: Partial<ChatRole> = {}): ChatRole {
  return {
    id: 'r1',
    name: '助手',
    avatar: 'a.png',
    category: '助手',
    sort: 1,
    description: 'desc',
    systemMessage: 'sys',
    publicStatus: true,
    status: 1,
    ...overrides
  }
}

/** `page()` 的返回壳：`{ list, total }`。 */
export function makeChatRolePage(overrides: Partial<ChatRolePageFixture> = {}): ChatRolePageFixture {
  return { list: [], total: 0, ...overrides }
}

/** `categoryList()` 的单项：`{ label, value }`。 */
export function makeChatRoleCategory(overrides: Partial<ChatRoleCategoryFixture> = {}): ChatRoleCategoryFixture {
  return { label: '助手', value: 'assistant', ...overrides }
}
