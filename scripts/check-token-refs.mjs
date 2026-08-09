#!/usr/bin/env node
/**
 * design-tokens.css 零引用 token 检测（一次性分析脚本，用后归档）
 * 规则：
 * - 提取 design-tokens.css 中全部自定义属性定义（--xxx: ...）
 * - 引用 = 出现在 src/ 其他文件（var(--x)、--x 字符串）、uno.config.ts、index.html，
 *   或同文件内被其他定义 var() 引用
 * - 输出零引用 token 清单（JSON + 行号）
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TOKENS_FILE = join(ROOT, 'src/styles/css/design-tokens.css')
const css = readFileSync(TOKENS_FILE, 'utf8')
const lines = css.split('\n')

// 1. 提取定义：行首空白 + --name:
const defRe = /^\s*(--[\w-]+)\s*:/
const definitions = new Map() // name -> [lineNumbers]
lines.forEach((line, i) => {
  const m = line.match(defRe)
  if (m) {
    const name = m[1]
    if (!definitions.has(name)) definitions.set(name, [])
    definitions.get(name).push(i + 1)
  }
})

// 2. 同文件内 var() 引用集合（被其他 token 引用的不算零引用）
const sameFileRefs = new Set()
for (const m of css.matchAll(/var\((--[\w-]+)/g)) sameFileRefs.add(m[1])

// 3. 收集 src 下所有可能引用 token 的文件内容（排除 design-tokens.css 自身与测试快照）
const exts = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx', '.scss', '.css', '.html'])
const files = []
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
      walk(p)
    } else if (exts.has(p.slice(p.lastIndexOf('.')))) {
      files.push(p)
    }
  }
}
walk(join(ROOT, 'src'))
files.push(join(ROOT, 'uno.config.ts'), join(ROOT, 'index.html'))

const contents = files
  .filter((f) => f !== TOKENS_FILE)
  .map((f) => {
    try {
      return readFileSync(f, 'utf8')
    } catch {
      return ''
    }
  })

// 4. 逐个验证
const zeroRef = []
const zeroRefButSameFile = []
for (const [name, lineNums] of definitions) {
  const usedOutside = contents.some((c) => c.includes(name))
  if (usedOutside) continue
  if (sameFileRefs.has(name)) {
    zeroRefButSameFile.push({ name, lines: lineNums })
  } else {
    zeroRef.push({ name, lines: lineNums })
  }
}

console.log(`总定义 token 数: ${definitions.size}`)
console.log(`零引用（含同文件 var 引用）: ${zeroRefButSameFile.length}`)
console.log(`完全零引用: ${zeroRef.length}`)
console.log('\n=== 完全零引用清单 ===')
for (const item of zeroRef) console.log(`${item.name}  (lines: ${item.lines.join(',')})`)
console.log('\n=== 仅同文件 var 引用（定义链存活，慎删） ===')
for (const item of zeroRefButSameFile) console.log(`${item.name}  (lines: ${item.lines.join(',')})`)
