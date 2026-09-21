#!/usr/bin/env node

/**
 * Ratchet guard: counts must never grow, only shrink.
 *
 * Counters:
 *  - matrix_prefix_hardcoded: hardcoded `/_matrix` paths in src (non-test).
 *    New requests must use the MatrixHttpClient gateway / relative paths
 *    instead of full-path literals (double-prefix bug source, see G2).
 *  - ts_expect_error: `@ts-expect-error` in src. strict: true is a hard red
 *    line (G1); per-line escapes are allowed but the count must not grow.
 *  - hardcoded_color: literal hex/rgb colors in src (non-test, excluding
 *    SVG `<use href="#...">` refs and comments). New colors should use
 *    `--tjg-*` design tokens instead of raw literals.
 *  - hardcoded_radius: `border-radius` with a raw 16–29px value (non-test).
 *    Large radii must use `--tjg-radius-*` (16px 起的大圆角是产品规格）。
 *  - inline_style: static `style="..."` attributes in .vue (non-test).
 *    Prefer scoped CSS / UnoCSS utilities so theming keeps working.
 *  - important_css: `!important` declarations in style sources (non-test,
 *    comments stripped). Converge on design tokens / specificity instead.
 *
 * Usage:
 *   node scripts/check-ratchet.mjs            # verify (CI / pre-merge)
 *   node scripts/check-ratchet.mjs --update   # tighten baseline after cleanup
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = path.join(repoRoot, 'meta', 'ratchet-baseline.json')
const srcRoot = path.join(repoRoot, 'src')

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.vue'])
/** 样式相关计数器需覆盖 scss/css/输出文档（mdx） */
const STYLE_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, '.scss', '.css', '.mdx'])

function isTestPath(relPath) {
  return relPath.includes('__tests__') || /\.(test|spec)\.[cm]?tsx?$/.test(relPath) || relPath.endsWith('.stories.ts')
}

function* walk(dir, extensions = SOURCE_EXTENSIONS) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath, extensions)
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      yield fullPath
    }
  }
}

function countOccurrences(content, pattern) {
  return (content.match(pattern) ?? []).length
}

/** 去除注释、SVG 图标引用与 `var(--*)` 回退值，只保留真正无 token 的字面量颜色 */
function stripCommentsAndSvgRefs(content) {
  return content
    .replace(/\/\/[^\n]*/g, '') // 行注释
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释
    .replace(/href\s*=\s*["']#[^"']*["']/g, '') // SVG use href
    .replace(/var\([^)]*\)/g, '') // CSS var(...) 表达式（含 fallback 色，属安全模式）
}

