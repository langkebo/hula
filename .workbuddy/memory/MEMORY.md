# 项目长期记忆 — Tjg (HuLa IM)

## 铁律（强制）
- **禁止 `git add -A`/`.`**：工作区常驻并行会话 E2EE WIP（`useEncryption.ts`、`useDeviceVerifyFlow.ts`、`CryptoDeviceAdapter.ts`、`CrossSigningDialog.vue`、`locales/*/encryption.json`）。逐文件 add，先 `git status --short`
- **Bash `grep` 在本仓会假阴性**（已多次复现）→ 「找不到」结论必须用 ripgrep 复核
- **同一文件多处 Edit 不可并发**（同条消息）→ 会「报成功但只落一处」，模板引用未定义函数。必须串行编辑 + 读回确认
- **TDD 基线**：vue-tsc 0 错误 + vitest 全绿 + biome clean + `check:ratchet` 基线不变
- **禁「纸面测试」**（测试内重实现被测逻辑 → 改坏源码仍绿，必须 import 真实模块）；**否定断言必须变异验证**（改坏源码确认 FAIL 再还原）

## 项目约定
- commitlint scope-enum: core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri；**管理后台用 `ui`**
- 设计 token `--tjg-*` 唯一规范前缀（已全量迁移）；图标 SVG Sprite + Iconify 双轨，新界面默认 Iconify
- 设置 tab 真实来源 = `settingsSchema.ts` 的 `SETTINGS_TABS`（不是 desktop.ts redirect 列表）
- 契约测试算 `ROOT` 数层级：`src/components/<域>/__tests__` 3 层（4 个 `..`）；加子域则 4 层（5 个 `..`）

## ❗ 三个「静默失效」陷阱
**1. SFC 默认导出严禁 `import type`**：类型对但运行时 `X===undefined` → `<X/>` 降级为未知 HTML 元素，Vue 功能全失效。信号：tagName 小写化 + `constructor.name==='HTMLUnknownElement'` + `classes()/attributes()` 全空。正确：去掉 `type`；只要类型用 `ref<InstanceType<typeof import('./Foo.vue')>>`

**2. 共享 partial 的裸全局类名经 `@use` 泄漏**：`src/layout/left/style.scss` 裸 `.setting-item` `@include menu-item-style(absolute)`（展开 `position:absolute/width:fit-content/background/box-shadow/z-index:999/white-space:nowrap/overflow:hidden/flex-direction:column`）。本构建下 `@use` 进 scoped 的**外部 partial 未加 scope 属性**，emit 成全局规则 → 污染设置窗与 `ChatHeaderSidebar`（白卡飘浮、竖排塌缩、控件被裁）。
- 半成品陷阱：`ActionList.vue` 早有 `.setting-item{position:static}` 但只护住左导航「更多」菜单 → 「看起来解决过其实没解决」
- ✅ 根因修复（2026-08-18）：规则搬进 `ActionList.vue` 自己的 `<style scoped>`，删掉 `style.scss` 裸规则与 design-tokens 的 `!important` 兜底
- 口诀：飘浮小卡/竖排塌缩 → 全局裸选择器 → 看其 mixin 展开 → 是否 `@use` 进 scoped 却泄漏 → 移进真正需要它的组件 scoped 块

**3. BEM 元素类 + 修饰类复合选择器 = 死选择器**：`.block__icon { &--verified { color } }` 编译成 `.block__icon.block--verified`，要求两类**同元素共存**；修饰类在根、`__icon` 在子元素 → DOM 永不匹配，**配色静默失效而「断言 class 存在」的测试照常绿**。正确：修饰类样式挂在它实际所处的元素下，子元素用 `currentColor` 继承。排查：`npx sass` 编译看真实选择器

## ❗「接线缺失导致能力空转」（本仓典型缺陷形态）
组件/样式都写好了，但 JS 侧从未写入触发条件或从未被调用 → 代码存在却永不生效。
- 已复现 3 例：① `html.low-perf` 无任何 JS 写入（`performanceTier.ts` 不存在）→ 玻璃降级是死代码（**2026-09-20 已修**，并将 `SyncStatusBar` 的 low-perf 规则一并激活）；② `MxidText` 全仓零真实调用（**已修**，接入 `FriendDetailsSections` 联邦信息区）；③ `MessageLockBadge` 无 `emit`/`@click` → 「点击锁打开设备验证」仍未实现
- **口诀：看到「已完成」的 UI 能力，先问「谁是写入方/调用方？」，grep 调用点而不是 grep 定义**
- **防御：给接线本身写契约测试** —— 读源码断言「调用点存在且早于某锚点」。注意用**行首正则**（`/^[ \t]*fn\(\)/m`）而非 `indexOf`，否则被注释掉的调用会被误判为已接线

