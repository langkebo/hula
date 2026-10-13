import { describe, expect, it } from 'vitest'
import {
  collectSourceFiles,
  compactToken,
  ENTRY_FILES,
  FORBIDDEN_CALLS,
  isExcludedPath,
  isInScanRoots,
  REQUIRED_ENTRY_TOKEN,
  SESSION_ENTRY_MODULE,
  scanSources
} from '../../scripts/check-window-session-entry.mjs'

const SETTINGS_ENTRY = 'src/views/settingsWindow/SettingsPage.vue'
const CHAT_ENTRY = 'src/views/windowChat/index.vue'
const TAB = 'src/views/settingsWindow/tabs/PushSettings.vue'

/** 入口组件的最小合规形态 */
const OK_SETTINGS_ENTRY = `const { ensureSessionReady } = useWindowSessionReady()\nonMounted(() => { void ensureSessionReady() })`
const OK_CHAT_ENTRY = `const { ensureSessionReady } = useWindowSessionReady()\nawait ensureSessionReady()`

function repo(extra: Array<{ path: string; content: string }> = []) {
  return [{ path: SETTINGS_ENTRY, content: OK_SETTINGS_ENTRY }, { path: CHAT_ENTRY, content: OK_CHAT_ENTRY }, ...extra]
}

describe('check-window-session-entry — 纯函数判据', () => {
  it('合规仓库通过，并报出扫描文件数', () => {
    const result = scanSources(repo([{ path: TAB, content: `const { ensureSessionReady } = useWindowSessionReady()` }]))

    expect(result.ok).toBe(true)
    expect(result.checkedFiles).toBe(3)
    expect(result.violations).toEqual([])
    expect(result.missingRequired).toEqual([])
  })

  it('页签重新裸调 matrixClientService.waitForClientReady ⇒ 判违规', () => {
    const result = scanSources(
      repo([{ path: TAB, content: `await matrixClientService.waitForClientReady({ timeoutMs: 10000 })` }])
    )

    expect(result.ok).toBe(false)
    expect(result.violations[0]).toMatchObject({
      path: TAB,
      kind: 'forbidden-call',
      token: FORBIDDEN_CALLS[0].token
    })
  })

  it('页签重新裸调 sessionOrchestrator.ensureClientReady ⇒ 判违规', () => {
    const result = scanSources(repo([{ path: TAB, content: `await sessionOrchestrator.ensureClientReady()` }]))

    expect(result.ok).toBe(false)
    expect(result.violations[0].token).toBe(FORBIDDEN_CALLS[1].token)
  })

  it('跨行/缩进重排的写法同样判违规（去空白后比对）', () => {
    const result = scanSources(
      repo([{ path: TAB, content: `await matrixClientService\n  .waitForClientReady({ timeoutMs: 8000 })` }])
    )

    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
  })

  it('注释里解释历史缺陷不判违规（只有代码形态被禁）', () => {
    const result = scanSources(
      repo([
        {
          path: TAB,
          content: [
            '// 历史缺陷：此处曾 await matrixClientService.waitForClientReady({ timeoutMs: 10000 })',
            '/* 也不该再调 sessionOrchestrator.ensureClientReady() */',
            'const { ensureSessionReady } = useWindowSessionReady()'
          ].join('\n')
        }
      ])
    )

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('入口组件删掉 ensureSessionReady 调用 ⇒ 正向断言判红', () => {
    const result = scanSources([
      { path: SETTINGS_ENTRY, content: 'onMounted(() => {})' },
      { path: CHAT_ENTRY, content: OK_CHAT_ENTRY }
    ])

    expect(result.ok).toBe(false)
    expect(result.missingRequired).toHaveLength(1)
    expect(result.missingRequired[0]).toMatchObject({ path: SETTINGS_ENTRY, token: REQUIRED_ENTRY_TOKEN })
  })

  it('入口组件不在扫描集合 ⇒ missingEntries（由 CLI 升级为 EXIT=2）', () => {
    const result = scanSources([{ path: CHAT_ENTRY, content: OK_CHAT_ENTRY }])

    expect(result.ok).toBe(false)
    expect(result.missingEntries).toEqual([SETTINGS_ENTRY])
  })

  it('回归锁：只保留解构、删掉调用 ⇒ 必须判红（正向断言只认「调用」不认标识符）', () => {
    // 实测逃逸形态：`const { ensureSessionReady } = useWindowSessionReady()` 仍在，
    // 但 onMounted 里那句 `void ensureSessionReady()` 被删掉。若正向断言只匹配标识符，
    // 这里会假通过 —— 而「入口没被调用」正是本守卫要拦的头号回归。
    const result = scanSources([
      { path: SETTINGS_ENTRY, content: 'const { ensureSessionReady } = useWindowSessionReady()' },
      { path: CHAT_ENTRY, content: OK_CHAT_ENTRY }
    ])

    expect(result.ok).toBe(false)
    expect(result.missingRequired[0]).toMatchObject({ path: SETTINGS_ENTRY, token: 'ensureSessionReady()' })
  })

  it('回归锁：调用写成跨行（`ensureSessionReady\\n()`）仍算命中，不误报', () => {
    const result = scanSources([
      {
        path: SETTINGS_ENTRY,
        content: 'const { ensureSessionReady } = useWindowSessionReady()\nvoid ensureSessionReady\n  ()'
      },
      { path: CHAT_ENTRY, content: OK_CHAT_ENTRY }
    ])

    expect(result.ok).toBe(true)
  })

  it('扫描范围外的裸调不算违规（只收敛设置窗口与独立聊天窗口）', () => {
    const result = scanSources(
      repo([
        { path: 'src/services/matrix/MatrixFooService.ts', content: 'await matrixClientService.waitForClientReady()' }
      ])
    )

    expect(result.ok).toBe(true)
    expect(result.checkedFiles).toBe(2)
  })

  it('测试文件里的历史写法不算违规（负例需要它们）', () => {
    expect(isExcludedPath('src/views/settingsWindow/tabs/__tests__/PushSettings.test.ts')).toBe(true)
    const result = scanSources(
      repo([
        {
          path: 'src/views/settingsWindow/tabs/__tests__/PushSettings.test.ts',
          content: 'await matrixClientService.waitForClientReady({ timeoutMs: 10000 })'
        }
      ])
    )
    expect(result.ok).toBe(true)
  })

  it('isInScanRoots 只认两个目录（含其一自身）', () => {
    expect(isInScanRoots('src/views/settingsWindow')).toBe(true)
    expect(isInScanRoots('src/views/settingsWindow/tabs/PushSettings.vue')).toBe(true)
    expect(isInScanRoots('src/views/windowChat/index.vue')).toBe(true)
    expect(isInScanRoots('src/views/windowChatX/index.vue')).toBe(false)
    expect(isInScanRoots('src/views/homeWindow/index.vue')).toBe(false)
  })

  it('compactToken 与 compactCode 配合：空白差异不影响命中', () => {
    expect(compactToken(FORBIDDEN_CALLS[0].token)).toBe('matrixClientService.waitForClientReady')
  })
})

describe('check-window-session-entry — 真实仓库自洽', () => {
  let cachedFiles: ReturnType<typeof collectSourceFiles> | null = null
  const files = () =>
    (cachedFiles ??= [...collectSourceFiles('src/views/settingsWindow'), ...collectSourceFiles('src/views/windowChat')])

  // 重型 real-repo 扫描：全量并行跑 tests/lint 时会与其它重型用例抢资源（实测既有
  // check-sdk-boundary 的同类用例即 30s 超时），故显式放宽（同仓既有先例）。
  const SLOW_REAL_REPO_TIMEOUT_MS = 90_000

  it('本仓设置窗口与独立聊天窗口均已接入统一入口', { timeout: SLOW_REAL_REPO_TIMEOUT_MS }, () => {
    const collected = files()
    const known = new Set(collected.map((f) => f.path))
    const withEntries = [...collected]
    for (const entry of ENTRY_FILES) {
      if (!known.has(entry.path)) withEntries.push({ path: entry.path, content: '' })
    }

    const result = scanSources(withEntries)

    expect(result.violations).toEqual([])
    expect(result.missingRequired).toEqual([])
    expect(result.checkedFiles).toBeGreaterThanOrEqual(10)
  })

  it('统一入口模块存在（脚本的基数断言依赖它）', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { PROJECT_ROOT } = await import('../../scripts/check-window-session-entry.mjs')
    expect(fs.existsSync(path.join(PROJECT_ROOT, SESSION_ENTRY_MODULE))).toBe(true)
  })
})
