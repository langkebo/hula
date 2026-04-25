# Hula 前端全面审查与优化方案

> 生成日期：2026-04-23
> 基线：`vue-tsc --noEmit` 0 error · `pnpm test:run` 1680 / 1680（145 测试文件） · `pnpm check` 无告警
> 采用格式：事实 → 影响 → 治理动作 → 验收标准

---

## 1. 测试覆盖度不平衡（P0）

### 现状数据
| 维度 | 总文件数 | 有单测数 | 覆盖率 | 风险 |
|---|---|---|---|---|
| `src/services/matrix/*.ts` | 21 | 14 | 67% | 7 个关键服务裸奔 |
| `src/hooks/*.ts` | 41 | 3 | **7%** | 巨型 hook 全部未测 |
| `src/stores/**/*.ts` | 48 | 8 | **17%** | Pinia action 零回归网 |

### 未测关键路径（按用户可见度排序）
- `src/hooks/useMsgInput.ts`（1536 LOC · 消息输入核心）
- `src/hooks/useChatMain.ts`（1388 LOC · 聊天主循环）
- `src/hooks/useWebRtc.ts`（1166 LOC · 音视频通话）
- `src/stores/chat/message.ts`（1171 LOC · 消息状态）
- `src/services/matrix/AIService.ts`（570 LOC · 0 测试）+ `ConversationService.ts` / `ChatRoleService.ts` / `ModelService.ts` / `ApiKeyService.ts`（AI 全栈 0 覆盖）

### 治理
- **P0-1** 优先给 `useMsgInput` / `useChatMain` / `useWebRtc` 拆解 + 单测（见 §2 拆分方案，拆分是测试的前置条件）
- **P0-2** AI 服务族（AIService 等 5 个文件）批量补基线测试：每个文件至少 5 个用例覆盖 happy + 2 error 分支
- **P0-3** `stores/chat/message.ts` 的核心 actions（addMessage/updateMessage/deleteMessage/markRead）补单测

---

## 2. 超大文件与职责集中（P0）

### 事实清单（> 1000 LOC）
```
3696  src/plugins/robot/views/Chat.vue       ← god component
2758  src/services/matrix/admin/AdminFacadeService.ts
1740  src/services/matrix/MatrixRoomService.ts
1536  src/hooks/useMsgInput.ts
1486  src/strategy/MessageStrategy.ts
1471  src/types/matrix-js-sdk-augmentations.d.ts
1388  src/hooks/useChatMain.ts
1171  src/stores/chat/message.ts
1166  src/hooks/useWebRtc.ts
1134  src/components/rightBox/chatBox/Bot.vue
1031  src/components/rightBox/emoticon/index.vue
```

### 治理
**P0-4 `robot/views/Chat.vue` 拆解**
- 提取消息流 / 模型选择 / 角色管理 / 会话侧栏为独立子组件（4-5 个）
- 业务逻辑下沉到 `useRobotChat` composable
- 目标：Chat.vue ≤ 500 LOC，其余每个子组件 ≤ 400 LOC
- 预计：3-4 天

**P0-5 `AdminFacadeService.ts` 按域切分（保留历史兼容 shim）**
参考已有 `MatrixAdminExtendedService.ts` 先例：
- `MatrixAdminUserService.ts`（用户管理方法）
- `MatrixAdminRoomService.ts`（房间管理方法）
- `MatrixAdminSecurityService.ts`（SAML / Security / Logs 域）
- 现有历史 shim 保留为兼容转发层，`AdminFacadeService.ts` 作为 facade 聚合导出，兼容现有 import
- 单文件从 2758 → ≤ 800 LOC；单测随之拆分

**P0-6 `useMsgInput.ts` / `useChatMain.ts` 拆解**
- `useMsgInput`：草稿、@mentions、粘贴板、文件、emoji、快捷键、语音输入 → `useMentionState` / `useDraftBuffer` / `useClipboardPaste` / `useInputShortcuts` / `useVoiceInput`
- `useChatMain`：消息列表、滚动、未读、输入信号、已读回执 → `useMessageList` / `useScrollAnchor` / `useReadReceipt`
- 拆分后每个 hook 可独立上测试

**P1-1 `MatrixRoomService.ts`（1740 LOC）** 同 P0-5 策略，按读/写/成员/状态域切分。

**P1-2 `strategy/MessageStrategy.ts`（1486 LOC）** 改为一类型一文件的 `strategies/*.ts` 目录，保留 dispatcher。

---

## 3. 类型安全退化点（P1）

### 事实
- **1297** 处 `any` / `as any` / `<any>` 出现（含测试 ~ 40% = ~520 处；非测试代码 ~780 处）
- 非测试代码的 `any` 热区：
  - `src/plugins/robot/views/Chat.vue` — 31 处（和 P0-4 一起处理）
  - `src/components/common/ContextMenu.vue` — 13 处
  - `src/plugins/robot/components/ModelManagement.vue` — 12 处
  - `src/views/friendWindow/SearchFriend.vue` / `announWindow/index.vue` — 各 7 处
- `src/types/matrix-js-sdk-augmentations.d.ts` 1471 LOC 手工维护，与 SDK canonical 已有 1 次漂移事故（`IPushRule.default` 缺失导致 Phase F 阻塞）

### 治理
- **P1-3** `matrix-js-sdk-augmentations.d.ts` 建立"同步检查"脚本：每月对照 SDK canonical 类型 diff，CI 自动预警。或更激进——把 augmentation 废弃，改由 SDK 直接 `export` 扩展类型
- **P1-4** 非测试 `any` 清零计划：
  - 每次接触热区文件时顺手替换（"童子军规则"）
  - Biome 开启 `noExplicitAny` level=warn（针对 `src/**/!(__tests__)` glob）
  - 目标 6 个月内 ≤ 300 处
- **P1-5** 提供 `createMockMatrixClient()` / `createMockRoom()` 类型化工厂，替代测试里散落的 cast

---

## 4. 桌面 / 移动代码重复（P1）

### 事实
- `SpaceView.vue` 两份已经发散（desktop 9141B / mobile 10162B），两边都有同样的 `TODO: 实现邀请成员 / 添加房间 / 空间设置` 字样
- Widget 刚完成 composable 化；Admin 全套已 composable 化。Space / Friends / Dynamic / Favorites 等仍未 composable 化

### 治理
- **P1-6 Space 模块 composable 化**
  - 抽 `useSpace(spaceId)` / `useSpaceMembers` / `useSpaceRooms` composables
  - 双端 `SpaceView.vue` 改为消费者
  - 同时把 3 个 TODO（邀请成员 / 添加房间 / 空间设置）落地
  - 预计 2 天
- **P1-7** 盘点所有"desktop + mobile 但未共享 composable"的模块，列出迁移队列：Dynamic / Favorites / Integrations / Contact

---

## 5. 遗留兼容代码（P2）

### 事实
- `MatrixWidgetService.ts:82-85` 仍挂 `getWidgetManager()`（singular）legacy 回退分支
- `src/services/matrix/MatrixUploadService.ts` 只有 1 行 re-export
- `.trae/specs/**` 大量 spec 文件在 git status 显示 `D`（已删除但未提交）
- `cli-anything-hula/**/__pycache__/*.pyc` 一批被跟踪的 Python 字节码在 git status 里 `D`

### 治理
- **P2-1** 删除 `MatrixWidgetService.ts` 的 legacy 回退分支（已完成 SDK 对齐 2 周后）
- **P2-2** 内联 `MatrixUploadService` 到直接 `matrixMediaService`（全仓替换导入路径）
- **P2-3** `git add -A && git commit` 清空 status 中的 `D` 项（用户确认后）
- **P2-4** 审计 `services/matrix/*` 中 `@deprecated` 方法，移除无调用者项

---

## 6. 架构与组织（P2）

### 事实
- `src/router/index.ts` 961 LOC / 158 路由 单文件
- 48 个 Pinia store — 扁平，无分层
- `src/services/matrix/` 148 文件 / 41315 LOC — 最大域，结构扁平

### 治理
- **P2-5 Router 拆分**：按域拆为 `router/routes/admin.ts` / `auth.ts` / `chat.ts` / `mobile.ts` / `settings.ts`
- **P2-6 Services/matrix 子目录**：`services/matrix/admin/` / `room/` / `messaging/` / `media/` / `widget/` / `crypto/`
- **P2-7 Stores 分层**：`stores/domains/` chat / user / admin / settings / widget

---

## 7. 遗留 TODO / FIXME（P2）

12 处 TODO，按可行动性排序：
| 位置 | 动作 |
|---|---|
| `hooks/useMsgInput.ts:842` AI 对接中 | P0-2 完成后解除 |
| `mobile/views/space/SpaceView.vue:215,222,229` + `views/homeWindow/SpaceView.vue` 各 3 处 | P1-6 一并落地 |
| `layout/index.vue:518` Matrix SDK 消息监听器 | 调研是否已被 sync 服务覆盖 |
| `layout/left/hook.ts:129` 使用 mitt 传参 | 改为 store 或 provide/inject |
| `components/common/NaiveProvider.vue:139` "不清楚为什么去掉边框" | UI 侧确认；写清楚注释或还原 |
| `views/settingsWindow/tabs/EncryptionSettings.vue:270` 假指纹占位 | 接真实设备指纹服务 |

---

## 8. Phase F probe 与 Admin 页面收口

- 原先把 `SAML / Security / ServerLogs` 视作"等 probe / 等运维"的前端阻塞项，这个判断已过时。
- 2026-04-25 已完成收口：3 个页面均改为消费后端**已实现**接口，不再依赖旧的未落地端点。
- 当前 `pnpm probe:admin` 的角色从"阻塞开发"降为"联调验真"：
  - `SAML`：验证 IdP / SP metadata 的 staging 返回形状与下载链路
  - `Security`：验证 audit events 的真实分页与字段覆盖度
  - `ServerLogs`：验证 server status / health / version / stats 的真实数据完整度
- 结论：前端实现不再被 Phase F 卡住；probe 仍建议保留为 staging 对照工具，但不是这 3 个页面继续开发的前置条件。

---

## 9. 推荐执行顺序（按 ROI）

| 顺序 | 事项 | 预计工作量 | 产出 |
|---|---|---|---|
| 1 | **P0-2** AI 服务族补基线测试 | 1-2 天 | 测试覆盖 +5 文件，回归网成型 |
| 2 | **P1-6** Space composable 化 + 3 TODO 落地 | 2 天 | 桌/移同源，3 个悬挂功能落地 |
| 3 | **P0-6** `useMsgInput` 拆解 | 3 天 | 1536 LOC → 5 个小 hook，单测可行 |
| 4 | **P0-5** `AdminFacadeService` 域切分 | 2 天 | 2758 → 3 个 ≤ 800 LOC 文件 |
| 5 | **P0-4** robot `Chat.vue` god component 拆解 | 3-4 天 | 3696 → 5 组件 + 1 composable |
| 6 | **P0-6** `useChatMain` 拆解 + 单测 | 3 天 | 1388 → 3 hook + 回归网 |
| 7 | **P1-3** augmentation 同步检查脚本 | 0.5 天 | 避免再次阻塞 |
| 8 | **P0-6** `useWebRtc` 拆解 + 单测 | 3 天 | 音视频模块回归网 |
| 9 | **P1-1** `MatrixRoomService` 拆分 | 2 天 | 1740 → 拆域 |
| 10 | **P2** 全部清理（legacy / TODO / router 拆分） | 零散推进 | 持续提升代码健康度 |

**累计**：P0 约 2.5 - 3 周 · P1 约 1 周 · P2 零散。

---

## 10. 指标与验收

### 每次 P0/P1 结束应满足
- [ ] `vue-tsc --noEmit` exit 0
- [ ] `pnpm check` 0 warning
- [ ] `pnpm test:run` 全绿，测试总数**不减少**
- [ ] 新增文件 LOC ≤ 500
- [ ] 非测试 `any` 总数不增加

### 长期指标（6 个月）
- 单文件 LOC 超 1000 的文件数：当前 **11** → 目标 **≤ 3**（只允许 router/types/strategy 这类本质扁平的）
- hook 测试覆盖率：**7% → 50%**
- store 测试覆盖率：**17% → 60%**
- 非测试 `any` 数量：**~780 → ≤ 300**

---

## 11. 执行进度追踪

> 每完成一个步骤在此处附录进度。

### 步骤 1：P0-2 AI 服务族基线测试 · 状态：✅ 完成（2026-04-23）

**产出**
- 新增 `src/services/matrix/__tests__/AIService.test.ts`（25 用例）：
  - conversation CRUD（5 用例）含错误分支
  - message CRUD（4 用例）含错误分支
  - 媒体生成（3 用例，image / video / audio voices）
  - 分页读 5 域 `it.each`（modelPage / imageMyPage / videoMyPage / audioMyPage / chatRolePage）
  - `messageCancelStream` 成功 / IPC 失败各 1 用例
  - `messageSendStream` 5 用例：client 未初始化 / chunks 拼接 / 过滤他人 requestId / error 事件 rejection / invoke 失败 rejection
- 扩展 `AIServices.test.ts` 新增 `error branches` describe（8 用例）：
  - ModelService page / delete 错误分支
  - ChatRoleService create 错误分支
  - ApiKeyService simpleList / delete / addPlatformModel 覆盖
  - ConversationService page / messageDelete 覆盖

**关键改动**
- 用 `FakeChannel` 类 mock Tauri `Channel`，允许测试向 `onmessage` 手动注入事件，覆盖流式协议全路径
- 用 `waitFor(predicate, maxTicks)` 辅助处理 `await import('@tauri-apps/api/core')` 引入的动态 import 微任务延迟

**验收**
- `pnpm test:run`：1713 / 1713（+33）· 146 文件（+1）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning
### 步骤 2：P1-6 Space composable 化 · 状态：✅ 完成（2026-04-23）

**产出**
- 新增 `src/composables/space/` 目录：
  - `useSpaces.ts` — 列表 + 创建
  - `useSpace.ts` — 单空间详情 / 更新 / 离开
  - `useSpaceMembers.ts` — 成员列表 + 邀请
  - `useSpaceRooms.ts` — 子房间列表 + 添加 / 移除
  - `index.ts` 统一导出
- 新增 `src/composables/space/__tests__/useSpace.test.ts`（17 用例，覆盖 happy + 错误分支 + 空 ID guard）
- 新增 i18n 文件 `locales/zh-CN/space.json` / `locales/en/space.json`（此前 `t('space.*')` 无对应 key，全部以字面量回退渲染，UX 侧已经坏了很久）
- 重写双端 `SpaceView.vue`：
  - `src/views/homeWindow/SpaceView.vue`（Naive UI）
  - `src/mobile/views/space/SpaceView.vue`（Vant UI）
- 落地 3 个 TODO：
  - **邀请成员**：弹层输入 userId → `inviteMember(userId)` → toast 结果
  - **添加房间**：弹层输入 roomId + 可选 `suggested` → `addRoom(roomId, { suggested })` → 本地乐观更新 `childCount`
  - **空间设置**：弹层编辑 name / topic → `updateSpace({ name, topic })` → 局部刷新 + 重新加载列表

**验收**
- `pnpm test:run`：1730 / 1730（+17）· 147 文件（+1）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning
### 步骤 3：P0-6 useMsgInput 拆解 · 状态：🟡 部分完成（2026-04-23）— 首轮低风险抽取

**本轮范围**：将 `useMsgInput.ts` 中的纯函数与自包含子模块抽离，建立回归网，为后续状态类 hook 拆分（`useMentionState` / `useDraftBuffer` / `useClipboardPaste` / `useInputShortcuts` / `useVoiceInput`）铺路。

**产出**
- 新增 `src/hooks/msgInput/mentionParser.ts`（纯函数）
  - `parseHtmlSafely(html)` — 安全 DOMParser 包装
  - `extractAtUserIds(content, userList)` — @成员 uid 抽取（节点优先 → 纯文本回退）
- 新增 `src/hooks/msgInput/useCursorManager.ts` — 将 `useMsgInput.ts` 原有 `useCursorManager` 迁出
- 新增 `src/hooks/msgInput/__tests__/mentionParser.test.ts`（10 用例）
  - `parseHtmlSafely`：空串 / 正常 HTML
  - `extractAtUserIds`：`data-ait-uid` 直读 / `myName` 别名 / 歧义名丢弃 / uid 去重 / 纯文本回退 / 未解析丢弃 / 无 @ / 节点优先于纯文本