## 联邦身份（单一事实源）
- **禁止组件自行解析 MXID**（方案 2.1 硬约束）。统一用 `src/utils/userIdentity.ts`：`toLocalpart` / `extractServerName` / `sameHomeserver(a,b)` / `resolveFederationPeer(mxid, localServer)` / `normalizeMatrixUserId`
- 2026-09-20 修掉的两处违规：`MxidText.vue` 自写 `extractLocalpart`+`extractServerName`（后者是死函数）、`FriendDetailsSections.vue` 自写 `parseServerName`
- `sameHomeserver` 支持 MXID / 纯 server name / 房间 ID（`!:opaque:server`）混用，统一小写 + trim；`resolveFederationPeer` **无法判定时按本地处理**（避免本机未就绪瞬间全量误报「联邦用户」）
- 展示单元：`MxidText`（截断 + title 全量）、`FederationBadge`（远端 chip，`is-local` 控制 local 变体）

## 设备验证能力边界（2026-09-20 实测）
- `DeviceVerifyDialog` props = `{ show, deviceId, deviceName, inboundRequest, initialMode }`，**无目标用户**；`useDeviceVerifyDialog.resetState()` 中 `targetUserId = 当前会话 userId`（自己）
- 即该对话框**只能验证本账号的其它设备**（crypto 验证面注意：改动它属 E2EE 面，且有并行会话在改 `useDeviceVerifyFlow.ts` / `CrossSigningDialog.vue` / `crypto/*`，冲突风险高）
- 锁徽章也拿不到发送者 `deviceId`（`useMessageTrust` 只消费 `hasEncryption`，无设备维度）

## 测试要点（Vitest / happy-dom）
- 基础：mock 变量放 `vi.hoisted()`；`onMounted` 后断言前 `await nextTick()`；`vi.mock` 内 `nextTick` 从 `vue` 导入；naive-ui 必须 stub 成真实 DOM；`MatrixClientService` mock 需同时给命名导出与 default；`wrapper.isVisible()` 对 `v-show` 不稳定 → 判 `style`；禁 `await import()` 动态导入被测模块
- **单例 mock 的 computed 串扰**：`reactive(obj)`+`computed(()=>obj.x)` 串行测试下因 primitive 重赋值 + 单例 computed 缓存读到旧值 → 工厂内用 `ref()` 建真实实例挂回 `vi.hoisted`
- happy-dom 下 `img` 的 `error` 事件**无法派发**；模板以 HTML 注释开头 → 多根片段，`wrapper.element` 取不到根元素 → 用语义化 class token 查询
- **防重复点击用例必假绿**：`await trigger('click')` 连点时首次已渲染 `:disabled`，后续点击被 DOM 拦下，删守卫仍绿 → 必须**同一 tick 内 `dispatchEvent`**。通则：防锁/防抖用例的重复动作必须在 **DOM 更新之前**
- 样式/模板约束**优先写源码契约测试**（`node:fs` + 正则，不挂载重组件）；**可达性测试**用 `sass.compileString(style 块)` + 真实 DOM 校验每条含目标声明的选择器 class token 可达。两种技法的完整说明见范例文件头注释：`MessageLockBadge.styles.test.ts`、`wave1-visual-consistency.test.ts`
- **绝对定位的 `::after`/`::before` 必须有定位上下文**，否则逃逸到最近定位祖先

## 液态玻璃
- mixin `src/styles/scss/mixins/_liquid-glass.scss`；`-panel`/`-subtle` 变体**自带** `low-perf` 降级；裸 `liquid-glass(...)` **不自带**，须显式跟 `@include liquid-glass-fallback;`。降级类由 `utils/performanceTier.ts` 在启动早期写入
- 落地 4 处：`SettingsSidebar`、`SearchPane`、`SingleDetails`(hero)、`GroupDetails`(hero)；约束 `backdrop-filter` 仅面板级 ≤3 元素/视图
- 守护测试：`styles/__tests__/liquid-glass.test.ts`、`rightBox/__tests__/GroupDetailsHero.test.ts`（两 hero 几何逐项一致）

