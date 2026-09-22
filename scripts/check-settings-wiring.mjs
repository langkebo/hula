#!/usr/bin/env node
/**
 * Ratchet：持久化设置 key 的「清单 + 持久层发现」守门。
 *
 * 为什么重写：旧判据只在 `src/views/settingsWindow` 里找 `localStorage.setItem` 字面量，
 * 而桌面设置早已改为 `useSettingStore` + `pinia-plugin-persistedstate` 整块持久化，
 * 于是守门只看到 1 个 key，"绿"不再等于"开关接线"（见 §13 债务 D8）。现在有两条
 * **互相独立**的判据：
 *
 * A. 清单契约（阻塞）
 *    从 `src/{stores,services,utils,composables,components}/**` 发现持久化 key：
 *      - `*_STORAGE_KEY` / `*STORAGE_KEYS.*` 常量（含 `private static readonly`、
 *        `X: string = 'literal'` 类型标注与 `X = StoresEnum.Y` 的枚举写法）
 *      - `*STORAGE_KEYS` / `STORAGE_KEYS` 对象映射的每个字面量值，**声明语法不限**：
 *        `= {`、`const X: Record<K, V> = {`、`satisfies` / `as const` 均可
 *      - `defineStore(...)` 且该 store 有 `persist` 配置 → store id 即默认持久化键
 *      - `localStorage` **与 `sessionStorage`** 的 `setItem(...)` 字面量 / 同文件常量 /
 *        对象成员 / 静态成员参数
 *      - `*PREFIX` 常量（形如 `` `${PREFIX}${id}` `` 的动态键族，登记为 `<prefix>*`）
 *    凡发现但未登记在 `scripts/settings-wiring-manifest.json` 的 key → FAIL。
 *    清单里每个条目的 `owner` / `consumers` 路径必须存在（删文件/改名即 FAIL）；
 *    且每个 key 至少要有一个 consumer 能在文件里查到引用证据（只有路径不算，
 *    见下方"消费方引用证据"），否则 FAIL。
 *
 *    漏报自检（阻塞）：`permissiveScanKeys()` 用**故意更宽松**的语法假设重扫同一批目录，
 *    任何"宽松扫到、上面的发现器没扫到"的 key 都说明正则又与真实声明语法脱节了。
 *    历史缺陷正是这里静默失效：`const STORAGE_KEYS: Record<...> = {...}` 因带类型标注
 *    而整条不可见，守门却继续打印"无未登记 key"（详见 2026-09-22 Task 5 review Critical #1）。
 *    自检失败一律 FAIL —— 宁可拦住人，也不假装全覆盖。
 *
 * B. 死配置数量 ratchet（阻塞）
 *    设置窗口（`src/views/settingsWindow`）直接写入的 key 必须在窗口之外有消费方。
 *    数量只能收紧；且当前死配置键名集合 ⊆ 基线键名集合 —— `--update` 同样拒绝任何
 *    新增键名（同数量换键也不行），避免"修掉一个又引入一个"绕过 ratchet。
 *
 * 已知局限（刻意保守，宁可漏报不误报）：
 *  - 只做静态语法发现。参数化写入（`setItem(storageKey)`）与非字面量模板键
 *    （`` `${PREFIX}${id}` ``）无法求值时会记录到"无法静态判定"清单并计数，不伪造 key。
 *  - 发现范围是 `src/{stores,services,utils,composables,components}` 五个目录；其它目录
 *    （views/layout/stores 之外的 mobile 私有实现等）里新写的持久化 key 不在此守门。
 *  - 消费方判据分档（见 "消费方引用证据"）：`verified`（文件里能查到 key 字面量 /
 *    `*_STORAGE_KEY` 常量 / 映射成员出现在非写入位置，或引用了 owner 模块/store）、
 *    `write-only`（只在 `setItem`/`removeItem` 写入位置出现）、`none`（路径存在但零引用）。
 *    只有 verified 才算证据；write-only / none 会单列打印为 "consumer unverified"，
 *    但仍无法证明"这个文件在运行时真的读了该 key"（静态近似）。
 *  - `--update` 先校验清单：清单不合法或存在未登记的发现 key 时拒绝写入；陈旧 manifest
 *    条目只告警、不自动删除。
 *
 * 用法：
 *   node scripts/check-settings-wiring.mjs             校验（CI / pre-commit）
 *   node scripts/check-settings-wiring.mjs --update    收紧死配置基线（拒绝新增键名）
 *   node scripts/check-settings-wiring.mjs --list      打印发现的持久化 key、归属与消费方证据
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = 'src'
const SW = 'src/views/settingsWindow'
const MANIFEST = 'scripts/settings-wiring-manifest.json'
const BASELINE = 'scripts/settings-wiring-baseline.json'
/**
 * 持久层发现范围：这五个目录算"配置真正落盘的地方"。
 *
 * `src/components` 是 2026-09-22 最终评审补进来的（I4）：组件里直接 `useRecentSearchHistory`
 * 写 localStorage 的 key（`tjg-add-friend-search-history` 等）此前既不在发现范围、也不在清单里，
 * 守门却打印"无未登记 key"，覆盖被高估。
 */
const DISCOVERY_ROOTS = ['src/stores', 'src/services', 'src/utils', 'src/composables', 'src/components']

/** Windows 反斜杠 → POSIX：路径比较、baseline 键名、manifest 键都必须用 `/`。 */
const toPosix = (p) => p.split('\\').join('/')

const isTestPath = (p) => p.includes('__tests__') || /\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(p)