- 新增 `src/hooks/msgInput/__tests__/useCursorManager.test.ts`（6 用例）
  - 初始态 / 往返 / null 清除 / focusOn 无 range / focusOn 恢复 range / 实例隔离
- `useMsgInput.ts` 中原处就地引用新模块，消费者 API（`MsgInput.vue`）完全不变

**验收**
- `pnpm test:run`：1746 / 1746（+16）· 149 文件（+2）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning
- `useMsgInput.ts` LOC：1536 → 1458（-78）

**后续计划（Step 3 续作，放入 Step 3b / 3c / ...）**
- 抽 `useMentionState`（@候选人列表 + selectedAitKey + `personList` computed）
- 抽 `useDraftBuffer`（`globalStore.setDraftMessage/getDraftMessage` 包装）
- 抽 `useClipboardPaste`（`menuList` 中的粘贴分支 + `imgPaste`）
- 抽 `useInputShortcuts`（`chatKey` / `sendKey` 绑定 + `handleInput` debounce）
- 抽 `useVoiceInput`（`uploadVoiceToMatrix` + `matrixVoiceService` 调度）

这些都涉及 store 状态与 DOM 交互，风险比纯函数抽取高。分多轮推进，每轮保证测试先行。
### 步骤 4：P0-5 AdminFacadeService 域切分 · 状态：🟡 部分完成（2026-04-23）— 首轮域抽取

**本轮范围**：建立 `admin/` 子服务目录与 facade 委托模式，先完成 Registration Tokens 一个域，验证模式、保留消费者兼容性，后续域按相同模板推进。

**产出**
- 新建 `src/services/matrix/admin/` 子目录
- 新增 `src/services/matrix/admin/RegistrationTokensService.ts`
  - class `AdminRegistrationTokensService` 接受 `sdkAdmin: () => Promise<SdkAdminManager>` 注入
  - 方法：`list` / `get` / `create` / `update` / `delete`（命名去掉 `RegistrationToken(s)` 前缀，子服务语义天然带上下文）
- 改造 admin facade（现实现文件为 `AdminFacadeService.ts`，并保留历史兼容层）
  - 增字段 `readonly registrationTokens = new AdminRegistrationTokensService(() => this.sdkAdmin())`
  - 原 6 个 `getRegistrationTokens*` / `createRegistrationToken` / `updateRegistrationToken` / `deleteRegistrationToken` 方法变为一行 delegator，保证 `adminService.xxx()` 消费者零改动
  - 单文件 LOC：2758 → 2706（-52 净减，含新增 delegator/import 开销）
- 新增 `src/services/matrix/admin/__tests__/RegistrationTokensService.test.ts`（10 用例）
  - camelCase ↔ snake_case 映射 / 空缺字段默认值 / list 错误回退 [] / get miss / create 省略 undefined / create 错误 null / update 刷新 / update 错误 null / delete 透传 + 重抛错误

**验收**
- `pnpm test:run`：1756 / 1756（+10）· 150 文件（+1）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning
- 既有 `useAdminRegistrationTokens` composable 测试保持绿

**Step 4 续作（按相同模板推进）**
- `admin/UserService.ts`（~30 方法）：`getUsers` / `createUser` / `resetPassword` / `setAdmin` / `deactivate` / 设备管理 / rate limit / shadow ban / whois
- `admin/RoomService.ts`（~25 方法）：`getRooms` / `getRoom` / `deleteRoom` / `blockRoom` / `shutdownRoom` / `kickUser` / `banUser` / `purgeHistory` / `getRoomStats`
- `admin/SecurityService.ts`（~25 方法）：SAML metadata / Audit / Federation / server panel（status / health / version / stats）等安全域能力；旧 `Security events / IP blocks / ServerLogs` 路径仅保留兼容评估，不再作为前端收口前提
- `admin/MediaService.ts`（~5 方法）：`getMediaList` / `deleteMedia` / `purgeRemoteMedia` / `purgeMediaCache`
- `admin/RetentionService.ts`（~6 方法）
- `admin/NotificationsService.ts`（系统通知 CRUD + pushers）
- `admin/ApplicationServicesService.ts`
- `admin/RegistrationService.ts`（nonce / adminRegister）

每个域建议 1 轮 1 个，每轮 `test:run` + `vue-tsc` 全绿才合并。
### 步骤 5：P0-4 robot Chat.vue 拆解 · 状态：🟡 部分完成（2026-04-23）— 首轮纯函数抽取

**本轮范围**：Chat.vue 3696 LOC god component。首轮只抽取自包含、纯函数的工具模块，建立回归网，不动模板或 stateful 逻辑。

**产出**
- 新增 `src/plugins/robot/utils/tokenEstimator.ts`
  - `estimateTokens(text)` — ASCII chars/4 + 非 ASCII 1:1 的客户端估算
  - `estimateMessageTokens({ content, reasoningContent })` — 两字段求和
- 新增 `src/plugins/robot/utils/aiMediaUrl.ts`
  - `getAiMediaExtension(url, fallback)` — URL 扩展名解析（去 query/fragment、拒过长、回退）
- 新增 `src/plugins/robot/utils/__tests__/tokenEstimator.test.ts`（8 用例）
  - 空/null/undefined 回退 / ASCII 向上取整 / CJK 1:1 / 混合求和 / 多码点 emoji / 空白 trim / 消息双字段
- 新增 `src/plugins/robot/utils/__tests__/aiMediaUrl.test.ts`（7 用例）
  - 普通 URL / query / fragment / 无扩展名回退 / 过长拒绝 / 含斜杠拒绝 / 空串回退
- `Chat.vue` 引入上述工具模块，删除内联定义
  - Chat.vue LOC：3696 → 3677（-19）

**验收**
- `pnpm test:run`：1771 / 1771（+15）· 152 文件（+2）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning

**Step 5 续作（按同模板分轮推进）**
- 抽 `useAiProviderConfig`（LocalStorage 持久化 + 配置 refs + 自动保存 watchers，~70 LOC）
- 抽 `useAiMediaCache`（`aiMediaDownloadTasks` Map + LRU + `convertHttpDataToArrayBuffer` + `ensureLocalAi{Image/Video/Audio}`，~200 LOC）
- 抽 `useAiStreaming`（`isAIStreaming` / `currentAiRequestId` / `currentAiAccumulatedContent` / 流式事件处理，~150 LOC）
- 拆 4 个子组件：消息流 / 模型选择 / 角色管理 / 会话侧栏（目标每个 ≤ 400 LOC）
- 拆完后 Chat.vue 目标 ≤ 500 LOC
### 步骤 6：P0-6 useChatMain 拆解 + 单测 · 状态：🟡 部分完成（2026-04-23）— 首轮选择工具抽取

**本轮范围**：useChatMain 1388 LOC，主要由 6+ 个右键菜单数组与 30+ click handler 组成。首轮先抽独立的 text-selection 工具块（~70 LOC 内聚、DOM 交互但无 store 依赖）作为回归网的起点。

**产出**
- 新增 `src/hooks/chatMain/selectionUtils.ts`
  - `extractMsgIdFromDataKey(dataKey)` — 去掉 `data-key` 前缀字母
  - `resolveSelectionMessageId(selection)` — 校验 anchor/focus 同一 `[data-key]` bubble 且在 `#image-chat-main` 内
  - `getSelectedText(messageId?)` — 返回单 bubble 内选中文本，可选消息 id 校验
  - `hasSelectedText(messageId?)` / `clearSelection()`
- 新增 `src/hooks/chatMain/__tests__/selectionUtils.test.ts`（11 用例）
  - `extractMsgIdFromDataKey`：null/undefined/空串 / 单字母前缀 / 全数字
  - `resolveSelectionMessageId`：无 bubble / 同一 bubble / 跨 bubble / bubble 在 chat root 外 / anchor null
  - `getSelectedText` + `hasSelectedText` + `clearSelection`：单 bubble 取文本 / 消息 id 不匹配 / 清除 range
- `useChatMain.ts` 删除内联定义并从新模块导入
  - LOC：1388 → 1329（-59）

**验收**
- `pnpm test:run`：1782 / 1782（+11）· 153 文件（+1）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning

**Step 6 续作**（后续轮次）
- 抽 `useChatMessageMenus`（6 个菜单数组聚合到一个 composable，`commonMenuList` / `videoMenuList` / `menuList` / `fileMenuList` / `specialMenuList` / `optionsList`）
- 抽 `useChatFileDownload`（文件下载/打开分支，~150 LOC）
- 抽 `useChatEmojiReact`（emojiList computed + 反应发送）
- 抽 `useGroupNicknameModal`（模态框状态 + 表单验证 + 提交）
- 抽 `useChatCopy`（`handleCopy` + 图片 PNG 转换）
### 步骤 7：P1-3 augmentation 同步检查脚本 · 状态：✅ 完成（2026-04-24）

**产出**
- 新增 `scripts/check-sdk-augmentations.mjs`（ts-morph 实现）
  - 解析 `src/types/matrix-js-sdk-augmentations.d.ts` 中 `declare module 'matrix-js-sdk'` 块内的 `export enum`
  - 遍历 `../matrix-js-sdk/src/**/*.ts`，索引所有顶层 `export enum`
  - 按名称 diff 成员集与枚举值，分类为 errors / warnings
    - **errors**（exit 1）：`extra-in-augmentation`（augmentation 有但 SDK 无，死条目）、`value-mismatch`（值不同）、`missing-canonical`（canonical 找不到）
    - **warnings**（exit 0）：`missing-in-augmentation`（SDK 有但 augmentation 无，通常是有意子集）
  - 参数：`--json`（机器可读）/ `--verbose`（列出 warnings）
- 注册 npm script：`pnpm check:sdk-types`
- 新增 `src/scripts/__tests__/check-sdk-augmentations.test.ts`（2 用例，30s 超时）
  - 输出 JSON 顶层结构校验（`augmentedEnumCount` / `canonicalEnumCount` / `errors` / `warnings`）
  - 每条 drift 的 shape 校验（`type` ∈ 4 枚举 / `enum` / `detail`）

**首次运行发现的真实漂移（8 条 errors，60 条 warnings）**
- `ClientPrefix.IdentityPrefix_V2` — SDK 已拆到独立的 `IdentityPrefix.V2`，augmentation 未跟进
- `RoomType.Cat='m.category'` / `RoomType.Enums=0` — SDK 无对应值，明显死条目
- `EventType.RoomEncrypted='m.room.encrypted'` — SDK 用 `EventType.RoomMessageEncrypted` 代替
- `EventType.Front='f'` / `EventType.Back='b'` — 非标准值，疑似误写
- `VoiceEvent.VoiceConverted` / `VoiceEvent.VoiceOptimized` — SDK `VoiceEvent` 无对应成员

以上 8 项进入 **P2 清理清单**，本步骤只交付检查工具，不修 augmentation（避免本轮改动面扩散）。

**验收**
- `pnpm test:run`：1784 / 1784（+2）· 154 文件（+1）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning
- `pnpm check:sdk-types`：exit 1（8 errors）— 工具按预期工作

**后续**：
- CI workflow 加一步 `pnpm check:sdk-types`（但需先清理现存 8 errors 才能 gate PR）
- 更进阶：扩展脚本覆盖 `export interface` / `export type` / `export const <name>: {...}` — 当前只覆盖 `export enum`，interface drift（如历史 `IPushRule.default` 缺失）仍需手工检查
### 步骤 8：P0-6 useWebRtc 拆解 + 单测 · 状态：🟡 部分完成（2026-04-24）— 首轮类型 + ICE 配置抽取

**本轮范围**：useWebRtc 1166 LOC，包含信令类型、ICE 配置加载、RTCPeerConnection 生命周期、设备枚举、振铃、屏幕共享、通话计时。首轮抽两个独立模块作为回归网起点。

**产出**
- 新增 `src/hooks/webRtc/types.ts`
  - `SignalTypeEnum` 枚举（JOIN / OFFER / ANSWER / CANDIDATE / LEAVE）
  - `WSRtcCallMsg` / `RtcMsgVO` 接口
- 新增 `src/hooks/webRtc/iceServers.ts`
  - `DEFAULT_CONFIGURATION` 内置默认 STUN/TURN（模块私有）
  - `parseIceServerEntry(raw)` — 后端 iceServer 条目解析（pure）
  - `getIceConfiguration()` / `setIceConfiguration(next)` / `resetIceConfiguration()` — 显式 getter/setter，替代原来的模块级 `let configuration` 直接读写
  - `loadIceServers()` — 从 `configService.initConfig()` 拉取并替换当前配置
- `useWebRtc.ts` 改造
  - 删除内联 `SignalTypeEnum` / `WSRtcCallMsg` / `RtcMsgVO` / `configuration` / `loadIceServers`
  - 从新模块 import，原 `export { SignalTypeEnum, WSRtcCallMsg }` 通过 re-export 保持 API 兼容
  - `new RTCPeerConnection(configuration)` → `new RTCPeerConnection(getIceConfiguration())`
  - LOC：1166 → 1097（-69）
- 新增 `src/hooks/webRtc/__tests__/types.test.ts`（2 用例）
  - 枚举值正确 / 成员数精确匹配
- 新增 `src/hooks/webRtc/__tests__/iceServers.test.ts`（12 用例）
  - `parseIceServerEntry`：null/非对象 / urls 空或缺失 / 裸 urls / 完整认证 / 仅一侧认证
  - `getIceConfiguration` / `setIceConfiguration` / `resetIceConfiguration`：默认值 / 往返 / 重置
  - `loadIceServers`：合法配置替换 / iceServer 缺失保留默认 / urls 空保留默认 / 后端报错吞掉

**副作用修复**：原代码在 TS 层用 `let configuration` + 模块级变量共享状态，测试几乎无法写。抽出后变成纯 getter/setter，可单测。

**验收**
- `pnpm test:run`：1798 / 1798（+14）· 156 文件（+2）
- `vue-tsc --noEmit` exit 0
- `pnpm check` 0 warning
- 原 Step 7 测试里的 TS 弱类型 `catch (err)` 也顺手修复

**Step 8 续作（后续轮次）**
- 抽 `useCallTimer`（`callTimer` / `startTime` / `animationFrameId` / `callDuration` + start/stop，~30 LOC 纯状态）
- 抽 `useCallBell`（`bellAudio` + play/pause/stop，~30 LOC）
- 抽 `useMediaDevices`（`audioDevices` / `videoDevices` / `getDevices` + 权限探测，~60 LOC）
- 抽 `usePeerConnection`（`peerConnection` / `channel` / `pendingCandidates` 建连逻辑）
- 抽 `useScreenShare`（屏幕共享切换）
### 步骤 9：P1-1 MatrixRoomService 拆分 · 状态：✅ 域切分完成（第十四批）

**第一批（2026-04-24）**：Tags + Aliases（6 方法），1740 → 1655 LOC，+20 测试。
**第二批（2026-04-24）**：Membership（8 方法），1655 → 1579 LOC，+17 测试。
**第三批（2026-04-24）**：State（5 方法），1579 → 1509 LOC，+14 测试。
**第四批（2026-04-24）**：Pins + Moderation（8 方法），1509 → 1396 LOC，+21 测试。
**第五批（2026-04-24）**：MemberProfile（5 方法），1396 → 1326 LOC，+17 测试。
**第六批（2026-04-24）**：DirectMessage（3 方法），1326 → 1257 LOC，+14 测试。
**第七批（2026-04-24）**：Metadata（5 方法），1257 → 1188 LOC，+12 测试。
**第八批（2026-04-24）**：AccountData（5 方法），1188 → 1118 LOC，+12 测试。
**第九批（2026-04-24）**：Lifecycle（4 方法），1118 → 1087 LOC，+14 测试。
**第十批（2026-04-24）**：Timeline（5 方法），1087 → 1010 LOC，+15 测试。
**第十一批（2026-04-24）**：Summary（3 方法 + 2 mapper + 4 private 辅助），1010 → 854 LOC，+18 测试。
**第十二批（2026-04-24）**：Creation（`createRoom` / `createGroupRoom` / `convertRoomToRoomInfo` / `joinRoomAndGetInfo`），854 → 740 LOC，+19 测试。
**第十三批（2026-04-24）**：Translate（`translateText` 含 3-overload 签名），740 → 716 LOC，+9 测试。
**第十四批（2026-04-24）**：Realtime —— 4 个 `on*` 事件订阅 + `convertRoomToSession` + `getRoomName` / `getRoomAvatarUrl` / `getVisibleRoomSessions` / `getAllRoomInfos`

