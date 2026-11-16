/**
 * 设备探针的公共运行时守卫。
 *
 * 两类「会让结论变成假的」前置问题，都在这里收口：
 * 1. **APK 陈旧**：debug 包走 `devUrl`，前端不用重打；但 `src-tauri/**` 改了没重打，
 *    设备上跑的就是旧 Rust（2026-11-14 实测：D2-R 的 `lib.rs` 修复没进包，探针却全绿）。
 * 2. **状态残留**：上一支探针还登录着，下一支走到「填表」时页面上根本没有登录表单
 *    （实测：焚毁探针 2 红、E2EE 首跑 3 红，都只是这个）。
 */

import { execFileSync } from 'node:child_process'
import { checkApkFreshness, formatMtime } from './apk-freshness.mjs'

/** `PROBE_KEEP_STATE=1` 时跳过清数据（调试用，正常跑别开） */
export const SKIP_RESET = process.env.PROBE_KEEP_STATE === '1'

/**
 * 清空 App 数据，返回是否真的执行了。
 *
 * 注意 `pm clear` 会清掉本地会话与 dbKey ⇒ App 回到首次启动（登录页）。
 * 依赖「保留上一阶段状态」的探针（如 `e2ee-two-androids` 的 S3 冷启动恢复）
 * 只能在**脚本开头**清一次，不能在每次启动 App 前清。
 */
export function resetAppState(adbBin, serial, pkg = 'com.tjg.app') {
  if (SKIP_RESET) return false
  try {
    execFileSync(adbBin, ['-s', serial, 'shell', 'pm', 'clear', pkg], { encoding: 'utf8', timeout: 30000 })
    return true
  } catch {
    return false
  }
}

/**
 * APK 陈旧时打横幅提示；`PROBE_REQUIRE_FRESH_APK=1` 时直接抛错中止。
 *
 * 默认只警告不中止：多数探针测的是前端/服务端行为，旧 Rust 不必然影响结论；
 * 但只要跑的是「原生层修复」相关判据（D2-R、深链、权限），就必须开 `PROBE_REQUIRE_FRESH_APK=1`。
 */
export function guardApkFreshness({ requireFresh = process.env.PROBE_REQUIRE_FRESH_APK === '1' } = {}) {
  const status = checkApkFreshness({ apkPath: process.env.APK_PATH })
  if (status.status !== 'stale') return status

  const lines = status.staleInputs
    .slice(0, 3)
    .map((item) => `   ${formatMtime(item.mtime)}  ${item.rel}`)
    .join('\n')
  console.warn(
    `\n⚠️  APK（${formatMtime(status.apkMtime)}）比 ${status.staleInputs.length} 个原生输入旧，` +
      `设备上跑的是旧 Rust：\n${lines}\n` +
      '   重打步骤见 docs/TJG-前后端联调测试报告-2026-11-05.md §5.1' +
      (requireFresh ? '\n   （PROBE_REQUIRE_FRESH_APK=1 ⇒ 中止）\n' : '（仅警告）\n')
  )
  if (requireFresh) throw new Error('APK 陈旧，拒绝在旧 Rust 上取证（PROBE_REQUIRE_FRESH_APK=1）')
  return status
}
