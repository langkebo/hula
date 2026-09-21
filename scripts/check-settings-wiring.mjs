#!/usr/bin/env node
/**
 * Ratchet：设置窗口写入的 localStorage key 必须在窗口之外有消费方。
 *
 * 判据（刻意保守，避免误报）：
 * - 只统计 src/views/settingsWindow 下 .vue 文件里写入的 key
 * - 写入形式：localStorage.setItem('key', ...) 字面量，或 localStorage.setItem(NAME, ...)
 *   且 NAME 在同一文件里由 const NAME = 'key' 单引号字面量声明；解析不了就跳过，不猜
 * - 一个 key 算"有消费方"当且仅当在设置窗口之外的 .ts/.vue 中出现 'key' 字面量
 * - 精确匹配带引号的 key，避免 --tjg-font-size-* 这类 CSS token 干扰
 * - 写入方和消费方都排除 __tests__（测试自己写/引用 key 不算真实接线）
 * - 基线缺失或结构不合法时直接失败，绝不静默退化为 exit 0 空转
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

// 写入形式一：localStorage.setItem('tjg-xxx', ...) 直接字面量
const WRITE_LITERAL = /localStorage\.setItem\(\s*'([^']+)'/g
// 写入形式二：localStorage.setItem(NAME, ...) 间接常量
const WRITE_ALIAS = /localStorage\.setItem\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g
// 同文件内的简单常量别名：const NAME = 'tjg-xxx'
const LOCAL_CONST_LITERAL = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*'([^']+)'/g

const written = new Map()
const record = (key, path) => {
  if (!written.has(key)) written.set(key, path)
}

for (const { path, text } of sources) {
  if (!path.startsWith(SW) || path.includes('__tests__')) continue

  for (const m of text.matchAll(WRITE_LITERAL)) record(m[1], path)

  const aliases = new Map()
  for (const m of text.matchAll(LOCAL_CONST_LITERAL)) {
    if (!aliases.has(m[1])) aliases.set(m[1], m[2])
  }
  for (const m of text.matchAll(WRITE_ALIAS)) {
    const key = aliases.get(m[1])
    // 解析不到字面量就跳过，不猜、不伪造
    if (key === undefined) continue
    record(key, path)
  }
}

const consumers = ({ path, text }, key) =>
  !path.startsWith(SW) && !path.includes('__tests__') && text.includes(`'${key}'`)
const dead = [...written.entries()]
  .filter(([key]) => !sources.some((s) => consumers(s, key)))
  .map(([key, path]) => ({ key, path }))
  .sort((a, b) => a.key.localeCompare(b.key))

const regenerateHint = '  运行 node scripts/check-settings-wiring.mjs --update 重建基线。'

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ deadKeys: dead.length, deadKeyNames: dead.map((d) => d.key) }, null, 2)}\n`)
  console.log(`check-settings-wiring: 基线已更新为 ${dead.length}`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺失：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch (error) {
  console.error(`check-settings-wiring: FAIL — 基线文件无法解析：${BASELINE}`)
  console.error(`  ${error.message}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (typeof baseline?.deadKeys !== 'number' || !Number.isFinite(baseline.deadKeys)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺少数值型 deadKeys：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
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
