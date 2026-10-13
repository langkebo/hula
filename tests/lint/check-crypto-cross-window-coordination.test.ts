import { describe, expect, it } from 'vitest'
import {
  collectSourceFiles,
  FORBIDDEN_APIS_IN_CODE,
  FORBIDDEN_TOKENS,
  isCommentLine,
  isExcludedPath,
  scanSources,
  srcRoot,
  TARGET_FILE
} from '../../scripts/check-crypto-cross-window-coordination.mjs'

/**
 * 门禁单测：跨窗口 crypto「已完成即跳过」语义不得回归。
 *
 * 判据分两层：
 * - 纯函数层（合成源码）—— 正例/负例都必须在测试里跑过，否则"门禁全绿"可能只是没扫到东西；
 * - 真实仓库层 —— 在本仓 src/ 上实跑，并带**基数断言**（扫到的文件数、目标文件必须在集合里）。
 */

describe('check-crypto-cross-window-coordination: isCommentLine', () => {
  it('注释行（// * /* 起始）返回 true', () => {
    expect(isCommentLine('// 说明')).toBe(true)
    expect(isCommentLine(' * 说明')).toBe(true)
    expect(isCommentLine('/* 说明 */')).toBe(true)
    expect(isCommentLine('   * 缩进说明')).toBe(true)
  })

  it('代码行返回 false', () => {
    expect(isCommentLine("const ch = new BroadcastChannel('x')")).toBe(false)
    expect(isCommentLine('if (x) {')).toBe(false)
    expect(isCommentLine('')).toBe(false)
  })
})

describe('check-crypto-cross-window-coordination: isExcludedPath', () => {
  it('测试与生成物被排除', () => {
    expect(isExcludedPath('src/services/matrix/__tests__/MatrixCryptoStateTracker.test.ts')).toBe(true)
    expect(isExcludedPath('tests/lint/check-crypto-cross-window-coordination.test.ts')).toBe(true)
    expect(isExcludedPath('src/types/matrix-js-sdk-augmentations.d.ts')).toBe(true)
  })

  it('源码不被排除', () => {
    expect(isExcludedPath(TARGET_FILE)).toBe(false)
    expect(isExcludedPath('src/App.vue')).toBe(false)
  })
})

