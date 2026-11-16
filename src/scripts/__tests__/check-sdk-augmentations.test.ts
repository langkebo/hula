import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = resolve(process.cwd(), 'scripts/check-sdk-augmentations.mjs')

/**
 * 脚本要遍历 SDK 源码与已安装 `.d.ts`，单次运行在本机约 13–18s。
 * 全量并行跑 `test:run` 时会与其它 real-repo 用例抢 CPU（实测可放大数倍），
 * 故两次断言共用同一次执行结果，并放宽超时上限。
 */
const CHECKER_TIMEOUT_MS = 240_000

interface CheckerRun {
  output: string
  exitCode: number
  sdkMissing: boolean
}

let cachedRun: CheckerRun | null = null

function runChecker(): CheckerRun {
  if (cachedRun) return cachedRun

  let output = ''
  let exitCode = 0
  try {
    output = execSync(`node ${scriptPath} --json`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number }
    output = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')
    exitCode = e.status ?? 0
  }

  cachedRun = { output, exitCode, sdkMissing: exitCode === 2 && output.includes('SDK source not found') }
  return cachedRun
}

/**
 * Smoke test for the SDK augmentation drift checker. The script depends on
 * the sibling `../matrix-js-sdk` repo being present, which it is in this
 * dev environment. We don't assert a pass/fail result (the augmentation
 * has known pending drift that will be cleaned up in a later step) — we
 * only assert the script runs and emits well-formed JSON.
 */
describe('check-sdk-augmentations', () => {
  it(
    'emits JSON with expected top-level shape',
    () => {
      const { output, exitCode, sdkMissing } = runChecker()
      // Exit code 2 = SDK source not found (e.g., in worktree)
      if (sdkMissing) {
        return
      }
      expect([0, 1]).toContain(exitCode)
      const report = JSON.parse(output)
      expect(report).toMatchObject({
        augmentedEnumCount: expect.any(Number),
        canonicalEnumCount: expect.any(Number),
        errors: expect.any(Array),
        warnings: expect.any(Array)
      })
      // 清单 D 清理后 augmentation 可能不再包含任何 enum（与 SDK 重复的声明已移除）
      expect(report.augmentedEnumCount).toBeGreaterThanOrEqual(0)
      expect(report.canonicalEnumCount).toBeGreaterThanOrEqual(0)
    },
    CHECKER_TIMEOUT_MS
  )

  it(
    'reports drift finding shape with type + enum + detail fields',
    () => {
      const { output, sdkMissing } = runChecker()
      if (sdkMissing) {
        return
      }
      const report = JSON.parse(output)
      const allFindings = [...report.errors, ...report.warnings]
      for (const f of allFindings) {
        expect(f).toMatchObject({
          type: expect.stringMatching(
            /^(extra-in-augmentation|missing-in-augmentation|value-mismatch|missing-canonical)$/
          ),
          enum: expect.any(String),
          detail: expect.any(String)
        })
      }
    },
    CHECKER_TIMEOUT_MS
  )
})
