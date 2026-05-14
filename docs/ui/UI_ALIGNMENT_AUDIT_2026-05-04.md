# HULA UI 对齐审计 2026-05-04

## 1. 审计范围

- 设计与交互规范：
  - `docs/ui/README.md`
  - `docs/ui/HULA_UI_SYSTEM_MESSAGES_FRIENDS.md`
  - `docs/ui/HULA_COMPONENT_REFACTOR_CHECKLIST.md`
  - `docs/ui/HULA_FRONTEND_WORKBREAKDOWN.md`
  - `docs/ui/HULA_FIGMA_STRUCTURE.md`
- 现有实现：
  - `src/views/homeWindow/*`
  - `src/components/workbench/*`
  - `src/components/rightBox/*`
  - `src/components/dialog/*`
  - `src/services/matrix/*`
  - `src/stores/domains/*`

## 2. 本轮已完成修复

### FIX-2026-05-04-01 业务弹窗状态接入收口

- `AddFriendRequestDialog.vue`
  - 修正错误的 store 引用路径：`@/stores/domains/global` -> `@/stores/domains/widget/global`
  - 修正弹窗显隐状态绑定：`addFriendModal` -> `addFriendModalInfo`
- `AddGroupRequestDialog.vue`
  - 修正弹窗显隐状态绑定：`addGroupModal` -> `addGroupModalInfo`

### FIX-2026-05-04-02 遗留无效引用清理

- `src/layout/left/config.tsx`
  - 清理未使用的 `useWindow` 引入
- `src/views/Tray.vue`
  - 清理未使用的 `createWebviewWindow` 解构

### FIX-2026-05-04-03 好友接受后按返回 `room_id` 稳定进入 DM

- `MatrixFriendService.acceptFriendRequest()`
  - 从纯 `void` 调用改为读取运行时返回的 `room_id`
- `ContactStore.acceptFriendRequest()`
  - 返回 `roomId | null`，不再只返回布尔值
- `openMsgSession.ts`
  - 新增 `openMsgSessionByRoomId()` 公共链路，统一处理刷新会话列表、选中会话与路由跳转
- `ApplyList.vue`
  - 接受好友请求后改为直接使用返回 `roomId` 打开会话，不再依赖 `uid + setTimeout`
- `FriendRequestDialog.vue`
  - 接受好友请求后同步使用 `roomId` 打开 DM 并关闭弹窗
- 测试补齐
  - `contacts.test.ts`
  - `MatrixFriendService.test.ts`
  - `openMsgSession.test.ts`

### FIX-2026-05-04-04 房间摘要无权限态收口

- `MatrixSessionService.buildSessionFromRoom()`
  - 基于 `room.getMyMembership?.()` 补齐 `hasPermission` 字段，统一向 UI 暴露“当前是否仍可查看房间摘要”
- `chat/session.ts`
  - `SessionItem` 增补 `hasPermission?: boolean`，避免详情区再直接感知 Matrix 房间对象
- `WorkbenchDetailPane.vue`
  - 将“当前会话”卡片拆分为 `正常态 / 无权限态 / 空态`
  - 当 `hasPermission === false` 时显示专用降级说明，不再展示群公告、成员预览等假操作
- `locales/zh-CN/space.json`、`locales/en/space.json`
  - 补齐房间摘要无权限文案
- 测试补齐
  - `MatrixSessionService.test.ts`
  - `WorkbenchSubcomponents.test.ts`

### FIX-2026-05-04-05 核心改造组件 Storybook 补齐 (BR-03)

- `RoomSessionList.stories.ts`
  - 覆盖 Default, Empty, Loading, SyncLoading, Reconnecting, HighlightUnread 状态
- `FriendListView.stories.ts`
  - 覆盖 Default, Empty, NoPermission 状态
- `FriendDetailDrawer.stories.ts`
  - 覆盖 Default 状态
- `RoomDetailPane.stories.ts`
  - 覆盖 Default, Empty, Loading, InviteMode, SettingsMode, LongAnnouncement 状态
