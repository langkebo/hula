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
 *  - hardcoded_color: literal hex/rgb/hsl colors in src (non-test, covering
 *    `.ts`/`.vue`/`.scss`/`.css`, excluding SVG `<use href="#...">` refs and
 *    comments). New colors must use `--tjg-*` design tokens instead of raw
 *    literals. The token source (`design-tokens.css`) and the decorative
 *    gradient asset (`login-bg.scss`) are excluded by path.
 *  - hardcoded_radius: `border-radius` with a raw 16–29px value (non-test).
 *    Large radii must use `--tjg-radius-*` (16px 起的大圆角是产品规格）。
 *  - inline_style: static `style="..."` attributes in .vue (non-test).
 *    Prefer scoped CSS / UnoCSS utilities so theming keeps working.
 *  - important_css: `!important` declarations in style sources (non-test,
 *    comments stripped). Converge on design tokens / specificity instead.
 *  - zh_literal_vue: Chinese literals in .vue (non-test, comments stripped).
 *  - zh_literal_rust: Chinese **string literals** in src-tauri/src (all .rs files).
 *    Rust errors/logs must return a code (or English) and let the frontend
 *    translate; the count may only decrease (see the counter's own doc).
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
/** Rust 侧（Tauri 后端）单独一棵树；只被声明了 `roots` 的计数器扫描 */
const rustRoot = path.join(repoRoot, 'src-tauri', 'src')
const RUST_EXTENSIONS = new Set(['.rs'])

const SOURCE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.vue'])
/** 样式相关计数器需覆盖 scss/css/输出文档（mdx） */
const STYLE_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, '.scss', '.css', '.mdx'])
/** i18n 硬编码文案只统计 `.vue`（模板 + 脚本）中的中文 */
const VUE_EXTENSIONS = new Set(['.vue'])

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
    .replace(/(?:xlink:)?href\s*=\s*"[^"]*"/g, '') // SVG use href（含 :href 绑定，值内可含单引号）
    .replace(/(?:xlink:)?href\s*=\s*'[^']*'/g, '')
    .replace(/\bicon:\s*['"]#[^'"]*['"]/g, '') // 图标 id 参数（如 #face），不是颜色
    .replace(/var\([^)]*\)/g, '') // CSS var(...) 表达式（含 fallback 色，属安全模式）
}

/** 仅剥离注释（用于计数 `!important`：注释里提到它不应计入） */
function stripCommentsOnly(content) {
  return content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 剥离 JS 注释与 HTML 注释（`<!-- -->`）后再统计中文文案：
 * 注释里的中文不是「用户可见文案」，不应计入 i18n 债务，否则一注释就永久抬高基线。
 */
function stripCommentsAndHtmlComments(content) {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 剥离 Rust 注释，**保留字符串字面量原文**。
 *
 * 为什么不复用 `stripCommentsOnly`：它的 `//` 规则会把 URL 字面量
 * （`"https://..."`）之后的内容整段当注释丢掉；而 Rust 代码里 `format!("...{}", "中文")`
 * 这种写法很常见，误剥会让计数偏低、守卫失明。这里按字符扫描，区分「字符串内」与「代码」。
 *
 * 已知近似：Rust 裸字符串 `r#"..."#` 与字符字面量 `'"'` 会被当成普通字符串处理。
 * 这只会影响极少数行的边界判断，不影响「新增中文串必然抬高计数」这一判据。
 */
function stripRustComments(content) {
  let out = ''
  let i = 0
  let inString = false
  while (i < content.length) {
    const ch = content[i]
    if (inString) {
      if (ch === '\\') {
        out += content.slice(i, i + 2)
        i += 2
        continue
      }
      if (ch === '"') inString = false
      out += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i)
      i = end === -1 ? content.length : end
      continue
    }
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2)
      i = end === -1 ? content.length : end + 2
      continue
    }
    out += ch
    i += 1
  }
  return out
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

