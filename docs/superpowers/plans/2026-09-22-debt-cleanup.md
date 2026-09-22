# 桌面设置治理债务清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清掉 `docs/mobile-feature-optimization-plan.md` 第 13 节「遗留债务与后续项」记录的全部债务，让上一次治理留下的产品裁决项、工程 follow-up 与移动端平行实现缺口都有真实路径的行为证据。

**Architecture:** 按债务性质分四类处理：需要产品裁决的先裁决再实现；工程 follow-up 走 TDD 修复；门禁类债务要修门禁本身（不是绕过它）；移动端平行实现按"桌面删了什么、移动端同类处理"对齐。每项验收都是真实路径行为测试，不是计数下降。

**Tech Stack:** Vue 3 `<script setup>`、Pinia（setup store + persistedstate）、vitest、Naive UI / Vant、matrix-js-sdk（经服务层）、Tauri v2。

## Global Constraints

- 提交信息用 Conventional Commits；**允许的 scope 只有** `core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri`。
- 提交信息与文档**不得使用 emoji**。
- 不使用 `--no-verify`；不 `git reset` 他人改动；`git add` 只加本任务涉及的文件（主树有并行会话未提交改动，禁止 `git add -A`）。
- 新代码不得硬编码颜色：用 `--tjg-*` token（`check-ratchet` 会拦）。
- 组件不得直接 import `matrix-js-sdk`，一律经 `src/services/matrix/`（`check:sdk-boundary` 会拦）。
- `src/services/**` 新增导出方法必须带 JSDoc（`check:doc-coverage` 是 ratchet，只减不增）。
- 在隔离 worktree `.worktrees/debt-cleanup`（分支 `feat/debt-cleanup`）里干活；基点 `fe04c0da`。
- 测试用 `npx vitest run <path>`；worktree 的 `node_modules` 是指向主树的软链，**不要**跑 `pnpm install`，也不要用 `pnpm test:run` / `pnpm check`（会触发 `ERR_PNPM_IGNORED_BUILDS`），用 `npx vue-tsc --noEmit` 与 `node scripts/*.mjs` 等价形式。
- pre-commit 钩子跑 `lint-staged && vue-tsc --noEmit`（约 140s），`git commit` 放后台或长超时。
- 已知既有红色守门：`check:v-html`（ThemeSwitcher 注释误报）、`check:file-size`（基点即有 17 个超标）；`npx vitest run` 会有 3 个既有 crypto unhandled rejection，且高负载下可能出现 5s 超时 flake（隔离复跑可自证）。
- **不要用计数下降当完成判据**：每项验收必须是真实发送/调用路径上的行为测试或"链接真的接通"的磁盘/结构断言。

---

## 债务 → 任务映射（源自第 13 节）

| # | 债务 | 类别 | 任务 |
| --- | --- | --- | --- |
| D1 | 未读账本持久化 + 关闭回执的跨设备语义 | 产品裁决 | Task 1 |
| D2 | 通知配置/DND 冷启动与跨设备同步 | 产品裁决 | Task 4 |
| D3 | `showSender=false` 仍传 mxc 头像 icon | 产品裁决 | Task 4 |
| D4 | `showNotification()` 零调用方：删还是接线 | 产品裁决 | Task 4 |
| D5 | 移动端 Labs / VoiceVideoSettings 平行实现 | 产品裁决 | Task 3 |
| D6 | presence 门控单点化 | 设计 | Task 2 |
| D7 | `MatrixReceiptService` 414 行拆分 | 工程 | Task 6 |
| D8 | 守门改扫持久层 / key→owner→consumer 清单 | 设计 | Task 5 |
| E1 | 损坏 `tjg-notification-config` 的旧键迁移边界 | 工程 | Task 4 |
| E2 | `--update` 同数量换键 / skip 计数 / 白名单失配 / Windows 路径 | 工程 | Task 5 |
| E3 | component-contracts 冻结的 ~19 条真实断线 | 工程 | Task 5 |
| E4 | 通知标题 `[•]`/`[*]` 标记 | 工程 | Task 4 |
| E5 | `sendNotification` 未 await/无 catch + 缺 `isPermissionGranted` 预检查 | 工程 | Task 4 |
| E6 | 每个开关双写（v-model + @update） | 工程 | Task 4 |
| E7 | orphan locale key 清理 | 工程 | Task 7（守门接线在 Task 5） |
| E8 | `.photo-wall` 选择器 | 工程 | Task 7 |
| M1 | mobile `StatusSettings` presence 未门控 | 移动端 | Task 2 |
| M2 | mobile `VoiceVideoSettings` 输出设备/音量控件 | 移动端 | Task 3 |
| M3 | mobile `LabsSettings` labs 死 key | 移动端 | Task 3 |

