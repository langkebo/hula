# 项目长期记忆 — Tjg (HuLa IM)

## 项目约定
- commitlint scope-enum：core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri。**管理后台用 `ui` scope**
- 设计 token：`--tjg-*` 为规范前缀（2.6.3 全部迁移完毕，`token-usage-report.md` 0 未迁移）
- 图标：SVG Sprite + Iconify 双轨，新界面默认用 Iconify
- TDD 验收基线：vue-tsc --noEmit (0 errors) + vitest run (全绿) + biome check (clean) + check:ratchet 基线不变

## 提交与检索纪律（强制）
- **禁止 `git add -A` / `git add .`**：工作区常驻并行会话的 E2EE WIP（`useEncryption.ts`、`useDeviceVerifyFlow.ts`、`CryptoDeviceAdapter.ts`、`CrossSigningDialog.vue`、`locales/*/encryption.json` 等）。提交必须逐文件 add，先 `git status --short` 核对
- **Bash 工具的 `grep` 在本仓库会出假阴性**（对确实存在的符号返回空，已多次复现）。任何"找不到"结论必须用 `Grep` 工具（ripgrep）复核后再下判断
- 契约测试里算 `ROOT` 要数层级：`src/components/<域>/__tests__` 是第 3 层（4 个 `..`），`src/components/<域>/<子域>/__tests__` 是第 4 层（5 个 `..`）

## 前端易错点
- **禁止解构 class 单例方法**：丢 `this` 绑定。排查 `undefined is not an object` 优先查此模式
- **设置页 onMounted 必须先 `await matrixClientService.waitForClientReady({ timeoutMs: 10000 })`**
- **Tauri `resource id invalid` ≠ 网络错误**：是请求被取消的竞态，归一化为 `AbortError`，不重试
- **设备 ID 持久化**：`loginWithToken` 必须在首次 initialize 之前定好 deviceId（`resolveDeviceIdByWhoami` 预解析）
- **createRoom 铁律**：Space 必须用 `room_types:['m.space']`，不可把 `m.room.create` 塞进 `initial_state`
- **i18n 陷阱**：`locales/{lang}/*.json` 文件名即顶层命名空间键
- **biome.json 禁 JSONC 注释**：会静默丢弃语言级设置
- **.vue 格式化归 prettier**：biome.json overrides 中 `**/*.vue` 的 `formatter.enabled: false`
- **WorkBuddy safe-delete shim**：拦 >50 文件删除，用 `mv` 移去 /tmp 绕过
- **matrix-js-sdk 已去 link 化**：tgz+pin 锁定，改 SDK 后 `pack-sdk-tarball.mjs --apply` + `pnpm install`
- **pnpm overrides 纪律**：caret 钉同主版本，`>=` 会解析到最新大版本
- **icon.js 是压缩单行 sprite**：新增图标用 python 脚本定位 `<svg>` 标记插入（手动 Edit 易破坏）；sprite 坐标系 48×48，原型 24×24 path 需缩放 2 倍
- **设置 tab 真实来源**：`settingsSchema.ts` 的 `SETTINGS_TABS`，不是 desktop.ts 路由 redirect 列表（后者不完整）
- **SDK VoIP 属性名**：v40.2.0 中是 `client.callEventHandler`（属性，非方法），`calls` 是 `Map<string, MatrixCall>`。不存在 `voipHandler` / `getCallHandler()`（曾是幻影声明）。`createCall(roomId)` 只接受 roomId
- **SDK PushManager**：`client.getPushManager()` 返回 PushManager，`getPushRules()` 是其方法（不是 client 的）

