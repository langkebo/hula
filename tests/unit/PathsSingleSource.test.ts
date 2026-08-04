/**
 * Task 15: 路径常量单一事实源测试
 *
 * 验证：
 * 1. `sdk-paths.ts` 成功从 matrix-js-sdk 的 `__generated__/route-table` 导入并 re-export 路由常量。
 * 2. `paths/index.ts` 从 `sdk-paths` re-export，使 SDK 路由常量可通过 `paths/index` 访问。
 * 3. 至少 3 个前端结构化路径（`MATRIX_PATHS`）能在 SDK route-table 中找到匹配。
 *
 * 本测试不要求 100% 覆盖，仅做实用性校验。模块级逐路径对齐由
 * `src/services/matrix/paths/__tests__/friends.contract.test.ts` 等契约测试保证。
 */
import { describe, expect, it } from 'vitest'
import { FRIENDS } from '@/services/matrix/paths/friends'
import { MATRIX_PATHS } from '@/services/matrix/paths/index'
import { FRIEND_PATHS, ROOM_PATHS, SDK_PATHS, validateTjgPath, WIDGET_PATHS } from '@/services/matrix/paths/sdk-paths'

describe('Paths single source of truth', () => {
  it('sdk-paths imports from matrix-js-sdk route-table', () => {
    expect(ROOM_PATHS).toBeDefined()
    expect(FRIEND_PATHS).toBeDefined()
    expect(WIDGET_PATHS).toBeDefined()
    expect(Array.isArray(ROOM_PATHS)).toBe(true)
    expect(ROOM_PATHS.length).toBeGreaterThan(0)
    // 确认是从 SDK route-table 来的结构，每项包含 method 与 path
    expect(ROOM_PATHS[0]).toHaveProperty('method')
    expect(ROOM_PATHS[0]).toHaveProperty('path')
  })

  it('SDK_PATHS 聚合多个模块路由', () => {
    expect(Array.isArray(SDK_PATHS)).toBe(true)
    expect(SDK_PATHS.length).toBeGreaterThan(0)
    const paths = SDK_PATHS.map((r) => r.path)
    expect(paths.some((p) => p.includes('/friends'))).toBe(true)
    expect(paths.some((p) => p.includes('/rooms'))).toBe(true)
    expect(paths.some((p) => p.includes('/widgets'))).toBe(true)
  })

  it('paths/index.ts re-exports from sdk-paths', async () => {
    const pathsModule = await import('@/services/matrix/paths/index')
    // MATRIX_PATHS（前端 ergonomic 视图）仍可用
    expect(pathsModule.MATRIX_PATHS).toBeDefined()
    // SDK_PATHS 通过 re-export 可从 index 访问
    expect(pathsModule.SDK_PATHS).toBeDefined()
    expect(Array.isArray(pathsModule.SDK_PATHS)).toBe(true)
    expect(pathsModule.SDK_PATHS.length).toBeGreaterThan(0)
  })

  it('validateTjgPath 校验前端路径是否存在于 SDK route-table', () => {
    // 命中：FRIENDS.LIST = /_matrix/client/v1/friends 存在于 SDK v1 路由
    expect(validateTjgPath(FRIENDS.LIST)).toBe(true)
    // 命中：模板路径 FRIENDS.ACCEPT(userId) 匹配 SDK 的 /friends/request/{user_id}/accept
    expect(validateTjgPath(FRIENDS.ACCEPT('@alice:server'))).toBe(true)
    // 不命中：虚构路径
    expect(validateTjgPath('/_matrix/client/v1/this/path/does/not/exist')).toBe(false)
  })

  it('至少 3 个前端结构化路径匹配 SDK route-table', () => {
    const candidates = [
      FRIENDS.LIST,
      FRIENDS.REQUEST,
      FRIENDS.SEARCH,
      FRIENDS.INCOMING_REQUESTS,
      FRIENDS.OUTGOING_REQUESTS,
      FRIENDS.ACCEPT('@alice:server'),
      FRIENDS.REJECT('@alice:server'),
      FRIENDS.STATUS('@alice:server')
    ]
    const matched = candidates.filter(validateTjgPath)
    expect(matched.length).toBeGreaterThanOrEqual(3)
  })

  it('MATRIX_PATHS 结构化对象保持可用（不破坏既有导入）', () => {
    expect(MATRIX_PATHS.FRIENDS).toBeDefined()
    expect(MATRIX_PATHS.ROOM).toBeDefined()
    expect(typeof MATRIX_PATHS.FRIENDS.LIST).toBe('string')
  })
})
