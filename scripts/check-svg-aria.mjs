#!/usr/bin/env node
/**
 * SVG 无障碍守卫。
 *
 * 基础规则：`src/**\/*.vue` 中每个 `<svg>` 必须满足其一：
 *  - 装饰性：显式 `aria-hidden="true"`
 *  - 有语义：`aria-label` / `aria-labelledby` / `role`，或元素内含 `<title>`
 *  - 交互式：`v-clickable`（运行期补 `role="button"` + `tabindex="0"` + Enter/Space）
 *
 * 为什么 `v-clickable` 也算合法声明：它比手写 `role="button"` **更绑定** ——
 * 手写 role 忘了 tabindex 依旧进不了 Tab 序列，而 v-clickable 必然同时补上。
 *
 * 交互类规则（2026-11 收口，见 docs/TJG-桌面端界面评审报告-2026-11-24.md 附录 D）：
 *  1. `aria-hidden` 与 `@click` 互斥 —— ARIA 规范禁止 aria-hidden 元素承载交互；
 *     唯一例外是 `DECORATIVE_CLICK_HANDLERS` 里「子元素顺手做点事、真正交互在父元素上」。
 *  2. 声明 `role="button"` 的 svg 必须同时有 `tabindex` 或 `v-clickable`，否则"有名字、没焦点"。
 *  3. 带 `tabindex`/`v-clickable` 的 svg 不得再写 `outline-none`，否则"能聚焦但看不见"。
 *  4. 含 `href="#close"` 的关闭图标挂了 `@click` 时不得 `aria-hidden`。
 *
 * 退出码：0 = 全部合规；1 = 存在违规。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(repoRoot, 'src')
const SVG_OPEN = /<svg\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g
const NAME_ATTR = /aria-hidden|aria-label|aria-labelledby|role=|v-clickable/
const CLICK_ATTR = /@click(?:\.(?:stop|prevent|self|once|capture|passive))*\s*=\s*"([^"]*)"/

/**
 * 已登记的「装饰性子元素」—— `@click` 只是顺带行为，真正交互由父元素承担。
 * 新增条目必须有"父元素已经可交互"的实证，否则应该给 svg 自己补 v-clickable。
 */
const DECORATIVE_CLICK_HANDLERS = new Set([
  // MsgInputToolbar：父级是 <n-button :aria-label="setting.preferences.send_key_label">，箭头只是图标
  'arrowLocal = true',
  'arrowLocal = false',
  // ActionList：父 <div role="button" tabindex="0" :aria-label :title @click @keydown.*>
  // 子 svg 的点击只是"顺手把别处的提示条关掉"
  'tipShow = false',
  'handleTipShow(item)'
])

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(fullPath)
    else if (entry.isFile() && entry.name.endsWith('.vue')) yield fullPath
  }
}

const violations = []
let total = 0

function report(kind, relPath, line) {
  violations.push({ kind, at: `${relPath}:${line}` })
}

for (const filePath of walk(srcRoot)) {
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content.includes('<svg')) continue
  const relPath = path.relative(repoRoot, filePath)

  let match
  SVG_OPEN.lastIndex = 0
  while ((match = SVG_OPEN.exec(content))) {
    total++
    const attrs = match[1]
    const line = content.slice(0, match.index).split('\n').length
    const openEnd = match.index + match[0].length
    const closeIdx = content.indexOf('</svg>', openEnd)
    const blockTail = closeIdx === -1 ? '' : content.slice(openEnd, closeIdx)
    const clickHandler = (attrs.match(CLICK_ATTR)?.[1] ?? '').trim()
    const hasClick = clickHandler.length > 0
    const isAriaHidden = /aria-hidden/.test(attrs)
    const isFocusable = /v-clickable/.test(attrs) || /\btabindex\b/.test(attrs)

    // ① 每个 svg 必须声明身份（装饰 / 有语义 / 交互）
    const hasInlineTitle = !attrs.trimEnd().endsWith('/') && blockTail.includes('<title>')
    if (!NAME_ATTR.test(attrs) && !hasInlineTitle) {
      report('未声明身份（aria-hidden / aria-label / role / v-clickable / <title>）', relPath, line)
      continue
    }

    // ② aria-hidden 与 @click 互斥，除非已登记为装饰性子元素
    if (isAriaHidden && hasClick && !DECORATIVE_CLICK_HANDLERS.has(clickHandler)) {
      report(`aria-hidden 却挂了 @click（handler: ${clickHandler}）`, relPath, line)
    }

    // ③ role="button" 必须同时可聚焦
    if (/role\s*=\s*"button"/.test(attrs) && !isFocusable) {
      report('声明 role="button" 但没有 tabindex / v-clickable', relPath, line)
    }

    // ④ 可聚焦的 svg 不得压制焦点环
    if (isFocusable && /outline-none/.test(attrs)) {
      report('可聚焦却写了 outline-none（能聚焦但看不见）', relPath, line)
    }

    // ⑤ 关闭图标被当作关闭按钮用时，不得 aria-hidden
    //    例外：X 图标被复用作"删除某条记录"（handler 带 delete-account），非关闭语义
    if (hasClick && isAriaHidden && blockTail.includes('href="#close"') && !/delete-account/.test(clickHandler)) {
      report('关闭图标 (#close) 挂了 @click 却 aria-hidden', relPath, line)
    }
  }
}

if (violations.length > 0) {
  const grouped = violations.reduce((acc, item) => {
    if (!acc[item.kind]) acc[item.kind] = []
    acc[item.kind].push(item.at)
    return acc
  }, {})
  console.error(`check-svg-aria: FAIL — ${violations.length} 项违规（共 ${total} 个 svg）：`)
  for (const [kind, items] of Object.entries(grouped)) {
    console.error(`\n  [${kind}] ${items.length} 项`)
    for (const at of items.slice(0, 50)) console.error(`    ${at}`)
    if (items.length > 50) console.error(`    ... 其余 ${items.length - 50} 项省略`)
  }
  process.exit(1)
}

console.log(`check-svg-aria: OK — ${total} 个 svg 均具备身份声明，且无 aria-hidden/交互冲突`)
