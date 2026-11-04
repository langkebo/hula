#!/usr/bin/env node

/**
 * 移动端 CSS 约定的仓库级守卫。
 *
 * 背景：这两类问题在 2026-10/11 的移动端审计里反复出现，而此前的守卫是
 * `src/mobile/layout/__tests__/mobileCssGuards.test.ts` 里**逐个文件名写死**的
 * 断言 —— 只能看住当时列出的几个文件，新文件一律漏网。这里换成目录级扫描。
 *
 * 规则一 `viewport-fallback`：`100vh` 必须配 `100dvh`。
 *  - `100vh` 在移动端不随地址栏/软键盘变化，键盘弹出后底部被遮（审计 M1）；
 *  - `100dvh` 才是正确值，但旧 Android WebView / iOS < 15.4 不认它，整条声明被丢弃；
 *  - 故正确写法是「先 vh 兜底，再用 dvh 覆盖」：
 *        height: 100vh;
 *        height: 100dvh;
 *    判据取「同文件内 dvh 数 ≥ vh 数」，不要求逐条相邻（`@supports` 分组也合法）。
 *
 * 规则二 `blur-prefix`：模糊必须带 `-webkit-` 前缀，且不得用 UnoCSS 的 `backdrop-blur-*`。
 *  - 本仓未接 autoprefixer，UnoCSS 工具类/`@apply` 只产不带前缀的 `backdrop-filter`；
 *  - iOS Safari 18 之前、旧 Android WebView 只认 `-webkit-backdrop-filter`，
 *    不带前缀等于**没有模糊**（不是降级为纯色，是直接不可见）；
 *  - 故模糊必须在 SCSS 里显式成对声明，或用 `liquid-glass` / `backdrop-blur` 系列 mixin。
 *  - `@include backdrop-blur-fallback` 是性能降级 mixin，不是模糊声明本身，
 *    正则用 `backdrop-blur-(?!fallback)` 排除它。
 *
 * 已知不覆盖（刻意，避免制造无意义的改动）：
 *  - **只有 `100dvh` 而无 `vh` 兜底**的情形不在规则一内。`calc(100dvh - Xpx)` 多写在
 *    UnoCSS 工具类里（如 `max-h-[calc(100dvh-340px)]`），无法在同一个类上表达回退；
 *    这些位置在旧 WebView 上会退化为「不限高/自适应」，属于可接受降级。
 *  - 规则只扫 `src/mobile/**`：`src/components/**` 同时服务桌面固定尺寸窗口，
 *    在那里 `100vh` 是正确语义，不能一刀切。
 *
 * 退出码：0 = 通过；1 = 有违例；2 = 扫描面异常（文件数过少，多半是路径改了）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOBILE_ROOT = path.join(repoRoot, 'src', 'mobile')

/** 扫描面下限：低于此数说明路径/过滤器失效，不能静默报 OK */
const MIN_EXPECTED_FILES = 100

const SOURCE_EXTENSIONS = new Set(['.vue', '.scss', '.css', '.ts'])

function isTestPath(relPath) {
  return relPath.includes('__tests__') || /\.(test|spec)\.[cm]?tsx?$/.test(relPath)
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      yield full
    }
  }
}

/**
 * 剥离注释后再判定。
 *
 * 否则「解释为什么不能用某个写法」的注释本身会被当成违例 —— 本仓已有先例：
 * 棘轮守卫曾因注释里出现 `style="..."` 而误计数。剥掉注释后，判据只看真实代码。
 * `(?<!:)//` 用于放过 `https://` 这类字符串里的双斜杠。
 */
function stripComments(content) {
  return content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<!:) \/\/[^\n]*/g, '')
    .replace(/(?<!:)\/\/[^\n]*/g, '')
}

/** 统计所有匹配项（全局正则，避免 `lastIndex` 残留） */
function countMatches(content, pattern) {
  return (content.match(pattern) ?? []).length
}