/** 递归收集目录下的 `.ts` / `.vue`（POSIX 路径，跳过 node_modules）。 */
function collectFiles(roots) {
  const out = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    const stack = [root]
    while (stack.length > 0) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir)) {
        const full = toPosix(join(dir, entry))
        if (statSync(full).isDirectory()) {
          if (entry === 'node_modules') continue
          stack.push(full)
        } else if (/\.(ts|vue)$/.test(entry)) {
          out.push(full)
        }
      }
    }
  }
  return out
}

const allFiles = collectFiles([ROOT])
const sources = allFiles.map((path) => ({ path, text: readFileSync(path, 'utf8') }))

/* ------------------------------------------------------------------ *
 * 枚举解析：`X_STORAGE_KEY = StoresEnum.USER` 这类写法需要知道枚举值。
 * ------------------------------------------------------------------ */

/** 读取 `src/enums/app.ts` 的 StoresEnum（键 → 字符串值）。 */
function readStoresEnum() {
  const path = 'src/enums/app.ts'
  const map = new Map()
  if (!existsSync(path)) return map
  const text = readFileSync(path, 'utf8')
  const start = text.indexOf('enum StoresEnum')
  if (start < 0) return map
  const end = text.indexOf('\n}', start)
  const body = text.slice(start, end < 0 ? undefined : end)
  for (const m of body.matchAll(/([A-Z][A-Z0-9_]*)\s*=\s*'([^']+)'/g)) map.set(m[1], m[2])
  return map
}

const storesEnum = readStoresEnum()
const resolveEnumMember = (name) => storesEnum.get(name)

/* ------------------------------------------------------------------ *
 * 持久层发现
 * ------------------------------------------------------------------ */

/**
 * 从 `openBrace`（`{` 的下标）起，按括号配对取出对象体的**内部文本**。
 *
 * 为什么不用 `/\{([\s\S]*?)\n\}/`：那要求收尾 `}` 顶格，带缩进或嵌套的对象一律漏掉。
 * 这里跳过字符串/模板字面量与注释后再配对，语法无关（类型标注、`as const`、
 * 多行字段都适用）。配不上返回 `null`，调用方跳过而不是猜。
 */
function extractObjectBody(text, openBrace) {
  let depth = 0
  let i = openBrace
  let quote = null
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (quote !== null) {
      if (ch === '\\') i += 2
      else {
        if (ch === quote) quote = null
        i += 1
      }
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      i += 1
      continue
    }
    if (ch === '/' && next === '/') {
      i = text.indexOf('\n', i)
      if (i < 0) return null
      continue
    }
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      if (end < 0) return null
      i = end + 2
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(openBrace + 1, i)
    }
    i += 1
  }
  return null
}

/**
 * 从一个 `.ts` / `.vue` 文件里收集"可用于解析 key 的符号表"。
 *
 * 返回 `{ consts, keyByName, objects }`：
 *  - `consts`：UPPER_SNAKE 字符串常量 → 字面量（`STORAGE_KEY`、`KEY_PREFIX`…）
 *  - `keyByName`：`*_STORAGE_KEY` 常量名 → key 字面量（含 `static readonly`、类型标注与枚举写法）
 *  - `objects`：`*STORAGE_KEYS` 映射名 → (字段 → key 字面量)
 */
