#!/usr/bin/env node
/**
 * i18n 死 key ratchet：`locales/zh-CN` 里存在、但 `src/` 生产代码零引用的 key。
 *
 * 修复了三个旧 bug：
 *  1. `walk()` 声明"排除测试"却只跳过 `node_modules`，测试文件里的 `t('x.y')` 被当成
 *     真实使用方。现在真正跳过 `__tests__` / `*.test.*` / `*.spec.*` / `*.stories.*`。
 *  2. `sourceText.includes(key)` 是命名空间盲匹配：源码里的 `mobile_labs.title` 会把
 *     `labs.title` 判成"已使用"。现在按 key 边界做精确匹配（`mobile_labs.title` 只会
 *     命中它自己）。
 *  3. **判活证据曾是"全仓点分 token 集合"**：注释、URL、日志文案、成员表达式
 *     （`a.b.c`）、import 说明符里的同形 token 都会把一个死 key 判活。现在判活收紧到
 *     **翻译引用位置**（见下），注释/URL/普通字符串/成员表达式一律不算引用。
 *
 * 判活证据 = 生产源码里"整段内容恰好等于 key"的字符串字面量，且出现在下列**引用位置**之一：
 *  - `t('k')` / `$t('k')` / `tc('k')` / `te('k')` / `tm('k')` 及其 `?.()` 写法、任意接收者
 *    （`i18n.t(...)` / `this.$t(...)` / `useI18nGlobal().t(...)` 都命中），以及本仓的
 *    包装调用 `translateXxx('k')`：实参子树里的字面量（含 `t(cond ? 'a' : 'b')`）；
 *  - `<i18n-t keypath="k">` 的 `keypath` 属性；
 *  - **键注册表位置**：对象的属性名/属性值、数组元素、变量初始化、赋值右值、`return`
 *    表达式。本仓大量用法是"把 key 存进 map/数组，之后 `t(map[x])` 消费"
 *    （`userMessage: 'error.matrix.network'`、`labelKey: '...'`、`SETTINGS_TAB_GROUP_TRANSLATION_KEYS`…），
 *    这类间接引用无法靠字面量调用点识别，只能按注册表位置识别；
 *  - `new Error('matrix_error.…')`：本仓把 i18n key 作为错误消息抛出，属于间接引用。
 * 其余位置（注释、URL、import、成员表达式、比较运算、非翻译调用的普通实参、类型位置）
 * 一概不算引用：这正是 `--list` 能报出"只在注释里出现过"的死 key 的原因。
 *
 * ratchet：`scripts/i18n-dead-keys-baseline.json` 冻结两个**分开记账**的集合：
 *  - `dead`（可删）：源码里零引用的孤儿 key，清理对象；
 *  - `dynamic`（不可删）：命中源码动态拼接前缀（`` t(`auth.onlineStatus.states.${s}`) ``）
 *    的 key，**不是**孤儿，只是无法用字面量静态匹配。它们单独成节、单独计数，
 *    不得把它们当可删文案（旧口径把它们混进孤儿集合，会误删活翻译）。
 * 正常校验：dead 集合必须 ⊆ 基线 dead 集合、数量不得增加；`--update` 同样拒绝任何新增
 * dead 键名。dynamic 集合是**阻塞 delta**：命中动态前缀的 key 不计入孤儿，因此新增动态族成员
 * 会让可删孤儿"凭空减少"（等价于洗绿）。`--update` 不得静默吸收，必须显式带
 * `--accept-new-dynamic` 才记账（见文末"动态族 delta"）。
 * **本守门不删除任何 key**：基线收缩由逐批人工清理负责。
 *
 * 已知局限：动态拼接 key 仍只能按"第一个插值之前的字面前缀"归类；前缀不含 `.`
 * （例如 `` t(`setting.${x}`) ``）或整条模板完全动态时无法安全归类，会在输出里计数提示。
 * 数字下标段（`privacy.sections.0.title`）是数组动态访问，直接跳过不计入。
 * 键注册表位置是**刻意放宽**的一档：无法证明它一定被 `t()` 消费，但删除风险远大于保留成本，
 * 因此宁可保留并让守门看见它。
 *
 * 实现说明：引用位置的归属判定用 TypeScript 解析器（devDependency，仅做语法树遍历，
 * 不做类型检查）完成，避免正则无法区分注释/模板字面量/正则字面量（`/"/g`）的问题；
 * `.vue` 的 `<script>` 块交给解析器，模板部分按模板语法取 `t(...)` 实参与 `keypath`。
 *
 * 用法：
 *   node scripts/check-i18n-dead-keys.mjs            校验
 *   node scripts/check-i18n-dead-keys.mjs --update   收紧基线（拒绝新增 dead 键名与动态族 delta）
 *   node scripts/check-i18n-dead-keys.mjs --update --accept-new-dynamic  显式确认动态族新增后记账
 *   node scripts/check-i18n-dead-keys.mjs --list [--limit N]  打印孤儿集合 + 动态族排除集合
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const root = path.resolve(process.cwd())
const localesDir = path.join(root, 'locales')
const baseLocale = 'zh-CN'
const srcDir = path.join(root, 'src')
const BASELINE = 'scripts/i18n-dead-keys-baseline.json'
const REGENERATE_HINT = '  运行 node scripts/check-i18n-dead-keys.mjs --update 重建基线。'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.js', '.jsx', '.mjs'])
const isTestPath = (p) => p.includes('__tests__') || /\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(p)

/** 递归收集 `src/` 下的生产源码（真正跳过测试与 story），返回绝对路径。 */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name).split('\\').join('/')
    if (entry.isDirectory()) {
      if (isTestPath(fullPath)) continue
      yield* walk(fullPath)
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !isTestPath(fullPath)) {
      yield fullPath
    }
  }
}

