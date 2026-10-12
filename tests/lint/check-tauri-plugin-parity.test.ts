import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CORE_PAIR,
  evaluateTauriPluginParity,
  majorMinor,
  parseCargoLock
} from '../../scripts/check-tauri-plugin-parity.mjs'

const projectRoot = join(__dirname, '..', '..')

function versions(entries: Record<string, string>) {
  return new Map(Object.entries(entries))
}

describe('check-tauri-plugin-parity: majorMinor', () => {
  it('取 major.minor（判据单位）', () => {
    expect(majorMinor('2.3.3')).toBe('2.3')
    expect(majorMinor('2.6.0')).toBe('2.6')
    expect(majorMinor(' 2.11.5 ')).toBe('2.11')
  })

  it('非法输入返回 null（不抛错）', () => {
    expect(majorMinor('')).toBeNull()
    expect(majorMinor('abc')).toBeNull()
    expect(majorMinor(undefined)).toBeNull()
  })
})

describe('check-tauri-plugin-parity: parseCargoLock', () => {
  it('解析 [[package]] 段的 name/version', () => {
    const lock = [
      'version = 4',
      '[[package]]',
      'name = "tauri"',
      'version = "2.11.5"',
      'source = "registry+https://github.com/rust-lang/crates.io-index"',
      '',
      '[[package]]',
      'name = "tauri-plugin-notification"',
      'version = "2.4.0"'
    ].join('\n')

    const parsed = parseCargoLock(lock)

    expect(parsed.get('tauri')).toBe('2.11.5')
    expect(parsed.get('tauri-plugin-notification')).toBe('2.4.0')
  })

  it('缺 name 或 version 的段被忽略（不产生半条记录）', () => {
    const parsed = parseCargoLock('[[package]]\nversion = "1.0.0"\n\n[[package]]\nname = "x"\n')
    expect(parsed.size).toBe(0)
  })
})

describe('check-tauri-plugin-parity: evaluateTauriPluginParity', () => {
  const basePkg = {
    dependencies: {
      '@tauri-apps/api': '2.11.1',
      '@tauri-apps/plugin-notification': '2.4.0'
    }
  }

  it('两侧同 major.minor ⇒ 通过', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({ tauri: '2.11.5', 'tauri-plugin-notification': '2.4.0' }),
      pkg: basePkg
    })

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('major.minor 漂移 ⇒ 判红并报出两侧版本（本次修复的形态）', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({ tauri: '2.11.5', 'tauri-plugin-notification': '2.3.3' }),
      pkg: basePkg
    })

    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({
      rust: 'tauri-plugin-notification',
      js: '@tauri-apps/plugin-notification',
      rustVersion: '2.3.3',
      jsVersion: '2.4.0',
      rustMM: '2.3',
      jsMM: '2.4',
      reason: 'major-minor-drift'
    })
  })

  it('core 也按 major.minor 判（tauri ↔ @tauri-apps/api）', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({ tauri: '2.12.3', 'tauri-plugin-notification': '2.4.0' }),
      pkg: basePkg
    })

    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatchObject({ kind: 'core', rust: CORE_PAIR.rust, js: CORE_PAIR.js })
  })

  it('同 major.minor 但 patch 不同 ⇒ 通过并记 INFO（不过度收紧到比工具链更严）', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({ tauri: '2.11.5', 'tauri-plugin-notification': '2.4.1' }),
      pkg: { dependencies: { ...basePkg.dependencies, '@tauri-apps/plugin-notification': '2.4.0' } }
    })

    expect(result.ok).toBe(true)
    expect(result.info.some((line) => line.includes('patch 不同'))).toBe(true)
  })

  it('仅 Rust 侧存在的插件 ⇒ 不判错（INFO）', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({
        tauri: '2.11.5',
        'tauri-plugin-notification': '2.4.0',
        'tauri-plugin-single-instance': '2.4.3'
      }),
      pkg: basePkg
    })

    expect(result.ok).toBe(true)
    expect(result.info.some((line) => line.includes('tauri-plugin-single-instance'))).toBe(true)
  })

  it('仅 JS 侧存在的包 ⇒ 不判错（INFO）', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({ tauri: '2.11.5', 'tauri-plugin-notification': '2.4.0' }),
      pkg: { dependencies: { ...basePkg.dependencies, '@tauri-apps/plugin-store': '2.4.2' } }
    })

    expect(result.ok).toBe(true)
    expect(result.info.some((line) => line.includes('@tauri-apps/plugin-store'))).toBe(true)
  })

  it('一侧缺版本号 ⇒ 判错（不得静默跳过）', () => {
    const result = evaluateTauriPluginParity({
      lockVersions: versions({ tauri: '2.11.5', 'tauri-plugin-notification': '2.4.0' }),
      pkg: { dependencies: { '@tauri-apps/api': '2.11.1', '@tauri-apps/plugin-notification': '' } }
    })

    expect(result.ok).toBe(false)
    expect(result.errors[0].reason).toBe('missing-version')
  })

  it('空输入不抛错，但 checked 为 0（调用方据此做基数断言）', () => {
    const result = evaluateTauriPluginParity({})
    expect(result.checked).toBe(0)
    expect(result.ok).toBe(true)
  })
})

describe('check-tauri-plugin-parity: 真实仓库自洽', () => {
  it('Cargo.lock 与 package.json 的 core + 插件 major.minor 一致', () => {
    const lockVersions = parseCargoLock(readFileSync(join(projectRoot, 'src-tauri', 'Cargo.lock'), 'utf8'))
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))

    const result = evaluateTauriPluginParity({ lockVersions, pkg })

    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    // 基数断言：确实比对到了一批对子（否则"通过"可能是没扫到）
    expect(result.checked).toBeGreaterThanOrEqual(10)
  })

  it('回归锁：notification 两侧同为 2.4（此前 Rust 2.3.3 ↔ JS 2.4.0 漂移）', () => {
    const lockVersions = parseCargoLock(readFileSync(join(projectRoot, 'src-tauri', 'Cargo.lock'), 'utf8'))
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))

    expect(lockVersions.get('tauri-plugin-notification')).toBe('2.4.0')
    expect(pkg.dependencies['@tauri-apps/plugin-notification']).toBe('2.4.0')
  })
})
