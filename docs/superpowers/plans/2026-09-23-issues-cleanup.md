# 剩余问题清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 逐一清掉 `master` 上剩余的已知问题：门禁红灯、通知/presence/未读的工程 follow-up、守门局限、i18n 判活与类型缺口、组件事件断线与测试清理。

**Architecture:** 按性质分三类：门禁类修门禁本身（可失败探针为证据）；行为类走 TDD 在真实路径上加测试；产品类按用户裁决"能接的接、接不上的删死入口"，不做半成品。

**Tech Stack:** Vue 3 `<script setup>`、Pinia、vitest、Naive UI / Vant、matrix-js-sdk（经服务层）、Tauri v2。

## Global Constraints

- 提交信息用 Conventional Commits；**允许的 scope 只有** `core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri`。提交信息与文档**不得使用 emoji**。
- 不使用 `--no-verify`；不 `git reset` 他人改动；`git add` 只加本任务涉及的文件。
- 新代码不得硬编码颜色（`--tjg-*` token）；组件不得直接 import `matrix-js-sdk`（走 `@/types/matrix-js-sdk` 白名单 shim 或服务层）。
- `src/services/**` 新增导出方法必须带 JSDoc（`check:doc-coverage` ratchet）。
- 在隔离 worktree `.worktrees/issues-cleanup`（分支 `feat/issues-cleanup`，基点 `6c6af608`）执行。`node_modules` 已软链到主树：**不要** `pnpm install`；测试用 `npx vitest run <path>`，守门用 `node scripts/*.mjs`，类型检查 `npx vue-tsc --noEmit`。
- pre-commit 钩子会跑 `lint-staged && vue-tsc --noEmit`（约 140s）：`git commit` 放长超时/后台。
- 已知既有噪声：全量 `npx vitest run` 会因 3 个 crypto unhandled rejection 退出码为 1；高负载下可能出现 5s 超时 flake（隔离复跑自证）。
- **验收判据**：门禁类必须给出"能失败"的探针（临时制造违规 → FAIL → 恢复 → OK）；行为类必须是真实路径行为测试的 RED→GREEN；不得以计数下降或删除断言充当证据。
- 逐项细节（现状、file:line、处置依据）见 `docs/mobile-feature-optimization-plan.md` §13 与 §13.6。

---

## Task 1: 门禁误报与离线可用性（P0）

**Files:** `scripts/check-v-html.mjs`、`scripts/check-a11y.mjs`、`.github/workflows/quality-gate.yml`（如需）、相关测试或探针脚本。

**行为要求**
- `check-v-html`：当前用裸 `grep -r "v-html"`，把 `src/components/settings/ThemeSwitcher.vue` 里**注释**中的 "v-html" 判成违规（该处注释恰好说明已移除 v-html）。改为解析 `.vue` 时剥离 HTML 注释（`<!-- ... -->`）再匹配指令用法，或至少排除整行注释；保留对真实 `v-html=` 绑定的检出能力，并加一个"注释不报、真实用法报"的探针证据。
- `check-a11y`：当前 exit 2 要求 Storybook 就绪。给出明确的离线/CI 策略并落地：要么在 `quality-gate.yml` 里真正起 Storybook 后再跑，要么让脚本在 Storybook 不可达时**明确 SKIP 并说明原因**（不静默通过、不假装绿）。选择须在报告里说明。

**验收**：两个探针（注释里写 v-html → OK；新增一处真实 `v-html=` → FAIL）；`node scripts/check-v-html.mjs` 在修后为绿；`check-a11y` 的行为与新策略一致。

---

## Task 2: 通知服务拆分与校验修复（P1）

**Files:** `src/services/matrix/notifications/MatrixNotificationService.ts`（现 867 行）、新增 `src/services/matrix/notifications/` 下的职责模块、对应测试、`src/utils/typeGuard.ts`（若需）、`scripts/file-size-baseline.json`。