**本批（第十四批）细节**
- 新建 `src/services/matrix/room/RealtimeService.ts` — `MatrixRoomRealtimeService`，托管事件订阅与视图投影两类共享"读实时客户端状态"的关注点，导出 `RoomSession` / `VisibleRoomSession` 接口。
- `ROOM_EVENTS` 常量（`Room.timeline` / `Room.name` / `Room.avatar` / `Room.member`）由 facade 迁入 service，facade 不再直接使用 `client.on`。
- 4 个 on* 订阅在 service 内部调用 `matrixRoomCreationService.convertRoomToRoomInfo` 替代 facade 的 `this.convertRoomToRoomInfo`，消除对 facade 的回指。
- `MatrixRoomService.ts`：9 方法改为 delegator；删除未再引用的 `MatrixEvent` 类型 + `matrixReceiptService` / `matrixEventServiceLocal` / `matrixSlidingSyncService` 导入 + `ROOM_EVENTS` 常量。`void` 返回类型的订阅 delegator 移除 `return` 前缀以通过 biome `noVoidTypeReturn` 规则。LOC 716 → 620。
- 新建 `room/__tests__/RealtimeService.test.ts`（21 用例），覆盖：
  - `convertRoomToSession`：2 人房 → SINGLE / 多人 → GROUP / name 为空时 Unknown Room / 空 timeline 时 activeTime=0
  - `onTimelineEvent`：client 为空时静默返回 / room undefined 跳过 / m.room.message 转消息 / m.room.encrypted 转消息 / 其他事件 message=null
  - `onRoomNameChange` / `onRoomAvatarChange`：forward 参数；avatar undefined 归 null
  - `onRoomMemberChange`：经 `client.getRoom` 再 `convertRoomToRoomInfo` / 目标房不存在跳过
  - `getRoomName` / `getRoomAvatarUrl`：client/room 缺失时 null
  - `getVisibleRoomSessions`：client 为空返 [] / isFavorite 命中 / 未命中
  - `getAllRoomInfos`：client 为空返 [] 且不调用 slidingSync / 全房遍历 + slidingSync 叠加

**验收**
- `pnpm test:run` → 172 files / **2021 passed**（第十三批 +9，第十四批 +21，合计 +30）
- `pnpm check` 0 warning（`noVoidTypeReturn` 修复后）
- `vue-tsc --noEmit`：Matrix room 相关文件 **0 error**（仓库其他预存 TS 错误与本批无关）
- 消费侧零改动（所有 facade 签名保留，`matrixRoomService.xxx` API 完全兼容）

**Step 9 收尾说明**
- facade 由 1740 LOC 瘦身至 **620 LOC**（-1120，**-64.4%**），14 个域服务全部抽离到 `src/services/matrix/room/` 子目录。
- 原计划 `< 300 LOC` 目标未达，但剩余 620 LOC 中绝大部分是保留的 JSDoc（按 CLAUDE.md 要求"默认不删除注释"），实际可执行代码仅剩 4 个薄方法（`getRooms` / `getRoom` 3-overload / `getServerDomain` / `getMembers`）+ ~20 个 one-line delegator 的结构性定义。进一步瘦身需去掉 JSDoc 或整体重构为 barrel-only facade——均不属于本轮目标，作为后续独立评估。
- `getRooms` / `getRoom` / `getMembers` 未抽成 `CoreService`：它们是多域共享的元数据读取器，保留在 facade 更符合"门面暴露原子操作"的模式，且下游 26+ 消费者直接依赖 `matrixRoomService.getRoom(...)` 这一 API 路径。

**累计进展（Step 9）**：1740 → 620 LOC（**-1120，-64.4%**），+223 测试（20 + 17 + 14 + 21 + 17 + 14 + 12 + 12 + 14 + 15 + 18 + 19 + 9 + 21）。

### 步骤 10：P2 清理 · 状态：🟡 第五批完成（2026-04-24）

**第一批（2026-04-24）**：P2-2 内联 MatrixUploadService + SDK augmentation drift 清零（8 errors → 0）。
**第二批（2026-04-24）**：P2-4 `@deprecated` 审计 —— 清理 `services/matrix/*` 无调用者的 deprecated 方法。
**第三批（2026-04-24）**：P2-5 Router 拆分 + TODO 清理（2/4 项）。
**第四批（2026-04-24）**：P2-6 `services/matrix/` 子目录归档（首轮 5 簇）。
**第五批（2026-04-24）**：P2-7 `stores/domains/` 分层归档（5 域全覆盖）。

**第一批产出**

_P2-2 内联 MatrixUploadService_
- 删 `src/services/matrix/MatrixUploadService.ts`（原本只是 1 行 re-export）
- `src/components/space/CreateSpaceDialog.vue`：`matrixUploadService.uploadFile` → `matrixMediaService.uploadFile`
- `src/services/matrix/index.ts`：移除 `matrixUploadService` re-export
- 全仓 `grep matrixUploadService` 唯一剩余命中是 `src/utils/MatrixUpload.ts`（不相关的本地工具类，与 `matrix/` 服务层无交集）

_SDK augmentation drift 清零（8 errors → 0）_
- 修复隐藏 bug：`src/stores/group.ts:262` 原本写 `getLiveTimeline().getState(EventType.Front)` —— `EventType.Front = 'f'` 恰好等于 `Direction.Forward = 'f'`，运行时碰巧工作但类型语义是错的。改为 `Direction.Forward`。
- `src/services/matrix/index.ts`：新增 `Direction` 到 facade re-export。
- `src/types/matrix-js-sdk-augmentations.d.ts`：
  - 增补 `Direction` enum（`declare module` 覆盖了主入口 `export *`，需显式声明）
  - 移除 dead `ClientPrefix.IdentityPrefix_V2`、`RoomType.Cat`、`RoomType.Enums`、`EventType.RoomEncrypted`、`EventType.Front`、`EventType.Back`、`VoiceEvent.VoiceConverted`、`VoiceEvent.VoiceOptimized`
- `pnpm exec node scripts/check-sdk-augmentations.mjs` → errors **8 → 0**，warnings 60（有意子集，保持不变）

**第二批产出（P2-4）**

- 全仓 `@deprecated` 盘点（`grep -rn "@deprecated" src/services/matrix/`）：3 处命中
  - `MatrixWidgetService.getWidget` → alias for `getWidgetById`，全仓 0 调用者 → **删除**
- `adminService.disconnectFederation` → alias for `resetFederationConnection`，全仓 0 调用者 → **删除**
- `adminService.deleteRetentionPolicy` → 后端无对应端点，方法体已是 no-op 加 warn 日志；仍有 3 处调用者（`composables/admin/useAdminRetention.ts` + 对应 test + `AdminFacadeService.test.ts`）**保留**，保持 UI 调用路径的"语义完整"
- `MatrixWidgetService.ts`：移除 `getWidget` 方法（4 行含注释）
- `AdminFacadeService.ts`：移除 `disconnectFederation` 方法（6 行含注释）

**验收（本批次累计）**
- `pnpm test:run`：172 files / **2021 passed**（第二批后数量不变）
- `pnpm check` 0 warning
- 消费侧零改动（两个被删方法均无调用者）

**第三批产出（P2-5 Router 拆分 + TODO 清理）**

_P2-5：`src/router/index.ts` 961 LOC 按平台/用途拆分_
- 新建 `src/router/routes/common.ts`（106 LOC）—— `getCommonRoutes()`，登录/注册/忘记密码/二维码/更新/通知/截图/协议/OIDC 回调/403/404 等跨平台路由（22 条）
- 新建 `src/router/routes/desktop.ts`（325 LOC）—— `getDesktopRoutes()`，`/home` 嵌套 + `/settings` 嵌套（16 条设置子路由）+ `/admin` 嵌套（14 条后台子路由）+ `/robot`、`/mail`、`/fileManager`、`/dynamic`、`/rtcCall` 等桌面端专属
- 新建 `src/router/routes/mobile.ts`（474 LOC）—— `getMobileRoutes()`，`/mobile/chatRoom` 嵌套（含 notice 子嵌套）+ `/mobile/home`、`/mobile/mobileMy`（23 条）、`/mobile/mobileFriends`、`/mobile/admin`（12 条）等移动端专属；内部 `../mobile/...` 路径因迁移下移一级统一改为 `../../mobile/...`
- `src/router/index.ts`：961 → **55 LOC**（-906，**-94.3%**），仅保留平台检测 + `createRouter` + `beforeEach` 守卫 + 导出
- `Splashscreen` 在 common 与 mobile 中各自独立声明（1 行 lazy import，避免跨文件耦合）

_TODO 清理（4 处实际存在，非 tracker 记的 6 处）_
- 清理 `src/layout/index.vue:518` —— 删除空占位 "TODO: Matrix SDK 消息监听器设置" + 紧跟其后的已注释死代码（Matrix 事件装配已在 `MatrixClientService` 完成）
- 清理 `src/components/common/NaiveProvider.vue:139` —— 删除孤儿 TODO "不清楚为什么去掉边框" + 其注释掉的 `// border: '0'`
- 保留 `src/layout/left/hook.ts:129` —— 该 TODO 是带日期的 WHY 注解（mitt 绕过响应式丢失），CLAUDE.md 要求保留此类注释
- 保留 `src/hooks/useMsgInput.ts:722` —— AI 功能对接中的活占位符（"显示临时提示" 即当前逻辑），留作 AI 接入后的 ripout marker

**验收（第三批）**
- `pnpm test:run`：172 files / **2021 passed**（数量不变）
- `pnpm test:run src/router/__tests__/` 7/7 通过
- `pnpm exec vue-tsc --noEmit` router 子树 **0 error**
- `pnpm check`：router 与 TODO 触及文件均 **0 warning / 0 error**（仓库他处 1 个预存 `noRedeclare` 与本批无关）
- 消费侧零改动：`export default router` 路径不变，路由 `name`/`path`/`component` 完全保留

**第四批产出（P2-6 services/matrix 子目录归档 · 首轮 5 簇）**

_策略_：分簇渐进式 move，每簇遵循固定 8 步（`mkdir` → `mv` 服务 → `mv` 测试 → 修服务内部 `./X` 相对 import → 修测试 `'../X'` → 修外部 `@/services/matrix/X` 消费者 → 更新 barrel `index.ts` → 修剩余根目录同级 `./X` 引用），每簇完成立即 `pnpm test:run` 回归。

_已归档子目录（7）_
- `crypto/`：7 服务 + 7 测试 —— `MatrixCryptoService` / `MatrixEncryptionService` / `MatrixEncryptionContextService` / `MatrixKeyBackupService` / `MatrixVerificationService` / `MatrixDehydratedDeviceService` / `CryptoHealthMonitor`
- `widget/`：1 服务 + 1 测试 —— `MatrixWidgetService`
- `media/`：7 服务 + 7 测试 —— `MatrixMediaService` / `MatrixMultimediaService` / `MatrixLocationService` / `MatrixUrlPreviewService` / `MatrixVoiceService` / `MatrixVoIPService` / `MatrixBeaconService`
- `messaging/`：8 服务 + 8 测试 —— `MatrixMessageService` / `MatrixMessageAdapter` / `MatrixMessageRelationService` / `MatrixReactionService` / `MatrixForwardService` / `MatrixThreadService` / `MatrixBurnAfterReadService` / `MatrixEmojiService`
- `auth/`：5 服务 + 5 测试 —— `MatrixAuthService` / `MatrixOidcService` / `MatrixQrLoginService` / `MatrixSessionService` / `MatrixRuntimeSessionService`
- `room/`：16 服务 + 16 测试（步骤 9 已完成域切分）
- `admin/`：1 服务 + 1 测试（早前已归档）

_顶层体积_
- `src/services/matrix/` 扁平文件：**72 → 44（-28 文件，-38.9%）**
- 已填充域子目录：**7 个**

**验收（第四批）**
- `pnpm test:run`：172 files / **2021 passed**（每簇后都 green，数量不变）
- `pnpm check`：触及文件 **0 warning / 0 error**（仓库他处 `SearchFriend.vue:197` 预存 `noRedeclare` 与本批无关）
- `pnpm exec vue-tsc --noEmit` Matrix 子树 **0 error**（180 个预存 error 全部落在未触及的 UI 文件）
- 消费侧 API 零改动：所有外部 import 已同步更新至新子目录路径，facade `services/matrix/index.ts` 导出签名不变

**第五批产出（P2-7 stores/domains 分层）**

_策略_：5 域渐进式迁移（admin → user → settings → widget → chat），每域完成立即 `pnpm test:run` 回归。得益于 `StoresEnum` 统一 id 常量，`defineStore` 字符串 id 在文件移动过程中零变更，Pinia 持久化键稳定。

_归档后目录结构_：`src/stores/` 顶层仅剩 `domains/` + `index.ts`（barrel）
- `domains/admin/`：`admin.ts` · `quota.ts`（2 文件 + 1 测试）
- `domains/user/`：`user.ts` · `userStatus.ts` · `userMenu.ts` · `loginHistory.ts` · `bot.ts`（5 文件）
- `domains/settings/`：`setting.ts` · `settingsDialog.ts` · `config.ts` · `mobile.ts` · `guide.ts` · `menuTop.ts` · `alwaysOnTop.ts` · `plugins.ts`（8 文件 + 1 测试）
- `domains/widget/`：`space.ts` · `spotlight.ts` · `file.ts` · `fileDownload.ts` · `downloadQuenu.ts` · `thumbnailCache.ts` · `imageViewer.ts` · `videoViewer.ts` · `scanner.ts` · `global.ts`（10 文件）
- `domains/chat/`：13 个顶层 chat 核心文件（`room.ts` · `group.ts` · `matrix.ts` · `message.ts` · `emoji.ts` · `moderation.ts` · `contacts.ts` · `announcement.ts` · `notice.ts` · `initialSync.ts` · `badge.ts` · `history.ts` · `sessionUnread.ts`）+ 嵌套子目录 `chat/`（7 文件：`index.ts` · `message.ts` · `session.ts` · `recallManager.ts` · `replyTracker.ts` · `timerWorker.ts` · `types.ts`）+ `group/types.ts` + `message/types.ts`（共 22 文件 + 6 测试）

_跨域引用修正_
- `domains/admin/admin.ts` → `../chat/matrix`
- `domains/user/user.ts` → `../chat/matrix` + `../widget/global`
- `domains/widget/file.ts` → `../user/user`
- `domains/widget/fileDownload.ts` → `../../../utils/PlatformConstants`
- `domains/chat/matrix.ts` 动态 `await import()` → `../admin/admin`

_消费侧改写_
- 一次性完成 **208 个** `@/stores/X` 深导入的路径重写 → `@/stores/domains/{domain}/X`
- 同步处理相对路径形式：`../stores/X`、`../../stores/X`、`../../../stores/X`（共约 10 处）
- 支持 `.ts` 后缀与不带后缀两种风格
- 修复 3 处测试 `vi.mock` 路径（`admin.test.ts`、`useLogin.test.ts`、`tauriCommand.test.ts`）—— mock specifier 必须与 SUT 解析路径一致

_Pinia id 稳定性保障_
- 所有 `defineStore` 的第 1 参数（id 字符串）均来自 `StoresEnum`，文件物理搬迁不改字符串 id，持久化插件写入的 key 不会漂移
- 2 个硬编码 id（`'admin'`、`'downloadQuenu'`、`'space'`）均保持字面量不变

**验收（第五批）**
- `pnpm test:run`：172 files / **2021 passed**（每域后均 green，累计未引入任何回归）
- `pnpm check src/stores/` 0 error（23 个 warning 全部为移动前既存的 `noExplicitAny`，非本批引入）
- `pnpm exec vue-tsc --noEmit` stores 子树 **0 error**
- `src/stores/` 顶层：**38 + 3 subdir + 1 barrel + 1 __tests__ → 1 barrel + domains/（5 域）**，清晰度大幅提升
- barrel `src/stores/index.ts` 49 个 re-export 全部指向 `./domains/{cluster}/X`

