#!/usr/bin/env node
/**
 * Ratchet：组件事件契约——声明了却没有任何使用处监听的事件。
 *
 * 为什么需要：`InvitePermissionPanel` 曾长期"绿着不生效"——它在 `SecuritySettings.vue`
 * 里被 `<InvitePermissionPanel />` 挂载，既不传 props 也不接事件；而测试只断言
 * `wrapper.emitted('mode-change')` 为真，从不检查有没有人监听。于是"事件确实抛了"
 * 和"界面真的动了"被混为一谈。本守门把"组件被使用、但它声明的某个事件在所有使用处
 * 都没有绑定"记成一条，数量只减不增。
 *
 * 判据（全部基于 SFC 解析，**不做字符串包含匹配**——审计脚本第一版用子串匹配，
 * `SpaceTree` 被 `SkeletonSpaceTree` 命中，产生大量误报）：
 * 1. 用 `vue/compiler-sfc` 的 `parse()` 解析每个 `.vue`，`compileScript()` 得到编译器
 *    自己归一化后的 `emits` 数组（兼容 `defineEmits<{...}>()` 类型写法、
 *    `defineEmits([...])` 数组写法，以及普通 `<script>` 的 `emits` 选项）；
 * 2. 用模板 AST 找出该组件的所有使用处，解析实际绑定的 `@event` / `v-on:event`
 *    与 `v-model[:arg]`（后者会生成 `update:modelValue` / `update:arg`）；
 * 3. 组件被使用、但某个事件在所有使用处都没绑定 → 记一条；
 * 4. 事件名按 Vue 运行时的连字符/驼峰双查找规则归一（`mode-change` 与 `@modeChange` 等价）。
 *
 * 刻意保守、不猜：
 * - `v-on="obj"` / `v-bind="obj"`（无参数的对象展开）可能绑定任意事件，遇到就把该组件
 *   标为"不可判定"并整体跳过，不把可能的活事件报成死的；
 * - 动态参数 `@[name]` / `v-model:[name]` / `v-bind:[name]`（arg 非静态）的文本不是事件名，
 *   同样按不可判定整体跳过；
 * - `<component :is>` 动态挂载的组件当前不识别，按"从未使用"处理（见已知局限），不计入；
 * - `emits` 无法解析（编译或 babel 解析失败）时跳过该文件，并在输出里点名；
 * - `__tests__` 目录下的文件既不算声明方也不算使用方（测试自己 emit/监听不代表真实接线）；
 * - 从未被使用的组件不计入（那是死代码问题，不是"没人监听"问题）。
 *
 * 基线缺失或结构不合法时直接失败，绝不静默退化为 exit 0 空转。
 * 数量只能减少：`--update` 收紧基线，增加即失败；"可接受"的个案写进 `ACCEPTED_PATTERNS`
 * 并注明理由，而不是留在基线里。
 *
 * 已知局限（见报告）：不分析渲染函数 / `h()` / JSX 里手写的 `onXxx` 监听，也不跨文件
 * 追踪 `v-bind` 透传；这些场景由上面的"跳过"策略兜底，属于漏报而非误报。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { babelParse, compileScript, parse } from 'vue/compiler-sfc'

const ROOT = 'src'
const BASELINE = 'scripts/component-contracts-baseline.json'
const REGENERATE_HINT = '  运行 node scripts/check-component-contracts.mjs --update 重建基线。'

/**
 * 白名单：判据判它"没人监听"，但这是可接受的模式。
 *
 * 只放**确实不该删**的个案，并写明理由；能在同一任务里删掉的死事件请直接删，
 * 不要塞进来。以下每一条都核对过：组件自己完成了用户可见的动作（或只是生命周期
 * 通知），事件是对外可选的延伸点，删掉可惜、留着也无害。
 */