**行为要求**
- 把 867 行的 `MatrixNotificationService` 按职责拆到 **< 525 行**（至少拆出：配置持久化/迁移、DND 镜像与冲突规则、展示决策与权限门、推送规则相关）。保持公共 API 签名不变（`getConfig`/`updateConfig`/`setDndSettings`/`syncDnd*`/`shouldNotifyMessage`/`buildNotificationDisplay`/`canSendSystemNotification`/`setEventNotificationEnabled`/`setNotificationKeywords`/`matchesNotificationKeyword` 等），调用点（`messageMutations.ts`、设置页、`SessionBootstrapService.ts`）无需改动。
- 修 `isValidNotificationConfig`：`validateObject(val, [], {...})` 在 `requiredKeys` 为空时**不执行**逐键校验器，导致单字段非法就整份回落。改为显式逐字段校验（非法字段丢弃、其余保留），并补测试：`{ enableDesktop: true, showSender: 'yes' }` → 只丢 `showSender`，`enableDesktop` 保留。
- 损坏配置告警只在首次发现时打印一次（`loadConfig` 每次 `getConfig()` 都会跑，当前每条消息可能重复告警）——加一次性标记或把告警移到迁移/加载的单次路径。

**验收**：`MatrixNotificationService.ts` < 525 行且 `check:file-size` 不再点名它；既有通知测试全绿；新增两条行为测试（逐字段校验、告警一次）RED→GREEN。

---

## Task 3: presence 与未读账本 minors（P1）

**Files:** `src/services/matrix/user/MatrixPresenceService.ts`（或调用点）、`src/stores/domains/chat/sessionUnread.ts`、`src/stores/domains/chat/chat/session.ts`、对应测试。

**行为要求**
- `status_msg`：现在把 `statusMsg ?? ''` 传给 SDK，等于"未指定"时清空服务端状态文本；改为未指定时透传 `undefined`（SDK 会省略该字段），并加测试断言"未传 statusMsg 时不清空、传了才更新"。
- `clearCurrentSessionUnread`：零生产调用方但不推进 `settled` 水位；**若确认仍无调用方则删除该方法**（含 `message.ts` 包装与类型导出）；若保留则让它与 `markRead` 一致地推进水位并补测试。在报告里给出 grep 证据。
- 收敛用例：`sessionUnread.test.ts` 里因 gate 而不再验证 `noNewerMessage` 的那条，改成在 receipts OFF 下真正覆盖"activeTime 变大时不得用更小的服务端值覆盖账本"。
- 给 `markRead` 无条件推进水位加注释说明这是有意行为（跨设备收敛依赖它）。

**验收**：三条行为测试 RED→GREEN；`npx vue-tsc --noEmit` 0 错误；删除/保留决定有 grep 证据。

---

## Task 4: i18n 判活收紧与基线清理（P1）

**Files:** `scripts/check-i18n-dead-keys.mjs`、`scripts/i18n-dead-keys-baseline.json`、`scripts/check-i18n-refs.mjs`（如需）、`scripts/doc-coverage-baseline.json`、`meta/i18n-refs-baseline.json`（如需）。

**行为要求**
- 判活证据从"全仓点分 token 集合"收紧到**翻译调用点**（`t(`/`$t(`/`tc(`/`te(`/`tm(` 的参数），避免注释/URL/普通字符串里的同形 token 把死 key 判活；对无法静态判定的动态族维持现有例外机制与阻塞 delta。收紧后重新核算 dead/dynamic 基线，并报告前后差异（若收紧导致新孤儿出现，逐条核实后删除或说明）。
- `--list` 输出改为**相对仓库根**的路径（当前打印绝对路径）。
- 清理 `scripts/doc-coverage-baseline.json` 里已迁移/已删方法的陈旧条目（如 `MatrixReceiptService.ts::getReadReceipts` 之外的同类），使 ratchet 计数与实际一致（只减不增）。

**验收**：探针（在注释里写一个已删 key 的点分 token → 不再被判活；真实 `t('已删key')` → 判活）；`check:i18n-dead-keys` 与 `check:doc-coverage` 绿；基线计数与实测一致。

---

## Task 5: 守门局限加固（P1）

**Files:** `scripts/check-settings-wiring.mjs`、`scripts/settings-wiring-manifest.json`、`scripts/check-component-contracts.mjs`、`scripts/check-i18n-dead-keys.mjs`、相关基线。