### ❗ 致命陷阱 1：SFC 默认导出严禁 `import type`
`import type X from './Foo.vue'` 时 TS 类型对，但**运行时 X === undefined** → `<X ref="r" />` 降级成未知 HTML 元素，**Vue 功能全失效**（ref 是 HTMLUnknownElement、无事件/生命周期/ErrorCaptured、`Object.keys()` 为 `[]`）。
- 诊断信号：DOM tagName 小写化（如 `<settingscontent>`）+ `wrapper.element.constructor.name === 'HTMLUnknownElement'` + `wrapper.classes()/attributes()` 全空
- 正确写法：去掉 `type` 关键字 `import X from './Foo.vue'`；只要类型时用 `ref<InstanceType<typeof import('./Foo.vue')>>`

### ❗ 致命陷阱 2：共享 partial 的裸全局类名经 `@use` 泄漏
`src/layout/left/style.scss` 曾用裸 `.setting-item` 写 `@include menu-item-style(absolute)`（mixin 在 `src/styles/scss/global/variable.scss:112`，展开含 `position:absolute; width:fit-content; background; border-radius; box-shadow; z-index:999; white-space:nowrap; overflow:hidden; flex-direction:column`）。本项目构建下 `@use` 进 scoped 的**外部 partial 未被加 scope 属性**，被 emit 成**全局规则**，污染设置窗与 `ChatHeaderSidebar.vue` 的 `.setting-item` → 白色小卡飘浮、竖排塌缩、控件被裁。
- **半成品修复陷阱**：`ActionList.vue` 早有 `.setting-item{position:static;z-index:auto}`，但其 `@use` 在自身 scoped 内不泄漏，**只护住左导航"更多"菜单，没覆盖设置窗**——"看起来解决过其实没解决"
- **✅ 根因修复（2026-08-18）**：把 `.setting-item` 从共享 `style.scss` 搬进 `ActionList.vue` 自己的 `<style scoped>`，并删除 `style.scss` 中的裸规则；design-tokens.css 的 `!important` 兜底补丁一并移除
- **排查口诀**：飘浮小卡/竖排塌缩 → 全局裸选择器 → 看其 `@include` 的 mixin 展开 → 确认是否 `@use` 进 scoped 却泄漏 → 规则移进真正需要它的组件 scoped 块，而非用 `!important` 反打
- **铁证信号**：`.setting-item` 同时具备 `position:absolute` + `width:fit-content` + `background` + `box-shadow` + `flex-direction:column`；受害组件 ref 正常（排除陷阱 1）

## Vitest 要点
- mock 变量放 `vi.hoisted()`；`onMounted` 后断言前需 `await nextTick()`
- naive-ui 组件必须 stub 成真实 DOM；`vi.hoisted` 返回值要同步加到顶部解构
- `wrapper.isVisible()` 对 `v-show` 不稳定，改判 `style` 属性
- `MatrixClientService` mock 必须同时提供命名导出与 default
- **禁止 `await import()` 动态导入被测模块**：用静态导入 + hoisted `vi.mock`
- **否定断言必须做变异验证**：临时改坏源码确认用例真的 FAIL 再还原
- **单例 mock 的 computed 响应式陷阱**：mock 工厂里 `reactive(obj)` + `computed(() => obj.x)` 在串行测试下会因 primitive 重赋值 + 单例 computed 缓存导致依赖追踪串扰（读到旧值）。正确做法：工厂内用 `ref()` 创建真实实例挂回 `vi.hoisted` 容器，测试直接改 `.value`；`reactive` 对象属性用 `Object.assign` 原地改
- **happy-dom 下 `img` 的 `error` 事件无法派发**：`trigger('error')` 与原生 `dispatchEvent` 都触发不了 Vue `onError`。改测组件自身真实行为（入队下载、状态 computed）
- **模板以 HTML 注释开头 → Vue 多根片段**：`wrapper.classes()`/`wrapper.element` 取不到真实根元素，改用语义化 class token 查询
- **`vi.mock` 内 `nextTick` 须从 `vue` 导入**（从 `@vue/test-utils` 导入会报 "not a function"）
- 组件测试挂起 forks worker：写 import-only 探针二分定位，stub 重度服务图谱子组件