function collectSymbols(text) {
  const consts = new Map()
  const keyByName = new Map()
  const objects = new Map()

  // 所有 UPPER_SNAKE 字符串常量，覆盖 `private static readonly X_STORAGE_KEY = '...'`
  for (const m of text.matchAll(/(?<![\w$.])([A-Z][A-Z0-9_]*)\s*[:=]\s*'([^']+)'/g)) {
    consts.set(m[1], m[2])
  }
  // 带类型标注的常量：`const X_STORAGE_KEY: string = 'literal'`；旧正则要求 `[:=]` 后紧跟引号，整条漏掉
  for (const m of text.matchAll(/(?<![\w$.])([A-Z][A-Z0-9_]*)\s*:\s*[^='"\n]+=\s*'([^']+)'/g)) {
    consts.set(m[1], m[2])
  }
  // `NAME_STORAGE_KEY = Enum.MEMBER`（如 StoresEnum.USER → 'user'），同样允许类型标注
  for (const m of text.matchAll(
    /(?<![\w$])(\w*STORAGE_KEY)\s*(?::[^='"\n]+)?=\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g
  )) {
    const value = resolveEnumMember(m[3])
    if (value !== undefined) consts.set(m[1], value)
  }
  for (const [name, value] of consts) {
    if (name.endsWith('STORAGE_KEY')) keyByName.set(name, value)
  }
  // `*STORAGE_KEYS` 映射。声明头允许类型标注 / 泛型：`const STORAGE_KEYS: Record<K, V> = {`。
  // 逐个候选名字往后找**顶层** `=` 再配 `{`，不使用缩进敏感的收尾正则（Critical #1）。
  for (const head of text.matchAll(/(?<![\w$])(\w*STORAGE_KEYS\w*)/g)) {
    const name = head[1]
    const after = head.index + name.length
    const brace = findObjectOpenBrace(text, after)
    if (brace === null) continue
    const body = extractObjectBody(text, brace)
    if (body === null) continue
    const fields = new Map()
    for (const f of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/g)) fields.set(f[1], f[2])
    if (fields.size > 0) objects.set(name, fields)
  }
  return { consts, keyByName, objects }
}

/**
 * 从 `from` 起找到 `NAME ... = {` 里的 `{` 下标。
 *
 * 先跳到声明头的类型的结束：`:` 后面可能跟 `Record<keyof X, string>` / `{ a: string }`
 * 这类含 `<>`、`{}`、`()` 的标注，必须在**顶层**找到 `=`，再要求后面是 `{`。
 * 找不到 / 结构不认识返回 `null`。
 */
function findObjectOpenBrace(text, from) {
  let i = from
  while (i < text.length && /\s/.test(text[i])) i += 1
  if (text[i] === ':') {
    i += 1
    let depth = 0
    while (i < text.length) {
      const ch = text[i]
      if (ch === '=' && depth === 0) break
      if (ch === '<' || ch === '(' || ch === '{' || ch === '[') depth += 1
      else if (ch === '>' || ch === ')' || ch === '}' || ch === ']') depth -= 1
      else if (ch === ';' || ch === '\n') {
        if (depth === 0) return null
      }
      i += 1
    }
  }
  if (text[i] !== '=') return null
  i += 1
  while (i < text.length && /\s/.test(text[i])) i += 1
  return text[i] === '{' ? i : null
}

/** 求值单个表达式：字面量 / 已知常量 / 对象成员。解析不了返回 null。 */
function resolveExpr(expr, { consts, objects }) {
  const trimmed = expr.trim()
  const literal = /^'([^']+)'$/.exec(trimmed)
  if (literal) return literal[1]
  const bare = /^([A-Za-z_$][\w$]*)$/.exec(trimmed)
  if (bare) return consts.get(bare[1]) ?? null
  const member = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(trimmed)
  if (member) return objects.get(member[1])?.get(member[2]) ?? consts.get(member[2]) ?? null
  return null
}

/**
 * 解析 `localStorage` / `sessionStorage` 的 `setItem(<arg>, ...)` 首参。
 *
 * 支持 `'literal'`、同文件常量 / 对象成员，以及模板字面量：已知常量替换成字面量，
 * 未知插值替换成 `*`（`` `${KEY_PREFIX}${id}` `` → `tjg.persistedDeviceId:*`）。
 * 完全动态（函数调用、纯变量）返回 `null`，调用方计入 unresolved，绝不猜。
 */
function resolveStorageArg(arg, symbols) {
  const trimmed = arg.trim()
  const literal = /^'([^']+)'$/.exec(trimmed)
  if (literal) return literal[1]
  const direct = resolveExpr(trimmed, symbols)
  if (direct !== null) return direct
  const template = /^`([\s\S]*)`$/.exec(trimmed)
  if (!template) return null
  const inner = template[1]
  if (!inner.includes('${')) return inner
  let pattern = ''
  let cursor = 0
  for (const m of inner.matchAll(/\$\{([^}]*)\}/g)) {
    pattern += inner.slice(cursor, m.index)
    cursor = m.index + m[0].length
    const value = resolveExpr(m[1], symbols)
    pattern += value === null ? '*' : value
  }
  pattern += inner.slice(cursor)
  // 整条键都不可求值（只有 `*`）时不登记无意义的通配
  return pattern === '*' ? null : pattern
}

/**
 * `localStorage.setItem` **与** `sessionStorage.setItem`（`window.` / `globalThis.` 前缀任意）。
 *
 * 旧版只匹配 `localStorage`，于是 `sessionStorage.setItem('oidc_state', …)` 这类
 * 会话级持久化既不进清单也不计数（Task 5 review Important #3）。两种介质都是"刷新后仍在"
 * 的持久层，必须一视同仁。
 */
const SET_ITEM = /(?:window\.|globalThis\.)?(local|session)Storage\.setItem\(\s*([^,)]+)/g

/**
 * 发现持久层 key。
 *
 * 返回 `{ keys, unresolved }`：
 *  - `keys`：`Map<key, { sources: Map<path, Set<来源>>, storages: Set<'local'|'session'> }>`，
 *    只包含**能静态求值**的 key；`storages` 只记录 setItem 处能确认的介质（常量/映射声明
 *    本身不带介质信息，为空集）。
 *  - `unresolved`：动态位置的说明文本（只计数、不判定，绝不猜 key）。
 */
function discoverPersistedKeys() {
  const keys = new Map()
  const unresolved = []
  const add = (key, path, source, storage) => {
    if (!key) return
    if (!keys.has(key)) keys.set(key, { sources: new Map(), storages: new Set() })
    const entry = keys.get(key)
    if (!entry.sources.has(path)) entry.sources.set(path, new Set())
    entry.sources.get(path).add(source)
    if (storage) entry.storages.add(storage)
  }
  const describeKey = (key) =>
    [...keys.get(key).sources.entries()]
      .map(([path, srcs]) => `${path} (${[...srcs].join(',')})`)
      .join(' | ')
  const describeStorage = (key) => {
    const storages = [...keys.get(key).storages].sort()
    return storages.length > 0 ? `[${storages.join('+')}Storage]` : ''
  }

  for (const path of collectFiles(DISCOVERY_ROOTS)) {
    if (isTestPath(path)) continue
    const text = readFileSync(path, 'utf8')
    const symbols = collectSymbols(text)

    for (const [name, value] of symbols.keyByName) add(value, path, name)
    for (const [name, fields] of symbols.objects) {
      for (const [field, value] of fields) add(value, path, `${name}.${field}`)
    }

    // Pinia persist：store id 即 pinia-plugin-persistedstate 的默认持久化键。
    if (/\bpersist\s*:/.test(text)) {
      for (const m of text.matchAll(
        /defineStore\(\s*(?:'([^']+)'|([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*))/g
      )) {
        const id = m[1] ?? resolveEnumMember(m[3])
        if (id !== undefined) add(id, path, 'defineStore+persist')
      }
    }

    // 字面量 / 常量 / 模板键族写入（localStorage 与 sessionStorage）。
    for (const m of text.matchAll(SET_ITEM)) {
      if (isCommentedOut(text, m.index)) continue
      const key = resolveStorageArg(m[2], symbols)
      if (key === null) unresolved.push(`${path} ← ${m[1]}Storage.setItem(${m[2].trim()}`)
      else add(key, path, `${m[1]}Storage.setItem`, m[1])
    }
  }

  return { keys, unresolved, describeKey, describeStorage }
}

