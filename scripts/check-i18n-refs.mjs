// biome-ignore-all lint/suspicious/noConsole: CLI 门禁脚本，需要向终端输出进度与违规清单。
/**
 * i18n 源码引用可达性门禁。
 *
 * 背景：`scripts/check-i18n.mjs` 只校验「zh-CN 与 en 的键集合对齐」，
 * **不检查源码里 `t('字面量')` 引用的键是否真的能解析出来**。于是出现一类长期潜伏的缺陷：
 * 组件调用 `t('widget.add')`，而键的真实位置是 `common.widget.add`
 * （首段命名空间被漏写）→ 界面直接显示原始 key，而所有测试照常全绿
 * （组件测试的 `t` 桩照源码的错键写映射表，永远自洽）。
 *
 * 本脚本按 `i18n-source-reference-audit` skill 的口径量化存量，并以 ratchet 方式
 * 冻结基线：**各命名空间的计数只允许下降**。
 *
 * 两个计数器（分开计，因为严重度不同）：
 *   unresolved  — `t('k')` 无兜底且 k 解析不出 → 界面显示原始 key（硬缺陷）
 *   fallback    — `t('k', '默认文案')` 有兜底但 k 解析不出 → 中文兜底在其他语言下泄漏（软缺陷）
 *
 * 用法：
 *   node scripts/check-i18n-refs.mjs            # 校验（超出基线则退出码 1）
 *   node scripts/check-i18n-refs.mjs --update   # 清理后重刷基线
 *   node scripts/check-i18n-refs.mjs --list     # 打印全部无法解析的键（用于派工）
 *
 * 命名空间约定（最高频错因）：`locales/{lang}/{ns}.json` 的**文件名即顶层命名空间，
 * 且首段必须剥掉**才落到 JSON 根：`setting.encryption.title` → `setting.json` 的
 * `{ encryption: { title } }`。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC_DIR = path.join(ROOT, 'src')
const LOCALE_DIR = path.join(ROOT, 'locales')
const BASELINE_PATH = path.join(ROOT, 'meta', 'i18n-refs-baseline.json')

/** 语言包存在性以这些语言为准；zh-CN 是基准。 */
const LOCALES = ['zh-CN', 'en']
const BASE_LOCALE = 'zh-CN'

const SKIP_DIR = /(__tests__|__mocks__|node_modules|\.storybook)/
const SKIP_FILE = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$)/

