import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectLabels,
  evaluateWindowRegistry,
  parseRegistries,
  WINDOW_LABELS_FILE
} from '../../scripts/check-window-label-registry.mjs'

/**
 * 守卫单测：`check-window-label-registry`。
 *
 * 目标（图谱 §8.5 B1）：新增窗口 label 若忘记归类，会静默多跑一套 Matrix 运行时。
 * 本测试同时锁住实现过程中实测踩到的两个缺陷：
 *  ① `parseRegistries` 曾把**注释里**的示例字符串当成登记项（stale 列表里出现 `'可跳过'`）；
 *  ② tauri conf 的 `windows[].label` 从未被采集（`mobile-home` 被判为 stale）。
 */

describe('check-window-label-registry: parseRegistries', () => {
  const source = [
    'export const NON_MATRIX_WINDOW_LABELS = new Set([',
    "  'capture',",
    "  'tray', // 注释里的假条目 'not-a-label' 不应被采纳",
    '])',
    '',
    '/**',
    " * 动态：`'windowChat--${roomId}'` 属注释示例",
    ' */',
    'export const MATRIX_WINDOW_LABELS = new Set([',
    "  'home',",
    "  'windowChat--',",
    '])'
  ].join('\n')

  it('解析两个 Set 的成员', () => {
    const { matrix, nonMatrix } = parseRegistries(source)
    expect(nonMatrix).toEqual(['capture', 'tray'])
    expect(matrix).toEqual(['home', 'windowChat--'])
  })

  it('回归锁：注释里的引号字符串不得被当成登记项（实测踩过）', () => {
    const { matrix, nonMatrix } = parseRegistries(source)
    expect([...matrix, ...nonMatrix]).not.toContain('not-a-label')
    expect([...matrix, ...nonMatrix].some((x) => x.includes('$'))).toBe(false)
  })

  it('两个 Set 都不存在时返回空数组（不抛错）', () => {
    expect(parseRegistries('export const X = 1')).toEqual({ matrix: [], nonMatrix: [] })
  })
})

describe('check-window-label-registry: collectLabels', () => {
  it('收集前端字面量创建点 / Rust 构建器 / tauri conf 的 windowLabel / 动态前缀', () => {
    const { labels, prefixes } = collectLabels([
      { path: 'src/App.vue', content: "createWebviewWindow(t('x'), 'update', 400, 300)" },
      { path: 'src/a.ts', content: "const w = new WebviewWindow('imageViewer', {})" },
      {
        path: 'src-tauri/src/desktops/tray.rs',
        content: 'WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("/tray".into()))'
      },
      { path: 'src-tauri/tauri.macos.conf.json', content: 'windowLabel:"login"' },
      {
        path: 'src/composables/chat/useIndependentChatWindow.ts',
        content: "const WINDOW_LABEL_PREFIX = 'windowChat--'"
      }
    ])

    expect([...labels.keys()].sort()).toEqual(['imageViewer', 'login', 'tray', 'update'])
    expect([...prefixes]).toEqual(['windowChat--'])
  })

  it('模板串（含 $ 插值）不被当作具体 label', () => {
    const { labels } = collectLabels([
      { path: 'src/a.ts', content: 'new WebviewWindow(`${EventEnum.MULTI_MSG}${id}`, {})' }
    ])
    expect(labels.size).toBe(0)
  })
})

describe('check-window-label-registry: evaluateWindowRegistry', () => {
  const registries = { matrix: ['home', 'windowChat--'], nonMatrix: ['tray'] }

  it('全部已分类 ⇒ ok', () => {
    const result = evaluateWindowRegistry({
      labels: new Map([
        ['home', ['src/a.ts']],
        ['tray', ['src/b.rs']]
      ]),
      prefixes: new Set(['windowChat--']),
      registries
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.collectedLabels).toBe(2)
  })

  it('未分类 label ⇒ 违规并给出来源（这是"新增窗口忘登记"的拦截面）', () => {
    const result = evaluateWindowRegistry({
      labels: new Map([['brandNewWindow', ['src/new.ts']]]),
      prefixes: new Set(),
      registries
    })

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({ kind: 'unclassified', label: 'brandNewWindow', from: ['src/new.ts'] })
  })

  it('两个名单都登记 ⇒ 违规（直接查交集：不依赖该 label 是否被采集到）', () => {
    const result = evaluateWindowRegistry({
      labels: new Map(),
      prefixes: new Set(),
      registries: { matrix: ['home'], nonMatrix: ['home'] }
    })

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({ kind: 'both-registries', label: 'home' })
  })

  it('动态前缀无对应登记项 ⇒ 违规', () => {
    const result = evaluateWindowRegistry({
      labels: new Map(),
      prefixes: new Set(['chatWindow--']),
      registries
    })

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({ kind: 'prefix-not-registered', label: 'chatWindow--' })
  })

  it('登记项不再有静态来源 ⇒ 仅提示（stale），不判红', () => {
    // prefixes 为空时，登记的前缀条目 `windowChat--` 同样无来源 ⇒ 一并计入 stale
    const result = evaluateWindowRegistry({ labels: new Map(), prefixes: new Set(), registries })
    expect(result.ok).toBe(true)
    expect(result.stale).toEqual(['home', 'tray', 'windowChat--'])
  })

  it('空输入不抛错（调用方靠基数断言拦「空扫」）', () => {
    const result = evaluateWindowRegistry({})
    expect(result.collectedLabels).toBe(0)
  })
})

describe('check-window-label-registry: 真实仓库自洽', () => {
  const repoRoot = join(__dirname, '..', '..')

  it('windowLabels.ts 的两份名单互斥且不含注释泄漏/模板串', () => {
    const { matrix, nonMatrix } = parseRegistries(readFileSync(join(repoRoot, WINDOW_LABELS_FILE), 'utf8'))

    expect(matrix.length).toBeGreaterThanOrEqual(8)
    expect(nonMatrix.length).toBeGreaterThanOrEqual(4)
    for (const label of [...matrix, ...nonMatrix]) {
      expect(label, `label=${label}`).not.toContain('$')
      // 注释泄漏的典型特征：整条是说明文字而非 label
      expect(/^[A-Za-z][\w-]*$/.test(label), `label=${label} 不像窗口 label`).toBe(true)
    }
    expect(matrix.filter((l) => nonMatrix.includes(l))).toEqual([])
  })

  it('已登记的 5 个"跳过运行时"窗口与 App.vue 的判据一致（名单被真正使用）', () => {
    const appVue = readFileSync(join(repoRoot, 'src/App.vue'), 'utf8')
    const { nonMatrix } = parseRegistries(readFileSync(join(repoRoot, WINDOW_LABELS_FILE), 'utf8'))

    expect(appVue).toContain('isNonMatrixWindow')
    expect(nonMatrix).toEqual(['capture', 'tray', 'notify', 'update', 'checkupdate'])
  })
})