/**
 * 匹配是否位于行注释 / JSDoc（`// …`、`* …`、`/* …`）。注释里的
 * `localStorage.setItem('x')` 只是说明文字，不是真实写入，必须排除（否则会伪造 key）。
 */
function isCommentedOut(text, index) {
  const lineStart = text.lastIndexOf('\n', index) + 1
  const prefix = text.slice(lineStart, index).trimStart()
  return prefix.startsWith('//') || prefix.startsWith('*') || prefix.startsWith('/*')
}

/* ------------------------------------------------------------------ *
 * 消费方引用证据（判据 A 的加强版）
 *
 * 旧口径只要求 `consumers` 路径存在：把某个 consumer 文件里的读取逻辑整段删掉，
 * 守门仍旧打印 OK。现在要求 consumer 文件里真的出现该 key 的引用形态，并按证据
 * 强弱分档：
 *   verified    —— key 字面量 / `*_STORAGE_KEY` 常量 / 映射成员出现在**非写入**位置，
 *                  或引用了 owner 模块（store / barrel），说明该文件确实与 key 有关；
 *   write-only  —— 只在 `setItem` / `removeItem` 的写入位置出现（写方不是读方）；
 *   none        —— 路径存在，但文件里找不到任何引用。
 * `write-only` / `none` 单列打印为 "consumer unverified"，**不**静默通过；而某个 key
 * 在所有 consumer 上都拿不到 verified 时直接 FAIL —— 否则清单可以靠一堆空路径维持绿。
 * ------------------------------------------------------------------ */

/** 文件内容缓存：owner / consumer 会被反复引用，避免重复读盘。 */
const sourceCache = new Map()
function fileText(path) {
  if (!sourceCache.has(path)) {
    sourceCache.set(path, existsSync(path) ? readFileSync(path, 'utf8') : null)
  }
  return sourceCache.get(path)
}

/** 发现器为该 key 记录到的符号名（常量名 / 映射成员），用于在消费方文件里找引用。 */
function keySymbolNames(discoveredEntry) {
  const names = new Set()
  for (const sources of discoveredEntry?.sources.values() ?? []) {
    for (const source of sources) {
      // `defineStore+persist` 是 store id，`localStorage.setItem` 只是写入位置说明，都不是符号名。
      if (source === 'defineStore+persist' || source.endsWith('Storage.setItem')) continue
      names.add(source)
    }
  }
  return names
}

/** 从 import / 动态 import 里提取说明符。 */
const IMPORT_SPECIFIER = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g

/**
 * 把 import 说明符解析成仓库内 POSIX 路径（去掉扩展名）；裸包名返回 null。
 *
 * 用于判断 consumer 是否引用了 owner 模块（含 barrel：`@/services/backend` 覆盖
 * `src/services/backend/config.ts`），而不是解析真实模块图。
 */
function resolveImportSpecifier(specifier, fromPath) {
  const stripExt = (p) => p.replace(/\.\w+$/, '')
  if (specifier.startsWith('@/')) return stripExt(toPosix(join(ROOT, specifier.slice(2))))
  if (specifier.startsWith('#/')) return stripExt(toPosix(join(ROOT, 'mobile', specifier.slice(2))))
  if (specifier.startsWith('~/')) return stripExt(toPosix(specifier.slice(2)))
  if (specifier.startsWith('.')) {
    return stripExt(toPosix(relative(process.cwd(), resolve(dirname(fromPath), specifier))))
  }
  return null
}

/** 带词边界的整名匹配（`STORAGE_KEYS.audioInputId` 这类含点号的名字原样匹配）。 */
function mentions(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\w$.])${escaped}(?![\\w$])`).test(text)
}

/** key 字面量出现的位置；动态键族（`prefix*`）退化成前缀匹配。 */
function literalPositions(text, key) {
  const out = []
  const needles = key.endsWith('*')
    ? [key.slice(0, -1)]
    : [`'${key}'`, `"${key}"`, `\`${key}\``]
  for (const needle of needles) {
    let index = text.indexOf(needle)
    while (index >= 0) {
      out.push({ index, write: /\.(?:set|remove)Item\(\s*$/.test(text.slice(Math.max(0, index - 48), index)) })
      index = text.indexOf(needle, index + 1)
    }
  }
  return out
}

/**
 * 单个 consumer 对单个 key 的证据分档。
 *
 * `ownerModules` 是"可能定义/写出该 key 的模块"（发现器记录的来源路径 + manifest owner，
 * 去扩展名）；consumer 引用其中任意一个（含 barrel 父目录）都算有据可查。
 *
 * 返回 `{ strength: 'verified'|'weak'|'none', reason }`。
 */
