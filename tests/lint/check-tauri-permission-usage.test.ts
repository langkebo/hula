import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectGrantedPermissions,
  evaluatePermissionUsage,
  PERMISSION_RULES
} from '../../scripts/check-tauri-permission-usage.mjs'

const projectRoot = join(__dirname, '..', '..')
const capabilitiesDir = join(projectRoot, 'src-tauri', 'capabilities')

function loadCapabilities() {
  const capabilities: Record<string, unknown> = {}
  for (const entry of readdirSync(capabilitiesDir)) {
    if (!entry.endsWith('.json')) continue
    capabilities[entry] = JSON.parse(readFileSync(join(capabilitiesDir, entry), 'utf8'))
  }
  return capabilities
}

const DESTROY_RULE = PERMISSION_RULES.find((rule) => rule.permission === 'core:window:allow-destroy')!

describe('check-tauri-permission-usage: collectGrantedPermissions', () => {
  it('同时收集字符串项与带 scope 的对象项', () => {
    const granted = collectGrantedPermissions({
      'a.json': {
        permissions: [
          'core:default',
          'core:window:allow-destroy',
          { identifier: 'http:default', allow: [{ url: 'https://x.test' }] }
        ]
      }
    })
    expect([...granted].sort()).toEqual(['core:default', 'core:window:allow-destroy', 'http:default'])
  })

  it('空输入返回空集合（不抛错）', () => {
    expect(collectGrantedPermissions({}).size).toBe(0)
    expect(collectGrantedPermissions(undefined).size).toBe(0)
  })
})

describe('check-tauri-permission-usage: evaluatePermissionUsage', () => {
  it('用到且已授权 ⇒ 通过', () => {
    const result = evaluatePermissionUsage({
      sources: { 'src/a.ts': 'await win.onCloseRequested(() => {})' },
      capabilities: { 'default.json': { permissions: ['core:window:allow-destroy'] } },
      rules: [DESTROY_RULE]
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.checked).toEqual(['core:window:allow-destroy'])
  })

  it('用到但未授权 ⇒ 判红，且报出全部调用点与理由', () => {
    const result = evaluatePermissionUsage({
      sources: {
        'src/a.ts': 'await win.onCloseRequested(() => {})',
        'src/b.vue': 'win.onCloseRequested(async () => {})'
      },
      capabilities: { 'default.json': { permissions: ['core:default'] } },
      rules: [DESTROY_RULE]
    })
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].permission).toBe('core:window:allow-destroy')
    expect(result.violations[0].hits).toEqual(['src/a.ts', 'src/b.vue'])
    expect(result.violations[0].rationale).toContain('destroy')
  })

  it('没用到 ⇒ 不检查该规则（不因"授权了但没人用"判红）', () => {
    const result = evaluatePermissionUsage({
      sources: { 'src/a.ts': 'const x = 1' },
      capabilities: { 'default.json': { permissions: [] } },
      rules: [DESTROY_RULE]
    })
    expect(result.ok).toBe(true)
    expect(result.checked).toEqual([])
  })

  it('不把测试文件里的调用当成生产调用（由调用方过滤，这里锁定过滤后的语义）', () => {
    const result = evaluatePermissionUsage({
      sources: { 'src/a.ts': 'win.onCloseRequested(() => {})' },
      capabilities: {},
      rules: [DESTROY_RULE]
    })
    expect(result.ok).toBe(false)
  })
})

describe('check-tauri-permission-usage: 注册表自洽', () => {
  it('每条规则都带可复现的理由与权限标识', () => {
    expect(PERMISSION_RULES.length).toBeGreaterThan(0)
    for (const rule of PERMISSION_RULES) {
      expect(rule.permission).toMatch(/^[a-z-]+(:[a-z-]+)+$/)
      expect(rule.rationale.length).toBeGreaterThan(10)
      expect(rule.pattern).toBeInstanceOf(RegExp)
    }
  })
})

describe('check-tauri-permission-usage: 真实仓库自洽', () => {
  it('当前仓库：用到且已授权', () => {
    const capabilities = loadCapabilities()
    const granted = collectGrantedPermissions(capabilities)
    // 直接断言"前端用到的能力已授权"，不依赖扫描实现
    expect(granted.has('core:window:allow-destroy')).toBe(true)
  })

  it('回归锁：onCloseRequested 的调用点确实存在（否则 raise 该权限就是纸面规则）', () => {
    const files = [
      'src/composables/common/useTauriListener.ts',
      'src/layout/left/hook.ts',
      'src/composables/common/useGlobalShortcut.ts'
    ]
    const found = files.filter((rel) => /\bonCloseRequested\s*\(/.test(readFileSync(join(projectRoot, rel), 'utf8')))
    expect(found.length).toBe(files.length)
  })
})