const T_CALL = /\bt\(\s*(['"])([A-Za-z0-9_.\-]+)\1/g

/** @type {Map<string, Map<string, Record<string, unknown>>>} */
const packs = new Map()
for (const locale of LOCALES) {
  const dir = path.join(LOCALE_DIR, locale)
  const byNs = new Map()
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      byNs.set(file.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')))
    }
  }
  packs.set(locale, byNs)
}

/**
 * 完整键 -> 语言包取值。首段是命名空间（= 文件名），必须剥掉。
 * @returns {unknown} 解析不出时返回 undefined
 */
function resolveKey(locale, fullKey) {
  const [namespace, ...rest] = fullKey.split('.')
  if (!namespace || rest.length === 0) return undefined
  let cur = packs.get(locale)?.get(namespace)
  if (cur === undefined) return undefined
  for (const segment of rest) {
    if (typeof cur !== 'object' || cur === null || !(segment in cur)) return undefined
    cur = cur[segment]
  }
  return cur
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(entry.name)) walk(full, out)
    } else if (/\.(vue|ts|tsx|js)$/.test(entry.name) && !SKIP_FILE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

/**
 * 提取 `t('key')` 引用。
 * 关键边界：`t('key', '默认文案')` 是 vue-i18n 的兜底写法，即使键缺失界面也有兜底，
 * 因此单独归入 fallback 桶，不与无兜底的硬缺陷混计。
 * 注：`t('key', { count })` 是参数插值，**不算**兜底。
 */
function extractRefs(code) {
  const refs = []
  for (const match of code.matchAll(T_CALL)) {
    const key = match[2]
    if (!key.includes('.')) continue
    const after = code.slice(match.index + match[0].length)
    const hasFallback = /^\s*,\s*['"]/.test(after)
    refs.push({ key, hasFallback })
  }
  return refs
}

const violations = { unresolved: [], fallback: [] }

for (const file of walk(SRC_DIR)) {
  const code = fs.readFileSync(file, 'utf-8')
  const relPath = path.relative(ROOT, file)
  for (const { key, hasFallback } of extractRefs(code)) {
    // 任一语言解析不出即计入（zh-CN 之外的语言缺键同样会让界面显示原始 key）
    const missingLocales = LOCALES.filter((locale) => {
      const value = resolveKey(locale, key)
      return typeof value !== 'string'
    })
    if (missingLocales.length === 0) continue
    violations[hasFallback ? 'fallback' : 'unresolved'].push({
      key,
      file: relPath,
      locales: missingLocales
    })
  }
}

const countByNamespace = (entries) => {
  const counts = {}
  for (const { key } of entries) {
    const namespace = key.split('.')[0]
    counts[namespace] = (counts[namespace] ?? 0) + 1
  }
  return counts
}

/** 同一键在多文件出现只按「键」计一次，按文件重复会放大噪声 */
const uniqueByKey = (entries) => {
  const seen = new Map()
  for (const entry of entries) {
    if (!seen.has(entry.key)) seen.set(entry.key, entry)
  }
  return [...seen.values()]
}

const unresolvedUnique = uniqueByKey(violations.unresolved)
const fallbackUnique = uniqueByKey(violations.fallback)

const current = {
  unresolved: { total: unresolvedUnique.length, by_namespace: countByNamespace(unresolvedUnique) },
  fallback: { total: fallbackUnique.length, by_namespace: countByNamespace(fallbackUnique) }
}

if (process.argv.includes('--list')) {
  for (const bucket of ['unresolved', 'fallback']) {
    console.log(`\n=== ${bucket} (${current[bucket].total}) ===`)
    for (const entry of uniqueByKey(violations[bucket]).sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(`  ${entry.key}\n      @ ${entry.file}  [缺: ${entry.locales.join(', ')}]`)
    }
  }
  console.log('\n命名空间分布:')
  for (const bucket of ['unresolved', 'fallback']) {
    console.log(`  ${bucket}:`, current[bucket].by_namespace)
  }
  process.exit(0)
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        comment:
          'i18n 源码引用可达性 ratchet 基线：各命名空间计数只允许下降。清理后用 `node scripts/check-i18n-refs.mjs --update` 重刷。见 i18n-source-reference-audit skill。',
        updated_at: new Date().toISOString(),
        ...current
      },
      null,
      2
    )}\n`
  )
  console.log(`check-i18n-refs: 基线已更新 -> ${path.relative(ROOT, BASELINE_PATH)}`)
  console.log(`  unresolved ${current.unresolved.total} / fallback ${current.fallback.total}`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE_PATH)) {
  console.error(`check-i18n-refs: 基线缺失。先运行 node scripts/check-i18n-refs.mjs --update`)
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
let failed = false

for (const bucket of ['unresolved', 'fallback']) {
  const base = baseline[bucket]?.by_namespace ?? {}
  const now = current[bucket].by_namespace
  const namespaces = new Set([...Object.keys(base), ...Object.keys(now)])

  for (const namespace of [...namespaces].sort()) {
    const before = base[namespace] ?? 0
    const after = now[namespace] ?? 0
    if (after > before) {
      console.error(`check-i18n-refs: FAIL ${bucket}.${namespace}: ${after}（基线 ${before}）— 新增了无法解析的引用`)
      failed = true
    } else if (after < before) {
      console.log(`check-i18n-refs: DOWN ${bucket}.${namespace}: ${after}（基线 ${before}）— 可运行 --update 收紧基线`)
    }
  }

  if (current[bucket].total > (baseline[bucket]?.total ?? 0)) {
    console.error(`check-i18n-refs: FAIL ${bucket} 总数 ${current[bucket].total} 超出基线 ${baseline[bucket]?.total}`)
    failed = true
  }
}

if (failed) {
  console.error('\n提示：用 --list 查看全部违规键；键路径核对方法见 i18n-source-reference-audit skill。')
  process.exit(1)
}

console.log(
  `check-i18n-refs: OK unresolved ${current.unresolved.total}（基线 ${baseline.unresolved?.total}）/ fallback ${current.fallback.total}（基线 ${baseline.fallback?.total}）`
)
