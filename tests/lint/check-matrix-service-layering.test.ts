import { describe, expect, it } from 'vitest'
import { buildRuntimeGraph, countLogicalServices, scan } from '../../scripts/check-matrix-service-layering.mjs'

/**
 * 守卫单测：`check-matrix-service-layering` 的 L6「逻辑服务数」。
 *
 * 背景（OPS_ARTIFACTS/PROJECT_DIAGNOSIS_2026-11-19.md §4 阶段 3）：
 * `check:file-size` 逼出的 mixin / helpers 拆分曾被判成「服务文件数增长」，
 * 两个门禁互斥。L6 改为按逻辑服务计数后，本测试锁住两条边界行为：
 *   1. 既有服务的拆分产物归入服务根，不触发增长；
 *   2. 新增服务根或无人引用的孤立模块仍会触发增长。
 */

const makeFiles = (entries: Array<[string, string?]>): Array<{ path: string; content: string }> =>
  entries.map(([filePath, content]) => ({ path: filePath, content: content ?? '' }))

describe('countLogicalServices', () => {
  it('mixin / helper 拆分归入服务根，只计 1 个逻辑服务', () => {
    const files = makeFiles([
      ['room/QueryService.ts', "import './QueryMethods'\nimport './roomHelpers'"],
      ['room/QueryMethods.ts', "import './roomHelpers'"],
      ['room/roomHelpers.ts', '']
    ])

    expect(countLogicalServices(files, buildRuntimeGraph(files))).toEqual({
      logical_services: 1,
      service_roots: 1,
      orphan_modules: 0
    })
  })

  it('新增服务根与孤立模块各计 1', () => {
    const files = makeFiles([
      ['room/QueryService.ts', ''],
      ['room/NewService.ts', ''],
      ['room/orphan.ts', '']
    ])

    expect(countLogicalServices(files, buildRuntimeGraph(files))).toEqual({
      logical_services: 3,
      service_roots: 2,
      orphan_modules: 1
    })
  })
})

describe('scan L6 判据', () => {
  it('新增服务根 ⇒ logical-service-growth', () => {
    const baseline = { counters: { logical_services: 1 }, token_read_sites: {} }
    const files = makeFiles([
      ['room/QueryService.ts', ''],
      ['room/NewService.ts', '']
    ])

    const result = scan(files, baseline)

    expect(result.ok).toBe(false)
    expect(result.violations.map((v: { kind: string }) => v.kind)).toContain('logical-service-growth')
  })

  it('旧基线只有 service_files 时退化为物理文件数比较（不静默放宽）', () => {
    const baseline = { counters: { service_files: 1 }, token_read_sites: {} }
    const files = makeFiles([
      ['room/QueryService.ts', ''],
      ['room/NewService.ts', '']
    ])

    const result = scan(files, baseline)

    expect(result.violations.map((v: { kind: string }) => v.kind)).toContain('logical-service-growth')
  })
})
