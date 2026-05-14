# HULA 组件级改造清单（以后端能力对齐）

## 1. 文档目标

本文档把 UI 改造拆成可实施的组件项，并为每个组件补充真实后端依赖、权限前提和验收标准。范围覆盖：

- 房间列表
- 空间列表与空间树
- 聊天消息区与房间摘要
- 好友列表与直聊流转
- 共享状态组件、同步状态组件、无障碍组件

## 2. 优先级定义

- `P0`: 核心链路，直接影响列表正确性与后端对齐
- `P1`: 强增强项，影响完整体验和跨端一致性
- `P2`: 优化项，面向第二轮打磨

## 3. P0 组件清单

### 3.1 HulaRoomListViewport

#### 目标文件

- `src/components/workbench/RoomSessionList.vue`
- `src/views/homeWindow/message/index.vue`

#### 后端依赖

- sliding sync `POST /_matrix/client/v3/sync`
- 房间列表增量操作和窗口化结果

#### 改造重点

- 把首屏加载、增量同步、重连恢复、空态统一到一个列表容器
- 让列表刷新基于受影响项更新，而不是全量重绘
- 为后续虚拟列表与增量 patch 保留稳定 key

#### 验收要求

- 初始同步与增量同步状态区分清晰
- 重连时不丢已有列表上下文
- 大量房间时仍保持滚动稳定

### 3.2 HulaRoomListItem

#### 目标文件

- `src/components/workbench/RoomSessionList.vue`

#### 目标拆分

- `HulaRoomListItem`
- `HulaRoomAvatar`
- `HulaRoomPrimaryText`
- `HulaRoomMetaCluster`
- `HulaRoomStateBadges`

#### 后端依赖

- `room_id`
- `name`
- `avatar`
- `is_dm`
- `is_encrypted`
- `is_tombstoned`
- `invited`
- `highlight_count`
- `notification_count`
- `timestamp`

#### 改造重点

- 将标题、预览、时间、未读、邀请、加密等信息分层
- 把高优先级未读与普通未读视觉拆分
- 为邀请态和 tombstoned 态提供独立模板

#### 验收要求

- `highlight_count` 与 `notification_count` 视觉不可混淆
- 邀请态可直接显示操作入口
- 单聊、群聊、空间入口三类项结构统一但语义不同

### 3.3 HulaRoomSummaryPanel

#### 目标文件

- `src/views/homeWindow/RoomList.vue`
- 未来详情侧栏组件

#### 后端依赖

- `/rooms/{room_id}/summary`
- `/rooms/{room_id}/summary/members`
- `/rooms/{room_id}/summary/stats`
- `/rooms/{room_id}/summary/state`

#### 改造重点

- 把房间 topic、别名、加密、人数、摘要统计统一展示
- 将“无权限 / 无摘要 / 可读取”三种状态拆开
- 为房间创建者保留管理入口位，但默认不对普通成员展示

#### 验收要求

- 房间摘要信息全部来自后端摘要接口
- 无权限时有明确说明，不能展示假按钮

### 3.4 HulaSpaceSidebar

#### 目标文件

- `src/views/homeWindow/RoomList.vue`
- 新增空间导航组件目录

#### 后端依赖

- `/spaces/user`
- `/spaces/public`
- `/spaces/search`
- `/spaces/statistics`

#### 改造重点

- 构建用户空间、公开空间、搜索结果三块入口
- 支持公开/私有/邀请制空间标记
- 为无权限空间、空列表、加载中建立标准状态

#### 验收要求

- 列表项可以准确表达空间可见性和加入门槛
- 搜索结果和用户空间列表复用同一项组件

### 3.5 HulaSpaceTree

#### 目标文件

- 新增空间树组件

#### 目标拆分

- `HulaSpaceTree`
- `HulaSpaceTreeItem`
- `HulaSpaceTreeLoadMore`
- `HulaSpaceBreadcrumb`

#### 后端依赖

- `/spaces/{space_id}/hierarchy`
- `/spaces/{space_id}/hierarchy/v1`
- `/spaces/{space_id}/tree_path`
- `/spaces/room/{room_id}/parents`

