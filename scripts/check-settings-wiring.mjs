#!/usr/bin/env node
/**
 * Ratchet：设置窗口写入的 localStorage key 必须在窗口之外有消费方。
 *
 * 判据（刻意保守，避免误报）：
 * - 只统计 src/views/settingsWindow 下 .vue 文件里 localStorage.setItem('key', ...) 的 key
 * - 一个 key 算"有消费方"当且仅当在设置窗口之外的 .ts/.vue 中出现 'key' 字面量
 * - 精确匹配带引号的 key，避免 --tjg-font-size-* 这类 CSS token 干扰
 * - 排除 __tests__（测试自己写 key 不算消费方）
 *
 * 数量只能减少：--update 收紧基线，增加即失败。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src'
const SW = 'src/views/settingsWindow'
const BASELINE = 'scripts/settings-wiring-baseline.json'

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|vue)$/.test(entry)) files.push(full)
  }
})(ROOT)

const sources = files.map((f) => ({ path: f, text: readFileSync(f, 'utf8') }))

const written = new Map()
for (const { path, text } of sources) {
  if (!path.startsWith(SW) || path.includes('__tests__')) continue
  for (const m of text.matchAll(/localStorage\.setItem\(\s*'([^']+)'/g)) {
    if (!written.has(m[1])) written.set(m[1], path)
  }
}

const consumers = ({ path, text }, key) => !path.startsWith(SW) && text.includes(`'${key}'`)
const dead = [...written.entries()]
  .filter(([key]) => !sources.some((s) => consumers(s, key)))
  .map(([key, path]) => ({ key, path }))
  .sort((a, b) => a.key.localeCompare(b.key))

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { deadKeys: dead.length }

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ deadKeys: dead.length, deadKeyNames: dead.map((d) => d.key) }, null, 2)}\n`)
  console.log(`check-settings-wiring: 基线已更新为 ${dead.length}`)
  process.exit(0)
}

if (dead.length > baseline.deadKeys) {
  console.error(`check-settings-wiring: FAIL — 死配置 ${dead.length} > 基线 ${baseline.deadKeys}`)
  for (const d of dead) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
  console.error('新增设置项必须有真实消费方，或先用 --update 说明理由。')
  process.exit(1)
}

console.log(`check-settings-wiring: OK 死配置 ${dead.length}（基线 ${baseline.deadKeys}）`)
if (dead.length < baseline.deadKeys) {
  console.log('  可运行 node scripts/check-settings-wiring.mjs --update 收紧基线')
}
