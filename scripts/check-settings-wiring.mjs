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

/**
 * 什么算"消费方"。
 *
 * 关键：**另一个设置界面不算消费方**。否则 mobile 的设置页（只读写自己的开关）
 * 会把一个死 key 判成 live——实测 tjg-debug-mode / tjg-lab-features /
 * tjg-show-performance 只有设置 UI 读写、零运行时消费方，却被旧判据当成 live。
 *
 * 这里刻意保守：宁可多报"死"（给人复核），也不要把死配置判活。
 */
const isSettingsUi = (path) => path.startsWith(SW) || /\/mobile\/views\/.*Settings\.vue$/.test(path)
const consumers = ({ path, text }, key) =>
  !isSettingsUi(path) && !path.includes('__tests__') && text.includes(`'${key}'`)
const dead = [...written.entries()]
  .filter(([key]) => !sources.some((s) => consumers(s, key)))
  .map(([key, path]) => ({ key, path }))
  .sort((a, b) => a.key.localeCompare(b.key))

const regenerateHint = '  运行 node scripts/check-settings-wiring.mjs --update 重建基线。'

/** 读取现有基线；缺失返回 null，损坏返回 'invalid'。 */
function readBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return 'invalid'
  }
}

if (process.argv.includes('--update')) {
  // ratchet 只允许收紧：--update 不能把基线抬高（否则新增死配置会被一次性赦免）
  const previous = readBaseline()
  if (previous && previous !== 'invalid' && typeof previous.deadKeys === 'number' && dead.length > previous.deadKeys) {
    console.error(`check-settings-wiring: 拒绝抬高基线 — 本次 ${dead.length} > 现有 ${previous.deadKeys}`)
    for (const d of dead) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
    console.error('ratchet 只允许收紧：新增设置项必须先给出真实消费方。')
    process.exit(1)
  }
  writeFileSync(BASELINE, `${JSON.stringify({ deadKeys: dead.length, deadKeyNames: dead.map((d) => d.key) }, null, 2)}\n`)
  console.log(`check-settings-wiring: 基线已更新为 ${dead.length}`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺失：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

const baseline = readBaseline()

if (baseline === 'invalid') {
  console.error(`check-settings-wiring: FAIL — 基线文件无法解析：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (typeof baseline?.deadKeys !== 'number' || !Number.isFinite(baseline.deadKeys)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺少数值型 deadKeys：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (!Array.isArray(baseline.deadKeyNames)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺少数组型 deadKeyNames：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (dead.length > baseline.deadKeys) {
  console.error(`check-settings-wiring: FAIL — 死配置 ${dead.length} > 基线 ${baseline.deadKeys}`)
  for (const d of dead) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
  console.error('新增设置项必须有真实消费方，或先用 --update 说明理由。')
  process.exit(1)
}

/**
 * 只比数量会漏掉「修掉一个又引入一个」的等价替换（总数不变）。这里额外断言
 * 当前死配置集合 ⊆ 基线集合：出现基线里没有的 key 一律失败，逼出显式处置。
 */
const baselineNames = new Set(baseline.deadKeyNames)
const unexpected = dead.filter((d) => !baselineNames.has(d.key))
if (unexpected.length > 0) {
  console.error(`check-settings-wiring: FAIL — 出现基线未记录的死配置（换名绕过数量 ratchet）`)
  for (const d of unexpected) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
  console.error('修掉一个又引入一个等价的死配置同样不允许：先接线，或说明理由后更新基线。')
  process.exit(1)
}

console.log(`check-settings-wiring: OK 死配置 ${dead.length}（基线 ${baseline.deadKeys}，键名均在基线内）`)
if (dead.length < baseline.deadKeys) {
  console.log('  可运行 node scripts/check-settings-wiring.mjs --update 收紧基线')
}
