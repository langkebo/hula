import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 把 `scripts/check-svg-aria.mjs`（`pnpm check` 里跑的那份）也接到 vitest 里。
 *
 * 为什么不再在这里重写一遍规则：规则写两处必然漂 —— 谁先改谁生效，
 * 另一处变成"看起来在守、其实早已过期"的死断言。
 * （曾经真实发生过：脚本只认 aria-hidden/role/aria-label，不认 v-clickable，
 *  改完 28 处后 `pnpm check` 红、而本目录的测试全绿。）
 *
 * 本文件只做两件事：
 *  1. 跑脚本，要求零违规；
 *  2. 断言分母非空，避免 walker 坏掉时输出 "OK — 0 个 svg" 的假绿。
 *
 * 规则清单与白名单理由见脚本头部注释。
 */
const REPO_ROOT = path.resolve(__dirname, '../../..')
const SCRIPT = path.join(REPO_ROOT, 'scripts/check-svg-aria.mjs')

function runGuard(): string {
  return execFileSync(process.execPath, [SCRIPT], { encoding: 'utf-8', cwd: REPO_ROOT })
}

describe('check-svg-aria', () => {
  it('零违规', () => {
    // 违规时脚本以退出码 1 结束，execFileSync 会抛出，并把 stderr 里的
    // [规则种类] + file:line 清单带进错误信息
    expect(() => runGuard()).not.toThrow()
  })

  it('分母非空（防止 walker 失配导致"0 个 svg"的假绿）', () => {
    const stdout = runGuard()
    const total = Number(stdout.match(/OK — (\d+) 个 svg/)?.[1] ?? 0)
    expect(total).toBeGreaterThan(500)
  })
})