const ACCEPTED_PATTERNS = [
  {
    component: 'src/components/atomic/InlineEdit.vue',
    event: 'cancel',
    reason: 'cancelEdit 已自行复位 editing/draft 本地状态，事件只是"已取消"的可选通知'
  },
  {
    component: 'src/components/moderation/EventReportDialog.vue',
    event: 'reported',
    reason: '举报已由 matrixEventReportService.createReport 发出并自行关闭，事件是可选通知'
  },
  {
    component: 'src/components/rightBox/chatBox/ChatSidebar.vue',
    event: 'ready',
    reason: '生命周期通知（侧栏挂载完成），组件不依赖任何监听方即可工作'
  },
  {
    component: 'src/components/search/SearchPane.vue',
    event: 'select',
    reason: '点击项已由组件自己 router.push 完成跳转，事件只是给可选外部钩子用'
  },
  {
    component: 'src/components/space/SpaceCreateRoomPane.vue',
    event: 'created',
    reason: '房间已创建并由组件自己 openMsgSessionByRoomId 跳转，事件只是可选通知'
  },
  {
    component: 'src/components/userMenu/UserMenuDropdown.vue',
    event: 'theme-toggle',
    reason: '主题已由 UserMenuHeader 里的 settingStore.toggleTheme 应用，这里只是透传通知'
  },
  {
    component: 'src/mobile/components/ImagePreview.vue',
    event: 'forward',
    reason: '转发通过 useMitt MSG_MULTI_CHOOSE 打开，组件内 emit 只是可选通知'
  },
  {
    component: 'src/mobile/components/ImagePreview.vue',
    event: 'save',
    reason: 'handleSave 已完整下载并写入 fileStore，事件只是"已保存"的可选通知'
  },
  {
    component: 'src/mobile/components/ImagePreview.vue',
    event: 'more',
    reason: '"更多"当前是未实现的占位入口，事件是预留的扩展点'
  },
  {
    component: 'src/mobile/views/chat-room/LocationShare.vue',
    event: 'sent',
    reason: '位置已由 matrixLocationService.sendLocation 发出并给出成功反馈，事件是可选通知'
  },
  {
    component: 'src/mobile/views/chat-room/MobileForwardDialog.vue',
    event: 'forwarded',
    reason: '转发已由 flow.forward/forwardMultiple 完成并自行关闭，事件是可选通知'
  },
  {
    component: 'src/mobile/components/chat-room/FooterBar.vue',
    event: 'updateHeight',
    reason: 'ResizeObserver 的纯尺寸测量通知，父组件不消费也不影响功能'
  }
]

/** Vue 运行时的双查找规则：`mode-change` / `modeChange` / `mode:change` 归一。 */
const canonicalEvent = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase())

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** `area-drawer` → `AreaDrawer`：把 kebab 标签归一成组件 basename（调用方只对带 `-` 的标签用它）。 */
const pascalize = (name) => {
  const camel = canonicalEvent(name)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

const isTestPath = (path) => path.includes('__tests__') || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)

/** 收集仓库内所有 `.vue`，测试目录排除在外。 */
function collectVueFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectVueFiles(full))
    else if (extname(entry) === '.vue' && !isTestPath(full)) out.push(full)
  }
  return out
}

/** 深度优先遍历 babel AST，对每个节点调用 visit。 */
function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit)
    return
  }
  if (typeof node.type === 'string') visit(node)
  for (const key of Object.keys(node)) {
    const value = node[key]
    if (value && typeof value === 'object') walk(value, visit)
  }
}

/**
 * 解析 babel 源码（编译产物或原始 script）。
 *
 * `typescript` + `jsx` 同时开启对 `<T>` 断言有歧义，因此先按纯 TS 解析，
 * 失败再补 `jsx`；两次都失败返回 null，调用方跳过，不猜。
 */
function parseScript(content) {
  for (const plugins of [['typescript'], ['typescript', 'jsx']]) {
    try {
      return babelParse(content, { sourceType: 'module', plugins })
    } catch {
      // 尝试下一种插件组合
    }
  }
  return null
}

/**
 * 求值 `emits` 表达式，非字面量返回 null（无法判定）。
 *
 * `compileScript` 在有 `defineModel()` 时会把显式 emits 与模型事件合并成
 * `_mergeModels(["refresh"], ["update:modelValue"])`，必须展开两个参数，
 * 否则会**静默漏掉**这些组件声明的事件。
 */
function readEmitsValue(value) {
  if (value?.type === 'ArrayExpression') {
    const names = []
    for (const element of value.elements) {
      if (element?.type !== 'StringLiteral') return null
      names.push(element.value)
    }
    return names
  }
  if (value?.type === 'ObjectExpression') {
    const names = []
    for (const prop of value.properties) {
      const key = prop.key?.name ?? prop.key?.value
      if (typeof key !== 'string') return null
      names.push(key)
    }
    return names
  }
  if (value?.type === 'CallExpression' && (value.callee?.name === '_mergeModels' || value.callee?.name === 'mergeModels')) {
    const names = []
    for (const arg of value.arguments) {
      const part = readEmitsValue(arg)
      if (part === null) return null
      names.push(...part)
    }
    return names
  }
  return null
}

