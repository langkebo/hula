import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * i18n 源码引用可达性契约测试（全仓）
 *
 * 为什么需要：`scripts/check-i18n.mjs` 只校验 zh-CN 与 en 的**键集合对齐**，不检查源码里
 * `t('字面量')` 引用的键能否真的解析出来。这类缺陷会长期潜伏——界面直接显示原始 key，
 * 而组件测试因为用了自造的 `t` 桩（映射表照着源码的错键抄）永远自洽全绿。
 *
 * 本测试读**真实语言包**（`node:fs` + `JSON.parse`），不复用任何组件测试的 `t` 桩。
 *
 * 命名空间约定（最高频错因）：`locales/{lang}/{ns}.json` 的**文件名即顶层命名空间，
 * 且首段必须剥掉**才落到 JSON 根——`setting.encryption.title` → `setting.json` 的
 * `{ encryption: { title } }`。写解析器时漏掉这一步会把所有键都判成缺失。
 *
 * 覆盖：
 *  - 2026-09-20 修复的 9 个文件必须保持 0 个无法解析的引用（冻结修复成果）
 *  - `KeyBackupRestoreDialog.vue` 的已知缺口（`encryption.backup_restore_dialog.*`
 *    整棵子树在任何语言包中都不存在）必须不扩大
 *  - 全仓总数不得超过 `meta/i18n-refs-baseline.json` 的 ratchet 基线
 *  - 收集器自检：用合成夹具证明「找 mock 块 + 取键」的机制没坏（否则守卫会静默空转）
 *    ——刻意**不**用「全仓扫出多少键 > N」这类阈值，那会被反模式本身的存量撑起来
 * 不覆盖：
 *  - 翻译质量 / 语义正确性 / zh 与 en 的键集合对齐（后者由 `scripts/check-i18n.mjs` 负责）
 *  - `t(someVariable)` 这类动态键（静态无法判定，故意不纳入）
 */

const ROOT = resolve(__dirname, '..', '..', '..')
const SRC = resolve(ROOT, 'src')
const BASELINE_PATH = resolve(ROOT, 'meta/i18n-refs-baseline.json')

/** 与 `scripts/check-i18n-refs.mjs` 的 LOCALES / BASE_LOCALE 保持一致 */
const LOCALES = ['zh-CN', 'en'] as const