**执行顺序**：按 Task 1 → 7 顺序执行即可。两个硬约束：Task 5（守门改造，冻结孤儿基线）
必须在 Task 7（清理孤儿）之前；Task 4 与 Task 7 都会重新生成 `src/typings/i18n.d.ts`，
必须串行（SDD 本身就是串行）。Task 6 与其它任务无耦合。

---

## Task 1: 未读账本持久化 + 跨设备收敛（债务 D1）

**背景（实测，修正债务原文）**：债务写的「账本只在内存中」已过期——`lastReadActiveTimeStore`
早已持久化（`sessionUnread.ts:198-200`），且冷启动 `clearUserLocalStorage()` 刻意不含
`sessionUnread`（`MatrixRuntimeSessionService.ts:85-97`，提交 `7cc32fa4`）。剩余两个真实缺口：
1. **`cacheStore` 不持久化** → 「读 3 条 → 关闭期间来 1 条 → 重启」角标变 4（把已读的算回来）。
2. **case-3b `Math.max(cached, server)` 无跨设备收敛** → 在别的设备读完、本机从未打开过的房间，
   角标会一直挂着（且 `server < cached` 时不写回 cache，`sessionUnread.ts:124-127`）。

**语义裁决（写进注释与文档）**：关闭已读回执的语义是「不让同房间成员看到我读到哪」，
**不是**「每台设备各维护一套未读」。本机未读仍必须跨设备收敛；否则关掉隐私开关等于惩罚可用性。

**交付范围**：只做纯前端、不依赖后端的方案（选项 2）。**不做**「关闭回执时改发
`m.read.private`」（选项 3）——它需要 synapse-rust 确认会把私密已读计入 `unread_count`，
本仓无法证实；未确认前接线会把「关回执」变成「角标永不收敛」的静默失败。
`MatrixReceiptService.sendReadMarker`（`:262-270`，写 `m.fully_read`）零生产调用方的现状保持不变。

**Files:**
- Modify: `src/stores/domains/chat/sessionUnread.ts`
- Modify: `src/stores/domains/chat/chat/session.ts`（`markSessionRead` / `setUnreadCount`）
- Modify: `src/services/matrix/auth/MatrixRuntimeSessionService.ts`（仅注释）
- Test: `src/stores/domains/chat/__tests__/sessionUnread.test.ts`
- Test: `src/stores/domains/chat/__tests__/sessionReadReceipts.test.ts`
- Test: `src/services/matrix/auth/__tests__/MatrixRuntimeSessionService.test.ts`

**Interfaces:**
- Produces: `cacheStore` 条目由 `number` 升级为 `{ count: number; updatedAt: number }`；
  `persist: { pick: ['cacheStore', 'lastReadActiveTimeStore'] }`。
- Consumes: `useSettingStore().preferences.sendReadReceipts` **必须在 `apply()` 内读取**（现 `:90`）——
  这个形态是「会话中途切换开关立即生效」的前提，不得搬到 store 创建期。
- 不变契约：`SessionLogoutService.ts:52` 仍负责登出时清 `sessionUnread`；
  `MatrixRuntimeSessionService.clearUserLocalStorage()` 白名单继续**不含** `sessionUnread`。

**行为要求（逐条要有测试）**
- 回执开时行为完全不变（服务端为准，`sessionReadReceipts.test.ts:249-262` 继续通过）。
- 回执关 + 应用运行中：账本为准（现有 `:229-247` 继续通过）。
- 回执关 + **关闭期间来新消息** + 重启：角标 = 本地增量（读 3 → 服务端累计 4、`activeTime` 变大 → 期望 1）。
- 回执关 + **本机从未打开、别的设备读完**（`server=0 < cached=3`、`activeTime` 未变）：角标收敛为 0，
  且 cache 被写回 0。
- 回执关 + 服务端值更小**但已有新消息**（`activeTime` 变大）：不得用更小的服务端值覆盖账本（保护真实未读）。
- `activeTime === 0`、`lastRead` 存在等既有分支（case 1 / case 3a）语义不变。

- [ ] **Step 1: 写失败测试**

