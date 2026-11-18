#!/usr/bin/env node

/**
 * SDK 别名双向校验脚本
 *
 * 校验两件事：
 *   A. **正向**：`build/config/sdk-aliases.ts` 里每条别名的目标文件在
 *      `node_modules/matrix-js-sdk/src/` 下确实存在（SDK 升级后子路径可能被移走）。
 *   B. **反向**：`src/**` 里实际 import 的每个 `matrix-js-sdk/<subpath>` 都必须被
 *      别名表覆盖（或命中 `matrix-js-sdk/src` 前缀）。
 *
 * 为什么必须双向（2026-11-18 事故）：
 *   Vite 的 `resolve.alias` 是**字符串前缀替换**，而表末尾有一条兜底
 *   `matrix-js-sdk → <pkg>/src/index.ts`。因此未登记的子路径会被拼成
 *   `src/index.ts/server-capabilities`，dev server 报 `Failed to resolve import`，
 *   `__TJG_APP_READY__` 永不置真 —— 桌面端整片白屏，而 `vue-tsc` 与既有单向校验全绿。
 *   旧脚本只做 A，于是「代码里新增了子路径 import」这条路完全无保护。
 *
 * 另外：别名表此前在本脚本与 `sdk-aliases.ts` 各写一份，靠注释提醒同步。
 * 现在改为从 `.ts` 解析同一份数据，消除双写漂移。
 *
 * Usage:
 *   node scripts/verify-sdk-aliases.mjs          # verify (CI / pre-merge)
 *   node scripts/verify-sdk-aliases.mjs --json   # machine-readable
 *
 * Exit codes: 0 双向均通过 / 1 存在缺失或未覆盖 / 2 扫描失败（含基数不足）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sdkSrcRoot = path.join(repoRoot, 'node_modules', 'matrix-js-sdk', 'src')
const aliasTsPath = path.join(repoRoot, 'build', 'config', 'sdk-aliases.ts')
const srcRoot = path.join(repoRoot, 'src')

const useJson = process.argv.includes('--json')

/** 反向扫描的基数地板：低于此值视为扫描失效。 */
const MIN_IMPORTED_SUBPATHS = 10

/** 从 sdk-aliases.ts 解析 `{ alias: '...', segments: [...] }` 条目。 */
function parseAliasEntries() {
  const text = fs.readFileSync(aliasTsPath, 'utf8')
  const entryRe = /\{\s*alias:\s*'([^']+)',\s*segments:\s*\[([^\]]*)\]\s*\}/g
  const entries = []
  for (const m of text.matchAll(entryRe)) {
    const segments = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])
    entries.push({ alias: m[1], segments })
  }
  return entries
}

/** 递归收集 src 下的 ts/vue 文件。 */
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue
      walk(full, acc)
    } else if (entry.isFile() && /\.(ts|vue)$/.test(entry.name)) {
      acc.push(full)
    }
  }
  return acc
}

/** 收集 src 里实际 import 的 SDK 子路径（跳过注释行）。 */
function collectImportedSubpaths() {
  const found = new Map()
  const importRe = /from\s+['"]matrix-js-sdk\/([^'"]+)['"]/g
  for (const file of walk(srcRoot)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, idx) => {
      // 跳过注释行：类型注释里会出现示例 import，不能算真实依赖
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      for (const m of line.matchAll(importRe)) {
        const sub = m[1]
        if (!found.has(sub)) found.set(sub, [])
        found.get(sub).push(`${path.relative(repoRoot, file).split(path.sep).join('/')}:${idx + 1}`)
      }
    })
  }
  return found
}