const SKIP_DIR = /(__tests__|__mocks__|node_modules|\.storybook)/
const SKIP_FILE = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/
/** 必须带 `g`：下面用 matchAll / exec 遍历，缺 g 会抛错或死循环 */
const T_CALL = /\bt\(\s*(['"])([A-Za-z0-9_.-]+)\1/g

type LocalePack = Record<string, Record<string, unknown>>

function loadLocale(locale: string): LocalePack {
  const dir = resolve(ROOT, 'locales', locale)
  const pack: LocalePack = {}
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue
    pack[file.slice(0, -5)] = JSON.parse(readFileSync(join(dir, file), 'utf-8'))
  }
  return pack
}

// 显式标注为 Map<string, …>：LOCALES 是 `as const` 字面量元组，
// 不加宽会让 Map 的键收紧成 "zh-CN" | "en"，导致 resolveKey(locale: string) 取用时类型报错。
const PACKS = new Map<string, LocalePack>(LOCALES.map((locale) => [locale, loadLocale(locale)]))

/** 完整键 -> 语言包取值；首段是命名空间（= 文件名），必须剥掉。解析不出返回 undefined */
function resolveKey(locale: string, fullKey: string): unknown {
  const [namespace, ...rest] = fullKey.split('.')
  if (!namespace || rest.length === 0) return undefined
  let cur: unknown = PACKS.get(locale)?.[namespace]
  if (cur === undefined) return undefined
  for (const segment of rest) {
    if (typeof cur !== 'object' || cur === null || !(segment in cur)) return undefined
    cur = (cur as Record<string, unknown>)[segment]
  }
  return cur
}

interface SourceRef {
  path: string
  key: string
}

function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(entry.name)) collectSources(full, out)
    } else if (/\.(vue|ts|tsx|js)$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const SOURCES = collectSources(SRC).map((file) => ({
  path: relative(ROOT, file),
  text: readFileSync(file, 'utf-8')
}))

/** 提取 `t('key')` 引用（只取带点的完整路径字面量） */
function extractKeys(text: string): string[] {
  return [...text.matchAll(T_CALL)].map((match) => match[2]).filter((key) => key.includes('.'))
}

/** 无法在**任一**语言包解析的引用（缺任一语言同样会让界面显示原始 key） */
function unresolvedRefs(): SourceRef[] {
  const refs: SourceRef[] = []
  for (const source of SOURCES) {
    for (const key of extractKeys(source.text)) {
      const missing = LOCALES.some((locale) => typeof resolveKey(locale, key) !== 'string')
      if (missing) refs.push({ path: source.path, key })
    }
  }
  return refs
}

/** 只保留每个键的首个出现位置，避免同一键在多文件重复计 */
function uniqueByKey(refs: SourceRef[]): SourceRef[] {
  const seen = new Map<string, SourceRef>()
  for (const ref of refs) if (!seen.has(ref.key)) seen.set(ref.key, ref)
  return [...seen.values()]
}

const UNRESOLVED = uniqueByKey(unresolvedRefs())

/** 2026-09-20 修复过调用点的文件（错键 -> 真实路径），必须保持 0 残留 */
const REPAIRED_FILES = [
  'src/components/widget/WidgetManager.vue',
  'src/components/widget/WidgetDetailPanel.vue',
  'src/components/widget/WidgetDialogs.vue',
  'src/components/common/ErrorBoundary.vue',
  'src/components/connection/SyncStatusBar.vue',
  'src/components/common/MemoryMonitor.vue',
  'src/mobile/components/thread/ThreadView.vue',
  'src/components/thread/ThreadIndicator.vue',
  'src/mobile/components/thread/ThreadIndicator.vue'
]

describe('i18n 源码引用可达性', () => {
  describe('收集器自检', () => {
    it('扫到了足量源码与引用（否则守卫会静默空转）', () => {
      expect(SOURCES.length).toBeGreaterThan(300)
      // 引用基线归零（所有 t() 引用都可达）后，不能再要求「存在未解析引用」来证明守卫在工作；
      // 改为要求抽取到足量引用，未解析判定本身由解析器正反样例与桩键用例覆盖。
      const totalRefs = SOURCES.reduce((sum, source) => sum + extractKeys(source.text).length, 0)
      expect(totalRefs).toBeGreaterThan(500)
      expect(SOURCES.some((source) => source.path.includes('__tests__'))).toBe(false)
    })

    it('解析器遵守「首段是命名空间」约定（正反样例）', () => {
      // 正例：setting.json 的 { encryption: { title } }
      expect(typeof resolveKey('zh-CN', 'setting.encryption.title')).toBe('string')
      // 反例：首段并非文件名时不得解析出来
      expect(resolveKey('zh-CN', 'nonexistent_namespace.foo')).toBeUndefined()
      // 反例：单段键（无命名空间）不参与判定
      expect(resolveKey('zh-CN', 'title')).toBeUndefined()
    })
  })

  describe('已修复文件冻结', () => {
    for (const file of REPAIRED_FILES) {
      it(`${file} 不再有无法解析的引用`, () => {
        const offenders = UNRESOLVED.filter((ref) => ref.path === file).map((ref) => ref.key)
        expect(offenders, `${file} 出现无法解析的 i18n 键`).toEqual([])
      })
    }
  })

  describe('已知缺口不得扩大', () => {
    it('KeyBackupRestoreDialog 仅剩 encryption.backup_restore_dialog.* 整棵子树缺失', () => {
      const offenders = UNRESOLVED.filter((ref) => ref.path === 'src/components/encryption/KeyBackupRestoreDialog.vue')
      // 该子树在任何语言包中都不存在（encryption.json 只有 backup_setup_dialog），
      // 属「内容真缺」而非路径写错，需先补齐文案。此处只冻结数量、不放行新增（用 <= 而非 ==，
      // 这样补齐文案后计数下降不会被误判为失败）。
      expect(offenders.length).toBeLessThanOrEqual(32)
      for (const ref of offenders) {
        expect(ref.key, '出现该子树之外的缺口，说明是新引入的路径错误').toMatch(/^encryption\.backup_restore_dialog\./)
      }
    })
  })

  describe('全仓 ratchet', () => {
    it('无法解析的引用总数不得超过基线', () => {
      // 注：本测试的 UNRESOLVED 是「无兜底 + 有兜底」两桶的并集，而脚本把两桶分开计数，
      // 故基线也要取两桶之和（只取 unresolved 会少算 fallback 那一桶）。
      const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as {
        unresolved: { total: number }
        fallback: { total: number }
      }
      const allowed = baseline.unresolved.total + baseline.fallback.total
      expect(
        UNRESOLVED.length,
        `无法解析的 i18n 键从基线 ${allowed}（无兜底 ${baseline.unresolved.total} + ` +
          `有兜底 ${baseline.fallback.total}）涨到 ${UNRESOLVED.length}；` +
          '用 `node scripts/check-i18n-refs.mjs --list` 查看清单'
      ).toBeLessThanOrEqual(allowed)
    })

    it('基线文件本身是有效的（防止被清空后门禁失效）', () => {
      const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as {
        unresolved: { total: number; by_namespace: Record<string, number> }
        fallback: { total: number; by_namespace: Record<string, number> }
      }
      // 基线可以合法地为 0（引用全部可达）；但结构必须完整、计数必须是数字，
      // 而「清空基线来放开闸门」由上面的 ratchet 比较拦截（实际值仍不得超基线）。
      expect(Number.isInteger(baseline.unresolved.total)).toBe(true)
      expect(baseline.unresolved.total).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(baseline.fallback.total)).toBe(true)
      expect(typeof baseline.unresolved.by_namespace).toBe('object')
      expect(Array.isArray(baseline.unresolved.by_namespace)).toBe(false)
    })
  })
})