在 `sessionUnread.test.ts` 把现有 `:137-144` 的
`uses Math.max(cached, server) when no lastReadTime` 拆成三条（server>cached → server；
server<cached 且 activeTime 未变 → server 并写回 cache；server<cached 且 activeTime 变大 → cached），
并新增「cache 持久化水合后 case 2 仍以账本为准」。
在 `sessionReadReceipts.test.ts` 新增 §5 的三条（重启后离线消息增量、跨设备收敛为 0、
有更小服务端值但已有新消息不误删）。
在 `MatrixRuntimeSessionService.test.ts` 断言冷启动后 `cacheStore` 与 `lastReadActiveTimeStore`
都被水合、且 bootstrap 不删 `sessionUnread`。
现有 `sessionReadReceipts.test.ts:195-220` **必须改写而非删除**：结论仍是角标 0，但理由从
「cache 不持久化」改成「服务端更小且无新消息时按收敛规则降值」。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/stores/domains/chat/__tests__/sessionUnread.test.ts src/stores/domains/chat/__tests__/sessionReadReceipts.test.ts src/services/matrix/auth/__tests__/MatrixRuntimeSessionService.test.ts
```
Expected: 新用例 FAIL（重启后角标 4、跨设备不收敛、cache 未水合），既有用例仍绿。

- [ ] **Step 3: 实现**

1) `sessionUnread.ts`：`cacheStore` 条目改为 `{ count, updatedAt }`；`set`（`:141-152`）写
   `updatedAt: Date.now()`；`apply` 内取 `cached.count`；case 2 的「回执关 + 有账本」判据保持
   （改为判断条目存在）；case 3b 改成：
   `server < cached && activeTime 未变 → 采信 server`，否则 `Math.max`，并**无条件写回 cache**
   （修 `:124-127` 的分叉）；`persist.pick` 加 `cacheStore` 并改写 `:188-197` 注释。
2) `session.ts`：`markSessionRead` 清零时同时刷新账本 `updatedAt`（`setUnreadCount(roomId, 0)` 已做，
   确认路径即可）。
3) `MatrixRuntimeSessionService.ts:86-89` 注释同步为「账本整体持久化、仍由登出清理」。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/stores/domains/chat src/services/matrix/auth
npx vue-tsc --noEmit
node scripts/check-settings-wiring.mjs && node scripts/check-component-contracts.mjs
```
Expected: PASS。**验收是本步骤的行为测试证据，不是计数。**

- [ ] **Step 5: 更新债务文档口径**

把 `docs/mobile-feature-optimization-plan.md` §13 中「未读账本是否持久化」条目改写为实际剩余状态
（cacheStore 已持久化 + 收敛规则已加；`m.read.private` 作为需后端确认的后续增强）。

- [ ] **Step 6: 提交**

```bash
git add src/stores/domains/chat src/services/matrix/auth docs/mobile-feature-optimization-plan.md
git commit -m "fix(chat): 未读账本完整持久化并支持跨设备收敛

cacheStore 此前只存内存：关闭已读回执时『读过的消息在重启后被算回未读』。
持久化整份账本（含 updatedAt），并在无 lastRead 的房间上按『服务端更小且无新消息』
收敛跨设备已读；回执开启路径行为不变。"
```

---

## Task 2: presence 门控单点化 + 移动端上报补齐（债务 D6/M1）

**背景（实测）**：规则实现只有一份（`src/utils/userStatus.ts` 的 `resolveOutgoingPresence`），
但「是否门控」仍由各调用点自行决定。当前有**两条绕过门控的裸 SDK 写入路径**：
`MatrixPresenceService.setPresence`（`MatrixPresenceService.ts:130-153` → `presenceManager.setPresence:140`）
与 `MatrixAccountService.setPresence`（`MatrixAccountService.ts:490-501` → `client.setPresence:494`）。
真实泄漏点：`src/mobile/views/my/StatusSettings.vue:103` 直接调 `matrixAccountService.setPresence`，
未门控也未 `recordSentPresence`（桌面关闭「显示在线状态」后移动端仍上报 online）。

**结构目标**：让「忘记门控」在结构上不可能——**服务层唯一写入点自己门控**，并删掉第二条裸路径。

**Files:**
- Modify: `src/services/matrix/user/MatrixPresenceService.ts`
- Modify: `src/services/matrix/user/MatrixAccountService.ts`（删除 `setPresence`）
- Modify: `src/composables/user/useAccount.ts`（改委托 presence 服务）
- Modify: `src/composables/user/usePresenceHeartbeat.ts`、`src/stores/domains/user/userStatus.ts`、
  `src/components/userMenu/UserMenuHeader.vue`、`src/services/matrix/auth/SessionBootstrapService.ts`（去重复门控）
