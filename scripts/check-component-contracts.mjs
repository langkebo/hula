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
 * - `<component :is>` 动态挂载不参与"用了组件却没人监听"的判定：它们被单列成
 *   `dynamic` 跳过项并打印（能静态认出的目标会标注组件路径与"仅动态挂载"），
 *   既不制造"用了组件却没人监听"的误报，也不因为归不到监听方而把目标算成未使用；
 * - `emits` 无法解析（编译或 babel 解析失败）时跳过该文件，并在输出里点名；
 * - `__tests__` 目录下的文件既不算声明方也不算使用方（测试自己 emit/监听不代表真实接线）；
 * - 从未被使用的组件不计入（那是死代码问题，不是"没人监听"问题）。
 *
 * 全局自动注册组件（unplugin-vue-components）的名字**不是** basename：`renderMessage/index.vue`
 * 注册成 `<RenderMessage>`。因此组件名→文件映射以插件产物 `src/typings/components.d.ts`
 * （路径派生名）为权威，basename 表只在 d.ts 漂移时兜底；否则 35 个 `index.vue` 会因重名
 * 被整体丢弃，`<RenderMessage>` 上的真实监听无从归属，产生"无人监听"误报。
 *
 * d.ts 新鲜度/有效性校验（阻塞，先于任何扫描）：文件缺失、解析不出 `GlobalComponents`
 * 条目、或存在已登记的全局组件文件没有出现在 d.ts 里时，直接给出明确指引并失败，
 * 而不是带着残缺映射继续扫描、把全局组件误判成"无人监听"制造大面积假 FAIL。
 * d.ts 里指向已删除文件的陈旧条目只告警（不影响判定，清理是显式维护动作）。
 *
 * 基线缺失或结构不合法时直接失败，绝不静默退化为 exit 0 空转。
 * 数量与键名双重 ratchet：当前集合必须 ⊆ 基线集合，`--update` 也拒绝任何新增条目
 * （同数量换条目同样不放行）；"新增不可判定位置"（解析失败 / 对象展开 / 动态参数）会让
 * 计数凭空下降，基线用 `skippedLocations` 冻结，新增同样 FAIL。
 * "可接受"的个案写进 `ACCEPTED_PATTERNS` 并注明理由，而不是留在基线里；白名单条目一旦
 * 失效（组件删除 / 事件不再声明 / 已不再压制任何事件）直接 FAIL，防止赦免腐化。
 * 白名单名称集合本身也是 ratchet（当前 ⊆ 基线，`--update` 拒绝新增）：否则"破坏监听 +
 * 追加白名单"一步就能洗绿。`followUp` 字段必须指向 §13.6 里真实存在的 follow-up 行。
 *
 * 已知局限（见报告）：不分析渲染函数 / `h()` / JSX 里手写的 `onXxx` 监听，
 * `<component :is>` 动态挂载的监听方不归属（见上方 dynamic 跳过策略），也不跨文件追踪
 * `v-bind` 透传；这些场景由上面的"跳过"策略兜底，属于漏报而非误报。事件判据是"所有使用处
 * 的并集"，无法表达"某处监听、另一处断线"，这类逐使用处缺口需要人工评审（例如历史窗口里
 * reply 气泡点击无响应）。
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { babelParse, compileScript, parse } from 'vue/compiler-sfc'

const ROOT = 'src'
const BASELINE = 'scripts/component-contracts-baseline.json'
/** unplugin-vue-components 生成的全局组件名 → 文件映射（权威的路径派生名）。 */
const DTS = 'src/typings/components.d.ts'
const REGENERATE_HINT = '  运行 node scripts/check-component-contracts.mjs --update 重建基线。'

/** Windows 反斜杠 → POSIX：路径比较与基线条目都必须用 `/`。 */
const toPosix = (p) => p.split('\\').join('/')

