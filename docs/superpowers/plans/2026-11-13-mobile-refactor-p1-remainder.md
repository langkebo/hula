# 移动端 P1 重架构剩余项 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 步骤用 `- [ ]` 追踪。

**Goal:** 闭环《移动端界面全面审查报告-2026-11-13》第十六章剩余 6 组 P1：X-1/X-2、C-4、C-5/X-3、P-2、Q-5/Q-6、F-5。

**Architecture:** 全部能力优先复用既有服务层（`src/services/matrix/**`、`OfflineQueueService`、`src/common/errors.ts`），移动端只新增展示型组件与 composable。不新增平行 API 实现，不裸 fetch，不引入 admin/AI 依赖。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Vant + Pinia + vue-i18n + Vitest。

## Global Constraints

- 移动端禁止 import `@/views/admin`、`@/plugins/robot`、`@/services/matrix/ai`、`@/services/siliconflow`、`@/services/trendradar`。
- 禁止裸 `fetch(`；Matrix 调用必须经服务层或 SDK。
- 禁止新增硬编码颜色，使用 `--tjg-*` token；`.vue` ≤ 800 行。
- 新增文案必须同时写入 `locales/zh-CN` 与 `locales/en`，最后由主控执行 `pnpm gen:i18n`。
- 守门命令串行执行，禁止并行（gen:i18n 会重写 typings 导致 ENOENT）。
- 不 git commit（由用户决定）。

---

### Task 1: 统一移动端三态组件 + 错误文案映射（X-1 / X-2）

**Files:**
- Create: `src/mobile/components/common/MobileAsyncState.vue`
- Create: `src/mobile/composables/useMobileErrorText.ts`
- Create: `src/mobile/components/common/__tests__/MobileAsyncState.test.ts`
- Create: `src/mobile/composables/__tests__/useMobileErrorText.test.ts`
- Modify: `src/mobile/components/message/MobileSessionList.vue`（改用组件）
- Modify: `locales/zh-CN/common.json`、`locales/en/common.json`（如需 `common.load_failed`）

**Interfaces:**
- Produces:
  - `MobileAsyncState` props: `state: 'loading' | 'error' | 'empty' | 'ready'`, `errorText?: string`, `emptyText?: string`, `loadingText?: string`, `minHeight?: string`; emits `retry`; slot `default`（仅 ready 时渲染）、slot `empty`（可选覆盖）。
  - `useMobileErrorText(): { resolve(err: unknown, fallbackKey?: string): string }`，内部 `toAppError` + `resolveDisplayMessage`。

- [ ] 写 `useMobileErrorText` 失败测试（喂 `new Error('network down')` 期望返回非空字符串，喂带 `i18nKey` 的 AppError 期望返回翻译）
- [ ] 运行失败
- [ ] 实现 composable
- [ ] 写 `MobileAsyncState` 渲染测试（loading 渲染 `common.loading`；error 渲染 errorText + 重试按钮，点击 emit retry；empty 渲染 emptyText；ready 渲染 slot）
- [ ] 运行失败 → 实现组件 → 运行通过
- [ ] `MobileSessionList.vue` 三态段替换为 `<MobileAsyncState>`，保持 `data-test` 属性不变（`session-list-loading` / `session-list-error`）

**Verify:** `pnpm vitest run src/mobile/components/common/__tests__ src/mobile/composables/__tests__`；`grep -n "MobileAsyncState" src/mobile/components/message/MobileSessionList.vue`

---

### Task 2: 发送失败消息可删除 + 离线重放失败回写（C-4）

**Files:**
- Modify: `src/composables/app/useOfflineQueueReplay.ts`（永久失败回写 `MessageStatusEnum.FAILED`；`message` payload 增加 `tempMsgId` 回写）
- Modify: `src/composables/chat/useMessageSender.ts`（离线入队 payload 保持 `tempMsgId`；生成稳定 txId）
- Modify: `src/composables/chat/useMsgInputSend.ts`（若需把 txId 传给 `sendWithTracking`）
- Modify: `src/components/common/ContextMenu.vue`（移动分支渲染「删除」项）
- Create: `src/composables/app/__tests__/useOfflineQueueReplayFailure.test.ts`
- Modify: `src/composables/chat/__tests__/`（补 sender/删除用例）

**Interfaces:**
- Consumes: `OfflineQueueService.getQueue()`（含 `status: 'pending' | 'failed'`）。
- Produces: 失败/本地消息长按菜单含 `delete`，删除走本地 `updateMsg` 移除 + 队列 `removeOperation`，**不调用** `recallMessage`（避免 `local-*` 抛错）。

- [ ] 写失败测试：重放函数抛错 → 对应 `tempMsgId` 的消息 `status === FAILED`
- [ ] 写失败测试：`local-*` 消息删除时不触发 `recallMessage`
- [ ] 运行失败 → 实现 → 运行通过

**Verify:** `pnpm vitest run src/composables/app/__tests__ src/composables/chat/__tests__`

---

### Task 3: 待发送/失败队列 UI（C-5 / X-3）