/** 仅剥离注释（用于计数 `!important`：注释里提到它不应计入） */
function stripCommentsOnly(content) {
  return content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * `inline_style` 具名 allowlist —— **已裁定例外**（2026-09-21 inline_style 专项收口时裁定）。
 *
 * 这 5 处 `style="..."` 不是「静态内联样式」，而是 `<n-popover>` 的**组件参数**
 * （`padding: 0`、`background: var(--tjg-surface-panel)`）：naive-ui 会把 popover 内容
 * teleport 到 body，父级 scoped 的 `:deep()` 够不到；换成 UnoCSS（如 `.p-0`）会因
 * **同特异性**退化为「由样式注入顺序决定」。结论：不迁移，就地登记为例外，勿再尝试。
 *
 * 该表同时是**漂移守卫**：某文件一旦出现超出登记数量的内联样式（含新增行）即 FAIL，
 * 既防「悄悄新增」，也防「把例外换成新的例外」（单纯比对总量看不见后者）。
 */
const INLINE_STYLE_ALLOWLIST = new Map([
  ['src/components/rightBox/chatBox/ChatSidebar.vue', 1], // n-popover：padding: 0; background: var(--tjg-surface-panel)
  ['src/components/rightBox/renderMessage/index.vue', 1], // 同上
  ['src/layout/left/components/LeftAvatar.vue', 1], // 同上
  ['src/layout/left/components/definePlugins/Card.vue', 1], // n-popover：padding: 0
  ['src/layout/left/components/definePlugins/List.vue', 1] // 同上
])

const counters = {
  matrix_prefix_hardcoded: { pattern: /\/_matrix/g, includeTests: false, total: 0, files: new Map() },
  ts_expect_error: { pattern: /@ts-expect-error/g, includeTests: true, total: 0, files: new Map() },
  hardcoded_color: {
    pattern: /#[0-9a-fA-F]{3}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{8}\b|rgba?\(\s*[0-9]/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsAndSvgRefs
  },
  /**
   * 大圆角必须走 `--tjg-radius-*`；16px 及以上属产品规格，不接受字面量。
   * 值区间限制在 `[^;"}\n]` 内，避免跨行/跨属性误抓（如 `style="border-radius: 8px"` 之后的行）。
   * `(?<![\d.])` 防止命中更长数字的尾段（如 216px 里的 16px）。
   */
  hardcoded_radius: {
    pattern: /-radius:[^;"}\n]*(?<![\d.])(?:1[6-9]px|2[0-9]px)/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    extensions: STYLE_EXTENSIONS
  },
  /** 静态内联 style 破坏主题化能力；核心视图要求为 0（见 src/styles/__tests__/design-baseline.test.ts） */
  inline_style: {
    pattern: /(?<![:\w@-])style\s*=\s*"/g,
    includeTests: false,
    total: 0,
    files: new Map()
  },
  /** `!important` 只允许在能说明理由处保留；总量只能降不能升 */
  important_css: {
    pattern: /!important/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsOnly,
    extensions: STYLE_EXTENSIONS
  }
}

for (const filePath of walk(srcRoot, STYLE_EXTENSIONS)) {
  const relPath = path.relative(repoRoot, filePath)
  const content = fs.readFileSync(filePath, 'utf8')
  for (const counter of Object.values(counters)) {
    if (!counter.includeTests && isTestPath(relPath)) continue
    const extensions = counter.extensions ?? SOURCE_EXTENSIONS
    if (!extensions.has(path.extname(filePath))) continue
    const text = counter.strip ? counter.strip(content) : content
    const count = countOccurrences(text, counter.pattern)
    if (count > 0) {
      counter.total += count
      counter.files.set(relPath, count)
    }
  }
}

const current = Object.fromEntries(Object.entries(counters).map(([name, c]) => [name, c.total]))

if (process.argv.includes('--update')) {
  const baseline = {
    comment:
      'Ratchet baseline: counts may only decrease. Regenerate with `node scripts/check-ratchet.mjs --update` after cleanup batches. See design doc G1/G2.',
    updated_at: new Date().toISOString(),
    counters: current
  }
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`)
  console.log(`check-ratchet: baseline written to ${path.relative(repoRoot, baselinePath)}`)
  for (const [name, value] of Object.entries(current)) {
    console.log(`  ${name}: ${value}`)
  }
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  console.error(
    `check-ratchet: missing ${path.relative(repoRoot, baselinePath)}; run \`node scripts/check-ratchet.mjs --update\` once to create it.`
  )
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
let failed = false

/**
 * inline_style 漂移守卫：具名 allowlist 之外的内联样式一律视为新增 → FAIL。
 * 总量比对只能发现「变多」，发现不了「把旧例外删掉、同时加个新例外」。
 */
{
  const unexpected = [...counters.inline_style.files.entries()].filter(
    ([file, count]) => count > (INLINE_STYLE_ALLOWLIST.get(file) ?? 0)
  )
  if (unexpected.length > 0) {
    console.error('check-ratchet: FAIL inline_style: 出现具名 allowlist 之外的内联样式（n-popover 参数是唯一已裁定例外）：')
    for (const [file, count] of unexpected) {
      console.error(`    ${count}\t${file}（allowlist 登记 ${INLINE_STYLE_ALLOWLIST.get(file) ?? 0} 处）`)
    }
    failed = true
  }
}

for (const [name, counter] of Object.entries(counters)) {
  const allowed = baseline.counters?.[name]
  const actual = counter.total
  if (typeof allowed !== 'number') {
    console.error(`check-ratchet: FAIL ${name}: no baseline entry; re-run with --update.`)
    failed = true
    continue
  }
  if (actual > allowed) {
    console.error(`check-ratchet: FAIL ${name}: ${actual} > baseline ${allowed}. New occurrences are not allowed.`)
    const sorted = [...counter.files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    for (const [file, count] of sorted) {
      console.error(`    ${count}\t${file}`)
    }
    failed = true
  } else if (actual < allowed) {
    console.log(
      `check-ratchet: OK ${name}: ${actual} (baseline ${allowed}) — tighten with \`node scripts/check-ratchet.mjs --update\`.`
    )
  } else {
    const note = name === 'inline_style' ? ' —— 全部命中具名 allowlist（n-popover 组件参数，已裁定例外）' : ''
    console.log(`check-ratchet: OK ${name}: ${actual} (baseline ${allowed})${note}`)
  }
}

process.exit(failed ? 1 : 0)