/**
 * 白名单：判据判它"没人监听"，但这是可接受的模式。
 *
 * 只放**确实不该删**的个案，并写明理由；能在同一任务里删掉的死事件请直接删，
 * 不要塞进来。以下每一条都核对过：组件自己完成了用户可见的动作（或只是生命周期
 * 通知），事件是对外可选的延伸点，删掉可惜、留着也无害。
 *
 * 带 `followUp` 的是**已知产品行为断线**：事件所在功能确实缺失，但补全需要产品决策
 * 或跨模块改动，登记进 `docs/mobile-feature-optimization-plan.md` §13 的 follow-up
 * 清单后在此显式挂账。它们不是"可接受"，每次运行都会被点名，避免像旧基线那样静默冻结。
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
  },
  /* --- 设计上可选：组件自身已完成用户可见动作，事件只是对外延伸点 --- */
  {
    component: 'src/components/common/AreaDrawer.vue',
    event: 'update:value',
    reason:
      '选择结果由 @confirm 回传（EditProfile.vue:113-116 的 onConfirm）；直接 v-model:value 会把 Vant area code 写进 region（存的是拼接名称），不绑定才是正确形态'
  },
  {
    component: 'src/components/settings/ThemeSwitcher.vue',
    event: 'update:modelValue',
    reason: '主题已由组件内 settingStore.toggleTheme + showFeedback 应用，事件只是可选双向绑定延伸点（ThemeSwitcher.test.ts 断言了该 emit）'
  },
  {
    component: 'src/components/rightBox/MsgInput.vue',
    event: 'input',
    reason: 'handleInternalInput 已处理输入并自行启停 typing 指示，事件是可选外发钩子（与 InlineEdit::cancel 同类）'
  },
  {
    component: 'src/mobile/components/virtual-scroll/SmartVirtualList.vue',
    event: 'loadMore',
    reason: '通用列表分页扩展点；现有 3 个父组件的数据源一次性给全，不消费该事件（组件内也没有 hasMore 守卫）'
  },
  {
    component: 'src/mobile/views/chat-room/MobileRoomUpgradeDialog.vue',
    event: 'upgraded',
    reason: '升级请求、成功提示与自关闭都由组件内 useRoomUpgradeFlow 完成，事件只是可选通知（父组件会保留旧版本号标签）'
  },
  /* --- 产品行为断线：功能真缺，登记为 follow-up 待办，不允许静默冻结 --- */
  {
    component: 'src/components/userMenu/UserMenuHeader.vue',
    event: 'avatar-click',
    reason: '头像有 cursor:pointer 但点击无任何行为，需要产品决定打开资料/设置/仅关闭',
    followUp: 'docs/mobile-feature-optimization-plan.md §13 follow-up #2'
  },
  {
    component: 'src/components/room/RoomInviteActions.vue',
    event: 'error',
    reason: '接受/拒绝失败只有 logger.error，用户无感知；成功链路 onAcceptInvite/onRejectInvite 生产上也没人传',
    followUp: 'docs/mobile-feature-optimization-plan.md §13 follow-up #3'
  },
  {
    component: 'src/views/loginWindow/LoginBottomBar.vue',
    event: 'guest-login',
    reason: '登录页"更多选项"里的游客登录可见但无监听，且 i18n key login.guest 缺失（渲染原始 key）',
    followUp: 'docs/mobile-feature-optimization-plan.md §13 follow-up #5'
  },
  {
    component: 'src/components/thread/ThreadPanel.vue',
    event: 'sendReply',
    reason: '发送会丢弃输入（无 store/service 调用），loadThreadReplies 是设空数组的 stub',
    followUp: 'docs/mobile-feature-optimization-plan.md §13 follow-up #6'
  }
]

/** Vue 运行时的双查找规则：`mode-change` / `modeChange` / `mode:change` 归一。 */
const canonicalEvent = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase())

/** 白名单名称集合（`component::event`）。它是**只减不增**的 ratchet 对象，见基线校验。 */
const acceptedPatternNames = ACCEPTED_PATTERNS.map((p) => `${p.component}::${p.event}`)
const acceptedNameSet = new Set(acceptedPatternNames)

/** 产品行为断线的登记文档：`followUp` 必须指向其中真实存在的 §13.6 行。 */
const FOLLOW_UP_DOC = 'docs/mobile-feature-optimization-plan.md'

/**
 * 校验 `ACCEPTED_PATTERNS` 里的 `followUp` 字段指向真实存在的 §13 follow-up 行。
 *
 * 为什么必须校验：`followUp` 是"这条断线挂在 §13 里待补"的承诺。文档改版/删行后，
 * 一个只在注释里出现的字符串会继续打印 todo，指向一个不存在的待办——挂账变成假象。
 * 这里解析 §13.6 表格首列的编号，要求 `followUp` 里的 `#N` 命中其中一行。
 */