/** 展平一个 locale 对象为 `a.b.c` 形式的叶子 key 列表。 */
function getKeys(obj, prefix = '') {
  const keys = []
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getKeys(obj[key], `${prefix}${key}.`))
    } else {
      keys.push(`${prefix}${key}`)
    }
  }
  return keys
}

/** 翻译调用名：`t`/`tc`/`te`/`tm` 的 `$` 前缀写法，以及本仓的 `translateXxx` 包装。 */
const TRANSLATE_CALLEE = /^(?:\$?(?:t|tc|te|tm)|translate[A-Za-z]*)$/

const isStringLike = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)

/** 取出被调用表达式的方法名：`t` / `$t` / `i18n.t` / `this.$t` / `useI18nGlobal().t` 都归一为名字。 */
function calleeName(expr) {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) return expr.name.text
  return null
}

/** 收集表达式子树里所有"整段就是一个字符串"的字面量值（模板插值不参与）。 */
function collectLiterals(node, add) {
  if (isStringLike(node)) {
    add(node.text)
    return
  }
  ts.forEachChild(node, (child) => collectLiterals(child, add))
}

/** 该字面量是否位于"键注册表位置"（对象键/属性值、数组元素、变量初始化、赋值右值、return）。 */
function isRegistryPosition(node) {
  const parent = node.parent
  if (!parent) return false
  if (ts.isPropertyAssignment(parent) && (parent.initializer === node || parent.name === node)) return true
  if (ts.isArrayLiteralExpression(parent) && parent.elements.includes(node)) return true
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) return true
  if (ts.isPropertyDeclaration(parent) && parent.initializer === node) return true
  if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node) return true
  if (ts.isReturnStatement(parent) && parent.expression === node) return true
  return false
}

const scriptKindFor = (filePath) => {
  const ext = path.extname(filePath)
  if (ext === '.tsx') return ts.ScriptKind.TSX
  if (ext === '.jsx') return ts.ScriptKind.JSX
  if (ext === '.ts' || ext === '.vue') return ts.ScriptKind.TS
  return ts.ScriptKind.JS
}

/**
 * 从一段 TS/JS 代码里收集被引用的 key。
 * 注释不是语法树节点，成员表达式 `a.b.c` 不是字符串字面量 —— 二者天然不会进来。
 */
