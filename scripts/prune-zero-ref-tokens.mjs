#!/usr/bin/env node
/**
 * 零引用 token 删除脚本（一次性，配合 check-token-refs.mjs 使用）
 * 删除 design-tokens.css 中"完全零引用"token 的全部定义行（含各主题块）。
 * 保留仅同文件 var 引用的 token（定义链中间层）。
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const TOKENS_FILE = join(ROOT, 'src/styles/css/design-tokens.css')
const css = readFileSync(TOKENS_FILE, 'utf8')
const lines = css.split('\n')

const defRe = /^\s*(--[\w-]+)\s*:/
const definitions = new Map()
lines.forEach((line, i) => {
  const m = line.match(defRe)
  if (m) {
    if (!definitions.has(m[1])) definitions.set(m[1], [])
    definitions.get(m[1]).push(i)
  }
})

const sameFileRefs = new Set()
for (const m of css.matchAll(/var\((--[\w-]+)/g)) sameFileRefs.add(m[1])

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

const toDelete = new Set()
for (const [name, lineIdxs] of definitions) {
  if (contents.some((c) => c.includes(name))) continue
  if (sameFileRefs.has(name)) continue
  for (const idx of lineIdxs) toDelete.add(idx)
}

const kept = lines.filter((_, i) => !toDelete.has(i))
writeFileSync(TOKENS_FILE, kept.join('\n'))
console.log(`删除 ${toDelete.size} 行定义（涉及 ${new Set([...toDelete].map((i) => lines[i].match(defRe)?.[1])).size} 个 token）`)