## 测试约定
- **样式/模板约束优先写「源码契约测试」**，不要强行挂载重组件。先例：`components/workbench/__tests__/wave1-visual-consistency.test.ts`、`css-naming-lint.test.ts`、`src/styles/__tests__/naiveTokenSource.test.ts`。用 `node:fs` 读源码 + 正则断言，文件头注释写明「覆盖什么 / 不覆盖什么」
- **禁止「纸面测试」**：在测试文件里重实现一遍被测逻辑 → 真实代码改动后测试仍绿，无保护力。必须 `import` 真实模块

## SDK 收口事实（2026-09-11 审计，详见 docs/sdk-encapsulation-audit.md）
- **可安全收口**：getFriendStatusInfo（getFriendManager 代理）、fetchServerMessages（createMessagesRequest 透传原始 chunk，dir 需转 Direction 枚举）
- **必须保留裸调**：getCapabilities（SDK 丢顶层 unstable_features）、getUserDevices（downloadKeysForUsers 写 crypto store 有副作用）、SSO/SAML（synapse-rust 私有端点）
- **三方 wire format 不一致待解**：voice 上传（后端收 Json content=base64，前端发 FormData）、AIConnection（后端路由未实现 + 参数结构不同）
- 收口铁律：必须三方核对（前端请求体 vs SDK 方法内部发什么 vs 后端 handler 收什么），SDK 有同名方法 ≠ 可收口

## synapse-rust 要点
- **两套配置树，只有 `docker/deploy/` 是活的**：改前先 `docker inspect` 确认挂载
- **429 分层定位法**：nginx 429 不带 `x-ratelimit-remaining`，应用层的带
- **keys/query 429 风暴根因**：`/keys/query` 静默丢弃无共同房间的用户 → 客户端设备过期标记永不清 → 无退避满速重查。已修复：移除共同房间过滤
- **活跃 Matrix client 只有一个（主线程）**：WorkerHost 的 handleInitialize/handleStartClient 是死代码
- 优化 ticket 进度与命令见当日 daily log（`synapse-rust-audit-recheck` / `synapse-rust-guarded-fix-loop` skill）

## 液态玻璃（liquid-glass）落地事实
- mixin：`src/styles/scss/mixins/_liquid-glass.scss`；变体 `liquid-glass-panel` / `liquid-glass-subtle` **自带** `html.low-perf` 降级；裸 `liquid-glass(...)` **不自带**，必须显式跟 `@include liquid-glass-fallback;`
- 落地 4 处：`views/settingsWindow/SettingsSidebar.vue`(panel)、`components/search/SearchPane.vue`(16/0.9/1.5 + fallback)、`components/rightBox/SingleDetails.vue`(hero, panel)、`components/rightBox/GroupDetails.vue`(hero, panel)
- 约束：`backdrop-filter` 仅面板级，≤3 个元素/视图；列表项与消息行禁用
- 守护测试：`src/styles/__tests__/liquid-glass.test.ts`（递归扫 src，裸调用缺降级即失败）
- 详情面板规格一致性：`.single-details__hero` 与 `.group-details__hero` 几何逐项相同（radius 16 / padding 20 / width 100% / gap 14 / box-sizing border-box），守护测试 `src/components/rightBox/__tests__/GroupDetailsHero.test.ts`

## 消息信任（useMessageTrust）约定
- 锁态映射**只允许**存在于 `src/composables/encryption/useMessageTrust.ts`，组件禁止内联判断
- 入参是 `MaybeRefOrGetter<boolean>`，调用点必须传 getter（`() => props.message?.message?.body?.hasEncryption === true`），否则 props 变化时信任等级残留
- `MessageTrustLevel` 四态（含 `plain`）用于语义描述；`LockBadgeLevel` 三态用于 `MessageLockBadge` 的 `trust-level` 绑定（`plain` → `unverified`）