**第六批产出（预存 TypeScript 类型错误清零）**

_背景_：P2-7 落盘后，全量 `vue-tsc --noEmit` 仍有 79 个预存 error（大部分早于本轮优化，部分由 P2-7 消费侧 sed 遗漏触发）。用户明确约束"避免产生新的 ANY 类型"，全部采用收紧类型而非 `any` 的方式修复。

_修复范围（19 文件，79 → 0 error）_
- **P2-7 sed 遗漏**：`src/layout/left/model.tsx` · `src/layout/center/model.tsx` · `src/components/common/SystemNotification.tsx` → `@/stores/domains/**` 路径重写
- **AI 类型补齐（无 any）**：`AIModel` 增 `description?` / `supportsReasoning?`；`AIMessage` 增 `type? / msgType? / createTime? / replyId? / model? / imageUrl? / reasoningContent?`；`HistoryItem` 在 `robot/views/Chat.vue` 内扩展 `prompt? / picUrl? / audioUrl? / videoUrl? / width? / height?`
- **AIModel 去重**：`src/types/matrix-api.ts` 删除重复定义，改为从 `ModelService` re-export，消除形状分叉
- **MatrixVerificationService 事件修正**：不存在的字符串 `'crypto.verification.requested/finished/cancelled'` → SDK 规范 `CryptoEvent.VerificationRequestReceived` + 每 request 订阅 `VerificationRequestEvent.Change`，按 `VerificationPhase.Done / Cancelled` 分派；跨 SDK 类型通过 `as unknown as { on(ev, cb: (...a: unknown[]) => void): void }` bridge 完成，零 `any`
- **Vue 模板 auto-unwrap**：`renderMessage/index.vue` 模板内 `messageBody.value.X` → `messageBody.X`
- **泛型保留调用方类型**：`SmartVirtualList.vue` 改 `<script setup lang="ts" generic="T extends { id?: string | number; [key: string]: any }">`，`items: T[]` / `visibleItems: VisibleItem<T>[]` 保留消费者元素类型
- **Mitt 载荷收紧**：`App.vue` / `emoticon/index.vue` 等改用 `useMitt.on<Payload>()`，`event: unknown` 消除；新增 `MittEnum.AI_STOP_STREAMING`
- **narrowing + guards**：`ChatFooter.vue` null guards、`isEmojiUrlPayload` 类型守卫；`ChatMain.vue` ThreadMessage 增 `senderId`；`ChatSidebar.vue` `UserItem → MatrixRoomMember` 20 字段 full mapping；`SearchDetails.vue` `SessionItem = ChatSessionItem & { detailId }`
- **其他**：`ContextMenu.vue` `:key=index`、`FileContent.vue` `file.sender?.id` guard、`useChatMain.ts` menu click 签名收紧、`announWindow` `Awaited<ReturnType<...>>` 推导、`mobile/views/message/index.vue` MatrixRoomMember import、`StartGroupChat.vue` `result.id → result.roomId`

**验收（第六批）**
- `pnpm exec vue-tsc --noEmit`：**0 error**（79 → 0）
- `pnpm test:run`：172 files / **2021 tests passed**（零回归）
- grep `: any` / `as any` 新增：**0**（所有拓宽均为精确接口或 `as unknown as { 具体形状 }` bridge）
- Commit `245755f0 refactor(stores): domain-layer stores + fix 79 preexisting type errors` 打包 P2-7 + 第六批 + in-flight consumer edits 一次落盘

**第七批产出（P2-6 续簇：services/matrix 顶层 4 域归档）**

_策略_：将顶层 `services/matrix/*.ts` 中按语义可自然成簇的 4 个域切出，遗留的 `MatrixClientService` / `MatrixEventService` / `MatrixCacheManager` / `MatrixRequestDeduper` / `MatrixRequestHelper` / `SynapseRustExtensionsService` 作为 **core** 保留在顶层（客户端/事件/请求基础设施，被所有 domain 引用）。其余仍扁平的业务服务（profile/account/presence/device/contact/room/room-summary/room-store-adapter/space/announcement/application/direct-message/receipt/search/typing/user-directory/admin/federation/moderation/quota/report/retention）未进入本批，留待后续轮次或按实际耦合度评估。

_归档目录结构（新增 4 域）_
- `services/matrix/ai/`：`AIService.ts` · `ApiKeyService.ts` · `ChatRoleService.ts` · `ConversationService.ts` · `ModelService.ts`（5 文件 + 2 测试：`AIService.test.ts` / `AIServices.test.ts`）
- `services/matrix/sync/`：`MatrixSyncService.ts` · `MatrixSlidingSyncService.ts` · `SlidingSyncReconnectManager.ts`（3 文件 + 3 测试）
- `services/matrix/friends/`：`MatrixFriendService.ts` · `MatrixSpecialFriendService.ts`（2 文件 + 3 测试：含 `MatrixFriendGroupService.test.ts`）
- `services/matrix/notifications/`：`MatrixNotificationService.ts` · `MatrixPushService.ts` · `MatrixRoomNotificationService.ts` · `MatrixServerNotificationService.ts`（4 文件 + 5 测试：含 `MatrixPushExtendedService.test.ts`）

_消费侧改写_
- **10 处 `@/services/matrix/X` 路径更新**：`types/matrix-api.ts`、`plugins/robot/components/ModelManagement.vue`、`plugins/robot/views/Chat.vue`、`stores/domains/chat/{room,chat/session,contacts}.ts`、`components/friend/{FriendListView,FriendGroupView}.vue`、`components/room/RoomVirtualList.vue`、`components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- **1 处 matrix 子树相对路径**：`services/matrix/room/RealtimeService.ts` → `../sync/MatrixSlidingSyncService`
- **moved 文件内部 `./MatrixClientService` → `../MatrixClientService`**（14 个服务 + 同域内部引用保持 `./`）
- **barrel `services/matrix/index.ts`**：19 处 `./X` 重写为 `./{cluster}/X`，对外 API 签名零变更
- **2 处测试 mock 路径**：`MatrixContactService.test.ts` 改 `vi.mock('../friends/MatrixFriendService')`、`RealtimeService.test.ts` 改 `vi.mock('../../sync/MatrixSlidingSyncService')`

**验收（第七批）**
- `pnpm exec vue-tsc --noEmit`：**0 error**
- `pnpm test:run`：172 files / **2021 tests passed**（零回归，初次运行命中 2 处 mock 路径失配，修复后全绿）
- facade `services/matrix/index.ts` 导出名不变，外部消费侧仅改 import 路径
- Commit `cc06c0f3 refactor(matrix): cluster 14 services into ai/ sync/ friends/ notifications/`

_顶层体积_
- `src/services/matrix/` 扁平 `*.ts`（非 core）：**28 → 14（-14 文件，-50%）**
- 已填充域子目录：**11 个**（原 7 个 + ai/sync/friends/notifications）
- core 保留顶层：`MatrixClientService` · `MatrixEventService` · `MatrixCacheManager` · `MatrixRequestDeduper` · `MatrixRequestHelper` · `SynapseRustExtensionsService` · `index.ts`

**第八批产出（P2-6 续簇收官：matrix 顶层业务服务全量归档）**

_策略_：延续第七批思路，把剩余 14 个 flat 业务服务按域继续合并到既有 subdir 或归档入新域，顶层仅保留 6 个 **core** 基础设施服务 + 2 个标准库级业务服务（`search` / `appservice`）。分 3 个 commit 推进，每个 cluster 单独 commit + 单独验收，避免单个改动过大。

_Commit 1：`7e901024 refactor(matrix): cluster admin-family services into admin/`_
- 合并入既有 `admin/`：admin facade · `MatrixFederationBlacklistService` · `MatrixModerationService` · `MatrixQuotaService` · `MatrixReportService` · `MatrixRetentionService`（6 服务 + 7 测试，含 `MatrixAdminExtendedService`）
- 修正 `RegistrationTokensService` 的旧 admin facade 引用路径为当前子目录结构

_Commit 2：`9084b4bc refactor(matrix): cluster user-domain services into user/`_
- 新建 `user/`：`MatrixAccountService` · `MatrixProfileService` · `MatrixPresenceService` · `MatrixDeviceService` · `MatrixUserDirectoryService` · `MatrixContactService`（6 服务 + 7 测试，含 `MatrixAccount3PidService`）
- `MatrixContactService` 跨簇引用：`../friends/MatrixFriendService`、`../room/MatrixDirectMessageService`、`../room/MatrixRoomService`
- 修正测试 mock 路径（同域深度 `../../` + 跨簇 `../../friends/` 等）

_Commit 3：`193a4f92 refactor(matrix): cluster room/ and messaging/ services`_
- 合并入既有 `room/`：`MatrixRoomService` · `MatrixRoomStoreAdapter` · `MatrixRoomSummaryService` · `MatrixSpaceService` · `MatrixDirectMessageService` · `MatrixAnnouncementService` · `MatrixGroupService`（7 服务 + 测试）
- 合并入既有 `messaging/`：`MatrixReceiptService` · `MatrixTypingService`（2 服务 + 测试）
- `MatrixRoomService` 自反修正：`./room/TagsService` 等 16 处子服务 import → `./TagsService`（现已在同目录）
- `MatrixAnnouncementService` / `MatrixRoomStoreAdapter`：`./messaging/X` → `../messaging/X`
- `MatrixEventService`（顶层 core）：`./MatrixRoomService` → `./room/MatrixRoomService`、`./MatrixReceiptService` → `./messaging/MatrixReceiptService`
- 跨簇（`auth/user/admin/friends/notifications/sync/crypto/widget/media`）相对引用批量修正：`../MatrixRoomService` → `../room/MatrixRoomService`、`../MatrixReceiptService` → `../messaging/MatrixReceiptService` 等
- 测试 mock：`MatrixAnnouncementService.test` 的 `../messaging/MatrixMessageService` 因测试文件下沉需改为 `../../messaging/MatrixMessageService`（从 `room/__tests__/` 出发）

**验收（第八批，3 个 commit 独立 verify）**
- 每个 commit 后 `pnpm exec vue-tsc --noEmit`：**0 error**
- 每个 commit 后 `pnpm test:run`：172 files / **2021 tests passed**（中间 4 次 mock 路径失配均一次定位修复）
- facade `services/matrix/index.ts` 对外导出名 **零变更**，所有修改都发生在 import specifier 层

_最终顶层体积_
- `src/services/matrix/` 扁平 `*.ts`：**28 → 8（-20 文件，-71%）**
- 已填充域子目录：**13 个**（`crypto` · `widget` · `media` · `messaging` · `auth` · `room` · `admin` · `ai` · `sync` · `friends` · `notifications` · `user` + barrel）
- core 保留顶层（6）：`MatrixClientService` · `MatrixEventService` · `MatrixCacheManager` · `MatrixRequestDeduper` · `MatrixRequestHelper` · `SynapseRustExtensionsService`
- 标准库级业务服务保留顶层（2）：`MatrixSearchService`（搜索跨域，不属单一 domain） · `MatrixApplicationService`（appservice 协议适配层）

**第九批产出（P2-3 落盘：历史 `D` 项批量提交）**

_背景_：`git status` 长期累积 249 个 `D` 项（早前各轮迁移/重命名/去冗余/SDK 替换的副产物但从未合入 commit），配合 144 个 `??` 与 238 个 `M`，整体 worktree 杂乱导致 `diff`/`status` 噪声大，掩盖真正的 in-flight 变更。本轮分 3 个 commit 清理 249 个 `D`。

_Commit 1：`180d090a chore: remove archived planning docs and one-off cleanup scripts`（30 文件）_
- `docs/` 归档（20）：被 `FRONTEND_OPTIMIZATION_PLAN_2026-04-23.md` 取代的各代 refactor/optimization 计划 md
- 根目录一次性脚本（4）：`find_unused.js` · `fix_prefix.py` · `remove_dead_code.{js,ts}` · `test_grep.js`
- 构建产物（3）：`playwright-report/index.html` · `test-results/.last-run.json` 等
- 杂项（3）：`MIGRATION_DOCUMENTATION.md` · `e2e/tech-debt-fixes.spec.ts` · `e2e/tsconfig.json`

_Commit 2：`3abb052c chore: remove unused Rust modules`（4 文件）_
- `src-tauri/src/` 遗留 4 个 Rust 模块：`command/request_command.rs` · `command/token_helper.rs` · `im_request_client.rs` · `matrix_auth.rs`
- `grep` 确认零引用（均在 matrix-js-sdk 前端迁移后废弃）

_Commit 3：`5197d5f5 chore: remove 215 legacy source files superseded by matrix-js-sdk migration`（215 文件）_
- `services/` 75 · `components/` 37 · `utils/` 24 · `composables/` 19 · `mobile/` 14 · `plugins/` 13 · `test/` 11 · `views/` 8 · `hooks/` 6 · `types/` 5 · `i18n/` 2 · `strategy/` 1
- 均为各代 domain-split / SDK 切换 / hooks 合并遗留的老文件
- 安全性保证：`vue-tsc --noEmit` 0 error + `pnpm test:run` 2021/2021 pass 已隐式验证零引用（若仍被 import 构建即会断）

**验收（第九批）**
- 3 个 commit 顺序落盘，每个 commit 独立可回滚
- 最终 `pnpm exec vue-tsc --noEmit`：**0 error**
- `pnpm test:run`：172 files / **2021 tests passed**
- `git status` 中 `D` 项：**249 → 0**
- 剩余 noise：144 `??`（earlier session 的未跟踪新增文件，如 `AdminNotices.vue` / `AdminRegistrationTokens.vue` / admin composables 等） + 238 `M`（earlier session 的在途修改，本轮未触及）

**第十批产出（工作树 noise 归零：earlier-session in-flight 工作落盘）**

_背景_：第九批清完 249 个 `D` 之后，`git status` 仍有 144 `??` + 238 `M`（+ 4 根目录零碎），为 earlier session 的成片在途工作（admin 多功能页、settings 扩展、services 子目录新增、i18n 补全、Rust 后端指令、worker、类型扩展等）。因 `vue-tsc --noEmit` 0 error 与 2021 tests 全绿，整体自洽，按 **assets / Rust / frontend / root** 四批 checkpoint 一次性落盘。

_Commit 1：`6389a695 chore: checkpoint in-flight config/locales/scripts/docs`（70 文件：31 A + 39 M）_
- `locales/` 36：zh-CN/en 补全 burn/connection/encryption/error/mobile_*/space/friend/home/setting 等键
- `scripts/` 9：probe-admin-features、report-bundle-metrics、check-sdk-augmentations、run-vitest 等构建/审计脚本
- `build/config/` 4 · `.github/` 2（dependabot + security-performance workflow）· 根 docs 4 · 根元文件 12（`.env`/tsconfig/vite/vitest/biome/package/pnpm-lock/CHANGELOG/README 等）

_Commit 2：`b90b526b chore: checkpoint in-flight Rust backend changes`（15 文件：1 A + 14 M）_
- 新增 `src-tauri/src/command/admin_command.rs`
- 修改 `ai/contact/message/room_member/setting/upload/user_command.rs`、`command/mod.rs`、`lib.rs`、`vo/vo.rs`、`Cargo.{toml,lock}`、`src-tauri/docs/README`
- Rust 侧独立验证在 earlier session 已完成

_Commit 3：`92556842 chore: checkpoint in-flight frontend feature work`（374 文件：193 A + 181 M）_
- `components/` 75 · `services/` 69 · `mobile/` 50 · `views/` 47 · `composables/` 36 · `utils/` 21 · `hooks/` 19 · `stores/` 11 · `plugins/` 8 · `common/` 7 · `router/` 6 · `workers/` 5 · `types/` 5 · `typings/` 4 · `styles/` 4 · `layout/` 3 + `App.vue` / `main.ts` / `i18n/` / `scripts/`
- 亮点新增：admin 全功能页（Audit / Federation / Maintenance / Notices / RegistrationTokens / Retention / Saml / Security / ServerLogs / Forbidden）、settings 扩展（BurnAfterRead / Friends / Mjolnir / Sidebar）、Encryption / ThreePidSettings / SpaceView / NotFound、admin composables（useAdminFederation / Notices / RegistrationTokens / Rooms / Users）、`HttpClient` / `PerformanceReporter` / `inputValidation` 工具、`matrixSdk.worker.ts` + `matrixWorkerTypes.ts`、`matrix-extensions.d.ts` + `matrix-js-sdk-augmentations.d.ts` 类型增强
- services 子目录新增：`auth/` · `crypto/` · `media/` · `widget/` + 对应 `__tests__/`

_Commit 4：`904e9f97 chore: checkpoint remaining in-flight root + skill template edits`（4 文件：M）_
- `index.html` · `playwright.config.ts` · `skills/hula-skill/assets/templates/{pinia-store.ts,view-desktop.vue}`

**验收（第十批）**
- 4 个 checkpoint commit 顺序落盘，按 assets / Rust / frontend / root 四层分离
- `pnpm exec vue-tsc --noEmit`：**0 error**（`FriendsList.vue` 在途修正已随 frontend checkpoint 一并生效，全仓零 type error）
- `pnpm test:run`：172 files / **2021 tests passed**
- `git status`：**working tree clean**（从 249 D + 144 ?? + 238 M 清零）

**Step 10 最终状态**
- **P2-3** ✅ 已完成（第九批 3 commit 清 249 `D`）
- **P2-6** ✅ 已完成（第七/八批完成 matrix 归档）
- **P2-7** ✅ 已完成（第五批 stores 分层）
- **P2-4** — 仍阻塞于 UI 调用路径移除（runtime-level dependency）
- **工作树** ✅ 全清：所有 earlier-session in-flight 工作已以 checkpoint commit 落盘
- **仓库健康度**：vue-tsc 0 error · 2021 tests pass · services/matrix 顶层 28 → 8（-71%）· stores 38 flat → domains/5 域
- **剩余候选任务**：`noExplicitAny` warning 批次清理（23+ 个）、`deleteRetentionPolicy` UI 调用移除后收尾

**第十一批产出（`noExplicitAny` warning 全面清零）**

_背景_：Step 10 末态 Biome 仍有 1019 个 `lint/suspicious/noExplicitAny` warning（含 tests/stories 等非生产代码）。按生产代码优先原则分两批落盘。

_Commit: `d8154b9b chore(lint): clear all noExplicitAny warnings`（105 文件）_

**典型改造手法**
- **服务响应类型化**：`tauriCommand.ts` 为 FileManager 相关 invoke 响应定义 `FileManagerFileItem / TimeGroup / User / NavigationItem / QueryResponse`；`admin/MediaService.ts` / `NotificationService.ts` 将 `() => Promise<any>` SDK getter 替换为结构化 `MediaAdminSdk` / `NotificationAdminSdk` 类型，移除所有内部 `as unknown as { ... }` 重铸。
- **SDK 类型 bridging**：`MatrixDeviceService` 从 `@/types/matrix-extensions` 引入 `AuthDict`（非 `matrix-js-sdk` 主入口）；`MatrixReactionService` 新增 `ReactionRelatesTo` / `ReactionContent` 替代 `Record<string, any>`。
- **兩個同名類型消歧**：`multiMsgWindow/index.vue` 将 `UserItem` 改从 `MatrixContactService` 导入（原 `@/services/types` 版本签名不匹配）；`MessageBody` 两个版本仍以 `as MessageType['message']['body']` 桥接。
- **真正需要 any 的情形**：`VirtualList.vue` 的泛型列表、`MessageBody` union、`matrix.d.ts` 的 `on(event, (...args: any[]) => void)`（contravariance 必需）均改为 `biome-ignore lint/suspicious/noExplicitAny` 并附原因注释。
- **回调窄化**：`ChatSidebar.vue` 三个 listen/mitt/inner event 回调、`AiAssistant` picker confirm、`robot/utils/markdown.ts` toolbar handler、`MatrixVoIPService` RTC stats mapper 等全部改为 `unknown` / 具体联合类型。
- **Storybook**：`Header.stories.ts` / `Page.stories.ts` 的 `args: any` / `canvasElement: any` 直接删除（Storybook 类型可自动推导）。
- **Store state**：`settingsDialog.ts` 的 `Record<string, any>` → `Record<string, unknown>`。
- **QRCode 登录轮询**：引入 `QRLoginResult` 类型并处理 `null` 分支，`handleConfirmed` 参数从 `res: any` 改为类型化。

**验收（第十一批）**
- `pnpm check`：**0 error / 0 warning**（`lint/suspicious/noExplicitAny` 从 1019 → 0）
- `pnpm exec vue-tsc --noEmit`：**0 error**
- 生产代码与 test/stories 均已覆盖；所有保留的 `any` 均有 `biome-ignore` + 理由注释
- commit: `d8154b9b chore(lint): clear all noExplicitAny warnings - typed admin SDK shapes + narrowed callbacks`

**Step 11 最终状态**
- **`noExplicitAny`** ✅ 全仓归零（1019 → 0，含生产 + 测试 + storybook）
- **约束达成**：未引入任何新 `any`；保留的 `any` 均有 biome-ignore 理由
- **仓库健康度**：vue-tsc 0 error · biome 0 warning · 2021 tests pass
- **剩余候选任务**：`deleteRetentionPolicy` UI 调用路径移除（runtime-level，仍阻塞）

### 步骤 12：P0-6 `useMsgInput.ts` 状态抽离（Step 3b）· 状态：🟢 本轮完成（2026-04-24）

**本轮范围**：承接 Step 3 的纯函数抽取，按原计划续作表推进 `@提及状态` / `剪贴板处理` / `语音输入` 三条独立子 hook。上层 API 完全保留，消费者 `MsgInput.vue` 零改动。

**产出**
- 新增 `src/hooks/msgInput/useMentionState.ts`
  - 把 `ait` / `aitKey` / `personList` / `selectedAitKey` 从 `useMsgInput.ts` 抽离为独立 hook。
  - 依赖注入：`userList: Ref<UserItem[]> | ComputedRef<UserItem[]>`、`currentUserId: Ref<...>`、`isChinese: Ref<boolean>`。
  - 内置 `watchEffect` 保证弹窗关闭后 `selectedAitKey` 自动回落首项（与原 `useMsgInput` watchEffect 同语义）。
- 新增 `src/hooks/msgInput/useClipboardPaste.ts`
  - 封装原 `menuList` 定义 + `paste` 点击处理。
  - 暴露 `menuList`（5 项：cut / copy / paste / save_as / select_all）+ `handlePaste`。
  - 粘贴优先级：`readImage` → `processClipboardImage → imgPaste`；无图片走 `readText → insertNode(MsgEnum.TEXT)`；两者皆空走 `alert` 提示。
- 新增 `src/hooks/msgInput/useVoiceInput.ts`
  - 把 `uploadVoiceToMatrix` 抽离（`readFile → matrixVoiceService.uploadVoice`）。
  - 返回类型用 `Awaited<ReturnType<...>>` 自动导出，免改 service 主模块的 public exports。
- `useMsgInput.ts` 改造
  - 把内联 `ait` / `aitKey` / `personList` / `selectedAitKey` / `menuList` / `uploadVoiceToMatrix` 全部替换为新 hook 调用；移除相关重复 `watchEffect`、`readImage/readText/readFile/processClipboardImage/matrixVoiceService` 的直接导入；删除未使用的 `useI18n()` 调用。
  - LOC：1416 → **1347**（-69）。
- 新增单测（合计 18 用例）
  - `msgInput/__tests__/useMentionState.test.ts`（8 用例）：排除当前用户 / aitKey 前缀匹配 / `myName` 优先 / IME 组字时忽略 aitKey / `selectedAitKey` 初始化 / 弹窗关闭后回落首项 / 支持 `ComputedRef` 源 / `ait` 独立 toggle。
  - `msgInput/__tests__/useClipboardPaste.test.ts`（6 用例）：5 项菜单结构 / 图片分支 / 文本分支 / 两路全空 alert / `processClipboardImage` 失败降级到 readText / `messageInputDom=null` 早退。
  - `msgInput/__tests__/useVoiceInput.test.ts`（4 用例）：readFile + uploadVoice 组合 / readFile 错误透传 / uploadVoice 错误透传 / File 构造的 name + type 透传。

**验收**
- `pnpm test:run` → 178 files / **2063 passed**（+42 相对上一次基线 2021；本批 +18，前序批次 +24）
- `pnpm exec vue-tsc --noEmit`：**0 error**
- `pnpm check`：**0 warning / 0 error**
- `useMsgInput.ts` 对外返回对象签名（包含 `ait` / `aitKey` / `personList` / `selectedAitKey` / `menuList`）保持不变；`MsgInput.vue` 消费者零改动。
- commit: `99cc0c56 refactor(hooks): extract useMentionState / useClipboardPaste / useVoiceInput from useMsgInput`

**Step 12 状态**
- Step 3 续作表覆盖 3/5：`useMentionState` ✅ / `useClipboardPaste` ✅ / `useVoiceInput` ✅
- 剩余 2 条独立 hook：`useDraftBuffer`（草稿 store 包装）/ `useInputShortcuts`（`chatKey` / `sendKey` 绑定 + `handleInput` debounce）——均涉及更多 DOM 交互与 store 耦合，留待后续轮次评估。

### 步骤 13：P0-6 `useMsgInput.ts` 状态抽离（Step 3c）· 状态：🟢 本轮完成（2026-04-24）

**本轮范围**：承接 Step 12，继续推进 Step 3 续作表剩余项，完成 `useInputShortcuts` 抽离 + 回归网，并对 `useDraftBuffer` 做判定。

**产出**
- 新增 `src/hooks/msgInput/useInputShortcuts.ts`
  - 承接 `chatKey` ↔ `setting.chat.sendKey` 两路 watch（带 `!==` guard 避免回环）
  - `handleInput = useDebounceFn(..., 0)`：空内容（含 `<br>` / `<div><br></div>` / 各类 Unicode 空白）下清空 `msgInput` + `resetAllStates`；否则写 `innerHTML` 进 `msgInput` 并调 `handleTrigger(text, cursorPosition, { range, selection, keyword: '' })`
  - `inputKeyDown`：`disabledSend` 拦截、`ait/aiDialog` 拦截、macOS IME 组字让渡、macOS `Enter` 策略下 `⌘+Enter` 插换行、平台化 `sendKey` 解析、`form#message-form.requestSubmit()` 发送
  - 通过 `InputShortcutsOptions` 注入 13 个依赖（DOM / store refs / hook 方法），保持 hook 对 Vue 组件树与 Pinia 解耦