function consumerEvidence(consumerPath, key, ownerModules, symbolNames, discoveredEntry) {
  const text = fileText(consumerPath)
  if (text === null) return { strength: 'none', reason: '路径不存在' }

  // owner 本体定义 pinia persist store：store id 就是持久化 key，定义处即是接线处。
  if (discoveredEntry?.sources.get(consumerPath)?.has('defineStore+persist')) {
    return { strength: 'verified', reason: 'owner 定义 pinia persist store' }
  }

  let writeOnly = false
  for (const position of literalPositions(text, key)) {
    if (isCommentedOut(text, position.index)) continue
    if (position.write) {
      writeOnly = true
      continue
    }
    return { strength: 'verified', reason: 'key 字面量（非写入位置）' }
  }

  for (const symbol of symbolNames) {
    // 映射成员只认 `OBJ.field` 全名：裸字段名（`enabled`、`state`）随处可见，会假阳性。
    if (mentions(text, symbol)) return { strength: 'verified', reason: `常量 ${symbol}` }
  }

  for (const match of text.matchAll(IMPORT_SPECIFIER)) {
    const resolved = resolveImportSpecifier(match[1], consumerPath)
    if (resolved === null) continue
    for (const module of ownerModules) {
      if (resolved === module || module.startsWith(`${resolved}/`)) {
        return { strength: 'verified', reason: `引用 owner 模块 ${match[1]}` }
      }
    }
  }

  return writeOnly
    ? { strength: 'weak', reason: '仅在 setItem/removeItem 写入位置出现' }
    : { strength: 'none', reason: '无引用' }
}

/**
 * 逐条审计清单消费方证据。
 *
 * 返回 `{ verified, unverified, unverifiedKeys }`：`unverifiedKeys` 是**仍然存在却一个
 * verified 消费方都没有**的 key —— 这类条目等于把"消费方"写成了空路径，必须 FAIL。
 * 已陈旧的条目（发现器找不到该 key）不计入硬校验，交给 stale 告警处置。
 */
function auditConsumerEvidence(entries, discoveredKeys) {
  const verified = []
  const unverified = []
  const unverifiedKeys = []
  for (const [key, entry] of entries) {
    const discoveredEntry = discoveredKeys.get(key)
    const ownerModules = new Set(
      [entry.owner.split(':')[0], ...(discoveredEntry?.sources.keys() ?? [])].map((path) =>
        path.replace(/\.\w+$/, '')
      )
    )
    const symbolNames = keySymbolNames(discoveredEntry)
    let hasVerified = false
    for (const consumer of entry.consumers) {
      const evidence = consumerEvidence(consumer, key, ownerModules, symbolNames, discoveredEntry)
      if (evidence.strength === 'verified') {
        hasVerified = true
        verified.push({ key, consumer })
      } else {
        unverified.push({ key, consumer, reason: evidence.reason })
      }
    }
    // 陈旧条目（发现器已找不到该 key）由 stale 告警负责；这里只对仍然存在的 key 硬校验，
    // 避免"key 已删除、清单忘删"报出误导性的"消费方无证据"FAIL。
    if (!hasVerified && discoveredEntry !== undefined) unverifiedKeys.push({ key, consumers: entry.consumers })
  }
  return { verified, unverified, unverifiedKeys }
}

/** manifest 里已不再对应任何发现 key 的陈旧条目（只告警，不自动删除）。 */
function staleManifestKeys(entries) {
  return [...entries.keys()]
    .filter((key) => !discovered.has(key))
    .sort((a, b) => a.localeCompare(b))
}

/** 打印陈旧 manifest 条目告警；返回条目名列表（无陈旧条目时返回空数组且不打印）。 */
function warnStaleManifestEntries(entries) {
  const stale = staleManifestKeys(entries)
  if (stale.length === 0) return stale
  console.log(
    `check-settings-wiring: 提示 ${stale.length} 个 manifest 条目已不再对应任何可静态求值的持久化 key（陈旧登记）`
  )
  for (const key of stale) console.log(`  stale ${key}`)
  console.log(`  请从 ${MANIFEST} 删除这些条目，或恢复它们对应的持久化写入代码。`)
  return stale
}

/**
 * 漏报自检：用**故意更宽松**的语法假设重扫同一批目录，返回"宽松扫到"的 key 集合。
 *
 * 与 `discoverPersistedKeys` 刻意用不同的实现路径（自己找名字 → 最多 200 字符窗口内
 * 找 `=` `{`，再用非贪婪 `\n}` 取体），这样其中一条正则与真实语法脱节时，另一条还能
 * 把它照出来。任何只在宽松集合里出现的 key = 发现器漏报，调用方一律 FAIL。
 *
 * 宽松集合里只保留"key 形状"（`-`/`.`/`_` 分隔）的字面量，避免把类型标注里的
 * `'string'`、开关对象里的 `'mobile'` 这类无关字符串算成 key 而天天误报。
 */