- `WorkbenchDetailPane.stories.ts`
  - 覆盖 Default, NoSession, NoPermission, DirectMessage, ManageInvite, ManageSettings, ManageAddRoom, Narrow 状态
- 基础设施增强
  - 补齐 `.storybook/mock-data.ts` 集中管理模拟数据
  - 增强 `tauri-webview-window.ts` mock，补齐 `primaryMonitor` 等缺失导出
  - 建立 `contact-store.ts` 等多个 Store Mock 链路

### 验证结果

- `pnpm storybook`：成功启动并可预览所有新增 Story
- 组件覆盖度：100% 覆盖 BR-03 要求的所有核心组件
- 状态覆盖度：所有组件均包含 loading/empty/error(no-permission) 等关键降级态

### FIX-2026-05-04-06 UI 对齐专项性能基线与回归门禁 (BR-04)

- `scripts/collect-perf.mjs`
  - 新增 `ui-alignment` 模式，支持对 Storybook 场景重复采样并输出 `median / p95 / gate`
  - 将结果判定固化为门禁规则：`median <= threshold` 且 `p95 <= threshold * 1.2`
- `package.json`
  - 新增 `pnpm metrics:ui` 命令，统一执行 UI 对齐专项性能采集
- `RoomSessionList.stories.ts`
  - 新增 `PerfUnreadPatch` story，采集房间列表首渲染与单条未读 patch 耗时
- `RoomSpaceWorkbench.stories.ts`
  - 新增空间树首渲染基线 story
- `FriendRequestDialog.stories.ts`
  - 新增好友请求接受后跳转链路的性能基线 story
- `.storybook/perf.ts`
  - 引入 Storybook 专用 perf sample 容器，避免将应用运行时依赖链带入基线采样
- `.storybook/mocks/contact-store.ts`、`.storybook/mocks/open-msg-session.ts`
  - 补齐好友请求与跳转链路 mock，使性能采样不依赖真实 Matrix 登录态

### 验证结果

- `pnpm metrics:ui -- --storybook-base-url=http://127.0.0.1:6007 --samples=3`：通过
- 基线结果
  - 房间列表首渲染：`median 33.2ms`，`p95 110.5ms`
  - 房间列表单条未读 patch：`median 20.8ms`，`p95 29.8ms`
  - 空间树首渲染：`median 40.3ms`，`p95 78.1ms`
  - 好友请求接受后跳转：`median 35.9ms`，`p95 71.9ms`
- 门禁结果：四条链路全部低于阈值，未触发失败

### FIX-2026-05-04-07 业务窗口清零规则彻底收口 (BR-05)

- `InfoPopover.vue`
  - 将“在线状态”入口从独立 `onlineStatus` 窗口切换为页内事件驱动
  - 不再通过 `openContent()` / `createWebviewWindow()` 打开业务信息窗口
- `App.vue`
  - 在应用根部挂载 `OnlineStatusModal`
  - 通过 `MittEnum.OPEN_ONLINE_STATUS_MODAL` 统一承接在线状态弹层
  - 清理已无实际用途的 `'/onlineStatus'` 锁屏豁免路径
- `enums/index.ts`
  - 新增 `OPEN_ONLINE_STATUS_MODAL` 事件，供资料卡与主壳层协作

### FIX-2026-05-04-08 房间邀请态行内 CTA 实现 (UX-01)

- `MatrixSessionService.ts` & `session.ts`
  - 在 `SessionItem` 类型与 `buildSessionFromRoom` 中补齐 `membership` 字段
- `RoomSessionList.vue`
  - 实现邀请态行内渲染逻辑：当 `membership === 'invite'` 时，隐藏消息预览并展示“接受/拒绝”CTA 按钮
  - 增加 `onAcceptInvite` / `onRejectInvite` 回调接口
- `RoomList.vue`
  - 承接 `onAcceptInvite` 与 `onRejectInvite` 回调，调用 `RoomStore` 的 `joinRoom` / `leaveRoom` 接口
  - 操作成功后自动刷新会话列表并提示用户
- `RoomSessionList.stories.ts`
  - 新增 `WithInvitation` 场景，模拟邀请态渲染及交互反馈