## 消息信任 useMessageTrust
- 锁态映射**只允许**存在于 `src/composables/encryption/useMessageTrust.ts`，组件禁止内联判断；入参 `MaybeRefOrGetter<boolean>`，调用点必须传 getter（`() => props.message?.message?.body?.hasEncryption === true`），否则 props 变化时等级残留
- `MessageTrustLevel` 四态（含 `plain`）用语义；`LockBadgeLevel` 三态用于徽章绑定（`plain`→`unverified`）
- `trustLevel` 对已加密消息**恒定返回 `verified`**（自带「简化版」注释）→ `unverified`/`risk` 目前**不可达**

## 桌面/移动共享
- 全仓**只有一个** `ChatMain.vue`（`components/rightBox/chatBox/`），`MobileChatMain.vue:36` 渲染的就是它 → 两端共用同一实例。计划里「移动端复用 X」先核实是否已自动覆盖

## 前端易错点（散项）
- 禁止解构 class 单例方法（丢 `this`）；`undefined is not an object` 优先查此模式
- 设置页 `onMounted` 先 `await matrixClientService.waitForClientReady({timeoutMs:10000})`；Tauri `resource id invalid` ≠ 网络错误（请求取消竞态 → 归一化 `AbortError`，不重试）
- 设备 ID 持久化：`loginWithToken` 必须在首次 initialize 前定好 deviceId（`resolveDeviceIdByWhoami` 预解析）
- createRoom：Space 必须 `room_types:['m.space']`，不可把 `m.room.create` 塞进 `initial_state`
- i18n `locales/{lang}/*.json` 文件名即顶层命名空间键；biome.json 禁 JSONC 注释；`.vue` 格式化归 prettier
- WorkBuddy safe-delete shim 拦 >50 文件删除（用 `mv` 移 /tmp）；matrix-js-sdk 已去 link 化（tgz+pin，改后 `pack-sdk-tarball.mjs --apply`）；pnpm overrides 用 caret 钉同主版本
- `icon.js` 是压缩单行 sprite：新增图标用 python 脚本定位 `<svg>` 插入；坐标系 48×48，24×24 path 需 ×2
- SDK VoIP：`client.callEventHandler`（属性非方法），`calls` 是 `Map<string,MatrixCall>`；**不存在** `voipHandler`/`getCallHandler()`；`createCall(roomId)`；PushManager 走 `client.getPushManager()`，`getPushRules()` 是它的方法

## SDK 收口（明细见 docs/sdk-encapsulation-audit.md）
- 可收口 getFriendStatusInfo / fetchServerMessages；**必须保留裸调** getCapabilities（SDK 丢 `unstable_features`）、getUserDevices（写 crypto store 有副作用）、SSO/SAML（私有端点）
- 铁律：三方核对（前端请求体 / SDK 内部发什么 / 后端 handler 收什么），SDK 有同名方法 ≠ 可收口

## synapse-rust 要点
- **两套配置树，只有 `docker/deploy/` 是活的**（改前 `docker inspect`）；429 分层定位：nginx 429 不带 `x-ratelimit-remaining`，应用层的带。keys/query 429 风暴根因已修（原静默丢弃无共同房间用户）；活跃 Matrix client 只有一个（主线程）

## UI 优化进度（明细见 `UI-OPTIMIZATION-PLAN.md` v2.0 文末清单）
- 已提交：Token 全量迁移 `97d210f7`、计划文档 `73ab2467`、玻璃降级+群聊 hero 卡+锁徽章类型/响应式 `1374ceda`、徽章三态配色失效+SyncStatusBar 声明未实现 `f5b78594`
- ❗**「阶段 N 完成 100%」不可信**：只代表当批次条目，与正文验收无关。2026-09-20 逐条实测发现正文大量条目未开工（内联样式 469 处、`!important` 104 处、硬编码圆角 19 处、裸 `backdrop-filter` 散落 23 文件；`performanceTier.ts` 等 5 个方案指定文件不存在）
- 已证伪旧待办：「移动端 SyncStatusBar 复用」（共用 ChatMain）、「SSSS 备份引导页」（已实现）、「useDeviceSessionPanel」（不存在）；待办：视觉验收、`variable.scss.bak` 清理