describe('check-crypto-cross-window-coordination: scanSources（合成源码）', () => {
  const targetWithRequired = [
    "const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'",
    "await navigator.locks.request(CRYPTO_LOCK_NAME, { mode: 'exclusive' }, async () => {})"
  ].join('\n')

  it('注释里解释历史机制 ⇒ 允许（保留"为什么删"的知识）', () => {
    const result = scanSources([
      {
        path: TARGET_FILE,
        content: `${targetWithRequired}\n * 历史上曾用 BroadcastChannel 做跨窗口跳过，已删除。\n`
      }
    ])

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.missingRequired).toEqual([])
  })

  it('重新引入跨窗口跳过机制 ⇒ 判红并报出行号', () => {
    const oldMechanism = [
      targetWithRequired,
      'async function waitForCrossWindowCryptoInit() {',
      "  channel.postMessage('crypto-init-started')",
      "  if (event.data === 'crypto-init-done') return true",
      '}',
      "const CRYPTO_CHANNEL_NAME = 'tjg-crypto-init'",
      'const CROSS_WINDOW_DONE_WAIT_MS = 1_000',
      'broadcastCryptoInitDone()',
      "skippedReason: 'crypto-initialized-by-other-window',",
      "skippedReason: 'crypto-already-available-after-lock',",
      'const ch = new BroadcastChannel(CRYPTO_CHANNEL_NAME)'
    ].join('\n')

    const result = scanSources([{ path: TARGET_FILE, content: oldMechanism }])

    expect(result.ok).toBe(false)
    const tokens = result.violations.map((v) => v.token)
    for (const token of FORBIDDEN_TOKENS) {
      expect(tokens, `token=${token}`).toContain(token)
    }
    expect(tokens).toContain(FORBIDDEN_APIS_IN_CODE[0])
    // 行号可定位（第 2 行起是旧机制）
    expect(result.violations.every((v) => typeof v.line === 'number' && v.line > 0)).toBe(true)
  })

  it('非注释代码里使用 BroadcastChannel ⇒ 判红（即使 token 名单没命中）', () => {
    const result = scanSources([
      { path: 'src/services/matrix/whatever.ts', content: "const ch = new BroadcastChannel('tjg-x')" }
    ])

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({
      path: 'src/services/matrix/whatever.ts',
      token: 'BroadcastChannel',
      kind: 'forbidden-api-in-code'
    })
  })

  it('串行化被一起删掉 ⇒ 正向断言判红（不是只看"没有黑名单命中"）', () => {
    const result = scanSources([{ path: TARGET_FILE, content: "const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'\n" }])

    expect(result.ok).toBe(false)
    expect(result.missingRequired.map((m) => m.token)).toContain('navigator.locks.request(CRYPTO_LOCK_NAME')
  })

  it('加锁调用被删、但能力探测/注释里的同名字符串仍在 ⇒ 仍须判红（防"顶包"假通过）', () => {
    // 这是实测逃逸过的形态：变异把真正的加锁调用换成 `await (async () => {`，
    // 而 isWebLocksAvailable() 里的 `navigator.locks.request` 探测字符串留在原地，
    // 旧判据（全文 includes）因此假通过。注释里出现同名字符串同样不得算数。
    const content = [
      "const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'",
      'function isWebLocksAvailable() {',
      "  return typeof navigator !== 'undefined' && navigator.locks.request === 'function'",
      '}',
      "// 旧实现：await navigator.locks.request(CRYPTO_LOCK_NAME, { mode: 'exclusive' }, fn)"
    ].join('\n')

    const result = scanSources([{ path: TARGET_FILE, content }])

    expect(result.ok).toBe(false)
    const missing = result.missingRequired.map((m) => m.token)
    expect(missing).toContain('navigator.locks.request(CRYPTO_LOCK_NAME')
    expect(missing).toContain("mode: 'exclusive'")
  })

  it('加锁调用被换行重排 ⇒ 不误判（折叠空白后仍能命中）', () => {
    const content = [
      "const CRYPTO_LOCK_NAME = 'tjg-ensure-crypto'",
      'await navigator.locks',
      "  .request(CRYPTO_LOCK_NAME, { mode: 'exclusive' }, async () => {})"
    ].join('\n')

    const result = scanSources([{ path: TARGET_FILE, content }])

    expect(result.missingRequired).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('目标文件缺失时 targetFound=false（调用方据此做基数断言 exit 2）', () => {
    const result = scanSources([{ path: 'src/App.vue', content: '' }])
    expect(result.targetFound).toBe(false)
  })
})

describe('check-crypto-cross-window-coordination: 真实仓库自洽', () => {
  // 记忆化：src/ 全量遍历较重（1200+ 文件），每个测试文件只扫一次，避免并行跑 tests/lint 时抢资源超时
  let cachedFiles: ReturnType<typeof collectSourceFiles> | null = null
  const files = () => (cachedFiles ??= collectSourceFiles(srcRoot))

  // 重型 real-repo 扫描（1200+ 文件）：全量并行跑 tests/lint 时会与其它重型用例抢资源，
  // 故显式放宽超时（同仓 `MatrixClientLifecycle.test.ts` 对慢用例的先例）。
  const SLOW_REAL_REPO_TIMEOUT_MS = 90_000

  it('本仓 src/ 无跨窗口跳过机制，且 Web Locks 串行化在位', { timeout: SLOW_REAL_REPO_TIMEOUT_MS }, () => {
    const result = scanSources(files())

    // 基数断言：确实扫到了一大批源码 + 目标文件在集合里（避免"空扫 = 通过"）
    expect(result.checkedFiles).toBeGreaterThan(500)
    expect(result.targetFound).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.missingRequired).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('回归锁：MatrixCryptoStateTracker 里已无跨窗口跳过令牌（取证 2026-10-13 删除）', {
    timeout: SLOW_REAL_REPO_TIMEOUT_MS
  }, () => {
    const target = files().find((f) => f.path === TARGET_FILE)
    expect(target).toBeTruthy()

    const content = target?.content ?? ''
    for (const token of FORBIDDEN_TOKENS) {
      expect(content, `token=${token}`).not.toContain(token)
    }
    // 历史说明允许保留在注释里（本守卫的"为什么删"文档）
    expect(content).toContain('BroadcastChannel')
  })
})