- Modify: `src/mobile/views/my/StatusSettings.vue`（改经 presence 服务 + 本地 activeStatus 镜像）
- Test: `src/services/matrix/user/__tests__/MatrixPresenceService.test.ts`（新增门控用例）
- Test: `src/stores/domains/user/__tests__/userStatus.privacy.test.ts`、
  `src/composables/user/__tests__/usePresenceHeartbeat.privacy.test.ts`、
  `src/components/userMenu/__tests__/UserMenuHeader.status.test.ts`、
  `src/services/matrix/auth/__tests__/SessionBootstrapService.test.ts`（重定向断言）
- Test: `src/services/matrix/user/__tests__/MatrixAccountService.test.ts`、`src/composables/user/__tests__/useAccount.test.ts`
- Test: 新增 `src/mobile/views/my/__tests__/StatusSettings.test.ts`

**Interfaces:**
- Produces: `matrixPresenceService.setPresence(presence: PresenceState, statusMsg?: string): Promise<PresenceState>`
  —— 内部：`effective = resolveOutgoingPresence(presence, useSettingStore().showOnlineStatusEnabled)`，
  成功后 `recordSentPresence(effective)`，**返回生效值**。
- Removes: `matrixAccountService.setPresence`（生产唯一使用者是 `useAccount.ts:90` 与
  `mobile/views/my/StatusSettings.vue:103`）。
- 业务前提（已核实）：`resolveOutgoingPresence` 只把 `'online'` 降级为 `'offline'`；
  `'unavailable'`/`'offline'`（登出与 teardown 路径 `SessionLogoutService.ts:126`、
  `sessionRuntimeInternal.ts:162`）不受影响，因此服务层统一门控不会改变登出语义。
- 服务读设置 store 有先例：`MatrixReceiptService.shouldSendReadReceipts()`（`:175-177`）。

**行为要求（逐条要有测试）**
- 开关关闭时，任何调用 `matrixPresenceService.setPresence('online')` 的路径实际上报 `'offline'`，
  且返回值是 `'offline'`。
- 开关开启时上报 `'online'`（行为不变）。
- `'offline'`/`'unavailable'` 在任何开关状态下原样上报。
- 成功后 `recordSentPresence` 被调用一次，值为生效值（心跳的降级去重仍能工作）。
- 移动端 `StatusSettings` 走同一服务；桌面关闭开关后，移动端切状态不再上报 online，
  且本地 `activeStatus` 同步为离线。
- 删除 `MatrixAccountService.setPresence` 后 `useAccount.setPresence` 行为不变（仍返回 Promise，
  调用方不再有绕过门控的入口）。

- [ ] **Step 1: 写失败测试**

`MatrixPresenceService.test.ts`（需 `setActivePinia(createPinia())` 并设置
`useSettingStore().setShowOnlineStatusEnabled(false)`）：新增上述四种门控用例，
asssert `presenceManager.setPresence` 的实际入参与返回值。
新增 `mobile/views/my/__tests__/StatusSettings.test.ts`：mock presence 服务，断言切状态调用它、
且开关关闭时本地 activeStatus 为离线。
重定向现有隐私测试：`userStatus.privacy` / `usePresenceHeartbeat.privacy` / `UserMenuHeader.status` /
`SessionBootstrapService` —— 它们现在 mock 了 `resolveOutgoingPresence`，服务层门控后这些断言会变成
同义反复；改为断言"调用服务时传的是期望的 desired presence，生效判定交给服务"。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/services/matrix/user/__tests__/MatrixPresenceService.test.ts src/mobile/views/my/__tests__/StatusSettings.test.ts
```
Expected: FAIL —— 服务层不门控（上报 'online'）、移动端文件尚无用例。

- [ ] **Step 3: 实现**

1) `MatrixPresenceService.setPresence` 内部门控 + 记录 + 返回生效值（改返回类型，补 JSDoc 说明
   "唯一 presence 写入点，调用点无需再自行门控"）。
2) 删除 `MatrixAccountService.setPresence`；`useAccount.setPresence` 改委托
   `matrixPresenceService.setPresence`；`userStatus.ts:69-74`、`UserMenuHeader.vue:153-159`、
   `SessionBootstrapService.ts:232-239`、`usePresenceHeartbeat.ts:61-72` 去掉重复的
   `resolveOutgoingPresence`/`recordSentPresence`（改为使用服务返回值决定本地 `activeStatus`）。
3) `mobile/views/my/StatusSettings.vue:103-107` 改调 presence 服务，并用返回值同步
   `userStatusStore`/`userStore` 的 activeStatus（与桌面 `hidesOnline` 同语义）。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/services/matrix/user src/stores/domains/user src/composables/user src/components/userMenu src/services/matrix/auth src/mobile/views/my
npx vue-tsc --noEmit
```
Expected: PASS（既有 presence 隐私测试全部保持语义，只换断言层）。

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/user src/composables/user src/stores/domains/user src/components/userMenu src/services/matrix/auth src/mobile/views/my
git commit -m "refactor(service): presence 门控收敛到唯一写入点

