#!/usr/bin/env node
/**
 * 校验设备侧 debug APK 是否**晚于全部原生输入**。
 *
 * 背景与判据见 `scripts/lib/apk-freshness.mjs` 的注释；一句话：
 * debug 包走 `devUrl`（前端不用重打），但 `src-tauri/**` 的改动必须重打，
 * 否则设备上跑的是旧 Rust，而探针照样全绿 —— 那结论是假的。
 *
 * 用法：
 *   node scripts/check-apk-freshness.mjs            # 人读输出
 *   node scripts/check-apk-freshness.mjs --json     # 机器读（探针内部调用）
 *   APK_PATH=... node scripts/check-apk-freshness.mjs
 *
 * 退出码：0 = 新鲜 / 尚未打包（不构成失败）；1 = APK 早于原生输入。
 */

import { checkApkFreshness, formatMtime } from './lib/apk-freshness.mjs'

const asJson = process.argv.includes('--json')
const status = checkApkFreshness({ apkPath: process.env.APK_PATH })

if (asJson) {
  console.log(JSON.stringify(status))
} else if (status.status === 'missing') {
  console.log(`[apk-freshness] SKIP — 尚未打包：${status.apkPath}`)
  console.log('[apk-freshness] 需要设备端取证时按 docs/TJG-前后端联调测试报告-2026-11-05.md §5.1 打包')
} else if (status.status === 'fresh') {
  console.log(`[apk-freshness] APK     ${status.apkPath}  ${formatMtime(status.apkMtime)}`)
  console.log(`[apk-freshness] 原生输入最新  ${formatMtime(status.newest?.mtime)}  ${status.newest?.rel ?? '—'}`)
  console.log('[apk-freshness] OK — APK 晚于全部原生输入（前端走 devUrl，不参与判定）')
} else {
  console.log(`[apk-freshness] APK     ${status.apkPath}  ${formatMtime(status.apkMtime)}`)
  console.log(`[apk-freshness] FAIL — ${status.staleInputs.length} 个原生输入比 APK 新（设备上跑的是旧 Rust）：`)
  for (const item of status.staleInputs.slice(0, 5)) {
    console.log(`  ${formatMtime(item.mtime)}  ${item.rel}`)
  }
  if (status.staleInputs.length > 5) console.log(`  …另有 ${status.staleInputs.length - 5} 个`)
  console.log('[apk-freshness] 重打步骤见 docs/TJG-前后端联调测试报告-2026-11-05.md §5.1')
}

process.exitCode = status.status === 'stale' ? 1 : 0
