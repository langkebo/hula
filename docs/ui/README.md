# HULA UI 文档目录

本目录沉淀的是一套**以后端 `synapse-rust` 真实能力为准**的 UI 文档体系，目标不是输出纯视觉提案，而是形成可直接指导设计、前端开发、联调和验收的实施文档。

## 文档列表

- `HULA_UI_SYSTEM_MESSAGES_FRIENDS.md`
  - 总体 UI 规范文档
  - 覆盖房间列表、空间列表、消息区、好友关系页
  - 包含后端能力基线、数据字段映射、权限与降级规则、响应式/性能/无障碍要求

- `HULA_COMPONENT_REFACTOR_CHECKLIST.md`
  - 组件级改造清单
  - 为房间列表、空间树、房间摘要、好友卡片、请求面板等组件补充真实后端依赖和验收要求

- `HULA_FIGMA_STRUCTURE.md`
  - Figma 页面结构与交付规范
  - 把房间列表、空间树、好友能力降级态、分页树、邀请制空间等真实状态纳入设计交付结构

- `HULA_FRONTEND_WORKBREAKDOWN.md`
  - 前端任务拆分表
  - 以后端合同、联调顺序和能力边界为核心拆分阶段任务、依赖关系和验收路径

## matrix-js-sdk 对齐范围

本轮文档已额外对齐 `/Users/ljf/Desktop/hu_ts/matrix-js-sdk` 中与 UI 直接相关的接口层，重点包括：

- `MatrixClient` 的 `ClientEvent.Sync / ClientEvent.Event / ClientEvent.Room`
- `RoomEvent`、`RoomMemberEvent`、`MatrixEventEvent` 等事件流
- `DirectMessageManager`、`FriendManager`、`RoomSummaryManager`、`SpaceManager`
- `RoomListManager`、`EventManager`、Sliding Sync 数据结构

这意味着本目录中的组件说明、字段映射、交互约束，不再只参照后端 HTTP 路由，也同时参照 SDK 已暴露的事件与管理器接口。

## 建议阅读顺序

1. 先阅读 `HULA_UI_SYSTEM_MESSAGES_FRIENDS.md`
2. 再阅读 `HULA_COMPONENT_REFACTOR_CHECKLIST.md`
3. 设计侧同步阅读 `HULA_FIGMA_STRUCTURE.md`
4. 开发、联调和 QA 执行 `HULA_FRONTEND_WORKBREAKDOWN.md`

## 这套文档解决的问题

- 避免 UI 设计承诺后端并不存在的能力
- 让房间列表和空间列表真正对齐 sliding sync、room summary、space hierarchy
- 让好友与直聊 UI 对齐 `m.friends.list`、`friend_requests` 和 `m.direct`
- 让能力关闭、无权限、无数据三种降级场景有明确处理方式
- 让房间详情、成员列表、设置面板统一回收进现有主界面框架，不再新增独立业务弹窗窗口

## 呈现规范总则

- 房间列表点击后，只允许更新主工作区与右侧详情区，不允许再创建独立业务窗口。
- 同一类信息只保留一种主呈现方式：
  - 房间详情：右侧 `RoomDetailPane` / `WorkbenchDetailPane`
  - 成员列表：右侧详情区内嵌成员目录或移动端抽屉
  - 设置面板：主界面侧栏、抽屉或详情区，不再额外开 `WebviewWindow`
- 业务信息优先级顺序固定为：`内嵌侧栏 > 抽屉 > 浮层/Popover > 模态对话框 > 独立窗口`
- `createWebviewWindow` 仅保留给系统级或媒体级场景，如登录、升级、图片/视频/文件预览；房间/好友/空间业务信息不再使用独立窗口。

## 组件迁移记录

以下记录用于跟踪“冗余弹窗清零”改造，编号在设计、开发、联调与 PR 描述中必须保持一致。

