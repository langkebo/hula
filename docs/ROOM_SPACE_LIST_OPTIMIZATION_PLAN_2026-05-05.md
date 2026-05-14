# 房间列表与空间列表优化方案 (2026-05-05)

> 参考 [HuLaSpark/HuLa](https://github.com/HuLaSpark/HuLa) 项目的 UI 布局风格，结合
> `../matrix-js-sdk/docs/api-contract/` 下的 SDK 契约文档，针对 hula 工程的房间列表
> （`/message`、`/room`）与空间列表（`/space`）制定详细的 UI/交互完善方案。
> 在保留 HuLaSpark 简洁、轻量、IM 化视觉风格的同时，确保前端能力与 synapse-rust 后端契约
> 完全对齐。

## 0. 现状盘点

### 0.1 已落地资产

- **页面层**
  - `src/views/homeWindow/message/index.vue` — 工作台消息会话列表（含搜索、过滤、邀请处理）
  - `src/views/homeWindow/RoomList.vue` — 房间列表（含创建房间、邀请、设置浮层）
  - `src/views/homeWindow/SpaceList.vue` — 空间列表（含 invite / add-room / settings 三种管理态）
- **工作台壳与组件**
  - `src/components/workbench/ListWorkbenchShell.vue`
  - `src/components/workbench/MessageSessionToolbar.vue`
  - `src/components/workbench/RoomSessionList.vue`
  - `src/components/workbench/RoomSpaceWorkbench.vue`
  - `src/components/workbench/RoomSpaceToolbar.vue`
  - `src/components/workbench/RoomSpaceActionBar.vue`
  - `src/components/workbench/SpaceListPane.vue`
  - `src/components/workbench/WorkbenchDetailPane.vue`
  - `src/components/workbench/HulaRoomListItem.vue`
  - `src/components/workbench/HulaSpaceTree.vue`
  - `src/components/workbench/HulaSpaceJoinCta.vue`
  - `src/components/workbench/HulaRoomSummaryPanel.vue`
- **可组合函数**
  - `src/composables/useSpace.ts`
  - `src/composables/useSpaces.ts`
  - `src/composables/space/useSpaceMembers.ts`
  - `src/composables/space/useSpaceRooms.ts`
  - `src/composables/workbench/useMessageSessionFilters.ts`
  - `src/composables/workbench/useRoomSpaceWorkbench.ts`
  - `src/composables/workbench/useWorkbenchSessionQuerySync.ts`
- **服务层 (`src/services/matrix/room/`)**
  - `MatrixRoomService` / `MatrixGroupService` / `MatrixSpaceService`
  - `MatrixRoomSummaryService` / `RoomListService` / `RoomNavigationService`
  - `MatrixRoomTagsService` / `MatrixRoomMetadataService` / `MatrixRoomNotificationService`

### 0.2 主要差距

| 类别 | 差距 | 直接证据 |
| --- | --- | --- |
| 视觉一致性 | 房间/空间列表的卡片间距、头像形状、徽标位置与 HuLaSpark 微信化布局存在差异 | `HulaRoomListItem.vue`、`SpaceListPane.vue` |
| 未读/提醒 | 当前依赖 `unreadCount` 单一字段，缺少 highlight count、is_silent、tag-pinned 等区分 | `room.md` 提供 `/rooms/{id}/unread_count`、`/notifications` |
| 空间层级 | 仅平铺展示，未利用 `/spaces/{id}/hierarchy/v1` 与 `tree_path` | `space.md` 第 3、4、5 节 |
| 房间发现 | 缺少公开空间浏览与搜索入口 | `space.md` `/spaces/public`、`/spaces/search` |
| 能力网关 | 未读取 `/rooms/{id}/capabilities`，导致部分按钮在不支持的房间上仍可点 | `room.md` 第 8 节 |
| 元信息 | 房间摘要面板未消费 `RoomSummary.heroes`、`last_message_ts` 等字段 | `room-summary.md` |
| 标签管理 | tags 服务存在但未在 UI 中暴露（置顶/收藏/低优先级） | `tags.md` |
| 实时性 | Sliding Sync 已接入，但 429 RetryableError 在 UI 层缺乏可见反馈 | `sliding-sync.md` |

## 1. 设计原则

1. **视觉与 HuLaSpark 对齐**：列表项采用 48px 头像 + 双行内容 + 时间右对齐 + 角标徽章的 IM 经典布局，主色 `#13987f`，hover 用 `--hula-surface-list-hover`，激活态用 `--hula-surface-session-active`。
2. **契约驱动**：UI 上每一个状态/动作必须有 SDK 契约支撑，不臆造接口。无契约的功能（如自定义分组排序）必须先在 `docs/api-contract/` 提案，再实施。
3. **能力分层渐进披露**：主页面只暴露 5 个核心动作（消息/视频/语音/邀请/置顶），其余进入侧栏 + 右键菜单。
4. **空间为内容容器，房间为对话容器**：空间侧栏 + 房间会话列表为双列叙事，详情面板始终复用 `WorkbenchDetailPane`。
5. **单一数据流**：所有列表数据来自 Pinia store + Sliding Sync；REST 仅用于细粒度补充（hierarchy、capabilities、tags）。

## 2. 视觉系统对齐 (HuLaSpark Style)

### 2.1 设计 Token 复用

沿用 `src/styles/scss/global/variable.scss` 已有 token，新增以下语义键并仅在以下三个组件落地：

- `--hula-surface-list-hover`（已存在，沿用）
- `--hula-surface-session-active`（已存在，沿用）
- `--hula-badge-mention`（新增，与主色互补的红色，用于 `@me` 计数）
- `--hula-badge-silent`（新增，灰色圆点，用于静音房间未读提示）
- `--hula-row-divider`（新增，用于会话行 1px 内嵌分割线，仅 hover 时显示）

### 2.2 列表项规范 (`HulaRoomListItem`)

- **结构**：`avatar(48) → main(name + last_msg) → meta(time + badge)`
- **头像**：圆形（单聊）/ 12px 圆角（群组、空间）；右下角 6px 状态点（在线/离线/忙碌）。
- **名称行**：14px，单行省略；右侧时间 12px，`--hula-text-tertiary`。
- **预览行**：13px，单行省略；如有 highlight count，前缀以 `[有人@我]`（i18n）。
- **角标**：
  - 静默房间（is_silent / shield）：右下角 8px 灰点；
  - 普通未读：红底数字徽章；
  - 含 `@me`：徽章使用 `--hula-badge-mention`，并显示 `1` 而非总数（HuLaSpark 行为）。
- **置顶**：`top=true` 时整行加 `bg-[--hula-surface-search] rounded-12px`，与 `index.vue` 中 `getItemClasses` 一致，保持现有规则。
- **右键菜单**：复用 `ContextMenu`，新增「置顶/取消置顶」「标记已读」「设为收藏 (m.favourite)」「设为低优先级 (m.lowpriority)」「离开/拒绝邀请」「显示在文件夹中」六项。

### 2.3 空间侧栏 (`SpaceListPane`)

- **顶部**：搜索框 + 创建空间按钮（HuLaSpark 风格的小号 secondary `n-button`）。
- **空间项**：48px 圆角 12px 头像 + 名称 + 子房间数。窄屏（<1200px）只保留头像 + tooltip 名称。
- **当前空间高亮**：左侧 3px 圆角竖线 `--hula-color-primary-500`。
- **展开/收起**：基于 `/spaces/{id}/hierarchy/v1?max_depth=1` 懒加载，不一次性拉取深层。
- **拖拽排序**：基于 user account_data 自定义 `m.space_order` (写回需 SDK 支持，先做读侧实现，写侧待后端补契约)。

### 2.4 工作区面包屑

- 在 `RoomSpaceToolbar` 顶部增加面包屑：`空间名 / 子空间 / 房间名`，由 `/spaces/{id}/tree_path` 提供。
- 面包屑节点 hover 时展开兄弟节点跳转，借鉴 HuLaSpark 文件管理样式。

## 3. 后端契约 → UI 能力映射

### 3.1 房间列表（`/message`、`/room`）

| 能力 | 端点 | 现状 | 计划 |
| --- | --- | --- | --- |
| 会话快照 | Sliding Sync `POST /sync/sliding` | 已接入 | 增加 429 退避提示条（复用 `networkBanner`）|
| 未读/提及精确计数 | `GET /rooms/{room_id}/unread_count` | 未使用 | 在 `chatStore.markSessionRead` 之外新增 `RoomNotificationService.fetchUnreadCount(roomId)`，刷新红点与 highlight |
| 房间元数据 | `GET /rooms/{room_id}/metadata` | 未使用 | `HulaRoomSummaryPanel` 拉取 description/topic 显示 |
| 房间能力 | `GET /rooms/{room_id}/capabilities` | 未使用 | `RoomCapabilitiesService` 新增；按结果禁用「视频通话」「Threads」入口 |
| 通知规则 | `GET /rooms/{room_id}/notifications` | 未使用 | 用于面板展示静音状态、@me 个数；触达后调 `markSessionRead` |
| 标签 | `GET/PUT/DELETE /rooms/{room_id}/tags/{tag}` | 已有 service 未联 UI | 右键菜单「置顶 (m.favourite)」「低优先级 (m.lowpriority)」「自定义文件夹 (u.*)」并响应 account_data 推送 |
| 摘要 | `GET /rooms/{room_id}/summary` + `room-summary.md` | 部分 | 列表项使用 `last_message_ts/last_event_ts` 计算时间，Heroes 用于 1:1/小群名兜底 |

### 3.2 空间列表（`/space`）

| 能力 | 端点 | 现状 | 计划 |
| --- | --- | --- | --- |
| 我的空间 | `GET /spaces/user` | 部分 | `useSpaces` 输出主侧栏数据 |
| 空间层级 | `GET /spaces/{id}/hierarchy/v1?max_depth&suggested_only` | 未使用 | `HulaSpaceTree` 改为按需加载子级 |
| 空间路径 | `GET /spaces/{id}/tree_path` | 未使用 | 顶部面包屑 |
| 房间反查 | `GET /spaces/room/{room_id}/parents` | 未使用 | 列表项右键「在空间中显示」 |
| 综合摘要 | `GET /spaces/{id}/summary/with_children` | 未使用 | 进入空间时单次拉取，避免多请求 |
| 公开空间 | `GET /spaces/public?limit&since` | 未使用 | 「发现空间」抽屉 |
| 搜索 | `GET /spaces/search?q&limit` | 未使用 | 顶部搜索框 typeahead，250ms 防抖 |
| 增删改 | `POST/PUT/DELETE /spaces` & 子项 `/spaces/{id}/rooms` | 部分 | UI 完整覆盖创建/重命名/解散/移除子房间 |
| 成员 | `GET /spaces/{id}/members` + `/members/{user_id}/power_level` | 部分 | 成员卡显示角色徽章；操作按钮基于 power level 做权限网关 |

### 3.3 同步与稳定性

- Sliding Sync 重连：`SlidingSyncReconnectManager` 已存在；UI 端在 `RoomSpaceWorkbench` 顶部加入 `network-banner` 退避计数条（已在 `useNetworkStatus` 暴露）。
- 失败重试：所有 list/hierarchy 请求统一通过 `MatrixRequestDeduper` + 指数退避；429 错误展示「正在限速重试…」。

## 4. 组件级改造清单

### 4.1 `RoomList.vue`（主消息列表入口）

1. 顶部工具栏新增「全部 / 未读 / 提及 / 邀请」过滤器，沿用 `MessageSessionToolbar`，新增 `mention` 过滤值。
2. 列表项按 `tags.m.favourite > top > activeTime` 三级排序；置顶组与普通组中间插入 8px gap + 1px 分隔线。
3. 邀请项保留现有 Accept/Reject，按钮使用主色填充按钮（HuLaSpark 风格），失败时使用 `n-message` toast 而非 alert。
4. 右键菜单实现「置顶/取消置顶」（写 `m.favourite` 标签）、「标记已读」（调 `markSessionRead` + `unread_count` 二次校验）、「在空间中显示」（拉 `parents`，定位到对应空间）。
5. 接入 `capabilities`，禁用群组场景下不支持的「视频通话」按钮。

### 4.2 `SpaceList.vue` + `RoomSpaceWorkbench.vue`

1. 引入面包屑 + 当前空间 banner（成员数 / 房间数 / 公开私有标识）。
2. 子空间懒加载：`HulaSpaceTree` 节点点击展开时 `useSpaceRooms.fetchHierarchy(parentId, depth=1)`。
3. `RoomSpaceActionBar` 增加「发现公开空间」「邀请成员」「成员管理」按钮，分别打开抽屉/弹窗，复用 `AddToSpaceDialog` 等已有组件。
4. 设置态保留三段（基础资料 / 成员 / 子房间），新增「危险区域」section 用于「解散空间」(`DELETE /spaces/{id}`)，需二次确认 + power level≥100 才出现。

### 4.3 `HulaSpaceTree.vue`

1. 节点宽度自适应；图标支持空间私有/公开/邀请徽章。
2. 支持键盘 ←→ 收起/展开；Enter 切换当前空间。
3. 拖拽 reorder（先做本地排序，写回等后端接口）。

### 4.4 `WorkbenchDetailPane.vue`

1. 房间详情：`RoomSummary.heroes` + `joined_member_count` 渲染；置顶头像最多 4 人。
2. 增加「父空间」一栏，列出 `parents` 路径，点击跳转。
3. 公告 (`m.room.topic`)、加密状态 (`matrixEncryptionService.isRoomEncrypted`)、capabilities 三块并排呈现。

### 4.5 `HulaRoomListItem.vue`

1. 接收 `highlightCount`、`isSilent`、`isFavourite`、`isLowPriority` 等扩展 props。
2. 内部使用 CSS 变量；不再硬编码颜色。
3. 提供右键事件透传，让父级决定菜单内容（避免与 ContextMenu 双绑）。

## 5. 数据流与状态层

### 5.1 新增 Pinia 切片（增量，不拆分现有 store）

- `chatStore.unreadDetail: Record<roomId, { total: number; highlight: number; silent: boolean }>`
  - 由 `MatrixRoomNotificationService` 与 Sliding Sync 推送共同写入；
  - 提供 `getUnreadDetail(roomId)` getter；
- `roomStore.tagsByRoom: Record<roomId, Record<tagName, { order?: number }>>`
  - 来源：account_data `m.tag` + `MatrixRoomTagsService.list`；
  - 写入：`addTag/removeTag` action。
- `spaceStore.hierarchyCache: Record<spaceId, { children: SpaceChild[]; expiresAt: number }>`
  - 由 `MatrixSpaceService.fetchHierarchy` 写入；TTL 60s。

### 5.2 服务层补充

- `RoomCapabilitiesService.fetch(roomId)` — wrap `client.http.authedRequest(GET /rooms/{id}/capabilities)`，结果缓存 5 分钟。
- `MatrixRoomNotificationService.fetchUnreadCount(roomId)` — 已存在 service 中扩展方法。
- `MatrixSpaceService.discoverPublic(params)` / `searchSpaces(q)` — 已有 service 增方法。
- `MatrixSpaceService.parentsOf(roomId)` — `/spaces/room/{room_id}/parents`。
- `MatrixSpaceService.treePath(spaceId)` — `/spaces/{id}/tree_path`。

所有方法严格遵循「不直接调 SDK，统一通过 service 层」（CLAUDE.md 要求）。

## 6. 国际化与可访问性

- 新增 i18n 键集中在 `home.workbench.*` 与 `space.workbench.*` 下，避免和已有 `home.friends_list.*` 冲突。
- 所有按钮加 `aria-label`，列表项使用 `role="listitem"`，`HulaSpaceTree` 使用 `role="tree"/treeitem`。
- 颜色对比度核对：在浅色主题下，`--hula-text-secondary` 在 `--hula-surface-panel` 上至少 4.5:1。

## 7. 性能与稳定性

- 房间列表渲染使用 `RoomSessionList` 现有的虚拟滚动；新增项不引入额外 watcher。
- `HulaSpaceTree` 节点 ≤ 200 时直渲染，> 200 走 vue-virtual-scroller（已在依赖中）。
- Sliding Sync 增量更新触发的 list re-sort 必须复用 `sessionList.computed`（已是 O(n log n)）。
- 所有 REST 请求经 `MatrixRequestDeduper`，相同 key 合并；429 由 `SlidingSyncReconnectManager` 统一重试。

## 8. 测试计划

- **单测 (Vitest)**
  - `RoomCapabilitiesService` 缓存与失败回退
  - `MatrixSpaceService` `discoverPublic` / `treePath` / `parentsOf`
  - `chatStore.unreadDetail` 合并逻辑
  - `useMessageSessionFilters` 增加 mention 过滤分支
- **E2E (Playwright)**
  - 登录 → 进入 `/space/:id` → 展开子空间 → 跳转到房间 → 出现 `WorkbenchDetailPane`
  - 邀请房间 Accept / Reject 流程的 toast 与列表更新
  - 收藏/低优先级标签写入后置顶顺序变化
- **回归**
  - `RoomSpaceWorkbench` 在 1200/1400/1920 三档宽度下的布局快照
  - 静音 + 有未读时角标显示

## 9. 分阶段交付

| Phase | 范围 | 工时估算 | 关键产出 |
| --- | --- | --- | --- |
| P1 视觉与未读 | `HulaRoomListItem` 样式重整 + `unread_count` + tags 联动 | 2 天 | 列表外观对齐 HuLaSpark；红点/@角标精确 |
| P2 空间层级 | `hierarchy/v1` 懒加载 + 面包屑 + parents 反查 | 3 天 | `SpaceListPane`、`HulaSpaceTree`、`RoomSpaceToolbar` 完成 |
| P3 发现与搜索 | `/spaces/public` + `/spaces/search` + 顶部 typeahead | 2 天 | 「发现空间」抽屉、空间内房间搜索 |
| P4 能力与权限 | `capabilities` 网关 + power-level UI | 1.5 天 | 按钮按能力禁用、设置态危险区域 |
| P5 同步与稳定性 | 429 banner、缓存 TTL、错误翻译 | 1 天 | 网络受限时 UX 平滑 |

合计 ~9.5 个工作日。

## 10. 风险与回退

| 风险 | 缓解 |
| --- | --- |
| `tree_path` / `with_children` 后端尚未稳定 | service 层 try/catch 后回退到 `/spaces/{id}` + 多次 `/spaces/{id}/rooms` |
| 标签写入失败导致排序错乱 | 写操作乐观更新 + 失败回滚；UI 用 `n-message.warning` 提示 |
| Sliding Sync 长时间 429 | banner 持续显示并提供「使用 /sync 兜底」按钮（调 `MatrixSyncService`） |
| 视觉变更导致深色主题对比度问题 | 在 `variable.scss` 中提供深色覆盖；通过 Storybook 双主题预览 |

## 11. 关联文件清单（实施时直接编辑）

- `src/views/homeWindow/RoomList.vue`
- `src/views/homeWindow/SpaceList.vue`
- `src/views/homeWindow/message/index.vue`
- `src/components/workbench/HulaRoomListItem.vue`
- `src/components/workbench/HulaSpaceTree.vue`
- `src/components/workbench/SpaceListPane.vue`
- `src/components/workbench/RoomSpaceWorkbench.vue`
- `src/components/workbench/RoomSpaceActionBar.vue`
- `src/components/workbench/RoomSpaceToolbar.vue`
- `src/components/workbench/WorkbenchDetailPane.vue`
- `src/composables/useSpaces.ts`、`src/composables/space/useSpaceRooms.ts`
- `src/composables/workbench/useMessageSessionFilters.ts`
- `src/services/matrix/room/MatrixRoomService.ts`、`MatrixRoomNotificationService.ts`、`MatrixRoomTagsService.ts`
- `src/services/matrix/room/MatrixSpaceService.ts`
- `src/stores/domains/chat/chat.ts`、`src/stores/domains/chat/room.ts`、`src/stores/domains/chat/space.ts`
- 新增：`src/services/matrix/room/RoomCapabilitiesService.ts`
- i18n：`src/locales/zh-CN/home.json`、`en/home.json`、`zh-CN/space.json`、`en/space.json`

---

> 本方案为实施蓝本，每个 Phase 落地前需在 `docs/issues/` 新建对应 issue，并在 PR
> 描述中引用本文件章节号；如后端契约存在偏差，先在
> `../matrix-js-sdk/docs/api-contract/` 提交契约修订，再实施 UI。