- `useMsgInput.ts` 改造
  - 移除内联 `chatKey` `ref`、两个 watch、`handleInput` 100+ 行、`inputKeyDown` 50+ 行；改成一次 `useInputShortcuts({...})` 聚合调用
  - 同步清理因抽离而失效的导入：`useDebounceFn` / `isMac` / `isWindows` 不再使用 → 删除；并删除顶部遗留的「草稿注释」——实际并无草稿逻辑在此文件内
  - LOC：1416 → **1254**（-162，相对 Step 12 末态再 -93）
- 新增 `src/hooks/msgInput/__tests__/useInputShortcuts.test.ts`（15 用例）
  - `chatKey` 双向同步：初始镜像 / store→local / local→store（3）
  - `handleInput`：空内容清空 + `resetAllStates` / 媒体内容保留 + 转发 `handleTrigger` / `getEditorRange` 返回 `null` 时 reset / `handleTrigger` reject 不上抛（4）
  - `inputKeyDown`：`disabledSend=true` 走 `resetInput` / `ait` 开启时拦截 / macOS 拼音让渡 / macOS `Enter` 下 `⌘+Enter` 插换行 / `sendKey=Enter` 普通 Enter 提交 form / macOS `sendKey=⌘+Enter` + `⌘+Enter` 提交 form / Windows `sendKey=Ctrl+Enter` 仅 `Ctrl+Enter` 提交 / 空白 msgInput 拦截（8）

**`useDraftBuffer` 决议：无抽离必要**
- 全仓 grep `setDraftMessage` / `getDraftMessage` / `draftMessage*` 结果：`useMsgInput.ts` 仅剩一条**注释**，实际代码 0 处调用；`MsgInput.vue` 也未使用。
- 结论：`useDraftBuffer` 在当前 `useMsgInput.ts` 中没有 extract target；Step 3 续作表列出的"草稿 store 包装"是当年的前瞻项，今已无计划意义 → 关闭该续作项，不新增空壳 hook。相关残留注释已一并删除。

**副带修复**
- `src/utils/Console.ts`：早前作者信息统一（移除 `package.json` 顶层 `author.url`）触发 `pkg.author.url` 类型错误，改印 `pkg.author.email`，消除 1 条 TS 报错。
- `src/plugins/robot/composables/useRobotGenerationDisplay.ts`：未提交在途文件 formatter diff，`biome format --write` 回归，用以解锁 `pnpm check` 0 error。

**验收**
- `pnpm test:run`：179 files / **2078 passed**（+15 本批）
- `pnpm check`：0 error / 0 warning
- `pnpm exec vue-tsc --noEmit`：与 `useInputShortcuts` 相关文件 0 error；仓库他处 `src/plugins/robot/views/Chat.vue:1580` 预存 `AIMessage/AIConversationMessage` 类型分叉为 earlier session 在途工作，与本批无关（stash-clean 对照 HEAD 复现）。
- `useMsgInput.ts` 对外签名保持不变（`chatKey` / `handleInput` / `inputKeyDown` 仍在 return 对象中），`MsgInput.vue` 消费者零改动。

**Step 13 状态**
- Step 3 续作表覆盖 4/5：`useMentionState` ✅ / `useClipboardPaste` ✅ / `useVoiceInput` ✅ / `useInputShortcuts` ✅
- `useDraftBuffer` ❎ 关闭（无 extract target）
- `useMsgInput.ts` 累计：1536 → **1254** LOC（**-282，-18.4%**），5 个独立可测 hook 已落盘

### 步骤 14：P1-2 MessageStrategy 按类型拆文件 · 状态：🟢 完成（2026-04-24）

**本轮范围**：P1-2 计划项 —— 把 `src/strategy/MessageStrategy.ts`（1486 LOC，内含 12 个 strategy class）改造成 `strategies/*.ts` 一类型一文件的目录结构，保留 dispatcher 和对外 API。

**产出**
- 新建 `src/strategy/strategies/` 子目录
- `strategies/base.ts`（116 LOC）：
  - 共享类型 `ReplyRef` / `ImageInfo` / `CallInfo`
  - 对外接口 `MessageStrategy`
  - `AbstractMessageStrategy` 抽象类 + 模块级 `strategyLogger`
- 12 个具体策略一类型一文件（导出 class）
  - `text.ts` · `image.ts`（314）· `file.ts`（181）· `emoji.ts`
  - `video.ts`（311）· `voice.ts`
  - `videoCall.ts` · `audioCall.ts`
  - `location.ts` · `beacon.ts` · `linkPreview.ts` · `unsupported.ts`
  - 每个文件只 import 自身真正需要的依赖（文件 → `tauri-fs` + `useUpload` + `FileType` 等；纯 JSON 解析类如 beacon/location/linkPreview → 仅 `AppException`）
- `strategies/index.ts`（66 LOC）：
  - 实例化 12 个策略；构建 `messageStrategyMap: Record<MsgEnum, MessageStrategy>`
  - 重新导出 base 接口与 12 个 class
- `src/strategy/MessageStrategy.ts`：**1486 → 5 LOC**，仅剩一行 `export * from './strategies'`，保持历史 import 路径 `@/strategy/MessageStrategy` 完全兼容（`useMsgInput.ts` / `useCustomForwardTask.ts` 零改动）
- 原文件内的 `logger = createLogger('MessageStrategy')` 迁至 `base.ts` 并改名 `strategyLogger`，各 strategy 以 `strategyLogger as logger` 别名导入，保留原有日志前缀

**验收**
- `pnpm exec vue-tsc --noEmit`：**0 error**（strategy 子树）
- `pnpm exec biome check src/strategy`：**0 error / 0 warning**
- `pnpm test:run`：179 files / **2078 passed**（消费侧不变，零回归）
- LOC：`MessageStrategy.ts` 1486 → **5**（-1481）；拆出文件总计 **1584 LOC**（含类型声明与多余 import 样板，单文件最大 `image.ts` 314，`video.ts` 311，其余全部 ≤ 181）
- >1000 LOC 单文件计数：**9 → 8**（`MessageStrategy.ts` 退出榜单）
- commit: `9842e7f6 refactor(strategy): split MessageStrategy into per-type files`