| 编号 | 被移除弹窗/窗口 | 触发来源 | 移除原因 | 目标替代组件 | 目标代码路径 |
| --- | --- | --- | --- | --- | --- |
| `MW-INVITE-001` | `modal-invite` 独立邀请窗口 | `src/views/modalWindow/index.vue`、`useWindow.ts` | 已与房间详情区、邀请组件能力重复；会打断主工作流 | 房间详情区内嵌邀请面板 | `src/components/room/RoomDetailPane.vue`、`src/components/workbench/WorkbenchDetailPane.vue` |
| `MW-ANNOUNCEMENT-002` | `announList/:roomId/:type` 独立公告窗口 | `ChatMain.vue`、`ChatSidebar.vue`、`Details.vue`、`WorkbenchDetailPane.vue` | 公告信息已存在于详情区/侧栏，再开独立窗口造成信息分裂 | 右侧详情区公告卡片 + 侧栏预览 | `src/components/workbench/WorkbenchDetailPane.vue`、`src/components/rightBox/chatBox/ChatSidebar.vue` |
| `MW-FRIEND-003` | `searchFriend` 独立加好友窗口 | `src/views/homeWindow/FriendsList.vue` | 好友域已有 `AddFriendDialog`、请求面板与详情抽屉，独立窗口冗余 | 好友页内嵌操作区 / 抽屉 | `src/components/friend/FriendListView.vue`、`src/components/friend/FriendDetailDrawer.vue` |
| `MW-FRIEND-VERIFY-004` | `addFriendVerify` 独立验证窗口 | `useChatMain.ts`、`InfoPopover.vue`、`SearchFriend.vue` | 校验/确认应附着在当前好友流程上下文中，不应跳窗 | 好友请求面板或详情抽屉内确认区 | `src/components/friend/FriendListView.vue`、`src/components/friend/FriendDetailDrawer.vue` |
| `MW-ROOM-SETTINGS-005` | 旧式房间设置对话框/独立窗口入口 | `RoomDetailPane.vue` 的设置动作、历史旧入口 | 与右侧详情承载域冲突，且造成“详情”和“设置”双通道 | 右侧详情区设置分段 | `src/components/room/RoomDetailPane.vue`、`src/components/workbench/WorkbenchDetailPane.vue` |

说明：

- 上表中的“被移除弹窗/窗口”指业务信息弹窗，不包含图片查看器、视频查看器、文件预览、登录/更新等系统级窗口。
- 若后续新增类似窗口，必须先在 PR 中补充新的迁移编号和替代组件，否则视为违反 UI 规范。

## Storybook 与视觉稿入口

- Storybook 运行命令：`pnpm storybook`
- Storybook 构建命令：`pnpm build-storybook`
- 视觉稿目录：`HULA_FIGMA_STRUCTURE.md`
- 组件接口与示例目录：`HULA_COMPONENT_REFACTOR_CHECKLIST.md`
- 任务与验收目录：`HULA_FRONTEND_WORKBREAKDOWN.md`

在实现阶段，所有新增或改造后的房间列表、空间列表、详情区、好友页组件，都需要同时补齐：

- 对应 Storybook story
- 对应视觉稿链接
- 对应迁移编号
- 对应验收截图/录屏

## 对应代码范围

### 前端

- 房间列表：`src/views/homeWindow/message/index.vue`
- 房间工作台：`src/views/homeWindow/RoomList.vue`
- 会话列表：`src/components/workbench/RoomSessionList.vue`
- 聊天区：`src/components/rightBox/chatBox/ChatMain.vue`
- 消息渲染：`src/components/rightBox/renderMessage/index.vue`
- 好友页：`src/views/homeWindow/FriendsList.vue`
- 移动好友页：`src/mobile/views/friends/index.vue`
- 设计 token：`src/styles/css/design-tokens.css`

### 后端参考

- 房间摘要：`synapse-rust/src/web/routes/room_summary.rs`
- sliding sync：`synapse-rust/src/web/routes/sliding_sync.rs`
- 空间路由：`synapse-rust/src/web/routes/space.rs`
- 直聊路由：`synapse-rust/src/web/routes/dm.rs`
- 好友路由：`synapse-rust/src/web/routes/friend_room.rs`
- 房间标签：`synapse-rust/src/web/routes/tags.rs`

## 使用建议

- 设计评审时，优先核对文档中的字段来源和状态定义
- 前端实现时，优先按“后端字段 -> 组件状态 -> 视觉 token”的顺序落地
- 联调时，优先验证房间列表、空间树分页、好友接受跳转、能力降级四类主链路
