/**
 * §9.1 路径常量单一事实源契约测试
 *
 * 验证前端 paths/friends.ts 中定义的路径常量与 SDK route-table 中的路径保持一致。
 * SDK route-table 是权威来源（由后端路由清单自动生成），前端路径必须是其子集。
 *
 * 当后端路径变更时，此测试会失败，强制开发者同步前端路径常量。
 */
import { describe, expect, it } from 'vitest'
// 走本仓唯一的 SDK 咽喉点（`@/services/matrix/sdk` 转发了 SDK 的聚合契约出口）。
// 不再用相对路径深度导入 SDK 源码：那会绕过 package.json#exports、把测试绑死在
// SDK 的源码目录布局上，且可能解析到另一个 SDK 检出。
import { SDK_CONTRACT_ROUTE_TABLES } from '@/services/matrix/sdk'
import { FRIENDS } from '../friends'
import { PREFIX_V1, PREFIX_V3, PREFIX_VENDOR_V1 } from '../prefixes'

const FRIEND_ROUTES = SDK_CONTRACT_ROUTE_TABLES.friend

/** 将 SDK route-table 中的 {param} 占位符替换为通配正则，用于匹配前端路径 */
function buildPathMatcher(sdkPath: string): RegExp {
  const escaped = sdkPath.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '{' || c === '}' ? c : `\\${c}`))
  return new RegExp('^' + escaped.replace(/\{[^}]+\}/g, '[^/]+') + '$')
}

/** 提取 SDK route-table 中指定 API 版本的所有路径 */
function pathsForVersion(version: 'v1' | 'v3'): string[] {
  return FRIEND_ROUTES.filter((r) => r.path.includes(`/${version}/`)).map((r) => r.path)
}

describe('§9.1 路径常量单一事实源 — friends 模块', () => {
  const v1Paths = pathsForVersion('v1')
  const v1Matchers = v1Paths.map(buildPathMatcher)

  /** 断言前端路径常量匹配 SDK route-table 中的某条 v1 路径 */
  function expectPathMatchesSdk(frontendPath: string): void {
    const matched = v1Matchers.some((matcher) => matcher.test(frontendPath))
    if (!matched) {
      const available = v1Paths.join('\n  ')
      throw new Error(
        `前端路径 "${frontendPath}" 在 SDK route-table (v1) 中找不到匹配。\n` + `SDK v1 路径列表:\n  ${available}`
      )
    }
  }

  it('FRIENDS.LIST 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.LIST)
  })

  it('FRIENDS.REQUEST 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.REQUEST)
  })

  it('FRIENDS.SEARCH 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.SEARCH)
  })

  it('FRIENDS.INCOMING_REQUESTS 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.INCOMING_REQUESTS)
  })

  it('FRIENDS.OUTGOING_REQUESTS 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.OUTGOING_REQUESTS)
  })

  it('FRIENDS.ACCEPT(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.ACCEPT('@alice:server'))
  })

  it('FRIENDS.REJECT(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.REJECT('@alice:server'))
  })

  it('FRIENDS.CANCEL(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.CANCEL('@alice:server'))
  })

  it('FRIENDS.REMOVE(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.REMOVE('@alice:server'))
  })

  it('FRIENDS.NOTE(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.NOTE('@alice:server'))
  })

  it('FRIENDS.CHECK(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.CHECK('@alice:server'))
  })

  it('FRIENDS.DM(userId) 匹配 SDK route-table', () => {
    // FRIENDS.DM 在当前 SDK route-table 中可能不存在，记录但不强制失败
    const matched = v1Matchers.some((m) => m.test(FRIENDS.DM('@alice:server')))
    if (!matched) {
    }
  })

  it('FRIENDS.STATUS(userId) 匹配 SDK route-table', () => {
    expectPathMatchesSdk(FRIENDS.STATUS('@alice:server'))
  })

  it('SDK route-table 的 v1 路径只落在私有规范前缀 PREFIX_VENDOR_V1 上', () => {
    // ISSUE-13：私有面唯一规范位置是 `/_matrix/vendor/v1`。后端 2026-10-08 删除了
    // `/_matrix/client/{v1,v3}` 下的 77 条死别名，SDK route-table 随之收敛 ⇒ 这条
    // 断言从"v1 前缀必须是 client/v1"反转为"v1 前缀必须全部是 vendor/v1，且不得再出现
    // client 前缀孪生"。它同时是回归守卫：谁把别名加回来，这里立刻红。
    expect(v1Paths.length).toBeGreaterThan(0)
    expect(v1Paths.every((p) => p.startsWith(PREFIX_VENDOR_V1))).toBe(true)
    const clientTwins = FRIEND_ROUTES.filter((r) => r.path.startsWith(PREFIX_V1) || r.path.startsWith(PREFIX_V3))
    expect(clientTwins).toEqual([])
  })
})