#### 改造重点

- 适配分页层级树，而非假设全量树
- 区分子空间与子房间
- 为 `suggested_only` 留出筛选开关或模式切换

#### 验收要求

- `next_batch` 存在时使用“加载更多”节点
- 面包屑与树节点跳转一致
- 展开/收起不会导致整棵树重渲染

### 3.6 HulaSpaceJoinCta

#### 目标文件

- 空间摘要区
- 空间列表项右侧操作位

#### 后端依赖

- `/spaces/{space_id}/join`
- `/spaces/{space_id}/leave`
- `/spaces/{space_id}/invite`
- `join_rule`
- `is_public`

#### 改造重点

- 公开空间、私有空间、邀请制空间使用不同按钮文案
- 无邀请时禁止把 invite-only 空间渲染成可点加入
- 将加入后刷新与空间树联动纳入组件职责

#### 验收要求

- 权限不满足时给出解释性反馈
- 加入与离开后的 UI 刷新路径稳定

### 3.7 HulaMessageMeta

#### 目标文件

- `src/components/rightBox/renderMessage/index.vue`

#### 后端依赖

- sliding sync `extensions.receipts`
- sliding sync `extensions.typing`
- sliding sync `extensions.presence`
- 房间加密/只读/tombstoned 状态

#### 改造重点

- 收敛时间、回执、输入中、在线状态、失败重试
- 为只读房间和迁移房间建立禁用与提示层

#### 验收要求

- 时间信息稳定可见
- 动态状态不抢正文层级

### 3.8 HulaFriendListViewport

#### 目标文件

- `src/views/homeWindow/FriendsList.vue`
- `src/mobile/views/friends/index.vue`

#### 后端依赖

- `GET /friends`
- `GET /friends/requests/incoming`
- `GET /friends/requests/outgoing`
- 好友 feature gate

#### 改造重点

- 为“能力不可用 / 空好友 / 有好友”建立三种不同空态
- 好友页加载不再假设后端一定存在数据
- 兼容接受好友后即时跳转直聊

#### 验收要求

- 能力关闭时显示降级说明而非空白页
- 空数组时可区分“尚未添加好友”与“接口异常”

### 3.9 HulaFriendCard

#### 目标文件

- `src/views/homeWindow/FriendsList.vue`

#### 后端依赖

- `m.friends.list` 单项字段
- `status` 枚举：`favorite / normal / blocked / hidden`
- `displayname`
- `note`

#### 改造重点

- 以关系卡片方式重构好友项
- 备注名、昵称、用户 ID、状态、分组信息层级分明
- 点击主区域打开 DM，辅助操作进入菜单

#### 验收要求

- `favorite`、`blocked`、`hidden` 状态视觉不可混淆
- 卡片可直达聊天，不需要先进入详情页

### 3.10 HulaFriendRequestPanel

#### 目标文件

- 好友页侧栏或顶部抽屉

#### 后端依赖

- `POST /friends`
- `POST /friends/request/{user_id}/accept`
- `POST /friends/request/{user_id}/reject`
- `POST /friends/request/{user_id}/cancel`

#### 改造重点

- 将收到请求、发出请求、已处理结果拆分为三个视图层
- 接受成功后串联新建 DM 房间跳转

#### 验收要求

- 接受请求后可立即进入对应房间或看到明确过渡态
- 拒绝、取消路径有清晰结果反馈

## 4. P1 组件清单

### 4.1 HulaRoomTagBar

- 后端依赖：`/user/{user_id}/rooms/{room_id}/tags`
- 目标：支持房间收藏、置顶、分类标签的统一入口
- 验收：标签调整不破坏默认后端排序，仅作为上层分区附加语义

### 4.2 HulaRoomSyncBanner

- 后端依赖：sliding sync 重试与断线恢复状态
- 目标：统一列表顶部“恢复同步中 / 已离线 / 重试中”横幅
- 验收：横幅不遮挡主交互，桌面和移动端共用状态语义