presence 规则此前只有一份实现，但『是否门控』由各调用点自行决定，且存在两条
绕过门控的裸 SDK 路径；移动端切状态未门控，桌面关闭『显示在线状态』后会重新
上报 online。改为在 MatrixPresenceService.setPresence 内统一门控并记录，
删除 MatrixAccountService.setPresence，移动端改走同一服务。"
```

---

## Task 3: 移动端平行实现的死配置清理（债务 M2/M3 + 通知移动端）

**背景（实测）**：桌面已删除的三类死配置在移动端仍有独立实现，且全仓零运行时消费方。
移动端没有对应测试的，需要新建。

**Files:**
- Modify: `src/mobile/views/my/VoiceVideoSettings.vue`
- Modify: `src/mobile/views/my/LabsSettings.vue`
- Modify: `src/mobile/views/my/NotificationSettings.vue`
- Test: `src/mobile/views/my/__tests__/VoiceVideoSettings.test.ts`（若无则新建）
- Test: `src/mobile/views/my/__tests__/LabsSettings.test.ts`
- Test: `src/mobile/views/my/__tests__/NotificationSettings.test.ts`

**Interfaces:**
- 不新增公共接口；只删除控件与写入，保留仍被 `mediaDevicePreferences` 消费的键
  （`tjg-audio-input`、`tjg-video-input`、`tjg-echo-cancellation`、`tjg-noise-suppression`、`tjg-auto-gain`）。

**行为要求（逐条要有测试）**
- 移动端不再渲染「音频输出设备」「输入音量」「输出音量」三个控件，也不再写
  `tjg-audio-output` / `tjg-input-volume` / `tjg-output-volume`（模板 `29-39`/`146-151`、
  写入 `:302`、读取 `:278-282`）。保留的麦克风/摄像头选择与三个音质开关行为不变。
- 移动端 Labs 页不再写 `tjg-lab-features` / `tjg-debug-mode` / `tjg-show-performance`
  （`:214/235`、`:226/250`、`:229/258`）；`tjg-enable-devtools` 全仓零命中，无需处理。
  **保留 Labs 页本身与它到 `IntegrationsSettings` 的入口**（`:265-267`；`mobile.ts:141-144` 的
  `labs/integrations` 路由）——删掉整页会让 Integrations 变成孤儿路由。
- 移动端通知页不再写三个零读取的键：`tjg-push-notifications`（`:359`）、
  `tjg-email-notifications`（`:363`）、`tjg-encrypted-room-notifications`（`:367`）；
  这三个值在挂载时从未被读取（页面恒用硬编码默认值）。桌面/移动共用的
  `notificationDisplayPreferences` 读改写逻辑保持不变。

- [ ] **Step 1: 写失败测试**

三个移动端测试文件分别断言：不再渲染/写入上述死 key（用真实挂载 + `localStorage` 断言，
不要只断言 mock）、保留的控件仍可用且写入仍生效。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/mobile/views/my/__tests__/VoiceVideoSettings.test.ts src/mobile/views/my/__tests__/LabsSettings.test.ts src/mobile/views/my/__tests__/NotificationSettings.test.ts
```
Expected: FAIL —— 死 key 仍被写入。

- [ ] **Step 3: 实现**

删除三个页面中的死控件/死写入与随之无用的 ref、handler、locale 引用；移动端 Labs 页保留
Integrations 入口与其路由。不要动 `mediaDevicePreferences` 与桌面端。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/mobile
npx vue-tsc --noEmit
node scripts/check-component-contracts.mjs
```
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/mobile
git commit -m "refactor(mobile): 清理零消费方的音视频/实验性/通知死配置

移动端仍独立实现桌面已删除的三类死配置：输出设备与输入/输出音量（零消费方）、
labs 死 key（零运行时消费方，但保留 Integrations 入口）、三个只写不读的通知键。"
```

---

## Task 4: 通知服务生命周期、死表面与迁移边界（债务 D2/D3/D4/E1/E4/E5/E6）

**实测事实（必须遵守，债务原文有三处不准确）**
- `sendNotification` 的签名是 `void`（插件 `index.d.ts:303`，实现是 `new window.Notification`），
  **无法在调用点 await**；唯一真实缺口是发送前没有权限检查（对比 `usePushReceiver.ts:18-25`）。