/** 在组件选项对象里找 `emits` 表达式，找不到返回 undefined。 */
function findEmitsValue(objectExpression) {
  for (const prop of objectExpression?.properties ?? []) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue
    const key = prop.key?.name ?? prop.key?.value
    if (key === 'emits') return prop.value
  }
  return undefined
}

/**
 * 从 `<script setup>` / `<script>` 提取声明的事件名。
 *
 * 走 `compileScript()`：它会把 `defineEmits<{...}>()` 的类型写法编译成等价的
 * `emits: [...]` 字面量，省得自己解析 TS 类型引用。返回 `{ emits, reason }`，
 * `emits === null` 表示无法解析（调用方跳过并记名）。
 */
function extractEmits(descriptor, path) {
  if (!descriptor.scriptSetup && !descriptor.script) return { emits: [] }
  let compiled
  try {
    compiled = compileScript(descriptor, { id: path })
  } catch (error) {
    return { emits: null, reason: `compileScript 失败：${error.message}` }
  }
  const ast = parseScript(compiled.content)
  if (!ast) return { emits: null, reason: '编译产物无法用 babel 解析' }

  // 优先在 `_defineComponent({...})` / `defineComponent({...})` 的选项对象里找，
  // 避免命中 setup 内部同名的普通对象属性；找不到再退回全量搜索。
  const candidates = []
  walk(ast.program, (node) => {
    if (node.type !== 'CallExpression') return
    const callee = node.callee?.name
    if (callee !== '_defineComponent' && callee !== 'defineComponent') return
    if (node.arguments[0]?.type !== 'ObjectExpression') return
    const value = findEmitsValue(node.arguments[0])
    if (value !== undefined) candidates.push(value)
  })
  if (candidates.length === 0) {
    walk(ast.program, (node) => {
      if (node.type !== 'ObjectProperty' || node.computed) return
      const key = node.key?.name ?? node.key?.value
      if (key === 'emits') candidates.push(node.value)
    })
  }

  if (candidates.length > 0) {
    const names = readEmitsValue(candidates[0])
    if (names === null) return { emits: null, reason: 'emits 表达式的形态无法静态求值' }
    // `_mergeModels` 的两个参数可能重叠（defineEmits 与 defineModel 都声明同一事件）
    return { emits: [...new Set(names)] }
  }

  // 产物里没有 emits，但源码确实声明过 → 说明提取逻辑漏了这个形态，
  // 宁可显式跳过并记名，也不当成"没有事件"静默放过。
  const raw = `${descriptor.scriptSetup?.content ?? ''}\n${descriptor.script?.content ?? ''}`
  if (/\bdefineEmits\b|\bdefineModel\b|\bemits\s*:/.test(raw)) {
    return { emits: null, reason: '源码声明了 emits/defineModel 但产物里没有可求值的 emits' }
  }
  return { emits: [] }
}

/** 把模板里的 `<Tag ...>`（含 kebab）映射到组件文件。 */
function buildTagMap(descriptor, path) {
  const map = new Map()
  for (const block of [descriptor.scriptSetup, descriptor.script]) {
    if (!block) continue
    const ast = parseScript(block.content)
    if (!ast) continue
    for (const node of ast.program.body) {
      if (node.type !== 'ImportDeclaration' || typeof node.source.value !== 'string') continue
      const source = node.source.value
      if (!source.endsWith('.vue')) continue
      const resolved = resolveImport(source, path)
      for (const specifier of node.specifiers) {
        const local = specifier.local?.name
        if (typeof local !== 'string') continue
        map.set(local, resolved)
        map.set(kebab(local), resolved)
      }
    }
    // `const X = defineAsyncComponent(() => import('./X.vue'))` 这类异步组件没有
    // ImportDeclaration；不解析它会把"绑定在异步组件上的监听"误判成没人监听。
    for (const node of ast.program.body) {
      if (node.type !== 'VariableDeclaration') continue
      for (const declarator of node.declarations) {
        const local = declarator.id?.name
        if (typeof local !== 'string' || !declarator.init) continue
        const imported = collectVueImports(declarator.init, path)
        if (imported.length !== 1) continue // 多个或零个：无法判定，不映射
        map.set(local, imported[0])
        map.set(kebab(local), imported[0])
      }
    }
  }
  return map
}