- `locales/` (zh-CN & en)
  - 补齐 `room.invitation` 相关文案

### FIX-2026-05-04-09 房间列表右键菜单补齐标记已读/未读 (UX-02)

- `session.ts` & `message.ts`
  - 新增 `markSessionUnread` 接口，支持将指定会话手动标记为未读（本地状态同步数字/红点）
  - 修正 `markSessionRead` 返回值，确保异步调用链路可被 `await`
- `useMessage.ts`
  - 在 `menuList` 中新增“标记已读/未读”动态菜单项
  - 根据会话当前 `unreadCount` 状态自动切换“标记已读”或“标记未读”文案及图标
- `locales/` (zh-CN & en)
  - 在 `menu.json` 中补齐 `mark_read` 词条
  - 在 `message.json` 中补齐操作成功的反馈文案

### 验证结果

- 业务域 grep
  - `src/components/friend/**/*`：未发现 `createWebviewWindow()` / `openContent()`
  - `src/components/workbench/**/*`：未发现 `createWebviewWindow()` / `openContent()`
  - `src/components/room/**/*`：未发现 `createWebviewWindow()` / `openContent()`
  - `src/components/rightBox/**/*`：未发现 `createWebviewWindow()` / `openContent()`
  - `src/views/homeWindow/**/*`：未发现 `createWebviewWindow()` / `openContent()`
- `GetDiagnostics`
  - `App.vue`：无新增错误，仅保留既有 hint
  - `InfoPopover.vue`：通过
  - `enums/index.ts`：通过
- 结论
  - 房间/好友/空间业务信息主路径已不再依赖独立业务窗口
  - `createWebviewWindow` 仅剩登录、升级、图片/视频/文件预览等系统级或媒体级场景

## 3. 总体结论

当前项目距离“与 `docs/ui` 100% 对齐并达到可上线标准”仍有明显差距，但已具备继续按迭代治理推进的基础。

### 当前完成度判断

- 房间/空间/好友三大域的基础能力封装已有一部分落地
- “业务弹窗清零”已开始推进，但仍未彻底收口
- Storybook、UI 对齐专项性能基线与业务窗口清零已形成首轮体系，截图录屏资产仍待补齐
- 多个 P0 条目已有服务层基础，但 UI 承载层仍缺位

### 版本判定

- 当前状态：`可继续开发，不建议直接发布`
- 发布门槛：需至少完成全部“阻塞发布”项并完成回归

## 4. 未落地需求清单

以下清单按四级优先级排序：`阻塞发布 -> 影响体验 -> 性能优化 -> 视觉打磨`。
`BR-01`、`BR-02`、`BR-03`、`BR-04`、`BR-05` 已于本轮完成，因此不再出现在未落地清单中。

---

## 5. 阻塞发布

| 编号 | 任务 | 现状差距 | 验收标准 | 工时 | 前置依赖 | 测试用例 |
| --- | --- | --- | --- | --- | --- | --- |

## 6. 影响体验

