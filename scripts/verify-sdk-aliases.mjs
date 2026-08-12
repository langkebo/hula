#!/usr/bin/env node

/**
 * SDK 别名路径校验脚本
 *
 * 验证 build/config/sdk-aliases.ts 中定义的所有别名路径在
 * node_modules/matrix-js-sdk/src/ 下是否仍然存在。
 *
 * SDK 升级或内部重构后，某些子路径可能被移动或删除，
 * 此脚本在 CI 中提前拦截，避免构建时才报错。
 *
 * Usage:
 *   node scripts/verify-sdk-aliases.mjs          # verify (CI / pre-merge)
 *   node scripts/verify-sdk-aliases.mjs --json   # output JSON for tooling
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sdkSrcRoot = path.join(repoRoot, 'node_modules', 'matrix-js-sdk', 'src')

// 别名定义（与 build/config/sdk-aliases.ts 保持同步）
// 此处硬编码是因为 .ts 配置文件无法在 .mjs 脚本中直接 import（无 tsx runner）
// 如果别名有变更，两侧都需更新。CI 中的 check:sdk-types 会间接覆盖类型层面。
const sdkAliasEntries = [
  { alias: 'matrix-js-sdk/src', segments: [] },
  { alias: 'matrix-js-sdk/friend', segments: ['friend', 'index.ts'] },
  { alias: 'matrix-js-sdk/crypto', segments: ['crypto-api', 'index.ts'] },
  { alias: 'matrix-js-sdk/dm', segments: ['dm', 'index.ts'] },
  { alias: 'matrix-js-sdk/voice', segments: ['voice', 'index.ts'] },
  { alias: 'matrix-js-sdk/push', segments: ['push', 'index.ts'] },
  { alias: 'matrix-js-sdk/space', segments: ['space', 'index.ts'] },
  { alias: 'matrix-js-sdk/admin', segments: ['admin', 'index.ts'] },
  { alias: 'matrix-js-sdk/beacon', segments: ['beacon', 'index.ts'] },
  { alias: 'matrix-js-sdk/client', segments: ['client.ts'] },
  { alias: 'matrix-js-sdk/sync', segments: ['sync.ts'] },
  { alias: 'matrix-js-sdk/models/room', segments: ['models', 'room.ts'] },
  { alias: 'matrix-js-sdk/models/room-state', segments: ['models', 'room-state.ts'] },
  { alias: 'matrix-js-sdk/http-api', segments: ['http-api', 'index.ts'] },
  { alias: 'matrix-js-sdk/manager-extensions', segments: ['manager-extensions', 'index.ts'] },
  { alias: 'matrix-js-sdk/store/worker', segments: ['store', 'indexeddb-store-worker.ts'] },
  { alias: 'matrix-js-sdk/account', segments: ['account', 'index.ts'] },
  { alias: 'matrix-js-sdk/auth', segments: ['auth', 'index.ts'] },
  { alias: 'matrix-js-sdk/capabilities', segments: ['capabilities', 'index.ts'] },
  { alias: 'matrix-js-sdk/room', segments: ['room', 'index.ts'] },
  { alias: 'matrix-js-sdk/media', segments: ['media', 'index.ts'] },
  { alias: 'matrix-js-sdk/profile', segments: ['profile', 'index.ts'] },
  { alias: 'matrix-js-sdk/presence', segments: ['presence', 'index.ts'] },
  { alias: 'matrix-js-sdk/sending', segments: ['sending', 'index.ts'] },
  { alias: 'matrix-js-sdk/crypto-keys', segments: ['crypto-keys', 'index.ts'] },
  { alias: 'matrix-js-sdk/device', segments: ['device', 'index.ts'] },
  { alias: 'matrix-js-sdk/telemetry', segments: ['telemetry', 'index.ts'] },
  { alias: 'matrix-js-sdk/rendezvous', segments: ['rendezvous', 'index.ts'] },
  { alias: 'matrix-js-sdk', segments: ['index.ts'] }
]

const useJson = process.argv.includes('--json')

// --- 检查 SDK src 目录是否存在 ---
if (!fs.existsSync(sdkSrcRoot)) {
  const msg = `SDK src directory not found: ${sdkSrcRoot}\nRun \`pnpm install\` first.`
  if (useJson) {
    console.log(JSON.stringify({ ok: false, error: msg, missing: [], total: 0 }, null, 2))
  } else {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`)
  }
  process.exit(1)
}

// --- 逐条校验别名路径 ---
const missing = []
const ok = []

for (const entry of sdkAliasEntries) {
  const targetPath = path.join(sdkSrcRoot, ...entry.segments)

  // segments 为空数组时，检查的是 src 目录本身（一定存在）
  if (entry.segments.length === 0) {
    ok.push({ alias: entry.alias, path: targetPath })
    continue
  }

  if (fs.existsSync(targetPath)) {
    ok.push({ alias: entry.alias, path: targetPath })
  } else {
    missing.push({ alias: entry.alias, path: targetPath, segments: entry.segments })
  }
}

// --- 输出结果 ---
if (useJson) {
  console.log(
    JSON.stringify(
      {
        ok: missing.length === 0,
        total: sdkAliasEntries.length,
        passed: ok.length,
        missing: missing.length,
        missingDetails: missing
      },
      null,
      2
    )
  )
} else {
  console.log(`\n  SDK Alias Verification`)
  console.log(`  ${'─'.repeat(50)}`)
  console.log(`  Total aliases:  ${sdkAliasEntries.length}`)
  console.log(`  Passed:         \x1b[32m${ok.length}\x1b[0m`)

  if (missing.length > 0) {
    console.log(`  Missing:        \x1b[31m${missing.length}\x1b[0m`)
    console.log(`  ${'─'.repeat(50)}`)
    console.log(`\n  \x1b[31m[FAIL]\x1b[0m The following alias target paths do not exist:\n`)
    for (const m of missing) {
      console.log(`    \x1b[33m${m.alias}\x1b[0m`)
      console.log(`      -> ${path.relative(repoRoot, m.path)}`)
      console.log(`      segments: [${m.segments.map((s) => `'${s}'`).join(', ')}]\n`)
    }
    console.log(
      `  These paths may have been moved or removed in the SDK.\n` +
        `  Update build/config/sdk-aliases.ts and this script accordingly.\n`
    )
    process.exit(1)
  } else {
    console.log(`  Missing:        0`)
    console.log(`  ${'─'.repeat(50)}`)
    console.log(`  \x1b[32m[PASS]\x1b[0m All SDK alias paths verified.\n`)
  }
}