/** 收集子树里所有 `import('...vue')` 的动态导入路径，去重后返回。 */
function collectVueImports(node, fromPath) {
  const found = new Set()
  walk(node, (candidate) => {
    const literal =
      candidate.type === 'ImportExpression'
        ? candidate.source
        : candidate.type === 'CallExpression' && candidate.callee?.type === 'Import'
          ? candidate.arguments[0]
          : undefined
    if (literal?.type === 'StringLiteral' && literal.value.endsWith('.vue')) {
      found.add(resolveImport(literal.value, fromPath))
    }
  })
  return [...found]
}

/** `@/x` → `src/x`，`#/x` → `src/mobile/x`，`./`、`../` 相对当前文件。 */
function resolveImport(specifier, fromPath) {
  if (specifier.startsWith('@/')) return join(ROOT, specifier.slice(2))
  if (specifier.startsWith('#/')) return join(ROOT, 'mobile', specifier.slice(2))
  if (specifier.startsWith('~/')) return specifier.slice(2)
  return relative(process.cwd(), resolve(dirname(fromPath), specifier))
}

/**
 * 扫描一个模板，收集每个组件使用处绑定的事件。
 *
 * 返回 `{ usages: Map<path, Set<event>>, opaque: Set<path> }`；`opaque` 里的组件
 * 存在无法静态判定的绑定（对象展开、动态参数），整体视为不可判定。
 */
function scanTemplate(tagMap, templateAst, componentPaths) {
  const usages = new Map()
  const opaque = new Set()
  if (!templateAst) return { usages, opaque }

  const visit = (node) => {
    if (node.type !== 1 /* ELEMENT */) return
    const tag = node.tag
    // 全局注册的标签既可能写成 `<AreaDrawer>` 也可能写成 `<area-drawer>`（mobile 侧
    // 大量使用 kebab）。只有带 `-` 的标签才做 kebab→Pascal 归一：原生标签（`<button>`、
    // `<video>`、SVG `<text>` 等）都是无短横的单词，若一并 pascalize 会被错认成
    // `Button.vue`/`Video.vue`/`Text.vue` 这类同名组件 → 张冠李戴的误报。
    const target =
      tagMap.get(tag) ?? componentPaths.get(tag) ?? (tag.includes('-') ? componentPaths.get(pascalize(tag)) : undefined)
    if (target === undefined) return
    if (!usages.has(target)) usages.set(target, new Set())
    for (const prop of node.props) {
      if (prop.type !== 7 /* DIRECTIVE */) continue
      // 动态参数（`@[name]` / `v-model:[name]` / `v-bind:[name]`）的 arg 是表达式而非字面量，
      // 其文本不是事件名。当成事件名会漏掉真实绑定（误报），因此整体标不可判定。
      if (prop.arg && !(prop.arg.type === 4 /* SIMPLE_EXPRESSION */ && prop.arg.isStatic)) {
        opaque.add(target)
        continue
      }
      if (prop.name === 'on') {
        if (prop.arg) usages.get(target).add(canonicalEvent(String(prop.arg.content)))
        else opaque.add(target) // `v-on="obj"`：可能绑定任意事件
      } else if (prop.name === 'model') {
        usages.get(target).add(canonicalEvent(`update:${prop.arg ? String(prop.arg.content) : 'modelValue'}`))
      } else if (prop.name === 'bind' && !prop.arg) {
        opaque.add(target) // `v-bind="obj"`：可能包含 onXxx 监听
      }
    }
  }

  const stack = [templateAst]
  while (stack.length > 0) {
    const node = stack.pop()
    visit(node)
    for (const child of node.children ?? []) stack.push(child)
    for (const branch of node.branches ?? []) stack.push(branch)
  }
  return { usages, opaque }
}

const files = collectVueFiles(ROOT)