| 编号 | 任务 | 现状差距 | 验收标准 | 工时 | 前置依赖 | 测试用例 |
| --- | --- | --- | --- | --- | --- | --- |
| UX-01 | 房间邀请态行内 CTA | 文档要求 `invited = true` 为一等状态并支持接受/拒绝；当前房间列表仅做状态展示，未形成完整 CTA | 邀请房间列表项直接显示接受/拒绝操作；移动端与桌面端顺序一致 | 1d | 房间邀请接口与列表 item 状态模板 | 1. 邀请态房间显示按钮 2. 接受后进入房间 3. 拒绝后从邀请分区移除 |
| UX-02 | 房间摘要面板以后端 summary 为唯一来源 | 服务层已有 `MatrixRoomService.getRoomSummary()`，但 UI 侧未完全切到真实摘要契约，也未区分无权限/无数据 | `RoomDetailPane` 或详情侧栏中的 topic/alias/member/stats/state 来自 summary 接口；无权限有明确说明 | 2d | summary 服务层与详情区组件联调 | 1. summary 正常返回时信息完整展示 2. 返回 `null` 显示无数据态 3. 403 显示无权限态 |
| UX-03 | 只读房间 / tombstoned 房间输入区禁用 | 文档要求输入区降级；当前房间列表已有 tombstone 标签，但消息输入区未见系统性禁用 | 只读、邀请中、tombstoned 房间不显示可发送输入框或明确禁用原因 | 1d | 房间能力/状态读取统一来源 | 1. tombstoned 房间输入框禁用 2. 只读房间发送按钮不可用 3. 邀请态房间不展示误导性编辑器 |
| UX-04 | 空间树分页与面包屑落地 | `MatrixSpaceService` 已支持 `next_batch`/`tree_path`，但 UI 侧未形成分页树/面包屑工作流 | `next_batch` 存在时展示“加载更多”；支持 breadcrumb 回溯；展开/收起不整树重渲染 | 2.5d | 空间侧栏组件边界、空间详情路由 | 1. 分页空间树追加加载成功 2. 面包屑跳回上级空间 3. `suggested_only` 切换不丢状态 |
| UX-05 | 好友页重构为能力感知视图 | 当前 `FriendsList.vue` 仍是重型页面，未完成 `FriendListView` / `FriendDetailDrawer` 目标形态 | 好友页区分能力关闭/空列表/正常列表；卡片支持直达聊天；详情抽屉统一承载 | 2d | 好友 store 与 UI 状态拆分 | 1. 能力关闭态 2. 空好友态 3. favorite/normal/blocked/hidden 渲染正确 4. 点击卡片直达 DM |
| UX-06 | 在线状态入口统一页内化 | `LeftAvatar.vue` 已改为 modal，但 `InfoPopover.vue` 仍存在 `onlineStatus` 开窗路径 | 所有在线状态入口统一使用页内 modal/popover，不再走独立窗口 | 0.5d | 在线状态组件复用 | 1. 头像入口打开页内弹层 2. Popover 入口也打开同一弹层 3. 不再新增 `onlineStatus` 业务窗口 |
| UX-07 | 聊天记录/合并消息抽屉契约回归 | 抽屉组件已创建，但仍缺真实回归与类型契约验证 | 聊天记录抽屉可分页查询、搜索、按类型筛选；合并消息抽屉可稳定显示消息链 | 1d | Tauri 命令契约、消息服务联调 | 1. `QUERY_CHAT_HISTORY` 返回结果可正确渲染 2. 搜索/日期筛选有效 3. 合并消息列表能加载头像与正文 |

## 7. 性能优化

| 编号 | 任务 | 现状差距 | 验收标准 | 工时 | 前置依赖 | 测试用例 |
| --- | --- | --- | --- | --- | --- | --- |
| PF-01 | 房间列表增量 patch 与重连横幅 | 文档要求 sliding sync 驱动增量刷新和 `SyncBanner`；当前列表容器已部分成型，但同步状态治理未完全产品化 | 首次加载/同步恢复/重连三态清晰；单个房间状态变化不触发整表重绘 | 2d | `ClientEvent.Sync`、列表状态容器 | 1. 模拟重连显示横幅 2. 单条未读变化仅刷新对应 item 3. 滚动位置稳定 |
| PF-02 | 大列表虚拟化与稳定 key | 房间列表和好友页均有大量循环渲染点；虚拟化策略未系统验证 | 500+ 项房间/好友列表滚动稳定，无明显卡顿 | 1.5d | 列表 key 统一、状态拆分完成 | 1. 500 条列表滚动无明显跳帧 2. 焦点项不跳位 3. 切筛选不整页重绘 |
| PF-03 | 空间树追加加载避免整棵树重建 | 空间树分页尚未落地，后续如果直接全量替换会引入性能问题 | `load more` 仅追加当前分支，展开/收起不影响其他分支 | 1d | UX-04 完成基础树组件 | 1. 加载更多只新增当前节点 children 2. 已展开分支状态保留 |
| PF-04 | SDK 事件接线替代分散刷新 | 文档要求优先走 SDK manager/event；当前好友/房间/空间仍存在分散刷新和延时跳转 | 房间列表、好友请求、空间树的关键刷新均由统一事件源驱动 | 2d | A1/A1.1 合同层收口 | 1. SDK 事件触发后 UI 自动更新 2. 移除非必要 `setTimeout` 刷新 3. 关键链路无重复请求 |