function validateFollowUps() {
  const errors = []
  const withFollowUp = ACCEPTED_PATTERNS.filter((p) => p.followUp)
  if (withFollowUp.length === 0) return errors
  if (!existsSync(FOLLOW_UP_DOC)) {
    errors.push(`${FOLLOW_UP_DOC} 不存在，无法校验 ${withFollowUp.length} 条 followUp`)
    return errors
  }
  const text = readFileSync(FOLLOW_UP_DOC, 'utf8')
  const start = text.indexOf('### 13.6')
  const end = start < 0 ? -1 : text.indexOf('\n### ', start + 1)
  const section = start < 0 ? '' : text.slice(start, end < 0 ? undefined : end)
  const rows = new Set()
  for (const m of section.matchAll(/^\|\s*(\d+)\s*\|/gm)) rows.add(Number(m[1]))
  const rowList = [...rows].sort((a, b) => a - b)
  for (const pattern of withFollowUp) {
    const name = `${pattern.component}::${pattern.event}`
    const ref = /([^\s]+\.md)\s+§13\s+follow-up\s+#(\d+)/.exec(pattern.followUp)
    if (!ref) {
      errors.push(`${name}：followUp 无法解析（应为 "<doc>.md §13 follow-up #N"）：${pattern.followUp}`)
      continue
    }
    if (!existsSync(ref[1])) errors.push(`${name}：followUp 文档不存在 ${ref[1]}`)
    if (rowList.length === 0) {
      errors.push(`${name}：${FOLLOW_UP_DOC} 里找不到 §13.6 的 follow-up 表格行`)
    } else if (!rows.has(Number(ref[2]))) {
      errors.push(
        `${name}：followUp #${ref[2]} 在 ${FOLLOW_UP_DOC} §13.6 里没有对应行（现有行：${rowList.join(', ')}）`
      )
    }
  }
  return errors
}

const followUpErrors = validateFollowUps()

const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** `area-drawer` → `AreaDrawer`：把 kebab 标签归一成组件 basename（调用方只对带 `-` 的标签用它）。 */
const pascalize = (name) => {
  const camel = canonicalEvent(name)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

const isTestPath = (path) => path.includes('__tests__') || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path)

/** 收集仓库内所有 `.vue`，测试目录排除在外（POSIX 路径）。 */
function collectVueFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = toPosix(join(dir, entry))
    if (statSync(full).isDirectory()) out.push(...collectVueFiles(full))
    else if (extname(entry) === '.vue' && !isTestPath(full)) out.push(full)
  }
  return out
}

/**
 * 读取 unplugin-vue-components 生成的 `src/typings/components.d.ts`，
 * 得到「全局组件名 → 组件文件」的权威映射。
 *
 * 为什么必须读它：全局自动注册的组件名由**路径**派生（`renderMessage/index.vue`
 * → `RenderMessage`），只按 basename 建表时 `index.vue` 会因重名被整体丢弃，
 * 于是 `<RenderMessage>` 上的监听无从归属，`renderMessage/index::jump2Reply`
 * 被误判成无人监听（检测器误报）。d.ts 是插件自己的产物，用它最不容易漂。
 */
function readGlobalComponents(dtsPath) {
  const map = new Map()
  if (!existsSync(dtsPath)) return map
  const text = readFileSync(dtsPath, 'utf8')
  const block = /interface GlobalComponents\s*\{([\s\S]*?)\n\s*\}/.exec(text)
  if (!block) return map
  for (const m of block[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*typeof\s+import\('([^']+\.vue)'\)/g)) {
    map.set(m[1], toPosix(relative(process.cwd(), resolve(dirname(dtsPath), m[2]))))
  }
  return map
}

/**
 * unplugin-vue-components 在当前仓库会全局注册的组件文件。
 *
 * 与 `build/config/components.ts` 的 dirs/globs 保持一致：默认 / 移动端平台扫
 * `src/components` + `src/mobile/components`，并排除 4 个线程视图覆盖组件。
 * 只用于校验 d.ts 覆盖率（新鲜度），不参与名字解析。
 */
const COMPONENT_DIRS = ['src/components', 'src/mobile/components']
const COMPONENT_EXCLUDES = new Set([
  'src/components/thread/ThreadIndicator.vue',
  'src/components/thread/ThreadView.vue',
  'src/mobile/components/thread/ThreadIndicator.vue',
  'src/mobile/components/thread/ThreadView.vue'
])