/**
 * `hardcoded_color` 具名 allowlist —— **已裁定例外**（2026-10-13 CQ-05 收口时裁定，
 * 与 INLINE_STYLE_ALLOWLIST 同机制）。这些字面量色值**无法**用 `--tjg-*` token 表达：
 *
 *  - `naiveTokenSource.ts`：`design-tokens.css` 的 TS 镜像，被 `naiveTokenSource.test.ts`
 *    以 fs 读取 CSS 原文逐项锁定（漂移即失败），且 Naive UI 在 JS 侧做 rgba 色彩运算，
 *    读不到 CSS 变量 —— 只能持具体色值。
 *  - `Logger.ts` / `Console.ts`：浏览器 console 的 `%c` 样式串，运行期不解析 CSS 变量。
 *
 * 该表同时是**漂移守卫**：某文件一旦超出登记数量（含新增行）即 FAIL，
 * 既防「悄悄新增」，也防「把例外删掉、同时加个新例外」。计数收敛时按实际值扣除，
 * 使 ratchet 只反映**未登记**的硬编码色债务（目标基线 0）。
 */
const HARDCODED_COLOR_ALLOWLIST = new Map([
  ['src/styles/naiveTokenSource.ts', 9], // design-tokens.css TS 镜像（同步测试锁定）
  ['src/utils/Logger.ts', 5], // console %c 日志级别色
  ['src/utils/Console.ts', 3] // console %c 品牌色
])

/**
 * `as_unknown_as` 具名 allowlist —— **已裁定例外**（2026-10-14 CQ-01 收口时裁定，
 * 与 INLINE_STYLE_ALLOWLIST / HARDCODED_COLOR_ALLOWLIST 同机制）。下列两处用
 * `x as unknown as T` 是**结构性**的，单次 `as` 因 comparability 不成立而无法通过：
 *
 *  - `matrixMocks.ts`：测试工厂，用普通对象字面量伪造 `MatrixClient` / `Room` /
 *    `MatrixEvent`（SDK 类是重量级 class，字面量与其实例类型不能充分重叠），是
 *    「SDK 形状漂移的单点封装」——集中一处好过散落 ~800 个内联 cast。
 *  - `CreationService.ts`：离线占位伪造 `Room`，`createRoom` 的返回契约即
 *    `Promise<Room>`，占位对象只实现 4 个字段，同样无法单次断言。
 *
 * 该表同时是**漂移守卫**：某文件一旦超出登记数量（含新增行）即 FAIL，
 * 既防「悄悄新增」，也防「把例外删掉、同时加个新例外」。扣除已登记文件的实际
 * 计数后，`as_unknown_as` 基线收敛到 0（只反映未登记的债务）。
 */
const AS_UNKNOWN_AS_ALLOWLIST = new Map([
  ['src/test-helpers/matrixMocks.ts', 3], // createMockMatrixClient / createMockRoom / createMockMatrixEvent
  ['src/services/matrix/room/CreationService.ts', 1] // 离线占位 Room
])