- 「双写绕过 `writeConfig` 去重」只对一处成立：编译后 `v-model:value` + `@update:value` 是
  `[setter, handler]`，setter 先跑，`writeConfig`（`NotificationSettings.vue:144-154`）已去重
  enableDesktop/showMessageContent/showSender；**真正绕过的是 `threadMentionNotify`**
  （每次点击 2 次 `setEventNotificationEnabled` → 2 个 account data PUT）。
- 债务漏记三个死字段：`enableSound` / `enableVibrate` / `showPreview` 全仓零读取
  （只有零调用方的 `playSound:628` / `vibrate:641` 读前两个，`showPreview` 无人读）。
- `syncDndToAccountData`（`:285`）是唯一没有 `waitForClientReady` 的写入点 → client 未就绪时静默丢。
- 损坏配置：`loadConfig:160` 的 `safeJsonParse(..., DEFAULT_NOTIFICATION_CONFIG)` 在 JSON 损坏/
  校验失败时返回**整份默认对象**，于是 `migrateLegacyDisplayConfig:193` 的
  `explicit?.[field] === undefined` 恒为假 → 旧键**不被采纳却被删除**（关过 showSender 的用户
  升级后被静默恢复为开）。对照 `migrateLegacyEventNotification:223` 用
  `this.config.events.thread_mention === undefined` 判断，损坏时**会**采纳。

**裁决（用户已确认）**：仅 DND 冷启动拉取 + `updatedAt`；删零调用方方法；删零读取字段与 UI 开关；
标题不再带 `[•]`/`[*]`（改放 body）；payload 不再传 icon。

**纠偏（执行中发现，必须遵守）**：设置页的「通知声音」开关实际绑的是 **live** 的
`settingStore.messageSoundEnabled`（`layout/index.vue:284`、`mobile/components/MobileLayout.vue:66` 都在读），
「音量」滑块绑的是 **live** 的 `notification.volume`（同上 `:290`/`:72` 读取，默认 80）。
它们与死字段 `enableSound` 不是同一个东西。因此：
- 删除 `enableSound`/`enableVibrate`/`showPreview` 三个**服务配置字段**与死方法即可；
- **保留**设置页的通知声音开关与音量滑块，以及 store 的 `notificationVolume`/`setNotificationVolume`；
- `layout/index.vue` / `MobileLayout.vue` 必须继续读 `settingStore.notification.volume`，不得硬编码 0.8。

**Files:**
- Modify: `src/services/matrix/notifications/MatrixNotificationService.ts`
- Modify: `src/services/matrix/auth/SessionBootstrapService.ts`（`waitSyncPrepared()` 之后拉一次 DND）
- Modify: `src/stores/domains/chat/chat/messageMutations.ts`
- Modify: `src/views/settingsWindow/tabs/NotificationSettings.vue`
- Modify: `src/views/settingsWindow/tabs/PushSettings.vue`
- Test: `src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts`
- Test: `src/services/matrix/notifications/__tests__/notificationDisplayPreferences.test.ts`（若涉及 i18n）
- Test: `src/stores/domains/chat/chat/__tests__/message.test.ts`
- Test: `src/views/settingsWindow/tabs/__tests__/NotificationSettings.test.ts`、`PushSettings.test.ts`
- Modify locales + `node scripts/generate-i18n-types.mjs`

**Interfaces:**
- `DndWindow` 增 `updatedAt: number`（写入 `setDndSettings` 时置 `Date.now()`，镜像与 account data 同步携带；
  读取旧 payload 无该字段时视为 0）。冲突规则：仅当**服务端 `updatedAt` 更新**时才覆盖本地。
- `syncDndToAccountData`：开头加 `await matrixClientService.waitForClientReady({ timeoutMs })`；
  调用点 `:384` 改为 `void this.syncDndToAccountData(...).catch(...)`。
- 新增 `async canSendSystemNotification(): Promise<boolean>`（检查 `isPermissionGranted()`；
  非 Tauri/异常时返回 false 并记日志），供 `messageMutations` 发送前调用。
- `buildNotificationDisplay(title, body)` 返回**干净标题**；折叠/关键词命中的可见信号移到 `body`
  （新增 i18n 键，例如 `message.notify.folded` / `message.notify.keyword_hit`），不再改标题。
- Removes: `showNotification`、`playSound`、`vibrate`、`enableSound`、`enableVibrate`、`showPreview`。

**行为要求（逐条要有测试）**
- 冷启动：`waitSyncPrepared()` 后 DND 从 account data 拉取一次并写回本地镜像；
  服务端 `updatedAt` 更旧时不覆盖本地新改动；服务端更新时覆盖。