**Files:**
- Create: `src/mobile/components/message/MobileOutboxBar.vue`
- Create: `src/mobile/components/message/__tests__/MobileOutboxBar.test.ts`
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue`（挂载 Outbox 条）
- Modify: `locales/zh-CN/mobile_chat.json`、`locales/en/mobile_chat.json`

**Interfaces:**
- Consumes: `offlineQueueService.getPendingCount()`, `getFailedCount()`, `retryFailed()`, `clearFailed()`, `retryAll()`。
- Produces: `MobileOutboxBar` 无 prop；内部 15s 轮询计数（`onUnmounted` 清理），`failed > 0` 时展示「N 条发送失败」+ 重试/清除。

- [ ] 写测试：mock 服务计数 3/2 → 文案含 2；点击重试调用 `retryFailed`
- [ ] 运行失败 → 实现 → 运行通过
- [ ] 接入 `MobileChatMain.vue`

**Verify:** `pnpm vitest run src/mobile/components/message/__tests__`

---

### Task 4: 空间成员权限管理（P-2）

**Files:**
- Modify: `src/services/matrix/room/MatrixSpaceService.ts`（新增 `removeFromSpace`、`setSpaceMemberRole`，内部复用 `MembershipService.kickUser` / `RoomOperations.setMemberPowerLevel`）
- Create: `src/mobile/components/space/SpaceMemberList.vue`
- Create: `src/mobile/components/space/__tests__/SpaceMemberList.test.ts`
- Modify: `src/mobile/views/space/SpaceView.vue`（成员区改为列表 + 成员操作）
- Modify: `locales/zh-CN/space.json`、`locales/en/space.json`

**Interfaces:**
- Produces:
  - `removeFromSpace(spaceId: string, userId: string): Promise<void>`
  - `setSpaceMemberRole(spaceId: string, userId: string, role: 'admin' | 'moderator' | 'member'): Promise<void>`（admin=100、moderator=50、member=0）
- 权限口径：当前用户 PL ≥ 50 才展示操作入口。

- [ ] 写服务测试：`setSpaceMemberRole('admin')` 调用 `setMemberPowerLevel(...,100)`
- [ ] 写组件测试：PL<50 不渲染操作按钮；PL≥50 渲染
- [ ] 运行失败 → 实现 → 运行通过

**Verify:** `pnpm vitest run src/services/matrix/room/__tests__ src/mobile/components/space/__tests__`

---

### Task 5: 通话权限引导 + 重连状态（Q-5 / Q-6）

**Files:**
- Modify: `src/services/matrix/media/voipTypes.ts`（`CallState` 增加 `'reconnecting'`）
- Modify: `src/services/matrix/media/MatrixVoIPService.ts`（`state` 事件：`Connecting && prevState === 'connected'` → `reconnecting`）
- Modify: `src/mobile/views/rtcCall/index.vue`（权限失败引导 + 重连横幅）
- Create: `src/mobile/views/rtcCall/__tests__/rtcCallState.test.ts`
- Modify: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`（加 `RECORD_AUDIO`）
- Modify: `locales/zh-CN/voip.json`、`locales/en/voip.json`

**Interfaces:**
- Produces: `CallState` 含 `'reconnecting'`；`getUserMedia` 失败分支按 `NotAllowedError` → `voip.errors.mic_permission_denied` + 「去设置」提示。

- [ ] 写测试：状态映射 `('connecting', prev='connected')` → `reconnecting`
- [ ] 运行失败 → 实现 → 运行通过
- [ ] 模板：`state === 'reconnecting'` 显示横幅；权限被拒显示引导文案

**Verify:** `pnpm vitest run src/services/matrix/media/__tests__`；`grep -n RECORD_AUDIO src-tauri/gen/android/app/src/main/AndroidManifest.xml`

---

### Task 6: 好友列表单文件拆分（F-5）

**Files:**
- Create: `src/mobile/composables/friends/useFriendsLocalSearch.ts`
- Create: `src/mobile/composables/friends/useFriendUserSearch.ts`
- Create: `src/mobile/composables/friends/useFriendListLoadState.ts`
- Create: `src/mobile/components/friends/FriendUserSearchResults.vue`
- Create: `src/mobile/components/friends/FriendContactsTab.vue`
- Create: `src/mobile/components/friends/FriendGroupChatTab.vue`
- Modify: `src/mobile/views/friends/index.vue`（收敛到 ≤ 250 行）
- Modify: `src/mobile/layout/__tests__/layoutShell.test.ts`（守卫文件清单同步）
- 保留并通过: `src/mobile/views/friends/__tests__/FriendsIndex.test.ts`

**Interfaces:**
- Consumes: 现有 `useFriends()`、`useServerCapability()`、`mobileFriendViewState`。
- Produces: 三个子组件各自 props/emit 明确；composable 纯逻辑可单测。

- [ ] 先跑现有 `FriendsIndex.test.ts` 基线通过
- [ ] 抽取 composable（无行为变更），跑测试
- [ ] 抽离子组件（无行为变更），跑测试
- [ ] 更新 `layoutShell.test.ts` 文本守卫指向新文件

**Verify:** `pnpm vitest run src/mobile/views/friends/__tests__ src/mobile/layout/__tests__`

---

## 验收（串行）

```bash
pnpm gen:i18n
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check:ratchet
pnpm check:doc-coverage
pnpm check:doc-paths
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
pnpm check
```

## R3 自检

1. 全部复用 SDK/服务层，无新增平行实现（Space 操作复用 MembershipService/RoomOperations；离线复用 OfflineQueueService）。
2. 移动端未引入 admin/AI 任何引用。
3. 移动端构建不受影响（仅新增展示组件与 composable）。