const counters = {
  /**
   * 判据本意是「**新的请求**必须走 MatrixHttpClient 网关 / 相对路径」，
   * 而注释里引用真实路径（如 JSDoc 写 `GET /_matrix/client/v3/login/sso/redirect/saml`）
   * 不是请求 —— 同 `hardcoded_color` 的既有约定（"excluding comments"），
   * 故这里也剥注释后再计数（2026-10-10：并发写者给 `MatrixAuthSaml.ts` 补 JSDoc
   * 引用了真实路径，把计数从 63 顶到 64，实际零新增请求）。
   */
  matrix_prefix_hardcoded: {
    pattern: /\/_matrix/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsOnly
  },
  ts_expect_error: { pattern: /@ts-expect-error/g, includeTests: true, total: 0, files: new Map() },
  /**
   * 全仓字面量颜色（非测试）。2026-10-31 审计 S-3 修复：此前该计数只扫
   * `.ts`/`.vue`（`extensions` 缺省为 SOURCE_EXTENSIONS），`.scss`/`.css`
   * 完全在盲区内；正则也漏了 4 位 hex 与 `hsl()`。两者补上后，
   * `simple.scss` / `code-block.scss` 中的存量色值才第一次被看见。
   */
  hardcoded_color: {
    pattern: /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[0-9]|hsla?\(\s*[0-9]/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsAndSvgRefs,
    extensions: STYLE_EXTENSIONS,
    excludePaths: new Set([
      // token 唯一来源，本身必须持有色值
      'src/styles/css/design-tokens.css',
      // 品牌装饰渐变资源，无对应语义 token
      'src/styles/scss/global/login-bg.scss'
    ])
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
  },
  /**
   * 裸 `backdrop-filter` 声明（非测试，剥注释后计；`-webkit-` 前缀一并计入）。
   *
   * 判据本意（UI 优化方案 v2.4 §E1）：模糊只能经由 `_liquid-glass.scss` 的变体
   * 或 `TjGlass.vue` 输出，以便统一「前缀 + `html.low-perf` + `prefers-reduced-transparency`」
   * 三层降级；组件里手写 `backdrop-filter` 会绕过降级链（G1/G2 的根因）。
   * 该计数只能降不能升。
   *
   * 口径：
   * - 只计「产生模糊」的声明，`backdrop-filter: none`（降级关闭）不计 ——
   *   否则给存量手写模糊补降级反而会让计数上升，与判据本意相反；
   * - 不排除 mixin 自身 —— 新增模糊变体也必须显式更新基线，避免「悄悄多一层模糊」；
   * - 测试文件不计入（常见断言字符串）。
   */
  backdrop_filter_raw: {
    pattern: /backdrop-filter\s*:(?!\s*none\b)/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsOnly,
    extensions: STYLE_EXTENSIONS
  },
  /**
   * `.vue` 中的中文硬编码文案（非测试，剥离注释后按「连续汉字段」计）。
   * 新文案必须走 `t('key')`（文案落 `locales/`）；存量按模块分批抽取，
   * 因此该计数只能降不能升（P1-4 i18n ratchet 止血）。
   */
  zh_literal_vue: {
    pattern: /[\u4e00-\u9fff]+/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsAndHtmlComments,
    extensions: VUE_EXTENSIONS
  },
  /**
   * 运行期平台分支（`isMobile()` 调用点，非测试）。
   *
   * 判据本意：桌面/移动应各自实现（`src/components` vs `src/mobile`），
   * 而不是在同一文件里用 `isMobile()` 内联分叉 —— 内联分支是临界候补的临时形态，
   * 每新增一处都会把「单一实现」再撕开一道口子（P1-6 CP-01）。
   *
   * 口径：
   *  - `(?<![\w$])` 排除定义处 `function isMobile(` 的子串命中；
   *  - 只统计调用 `isMobile(`，测试用 `.test.ts` 不计入（默认 includeTests: false）；
   *  - `.ts`/`.vue` 全覆盖（默认 SOURCE_EXTENSIONS）。
   *
   * 收敛策略（不批量重写）：新代码禁止新增内联分支，存量按模块分批下沉到
   * `src/mobile/` 独立实现，该计数只能降不能升。
   */
  is_mobile_branch: {
    pattern: /(?<![\w$])isMobile\(/g,
    includeTests: false,
    total: 0,
    files: new Map()
  },
  /**
   * 双重断言 `x as unknown as T`（非测试，剥注释后计）。
   *
   * 判据本意：`as unknown as` 会**同时绕过两端类型检查**（先把类型抹成 unknown，
   * 再强扭为目标类型），是类型系统里的「静默逃生舱」——它让错误在编译期不可见、
   * 在运行期才炸，且掩盖了真正的类型不匹配（P2-1 CQ-01）。
   *
   * 收敛策略（不批量重写）：新代码禁止再用 `as unknown as`，应改用正经类型定义、
   * 类型守卫或泛型约束；存量优先在 `services/matrix` 热点文件就近替换，计数只降不升。
   * 结构性例外（测试工厂 / 离线占位 Room）登记于下方 `AS_UNKNOWN_AS_ALLOWLIST`，
   * 扣除后基线收敛到 0，并受对应漂移守卫约束。
   */
  as_unknown_as: {
    pattern: /as\s+unknown\s+as/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripCommentsOnly
  },
  /**
   * Rust 侧（src-tauri/src 下所有 .rs）的中文**字符串字面量**。
   *
   * 判据本意：后端不该把面向用户的文案写死成中文 —— 正确形态是「返回错误码/英文 +
   * 前端 `t('key')` 翻译」，否则多语言永远是半成品，且文案改动要发 Rust 版本。
   *
   * 口径（与 `zh_literal_vue` 的区别，刻意不同）：
   *  - `zh_literal_vue` 数「连续汉字段」，适合前端模板里零散的中文；
   *  - 这里数 **含中文的字符串字面量个数**（一个 `"请检查 {} 是否存在"` 记 1，不是 2），
   *    因为 Rust 侧的债务单位是「一句话」，按汉字段数会把标点分隔算成多份、虚高。
   *  - 先剥离注释：中文注释是**好的**（本仓文档一律中文），不该计入债务。
   *
   * 收敛策略：新代码禁止新增中文串（新增即 FAIL）；存量按文件分批改为错误码 + 前端翻译。
   * 2026-11-04 首次量化：**192 处 / 23 文件**（`secure_store.rs` 27、`video_thumbnail.rs` 22、
   * `file_manager_command.rs` 19、`upload_command.rs` 19…），较 10-13 的 156/21 **净增 36** ——
   * 正是「没有守卫 → 越写越多」的典型，故先上闸再还存量。
   */
  zh_literal_rust: {
    pattern: /"[^"\n]*[\u4e00-\u9fff][^"\n]*"/g,
    includeTests: false,
    total: 0,
    files: new Map(),
    strip: stripRustComments,
    extensions: RUST_EXTENSIONS,
    roots: [rustRoot]
  }
}

for (const filePath of walk(srcRoot, STYLE_EXTENSIONS)) {
  const relPath = path.relative(repoRoot, filePath)
  const content = fs.readFileSync(filePath, 'utf8')
  for (const counter of Object.values(counters)) {
    if (!counter.includeTests && isTestPath(relPath)) continue
    const extensions = counter.extensions ?? SOURCE_EXTENSIONS
    if (!extensions.has(path.extname(filePath))) continue
    if (counter.excludePaths?.has(relPath)) continue
    const text = counter.strip ? counter.strip(content) : content
    const count = countOccurrences(text, counter.pattern)
    if (count > 0) {
      counter.total += count
      counter.files.set(relPath, count)
    }
  }
}

// 声明了 `roots` 的计数器扫描自己的根（如 Rust 树）；其余仍走上面的 `src` 单次遍历。
for (const counter of Object.values(counters)) {
  if (!counter.roots) continue
  const extensions = counter.extensions ?? SOURCE_EXTENSIONS
  for (const root of counter.roots) {
    if (!fs.existsSync(root)) continue
    for (const filePath of walk(root, extensions)) {
      const relPath = path.relative(repoRoot, filePath)
      if (!counter.includeTests && isTestPath(relPath)) continue
      const content = fs.readFileSync(filePath, 'utf8')
      const text = counter.strip ? counter.strip(content) : content
      const count = countOccurrences(text, counter.pattern)
      if (count > 0) {
        counter.total += count
        counter.files.set(relPath, count)
      }
    }
  }
}

const current = Object.fromEntries(Object.entries(counters).map(([name, c]) => [name, c.total]))

/**
 * 计数收敛：`hardcoded_color` 扣除具名 allowlist 已登记文件的**实际**出现数，
 * 使 ratchet 反映「未登记」的硬编码色债务（目标基线 0）；
 * 已登记文件本身仍受下方漂移守卫约束（超出登记数即 FAIL）。
 */
current.hardcoded_color -= [...HARDCODED_COLOR_ALLOWLIST.keys()].reduce(
  (sum, file) => sum + (counters.hardcoded_color.files.get(file) ?? 0),
  0
)

/**
 * 计数收敛：`as_unknown_as` 同样扣除具名 allowlist 已登记文件的**实际**出现数，
 * 使 ratchet 只反映**未登记**的双重断言债务（目标基线 0）；
 * 已登记文件本身仍受下方漂移守卫约束（超出登记数即 FAIL）。
 */
current.as_unknown_as -= [...AS_UNKNOWN_AS_ALLOWLIST.keys()].reduce(
  (sum, file) => sum + (counters.as_unknown_as.files.get(file) ?? 0),
  0
)

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
    console.error(
      'check-ratchet: FAIL inline_style: 出现具名 allowlist 之外的内联样式（n-popover 参数是唯一已裁定例外）：'
    )
    for (const [file, count] of unexpected) {
      console.error(`    ${count}\t${file}（allowlist 登记 ${INLINE_STYLE_ALLOWLIST.get(file) ?? 0} 处）`)
    }
    failed = true
  }
}

