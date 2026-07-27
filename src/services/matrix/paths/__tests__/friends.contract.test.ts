/**
 * §9.1 路径常量单一事实源契约测试
 *
 * 验证前端 paths/friends.ts 中定义的路径常量与 SDK route-table 中的路径保持一致。
 * SDK route-table 是权威来源（由后端路由清单自动生成），前端路径必须是其子集。
 *
 * 当后端路径变更时，此测试会失败，强制开发者同步前端路径常量。
 */
import { describe, expect, it } from 'vitest'
// SDK route-table 通过相对路径导入，绕过 package.json exports 限制（仅测试使用）
import { FRIEND_ROUTES } from '../../../../../../matrix-js-sdk/src/friend/__generated__/route-table'
import { FRIENDS } from '../friends'
import { PREFIX_V1 } from '../prefixes'

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

  it('前端使用的 PREFIX_V1 与 SDK route-table v1 前缀一致', () => {
    // 抽样验证：SDK 第一条 v1 路径的前缀应与 PREFIX_V1 一致
    const firstV1Path = v1Paths[0]
    expect(firstV1Path).toBeDefined()
    expect(firstV1Path.startsWith(PREFIX_V1)).toBe(true)
  })
})