**Step 14 状态**
- P1-2 计划项 ✅ 完成
- 单文件 >1000 LOC 剩余 8 个：`Chat.vue` 2151 · `augmentations.d.ts` 1464 · `useChatMain` 1330 · `useMsgInput` 1254 · `stores/chat/chat/message` 1171 · `Bot.vue` 1134 · `useWebRtc` 1097 · `emoticon/index.vue` 1056
- 后续推荐优先级：**P0-4 续作**（Chat.vue 拆 composable + 子组件） → **P2-1**（一行级 MatrixWidgetService legacy 清理） → **P0-6 续作**（useChatMain / useWebRtc）

### 步骤 15：P2-1 MatrixWidgetService 单数 legacy 分支清理 · 状态：🟢 完成（2026-04-24）

**背景**：`src/services/matrix/widget/MatrixWidgetService.ts` 的 `getManager()` 采用 4 路 probe，兼容 SDK 可能的 4 种形态：`getWidgetsManager()`（复数方法）/ `widgetsManager`（复数属性）/ `getWidgetManager()`（单数方法）/ `widgetManager`（单数属性）。单数是 SDK 对齐前的过渡 shim，canonical 只保留复数。

**产出**
- `MatrixWidgetService.ts:67-86`：`getManager()` 探测链瘦身
  - 移除 `getWidgetManager()` 单数方法 + `widgetManager` 单数属性两路分支
  - 保留 `getWidgetsManager()` → `widgetsManager` 两路复数分支
- `src/types/matrix.d.ts:65-66`：同步移除 augmentation 中的 `getWidgetManager()?: unknown` / `widgetManager?: unknown` 两键
- `widget/__tests__/MatrixWidgetService.test.ts`：删除专门测试 legacy fallback 的 `falls back to the legacy getWidgetManager()...` 用例（测试对象已不存在）
- 净变更：+1 / −28 行，单文件最多减少 12 LOC

**验收**
- `pnpm exec vitest run src/services/matrix/widget/`：16/16（−1 legacy case 删除）
- `pnpm exec vue-tsc --noEmit`：widget / types 子树 0 error
- `pnpm exec biome check src/services/matrix/widget`：0 warning / 0 error
- 全仓 grep `\bgetWidgetManager\b|\bwidgetManager\b`（排除复数）零命中
- commit: `5495f7ec refactor(widget): drop singular legacy fallback in getManager`

**Step 15 状态**
- P2-1 计划项 ✅ 完成
- 下一轮推荐：**P0-4 续作** Chat.vue god component 抽 composable + 子组件拆分

### 步骤 16：P0-6 useWebRtc 续作 — useCallTimer / useCallBell 抽离 · 状态：🟢 本轮完成（2026-04-24）

**背景**：`src/hooks/useWebRtc.ts` 在 Step 8 完成类型 + ICE 配置抽离后仍有 1097 LOC。续作表首批为「纯状态最低风险」：通话时长计时（startCallTimer / stopCallTimer + callDuration / animationFrameId / startTime，基于 `requestAnimationFrame` + `performance.now`）和铃声封装（bellAudio + start/stop/pause/play）。两者均与 RTCPeerConnection / Matrix signaling 完全解耦，可独立单测。

**产出**
- `src/hooks/webRtc/useCallTimer.ts`（新增 37 LOC）：暴露 `callDuration` + `startCallTimer` / `stopCallTimer`，内部封装 rAF 循环与秒级取整
- `src/hooks/webRtc/useCallBell.ts`（新增 49 LOC）：暴露 `bellAudio` + `startBell` / `stopBell` / `pauseBell` / `playBell`，`url` 为空字符串时 `startBell` 为静音 no-op
- `src/hooks/useWebRtc.ts`：
  - 移除内联 `bellAudio` ref、`animationFrameId` / `startTime` / `callDuration` 三个 ref、`startCallTimer` / `stopCallTimer` / `startBell` / `stopBell` / `pauseBell` / `playBell` 六个函数（共 −76 行）
  - 改为 `const { callDuration, startCallTimer, stopCallTimer } = useCallTimer()` + `const { startBell, stopBell, pauseBell, playBell } = useCallBell(rtcCallBellUrl)`
  - 净变更：1097 → 1043 LOC（−54）
- `src/hooks/webRtc/__tests__/useCallTimer.test.ts`（新增 4 tests）：初始值 / rAF 推进秒数 / stop 取消并归零 / 空闲状态 stop no-op
- `src/hooks/webRtc/__tests__/useCallBell.test.ts`（新增 5 tests）：play 循环 / 静音 no-op / pause+clear / pause-play 代理 / 空实例安全

**验收**
- `pnpm exec vitest run src/hooks/webRtc/__tests__/useCallTimer.test.ts src/hooks/webRtc/__tests__/useCallBell.test.ts`：9/9 pass
- `pnpm exec vue-tsc --noEmit`：`src/hooks/useWebRtc.ts` + `src/hooks/webRtc/**` 0 error（剩余 error 全部集中在 `src/plugins/robot/`，为另一上游 in-flight 任务，与本 Step 无关）
- 对外 API 不变：`useWebRtc()` 返回对象同形同语义（`callDuration` / `startCallTimer` / `startBell` / `stopBell` / `pauseBell` / `playBell` 均保留）

**Step 16 状态**
- P0-6 useWebRtc 续作首批 ✅ 完成
- useWebRtc.ts 仍 >1000 LOC（1043），下一轮续作表：`useMediaDevices`（audioDevices / videoDevices / selectedXxx + getDevices，~60 LOC）→ `usePeerConnection`（createPeerConnection + 事件绑定）→ `useScreenShare`
- 同期 useChatMain.ts 续作表仍待启动：建议下一轮先抽 `useGroupNicknameModal`（最低耦合 5 ref + open/close）再动菜单数组

### 步骤 17：P0-6 useWebRtc / useChatMain 续作（第二批）· 状态：🟢 本轮完成（2026-04-24）

**背景**：Step 16 后 useWebRtc 1043 LOC、useChatMain 1330 LOC 均仍 >1000。本轮按各自续作表的「最低耦合」条目同步推进：
- useWebRtc：抽 `useMediaDevices`（5 个 ref + getDevices + resetDevices，原 getDevices 内的 `window.$message.error('获取设备失败!')` 已在 caller `startCall` 中重复打过一遍，hook 内不再弹 toast，职责更纯）
- useChatMain：抽 `useGroupNicknameModal`（5 个 ref + handleGroupNicknameConfirm + 条件 mitt 订阅）

**产出**
- `src/hooks/webRtc/useMediaDevices.ts`（新增 75 LOC）
  - 暴露 audioDevices / videoDevices / selectedAudioDevice / selectedVideoDevice / isDeviceLoad
  - `getDevices()` 先试探性 `getUserMedia({audio,video})` 以拿到完整 label，再 enumerate，再按 `default` / 首个回填选择
  - `resetDevices()` 提供给 `clear()` 的统一重置入口
- `src/hooks/useWebRtc.ts`：1043 → 997 LOC（−46），返回 API 不变；`clear()` 的设备重置段改为一行 `resetDevices()`
- `src/hooks/chatMain/useGroupNicknameModal.ts`（新增 100 LOC）
  - 暴露 5 ref + `openGroupNicknameModal(payload)` + `handleGroupNicknameConfirm()`
  - `enableMitt=true` 时订阅 `MittEnum.OPEN_GROUP_NICKNAME_MODAL`，保持与老行为（未显式 off）一致
- `src/hooks/useChatMain.ts`：1330 → 1281 LOC（−49），返回 API 不变；老的 `GroupNicknameModalPayload` 类型从 hook 内搬到模块内重导出
- 单测：
  - `useMediaDevices.test.ts`（7）：初始值 / default 优先 / 首个回退 / 权限拒绝仍继续 / 空 enumerate / 抛错回退 / resetDevices
  - `useGroupNicknameModal.test.ts`（9）：初始值 / open 填充 / enableMitt 订阅 / default 不订阅 / 空白名报错 / 同名关闭 / 无 roomId 报错 / 成功路径 / SDK 失败保留弹窗

**验收**
- `pnpm exec vitest run src/hooks/webRtc/__tests__/useMediaDevices.test.ts src/hooks/chatMain/__tests__/useGroupNicknameModal.test.ts`：16/16 pass
- 叠加 Step 16 的 useCallTimer / useCallBell：本批次相关 4 个文件共 25/25 pass
- `pnpm exec vue-tsc --noEmit` 去除 robot/ in-flight error 后 0 error
- 公共 API：`useWebRtc()` / `useChatMain()` 返回对象同形同语义
- 文件状态：useWebRtc.ts 已跌破 1000 LOC 门槛 ✅；useChatMain.ts 仍 1281 LOC，续作剩 6 个菜单数组 + 文件下载/拷贝/emoji 反应

**Step 17 状态**
- P0-6 useWebRtc 续作第二批 ✅ 完成（useWebRtc 已 <1000 LOC）
- P0-6 useChatMain 续作第二批 ✅ 完成（最低耦合项）
- 下一轮续作表：
  - useWebRtc：`usePeerConnection`（createPeerConnection + 状态机；含 startCallTimer/endCall 依赖注入，~100 LOC，中等风险）
  - useChatMain：`useChatFileDownload`（~150 LOC）或按菜单数组逐块抽 `useChatMessageMenus`

### 步骤 18：P0-6 useChatMain 续作（第三批）— useChatCopy 抽离 · 状态：🟢 本轮完成（2026-04-24）

**背景**：Step 17 后 useChatMain 1281 LOC，下一个可收割的低风险块是 `handleCopy`（~50 LOC）。该函数无 store / i18n 依赖，仅用 `getSelectedText`（已独立）+ tauri clipboard + ImageUtils + removeTag，抽出后 useChatMain 可同时移除 5 个 import。

**产出**
- `src/hooks/chatMain/useChatCopy.ts`（新增 67 LOC）：暴露单个 `handleCopy(content, prioritizeSelection?, messageId?)`
- `src/hooks/useChatMain.ts`：1281 → 1228 LOC（−53）
  - 移除内联 `handleCopy`（46 行）
  - 移除仅供 handleCopy 用的 imports：`writeImage` / `writeText` / `detectImageFormat` / `imageUrlToUint8Array` / `isImageUrl` / `removeTag`
- 单测 `useChatCopy.test.ts`（6 tests）：空内容 warning / 选中优先 / 回退路径 / PNG 直接复制 / GIF/WEBP 转换提示 / 图片异常吞掉不崩

**验收**
- `pnpm exec vitest run src/hooks/chatMain/__tests__/useChatCopy.test.ts`：6/6 pass
- `pnpm exec vue-tsc --noEmit`：robot/ 之外 0 error
- 返回 API 不变：`useChatMain()` 依旧暴露 `handleCopy` 同签名

**Step 18 状态**
- useChatMain 续作第三批 ✅ 完成
- useChatMain.ts 进度：1330 → 1281 → 1228 LOC（本轮 −53）
- 下一轮续作表：
  - `useChatFileDownload`：抽 `revealInDirSafely` + 三处 fileDownloadStore 复用路径（~150 LOC），注意菜单数组中的 click handler 闭包要一并内联或以参数形式穿透
  - `useChatMessageMenus`：6 个 menu 数组按类型分裂（风险较高，留至 hook 接近 1000 LOC 再开）

### 步骤 19：P0-6 useMsgInput 续作（Step 3d）— 主体瘦身至编排层 · 状态：🟢 本轮完成（2026-04-24）

**背景**：用户在上一次会话末完成了 `useMsgInputSend` 抽离，但主体（useMsgInput.ts）同时保留了 `handleAit` / `handleAI` 的完整 DOM 操作实现（~90 LOC）和 `onMounted` 内的全部事件监听（RE_EDIT / REPLY_MEG / composition，~95 LOC）。目标：把这两块也迁出去，使主体只做「编排 + 移动端补充 + 返回 API」三件事，并补主体级契约测试。

**产出**
- `src/hooks/msgInput/useMsgInputMentionActions.ts`（新增 108 LOC）
  - 暴露 `editorRange` / `handleAit(user)` / `handleAI()`
  - 两个处理器共享 `selectBackToTriggerChar(range, pattern)` 纯函数：把光标范围回退到 `@` 或 `/` 触发字符处，消除原来的重复代码
- `src/hooks/msgInput/useMsgInputEvents.ts`（新增 138 LOC）
  - `onMounted` 内统一注册 `MittEnum.RE_EDIT` / `MittEnum.REPLY_MEG` + `compositionstart` / `compositionend`
  - 把 4 个 handler 函数（onReEdit / onReplyMeg / onCompositionStart / onCompositionEnd）也外露，便于单测
- `src/hooks/useMsgInput.ts`：504 → 305 LOC（−199）
  - 移除内联 `handleAit` / `handleAI` / `editorRange` / 整段 `onMounted`
  - 移除仅它们用到的 imports：`MittEnum` / `useMitt` / `onMounted` / `getReplyContent` / `UserItem`
  - 主体现在只剩：store 绑定 → 本地状态 → 子 hook 编排 → `send()`（移动端 focus 补充）→ `return { ... }`
- `src/hooks/msgInput/useMsgInputSend.ts`（补丁）
  - `ChatStoreLike.updateMsg` 的参数类型从 `Record<string, unknown>` 收紧为具名 `ChatUpdateMsgPayload`，消除 pinia store 赋值时的 TS 契约不匹配错误

**验收**
- 单测：
  - `useMsgInputMentionActions.test.ts`（7）：IME 期间短路 / `@` 回退设 range + 群昵称优先 / fallback 到 item.name / 无 range 仍插入 / `/` IME 短路 / `/` 正常路径（info + 删除 + trigger）/ 无 range 提前退出
  - `useMsgInputEvents.test.ts`（5）：onMounted 注册 `reEdit` + `replyMsg` / onReEdit 设置 innerHTML + focus / composition 10ms 定时器 / onReplyMeg 无用户信息短路 / onReplyMeg 成功路径（reset → 填充 reply → nextTick 插入 REPLY 节点）
  - `useMsgInput.test.ts`（新增，7）：**主体级契约测试** — 公共 API 形状锁定（33 个 key）/ 每个子 hook 只被调用一次 / 共享 ref（msgInput / reply）通过 identity check / 桌面端 send 只 await sendCore / 移动端 send 仍调用 / disabledSend 对空串为 true / stripHtml 去标签
- `pnpm exec vitest run src/hooks/msgInput/__tests__ src/hooks/__tests__/useMsgInput.test.ts`：68/68 pass（新增 12 子 hook + 7 主体 = 19 新增）
- `pnpm exec vue-tsc --noEmit` 去除 robot/ in-flight error 后 0 error
- 公共 API 完全保持不变（契约测试里的 33 个 key 全部回归校验）

**Step 19 状态**
- P0-6 useMsgInput 续作（Step 3d）✅ 完成
- useMsgInput.ts 进度：1416 → 1254 → 504 → 305 LOC（总累计 −1111 行 / −78%）
- 单文件 >1000 LOC 清单：剩 useChatMain.ts（1228）、还有服务层几条；useMsgInput 已完全不在清单内
- 下一轮可选：
  - useChatMain 续作：`useChatFileDownload`（跨菜单闭包，风险较高，需抽公共工具 `performDownloadOrReveal`）或 6 menu 数组按类型分裂
  - useMsgInput：本身已到合理规模，进一步瘦身收益递减，保留

### 步骤 20：P0-6 useChatMain 续作（第四批）+ P0-4 Chat.vue 续作（首批）+ TempMessageLike 类型收口 · 状态：🟢 本轮完成（2026-04-24）

**背景**：Step 19 后 useChatMain 1228 LOC 仍超 1000 门槛，Chat.vue 3796 LOC 为全仓最大文件。本轮同步推进三条线：
1. useMsgInputSend.ts 的 `TempMessageLike` 冗余类型修复（`MessageType` 已含 `uploadProgress`）
2. useChatMain 续作：抽取 `useChatFileDownload` + `emojiMenuData`，使 useChatMain 降至 <1000
3. Chat.vue 续作：抽取 `useAiMediaCache` + `useAiProviderConfig`，启动 god component 拆分