function collectScriptReferences(text, scriptKind, add) {
  const sourceFile = ts.createSourceFile('__i18n_probe__.ts', text, ts.ScriptTarget.Latest, true, scriptKind)
  const visit = (node) => {
    // `new Error('matrix_error.…')` 是 NewExpression，同样要把实参算作引用
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const name = calleeName(node.expression)
      // 翻译调用：实参子树里的字面量全是 key；`Error(...)`：本仓把 key 当错误消息抛。
      if (name !== null && (TRANSLATE_CALLEE.test(name) || name === 'Error')) {
        for (const arg of node.arguments ?? []) collectLiterals(arg, add)
      }
    }
    if (isStringLike(node) && isRegistryPosition(node)) add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

/** `.vue` 模板里的引用：`t(...)` 实参、`keypath` 属性、模板内对象字面量的 key 值。 */
function collectTemplateReferences(segment, add) {
  // HTML 注释里的同形 token 不算引用
  const text = segment.replace(/<!--[\s\S]*?-->/g, (s) => s.replace(/[^\n]/g, ' '))
  for (const attr of text.matchAll(/\bkeypath\s*=\s*(?::\s*)?(["'])([^"'\n]+)\1/g)) add(attr[2])
  for (const call of text.matchAll(/(?:^|[^\w$])(\$?(?:t|tc|te|tm)|translate[A-Za-z]*)\s*(?:\?\.)?\s*\(/g)) {
    const open = text.indexOf('(', call.index + call[0].length - 1)
    if (open < 0) continue
    let depth = 0
    let end = open
    for (; end < text.length; end++) {
      if (text[end] === '(') depth++
      else if (text[end] === ')') {
        depth--
        if (depth === 0) break
      }
    }
    for (const lit of text.slice(open + 1, end).matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
      add(lit[1] ?? lit[2])
    }
  }
  for (const prop of text.matchAll(/[A-Za-z_$][\w$]*\s*:\s*'([^'\n]*)'/g)) add(prop[1])
}

/** `.vue`：`<script>` 块交给解析器，其余（模板/样式）按模板规则处理。 */
function collectVueReferences(text, add) {
  const ranges = []
  for (const block of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const start = block.index + block[0].indexOf('>') + 1
    ranges.push([start, start + block[1].length])
    collectScriptReferences(block[1], ts.ScriptKind.TS, add)
  }
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) collectTemplateReferences(text.slice(cursor, start), add)
    cursor = end
  }
  if (cursor < text.length) collectTemplateReferences(text.slice(cursor), add)
}

/**
 * 翻译调用里的**模板字面量** key：`` t(`auth.onlineStatus.states.${s}`) ``。
 *
 * 取第一个插值 `${` 之前的字面量部分作为"动态前缀"。命中该前缀的 locale key 无法用
 * 字面量证明引用，但也**不能当孤儿删除** —— 它们是动态可达的活文案。
 *
 * 覆盖两种写法：
 *  1. 模板直接作为翻译调用参数（含 `?.` 可选调用）；
 *  2. 先赋给变量再由翻译调用消费：`` const fullKey = `room_preview.${key}` `` +
 *     `useI18nGlobal()?.t?.(fullKey)`（roomPreviewText.ts 的真实写法，只查 (1) 会漏掉
 *     整个 `room_preview.*` 族）。
 *
 * 这一节的判据**刻意保持原样**（在原始文本上匹配），以保证动态族基线与阻塞 delta 不被动过。
 */
const DYNAMIC_CALL = /\b(?:t|tc|te|tm|\$t|\$tc|\$te|\$tm)\s*(?:\?\.)?\s*\(\s*`([^`]*)`/g
const ASSIGNED_TEMPLATE = /(?:const|let|var)\s+(\w+)\s*=\s*`([^`]*)`/g

/** 前缀至少要是一个 `ns.segment` 形状，否则归类太宽（如 `` t(`${x}`) ``）不参与过滤。 */
function dynamicPrefixOf(inner) {
  if (!inner.includes('${')) return null
  const prefix = inner.slice(0, inner.indexOf('${'))
  return prefix.includes('.') ? prefix : null
}

/** 该标识符是否在本文档里被翻译调用消费（`t(x)` / `t?.(x)` / `tm(x)` …）。 */
function consumedByTranslate(text, ident) {
  return new RegExp(`\\b(?:t|tc|te|tm|\\$t|\\$tc|\\$te|\\$tm)\\s*(?:\\?\\.)?\\s*\\(\\s*${ident}\\b`).test(
    text
  )
}

/** 返回 `{ prefixes, unfilterable }`：动态前缀集合，以及无法安全归类的模板（只计数提示）。 */
function collectDynamicPrefixes(text) {
  const prefixes = new Set()
  const unfilterable = []
  for (const m of text.matchAll(DYNAMIC_CALL)) {
    const prefix = dynamicPrefixOf(m[1])
    if (prefix === null) unfilterable.push(m[1])
    else prefixes.add(prefix)
  }
  // 变量中转的模板：仅当该变量确实被翻译调用消费时才计入，避免把普通字符串拼接误判成 key
  for (const m of text.matchAll(ASSIGNED_TEMPLATE)) {
    const prefix = dynamicPrefixOf(m[2])
    if (prefix !== null && consumedByTranslate(text, m[1])) prefixes.add(prefix)
  }
  return { prefixes, unfilterable }
}

/** 读取 JSON 文件；缺失返回 null，损坏返回 'invalid'。 */
function readJson(file) {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return 'invalid'
  }
}

// 1. 收集 zh-CN 全部 key（去重）。
// 命名空间约定：`locales/{lang}/{ns}.json` 的文件名即顶层命名空间，源码引用必须带它
// （`setting.json` 的 `{ encryption: { title } }` → `setting.encryption.title`）。
const baseFiles = fs.readdirSync(path.join(localesDir, baseLocale)).filter((f) => f.endsWith('.json'))
const allKeys = new Set()
for (const file of baseFiles) {
  const namespace = file.slice(0, -'.json'.length)
  const content = JSON.parse(fs.readFileSync(path.join(localesDir, baseLocale, file), 'utf-8'))
  for (const key of getKeys(content)) allKeys.add(`${namespace}.${key}`)
}

// 2. 读全部生产源码，提取"翻译引用位置"上的字面量 key 与动态前缀
const referenced = new Set()
const dynamicPrefixes = new Map()
const unfilterableTemplates = []
for (const filePath of walk(srcDir)) {
  const text = fs.readFileSync(filePath, 'utf8')
  const relPath = path.relative(root, filePath)
  const add = (key) => referenced.add(key)
  if (filePath.endsWith('.vue')) collectVueReferences(text, add)
  else collectScriptReferences(text, scriptKindFor(filePath), add)
  const { prefixes, unfilterable } = collectDynamicPrefixes(text)
  for (const prefix of prefixes) {
    if (!dynamicPrefixes.has(prefix)) dynamicPrefixes.set(prefix, new Set())
    dynamicPrefixes.get(prefix).add(relPath)
  }
  for (const inner of unfilterable) unfilterableTemplates.push(`${relPath} ← t(\`${inner}\`)`)
}
const dynamicPrefixList = [...dynamicPrefixes.keys()].sort((a, b) => a.localeCompare(b))

// 3. 找 0 字面引用的 key；数字下标段（如 privacy.sections.0.title）是数组动态访问，跳过
const isArrayKey = (key) => key.split('.').some((seg) => /^\d+$/.test(seg))
const unreferenced = [...allKeys].filter((key) => !referenced.has(key))
const candidates = unreferenced.filter((key) => !isArrayKey(key))
// 动态族：命中任一"第一个插值之前的字面前缀"即排除，两个集合分开记账、分开排序
const dynamicKeys = candidates
  .filter((key) => dynamicPrefixList.some((prefix) => key.startsWith(prefix)))
  .sort((a, b) => a.localeCompare(b))
const deadKeys = candidates
  .filter((key) => !dynamicPrefixList.some((prefix) => key.startsWith(prefix)))
  .sort((a, b) => a.localeCompare(b))

// --- --list：只报告 ---
if (process.argv.includes('--list')) {
  const limitIndex = process.argv.indexOf('--limit')
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) || 500 : 500
  console.log(`i18n 孤儿 key（${baseLocale}，共 ${allKeys.size} key）: ${deadKeys.length}`)
  for (const key of deadKeys.slice(0, limit)) console.log(key)
  if (deadKeys.length > limit) console.log(`... 其余 ${deadKeys.length - limit} 个省略（用 --limit 调整）`)
  console.log('')
  console.log(
    `--- 动态族排除（不是孤儿，不得当可删文案）: ${dynamicKeys.length} 个 key / ` +
      `${dynamicPrefixList.length} 个源码前缀 ---`
  )
  for (const prefix of dynamicPrefixList) {
    const files = [...dynamicPrefixes.get(prefix)].join(',')
    console.log(`  ${prefix}*  (${files})`)
  }
  for (const key of dynamicKeys) console.log(`  ${key}`)
  if (unfilterableTemplates.length > 0) {
    console.log(`--- 无法归类为前缀的动态模板 ${unfilterableTemplates.length} 处（不计入、不判定）`)
    for (const item of unfilterableTemplates) console.log(`  ? ${item}`)
  }
  process.exit(0)
}

/** 只比数量会漏掉「删一个又加一个」的等价替换：当前集合必须 ⊆ 基线集合。 */
const notIn = (names, baselineNames) => names.filter((name) => !baselineNames.has(name))

if (process.argv.includes('--update')) {
  const previous = readJson(BASELINE)
  const usable = previous && previous !== 'invalid'
  // ratchet 只允许收紧
  if (usable && typeof previous.deadKeys === 'number' && deadKeys.length > previous.deadKeys) {
    console.error(`check-i18n-dead-keys: 拒绝抬高基线 — 本次 ${deadKeys.length} > 现有 ${previous.deadKeys}`)
    console.error('ratchet 只允许收紧：新增孤儿文案要么删掉，要么先接线。')
    process.exit(1)
  }
  // --update 也拒绝任何新增键名（同数量换键同样不放行）
  if (usable && Array.isArray(previous.deadKeyNames)) {
    const added = notIn(deadKeys, new Set(previous.deadKeyNames))
    if (added.length > 0) {
      console.error(`check-i18n-dead-keys: 拒绝新增孤儿 key ${added.length} 个 — --update 不允许引入基线里没有的 key`)
      for (const key of added.slice(0, 50)) console.error(`  ${key}`)
      if (added.length > 50) console.error(`  ... 其余 ${added.length - 50} 个省略`)
      process.exit(1)
    }
  }
  // 动态族是 warn-only 的逃生口：新增一个动态前缀/动态 key 会让孤儿"凭空减少"。
  // --update 不得静默吸收：新增动态 key 必须显式带 --accept-new-dynamic 才能记账。
  const newDynamicForUpdate = usable && Array.isArray(previous.dynamicKeyNames)
    ? notIn(dynamicKeys, new Set(previous.dynamicKeyNames))
    : []
  if (newDynamicForUpdate.length > 0 && !process.argv.includes('--accept-new-dynamic')) {
    console.error(
      `check-i18n-dead-keys: 拒绝 --update 静默吸收动态族新增 ${newDynamicForUpdate.length} 个 key`
    )
    for (const key of newDynamicForUpdate.slice(0, 50)) console.error(`  ${key}`)
    if (newDynamicForUpdate.length > 50) console.error(`  ... 其余 ${newDynamicForUpdate.length - 50} 个省略`)
    console.error('动态前缀会把这些 key 从可删孤儿里"洗掉"。确认它们确为动态可达后，')
    console.error('用 node scripts/check-i18n-dead-keys.mjs --update --accept-new-dynamic 显式记账。')
    process.exit(1)
  }
  fs.writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        deadKeys: deadKeys.length,
        deadKeyNames: deadKeys,
        dynamicKeys: dynamicKeys.length,
        dynamicKeyNames: dynamicKeys,
        dynamicPrefixes: dynamicPrefixList
      },
      null,
      2
    )}\n`
  )
  console.log(
    `check-i18n-dead-keys: 基线已更新为 孤儿 ${deadKeys.length} / 动态族 ${dynamicKeys.length}（前缀 ${dynamicPrefixList.length}）`
  )
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.error(`check-i18n-dead-keys: FAIL — 基线文件缺失：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

const baseline = readJson(BASELINE)
if (baseline === 'invalid') {
  console.error(`check-i18n-dead-keys: FAIL — 基线文件无法解析：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}
if (typeof baseline?.deadKeys !== 'number' || !Number.isFinite(baseline.deadKeys)) {
  console.error(`check-i18n-dead-keys: FAIL — 基线文件缺少数值型 deadKeys：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}
if (!Array.isArray(baseline.deadKeyNames)) {
  console.error(`check-i18n-dead-keys: FAIL — 基线文件缺少数组型 deadKeyNames：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}
if (!Array.isArray(baseline.dynamicKeyNames)) {
  console.error(`check-i18n-dead-keys: FAIL — 基线文件缺少数组型 dynamicKeyNames：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (deadKeys.length > baseline.deadKeys) {
  console.error(`check-i18n-dead-keys: FAIL — 孤儿 key ${deadKeys.length} > 基线 ${baseline.deadKeys}`)
  for (const key of notIn(deadKeys, new Set(baseline.deadKeyNames))) console.error(`  ${key}`)
  console.error('新增文案必须在源码里有真实引用，或先从 locale 删除。')
  process.exit(1)
}

const unexpected = notIn(deadKeys, new Set(baseline.deadKeyNames))
if (unexpected.length > 0) {
  console.error(`check-i18n-dead-keys: FAIL — 出现基线未记录的孤儿 key ${unexpected.length} 个（换名绕过数量 ratchet）`)
  for (const key of unexpected) console.error(`  ${key}`)
  console.error('删一个又加一个等价的孤儿文案同样不允许：先接线，或说明理由后更新基线。')
  process.exit(1)
}

// 动态族是阻塞 ratchet：命中动态前缀的 key 不计入孤儿，所以"新增动态族成员"会让可删孤儿
// 凭空减少（等价于洗绿）。新增动态 key 必须显式记账，不能靠 warn 悄悄过去。
const newDynamic = notIn(dynamicKeys, new Set(baseline.dynamicKeyNames))
if (newDynamic.length > 0) {
  console.error(
    `check-i18n-dead-keys: FAIL — 动态族新增 ${newDynamic.length} 个 key（会把它们从孤儿集合里洗掉）`
  )
  for (const key of newDynamic.slice(0, 50)) console.error(`  ${key}`)
  if (newDynamic.length > 50) console.error(`  ... 其余 ${newDynamic.length - 50} 个省略`)
  console.error('确认这些 key 确实被动态前缀可达后，运行：')
  console.error('  node scripts/check-i18n-dead-keys.mjs --update --accept-new-dynamic')
  process.exit(1)
}

console.log(
  `check-i18n-dead-keys: OK 孤儿 key ${deadKeys.length}（基线 ${baseline.deadKeys}，键名均在基线内）；` +
    `动态族排除 ${dynamicKeys.length} 个 key / ${dynamicPrefixList.length} 个前缀（基线 ${baseline.dynamicKeys ?? '?'}；不得删除）`
)
if (unfilterableTemplates.length > 0) {
  console.log(`  提示：${unfilterableTemplates.length} 处动态模板无法归类为前缀（已知局限，见脚本注释）`)
}
if (deadKeys.length < baseline.deadKeys) {
  console.log('  可运行 node scripts/check-i18n-dead-keys.mjs --update 收紧基线（逐批清理）')
}