### 4.3 HulaSpaceSummaryHero

- 后端依赖：`/spaces/{space_id}/summary/with_children`
- 目标：呈现空间大标题、简介、成员数、推荐子项
- 验收：公开/私有/邀请制状态在首屏可感知

### 4.4 HulaRoomInviteActions

- 后端依赖：房间邀请态列表项、加入/离开房间接口
- 目标：为邀请中的房间提供行内操作按钮
- 验收：移动端与桌面端按钮顺序统一

### 4.5 HulaDmIdentityBadge

- 后端依赖：`m.direct`、`/rooms/{room_id}/dm`、`/rooms/{room_id}/dm/partner`
- 目标：统一单聊头像、对方展示名和在线状态入口
- 验收：DM 识别可同时兼容账户数据与成员回推

## 5. P2 组件清单

### 5.1 HulaA11yLiveRegion

- 用于同步恢复、邀请接受、空间加入结果等异步状态播报

### 5.2 HulaSpaceMiniMap

- 用于深层空间结构的快速导航，可在桌面宽屏作为增强组件

### 5.3 HulaCapabilityFallback

- 用于统一承载 feature gate 关闭、后端无此接口时的页面降级

## 6. 文件级映射表

| 模块 | 当前文件 | 目标组件/动作 |
| --- | --- | --- |
| 房间列表 | `src/components/workbench/RoomSessionList.vue` | `HulaRoomListViewport`、`HulaRoomListItem`、`HulaRoomSyncBanner` |
| 房间工作台 | `src/views/homeWindow/RoomList.vue` | `HulaRoomSummaryPanel`、`HulaSpaceSidebar`、`HulaSpaceSummaryHero` |
| 消息渲染 | `src/components/rightBox/renderMessage/index.vue` | `HulaMessageMeta`、消息区状态收敛 |
| 好友页 | `src/views/homeWindow/FriendsList.vue` | `HulaFriendListViewport`、`HulaFriendCard`、`HulaFriendRequestPanel` |
| 移动好友页 | `src/mobile/views/friends/index.vue` | `HulaFriendCard` 移动变体、能力降级态 |
| 新增空间模块 | 新增目录 | `HulaSpaceTree`、`HulaSpaceTreeItem`、`HulaSpaceBreadcrumb` |

## 7. 后端对齐检查矩阵

以下检查必须逐项覆盖：

- 房间列表是否区分 `notification_count` 与 `highlight_count`
- 房间列表是否支持邀请态、tombstoned、加密态
- 空间树是否支持 `next_batch` 分页与 `suggested_only`
- 空间编辑入口是否只对创建者显示
- 好友页是否考虑 `friends` feature gate
- 直聊识别是否兼容 `m.direct` 与成员结构回推
- 标签/置顶能力是否基于 `m.tag` 而不是纯本地状态

## 8. SDK 事件接线矩阵

组件在实现时，必须优先对接 `matrix-js-sdk` 的事件和管理器，不允许每个组件重复各自轮询。

| 组件 | SDK 事件/接口 | 用途 |
| --- | --- | --- |
| `HulaRoomListViewport` | `ClientEvent.Sync`、`SyncState` | 首次加载、重连、恢复同步横幅 |
| `HulaRoomListItem` | `RoomEvent.UnreadNotifications`、`RoomEvent.Summary`、`RoomEvent.Tags` | 未读、摘要、副标题、标签刷新 |
| `HulaMessageMeta` | `MatrixEventEvent.Status`、`MatrixEventEvent.Decrypted`、`RoomMemberEvent.Typing` | 发送状态、解密状态、输入中 |
| `HulaRoomSummaryPanel` | `RoomSummaryManager.getRoomSummary*` | 详情、成员、统计信息 |
| `HulaSpaceTree` | `SpaceManager.getSpaceHierarchyV1()`、`getSpaceTreePath()` | 分页树、面包屑、推荐节点 |
| `HulaFriendListViewport` | `FriendManager.getFriends()`、`FriendEvent.ListUpdated` | 好友列表刷新 |
| `HulaFriendRequestPanel` | `FriendManager.getIncomingRequests()`、`acceptFriendRequest()` | 请求列表、接受后跳转 |
| `HulaDmIdentityBadge` | `DirectMessageManager.getDMRooms()`、`getDmForUser()` | DM 识别与会话回查 |

