/**
 * Task 5: updater tauriKey 外置 — 纯函数注入逻辑单元测试。
 *
 * 验证 `scripts/updater-config.js` 的 `buildUpdaterConfigOverride`：
 * 1. 无 key（undefined / 空串 / 空白）时返回 null（跳过 --config 注入，不崩溃）。
 * 2. 有 key 时返回 `plugins.updater.endpoints` 完整数组，占位符被真实 key 替换。
 * 3. 第二个 gitee fallback 端点保持不变。
 */
import { describe, expect, it } from 'vitest'
import { buildUpdaterConfigOverride, UPDATER_ENDPOINTS, UPDATER_KEY_PLACEHOLDER } from '../../scripts/updater-config.js'

const KEY = 'test-tauri-key-not-real'

describe('buildUpdaterConfigOverride', () => {
  it('无 key 时返回 null（不注入 --config）', () => {
    expect(buildUpdaterConfigOverride(undefined)).toBeNull()
    expect(buildUpdaterConfigOverride('')).toBeNull()
    expect(buildUpdaterConfigOverride('   ')).toBeNull()
    expect(buildUpdaterConfigOverride(123 as unknown as string)).toBeNull()
  })

  it('有 key 时生成完整 endpoints 覆盖，占位符被替换', () => {
    const override = buildUpdaterConfigOverride(KEY)
    expect(override).not.toBeNull()
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(Array.isArray(endpoints)).toBe(true)
    expect(endpoints.length).toBe(UPDATER_ENDPOINTS.length)
    expect(endpoints[0]).toContain(`tauriKey=${KEY}`)
    expect(endpoints[0]).not.toContain(UPDATER_KEY_PLACEHOLDER)
  })

  it('第二个 gitee fallback 端点保持不变', () => {
    const override = buildUpdaterConfigOverride(KEY)
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(endpoints[1]).toBe('https://gitee.com/llangkebo/hula/releases/download/latest/latest.json')
  })

  it('覆盖端点中不含任何残留占位符', () => {
    const override = buildUpdaterConfigOverride(KEY)
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(endpoints.some((url) => url.includes(UPDATER_KEY_PLACEHOLDER))).toBe(false)
  })

  it('key 会被 trim', () => {
    const override = buildUpdaterConfigOverride(`  ${KEY}  `)
    const endpoints = override?.plugins?.updater?.endpoints as string[]
    expect(endpoints[0]).toContain(`tauriKey=${KEY}`)
    expect(endpoints[0]).not.toContain('tauriKey=%20')
  })
})