function permissiveScanKeys() {
  const found = new Set()
  const looksLikeKey = (value) => /^[A-Za-z][\w.:@-]*$/.test(value) && /[-._]/.test(value)
  for (const path of collectFiles(DISCOVERY_ROOTS)) {
    if (isTestPath(path)) continue
    const text = readFileSync(path, 'utf8')
    // 1) 名字含 STORAGE_KEY 的对象字面量：只看"名字 → (≤200 字符内) `=` → `{`"的声明形态，
    //    不要求类型标注长什么样；对象体用最朴素的 `\n}` 截断（与严格版的括号配对互为独立路径）。
    for (const head of text.matchAll(/[\w$]*STORAGE_KEY[\w$]*/g)) {
      const after = head.index + head[0].length
      const decl = /^\s*(?::[^=;\n]*)?=\s*\{/.exec(text.slice(after, after + 200))
      if (!decl) continue
      const openBrace = after + decl[0].length - 1
      const close = text.indexOf('\n}', openBrace)
      if (close < 0) continue
      for (const m of text.slice(openBrace + 1, close).matchAll(/:\s*'([^']+)'/g)) {
        if (looksLikeKey(m[1])) found.add(m[1])
      }
    }
    // 2) 任何 `*STORAGE_KEY` 常量的字符串字面量（含类型标注 `X: string = 'k'`）
    for (const m of text.matchAll(/[\w$]*STORAGE_KEY[\w$]*\s*(?::[^=;\n]*)?=\s*'([^']+)'/g)) {
      if (looksLikeKey(m[1])) found.add(m[1])
    }
    // 3) 任何 (local|session)Storage 的 setItem 字面量首参（含换行、链式调用）
    for (const m of text.matchAll(/(?:local|session)Storage[\s\S]{0,40}?setItem\(\s*'([^']+)'/g)) {
      if (!isCommentedOut(text, m.index)) found.add(m[1])
    }
  }
  return found
}

/* ------------------------------------------------------------------ *
 * 判据 B：设置窗口直接写入的死配置（保留旧口径）
 * ------------------------------------------------------------------ */

const written = new Map()
for (const { path, text } of sources) {
  if (!path.startsWith(SW) || isTestPath(path)) continue
  const symbols = collectSymbols(text)
  for (const m of text.matchAll(SET_ITEM)) {
    if (isCommentedOut(text, m.index)) continue
    const key = resolveStorageArg(m[2], symbols)
    if (key !== null && !written.has(key)) written.set(key, path)
  }
}

/**
 * 什么算"消费方"。
 *
 * 关键：**另一个设置界面不算消费方**。否则 mobile 的设置页（只读写自己的开关）
 * 会把一个死 key 判成 live。这里刻意保守：宁可多报"死"（给人复核），也不要把死配置判活。
 */
const isSettingsUi = (path) => path.startsWith(SW) || /\/mobile\/views\/.*Settings\.vue$/.test(path)
const consumers = ({ path, text }, key) =>
  !isSettingsUi(path) && !isTestPath(path) && text.includes(`'${key}'`)
const dead = [...written.entries()]
  .filter(([key]) => !sources.some((s) => consumers(s, key)))
  .map(([key, path]) => ({ key, path }))
  .sort((a, b) => a.key.localeCompare(b.key))

/* ------------------------------------------------------------------ *
 * 判据 A：清单契约
 * ------------------------------------------------------------------ */

const regenerateHint = '  运行 node scripts/check-settings-wiring.mjs --update 重建死配置基线。'

/**
 * 序列化死配置基线，形状与 Biome 的 JSON 格式化（lineWidth 120）一致。
 *
 * 为什么不是简单 `JSON.stringify(..., null, 2)`：Biome 会把能在 120 列内放下的字符串
 * 数组内联成一行，而 `JSON.stringify` 永远展开成多行，于是每次 `--update` 都会产生一次
 * 纯空白 diff（2026-09-22 最终评审 minor）。这里按同一规则渲染，让 `--update` 的输出
 * 与已提交（Biome 规范化过）的文件逐字节一致。
 */
function serializeBaseline(dead) {
  const names = dead.map((d) => d.key)
  const inlineNames = `[${names.map((name) => JSON.stringify(name)).join(', ')}]`
  const inline = `  "deadKeyNames": ${inlineNames}`
  const namesBlock =
    inline.length <= 120
      ? inline
      : `  "deadKeyNames": [\n${names.map((name) => `    ${JSON.stringify(name)}`).join(',\n')}\n  ]`
  return `{\n  "deadKeys": ${dead.length},\n${namesBlock}\n}\n`
}

/** 读取 JSON 文件；缺失返回 null，损坏返回 'invalid'。 */
function readJson(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return 'invalid'
  }
}

/** 校验清单结构，返回 `{ entries, errors }`。 */
function validateManifest(manifest) {
  const errors = []
  if (manifest === null) {
    errors.push(`清单文件缺失：${MANIFEST}`)
    return { entries: null, errors }
  }
  if (manifest === 'invalid') {
    errors.push(`清单文件无法解析：${MANIFEST}`)
    return { entries: null, errors }
  }
  if (typeof manifest?.keys !== 'object' || manifest.keys === null) {
    errors.push(`清单缺少对象型 keys：${MANIFEST}`)
    return { entries: null, errors }
  }
  const entries = new Map()
  for (const [key, entry] of Object.entries(manifest.keys)) {
    if (typeof entry?.owner !== 'string' || entry.owner.length === 0) {
      errors.push(`${key}：缺少 owner`)
      continue
    }
    if (!Array.isArray(entry.consumers) || entry.consumers.length === 0) {
      errors.push(`${key}：缺少 consumers（至少一个真实消费方路径）`)
      continue
    }
    const ownerPath = entry.owner.split(':')[0]
    if (!existsSync(ownerPath)) errors.push(`${key}：owner 路径不存在 ${ownerPath}`)
    for (const consumer of entry.consumers) {
      if (typeof consumer !== 'string' || consumer.length === 0) {
        errors.push(`${key}：consumers 含非法路径`)
        continue
      }
      if (!existsSync(consumer)) errors.push(`${key}：consumer 路径不存在 ${consumer}`)
    }
    entries.set(key, entry)
  }
  return { entries, errors }
}

