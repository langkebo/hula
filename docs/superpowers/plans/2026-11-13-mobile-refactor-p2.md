# 移动端 P2 剩余项 实施计划（组件拆分）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 步骤用 `- [ ]` 追踪。

**Goal:** 闭环《移动端界面全面审查报告-2026-11-13》第十六章 P2 中尚未完成的 7 个组件拆分项；P1 清单（53 项）已全部核实完成。

**Architecture:** 纯结构性拆分，不改变任何行为、DOM 语义、class 名、i18n key 与 `data-test*` 属性。父组件保留状态与业务编排，子组件只接收 props / 抛 emits；拆分后单文件行数 ≤ 450。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Vant + UnoCSS + vue-i18n。

## Global Constraints

- 禁止行为变更：拆分前后模板结构、class、文案 key、事件名保持一致。
- 禁止新增硬编码颜色；不新增 admin / AI 依赖；禁止裸 `fetch(`。
- 不新增 i18n key（本批纯搬移）；如确需新增，必须同时写 `locales/zh-CN` 与 `locales/en`。
- 拆分后单文件 ≤ 450 行；父页面保留路由参数、store、service 调用。
- 子组件放在对应域目录下：`src/mobile/components/<domain>/`。
- 不 git commit（由用户决定）。
- 守门命令由主控串行执行，子任务只跑相关单测与 biome。

---

## 已核实为「已完成」的条目（无需改动）

| 编号 | 证据 |
| :-- | :--- |
| C-3 进入房间上报已读 | `MobileChatMain.vue` `switchSession` + `scheduleReadReceipt` |
| C-9 键盘遮挡 | `useViewportInset` + `MobileLayout` `paddingBottom` |
| C-21 keepAlive 重置 | `MobileChatMain.vue` `resetTransientState` + `watch(props.roomId)` |
| R-9 公告阅读数假数据 | `notice/` 目录已无 `128` 常量 |
| Y-2 `dark:invert` 破坏角标 | `components/my/Settings.vue` 已无 `dark:invert`（仅好友列表箭头图片保留，属图片反色） |
| Y-11 在线状态语义 | `StatusSettings.vue` 进入回填 `initialStatusMessage` + `resolveStatusId` |
| Y-13 文件页假数据 | `Files.vue` 改为汇总本地消息 |

---

### Task 1: 拆分 `SpaceView.vue`（608 行）

**Files:**
- Create: `src/mobile/components/space/SpaceCard.vue`
- Create: `src/mobile/components/space/SpaceCreateSheet.vue`
- Modify: `src/mobile/views/space/SpaceView.vue`（目标 ≤ 320 行）

**Interfaces:**
- `SpaceCard` props：`space: { spaceId, name, topic?, avatarUrl?, memberCount, childCount }`；emit `select(space)`。
- `SpaceCreateSheet` props：`show: boolean`；emit `update:show`、`created()`；内部持有表单状态与 `MatrixSpaceService.createSpace` 调用。
- 父组件只保留：列表加载、下拉刷新、空态、点击跳转。

- [ ] 记录拆分前 `pnpm exec vitest run src/mobile` 基线结果
- [ ] 抽取 `SpaceCard.vue`（保留 `v-clickable`、class 名）
- [ ] 抽取 `SpaceCreateSheet.vue`（保留表单校验与成功提示）
- [ ] 父组件改为引用子组件，`wc -l` 确认 ≤ 450
- [ ] 运行相关单测与 `pnpm exec biome check src/mobile/views/space src/mobile/components/space`

**Verify:** `grep -n "SpaceCard\|SpaceCreateSheet" src/mobile/views/space/SpaceView.vue`

---

### Task 2: 拆分 `PersonalInfo.vue`（539 行）

**Files:**
- Create: `src/mobile/components/my/PersonalInfoHeader.vue`
- Create: `src/mobile/components/my/PersonalInfoActions.vue`
- Modify: `src/mobile/components/my/PersonalInfo.vue`（目标 ≤ 300 行）

**Interfaces:**
- `PersonalInfoHeader` props：`userDetailInfo`、`friendUserState`、`currentState`、`isMyPage`、`showSkeleton`；emit `open-qr-code`。
- `PersonalInfoActions` props：`isShow`、`displayResume`、`loading`；emit `edit-profile`。
- 父组件保留缩放/滑入动画 refs 与 `AvatarUtils` 逻辑；动画状态通过 props 下传。

- [ ] 抽取 header 区（头像、昵称、在线状态、账号、二维码入口），保留 `data-testid="personal-info-skeleton-*"`
- [ ] 抽取操作区（简介 + 编辑/二维码按钮）
- [ ] 父组件收敛，确认 ≤ 450 行
- [ ] 运行 `pnpm exec vitest run src/mobile/components/my src/mobile/views/my/__tests__`

**Verify:** `grep -rn "personal-info-skeleton" src/mobile/components/my`

---

### Task 3: 拆分 `ChatSetting.vue`（427 行）