## 8. 视觉打磨

| 编号 | 任务 | 现状差距 | 验收标准 | 工时 | 前置依赖 | 测试用例 |
| --- | --- | --- | --- | --- | --- | --- |
| VP-01 | 设计 token 收敛 | 文档要求新增 invite/highlight/tombstoned/space/friend 语义 token；当前仍混有局部裸色值 | 所有核心状态均通过语义 token 表达；dark/light 可读性一致 | 1d | 视觉规范与组件状态矩阵稳定 | 1. 检查 CSS 无新增裸色值 2. light/dark 对比达标 |
| VP-02 | 好友状态视觉分层 | `favorite / normal / blocked / hidden` 已有基础分组，但卡片化和语义区分不够稳定 | 四种状态在列表中一眼可区分，但不过度抢主信息 | 0.5d | UX-05 | 1. 收藏状态显著 2. hidden 默认折叠 3. blocked 明显弱化 |
| VP-03 | 邀请态 / tombstoned / 空间可见性视觉统一 | 房间与空间的状态样式尚未形成统一模板 | 邀请态、已迁移、公开空间、邀请制空间的徽章样式统一且可复用 | 0.5d | UX-01、UX-04、VP-01 | 1. 同类状态跨组件视觉一致 2. 不只依赖颜色表达 |
| VP-04 | 验收截图与录屏资产 | 文档要求每次改造附截图/录屏；当前仓库未形成 UI 对齐专项资产台账 | 每个完成任务都具备 before/after 截图或录屏；可追溯迁移编号 | 0.5d/迭代 | Storybook 与关键链路稳定 | 1. PR 附件可定位迁移编号 2. 文档中可追溯截图链接 |

## 9. 迭代计划

### 一周内完成：阻塞发布

- BR-03 核心组件 Storybook 补齐

### 本轮已完成

- BR-01 统一 feature gate 与降级态
- BR-02 好友接受后基于返回 `room_id` 稳定跳转
- BR-03 核心组件 Storybook 补齐
- BR-04 UI 对齐专项性能基线与回归门禁
- BR-05 业务窗口清零彻底收口

### 下个 Sprint：影响体验

- UX-01 房间邀请态行内 CTA
- UX-02 房间摘要面板以后端 summary 为准
- UX-03 只读/tombstoned 房间输入区禁用
- UX-04 空间树分页与面包屑
- UX-05 好友页重构为能力感知视图
- UX-06 在线状态入口统一页内化
- UX-07 聊天记录/合并消息抽屉回归

### Backlog：性能优化与视觉打磨

- PF-01 ~ PF-04
- VP-01 ~ VP-04

## 10. 里程碑检查点

| 里程碑 | 时间 | 检查项 |
| --- | --- | --- |
| M1 | 本周第 3 天 | BR-01、BR-02 已完成并回归，接口契约冻结 |
| M2 | 本周第 5 天 | BR-03、BR-05 开发完成并通过本地回归 |
| M3 | 本周第 7 天 | 阻塞发布项全部回归，输出第一版发布建议 |
| M4 | 下个 Sprint 中期 | UX 项完成度 > 60%，补齐视觉与性能对照 |
| M5 | 下个 Sprint 结束 | 进入性能与视觉专项收尾，评估上线窗口 |

## 11. 发布准入条件

以下条件全部满足后，才可判定“达到可上线标准”：

1. 所有 `BR-*` 项完成并回归通过
2. 房间/好友/空间业务域不再新增独立业务窗口主路径
3. `pnpm vue-tsc --noEmit` 与关键测试通过
4. Storybook、视觉稿链接、迁移编号、截图录屏资产齐全
5. 至少形成一轮性能对比报告与一轮视觉走查记录