## 9. 组件接口说明

本节补充核心组件的 Props、事件、使用示例和视觉稿/Storybook 对接要求。示例默认面向 Vue 3 + `<script setup lang="ts">`。

### 9.1 HulaRoomListViewport

- 目标实现：`src/components/workbench/RoomSessionList.vue`
- Storybook 目标：`src/stories/workbench/RoomSessionList.stories.ts`
- 视觉稿入口：`./HULA_FIGMA_STRUCTURE.md` 中 `RoomList/*`

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `sessionList` | `SessionListItem[]` | 房间列表数据 |
| `syncLoading` | `boolean` | 首次同步或手动重试中 |
| `sessionLoading` | `boolean` | 本地会话数据准备中 |
| `networkBanner` | `{ text: string; retryable?: boolean } \| null` | 顶部网络提示 |
| `emptyDescription` | `string` | 空态文案 |
| `onMsgClick` | `(item) => void \| Promise<void>` | 单击房间 |
| `onMsgDblclick` | `(item) => void` | 双击直达聊天 |
| `onRetryNetwork` | `() => void \| Promise<void>` | 重试同步 |

约束：

- 点击列表项后只能更新当前选中房间和详情区，不允许打开独立窗口。
- Storybook 必须覆盖 `Default / SyncLoading / Reconnecting / Empty / Invite / HighlightUnread` 六个状态。

使用示例：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import RoomSessionList from '@/components/workbench/RoomSessionList.vue'

type SessionListItem = {
  roomId: string
  name: string
  avatar: string
  unreadCount: number
  type: number
  top?: boolean
}

const sessionList = ref<SessionListItem[]>([
  { roomId: '!room:example.com', name: '产品群', avatar: '', unreadCount: 3, type: 1 }
])

const emptyDescription = '暂无会话'
</script>

<template>
  <RoomSessionList
    :session-list="sessionList"
    :sync-loading="false"
    :session-loading="false"
    :network-banner="null"
    :empty-description="emptyDescription"
    :get-item-classes="() => ({})"
    :visible-menu="() => []"
    :visible-special-menu="() => []"
    :on-msg-click="(item) => console.log('select', item.roomId)"
    :on-msg-dblclick="(item) => console.log('enter', item.roomId)"
    :on-menu-show="() => {}" />