function main() {
  if (!fs.existsSync(sdkSrcRoot)) {
    const msg = `SDK src directory not found: ${sdkSrcRoot}\nRun \`pnpm install\` first.`
    if (useJson) console.log(JSON.stringify({ ok: false, error: msg, missing: [], total: 0 }, null, 2))
    else console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`)
    process.exit(1)
  }

  let sdkAliasEntries
  try {
    sdkAliasEntries = parseAliasEntries()
  } catch (err) {
    console.error(`\x1b[31m[ERROR]\x1b[0m 无法解析 ${path.relative(repoRoot, aliasTsPath)}：${err.message}`)
    process.exit(2)
  }
  if (sdkAliasEntries.length < 10) {
    console.error(`\x1b[31m[ERROR]\x1b[0m 只解析到 ${sdkAliasEntries.length} 条别名，视为解析失效`)
    process.exit(2)
  }

  // —— A. 正向：别名目标存在 ——
  const missing = []
  const ok = []
  for (const entry of sdkAliasEntries) {
    const targetPath = path.join(sdkSrcRoot, ...entry.segments)
    if (entry.segments.length === 0 || fs.existsSync(targetPath)) ok.push({ alias: entry.alias, path: targetPath })
    else missing.push({ alias: entry.alias, path: targetPath, segments: entry.segments })
  }

  // —— B. 反向：src 的 import 必须被覆盖 ——
  const imported = collectImportedSubpaths()
  if (imported.size < MIN_IMPORTED_SUBPATHS) {
    console.error(
      `\x1b[31m[ERROR]\x1b[0m 反向扫描只找到 ${imported.size} 个 SDK 子路径（地板 ${MIN_IMPORTED_SUBPATHS}）—— 视为扫描失效`
    )
    process.exit(2)
  }

  // 前缀匹配：`matrix-js-sdk/src` 覆盖 `matrix-js-sdk/src/foo`；别名是字符串前缀替换
  const aliasSubpaths = sdkAliasEntries
    .map((e) => e.alias)
    .filter((a) => a !== 'matrix-js-sdk')
    .map((a) => a.replace(/^matrix-js-sdk\//, ''))
  const covered = (sub) => aliasSubpaths.some((a) => sub === a || sub.startsWith(`${a}/`))

  const uncovered = []
  for (const [sub, refs] of imported) {
    if (!covered(sub)) uncovered.push({ subpath: sub, refs: refs.slice(0, 3), count: refs.length })
  }
  uncovered.sort((a, b) => b.count - a.count)

  const payload = {
    ok: missing.length === 0 && uncovered.length === 0,
    total: sdkAliasEntries.length,
    passed: ok.length,
    missing: missing.length,
    missingDetails: missing,
    importedSubpaths: imported.size,
    uncoveredSubpaths: uncovered.length,
    uncoveredDetails: uncovered
  }

  if (useJson) {
    console.log(JSON.stringify(payload, null, 2))
    process.exit(payload.ok ? 0 : 1)
  }

  console.log('\n  SDK Alias Verification (bidirectional)')
  console.log(`  ${'─'.repeat(56)}`)
  console.log(`  Aliases defined:        ${sdkAliasEntries.length}`)
  console.log(`  Alias targets existing: \x1b[32m${ok.length}\x1b[0m`)
  console.log(`  SDK subpaths imported:  ${imported.size}`)

  let failed = false

  if (missing.length > 0) {
    failed = true
    console.log(`  Missing targets:        \x1b[31m${missing.length}\x1b[0m`)
    console.log(`  ${'─'.repeat(56)}`)
    console.log('\n  \x1b[31m[FAIL]\x1b[0m 以下别名指向不存在的文件：\n')
    for (const m of missing) {
      console.log(`    \x1b[33m${m.alias}\x1b[0m`)
      console.log(`      -> ${path.relative(repoRoot, m.path)}`)
      console.log(`      segments: [${m.segments.map((s) => `'${s}'`).join(', ')}]\n`)
    }
  }

  if (uncovered.length > 0) {
    failed = true
    console.log(`  Uncovered subpaths:     \x1b[31m${uncovered.length}\x1b[0m`)
    console.log(`  ${'─'.repeat(56)}`)
    console.log('\n  \x1b[31m[FAIL]\x1b[0m 代码 import 了未登记的 SDK 子路径：\n')
    for (const u of uncovered) {
      console.log(`    \x1b[33mmatrix-js-sdk/${u.subpath}\x1b[0m  (${u.count} 处)`)
      for (const r of u.refs) console.log(`      - ${r}`)
    }
    console.log(
      '\n  未登记的子路径会命中末尾兜底 `matrix-js-sdk → src/index.ts`，被拼成' +
        '\n  `src/index.ts/<subpath>` ⇒ dev server `Failed to resolve import`。' +
        '\n  请在 build/config/sdk-aliases.ts 补一条（值导入必炸，类型导入暂不炸但同样要补）。\n'
    )
  }

  if (failed) process.exit(1)

  console.log('  Missing targets:        0')
  console.log('  Uncovered subpaths:     0')
  console.log(`  ${'─'.repeat(56)}`)
  console.log(`  \x1b[32m[PASS]\x1b[0m 别名双向校验通过（目标存在 + import 全覆盖）。\n`)
}

main()