**Files:**
- Create: `src/mobile/views/chat-room/setting/ChatSettingMemberSection.vue`
- Create: `src/mobile/views/chat-room/setting/ChatSettingListSection.vue`（若现有 `components/` 下已有等价子组件则复用，不重复新建）
- Modify: `src/mobile/views/chat-room/ChatSetting.vue`（目标 ≤ 320 行）

**Interfaces:**
- 子组件只接收展示数据与回调 props，不直接调用 service；权限判断仍留在父组件。

- [ ] 阅读现有 3 个子组件（`ChatSetting*`）职责，确定未抽离的成员/列表区
- [ ] 抽取后父组件只保留路由、群资料加载、权限判定与保存动作
- [ ] 运行 `pnpm exec vitest run src/mobile/views/chat-room/__tests__`

**Verify:** `wc -l src/mobile/views/chat-room/ChatSetting.vue`

---

### Task 4: 拆分 `rooms/index.vue`（447 行）

**Files:**
- Create: `src/mobile/views/rooms/RoomListCard.vue`
- Modify: `src/mobile/views/rooms/index.vue`（目标 ≤ 300 行）

**Interfaces:**
- `RoomListCard` props：`room: RoomListItem`（来自 `roomListModel.ts`）；emit `select(room)`、`toggle-favorite(room)`。
- 筛选/排序模型仍由 `roomListModel.ts` 提供，不搬移。

- [ ] 抽取卡片渲染（头像、名称、成员数、时间占位）
- [ ] 保留 `data-testid`（如有）
- [ ] 运行 `pnpm exec vitest run src/mobile/views/rooms`

**Verify:** `wc -l src/mobile/views/rooms/index.vue`

---

### Task 5: 拆分 `rtcCall/index.vue`（485 行）

**Files:**
- Create: `src/mobile/views/rtcCall/RtcCallActionBar.vue`
- Create: `src/mobile/views/rtcCall/RtcCallStatusOverlay.vue`
- Modify: `src/mobile/views/rtcCall/index.vue`（目标 ≤ 320 行）

**Interfaces:**
- `RtcCallActionBar` props：`muted`、`cameraEnabled`、`speakerOn`、`callState`；emit `toggle-mute`、`toggle-camera`、`toggle-speaker`、`hangup`。
- `RtcCallStatusOverlay` props：`peerName`、`callState`、`durationText`、`reconnecting`；无业务调用。
- `reconnecting` 横幅与权限引导文案保留在 overlay 内。

- [ ] 抽取操作栏与状态覆盖层
- [ ] 确认 `prefers-reduced-motion` 样式随组件搬迁
- [ ] 运行 `pnpm exec vitest run src/mobile/views/rtcCall src/services/matrix/media/__tests__`

**Verify:** `wc -l src/mobile/views/rtcCall/index.vue`

---

### Task 6: 拆分 `MobileForgetPassword.vue`（432 行）

**Files:**
- Create: `src/mobile/components/login/ForgetPasswordEmailStep.vue`
- Create: `src/mobile/components/login/ForgetPasswordResetStep.vue`
- Modify: `src/mobile/views/MobileForgetPassword.vue`（目标 ≤ 280 行）

**Interfaces:**
- Step 组件 props：`loading`；emit `submit(payload)`、`back`。
- 父组件保留步骤状态机、倒计时与 `MatrixAuthService` 调用，返回上一步时重置下游状态。

- [ ] 抽取「邮箱 + 验证码」步骤
- [ ] 抽取「新密码」步骤
- [ ] 验证返回上一步会清空验证码与密码输入
- [ ] 运行 `pnpm exec vitest run src/mobile`（无专属用例时至少保证既有用例不回归）

**Verify:** `wc -l src/mobile/views/MobileForgetPassword.vue`

---

### Task 7: 拆分 `MobileRegisterForm.vue`（416 行）

**Files:**
- Create: `src/mobile/components/login/RegisterEmailVerifyStep.vue`
- Modify: `src/mobile/components/login/MobileRegisterForm.vue`（目标 ≤ 320 行）

**Interfaces:**
- 子组件 props：`email`、`code`、`loading`、`countdown`；emit `update:email`、`update:code`、`send-code`、`back`。
- 父组件保留 `isStep2Valid`（含 `emailSessionId && emailClientSecret` 校验）与 `registerAccount` 调用。

- [ ] 抽取第二步邮箱验证表单
- [ ] 确认 L-1 校验逻辑仍生效（`emailSessionId` 为空时不可提交）
- [ ] 运行 `pnpm exec vitest run src/mobile`

**Verify:** `grep -n "emailSessionId" src/mobile/components/login/MobileRegisterForm.vue`

---

## 验收（主控串行执行）

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

1. 本批纯组件搬移，无新增平行实现，无新增 service 调用。
2. 移动端未引入 admin / AI 引用。
3. 无新增依赖，移动端构建路径不变。
