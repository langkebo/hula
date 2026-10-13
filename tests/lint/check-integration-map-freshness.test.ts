import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectActual,
  evaluateFreshness,
  MAP_DOC,
  MARKER_BEGIN,
  MARKER_END,
  parseMarkerBlock
} from '../../scripts/check-integration-map-freshness.mjs'

/**
 * 守卫单测：`check-integration-map-freshness`。
 *
 * 背景（图谱 §8.5 D1）：文档数字会**无声漂移**且原先无门禁 —— 本轮实测差异巨大
 * （路由 1159→1027、私有面 35.2%→51.8%、服务文件 220→215）。本守卫把"引用前重跑"
 * 变成 CI 强制，故其本身必须有测试，否则"绿"可能只是没扫到。
 */
describe('check-integration-map-freshness: parseMarkerBlock', () => {
  it('解析标记块内的 key=value（支持 - / * 前缀与行内注释）', () => {
    const text = [
      '正文里 backend_routes=999 不应被采纳',
      MARKER_BEGIN,
      '- backend_routes=1027',
      '* sdk_version=40.2.0-langkebo.6 # 行内注释',
      'tauri_command_modules=18',
      MARKER_END
    ].join('\n')

    const parsed = parseMarkerBlock(text)

    expect(parsed).toMatchObject({
      backend_routes: '1027',
      sdk_version: '40.2.0-langkebo.6',
      tauri_command_modules: '18'
    })
    expect(parsed.backend_routes).not.toBe('999')
  })

  it('缺少标记块 ⇒ 返回 null（调用方据此 EXIT=2，而不是"通过"）', () => {
    expect(parseMarkerBlock('只有正文 backend_routes=1027')).toBeNull()
  })
})

describe('check-integration-map-freshness: evaluateFreshness', () => {
  it('全部一致 ⇒ ok', () => {
    const result = evaluateFreshness({ documented: { a: '1', b: 'x' }, actual: { a: 1, b: 'x' } })
    expect(result.ok).toBe(true)
    expect(result.mismatches).toEqual([])
  })

  it('数字漂移 ⇒ 判红并给出文档值与实测值（本轮实际发生的形态）', () => {
    const result = evaluateFreshness({ documented: { backend_routes: '1159' }, actual: { backend_routes: 1027 } })

    expect(result.ok).toBe(false)
    expect(result.mismatches[0]).toMatchObject({ key: 'backend_routes', documented: '1159', actual: '1027' })
  })

  it('文档未声明某项 ⇒ 计入 missing（提示而非判红，便于渐进纳入受管）', () => {
    const result = evaluateFreshness({ documented: {}, actual: { new_metric: 7 } })
    expect(result.ok).toBe(true)
    expect(result.missing[0]).toMatchObject({ key: 'new_metric', actual: '7' })
  })
})

describe('check-integration-map-freshness: 真实仓库自洽', () => {
  const repoRoot = join(__dirname, '..', '..')
  // 记忆化：collectActual 要遍历 src + node_modules 的 .d.ts（重），
  // 全量并行跑 tests/lint 时会与其它重型 real-repo 测试抢资源（实测会拖到超时），
  // 故每个测试文件只扫一次。
  let cached: ReturnType<typeof collectActual> | null = null
  const actual = () => (cached ??= collectActual({ root: repoRoot }))

  const SLOW_REAL_REPO_TIMEOUT_MS = 90_000

  it('实测指标全部非零且关键口径正确（基数断言）', { timeout: SLOW_REAL_REPO_TIMEOUT_MS }, () => {
    const metrics = actual()

    expect(metrics.backend_routes).toBeGreaterThan(500)
    expect(metrics.private_routes).toBeGreaterThan(100)
    expect(metrics.private_routes).toBeLessThan(metrics.backend_routes)
    expect(metrics.matrix_service_files).toBeGreaterThan(100)
    expect(metrics.sdk_manager_accessors).toBeGreaterThan(50)
    expect(metrics.tauri_command_modules).toBeGreaterThan(5)
  })

  it('图谱标记块与实时实测一致（否则需重跑 --print 更新文档）', { timeout: SLOW_REAL_REPO_TIMEOUT_MS }, () => {
    const documented = parseMarkerBlock(readFileSync(join(repoRoot, MAP_DOC), 'utf8'))
    expect(documented).toBeTruthy()

    const result = evaluateFreshness({ documented, actual: actual() })

    expect(result.mismatches).toEqual([])
    expect(result.ok).toBe(true)
    // 基数断言：受管项数要够多，避免"只对了两三项"也叫绿
    expect(result.checked).toBeGreaterThanOrEqual(10)
  })
})