/**
 * hardcoded_color 漂移守卫：**已登记例外文件**一旦超出登记数量即 FAIL。
 *
 * 具名 allowlist 之外的文件不再在此逐文件判红 —— 它们的存量由 `hardcoded_color`
 * 总量基线看住（多写一处即抬高总量 → FAIL）。两者分工：
 *  - 总量基线：看住「未登记债务」只减不增；
 *  - 逐文件守卫：看住「已裁定例外被悄悄扩大」（总量比对看不见这种偷换）。
 */
{
  const unexpected = [...counters.hardcoded_color.files.entries()].filter(
    ([file, count]) => HARDCODED_COLOR_ALLOWLIST.has(file) && count > HARDCODED_COLOR_ALLOWLIST.get(file)
  )
  if (unexpected.length > 0) {
    console.error(
      'check-ratchet: FAIL hardcoded_color: 出现具名 allowlist 之外的硬编码色（TS 镜像 / console %c 样式是已裁定例外）：'
    )
    for (const [file, count] of unexpected) {
      console.error(`    ${count}\t${file}（allowlist 登记 ${HARDCODED_COLOR_ALLOWLIST.get(file) ?? 0} 处）`)
    }
    failed = true
  }
}

/**
 * as_unknown_as 漂移守卫：具名 allowlist 之外的双重断言一律视为新增 → FAIL。
 * 收敛后的 `as_unknown_as` 基线为 0，总量比对发现不了
 * 「把旧例外删掉、同时加个新例外」，故需逐个已登记文件比对。
 */
{
  const unexpected = [...counters.as_unknown_as.files.entries()].filter(
    ([file, count]) => count > (AS_UNKNOWN_AS_ALLOWLIST.get(file) ?? 0)
  )
  if (unexpected.length > 0) {
    console.error(
      'check-ratchet: FAIL as_unknown_as: 出现具名 allowlist 之外的双重断言（测试工厂 / 离线占位 Room 是已裁定例外）：'
    )
    for (const [file, count] of unexpected) {
      console.error(`    ${count}\t${file}（allowlist 登记 ${AS_UNKNOWN_AS_ALLOWLIST.get(file) ?? 0} 处）`)
    }
    failed = true
  }
}

for (const [name, counter] of Object.entries(counters)) {
  const allowed = baseline.counters?.[name]
  const actual = current[name]
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
    const note =
      name === 'inline_style'
        ? ' —— 全部命中具名 allowlist（n-popover 组件参数，已裁定例外）'
        : name === 'hardcoded_color' && actual === 0
          ? ' —— 剩余硬编码色全部命中具名 allowlist（TS 镜像 / console %c 样式，已裁定例外）'
          : name === 'as_unknown_as' && actual === 0
            ? ' —— 剩余双重断言全部命中具名 allowlist（测试工厂 / 离线占位 Room，已裁定例外）'
            : ''
    console.log(`check-ratchet: OK ${name}: ${actual} (baseline ${allowed})${note}`)
  }
}

process.exit(failed ? 1 : 0)