// 组件名 → 文件路径，用于识别全局注册（unplugin-vue-components）的标签。
// 查找时对带 `-` 的标签再按 kebab→Pascal 归一（见 scanTemplate），因此这里保持
// 只登记 basename，避免把 `button`/`video` 这类原生标签的别名也塞进来。
const componentPaths = new Map()
const basenameCounts = new Map()
for (const path of files) {
  const name = path.slice(path.lastIndexOf('/') + 1, -'.vue'.length)
  basenameCounts.set(name, (basenameCounts.get(name) ?? 0) + 1)
  componentPaths.set(name, path)
}
// 同名组件（不同目录）无法凭标签判定归属，直接移除，避免张冠李戴
for (const [name, count] of basenameCounts) {
  if (count > 1) componentPaths.delete(name)
}

const declared = new Map()
const skipped = []

for (const path of files) {
  let descriptor
  try {
    descriptor = parse(readFileSync(path, 'utf8'), { filename: path }).descriptor
  } catch (error) {
    skipped.push(`${path}（SFC 解析失败：${error.message}）`)
    continue
  }
  const { emits, reason } = extractEmits(descriptor, path)
  if (emits === null) {
    skipped.push(`${path}（${reason}）`)
    continue
  }
  if (emits.length > 0) declared.set(path, emits)
}

// 反向建表：使用方模板 → 它用到了哪些组件
const usageByComponent = new Map()
for (const path of files) {
  let descriptor
  try {
    descriptor = parse(readFileSync(path, 'utf8'), { filename: path }).descriptor
  } catch {
    continue
  }
  const tagMap = buildTagMap(descriptor, path)
  const { usages, opaque } = scanTemplate(tagMap, descriptor.template?.ast, componentPaths)
  for (const [target, events] of usages) {
    if (target === path) continue
    if (!usageByComponent.has(target)) usageByComponent.set(target, { events: new Set(), opaque: false })
    const entry = usageByComponent.get(target)
    for (const event of events) entry.events.add(event)
    if (opaque.has(target)) entry.opaque = true
  }
}

const accepted = new Set(ACCEPTED_PATTERNS.map((p) => `${p.component}::${p.event}`))
const unlistened = []
for (const [path, emits] of declared) {
  const usage = usageByComponent.get(path)
  if (usage === undefined) continue // 从未被使用：死代码问题，不归本守门
  if (usage.opaque) {
    skipped.push(`${path}（使用处存在 v-on/v-bind 对象展开或动态参数，无法静态判定）`)
    continue
  }
  for (const event of emits) {
    if (usage.events.has(canonicalEvent(event))) continue
    if (accepted.has(`${path}::${event}`)) continue
    unlistened.push({ component: path, event })
  }
}

const sorted = unlistened.sort((a, b) => a.component.localeCompare(b.component) || a.event.localeCompare(b.event))
const entryNames = sorted.map((e) => `${e.component}::${e.event}`)

// 无论 OK / FAIL / --update，都先把不可判定的位置点名，避免"漏报被当成通过"
if (skipped.length > 0) {
  console.log(`check-component-contracts: 跳过 ${skipped.length} 处不可判定（漏报，不误报）`)
  for (const item of skipped) console.log(`  skip ${item}`)
}

if (process.argv.includes('--update')) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ unlistenedEvents: sorted.length, unlistenedEventNames: entryNames }, null, 2)}\n`
  )
  console.log(`check-component-contracts: 基线已更新为 ${sorted.length}`)
  process.exit(0)
}

if (!existsSync(BASELINE)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺失：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

let baseline
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
} catch (error) {
  console.error(`check-component-contracts: FAIL — 基线文件无法解析：${BASELINE}`)
  console.error(`  ${error.message}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (typeof baseline?.unlistenedEvents !== 'number' || !Number.isFinite(baseline.unlistenedEvents)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺少数值型 unlistenedEvents：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (sorted.length > baseline.unlistenedEvents) {
  console.error(`check-component-contracts: FAIL — 无人监听事件 ${sorted.length} > 基线 ${baseline.unlistenedEvents}`)
  for (const entry of sorted) console.error(`  ${entry.event.padEnd(28)} ${entry.component}`)
  console.error('组件事件要么有真实监听方，要么删掉；确属可接受模式请写进 ACCEPTED_PATTERNS 并注明理由。')
  process.exit(1)
}

console.log(`check-component-contracts: OK 无人监听事件 ${sorted.length}（基线 ${baseline.unlistenedEvents}）`)
if (sorted.length < baseline.unlistenedEvents) {
  console.log('  可运行 node scripts/check-component-contracts.mjs --update 收紧基线')
}