- `syncDndToAccountData` 在 client 未就绪时等待而不是静默失败。
- 损坏/非法 `tjg-notification-config` 时，旧 `tjg-desktop-notification`/`tjg-show-content`/
  `tjg-show-sender` 仍被采纳（新值优先规则只对"真正存在的新值"生效）。
- 标题始终等于发送者名或 `t('message.notify.new_messages')`，不含 `[•]`/`[*]`；折叠/命中信息出现在 body。
- 通知 payload 不含 `icon` 字段。
- 三个死字段/方法/UI 开关删除后无残留引用；`enableSound` 的 UI（声音开关与音量滑块）一并清理，
  音量滑块若无消费者也删除（报告里给 grep 证据）。
- 每个通知开关一次点击只写一次（含 `threadMentionNotify`：一次 account data PUT）。
- 发送路径：权限未授予时不发送；派发用 `void ...catch` 包裹，异常不逃逸。

- [ ] **Step 1: 写失败测试**（按上面每一条；损坏配置 3 例加进现有
  `legacy display config migration` 块；`message.test.ts` 现有 icon 断言 `:621,:658` 要改）
- [ ] **Step 2: 跑测试确认失败**
```bash
npx vitest run src/services/matrix/notifications src/stores/domains/chat/chat/__tests__/message.test.ts src/views/settingsWindow/tabs
```
- [ ] **Step 3: 实现**（按 Interfaces 与行为要求）
- [ ] **Step 4: 跑测试与守门**（`npx vitest run` 相关目录、`npx vue-tsc --noEmit`、
  `node scripts/check-settings-wiring.mjs`、`check:component-contracts`；locale 变更后跑 `gen:i18n`）
- [ ] **Step 5: 提交**（`fix(service): 通知生命周期与死表面治理`）

---

## Task 5: 守门改造与门禁口径（债务 D8/E2/E3）

**裁决（用户已确认）**：settings-wiring 采用「清单 + 持久层发现」；component-contracts 修能修的 3 条、
清 13 条可选/死声明/检测器误报、把 10 条需产品行为的移出基线写成 follow-up。

**Files:**
- Create: `scripts/settings-wiring-manifest.json`（key → owner / consumer 路径）
- Modify: `scripts/check-settings-wiring.mjs`
- Modify: `scripts/check-component-contracts.mjs`
- Modify: `scripts/component-contracts-baseline.json`
- Modify: `scripts/check-i18n-dead-keys.mjs`（改为命名空间感知 + 跳过 tests + ratchet 基线）
- Create: `scripts/i18n-dead-keys-baseline.json`
- Modify: `package.json`（注册 `check:i18n-dead-keys`）
- Modify: `.github/workflows/quality-gate.yml`（接入 i18n dead keys）
- Modify: `src/layout/right/index.vue`、`src/components/space/SpaceChildrenPane.vue`（3 条一行接线）
- Test: 两个守门脚本自测（临时探测，不入库）

**行为要求**
- settings-wiring：从 `src/{stores,services,utils,composables}/**` 发现持久化 key
  （`*_STORAGE_KEY`、`STORAGE_KEYS` map、`persist` 的 store id、直接 `setItem`），
  凡未登记在 manifest 的新 key → FAIL；manifest 条目必须给出 owner 与至少一个 consumer 路径（存在性校验）；
  保留数量 ratchet 并扩展为**键名集合**：`--update` 拒绝任何新增键（含同数量换键）。
- component-contracts：`--update` 走与 verify 相同的键名子集校验；新增 skip 即 FAIL；
  失效的 `ACCEPTED_PATTERNS` 条目告警；Windows 反斜杠路径归一化（collect/relative/resolveImport）；
  修掉全局自动导入组件（basename 冲突/`index`）导致的误报——用 `src/typings/components.d.ts`
  的路径派生名而不是 basename。
- 3 条一行接线：`CreateRoomPane::close`（use `layout/right/index.vue:59`）、
  `SpaceDetailsPane::selectSpace` / `memberClick`（use `SpaceChildrenPane.vue:22-56`）。
- 13 条可选/死声明：能在无风险下删除的删除（未 emit 的声明、`@extend` 死选择器等），
  其余进 `ACCEPTED_PATTERNS` 并写明理由（含 `renderMessage/index::jump2Reply` 误报）。
- 10 条产品行为断线：从基线移除，写入 `docs/mobile-feature-optimization-plan.md` §13 的 follow-up
  （ThreepidManager 增删/解绑、guest 登录与 GuestModeBanner、UserMenuHeader::avatar-click、
  RoomInviteActions::error、ThreadPanel::sendReply、SpaceListItemCard::contextmenu、
  RoomSessionList::batchToggle），每条带 file:line 与"缺什么"。