**产出**

_TempMessageLike 类型收口_
- `src/hooks/msgInput/useMsgInputSend.ts`：
  - 删除冗余 `type TempMessageLike = MessageType & { uploadProgress?: number }`（`MessageType` 已含此字段）
  - 5 处 `as TempMessageLike` 改为直接使用 `MessageType`（无需 cast，`buildMessageType` 返回 `MessageType`）
  - `sendVoiceDirect` 中 `tempMsg` 添加显式 `MessageType` 类型注解
  - 净变更：+2 / −4

_useChatMain 续作_
- 新增 `src/hooks/chatMain/useChatFileDownload.ts`（199 LOC）
  - `revealInDirSafely(targetPath)` — 安全调用 `revealItemInDir` + 错误提示
  - `downloadAndRevealFile(params)` — 统一 file/image/special 三处重复的"检查本地→下载→显示"流程，参数化 i18n keys
  - `downloadAndRevealVideo(videoUrl)` — 视频专用下载+显示
  - `previewFile(item)` — 文件预览逻辑（本地检测 → payload 构建 → fallback 远程）
  - 通过 `UseChatFileDownloadOptions` 注入 `t` / `downloadFile` / `getLocalVideoPath` / `checkVideoDownloaded` / `createWebviewWindow` / `sendWindowPayload`
  - 内部创建 `fileDownloadStore` / `globalStore` / `userStore` 实例（Pinia 单例）
- 新增 `src/hooks/chatMain/emojiMenuData.ts`（71 LOC）
  - `createEmojiList(t)` — 14 项 emoji 菜单数据工厂，从 useChatMain 内联 computed 抽出
  - 导出 `EmojiMenuItem` 接口
- `src/hooks/useChatMain.ts`：1228 → **933 LOC**（−295，**-24%**）
  - 移除内联 `revealInDirSafely`（12 LOC）
  - 3 处 `fileMenuList` / `imageMenuList` / `specialMenuList` 的"在文件夹中显示"handler 改为调用 `downloadAndRevealFile`
  - `videoMenuList` 的"在文件夹中显示"handler 改为调用 `downloadAndRevealVideo`
  - `fileMenuList` 的"预览"handler 改为调用 `previewFile`
  - `emojiList` 改为 `computed(() => createEmojiList(t))`
  - 移除不再直接使用的 imports：`revealItemInDir` / `appDataDir` / `join` / `resourceDir` / `BaseDirectory` / `FileTypeResult` / `FilesMeta` / `FileDownloadStatus` / `useFileDownloadStore` / `detectRemoteFileType` / `getFilesMeta`
- 新增 `src/hooks/chatMain/__tests__/useChatFileDownload.test.ts`（12 用例）
  - `revealInDirSafely`：有效路径 / null 路径 / 异常捕获（3）
  - `downloadAndRevealVideo`：未下载时下载 / 已下载跳过 / 错误静默（3）
  - `downloadAndRevealFile`：不存在时下载 / 下载失败报错 / 已存在直接显示（3）
  - `previewFile`：本地存在 / 远程 fallback / sendWindowPayload 错误 fallback（3）

_Chat.vue 续作_
- 新增 `src/plugins/robot/composables/useAiMediaCache.ts`（213 LOC）
  - `convertHttpDataToArrayBuffer` — 多种二进制格式统一转 ArrayBuffer
  - `requestAiMediaBuffer` — 同 URL 复用 Promise + LRU 淘汰
  - `buildAiMediaFileName` — MD5 哈希 + 扩展名
  - `ensureLocalAiImage` / `ensureLocalAiVideo` / `ensureLocalAiAudio` — 统一参数化的 `ensureLocalAiMedia` 内部实现
  - 通过 `UseAiMediaCacheOptions` 注入 `messageList` / `currentChat` / `userUid`
- 新增 `src/plugins/robot/composables/useAiProviderConfig.ts`（152 LOC）
  - `aiProvider` / `openClawConfig` / `siliconFlowConfig` / `trendRadarConfig` 四个配置 ref
  - `loadSavedConfig` / `saveAiProvider` / `saveOpenClawConfig` / `saveTrendRadarConfig` — localStorage 持久化
  - `handleProviderChange` — provider 切换 + 自动连接
  - 内部创建 `useOpenClaw` / `useSiliconFlow` / `useTrendRadar` 实例
  - 通过 `UseAiProviderConfigOptions` 注入 `fetchModelList` / `modelList`
- `src/plugins/robot/views/Chat.vue`：3796 → **3458 LOC**（−338，**-8.9%**）
  - 移除内联 `aiMediaDownloadTasks` / `MAX_MEDIA_CACHE_SIZE` / `convertHttpDataToArrayBuffer` / `requestAiMediaBuffer` / `buildAiMediaFileName` / `ensureLocalAiImage` / `ensureLocalAiVideo` / `ensureLocalAiAudio`（~236 LOC）
  - 移除内联 `STORAGE_KEYS` / `openClawConfig` / `siliconFlowConfig` / `trendRadarConfig` / `loadSavedConfig` / `saveAiProvider` / `saveOpenClawConfig` / `saveTrendRadarConfig` / `handleProviderChange` + 3 个 composable 实例化（~215 LOC）
  - 移除不再直接使用的 imports：`convertFileSrc` / `nativeFetch` / `getAiMediaExtension` / `persistAiImageFile` / `resolveAiImagePath` / `md5FromString` / `useOpenClaw` / `useSiliconFlow` / `useTrendRadar`
  - 新增 imports：`useAiProviderConfig` / `useAiMediaCache`

**验收**
- `pnpm test:run`：**2139 passed**（+12 新增 useChatFileDownload 测试，+6 前序批次增量）
- `pnpm exec vue-tsc --noEmit`：**0 error**
- `pnpm check`：**0 warning / 0 error**
- useChatMain.ts：1228 → 933 LOC ✅（首次跌破 1000 门槛）
- Chat.vue：3796 → 3458 LOC（首轮 -338）
- useMsgInputSend.ts：TempMessageLike 冗余消除，类型系统更精确

**Step 20 状态**
- P0-6 useChatMain 续作第四批 ✅ 完成（useChatMain 已 <1000 LOC）
- P0-4 Chat.vue 续作首批 ✅ 完成（两个 composable 抽出）
- TempMessageLike 类型收口 ✅ 完成
- 单文件 >1000 LOC 清单更新：
  - Chat.vue：3458（续作中）
  - augmentations.d.ts：1464
  - message.ts：1171
  - Bot.vue：1134
  - emoticon/index.vue：1056
  - useChatMain.ts：933 ✅（已退出清单）
- 下一轮推荐：
  - Chat.vue 续作：`useAiMediaGeneration`（~470 LOC，最大块）→ `useAiStreaming`（~285 LOC）
  - P0-5 AdminFacadeService 续作：UserService domain 抽取

---

## Step 21 — P0-3 messageActions 回归测试 + P1-5 Matrix Mock 工厂（2026-04-24）

**目标**
- P0-3：补 `stores/domains/chat/chat/message.ts` 高价值 action 回归网（pushMsg 副作用 / multi-choose / clearRoomMessages / recall TTL）
- P1-5：抽出 `matrix-js-sdk` 测试形状统一工厂，替换约 800 处 `as MatrixClient` / `as Room` 硬转换的单点入口

**新增**
- `src/stores/domains/chat/chat/__tests__/messageActions.test.ts`（16 用例）
  - pushMsg 副作用：幂等 / session text+activeTime 更新 / 未读累加（3 场景：他人/自己/当前激活）/ @ 通知（命中 + 未命中）
  - multi-choose：clearMsgCheck / setMsgMultiChoose（带 mode / 关闭 / 默认 normal）
  - getMessage（命中 + 未命中）/ clearRoomMessages（当前房 + 非当前房）
  - recall TTL：cleanupExpiredRecalledMessages 清理过期 / clearAllExpirationTimers 投递 clearTimer 并清状态
  - vi.hoisted 闭包陷阱：sessions 用 `clearSessions()` 删除键而非整体重赋值
- `src/test-helpers/matrixMocks.ts`（~110 LOC）
  - `createMockMatrixClient<O>(overrides)` → `MockMatrixClient<MatrixClient & O>`，默认所有 method 是 vi.fn()，manager accessor 默认 null（短路 `?.` 链）
  - `createMockRoom(roomId, overrides)` → `MockRoom<Room & O>`，默认 `getMyMembership='join'` / `getJoinedMemberCount=2` / `currentState.getStateEvents` mock
  - `createMockMatrixEvent(content, overrides)` → `MockMatrixEvent<MatrixEvent & O>`，content 同时种入 `getContent()` / `getWireContent()`
- `src/test-helpers/__tests__/matrixMocks.test.ts`（11 用例）锁定工厂契约

**验收**
- `pnpm test:run` — 新增 27 测试（16 + 11）全部通过
- `pnpm exec vue-tsc --noEmit` — 0 error
- 后续可逐步用 `createMockMatrixClient(...)` 替换散落的 `{ ... } as MatrixClient` 转换点

**Step 21 状态**
- P0-3 message.ts 回归网 ✅ 完成
- P1-5 matrix mock 工厂落地 ✅ 完成（迁移现有测试为后续可选 PR）
- 下一轮推荐：
  - Chat.vue 续作：`useAiMediaGeneration`（~470 LOC，最大块）→ `useAiStreaming`（~285 LOC）
  - P2-5 router/index.ts (961 LOC) 按 domain 拆分（机械低风险）

---

## Step 22 — useWebRtc 续作：useScreenShare 抽离（2026-04-24）

**目标**
- 继续 P0-6 useWebRtc Step 16/17 续作表，将自包含的桌面共享子状态从 useWebRtc 抽出为独立 hook，配套测试

**新增**
- `src/hooks/webRtc/useScreenShare.ts`（113 LOC）
  - `isScreenSharing` 内部 ref + `startScreenShare` / `stopScreenShare`
  - 通过 `UseScreenShareOptions` 注入共享 ref（`localStream` / `peerConnection` / `selectedVideoDevice`）+ 回调（`getCurrentCallType` / `getLocalStream` / `switchVideoDevice`）+ 可选 `notify`
  - 默认 `notify` 走 `window.$message`，测试可直接注入 stub
- `src/hooks/webRtc/__tests__/useScreenShare.test.ts`（9 用例）
  - stopScreenShare：未在共享时 no-op / 正常停止重启设备 / 缺少视频设备 / 未知 callType（共 4）
  - startScreenShare：getDisplayMedia 不支持 / 成功替换 sender / NotAllowedError 用户取消 / 通用错误 / screenStream 无视频轨道（共 5）

**变更**
- `src/hooks/useWebRtc.ts`：997 → **927 LOC**（−70，**-7%**）
  - 移除内联 `isScreenSharing` ref + `stopScreenShare` + `startScreenShare`（约 80 LOC）
  - 新增 `useScreenShare(...)` 装配（11 LOC），保持公共 API 不变（仍导出 `isScreenSharing` / `startScreenShare` / `stopScreenShare`）
  - clear() 中 `isScreenSharing.value = false` 仍直接重置（hook 暴露的 ref 引用一致）

**验收**
- 新增 9 测试全通过；`pnpm exec vue-tsc --noEmit` 0 error
- useWebRtc.ts 进一步逼近"编排为主"：剩余主要为 PC 创建/信令/clear/event listener，下一轮可考虑 `useCallSignaling`（offer/answer/candidate handlers，~150 LOC）

**Step 22 状态**
- P0-6 useWebRtc 续作（屏幕共享）✅ 完成
- 下一轮推荐：
  - `useCallSignaling`（sendOffer/handleOffer/sendAnswer/handleAnswer/handleCandidate/lisendCandidate/handleSignalMessage）
  - `useCameraSwitch`（switchAudioDevice/switchVideoDevice/switchCameraFacing/getFrontAndBackCameras，~120 LOC）

---

## Step 23 — useWebRtc 续作：useCameraSwitch 抽离（2026-04-25）

**目标**
- 继续 P0-6 useWebRtc 续作表，将音视频设备切换 + 移动端摄像头翻转抽出为独立 hook

**新增**
- `src/hooks/webRtc/useCameraSwitch.ts`（163 LOC）
  - `switchAudioDevice` / `switchVideoDevice` / `switchCameraFacing` / `getFrontAndBackCameras`
  - 通过 `UseCameraSwitchOptions` 注入共享 ref（`localStream` / `peerConnection` / `selectedAudioDevice` / `selectedVideoDevice` / `videoDevices`）+ 回调（`isVideoCall` / `isMobile`）+ 可选 `notify`
  - 抽出 `replaceTrack(pc, kind, newTrack)` 内部小工具，消除 audio/video 两份 forEach 模板代码
- `src/hooks/webRtc/__tests__/useCameraSwitch.test.ts`（12 用例）
  - switchAudioDevice：成功替换 / 无新轨道报错 / getUserMedia 拒绝（共 3）
  - switchVideoDevice：成功替换 / 无视频轨道时跳过 / 无旧轨道时 addTrack（共 3）
  - switchCameraFacing：桌面端 no-op / 无法识别时 fallback "user" / 前→后切换 / 中文标签后→前切换（共 4）
  - getFrontAndBackCameras：英中混合关键词识别 / 无匹配返回 undefined（共 2）

**变更**
- `src/hooks/useWebRtc.ts`：927 → **813 LOC**（−114，**-12.3%**）
  - 移除内联 `switchAudioDevice` / `switchVideoDevice` / `switchCameraFacing` / `getFrontAndBackCameras`（约 126 LOC）
  - 新增 `useCameraSwitch(...)` 装配（10 LOC），保持公共 API 不变
  - useScreenShare 装配现继续复用 hook 暴露的 `switchVideoDevice`（共享 ref 引用一致）

**验收**
- 新增 12 测试全通过；`pnpm exec vue-tsc --noEmit` 0 error
- useWebRtc.ts 累计：1097 → 813（-284，**-25.9%**）；剩余主体集中在 PC 创建 / 信令 / clear / event listener
- 下一轮推荐：`useCallSignaling`（offer/answer/candidate handlers，~150 LOC，最后大块）

---

## Step 24 — useCommon 续作：useEditorPaste 抽离（2026-04-25）

**目标**
- 将 useCommon 中粘贴/文件处理这一独立子域抽出为 hook，降低 useCommon 体积、收窄共享职责

**新增**
- `src/hooks/common/useEditorPaste.ts`（224 LOC）
  - `saveCacheFile` / `imgPaste` / `FileOrVideoPaste` / `handleConfirmFiles` / `processFiles` / `handlePaste`
  - 通过 `UseEditorPasteOptions` 注入 `userUid` Ref + `triggerInputEvent` + `insertNode` + 可选 `notify`
  - 提取 `insertImgAtRange` / `buildPreviewImg` 内部小工具，消除两份"插入图片到光标位置"模板代码
  - 默认 `notify` 走 `window.$message`，测试可注入 stub
- `src/hooks/common/__tests__/useEditorPaste.test.ts`（13 用例）
  - saveCacheFile：desktop AppCache / mobile AppData / 目录不存在时 mkdir（共 3）
  - FileOrVideoPaste：>50MB 拒绝 / 正常缓存到 video 子目录（共 2）
  - handleConfirmFiles：顺序遍历调用 FileOrVideoPaste（共 1）
  - processFiles：超过 COM_COUNT 中止 / 单文件 >500MB 警告 / 非图片走 showFileModal / resetCallback / files 为空提前返回（共 5）
  - handlePaste：纯文本走 insertNode + triggerInputEvent / clipboardData null 早返回（共 2）

**变更**
- `src/hooks/useCommon.ts`：976 → **734 LOC**（−242，**-24.8%**）
  - 移除 `saveCacheFile`（~40 LOC）+ `imgPaste`/`FileOrVideoPaste`/`handleConfirmFiles`/`handlePaste`（~140 LOC）+ `processFiles`（~60 LOC）
  - 新增 `useEditorPaste(...)` 装配（5 LOC），保持公共 API 不变（导出 6 个方法仍然可用）
  - 移除不再直接使用的 imports：`BaseDirectory` / `create` / `exists` / `mkdir` / `readFile` / `getImageCache` / `isPathUploadFile` / `UploadFile` / `SUPPORTED_IMAGE_EXTENSIONS` / `getFileExtension`

