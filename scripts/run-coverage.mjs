#!/usr/bin/env node
/**
 * `check:coverage` 的测试执行段包装。
 *
 * ## 为什么需要它
 *
 * 本机沙箱的 `SAFE_DELETE` 钩子会把 vitest 的**收尾清理**（删 `coverage/.tmp`）拦下，
 * 于是 vitest 以一个「测试全过但进程退出码 1」的状态结束。若直接用
 * `node run-vitest.js run --coverage` 配 `&&`，覆盖率地板检查就永远跑不到。
 *
 * 但如果为了跑通就把退出码一律当成功，又会掩盖**真正的测试失败** —— 所以必须区分：
 *
 * | 场景 | 输出特征 | 处置 |
 * |---|---|---|
 * | 正常通过 | `Tests N passed` + exit 0 | exit 0 |
 * | 收尾清理被拦 | `Tests N passed` + 无 failed + `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 且目标含 `coverage/.tmp` | **exit 0 + 显式警告** |
 * | 启动阶段被拦（旧 coverage 残留） | **没有** `Tests` 汇总行 + SAFE_DELETE | exit 1（测试根本没跑，不能放行） |
 * | 测试真失败 | `Tests ... failed` | exit 1 |
 * | 其他异常 | — | exit 1 |
 *
 * 判据的核心是「**有没有跑出用例汇总**」：只有真的跑完所有用例才会有 `Tests` 那一行。
 * 因此启动阶段被拦时不可能误判为成功。
 *
 * ## 用法
 *
 *   node scripts/run-coverage.mjs
 *
 * 环境变量：
 *   COVERAGE_ALLOW_CLEANUP_BLOCK=0  关掉「收尾被拦放行」（严格模式，用于排查）
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const allowCleanupBlock = process.env.COVERAGE_ALLOW_CLEANUP_BLOCK !== '0'
const COVERAGE_DIR = path.join(ROOT, 'coverage')

// 先清上一次的产物。vitest 启动时自己也会清，但它的清理会被沙箱 SAFE_DELETE 钩子拦
// （`coverage/` 动辄 1800+ 文件，远超 50 的批量阈值），于是测试根本没跑就中止。
// 这里提前清掉，把「环境限制」与「测试失败」分开报：
//   - 清成功 ⇒ 继续跑；
//   - 清被拦 ⇒ exit **2**（环境/前置不满足），而不是 1（测试失败），避免误判。
try {
  if (existsSync(COVERAGE_DIR)) rmSync(COVERAGE_DIR, { recursive: true, force: true })
} catch (err) {
  const msg = String(err)
  if (/SAFE_DELETE/.test(msg)) {
    console.error(
      '\n[run-coverage] ⛔ 无法清理上一次的 coverage/ —— 被沙箱 SAFE_DELETE 批量删除保护拦下。\n' +
        '             vitest 启动时也会尝试清理并同样被拦，测试将无法开始。\n' +
        '             请在终端里手动执行：rm -rf coverage   然后重跑。\n' +
        '             （退出码 2 = 环境/前置不满足，不是测试失败）\n'
    )
    process.exit(2)
  }
  throw err
}

const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/run-vitest.js'), 'run', '--coverage'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
})
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
process.stdout.write(out)

if (r.status === 0) process.exit(0)

/** vitest 的用例汇总行，例如 `Tests  12311 passed (12311)` 或 `Tests  1 failed | 12310 passed` */
const summary = out.match(/^\s*Tests\s+(.+)$/m)?.[1] ?? null
const ranAll = summary !== null
const hasFailure = summary !== null && /\bfailed\b/.test(summary)
const cleanupBlocked =
  /SAFE_DELETE_BULK_CONFIRM_REQUIRED/.test(out) && /coverage[/\\]\.tmp/.test(out)

if (allowCleanupBlock && ranAll && !hasFailure && cleanupBlocked) {
  console.warn(
    '\n[run-coverage] ⚠️ 测试已全部通过（' +
      summary.trim() +
      '），但 vitest 收尾清理 coverage/.tmp 被沙箱 SAFE_DELETE 钩子拦下，退出码非零。\n' +
      '             本包装据此放行（用例汇总行存在且无 failed），覆盖率断言继续由下一步执行。\n' +
      '             如需严格模式（不放行）：COVERAGE_ALLOW_CLEANUP_BLOCK=0\n'
  )
  process.exit(0)
}

if (!ranAll) {
  console.error(
    '\n[run-coverage] ❌ 没有拿到用例汇总行 —— 测试很可能在**启动阶段**就被中止了。\n' +
      '             常见原因：旧的 coverage/ 目录存在，vitest 清理时被 SAFE_DELETE 拦。\n' +
      '             处置：先删掉 coverage/ 再跑（rm -rf coverage）。\n'
  )
} else if (hasFailure) {
  console.error(`\n[run-coverage] ❌ 有用例失败：${summary.trim()}\n`)
}

process.exit(1)
