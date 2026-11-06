#!/usr/bin/env node
/**
 * 设计令牌使用率守卫（OP-24）
 *
 * - 统计 design-tokens.css 中定义的 --tjg-* 令牌，被 src / uno.config.ts / index.html
 *   引用（var(--x) 或裸令牌名）即视为存活；同文件内被其他令牌 var() 引用也算存活。
 * - 使用率低于阈值、或出现基线之外的新增零引用令牌时失败。
 * - 基线文件 scripts/token-usage-baseline.json 冻结存量例外，只允许减少不允许增加。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = process.cwd()
const TOKENS_FILE = join(ROOT, 'src/styles/css/design-tokens.css')
const BASELINE_FILE = join(ROOT, 'scripts/token-usage-baseline.json')
const MIN_USAGE_RATE = 0.85

const css = readFileSync(TOKENS_FILE, 'utf8')
const tokenRe = /(^|\s)(--tjg-[\w-]+)\s*:/gm
const names = new Set()
for (const match of css.matchAll(tokenRe)) names.add(match[2])

const definitionRefs = new Set()
for (const match of css.matchAll(/var\((--tjg-[\w-]+)/g)) definitionRefs.add(match[1])

const exts = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx', '.scss', '.css', '.html'])
const corpus = []
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue
      walk(p)
    } else if (exts.has(p.slice(p.lastIndexOf('.'))) && resolve(p) !== resolve(TOKENS_FILE)) {
      corpus.push(readFileSync(p, 'utf8'))
    }
  }
}
walk(join(ROOT, 'src'))
for (const extra of [join(ROOT, 'uno.config.ts'), join(ROOT, 'index.html')]) {
  if (existsSync(extra)) corpus.push(readFileSync(extra, 'utf8'))
}
const haystack = corpus.join('\n')

const zeroRef = [...names].filter((name) => !haystack.includes(name) && !definitionRefs.has(name))
const usageRate = names.size === 0 ? 1 : (names.size - zeroRef.length) / names.size

const baseline = existsSync(BASELINE_FILE)
  ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
  : { allowlist: [] }
const allowlist = new Set(baseline.allowlist ?? [])
const regressions = zeroRef.filter((name) => !allowlist.has(name))

console.log(`设计令牌总数: ${names.size}`)
console.log(`零引用令牌: ${zeroRef.length}${zeroRef.length ? ` (${zeroRef.join(', ')})` : ''}`)
console.log(`使用率: ${(usageRate * 100).toFixed(1)}% (阈值 ${(MIN_USAGE_RATE * 100).toFixed(0)}%)`)

if (regressions.length > 0) {
  console.error(`\n新增零引用令牌: ${regressions.join(', ')}`)
  console.error('请删除或接入使用；确需保留时加入 scripts/token-usage-baseline.json 并说明原因。')
}
if (usageRate < MIN_USAGE_RATE) {
  console.error(`\n令牌使用率低于阈值: ${(usageRate * 100).toFixed(1)}% < ${(MIN_USAGE_RATE * 100).toFixed(0)}%`)
}
process.exit(regressions.length > 0 || usageRate < MIN_USAGE_RATE ? 1 : 0)
