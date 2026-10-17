import { describe, expect, it } from 'vitest'
import {
  ALLOWLIST,
  evaluateUnstableMethods,
  extractDeclared,
  isCommentLine,
  scanUnstableUsage
} from '../../scripts/check-sdk-unstable-methods.mjs'

/** 构造一份「SDK 声明」文本，模拟 .d.ts 内容 */
const declaredFrom = (...names: string[]) =>
  extractDeclared([names.map((n) => `${n}(id: number): Promise<void>;`).join('\n')])

const file = (path: string, content: string) => ({ path, content })

describe('check-sdk-unstable-methods: extractDeclared', () => {
  it('从声明文本里提取全部 _unstable_* 名字并去重', () => {
    const declared = extractDeclared([
      '_unstable_sendDelayedEvent(x): void;',
      '_unstable_cancelScheduledDelayedEvent(x): void;',
      '// 注释里提到 _unstable_getDelayedEvents 也算命中（提取阶段不过滤注释）'
    ])

    expect(declared.has('_unstable_sendDelayedEvent')).toBe(true)
    expect(declared.has('_unstable_cancelScheduledDelayedEvent')).toBe(true)
    expect(declared.size).toBe(3)
  })
})

describe('check-sdk-unstable-methods: scanUnstableUsage', () => {
  it('抓成员访问 `._unstable_xxx`', () => {
    const hits = scanUnstableUsage('const r = await client._unstable_sendDelayedEvent(a, b)\n')

    expect(hits).toEqual([{ token: '_unstable_sendDelayedEvent', line: 1 }])
  })

  it('注释里的名字不算调用（回归锁：本仓正是删掉实现、只在注释里留说明）', () => {
    const content = [
      '// 原实现调 client._unstable_getDelayedEvents(...)，已删除',
      ' * 该 _unstable_getDelayedEvents 在 SDK 里不存在',
      'const x = 1'
    ].join('\n')

    expect(scanUnstableUsage(content)).toEqual([])
  })

  it('一行多个访问都能抓到，并给出行号', () => {
    const content = ['const a = 1', 'await client._unstable_a(); await client._unstable_b()'].join('\n')
    const hits = scanUnstableUsage(content)

    expect(hits.map((h) => h.token)).toEqual(['_unstable_a', '_unstable_b'])
    expect(hits.every((h) => h.line === 2)).toBe(true)
  })

  it('isCommentLine 识别 // 与 * 起始', () => {
    expect(isCommentLine('// x')).toBe(true)
    expect(isCommentLine('   * x')).toBe(true)
    expect(isCommentLine('/* x')).toBe(true)
    expect(isCommentLine('const x = 1')).toBe(false)
  })
})

describe('check-sdk-unstable-methods: evaluateUnstableMethods', () => {
  it('全部已声明 ⇒ 通过', () => {
    const result = evaluateUnstableMethods({
      declared: declaredFrom('_unstable_sendDelayedEvent', '_unstable_cancelScheduledDelayedEvent'),
      files: [file('src/a.ts', 'await client._unstable_sendDelayedEvent()')]
    })

    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('调用 SDK 未声明的方法 ⇒ 判红（正是 _unstable_getDelayedEvents 的形态）', () => {
    const result = evaluateUnstableMethods({
      declared: declaredFrom('_unstable_sendDelayedEvent'),
      files: [file('src/bad.ts', 'await client._unstable_getDelayedEvents(status)')]
    })

    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]).toMatchObject({
      kind: 'undeclared-unstable-method',
      path: 'src/bad.ts',
      line: 1,
      token: '_unstable_getDelayedEvents'
    })
  })

  it('白名单内的未声明方法豁免（但仍进 used 统计）', () => {
    const allowlist = new Map([['_unstable_futureThing', 'SDK 声明滞后，运行时已实现（issue 待补）']])
    const result = evaluateUnstableMethods({
      declared: declaredFrom('_unstable_sendDelayedEvent'),
      files: [file('src/c.ts', 'client._unstable_futureThing()')],
      allowlist
    })

    expect(result.ok).toBe(true)
    expect(result.used).toContain('_unstable_futureThing')
  })

  it('空声明 + 有使用 ⇒ 全判红（基数由 CLI 兜底，纯函数不静默放行）', () => {
    const result = evaluateUnstableMethods({
      declared: new Set(),
      files: [file('src/d.ts', 'client._unstable_whatever()')]
    })

    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
  })

  it('默认白名单为空（守住 Batch 3.4 的状态：没有可豁免的项）', () => {
    expect(ALLOWLIST.size).toBe(0)
  })
})

describe('check-sdk-unstable-methods: 真实仓库自洽', () => {
  /** 重型 real-repo：全量并行跑 tests/lint 时会与其它重型用例抢资源，故显式放宽（同仓既有先例）。 */
  const SLOW_REAL_REPO_TIMEOUT_MS = 90_000

  it('注释里的历史名字不误报，且真实调用的 _unstable_* 都在 SDK 声明内', {
    timeout: SLOW_REAL_REPO_TIMEOUT_MS
  }, async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = process.cwd()

    // 2026-10-17：原夹具 `messaging/MatrixDelayedEventsService.ts` 已在 Batch A（`c2318011`）
    // 中删除，本用例因此 ENOENT。改为「合成夹具 + 全仓扫描」，不再依赖某个具体文件存在。
    // ① 注释里提到的历史实现名**不得**被当成调用（回归锁）
    const commentOnly = '// 历史: client._unstable_getDelayedEvents() 已迁移到稳定 API\nconst noop = 1\n'
    expect(scanUnstableUsage(commentOnly).map((h) => h.token)).not.toContain('_unstable_getDelayedEvents')

    // ② 真实仓库：src/services/** 下所有真实调用都必须能在 SDK 声明里找到
    const collect = (dir: string, ext: string, out: string[] = []): string[] => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '.git') continue
          collect(full, ext, out)
        } else if (full.endsWith(ext)) out.push(full)
      }
      return out
    }
    const used = new Set(
      collect(join(root, 'src/services'), '.ts').flatMap((p) =>
        scanUnstableUsage(readFileSync(p, 'utf8')).map((h) => h.token)
      )
    )

    // SDK 声明面必须非空（基数断言：防止扫描退化成空集而静默全绿）
    const declared = extractDeclared(
      collect(join(root, 'node_modules/matrix-js-sdk/lib'), '.d.ts').map((p) => readFileSync(p, 'utf8'))
    )
    expect(declared.size).toBeGreaterThanOrEqual(5)

    for (const token of used) {
      expect(declared.has(token)).toBe(true)
    }
  })
})