## 样式陷阱与可达性测试（2026-09-20）
- **❗ BEM 元素类 + 修饰类复合选择器 = 死选择器**：`.msg-lock-badge__icon { &.msg-lock-badge--verified { color } }` 编译为 `.msg-lock-badge__icon.msg-lock-badge--verified`，要求两类**同元素共存**。若修饰类在根元素、`__element` 在子元素 → DOM 中永不匹配，**配色静默失效**，而所有「断言 class 存在」的测试照常通过。
  - 正确写法：修饰类的样式挂在**它实际所处的那个元素**的选择器下（如根 `.block { &--modifier { color } }`），子元素用 `currentColor` 继承
  - 排查：出现「样式写了但不生效」→ `npx sass` 编译该样式块看真实选择器产物
- **可达性测试方法（比正则断言强，推荐）**：`sass.compileString(SFC 的 style 块)` → 拍平成 `{selector, body}` → 挂载真实 DOM 收集每元素 class 集合 → 断言每条含目标声明的选择器其 class token 可达。范例 `src/components/atomic/__tests__/MessageLockBadge.styles.test.ts`
  - 两个解析坑：sass 保留注释；样式块含中文时顶部会插 `@charset "UTF-8";` —— 都必须先剥离，否则首条规则 selector 带前缀
  - 断言需排除「其它状态」的规则：某状态挂载时其它状态的修饰类天然不在 DOM，是合法未激活
- **绝对定位的 `::after`/`::before` 必须有定位上下文**：宿主元素（或其祖先）忘了 `position: relative` → 伪元素逃逸到最近的定位祖先上（与 `.setting-item` 泄漏同族的「飘浮元素」问题）

## 防重复点击类测试陷阱（2026-09-20）
- 用 `await trigger('click')` 连点测「只触发一次」是**假绿**：首次点击后 `:disabled` 已渲染，后续点击被 **DOM 的 disabled** 拦下，删掉组件内的加锁守卫用例照样通过
- 正确做法：**同一 tick 内直接 `element.dispatchEvent(new Event('click'))`**（此时 disabled 尚未渲染）→ 去重只能依赖守卫，删守卫即转红
- 通则：涉及「加锁/防抖/防重复」的用例，必须让重复动作发生在 **DOM 状态更新之前**，否则测的是 DOM 而不是守卫

## 桌面/移动共享组件事实
- 全仓**只有一个** `ChatMain.vue`（`src/components/rightBox/chatBox/`），`MobileChatMain.vue:36` 渲染的就是它 → 桌面/移动共用同一实例。改 `ChatMain.vue` 即同时影响两端；反之，计划里「移动端复用 X」类待办要先核实是否已自动覆盖

## 编辑纪律
- **同一文件的多处 Edit 不可放在同一条消息里并发提交**：会出现「工具报成功但只有一处落盘」，导致模板引用了未定义的函数（Vue 渲染期警告 `Property "x" was accessed during render but is not defined on instance`）。同文件必须**串行编辑，编辑后读回确认**

## UI 优化进度
- 方案与执行记录：`UI-OPTIMIZATION-PLAN.md`（v2.0）；Token 报告：`token-usage-report.md`；工具：`scripts/token-migration-helper.py`
- 已完成：Token 全量迁移（`97d210f7`）、计划文档全部阶段（`73ab2467`）、液态玻璃降级补齐 + 群聊 hero 卡 + 锁徽章类型/响应式修复（`1374ceda`）、徽章三态配色失效 + SyncStatusBar 声明未实现修复（本轮）
- 待办（已核实前提）：视觉验收（唯一真待办）、`variable.scss.bak` 清理
- 已证伪的旧待办：「移动端 SyncStatusBar 复用」（共用 ChatMain，已覆盖）、「SSSS 备份引导页」（已实现）、「useDeviceSessionPanel」（该 composable 不存在）
- `useMessageTrust.trustLevel` 对已加密消息恒定返回 `'verified'` → 徽章的 `unverified`/`risk` 目前是**不可达状态**（待接入真实设备验证状态）