/** 当前发现集合 ⊆ 基线集合；返回基线里没有的键名。 */
const notIn = (names, baselineNames) => names.filter((name) => !baselineNames.has(name))

const { keys: discovered, unresolved, describeKey, describeStorage } = discoverPersistedKeys()
const discoveredNames = [...discovered.keys()].sort((a, b) => a.localeCompare(b))

// 清单在三种模式下都要先读：`--list` 打印消费方证据、`--update` 先校验清单再写基线、
// verify 走完整判据。清单不合法时不在这里退出，交给各模式给出各自语义的拒绝信息。
const manifest = readJson(MANIFEST)
const { entries, errors } = validateManifest(manifest)

/* ------------------------------------------------------------------ *
 * --list / --update / 校验
 * ------------------------------------------------------------------ */

if (process.argv.includes('--list')) {
  for (const name of discoveredNames) {
    console.log(`${name.padEnd(48)} ${describeStorage(name).padEnd(18)} ${describeKey(name)}`)
  }
  console.log(`--- 共 ${discoveredNames.length} 个可静态求值的持久化 key`)
  const permissive = permissiveScanKeys()
  const drift = [...permissive].filter((key) => !discovered.has(key)).sort((a, b) => a.localeCompare(b))
  console.log(`--- 漏报自检：宽松扫描 ${permissive.size} 个 key，其中发现器漏报 ${drift.length} 个`)
  for (const key of drift) console.log(`  ! ${key}`)
  if (entries !== null) {
    const audit = auditConsumerEvidence(entries, discovered)
    console.log(
      `--- 消费方证据：verified ${audit.verified.length}，consumer unverified ${audit.unverified.length}（只有路径、查不到引用）`
    )
    for (const item of audit.unverified) console.log(`  ? ${item.key} ← ${item.consumer}（${item.reason}）`)
    for (const item of audit.unverifiedKeys) {
      console.log(`  ! ${item.key} 在所有 consumer 上都没有引用证据：${item.consumers.join('、')}`)
    }
  }
  if (unresolved.length > 0) {
    console.log(`--- 无法静态判定（不计入、不判定）${unresolved.length} 处`)
    for (const item of unresolved) console.log(`  ? ${item}`)
  }
  process.exit(0)
}

if (process.argv.includes('--update')) {
  // --update 先校验清单：发现但未登记的 key 一律拒绝写入基线，否则
  // "新 key 不登记 + 顺手收紧死配置基线"会在同一次 --update 里蒙混过关。
  if (errors.length > 0) {
    console.error(`check-settings-wiring: 拒绝写入基线 — 清单不合法：${MANIFEST}`)
    for (const error of errors) console.error(`  ${error}`)
    process.exit(1)
  }
  const unregisteredNow = notIn(discoveredNames, new Set(entries.keys()))
  if (unregisteredNow.length > 0) {
    console.error(`check-settings-wiring: 拒绝写入基线 — 发现未登记的持久化 key ${unregisteredNow.length} 个`)
    for (const key of unregisteredNow) {
      console.error(`  ${key.padEnd(48)} ${describeStorage(key).padEnd(18)} ${describeKey(key)}`)
    }
    console.error(`先把它们写进 ${MANIFEST}（owner + 至少一个真实消费方路径），再谈基线。`)
    process.exit(1)
  }
  // 陈旧条目只告警：清理是显式维护动作，--update 不替人删登记。
  warnStaleManifestEntries(entries)
  // ratchet 只允许收紧：--update 不能把基线抬高（否则新增死配置会被一次性赦免）
  const previous = readJson(BASELINE)
  if (
    previous &&
    previous !== 'invalid' &&
    typeof previous.deadKeys === 'number' &&
    dead.length > previous.deadKeys
  ) {
    console.error(`check-settings-wiring: 拒绝抬高基线 — 本次 ${dead.length} > 现有 ${previous.deadKeys}`)
    for (const d of dead) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
    console.error('ratchet 只允许收紧：新增设置项必须先给出真实消费方。')
    process.exit(1)
  }
  // --update 也必须走与 verify 相同的键名子集校验：同数量换键同样拒绝
  if (previous && previous !== 'invalid' && Array.isArray(previous.deadKeyNames)) {
    const added = notIn(
      dead.map((d) => d.key),
      new Set(previous.deadKeyNames)
    )
    if (added.length > 0) {
      console.error('check-settings-wiring: 拒绝新增死配置键名 — --update 不允许引入基线里没有的 key')
      for (const key of added) console.error(`  ${key}`)
      console.error('修掉一个又引入一个等价的死配置同样不允许：先接线，或说明理由并显式更新基线。')
      process.exit(1)
    }
  }
  writeFileSync(BASELINE, serializeBaseline(dead))
  console.log(`check-settings-wiring: 基线已更新为 ${dead.length}`)
  process.exit(0)
}

// --- 判据 A ---
if (errors.length > 0) {
  console.error(`check-settings-wiring: FAIL — 清单不合法：${MANIFEST}`)
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}

// 介质一致性：manifest 显式标注 storage 时，必须与实际写入介质一致（session vs local 不能混账）
for (const [key, entry] of entries) {
  const entryStorages = discovered.get(key)?.storages
  if (entry.storage && entryStorages && entryStorages.size > 0 && !entryStorages.has(entry.storage)) {
    errors.push(
      `${key}：manifest 标注 storage=${entry.storage}，但发现的实际写入介质是 ${[...entryStorages].join('/')}Storage`
    )
  }
}
if (errors.length > 0) {
  console.error(`check-settings-wiring: FAIL — 清单与发现不一致：${MANIFEST}`)
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}