- i18n dead keys：修复 `walk()` 实际不跳 tests、`sourceText.includes(key)` 命名空间盲区；
  作为 ratchet 接入 `package.json` 与 CI（初始基线冻结当前孤儿集合，Task 7 负责把它降下来）。

- [ ] **Step 1: 写探测/失败用例**（临时删一个真实监听 → 守门 FAIL；新增一个未登记持久化 key → FAIL；
  `--update` 同数量换键 → 拒绝；动态/反斜杠路径不再误判。探测不入库）
- [ ] **Step 2: 实现**（按行为要求；脚本加 JSDoc 注释与用法说明）
- [ ] **Step 3: 跑守门与聚焦测试**（两个守门 + 新 i18n 守门 + 改动的 3 处组件测试 + `vue-tsc`）
- [ ] **Step 4: 提交**（`test(config): 守门改为清单契约并收紧口径`）

---

## Task 6: MatrixReceiptService 拆分（债务 D7）

**Files:**
- Create: `src/services/matrix/messaging/MatrixReadStateService.ts`（~110 行）
- Modify: `src/services/matrix/messaging/MatrixReceiptService.ts`（414 → ~319 行）
- Modify: `src/components/rightBox/chatBox/TjgMessageMeta.vue`、`src/services/matrix/sync/RealtimeService.ts`（改消费点）
- Test: 新建 `src/services/matrix/messaging/__tests__/MatrixReadStateService.test.ts`
- Test: `MatrixReceiptService.test.ts`（把 `:169-205`、`:323-340` 的查询用例迁出）

**Interfaces:**
- Produces: `matrixReadStateService`（或同名导出）——`getReadReceipts` / `getEventReaders` /
  `getUnreadCount` / `hasUnread` / `getRoomsWithUnread` + `ReadReceipt` 类型；直接调
  `client.getReadReceiptsManager()`（SDK 内部有 memoize），**不得**用会抛错的 `BaseMatrixService.getClient`，
  保留既有 null-client → `0`/`[]` 的守卫。
- 发送路径 / 去重 / 延迟补发计时器 / `clearCache` 行为不动。

- [ ] **Step 1: 先跑现有三套测试记录基线**（`MatrixReceiptService.test.ts`、
  `MatrixReceiptService.privacy.test.ts`、`sessionReadReceipts.test.ts`）
- [ ] **Step 2: 迁移查询方法 + 测试**（保持行为等价，先跑绿再删原实现）
- [ ] **Step 3: 更新两个消费点**（`TjgMessageMeta.vue:54/90`、`RealtimeService.ts:6/61`）
- [ ] **Step 4: 跑测试与守门**（`npx vitest run` 三套 + `node scripts/check-file-size.mjs` 记录新行数；
  该守门基点即红、不在 CI，不要求全局转绿，但本文件必须 < 400）
- [ ] **Step 5: 提交**（`refactor(service): 拆分只读回执查询到 MatrixReadStateService`）

---

## Task 7: orphan locale 清理与 .photo-wall（债务 E7/E8）

**Files:**
- Modify: `locales/zh-CN/setting.json`、`locales/en/setting.json`（删除孤儿键，两语言同步）
- Modify: `scripts/i18n-dead-keys-baseline.json`（收紧）
- Generate: `src/typings/i18n.d.ts`（`node scripts/generate-i18n-types.mjs`）
- Modify: `src/styles/scss/render-message.scss`（`.photo-wall` 纳入 `[data-bubble-style='square']` 选择器）

**行为要求**
- 删除 `check:i18n-dead-keys` 基线里的全部孤儿键（当前 75：`notification.*` 20、`push.title` 1、
  `labs.*` 54），两语言文件同步；重新生成 i18n.d.ts；基线归零或只留明确白名单。
- `[data-bubble-style='square']` 规则覆盖 `.photo-wall`（与 `.bubble`/`.bubble-oneself` 同组），
  并加磁盘/结构守卫断言三个选择器都在。

- [ ] **Step 1: 跑 `node scripts/check-i18n-dead-keys.mjs`** 拿到精确孤儿清单
- [ ] **Step 2: 删除 + 同步两语言 + `gen:i18n`**
- [ ] **Step 3: `.photo-wall` 选择器 + 守卫测试**
- [ ] **Step 4: 跑 `npx vitest run src/locales src/utils src/views/settingsWindow`、`node scripts/check-i18n*.mjs`、`npx vue-tsc --noEmit`**
- [ ] **Step 5: 提交**（`chore(i18n): 清理孤儿文案并补齐气泡选择器`）