**行为要求**
- settings-wiring 的 consumer 校验：除路径存在外，至少要求 consumer 文件里出现该 key 的**引用形态**（`getItem`/`STORAGE_KEY` 常量/`persist` id 等），并在输出里把"仅路径存在"的条目单列提示；`--update` 前校验 manifest（未登记 key 直接拒绝，不写入）；提供陈旧 manifest 条目的告警或清理入口。
- component-contracts：加 `src/typings/components.d.ts` 的**生成物新鲜度校验**（缺失/未含已知全局组件时给出明确指引而非整体误报），并尽力识别 `<component :is>` 动态挂载（无法识别时至少不把它算作"未使用组件"）。若实现成本过大，给出明确的 SKIP 说明与登记。
- 保持 Task 5 已建立的 ratchet 语义（白名单只减不增、skip 新增即 FAIL、`--update` 拒绝换键）。

**验收**：每个加固点都有"能失败"的探针；三个守门在当前树绿。

---

## Task 6: 组件事件断线分级处置（P2 裁决：能接的接，接不上的删）

**Files:** 见 §13.6 表；`scripts/component-contracts-baseline.json` 与本任务删除的组件/事件相关文件。

**接线（必须做，各带行为测试）**
- `RoomInviteActions::error`：接受/拒绝失败时在组件内部就地给出用户可见反馈（不依赖父级可选回调）。
- `UserMenuHeader::avatar-click`：接"打开个人资料"（复用现有资料弹窗/路由），移动端同样处理。
- `ThreadPanel::sendReply`：接 `matrixThreadService.sendThreadReply`（`MatrixThreadService.ts:67`），发送后清空输入并刷新回复列表（把 `loadThreadReplies` 的 stub 接上 `getThreadRepliesViaApi`）。
- `jump2Reply` 两处真实断线：`src/views/multiMsgWindow/index.vue` 与 `src/views/chatHistory/index.vue` 的 `<RenderMessage>` 补 `@jump2-reply`（与 `ChatMessageList.vue:64-69` 同语义）。

**删除死入口（YAGNI，逐条在提交信息写明依据）**
- `ThreepidManager` 的邮箱/手机增删解绑入口（`AccountSettings.vue` 挂载，零 props/零监听，后端 API 零消费方，输入框清空得像成功但请求从不发出）。若认为保留有价值则必须先接线——但本轮裁决是"接不上就删"。
- `GuestModeBanner`（`isGuestMode`/`guestUserId` 从未置真，永不渲染）+ `layout/index.vue` 挂载与 refs + `MatrixGuestService`（除测试外无引用）。
- `LoginBottomBar::guest-login`（用户可见死入口；同时删除该行与相关 i18n 引用）。
- `SpaceListItemCard::contextmenu`（出生即死；删除 emit 与声明，或改为卡片内 `ContextMenu`——本轮选删除，理由写入报告）。
- `RoomSessionList::batchToggle` + 批量相关 props/emit/复选框分支（无生产入口；移动端有自己的批量实现）。

**验收**：`check:component-contracts` 仍绿（0/0，白名单只减不增，`followUp` 无悬空）；接线项有真实路径行为测试 RED→GREEN；删除项有 grep 证明无残留引用；`npx vue-tsc --noEmit` 0 错误。

---

## Task 7: 测试清理与移动端写回（P1/P2）

**Files:** `src/mobile/views/my/VoiceVideoSettings.vue` 及其测试、`src/mobile/views/my/__tests__/LabsSettings.test.ts`、通知相关测试、`src/components/space/SpaceChildrenPane.vue`、`locales/{zh-CN,en}/friend.json`。

**行为要求**
- 移动端音质开关（回声消除/降噪/自动增益）补 `@change`/写回（经 `mediaDevicePreferences` 或等价的共享读写），并加测试断言切换后持久化；设备选择接入真实通话（`replaceTrack`）**不在本轮**，在 §13 记为 follow-up。
- 清 `LabsSettings.test.ts` 的死脚手架（多余的 `vi.mock('vant')`、`VanSwitchStub`、空转的 toggle-all 循环）。
- 通知相关测试补 `syncDndToAccountData` 打桩，消除 stderr 噪音（`MatrixNotificationService.test.ts` 及其它受影响文件）。
- `handleSelectSpace` 补回 a11y announce（与 `SpaceList.vue:184-189` 同语义）。
- 删除已无引用的 `friend.request.cancel` locale（两语言同步，`gen:i18n` 后 i18n 守门保持绿）。