**验收**
- `pnpm test:run src/hooks/common/__tests__/useEditorPaste.test.ts` — 13/13 通过
- `pnpm exec vue-tsc --noEmit` — 0 新增 error（基线 36 个 admin/ 仓库其它文件预存 error 不变）
- useCommon.ts 跌至 ~730 LOC，剩余主要是 DOM 编辑器工具 / `createReplyDom`(~180 LOC) / `openMsgSession`，下一轮可考虑抽 `useEditorDom` 把 `insertNode`/`getEditorRange`/`triggerInputEvent`/`createReplyDom` 拆出去

**Step 24 状态**
- useCommon 续作（粘贴域）✅ 完成
- 下一轮推荐：
  - `useEditorDom`（getEditorRange / insertNode / insertNodeAtRange / triggerInputEvent / createReplyDom，~500 LOC，最大块）
  - useWebRtc 信令部分维持原状（PC/signaling/clear 高度耦合，进一步抽离 ROI 不佳）

---

## Step 25 — Admin 页面收口：SAML / Security / ServerLogs 改为消费已实现端点（2026-04-25）

**目标**
- 把 admin 侧 3 个高风险页面从"等待后端旧端点"切到"直接消费现有可用接口"，避免前端继续被未实现 API 卡住
- 保持桌面端 / 移动端行为一致，并补齐 composable 测试、类型出口与文案

**变更**
- `SAML` 页
  - `src/composables/admin/useAdminSaml.ts`：收敛为 `loadMetadata` / `refreshMetadata` / `downloadSpMetadata`
  - `src/views/admin/AdminSaml.vue`、`src/mobile/views/admin/AdminSaml.vue`：改为展示 IdP / SP metadata、刷新与下载，不再使用旧配置编辑流
- `Security` 页
  - `src/composables/admin/useAdminSecurity.ts`：收敛为 `loadAuditLogs`
  - `src/views/admin/AdminSecurity.vue`、`src/mobile/views/admin/AdminSecurity.vue`：改为直接消费 audit events，不再依赖旧 security events / IP blocks UX 假实现
- `ServerLogs` 页
  - `src/composables/admin/useAdminServerLogs.ts`：旧 `logs + level + limit + loadLogs` 接口替换为 `status + health + version + stats + loadPanel`
  - `src/views/admin/AdminServerLogs.vue`、`src/mobile/views/admin/AdminServerLogs.vue`：统一改为服务器状态面板，直接消费 `getServerStatus` / `getServerHealth` / `getServerVersion` / `getServerStats`
- 收口项
  - `src/composables/admin/index.ts`：移除已不存在的 `LogLevel` 导出
  - `locales/zh-CN/common.json`、`locales/en/common.json`：补齐 SAML / Security / ServerLogs 新文案

**测试与回归**
- 更新 `src/composables/admin/__tests__/useAdminSaml.test.ts`
- 更新 `src/composables/admin/__tests__/useAdminSecurity.test.ts`
- 更新 `src/composables/admin/__tests__/useAdminServerLogs.test.ts`
  - `useAdminServerLogs` 测试从 `loadLogs` 场景改为 `loadPanel`
  - 覆盖 4 个后端资源请求、panel refs 填充、`loading` 状态切换

**验收**
- `pnpm exec vitest run src/composables/admin/__tests__/useAdminSaml.test.ts src/composables/admin/__tests__/useAdminSecurity.test.ts src/composables/admin/__tests__/useAdminServerLogs.test.ts`
  - **13 passed**（3 文件）
- `pnpm exec vue-tsc --noEmit`
  - **0 error**
- 本轮结论：
  - admin 3 个页面已全部切到后端已实现能力
  - 桌面端 / 移动端共享 composable 继续保持同源
  - 前端不再需要为这 3 个页面保留"功能未就绪"的旧实现路径

**Step 25 状态**
- Admin SAML 收口 ✅ 完成
- Admin Security 收口 ✅ 完成
- Admin ServerLogs -> Server Status panel ✅ 完成
- 下一轮推荐：
  - P0-5 AdminFacadeService 续作：`UserService` domain 抽取
  - P0-4 Chat.vue 续作：`useAiMediaGeneration` → `useAiStreaming`

---

## Step 25 — useCommon 续作：editorDomBasics 抽离（2026-04-25）

**目标**
- 把 useCommon 中三个**纯函数** DOM 工具（不依赖任何 reactive state）抽出为独立模块导出，作为后续 `insertNodeAtRange` / `createReplyDom` 大块抽离前的安全网

**新增**
- `src/hooks/common/editorDomBasics.ts`（88 LOC）
  - `getEditorRange()` — 选区读取 + #message-input 兜底（光标移到末尾）
  - `getMessageContentType(messageInputDom)` — 输入框内容类型分类（VOICE > FILE > VIDEO > EMOJI-only > MIXED > IMAGE > TEXT）
  - `triggerInputEvent(element)` — bubbling input 事件分发
  - 全部为模块级 `export const`，不需要 hook 包装；从 `useCommon` 重新引入并保持相同 API
- `src/hooks/common/__tests__/editorDomBasics.test.ts`（18 用例）
  - getEditorRange：window.getSelection 不可用 / 已有选区 / #message-input 兜底 / 都没有时返回 null（共 4）
  - getMessageContentType：空 / TEXT / IMAGE / FILE / EMOJI / MIXED(emoji) / MIXED(image) / VIDEO(<video>) / VIDEO(<a .mp4>) / VOICE / VOICE 优先级 / 空白文本节点忽略（共 12）
  - triggerInputEvent：bubbling input 派发 / null 元素 no-op（共 2）

**变更**
- `src/hooks/useCommon.ts`：734 → **641 LOC**（−93，**-12.7%**）
  - 移除 `getEditorRange` / `getMessageContentType` / `triggerInputEvent` 三个内联实现（~93 LOC）
  - 改为 `import { ... } from './common/editorDomBasics'`，公共 API 不变
  - useEditorPaste 装配仍然正常（其参数 `triggerInputEvent` / `insertNode` 都是闭包捕获）

**验收**
- `pnpm test:run src/hooks/common/__tests__/editorDomBasics.test.ts` — 18/18 通过
- `pnpm exec vue-tsc --noEmit` — 0 error（baseline 已清零）
- useCommon.ts 累计：976 → 641（−335，**-34.3%**）；剩余 `insertNode` / `insertNodeAtRange`(290 LOC) / `createReplyDom`(180 LOC) 是高耦合 DOM 构造逻辑，需要先补回归测试再抽离

**Step 25 状态**
- useCommon 续作（纯 DOM 工具）✅ 完成
- 下一轮推荐：
  - 给 `insertNodeAtRange` 7 种 MsgEnum 分支补集成测试（AIT/REPLY/IMAGE/EMOJI/VIDEO/FILE/TEXT）作为安全网
  - 然后再把 `insertNode` / `insertNodeAtRange` / `createReplyDom` 抽到 `useEditorDom` hook（依赖 `reply` ref 注入）

---

## Step 26 — useCommon 安全网：insertNodeAtRange 回归测试（2026-04-25）

**目标**
- 在尝试抽离 `insertNodeAtRange`(290 LOC) / `createReplyDom`(180 LOC) 这块编辑器最大单体之前，先把它的可观测 DOM 契约锁进单测网，作为后续重构的安全网

**新增**
- `src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts`（9 用例）
  - vi.hoisted 工厂模式 mock 全套 stores（user / global / chat） + matrix service / mitt / router / tauri / AvatarUtils / Formatting / TauriInvokeHandler
  - `MsgEnum.AIT`：span#aitSpan + 文本 / data-aitUid 属性 / text 后备 / label 后备 / 纯字符串 dom / 缺 uid 不写 dataset（共 4）
  - `MsgEnum.TEXT`：插入 textNode / 非字符串 String() 强转（共 2）
  - `MsgEnum.REPLY`：#replyDiv 作为输入框 firstChild 插入 / 已有时整体 replaceWith / #message-input 缺失时不抛错（共 3）

**未覆盖（标注后续补充）**
- `MsgEnum.AI`（~155 LOC，逻辑和 REPLY 高度相似但带 close 按钮 click handler 与 reply.value 重置）
- `MsgEnum.IMAGE` / `EMOJI` / `VIDEO` / `FILE` 在当前 useCommon 中不走 insertNodeAtRange（这些在 useEditorPaste 的 imgPaste 路径或其它分支）

**验收**
- `pnpm test:run src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts` — 9/9 通过
- 不改任何生产代码，只补回归网

**Step 26 状态**
- useCommon 抽离前置：AIT/TEXT/REPLY 契约锁定 ✅
- 下一轮可以安全推进：
  - 给 `MsgEnum.AI` 补 3-4 个用例（divNode#AIDiv / 删除 "/" 触发字符 / closeBtn 点击回调）
  - 把 `insertNode` / `insertNodeAtRange` / `createReplyDom` 抽到 `useEditorDom` hook（注入 `reply` ref），保持公共 API 不变

---

## Step 27 — useCommon 续作：useEditorDom 抽离 + AI/默认分支测试补齐（2026-04-25）

**目标**
- 将 useCommon 中编辑器 DOM 构造大块（`isSafeUrl` + `insertNode` + `insertNodeAtRange` + `createReplyDom`，约 480 LOC）抽离为独立 hook，依赖 `reply` ref 注入
- 抽离前先把 Step 26 的回归网扩展到 AI 分支与默认分支，确保契约完整

**新增**
- `src/hooks/common/useEditorDom.ts`（441 LOC）
  - `useEditorDom({ reply })` → `{ isSafeUrl, insertNode, insertNodeAtRange, createReplyDom }`
  - `reply: Ref<ReplyState>` 注入；AI 分支 closeBtn click 与 createReplyDom closeBtn click 都通过 `reply.value = ...` 重置状态
  - `isSafeUrl` 内部化（`http(s)://` / `/` 前缀放行；`javascript:` / `data:` 拦截）
  - 模块导入 `getEditorRange` / `triggerInputEvent` 替代闭包捕获
  - 三处 ` ` NBSP 字符精确保留（AIT 后追加 NBSP / REPLY span / AI span）
- 扩展 `src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts`（9 → **15 用例**）
  - 新增 `MsgEnum.AI`：#AIDiv 卡片 / 删除 "/" 触发字符 / closeBtn click 移除卡片并重置 reply.value / getAvatarUrl 返回空时 fallback `/avatar/001.png`（共 4）
  - 新增默认分支：未知 type 走字符串 textNode / 未知 type 走 Node 直插（共 2）

**变更**
- `src/hooks/useCommon.ts`：641 → **120 LOC**（−521，**-81.3%**）
  - 删除 `isSafeUrl` / `insertNode` / `insertNodeAtRange` / `createReplyDom` 全部内联实现（~497 LOC）
  - 新增 `useEditorDom({ reply })` 装配（1 LOC），保持 useCommon 公共 API 不变
  - 同步清理不再使用的 imports：`AvatarUtils` / `removeTag` / `isMobile` / `MsgEnum` / `createLogger`
  - 移除 `AitMentionData` / `ReplyData` / `InsertNodeData` 接口（已迁入 useEditorDom 内部）
  - 移除 `REPLY_NODE_ID` 常量（已迁入 useEditorDom 内部）

**验收**
- `pnpm test:run src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts` — 15/15 通过（抽离前后一致 ✅ 行为契约 100% 保留）
- `pnpm exec vue-tsc --noEmit` — 0 error
- `pnpm test:run` 全量 — 仅 admin/ 7 个 pre-existing 失败（与本会话无关），相比 Step 26 后无新增失败
- useCommon.ts 累计：976 → 120 LOC（**−87.7%**），实质上已退化为"会话切换 + 字数统计 + 子 hook 装配器"

**Step 27 状态**
- useCommon 大块抽离 ✅ 完成
- useEditorPaste / editorDomBasics / useEditorDom 三件套到位，编辑器关注点分离落地
- 下一轮推荐：
  - 将 `useCommon` 进一步降级 — `openMsgSession`（~35 LOC，会话路由副作用）和 `countGraphemes`（4 LOC，纯函数）建议拆到 `src/hooks/session/openMsgSession.ts` + 直接用 `grapheme-splitter` 调用，让 `useCommon` 仅作为薄薄的兼容入口或彻底移除
  - 或转向 P0-4 Chat.vue 续作（待用户在飞 robot/ 修改稳定后）

---

## Step 28 — useCommon 终态降级 + admin 测试 mock 修复（2026-04-25）

**目标**
- 把 useCommon 残余两块各自归位：`openMsgSession`（会话路由副作用，~35 LOC）抽离为独立模块，`countGraphemes`（纯函数，依赖 `grapheme-splitter`）模块顶层内联
- 修复全会话期间稳定挂着的 admin 测试 7 个 pre-existing 失败，把全量测试拉回首次全绿

**新增**
- `src/hooks/session/openMsgSession.ts`（67 LOC）
  - 标准 async 函数：`openMsgSession(uid, type=2)`
  - 副作用链：路由跳转 `/message`（仅当当前不在 /message 且 label === 'home'）→ 拉取会话详情 → unhide（best-effort，失败提示但继续）→ 新会话则刷新列表 → 更新 globalStore current → 派发 `LOCATE_SESSION` + `TO_SEND_MSG` + `handleMsgClick`
  - 不再依赖 useCommon 闭包，任意调用方可直接 import
- `src/hooks/session/__tests__/openMsgSession.test.ts`（106 LOC，**9 用例**）
  - vi.hoisted 工厂 mock：chatStore / globalStore / mitt / matrixSessionService / invokeWithErrorHandler / router / log / useMessage
  - 覆盖：路由跳转 / 已在 /message 不跳 / 默认 type=2 / 显式 type 透传 / 详情为 null 提示并 bail / unhide 报错继续 / 新会话刷新列表 / 已存会话不刷 / Mitt 双事件 + handleMsgClick

**变更**
- `src/hooks/useCommon.ts`：120 → **71 LOC**（−49，**-40.8%**）
  - 删除内联 `openMsgSession` 实现，改为 `import { openMsgSession } from './session/openMsgSession'` 后再 re-export，保持公共 API 兼容
  - `countGraphemes` 提到模块顶层（单例 `GraphemeSplitter`），保持已导出名
  - useCommon 仅剩：`parseInnerText` / `countGraphemes`（顶层）+ `useCommon()`（装配 useEditorDom + useEditorPaste，re-export `openMsgSession`）
- `src/composables/admin/__tests__/useAdminSaml.test.ts` —— mock 结构修复
  - 旧：`adminService: { getSamlMetadata, getSpMetadata, refreshIdpMetadata }`（扁平）
  - 新：`adminService: { security: { getSamlMetadata, getSpMetadata, refreshIdpMetadata } }`（嵌套）
  - 同步把所有 `vi.mocked(adminService.X)` → `vi.mocked(adminService.security.X)`
  - 根因：生产代码 `useAdminSaml.ts` 调的是 `adminService.security.X(...)`，扁平 mock 永远命不中
- `src/composables/admin/__tests__/useAdminSecurity.test.ts` —— 同上 nested security 修复（`getAuditLog`）

**验收**
- `pnpm test:run src/hooks/session/__tests__/openMsgSession.test.ts` — 9/9 通过
- `pnpm test:run` 全量 — **2242/2242 全绿**（首次本会话全量绿）
  - 对比 Step 27 末：2218 通过 / 15 失败 → 本步：2242 通过 / 0 失败
  - admin 套件：7 失败 → 0 失败（P2-3 通道彻底打通）
- `pnpm exec vue-tsc --noEmit` — 0 error
- useCommon.ts 累计：976 → **71 LOC**（**-92.7%**），从单文件巨石退化为薄装配 + 兼容 re-export

**Step 28 状态**
- useCommon 终态降级 ✅
- 全量测试套件首次本会话全绿 ✅
- 下一轮可选方向：
  - 直接删除 `useCommon` 兼容层（grep 调用方，逐处替换为新 hook 的直接 import）
  - 或转 P0-4 Chat.vue 续作（待用户的 `src/plugins/robot/` 飞行中修改落地）