function expectedGlobalComponents(vueFiles) {
  return new Set(
    vueFiles.filter(
      (path) => COMPONENT_DIRS.some((dir) => path.startsWith(`${dir}/`)) && !COMPONENT_EXCLUDES.has(path)
    )
  )
}

const DTS_HINT = [
  `  ${DTS} 是 unplugin-vue-components 的产物，本守门靠它把路径派生的全局组件名（RenderMessage 等）映射回文件。`,
  '  修复方式：运行一次 vite / vitest 让插件重写该文件（例如 `npx vitest run src/locales`），',
  '  或手动补齐缺失条目；不要继续用 basename 兜底扫描 —— 那会把全局组件误判成"无人监听"，产生大面积假 FAIL。'
]

/**
 * d.ts 新鲜度 / 有效性校验。
 *
 * 返回 `{ globalPaths, problems, warnings }`：`problems` 非空时调用方必须给出明确指引并
 * 退出，**先于**任何"用了组件却没人监听"的扫描 —— 残缺映射下的扫描结果没有意义。
 */
function checkComponentsDts(vueFiles) {
  const problems = []
  const warnings = []
  if (!existsSync(DTS)) {
    problems.push(`缺少 ${DTS}（unplugin-vue-components 的生成物）`)
    return { globalPaths: new Map(), problems, warnings }
  }
  const globalPaths = readGlobalComponents(DTS)
  if (globalPaths.size === 0) {
    problems.push(`${DTS} 里解析不到任何 GlobalComponents 条目（未生成或结构已变）`)
    return { globalPaths, problems, warnings }
  }
  const expected = expectedGlobalComponents(vueFiles)
  const covered = new Set(globalPaths.values())
  const missing = [...expected].filter((path) => !covered.has(path)).sort()
  if (missing.length > 0) {
    const preview = missing.slice(0, 5).join('、')
    problems.push(
      `${DTS} 已陈旧：${missing.length} 个全局组件文件未登记（${preview}${missing.length > 5 ? ' …' : ''}）`
    )
  }
  const dangling = [...covered].filter((path) => !existsSync(path)).sort()
  if (dangling.length > 0) {
    warnings.push(
      `${DTS} 含 ${dangling.length} 个指向已删除文件的陈旧条目（不影响判定，建议重新生成）：${dangling.join('、')}`
    )
  }
  return { globalPaths, problems, warnings }
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

/** `@/x` → `src/x`，`#/x` → `src/mobile/x`，`./`、`../` 相对当前文件（统一 POSIX 分隔符）。 */
function resolveImport(specifier, fromPath) {
  if (specifier.startsWith('@/')) return toPosix(join(ROOT, specifier.slice(2)))
  if (specifier.startsWith('#/')) return toPosix(join(ROOT, 'mobile', specifier.slice(2)))
  if (specifier.startsWith('~/')) return toPosix(specifier.slice(2))
  return toPosix(relative(process.cwd(), resolve(dirname(fromPath), specifier)))
}

/**
 * 扫描一个模板，收集每个组件使用处绑定的事件。
 *
 * 返回 `{ usages: Map<path, Set<event>>, opaque: Set<path> }`；`opaque` 里的组件
 * 存在无法静态判定的绑定（对象展开、动态参数），整体视为不可判定。
 */
function scanTemplate(tagMap, templateAst, componentPaths, globalPaths) {
  const usages = new Map()
  const opaque = new Set()
  const dynamic = []
  if (!templateAst) return { usages, opaque, dynamic }

  const visit = (node) => {
    if (node.type !== 1 /* ELEMENT */) return
    const tag = node.tag

    // `<component :is>` 动态挂载：目标运行时才确定，事件监听方无法静态归属。
    // 单列成 dynamic 跳过项打印，**不**参与"用了组件却没人监听"的判定，避免误报。
    if (tag.toLowerCase() === 'component') {
      const mount = readDynamicMount(node, tagMap, componentPaths, globalPaths)
      if (mount !== null) dynamic.push(mount)
      return
    }

    // 全局注册的标签既可能写成 `<AreaDrawer>` 也可能写成 `<area-drawer>`（mobile 侧
    // 大量使用 kebab）。`globalPaths` 来自 unplugin-vue-components 的 components.d.ts，
    // 是路径派生的权威名字；`componentPaths`（basename）只作 d.ts 漂移时的兜底。
    // 原生标签（`<button>`、`<video>`、SVG `<text>` 等）都是无短横的单词，若一并
    // pascalize 会被错认成 `Button.vue` 这类同名组件 → 张冠李戴的误报。
    const pascal = tag.includes('-') ? pascalize(tag) : undefined
    const target =
      tagMap.get(tag) ??
      globalPaths.get(tag) ??
      (pascal === undefined ? undefined : globalPaths.get(pascal)) ??
      componentPaths.get(tag) ??
      (pascal === undefined ? undefined : componentPaths.get(pascal))
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
  return { usages, opaque, dynamic }
}

/** 读取 `<component>` 上的 `:is` / `v-bind:is` / `is` 表达式；没有 `is` 返回 undefined。 */
function readIsExpression(props) {
  for (const prop of props) {
    if (prop.type === 6 /* ATTRIBUTE */ && prop.name === 'is') {
      return prop.value ? String(prop.value.content) : ''
    }
    if (
      prop.type === 7 /* DIRECTIVE */ &&
      prop.name === 'bind' &&
      prop.arg?.type === 4 &&
      prop.arg.isStatic &&
      prop.arg.content === 'is'
    ) {
      return prop.exp ? String(prop.exp.content) : null
    }
  }
  return undefined
}

/**
 * 尽力识别 `<component :is>` 的目标：`is="Foo"` / `:is="Foo"`（本地导入或全局名）能
 * 静态解析时给出组件路径，`componentMap[...]` / 三元 / 运行时变量等返回 undefined。
 * 识别结果只用于诊断输出，不参与事件判定。
 */
function resolveDynamicMountTarget(expr, tagMap, componentPaths, globalPaths) {
  if (expr === null || expr === undefined) return undefined
  const trimmed = expr.trim()
  const literal = /^'([^']+)'$/.exec(trimmed) ?? /^"([^"]+)"$/.exec(trimmed)
  const name = literal ? literal[1] : /^[A-Za-z_$][\w$]*$/.test(trimmed) ? trimmed : null
  if (name === null) return undefined
  const pascal = name.includes('-') ? pascalize(name) : name
  return (
    tagMap.get(name) ??
    globalPaths.get(name) ??
    globalPaths.get(pascal) ??
    componentPaths.get(name) ??
    componentPaths.get(pascal)
  )
}

