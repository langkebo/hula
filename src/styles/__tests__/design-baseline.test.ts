/**
 * 设计基线（UI 优化方案阶段 1 验收线）契约测试
 *
 * 守护三项在 `UI-OPTIMIZATION-PLAN.md` 阶段 1 里明确定义、但长期未达标的验收口径，
 * 口径逐字取自方案正文：
 * - 1.4 圆角 token 扩展：`border-radius: 1[6-9]px|2[0-9]px` 必须为 0
 * - 1.2 内联样式迁移：核心视图（登录 / 设置 / 首页消息 / 房间组件）`style="` 必须为 0
 * - 1.3 `!important` 优化：reduced-motion 区块之外，每处都必须有解释注释
 *
 * 另加三条配套约束：
 * - 模板内联 `style` 不得携带 `!important`（内联样式无法承载解释注释，且几乎总是冗余）
 * - `src` 下不得残留 `*.bak` 样式备份（`variable.scss.bak` 曾与正式文件长期双轨）
 * - 三个语义圆角别名（`--tjg-radius-surface/panel/sheet`）必须仍被真实引用
 *   （守卫「token 定义了却零调用」这类死代码回归）
 *
 * 反馈循环策略：约束载体是源码文本（happy-dom 无法计算最终层叠结果），
 * 故沿用仓库既有做法（见 `liquid-glass.test.ts`、`components/workbench/__tests__/wave1-visual-consistency.test.ts`）
 * 以源码断言建立 red-capable 循环。计数正则与 CI 侧 `scripts/check-ratchet.mjs`
 * 保持同名同式，避免两套口径漂移。
 *
 * 未覆盖（需人工 / 视觉回归验收）：移除 `!important` 后的真实层叠结果、实际渲染像素。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..')
const SRC = resolve(ROOT, 'src')
const BASELINE_PATH = resolve(ROOT, 'meta/ratchet-baseline.json')

/** 与 `scripts/check-ratchet.mjs` 的 STYLE_EXTENSIONS 对齐 */
const STYLE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.vue', '.scss', '.css', '.mdx'])