**验收**：相关测试全绿且输出干净；移动端写回有行为测试；locale 删除后 `check-i18n*` 绿。

---

## Task 8: i18n t() 类型收紧（P1，较大）

**Files:** 自定义 composer 包装（新增 `src/services/i18n/` 或 `src/plugins/i18n` 下的包装）、`src/services/i18n`（`useI18nGlobal`）调用点、类型声明、必要的迁移。

**行为要求**
- 让 `t()` 的 key 参数收紧为 `src/typings/i18n.d.ts` 生成的 key 字面量联合类型，使"引用已删除 key"在 `npx vue-tsc --noEmit` 直接报错（补上真正缺失的静态安全网）。
- 迁移策略要务实：先覆盖 `src/**` 里的 `useI18nGlobal()`/本地 `useI18n()` 使用点；对确实需要动态 key 的地方保留显式 `as` 或专用动态 API（并在类型里标注），不得用 `any`。
- 加一条"能失败"的证据：临时在源码写 `t('不存在的key')` → vue-tsc 报错 → 移除 → 0 错误。

**验收**：`npx vue-tsc --noEmit` 0 错误；探针能失败；运行时不回归（i18n 测试与全量通过）。**若实现成本超出可控范围，停下来报告 BLOCKED 并给出已完成的子集与建议**（不做半成品迁移）。

---

## Task 9: 收尾——文档与全量门禁

**Files:** `docs/mobile-feature-optimization-plan.md` §13、本计划文件、各基线文件。

**行为要求**
- §13 更新为清理后的真实状态：已解决条目移入"已清除"或删除，剩余真实债务（含本计划未覆盖的：`m.read.private` 等后端确认、通知展示配置跨设备（已裁决本机）、`replaceTrack`、`<component :is>`、build 生成物新鲜度、全量退出码等）如实保留。
- 跑全套门禁与全量测试，记录实测输出；`check:file-size` 按"只重构我们弄大的、其余基线化并写明依据"处理；`check:v-html`、`check:a11y` 按 Task 1 结果。
- 提交后准备整分支评审与合并 master。

---

## 执行状态（2026-09-23）

- **Task 1-7：完成**。逐任务提交、评审与 fix 轮记录见
  `.superpowers/sdd/2026-09-23-issues-cleanup/progress.md`。
- **Task 8：DEFERRED**（控制器裁决，走本节允许的 BLOCKED 路径）。未提交半成品迁移；
  自定义 composer 包装与分批迁移的设计要点记入
  `docs/mobile-feature-optimization-plan.md` §13（2）。
- **Task 9：完成** §13 更新、`check:file-size` 基线收口与全量门禁实测；报告见
  `.superpowers/sdd/2026-09-23-issues-cleanup/task-9-report.md`。收尾独立评审后补了一轮
  **fix round**（`e0ccf0f4`、`ea4d2067`，见报告「补记」）：首轮全量暴露的 8 个断言失败
  （Task 3 改了 `status_msg` 透传语义、`usePresenceHeartbeat.privacy.test.ts` 断言未同步）
  与 1 个既有 DND 时间炸弹用例已修；`chatHistory/index.vue` 的日期归一化抽成纯函数，回到
  体积基线内并收紧基线。合并 master `5e9c4b99`（SDK 重钉）后复跑：`vue-tsc` 0 错误、
  `npx vitest run --maxWorkers=2` 805/805 文件、9279/9279 用例通过、0 failed
  （进程仍因 3 个既有 crypto unhandled rejection 以 exit 1 收尾）。
  唯一未修的红色门禁是仓库既有 `check:icon-colors`（`public/icon.js`，与 master 逐字节
  相同、同样 FAIL；修法需设计裁决），详见 §13（4）。