/** 组装一条 `<component :is>` 诊断记录（`{ line, expr, target }`），非动态挂载返回 null。 */
function readDynamicMount(node, tagMap, componentPaths, globalPaths) {
  const expr = readIsExpression(node.props)
  if (expr === undefined) return null
  return {
    line: node.loc?.start?.line ?? 0,
    expr: expr === null ? '<无法读取>' : expr,
    target: resolveDynamicMountTarget(expr, tagMap, componentPaths, globalPaths)
  }
}

const files = collectVueFiles(ROOT)

// d.ts 新鲜度 / 有效性校验：先于任何"用了组件却没人监听"的扫描。残缺映射会让全局组件
// 归不到文件、被误判成"无人监听"，那样打印出来的 FAIL 是假失败，必须用明确指引拦截。
const dtsCheck = checkComponentsDts(files)
if (dtsCheck.problems.length > 0) {
  console.error(`check-component-contracts: FAIL — ${DTS} 缺失或陈旧，无法可靠解析全局组件名`)
  for (const problem of dtsCheck.problems) console.error(`  ${problem}`)
  for (const line of DTS_HINT) console.error(line)
  process.exit(1)
}
for (const warning of dtsCheck.warnings) console.log(`check-component-contracts: 提示 ${warning}`)

// 全局组件名 → 文件路径。权威来源是 unplugin-vue-components 生成的 components.d.ts
// （路径派生名，`renderMessage/index.vue` → `RenderMessage`）；basename 表只作兜底。
const globalPaths = dtsCheck.globalPaths

// basename → 文件路径，作为 d.ts 漂移/未生成时的兜底。
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
const dynamicMounts = []
for (const path of files) {
  let descriptor
  try {
    descriptor = parse(readFileSync(path, 'utf8'), { filename: path }).descriptor
  } catch {
    continue
  }
  const tagMap = buildTagMap(descriptor, path)
  const { usages, opaque, dynamic } = scanTemplate(
    tagMap,
    descriptor.template?.ast,
    componentPaths,
    globalPaths
  )
  for (const mount of dynamic) dynamicMounts.push({ path, ...mount })
  for (const [target, events] of usages) {
    if (target === path) continue
    if (!usageByComponent.has(target)) usageByComponent.set(target, { events: new Set(), opaque: false })
    const entry = usageByComponent.get(target)
    for (const event of events) entry.events.add(event)
    if (opaque.has(target)) entry.opaque = true
  }
}

