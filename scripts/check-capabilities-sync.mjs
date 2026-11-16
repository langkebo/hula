#!/usr/bin/env node
/**
 * 校验 `src-tauri/gen/schemas/capabilities.json` 与源 `src-tauri/capabilities/*.json` 是否一致。
 *
 * 为什么要这一条：`gen/schemas/capabilities.json` 是 **tauri-build 在构建时生成的**，
 * 但它也被提交进仓库（CI / 编辑器 / 文档引用它）。这样一来就存在两个事实源：
 * 谁改了 `capabilities/*.json` 却没跑过一次构建，仓库里的生成物就是**过期的**，
 * 而且**不会有任何报错** —— 2026-11-14 实测：`default.json` 的 `opener:allow-open-url`
 * 已经加了 `x-apple.systempreferences:*` / `ms-settings:*`，生成物里还是只有 3 条。
 *
 * 生成物过期不是「文档不同步」这种小事：capability 是**运行时权限边界**，
 * 按生层物审查会得出错误的权限结论。
 *
 * 判据（不做 permission set 的传递闭包，只做逐条对应，够抓漂移且不假阳性）：
 *   1. 每个源 capability 的 identifier 必须在生成物里出现；
 *   2. 生成物里不得有源中已删除的 identifier；
 *   3. 源的每个 permission 必须在生成物里存在（字符串相等 / 对象 identifier 相等）；
 *   4. 对象形式的 `allow` 必须**双向**相等（少 = 生成物过期；多 = 源已删但生成物残留）。
 *
 * 用法：node scripts/check-capabilities-sync.mjs（退出码 1 = 漂移）
 * 修法：`cd src-tauri && cargo check`（build.rs 里的 tauri-build 会重写生成物）
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'src-tauri/capabilities')
const GEN_FILE = join(ROOT, 'src-tauri/gen/schemas/capabilities.json')

/** 把对象形式 permission 归一化成可比较的字符串（allow 排序后拼） */
const normalizePermission = (perm) => {
  if (typeof perm === 'string') return perm
  const allow = (perm.allow ?? [])
    .map((item) => JSON.stringify(item))
    .sort()
    .join(',')
  return `${perm.identifier}|${allow}`
}

/** 拆出 identifier 与 allow 明细，便于报具体差异 */
const splitPermission = (perm) =>
  typeof perm === 'string'
    ? { identifier: perm, allow: [] }
    : { identifier: perm.identifier, allow: (perm.allow ?? []).map((item) => JSON.stringify(item)) }

const problems = []

if (!existsSync(GEN_FILE)) {
  console.log('[capabilities-sync] SKIP — 尚无生成物（先跑一次 `cd src-tauri && cargo check`）')
  process.exit(0)
}

const generated = JSON.parse(readFileSync(GEN_FILE, 'utf8'))
const sources = readdirSync(SRC_DIR)
  .filter((name) => name.endsWith('.json'))
  .map((name) => ({ file: `src-tauri/capabilities/${name}`, data: JSON.parse(readFileSync(join(SRC_DIR, name), 'utf8')) }))

const sourceIdentifiers = new Set(sources.map((item) => item.data.identifier))

for (const { file, data } of sources) {
  const cap = generated[data.identifier]
  if (!cap) {
    problems.push(`${file}: identifier \`${data.identifier}\` 不在生成物里（生成物完全过期）`)
    continue
  }

  const generatedPermissions = (cap.permissions ?? []).map(splitPermission)
  const generatedById = new Map()
  for (const perm of generatedPermissions) {
    if (!generatedById.has(perm.identifier)) generatedById.set(perm.identifier, [])
    generatedById.get(perm.identifier).push(perm.allow)
  }

  for (const perm of data.permissions ?? []) {
    const want = splitPermission(perm)
    const candidates = generatedById.get(want.identifier)
    if (!candidates) {
      problems.push(`${file}: 生成物缺 permission \`${want.identifier}\``)
      continue
    }
    // 字符串 permission 到这里就等价了；对象形式再比 allow 双向差异
    if (want.allow.length === 0) continue
    const got = candidates.flat()
    const missing = want.allow.filter((item) => !got.includes(item))
    const extra = got.filter((item) => !want.allow.includes(item))
    if (missing.length) {
      problems.push(`${file}: \`${want.identifier}\` 的 allow 少 ${missing.length} 条（生成物过期）：${missing.join(', ')}`)
    }
    if (extra.length) {
      problems.push(`${file}: \`${want.identifier}\` 的 allow 多 ${extra.length} 条（源已删、生成物残留）：${extra.join(', ')}`)
    }
  }
}

for (const identifier of Object.keys(generated)) {
  if (!sourceIdentifiers.has(identifier)) {
    problems.push(`生成物里的 \`${identifier}\` 在源中已不存在（残留）`)
  }
}

if (problems.length === 0) {
  console.log(`[capabilities-sync] OK — ${sources.length} 个源 capability 与生成物一致`)
  for (const { data } of sources) {
    const count = (generated[data.identifier]?.permissions ?? []).length
    console.log(`  ${data.identifier}: ${count} permissions`)
  }
  process.exit(0)
}

console.log(`[capabilities-sync] FAIL — ${problems.length} 处漂移：`)
for (const problem of problems) console.log(`  - ${problem}`)
console.log('[capabilities-sync] 修法：`cd src-tauri && cargo check`（tauri-build 会重写 gen/schemas/capabilities.json）')
process.exit(1)