// 漏报自检：发现器与宽松扫描不一致 = 正则又漏了真实声明语法（Critical #1 的静默失效）
const permissive = permissiveScanKeys()
const drift = [...permissive].filter((key) => !discovered.has(key)).sort((a, b) => a.localeCompare(b))
if (drift.length > 0) {
  console.error(`check-settings-wiring: FAIL — 漏报自检未通过：宽松扫描发现 ${drift.length} 个 key 未被发现器识别`)
  for (const key of drift) console.error(`  ${key}`)
  console.error('这说明持久层发现器的正则与真实声明语法脱节（例如带类型标注的 *STORAGE_KEYS）。')
  console.error('先修 scripts/check-settings-wiring.mjs 的发现逻辑，不要靠 --update 绕过。')
  process.exit(1)
}

const unregistered = notIn(discoveredNames, new Set(entries.keys()))
if (unregistered.length > 0) {
  console.error(`check-settings-wiring: FAIL — 发现未登记的持久化 key ${unregistered.length} 个`)
  for (const key of unregistered) {
    console.error(`  ${key.padEnd(48)} ${describeStorage(key).padEnd(18)} ${describeKey(key)}`)
  }
  console.error(`新增持久化 key 必须先写进 ${MANIFEST}：给出 owner 与至少一个真实消费方路径。`)
  process.exit(1)
}

// 消费方引用证据：路径存在还不够，必须能在文件里查到该 key 的引用形态。
warnStaleManifestEntries(entries)
const audit = auditConsumerEvidence(entries, discovered)
if (audit.unverified.length > 0) {
  console.log(
    `check-settings-wiring: 提示 ${audit.unverified.length} 个已登记消费方只有路径存在、查不到引用证据（consumer unverified）`
  )
  for (const item of audit.unverified) console.log(`  ? ${item.key} ← ${item.consumer}（${item.reason}）`)
  console.log('  这些条目当前只靠 existsSync 维持登记；若读取逻辑已被删除，请改清单或恢复接线。')
}
if (audit.unverifiedKeys.length > 0) {
  console.error(`check-settings-wiring: FAIL — ${audit.unverifiedKeys.length} 个 key 在所有登记消费方里都没有引用证据`)
  for (const item of audit.unverifiedKeys) {
    console.error(`  ${item.key}：consumers = ${item.consumers.join('、')}`)
  }
  console.error('消费方不能只是"路径存在"：请在 consumer 文件里保留读取该 key 的代码（字面量/常量/store/owner 模块）。')
  process.exit(1)
}

// --- 判据 B ---
if (!existsSync(BASELINE)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺失：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

const baseline = readJson(BASELINE)

if (baseline === 'invalid') {
  console.error(`check-settings-wiring: FAIL — 基线文件无法解析：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (typeof baseline?.deadKeys !== 'number' || !Number.isFinite(baseline.deadKeys)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺少数值型 deadKeys：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (!Array.isArray(baseline.deadKeyNames)) {
  console.error(`check-settings-wiring: FAIL — 基线文件缺少数组型 deadKeyNames：${BASELINE}`)
  console.error(regenerateHint)
  process.exit(1)
}

if (dead.length > baseline.deadKeys) {
  console.error(`check-settings-wiring: FAIL — 死配置 ${dead.length} > 基线 ${baseline.deadKeys}`)
  for (const d of dead) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
  console.error('新增设置项必须有真实消费方，或先用 --update 说明理由。')
  process.exit(1)
}

/**
 * 只比数量会漏掉「修掉一个又引入一个」的等价替换（总数不变）。这里额外断言
 * 当前死配置集合 ⊆ 基线集合：出现基线里没有的 key 一律失败，逼出显式处置。
 */
const unexpected = notIn(
  dead.map((d) => d.key),
  new Set(baseline.deadKeyNames)
)
if (unexpected.length > 0) {
  console.error('check-settings-wiring: FAIL — 出现基线未记录的死配置（换名绕过数量 ratchet）')
  for (const key of unexpected) console.error(`  ${key}`)
  console.error('修掉一个又引入一个等价的死配置同样不允许：先接线，或说明理由后更新基线。')
  process.exit(1)
}

console.log(
  `check-settings-wiring: OK 持久化 key 清单 ${discoveredNames.length}/${entries.size}（无未登记 key）、` +
    `死配置 ${dead.length}（基线 ${baseline.deadKeys}，键名均在基线内）`
)
console.log(`  扫描范围：${DISCOVERY_ROOTS.join('、')}（超出此范围的持久化写入不在本守门覆盖面）`)
console.log(
  `  消费方证据：verified ${audit.verified.length}/${audit.verified.length + audit.unverified.length}，` +
    `consumer unverified ${audit.unverified.length}（仅路径存在，判活≠生效）`
)
console.log(`  漏报自检通过：宽松扫描 ${permissive.size} 个 key 全部被发现器识别（含类型标注映射与 sessionStorage）`)
if (unresolved.length > 0) {
  console.log(`  提示：${unresolved.length} 处持久化写入是动态 key，无法静态判定（已知局限，见脚本注释）`)
}
if (dead.length < baseline.deadKeys) {
  console.log('  可运行 node scripts/check-settings-wiring.mjs --update 收紧死配置基线')
}