/**
 * `<component :is>` 动态挂载跳过项（**不**进入 `skipped` ratchet）：它们是结构性的
 * 运行时挂载，不是解析退化，冻结计数会把正常重构也拦住。这里只如实点名，让"漏报"
 * 可见：能静态认出的目标标注组件路径，并注明它是否只靠动态挂载出现。
 */
dynamicMounts.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line)
if (dynamicMounts.length > 0) {
  console.log(
    `check-component-contracts: 跳过 ${dynamicMounts.length} 处 <component :is> 动态挂载（监听方无法静态归属，不参与无人监听判定）`
  )
  for (const mount of dynamicMounts) {
    const target = mount.target
      ? `→ ${mount.target}${usageByComponent.has(mount.target) ? '' : '（仅动态挂载）'}`
      : '（未解析）'
    console.log(`  dynamic ${mount.path}:${mount.line} :is="${mount.expr}" ${target}`)
  }
}

/** 声明的却没人监听的事件（**未**过滤 ACCEPTED_PATTERNS），用于白名单活性告警。 */
const rawUnlistened = []
for (const [path, emits] of declared) {
  const usage = usageByComponent.get(path)
  if (usage === undefined) continue // 从未被使用：死代码问题，不归本守门
  if (usage.opaque) {
    skipped.push(`${path}（使用处存在 v-on/v-bind 对象展开或动态参数，无法静态判定）`)
    continue
  }
  for (const event of emits) {
    if (usage.events.has(canonicalEvent(event))) continue
    rawUnlistened.push({ component: path, event })
  }
}

const sorted = rawUnlistened
  .filter((entry) => !acceptedNameSet.has(`${entry.component}::${entry.event}`))
  .sort((a, b) => a.component.localeCompare(b.component) || a.event.localeCompare(b.event))
const entryNames = sorted.map((e) => `${e.component}::${e.event}`)

/**
 * 白名单活性检查（失效即 FAIL）。
 *
 * 白名单一旦失效就变成"永久赦免"：将来同一事件再断线也悄无声息。三种失效形态都点名：
 * 组件文件被删除、组件已不再声明该事件、条目已不再压制任何事件（说明已接线）。
 * 失效条目属于**死配置**，必须删掉；只告警不阻塞等于把"永久赦免"从事件搬到了白名单。
 */
const rawNames = new Set(rawUnlistened.map((e) => `${e.component}::${e.event}`))
const inertAccepted = []
const deferredAccepted = []
for (const pattern of ACCEPTED_PATTERNS) {
  const name = `${pattern.component}::${pattern.event}`
  if (pattern.followUp) deferredAccepted.push(`${name} — ${pattern.followUp}`)
  if (!existsSync(pattern.component)) inertAccepted.push(`${name}（组件文件不存在）`)
  else if (!(declared.get(pattern.component) ?? []).includes(pattern.event)) {
    inertAccepted.push(`${name}（组件已不再声明该事件）`)
  } else if (!rawNames.has(name)) inertAccepted.push(`${name}（已不再压制任何事件，应删除该白名单条目）`)
}
if (inertAccepted.length > 0) {
  console.log(`check-component-contracts: ACCEPTED_PATTERNS 已失效 ${inertAccepted.length} 条（阻塞，须删除条目）`)
  for (const item of inertAccepted) console.log(`  inert ${item}`)
}
// 产品行为断线不允许静默：每次运行都点名，指向 follow-up 文档
if (deferredAccepted.length > 0) {
  console.log(`check-component-contracts: 提示 ${deferredAccepted.length} 条产品行为断线挂账待补（非可接受模式）`)
  for (const item of deferredAccepted) console.log(`  todo ${item}`)
}
if (followUpErrors.length > 0) {
  console.log(`check-component-contracts: followUp 指向无效 ${followUpErrors.length} 条（阻塞）`)
  for (const item of followUpErrors) console.log(`  invalid ${item}`)
}