describe('i18n 桩键可达性', () => {
  /**
   * 为什么需要：组件测试大量在 `vi.mock('vue-i18n')` 里手写 key → 文案映射表，
   * 而这张表常常是从**组件源码抄出来的**。源码键名写错时桩抄的也是错键名，
   * 于是测试全绿、界面却渲染裸 key —— 即「自洽 stub」反模式。
   *
   * 实例（本测试建立时抓到的真实缺陷）：
   *  - `RenderPollMessage.test.ts` 桩里声明 `poll.votes` / `poll.ended` / `poll.ends_at`，
   *    组件源码用的正是这三个键；但真实语言表里只有 `poll.message.votes`、
   *    `poll.message.ended`，`poll.ends_at` 根本不存在 → 聊天里显示裸 key。
   *  - `SyncStatusBar.test.ts` / `KeyBackupRestoreDialog.test.ts` 同理（`connection.*`
   *    实为 `chat.connection.*`、`encryption.*` 实为 `setting.encryption.*`）。
   *
   * 覆盖：`src/**\/*.test.ts` 中 `vi.mock('vue-i18n')` 工厂内以对象键形式声明的
   * 带点键名。不覆盖：`t: (key) => key` 这类不声明映射的桩（无键可查，天然无误导性）。
   */
  const STUB_KEY = /['"]([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)['"]\s*:/g

  /** 取出 `vi.mock('vue-i18n'` 之后配对括号内的文本 */
  function extractMockBlocks(text: string): string[] {
    const blocks: string[] = []
    let cursor = 0
    for (;;) {
      const start = text.indexOf("vi.mock('vue-i18n'", cursor)
      if (start === -1) return blocks
      const open = text.indexOf('(', start)
      if (open === -1) return blocks
      let depth = 0
      let index = open
      for (; index < text.length; index += 1) {
        const char = text[index]
        if (char === '(') depth += 1
        else if (char === ')') {
          depth -= 1
          if (depth === 0) break
        }
      }
      blocks.push(text.slice(open, index + 1))
      cursor = index + 1
    }
  }

  function collectTestFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!/node_modules/.test(entry.name)) collectTestFiles(full, out)
      } else if (/\.test\.ts$/.test(entry.name)) {
        out.push(full)
      }
    }
    return out
  }

  /**
   * 本文件自身必须排除：下面的「收集器自检」用例里有一个**合成夹具**，
   * 夹具内刻意含有语言表里不存在的键（`a.b.c` / `leaked.key`）。
   * 不排除的话，夹具会被当成真实桩键扫进来，守卫立刻自伤误报。
   */
  const SELF_PATH = relative(ROOT, __filename)

  const STUB_REFS: SourceRef[] = collectTestFiles(SRC)
    .filter((file) => relative(ROOT, file) !== SELF_PATH)
    .flatMap((file) => {
      const path = relative(ROOT, file)
      return extractMockBlocks(readFileSync(file, 'utf-8')).flatMap((block) =>
        [...block.matchAll(STUB_KEY)].map((match) => ({ path, key: match[1] }))
      )
    })

  const MISSING_STUB_REFS = STUB_REFS.filter((ref) =>
    LOCALES.some((locale) => typeof resolveKey(locale, ref.key) !== 'string')
  )

  /** 已知「内容缺口」：语言表中确实不存在这些键，组件会渲染裸 key。
   * 允许测试桩临时提供文案，但必须在这里登记并注明出处。
   * 补齐语言表后必须删除登记项 —— 下面的「登记项不得陈旧」用例会强制这一点。
   *
   * 当前无登记项：encryption.json 已有 backup_restore_dialog 子树
   * （8db0840c 补齐 32 键），白名单已清空。
   */
  const ALLOWED_MISSING_STUB_KEYS = new Set<string>([])

  it('收集器自检：抽取机制对合成夹具能正确取键（否则守卫会静默空转）', () => {
    // 测试文件的发现能力与「桩里有多少键」无关，用稳定的下限即可
    expect(collectTestFiles(SRC).length).toBeGreaterThan(150)

    /**
     * 用**合成夹具**自证，而不是「全仓扫出多少键」。
     *
     * 旧写法是 `expect(STUB_REFS.length).toBeGreaterThan(100)`。这个阈值是
     * **被反模式本身撑起来的**：手写桩越多，计数越高。而本守卫的诉求恰恰是把它们
     * 换成 `createI18nMock()`——每换一个，计数就掉一批（本次 120 → 61），
     * 于是「修得越对、守卫越红」，还会反向激励保留错键桩。
     *
     * 夹具方案下夹具恒定、机制恒定：反模式清零导致计数归零也不会误报，
     * 同时顺带把「括号配对」这一真正易错处钉住——若配对写错、把其它 `vi.mock`
     * 的对象键一并吸入，`leaked.key` 就会出现在结果里。
     */
    const fixture = [
      "vi.mock('vue-i18n', () => ({",
      '  useI18n: () => ({',
      "    t: (key: string) => ({ 'a.b.c': 'x', 'setting.encryption.title': 'y', 'no_dot': 'z' }[key] ?? key)",
      '  })',
      '}))',
      "vi.mock('@/other/module', () => ({ 'leaked.key': 'v' }))"
    ].join('\n')

    const extracted = extractMockBlocks(fixture).flatMap((block) =>
      [...block.matchAll(STUB_KEY)].map((match) => match[1])
    )
    expect(extracted).toEqual(['a.b.c', 'setting.encryption.title'])
    // 无点号的键不是 i18n 命名空间键，不应计入
    expect(extracted).not.toContain('no_dot')
    // 括号配对边界：非 vue-i18n 的 mock 体不得被吸入
    expect(extracted).not.toContain('leaked.key')
  })

  it('测试桩声明的键必须能在真实语言表解析出来', () => {
    const offenders = MISSING_STUB_REFS.filter((ref) => !ALLOWED_MISSING_STUB_KEYS.has(ref.key))
      .map((ref) => `${ref.path} -> ${ref.key}`)
      .sort()
    expect(
      offenders,
      '测试桩里出现了语言表中不存在的 i18n 键：说明桩与真实语言表脱节，界面会渲染裸 key。' +
        '请改用 `createI18nMock()`（见 tests/i18n-messages.ts）而非手写映射表；' +
        '若确属已知内容缺口，需在 ALLOWED_MISSING_STUB_KEYS 登记并注明出处。'
    ).toEqual([])
  })

  it('登记项不得陈旧：已能解析的键必须从白名单移除', () => {
    const stale = [...ALLOWED_MISSING_STUB_KEYS].filter((key) =>
      LOCALES.every((locale) => typeof resolveKey(locale, key) === 'string')
    )
    expect(stale, '这些键已能在语言表解析，请从 ALLOWED_MISSING_STUB_KEYS 删除').toEqual([])
  })
})