/** 与 check-ratchet.mjs 的 hardcoded_radius 同一正则（覆盖 border-*-radius 长写与 border-radius 简写） */
const HARDCODED_RADIUS = /-radius:[^;"}\n]*(?<![\d.])(?:1[6-9]px|2[0-9]px)/g
/** 与 check-ratchet.mjs 的 inline_style 同一正则 */
const STATIC_INLINE_STYLE = /(?<![:\w@-])style\s*=\s*"/g
const INLINE_STYLE_WITH_IMPORTANT = /style\s*=\s*"[^"]*!important/
const COMMENT = /(\/\/|\/\*|\*\/)/
/** 必须带 g 标志：下面用 `exec` 循环收集区块范围，缺 g 会导致 lastIndex 永不前进（死循环） */
const REDUCED_MOTION = /@media[^{]*prefers-reduced-motion[^{]*\{/g
/** 与 check-ratchet.mjs 的 important_css `strip` 保持一致 */
const stripCommentsOnly = (text: string) => text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

/** 方案正文点名的「核心视图」 */
const CORE_VIEW_DIRS = [
  'src/views/loginWindow',
  'src/views/settingsWindow',
  'src/views/homeWindow',
  'src/components/room'
]

interface Source {
  /** 仓库相对路径 */
  path: string
  text: string
}

/**
 * 递归收集源文件。
 * 跳过 `__tests__`（本测试自身的正则字面量不应被计入）与 `*.stories.ts`，
 * 口径与 `check-ratchet.mjs` 的 `isTestPath` 一致。
 */
function collectSources(dir: string, acc: Source[] = []): Source[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__') continue
      collectSources(full, acc)
      continue
    }
    const ext = entry.slice(entry.lastIndexOf('.'))
    if (!STYLE_EXTENSIONS.has(ext)) continue
    if (entry.endsWith('.stories.ts')) continue
    acc.push({ path: relative(ROOT, full), text: readFileSync(full, 'utf-8') })
  }
  return acc
}

const sources = collectSources(SRC)

/** 收集源码中所有「声明位」的 `!important` 行（注释里提到它不算） */
function collectImportantDeclarations(source: Source) {
  const lines = source.text.split('\n')
  const reducedMotionRanges: Array<[number, number]> = []

  let match: RegExpExecArray | null
  REDUCED_MOTION.lastIndex = 0
  while ((match = REDUCED_MOTION.exec(source.text)) !== null) {
    let depth = 1
    let cursor = match.index + match[0].length
    while (cursor < source.text.length && depth > 0) {
      if (source.text[cursor] === '{') depth += 1
      else if (source.text[cursor] === '}') depth -= 1
      cursor += 1
    }
    reducedMotionRanges.push([match.index, cursor])
  }

  const declarations: Array<{ line: number; inReducedMotion: boolean; hasComment: boolean }> = []
  let offset = 0
  lines.forEach((line, index) => {
    const lineStart = offset
    offset += line.length + 1
    if (!line.includes('!important')) return
    const trimmed = line.trim()
    // 注释行本身提到 !important 不计入（本仓大量解释性注释会引用它）
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
    declarations.push({
      line: index + 1,
      inReducedMotion: reducedMotionRanges.some(([start, end]) => start <= lineStart && lineStart < end),
      hasComment: lines.slice(Math.max(0, index - 8), index).some((above) => COMMENT.test(above))
    })
  })
  return declarations
}

const allImportantDeclarations = sources.flatMap((source) =>
  collectImportantDeclarations(source).map((declaration) => ({ source, ...declaration }))
)

describe('1.4 圆角 token 化', () => {
  it('不得存在 16–29px 的硬编码圆角（含 border-*-radius 长写）', () => {
    const offenders: string[] = []

    for (const source of sources) {
      HARDCODED_RADIUS.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = HARDCODED_RADIUS.exec(source.text)) !== null) {
        const line = source.text.slice(0, match.index).split('\n').length
        offenders.push(`${source.path}:${line}  ${match[0].trim()}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('被引用的 --tjg-radius-* 必须都在 design-tokens.css 中有定义（防拼写悬空）', () => {
    const tokens = readFileSync(resolve(SRC, 'styles/css/design-tokens.css'), 'utf-8')
    const defined = new Set(tokens.match(/--tjg-radius-[a-z0-9-]+(?=\s*:)/g) ?? [])
    const used = new Set(sources.flatMap((source) => source.text.match(/var\((--tjg-radius-[a-z0-9-]+)/g) ?? []))
    const dangling = [...new Set([...used].map((usage) => usage.replace('var(', '')))].filter(
      (token) => !defined.has(token)
    )

    expect([...used].length).toBeGreaterThan(0)
    expect(dangling).toEqual([])
  })

  it('三个语义圆角别名必须仍被真实引用（防止 token 定义后零调用）', () => {
    const joined = sources.map((source) => source.text).join('\n')

    for (const token of ['--tjg-radius-surface', '--tjg-radius-panel', '--tjg-radius-sheet']) {
      expect(joined, `${token} 已无任何调用点`).toContain(`var(${token})`)
    }
  })
})

describe('1.2 核心视图内联样式清零', () => {
  it.each(CORE_VIEW_DIRS)('%s 下不得有静态内联 style', (dir) => {
    const offenders: string[] = []

    for (const source of sources) {
      if (!source.path.startsWith(`${dir}/`) || !source.path.endsWith('.vue')) continue
      STATIC_INLINE_STYLE.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = STATIC_INLINE_STYLE.exec(source.text)) !== null) {
        const line = source.text.slice(0, match.index).split('\n').length
        offenders.push(`${source.path}:${line}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('全仓内联 style 计数不得超过 ratchet 基线', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as {
      counters: Record<string, number>
    }
    const actual = sources.reduce((total, source) => {
      if (!source.path.endsWith('.vue')) return total
      return total + (source.text.match(STATIC_INLINE_STYLE)?.length ?? 0)
    }, 0)

    expect(baseline.counters.inline_style, 'ratchet 基线缺少 inline_style').toBeTypeOf('number')
    expect(actual).toBeLessThanOrEqual(baseline.counters.inline_style)
  })
})

describe('1.3 !important 收敛', () => {
  it('reduced-motion 区块之外，每处 !important 都必须有解释注释', () => {
    const unexplained = allImportantDeclarations
      .filter((declaration) => !declaration.inReducedMotion && !declaration.hasComment)
      .map((declaration) => `${declaration.source.path}:${declaration.line}`)

    expect(unexplained).toEqual([])
  })

  it('总量不得超过 ratchet 基线', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as {
      counters: Record<string, number>
    }
    // 与 check-ratchet.mjs 同一口径：先剥注释再按出现次数计
    const actual = sources.reduce(
      (total, source) => total + (stripCommentsOnly(source.text).match(/!important/g)?.length ?? 0),
      0
    )

    expect(baseline.counters.important_css, 'ratchet 基线缺少 important_css').toBeTypeOf('number')
    expect(actual).toBeLessThanOrEqual(baseline.counters.important_css)
  })

  it('模板内联 style 不得携带 !important（无法承载解释注释）', () => {
    const offenders = sources
      .filter((source) => INLINE_STYLE_WITH_IMPORTANT.test(source.text))
      .map((source) => source.path)

    expect(offenders).toEqual([])
  })
})

describe('配套约束', () => {
  it('样式备份文件必须被 .gitignore 忽略（防止 *.bak 混入仓库）', () => {
    // 仓库里存在其它会话留下的忽略型草稿备份（git status 不可见），
    // 因此这里守护的是「不可能被提交」这一真正不变量，而非「文件不存在」。
    const gitignore = readFileSync(resolve(ROOT, '.gitignore'), 'utf-8')
    const lines = gitignore.split('\n').map((line) => line.trim())

    expect(lines, '.gitignore 未忽略 *.bak').toContain('*.bak')
  })

  it('`design-tokens.css` 必须定义三个语义圆角别名', () => {
    const tokens = readFileSync(resolve(SRC, 'styles/css/design-tokens.css'), 'utf-8')

    for (const alias of ['--tjg-radius-surface:', '--tjg-radius-panel:', '--tjg-radius-sheet:']) {
      expect(tokens, `缺少 ${alias}`).toContain(alias)
    }
  })

  it('测试文件自身位于 __tests__ 之外时会被扫描（自检：收集器未失效）', () => {
    expect(sources.length).toBeGreaterThan(100)
    expect(sources.some((source) => source.path.includes('__tests__'))).toBe(false)
    expect(existsSync(BASELINE_PATH)).toBe(true)
  })
})

describe('模板属性卫生（vue-tsc 盲区）', () => {
  /**
   * 重复的「静态」属性会在 SFC 编译期直接抛 `SyntaxError: Duplicate attribute`，
   * 被该 SFC 的 import 链连坐的整个测试文件都收集失败（`(0 test)`），组件也彻底无法挂载。
   * 但 `vue-tsc --noEmit` **不校验模板属性唯一性**，所以类型门禁对此完全失明——
   * 只有在组件恰好被测试渲染时才会暴露。
   *
   * 由来（2026-09-20）：1.2 内联样式迁移把 `RoomDetailStats.vue` 的
   * `style="grid-template-columns: repeat(3, 1fr)"` 换成 UnoCSS 类时，
   * 误写成了第二个 `class` 属性 → `RoomDetailStats.test.ts` 变成 `(0 test)`。
   *
   * 注：`:class` + `class` 同时出现是合法的（Vue 会合并二者），
   * 故用负向后顾排除带 `:`（含 `v-bind:`）前缀者，也排除 `data-class` 这类带 `-` 前缀者。
   */
  const VUE_TEMPLATES = sources.filter((source) => source.path.endsWith('.vue'))

  /** 贪婪匹配到最后一个 `</template>`，以吃下嵌套 `<template #slot>` */
  const templateOf = (text: string) => text.match(/<template>[\s\S]*<\/template>/)?.[0] ?? ''

  for (const attribute of ['class', 'style']) {
    it(`模板中不得出现重复的静态 ${attribute} 属性`, () => {
      expect(VUE_TEMPLATES.length, '未收集到 .vue 文件，守卫已失效').toBeGreaterThan(50)

      const duplicate = new RegExp(`(?<![:\\w-])${attribute}="[^"]*"[^>]*?(?<![:\\w-])${attribute}="`)
      const offenders = VUE_TEMPLATES.filter((source) => duplicate.test(templateOf(source.text)))

      expect(
        offenders.map((source) => source.path),
        `重复静态 ${attribute} 属性的文件`
      ).toEqual([])
    })
  }
})