const RULES = [
  {
    id: 'viewport-fallback',
    /**
     * 按「同一属性」成对判定，而不是文件内总数。
     *
     * 早期实现用「文件内 dvh 数 ≥ vh 数」，被实测证伪：某文件模板里只要有一处
     * `h-100dvh` 工具类，就能把 SCSS 里「只写了 100vh」的声明掩盖过去
     * （变异自证 M2 原本应红却绿）。这里改为逐条检查：
     *  - 每条 `(min-|max-)?height: …100vh…` 必须有一个**同名属性**的 `100dvh` 声明，
     *    且位置相近（±3 行，容纳 `@supports (height: 100dvh)` 包裹写法）；
     *  - 工具类 `h-100vh` / `min-h-[...100vh...]` 无法表达回退（无同名属性可配）⇒ 直接判违规。
     */
    check(content) {
      const lines = content.split('\n')
      const dvhLines = []
      lines.forEach((line, i) => {
        if (/100dvh/.test(line)) dvhLines.push(i)
      })

      for (let i = 0; i < lines.length; i++) {
        if (!/100vh/.test(lines[i])) continue
        const decl = lines[i].match(/((?:min-|max-)?height)\s*:[^;]*100vh/)
        if (!decl) {
          return {
            detail: `第 ${i + 1} 行的 100vh 不是 height 声明（多为工具类），无法配 dvh 回退：${lines[i].trim().slice(0, 60)}`
          }
        }
        const prop = decl[1]
        const paired = dvhLines.some(
          (j) => Math.abs(j - i) <= 3 && new RegExp(`${prop}\\s*:[^;]*100dvh`).test(lines[j])
        )
        if (!paired) {
          return { detail: `第 ${i + 1} 行的 \`${prop}: …100vh\` 没有对应的 100dvh 覆盖` }
        }
      }
      return null
    },
    hint: '补 dvh 覆盖：先 `height: 100vh;` 兜底，再 `height: 100dvh;`（键盘/地址栏跟随）'
  },
  {
    id: 'blur-prefix',
    check(content) {
      // 工具类：UnoCSS 产不出 -webkit- 前缀，禁止使用（`backdrop-blur-fallback` 是 mixin，排除）
      const utilities = countMatches(content, /(?<![\w-])backdrop-blur-(?!fallback)[\w-]+/g)
      const unprefixed = countMatches(content, /(?<!-webkit-)backdrop-filter\s*:/g)
      const prefixed = countMatches(content, /-webkit-backdrop-filter\s*:/g)
      if (utilities > 0) {
        return { detail: `使用 UnoCSS 模糊工具类 ${utilities} 处（不产 -webkit- 前缀）` }
      }
      return unprefixed > prefixed
        ? { detail: `backdrop-filter × ${unprefixed}，但只有 -webkit-backdrop-filter × ${prefixed}` }
        : null
    },
    hint: '在 SCSS 里成对声明：`-webkit-backdrop-filter: …;` 再 `backdrop-filter: …;`（或改用 liquid-glass mixin）'
  }
]

function main() {
  if (!fs.existsSync(MOBILE_ROOT)) {
    console.error(`check-mobile-css: FAIL — 找不到 ${path.relative(repoRoot, MOBILE_ROOT)}`)
    process.exit(2)
  }

  const files = [...walk(MOBILE_ROOT)]
    .map((p) => path.relative(repoRoot, p))
    .filter((p) => !isTestPath(p))
    .sort()

  if (files.length < MIN_EXPECTED_FILES) {
    console.error(
      `check-mobile-css: FAIL — 只扫到 ${files.length} 个文件（期望 ≥ ${MIN_EXPECTED_FILES}），路径或过滤条件疑似失效`
    )
    process.exit(2)
  }

  const violations = []
  for (const relPath of files) {
    const content = stripComments(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'))
    for (const rule of RULES) {
      const result = rule.check(content)
      if (result) violations.push({ rule, relPath, detail: result.detail })
    }
  }

  if (violations.length === 0) {
    console.log(
      `[mobile-css] OK — ${files.length} 个文件：视口高度均有 dvh 覆盖、模糊均带 -webkit- 前缀`
    )
    process.exit(0)
  }

  const byRule = new Map()
  for (const v of violations) {
    if (!byRule.has(v.rule.id)) byRule.set(v.rule.id, [])
    byRule.get(v.rule.id).push(v)
  }

  console.error(`[mobile-css] FAIL — ${violations.length} 处违反移动端 CSS 约定`)
  for (const [ruleId, items] of byRule) {
    const rule = RULES.find((r) => r.id === ruleId)
    console.error(`\n  ${ruleId}（${items.length} 处）`)
    for (const item of items) {
      console.error(`    ${item.relPath}: ${item.detail}`)
    }
    console.error(`    → ${rule.hint}`)
  }
  process.exit(1)
}

main()