describe('生成产物新鲜度', () => {
  /**
   * `src/typings/i18n.d.ts` 是 `scripts/generate-i18n-types.mjs` 从 `locales/zh-CN/`
   * 生成的类型字面量，被 `src/typings/vue-i18n.d.ts` 用来扩展 `DefineLocaleMessage`，
   * 因此它陈旧会让 `t()` 的键类型与真实语言包脱节。
   *
   * 为什么需要单独守：`package.json` 的 `check` 是 `pnpm gen:i18n && ... node scripts/check-i18n.mjs`，
   * 即**先重生成再做检查**——CI 里这个文件永远被就地重写，陈旧状态不可能被现有门禁发现。
   */
  const GENERATED_PATH = resolve(ROOT, 'src/typings/i18n.d.ts')
  const GENERATOR_HEADER =
    '/**\n * This file is auto-generated by scripts/generate-i18n-types.mjs\n * DO NOT EDIT MANUALLY\n */'
  /** 必须与 `scripts/generate-i18n-types.mjs` 的 KEY_PATHS_NOTE 逐字一致 */
  const KEY_PATHS_NOTE = `/**
 * 语言包中可翻译叶子 key 的扁平点分联合（首段为语言包文件名命名空间）。
 *
 * 为什么生成而不是在类型层推导：用递归条件类型在 5000+ key 上做路径展开，
 * 每次 vue-tsc 都要重算，是实打实的类型检查性能风险；这里在生成期一次性算清。
 *
 * 数组值按终止路径处理（不下钻元素）：数组是 UI 列表，经 tm() 消费，
 * 不会被某个点分 t() key 直接寻址。
 */`

  /** 独立于生成器重算一遍点分路径（不 import 生成器，避免守卫与实现同源失真） */
  const collectKeyPaths = (value: unknown, prefix: string, out: string[]) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      out.push(prefix)
      return
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectKeyPaths(child, prefix ? `${prefix}.${key}` : key, out)
    }
  }

  it('src/typings/i18n.d.ts 与当前 zh-CN 语言包一致', () => {
    // 必须与生成器同序：两者都用 readdirSync 的原始顺序，故此处不排序
    const packs: Record<string, unknown> = {}
    for (const file of readdirSync(resolve(ROOT, 'locales/zh-CN'))) {
      if (!file.endsWith('.json')) continue
      packs[file.slice(0, -5)] = JSON.parse(readFileSync(resolve(ROOT, 'locales/zh-CN', file), 'utf-8'))
    }

    const keyPaths: string[] = []
    for (const [part, content] of Object.entries(packs)) collectKeyPaths(content, part, keyPaths)
    const union = keyPaths.map((key) => `  | ${JSON.stringify(key)}`).join('\n')

    const expected = `${GENERATOR_HEADER}\n\nexport type I18nKeys = ${JSON.stringify(
      packs,
      null,
      2
    )}\n\n${KEY_PATHS_NOTE}\nexport type I18nKeyPaths =\n${union}\n`
    const actual = readFileSync(GENERATED_PATH, 'utf-8')

    expect(actual.length, 'i18n.d.ts 已过期——运行 `pnpm gen:i18n` 重新生成（长度差即漂移量）').toBe(expected.length)
    expect(actual).toBe(expected)
  })
})