</template>
```

### 9.2 HulaRoomDetailPane

- 目标实现：`src/components/room/RoomDetailPane.vue`
- Storybook 目标：`src/stories/room/RoomDetailPane.stories.ts`
- 视觉稿入口：`./HULA_FIGMA_STRUCTURE.md` 中 `RoomSummary/*`

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `roomId` | `string \| null` | 当前选中房间 ID |
| `roomName` | `string \| undefined` | 当前房间名称 |
| `roomAvatar` | `string \| undefined` | 当前房间头像 |
| `roomType` | `number \| undefined` | 房间类型 |

Emits：

| 事件 | 说明 |
| --- | --- |
| `enterRoom` | 进入聊天主区 |
| `settings` | 打开内嵌设置分段 |
| `invite` | 打开内嵌邀请面板 |

约束：

- `settings` 和 `invite` 不再跳出独立窗口。
- 房间详情、成员、设置只在右侧详情区保留一种呈现方式。

使用示例：

```vue
<script setup lang="ts">
import RoomDetailPane from '@/components/room/RoomDetailPane.vue'

const selectedRoomId = '!room:example.com'
</script>

<template>
  <RoomDetailPane
    :room-id="selectedRoomId"
    room-name="设计评审"
    room-avatar=""
    :room-type="1"
    @enter-room="console.log('enter room')"
    @settings="console.log('open inline settings')"
    @invite="console.log('open inline invite panel')" />
</template>
```

### 9.3 HulaWorkbenchDetailPane

- 目标实现：`src/components/workbench/WorkbenchDetailPane.vue`
- Storybook 目标：`src/stories/workbench/WorkbenchDetailPane.stories.ts`
- 视觉稿入口：`./HULA_FIGMA_STRUCTURE.md` 中 `Space/*` 与 `RoomSummary/*`

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `selectedSession` | `SessionListItem \| null` | 当前房间/会话 |
| `activeSpace` | `SpaceListItem \| null` | 当前选中空间 |
| `visibleSessionCount` | `number` | 当前空间下可见会话数 |
| `totalSessionCount` | `number` | 会话总数 |
| `manageMode` | `'invite' \| 'add-room' \| 'settings' \| null` | 管理面板模式 |
| `canManageSpace` | `boolean` | 是否允许管理 |
| `manageSubmitting` | `boolean` | 提交中状态 |

用途：

- 承接空间详情、空间房间预览、群公告预览、成员目录、成员资料与管理表单。
- 这是替代 `announList/*`、`modal-invite` 等窗口的首选组件。

### 9.4 HulaFriendListViewport

- 目标实现：`src/components/friend/FriendListView.vue`
- Storybook 目标：`src/stories/friend/FriendListView.stories.ts`
- 视觉稿入口：`./HULA_FIGMA_STRUCTURE.md` 中 `Friend/*`

Props / 依赖：

- 当前组件主要依赖 store，但在重构后应抽离为显式 Props：
  - `friends`
  - `incomingRequestsCount`
  - `loading`
  - `selectedUserId`
  - `capabilityAvailable`

约束：

- 加好友、好友请求、好友详情统一留在当前页面壳层内，不再使用 `searchFriend` 或 `addFriendVerify` 独立窗口。
- 详情优先使用 `FriendDetailDrawer`；桌面宽屏可升级为右侧详情区，但不能同时保留抽屉和独立窗口两套入口。

### 9.5 HulaFriendDetailDrawer

- 目标实现：`src/components/friend/FriendDetailDrawer.vue`
- Storybook 目标：`src/stories/friend/FriendDetailDrawer.stories.ts`
- 视觉稿入口：`./HULA_FIGMA_STRUCTURE.md` 中 `Friend/List/*`

Props：

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `show` | `boolean` | 抽屉是否显示 |
| `userId` | `string` | 当前好友用户 ID |

Emits：

| 事件 | 说明 |
| --- | --- |
| `update:show` | 控制抽屉显隐 |
| `update:userId` | 切换当前好友 |

### 9.6 视觉稿与 Storybook 链接规范

每个组件文档必须同时维护以下四个链接字段：

- `VisualSpec`: 指向 `HULA_FIGMA_STRUCTURE.md` 中对应 frame 组
- `StorybookTarget`: 指向目标 story 文件路径
- `RuntimeComponent`: 指向实际 Vue 组件路径
- `MigrationId`: 指向 `README.md` 中的迁移编号

## 10. 弹窗迁移执行规则

- `modal-invite` 必须迁入 `RoomDetailPane` 或 `WorkbenchDetailPane`，不再保留独立窗口路由。
- `announList/:roomId/:type` 必须迁为详情区公告卡片与编辑分段，不再通过 `createWebviewWindow` 打开。
- `searchFriend` 与 `addFriendVerify` 必须迁入好友页现有抽屉/对话框体系。
- 房间详情、成员列表、设置面板只允许保留一种主入口，禁止“右侧详情 + 独立窗口”并存。

## 11. Definition Of Done

1. 字段来源、接口来源、权限来源三者都已明确。
2. 已覆盖正常态、空态、无权限态、能力关闭态、加载态。
3. light/dark 主题下状态可读性一致。
4. 不引入与后端合同冲突的新交互承诺。
5. 至少具备一条联调或回归验证路径。
6. 所有新增或改造组件都具备 Storybook 交互示例与视觉稿入口链接。
7. 所有冗余业务独立弹窗都已有迁移编号、目标组件和代码路径。