// 无论 OK / FAIL / --update，都先把不可判定的位置点名，避免"漏报被当成通过"
if (skipped.length > 0) {
  console.log(`check-component-contracts: 跳过 ${skipped.length} 处不可判定（漏报，不误报）`)
  for (const item of skipped) console.log(`  skip ${item}`)
}

/** 读取现有基线；缺失返回 null，损坏返回 'invalid'。 */
function readBaseline() {
  if (!existsSync(BASELINE)) return null
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch {
    return 'invalid'
  }
}

/** 当前集合里基线没有的条目（子集校验共用）。 */
const notInBaseline = (names, baselineNames) => names.filter((name) => !baselineNames.has(name))

if (process.argv.includes('--update')) {
  const previous = readBaseline()
  const usable = previous && previous !== 'invalid'
  // ratchet 只允许收紧：--update 不能把基线抬高
  if (usable && typeof previous.unlistenedEvents === 'number' && sorted.length > previous.unlistenedEvents) {
    console.error(`check-component-contracts: 拒绝抬高基线 — 本次 ${sorted.length} > 现有 ${previous.unlistenedEvents}`)
    for (const entry of sorted) console.error(`  ${entry.event.padEnd(28)} ${entry.component}`)
    console.error('ratchet 只允许收紧：新增断线必须先接线，或写进 ACCEPTED_PATTERNS 说明理由。')
    process.exit(1)
  }
  // --update 必须走与 verify 相同的键名子集校验：同数量换条目同样拒绝
  if (usable && Array.isArray(previous.unlistenedEventNames)) {
    const added = notInBaseline(entryNames, new Set(previous.unlistenedEventNames))
    if (added.length > 0) {
      console.error('check-component-contracts: 拒绝新增条目 — --update 不允许写入基线里没有的无人监听事件')
      for (const name of added) console.error(`  ${name}`)
      console.error('修掉一条又引入一条等价断线同样不允许：先接线，或说明理由并显式更新基线。')
      process.exit(1)
    }
  }
  // 新增"不可判定"会让无人监听计数凭空下降，--update 不能借此收紧基线
  if (usable && Array.isArray(previous.skippedLocations)) {
    const addedSkips = notInBaseline(skipped, new Set(previous.skippedLocations))
    if (addedSkips.length > 0) {
      console.error('check-component-contracts: 拒绝新增不可判定位置 — 请先修好解析/绑定，别用跳过换绿')
      for (const item of addedSkips) console.error(`  ${item}`)
      process.exit(1)
    }
  }
  // 白名单只减不增：把断线塞进 ACCEPTED_PATTERNS 会把它移出计数集合，
  // --update 若接受新增白名单条目，等于"破坏监听 + 追加白名单"一步洗绿。
  // 确需新增白名单条目时必须手工改基线文件（显式、可评审），不能由 --update 代劳。
  if (usable && Array.isArray(previous.acceptedPatternNames)) {
    const addedAccepted = notInBaseline(acceptedPatternNames, new Set(previous.acceptedPatternNames))
    if (addedAccepted.length > 0) {
      console.error('check-component-contracts: 拒绝新增白名单条目 — --update 不允许把新条目写进 ACCEPTED_PATTERNS 基线')
      for (const name of addedAccepted) console.error(`  ${name}`)
      console.error('白名单只减不增；确需赦免请在基线文件里手工登记该条目并说明理由。')
      process.exit(1)
    }
  }
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        unlistenedEvents: sorted.length,
        unlistenedEventNames: entryNames,
        skippedLocations: skipped,
        acceptedPatternNames
      },
      null,
      2
    )}\n`
  )
  console.log(`check-component-contracts: 基线已更新为 ${sorted.length}（白名单 ${acceptedPatternNames.length} 条）`)
  process.exit(0)
}

// 白名单失效与 followUp 悬空都是"挂账变假象"，一律阻塞（--update 不豁免）。
if (inertAccepted.length > 0) {
  console.error(`check-component-contracts: FAIL — ${inertAccepted.length} 条 ACCEPTED_PATTERNS 已失效`)
  for (const item of inertAccepted) console.error(`  ${item}`)
  console.error('失效条目是死配置：从 ACCEPTED_PATTERNS 删除它，而不是留着继续赦免。')
  process.exit(1)
}
if (followUpErrors.length > 0) {
  console.error(`check-component-contracts: FAIL — ${followUpErrors.length} 条 followUp 指向不存在的 §13 行`)
  for (const item of followUpErrors) console.error(`  ${item}`)
  console.error('要么在 §13.6 补上对应行，要么删掉这条 followUp 挂账。')
  process.exit(1)
}

if (!existsSync(BASELINE)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺失：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

const baseline = readBaseline()

if (baseline === 'invalid') {
  console.error(`check-component-contracts: FAIL — 基线文件无法解析：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (typeof baseline?.unlistenedEvents !== 'number' || !Number.isFinite(baseline.unlistenedEvents)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺少数值型 unlistenedEvents：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (!Array.isArray(baseline.unlistenedEventNames)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺少数组型 unlistenedEventNames：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (!Array.isArray(baseline.skippedLocations)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺少数组型 skippedLocations：${BASELINE}`)
  console.error(REGENERATE_HINT)
  process.exit(1)
}

if (!Array.isArray(baseline.acceptedPatternNames)) {
  console.error(`check-component-contracts: FAIL — 基线文件缺少数组型 acceptedPatternNames：${BASELINE}`)
  console.error('白名单名称集合是只减不增的 ratchet；补上该字段（或运行 --update 首次登记）后才能校验。')
  process.exit(1)
}

/**
 * 白名单名称集合 ratchet：当前 ACCEPTED_PATTERNS ⊆ 基线。
 *
 * 这是防"破坏监听 + 追加白名单"一步洗绿的关键：白名单条目会被 `sorted` 过滤掉，
 * 只冻结"无人监听事件"数量时，新增白名单等于凭空变绿。新增条目必须手工改基线。
 */
const newAccepted = notInBaseline(acceptedPatternNames, new Set(baseline.acceptedPatternNames))
if (newAccepted.length > 0) {
  console.error(`check-component-contracts: FAIL — ACCEPTED_PATTERNS 新增 ${newAccepted.length} 条基线未登记的白名单条目`)
  for (const name of newAccepted) console.error(`  ${name}`)
  console.error('白名单只减不增：不许用"破坏监听 + 追加白名单"把断线洗绿。')
  console.error('确需赦免请手工在基线 acceptedPatternNames 里登记该条目并说明理由（评审可见）。')
  process.exit(1)
}

/**
 * 新增"不可判定"位置必须先处置：跳过会把这些组件从计数里剔除，等价于凭空变绿。
 * 当前基线冻结为 0 处跳过，任何新增都 FAIL。
 */
const newSkips = notInBaseline(skipped, new Set(baseline.skippedLocations))
if (newSkips.length > 0) {
  console.error(`check-component-contracts: FAIL — 新增不可判定位置 ${newSkips.length} 处（会让计数凭空下降）`)
  for (const item of newSkips) console.error(`  ${item}`)
  console.error('先修好解析/绑定，或确认后连同说明一起更新基线（不允许用跳过换绿）。')
  process.exit(1)
}

if (sorted.length > baseline.unlistenedEvents) {
  console.error(`check-component-contracts: FAIL — 无人监听事件 ${sorted.length} > 基线 ${baseline.unlistenedEvents}`)
  for (const entry of sorted) console.error(`  ${entry.event.padEnd(28)} ${entry.component}`)
  console.error('组件事件要么有真实监听方，要么删掉；确属可接受模式请写进 ACCEPTED_PATTERNS 并注明理由。')
  process.exit(1)
}

/**
 * 只比数量会漏掉「修掉一条真实断线又引入一条等价断线」（总数不变）。这里额外断言
 * 当前集合 ⊆ 基线集合：出现基线里没有的条目一律失败。
 */
const unexpected = notInBaseline(entryNames, new Set(baseline.unlistenedEventNames))
if (unexpected.length > 0) {
  console.error('check-component-contracts: FAIL — 出现基线未记录的无人监听事件（换名绕过数量 ratchet）')
  for (const name of unexpected) console.error(`  ${name}`)
  console.error('修掉一条又引入一条等价断线同样不允许：先接线，或说明理由后更新基线。')
  process.exit(1)
}

console.log(
  `check-component-contracts: OK 无人监听事件 ${sorted.length}（基线 ${baseline.unlistenedEvents}，条目均在基线内）；` +
    `白名单 ${acceptedPatternNames.length}/${baseline.acceptedPatternNames.length} 条（只减不增）`
)
if (sorted.length < baseline.unlistenedEvents) {
  console.log('  可运行 node scripts/check-component-contracts.mjs --update 收紧基线')
}
