# HULA Figma 页面结构与交付规范（以后端能力对齐）

## 1. 文档目标

本文档定义房间列表、空间列表、消息区与好友关系界面的 Figma 页面结构、变量命名、组件变体和交付要求。所有页面必须能映射到 `synapse-rust` 已存在的真实能力，避免出现无法联调的理想态页面。

## 2. 顶层页面结构

建议将原有 8 个页面扩展为以下结构：

1. `01 Foundations`
2. `02 Desktop Room List`
3. `03 Desktop Spaces`
4. `04 Desktop Chat And Summary`
5. `05 Desktop Friends`
6. `06 Mobile Room List`
7. `07 Mobile Spaces And Friends`
8. `08 Components`
9. `09 Prototypes`
10. `10 QA And Handoff`
11. `11 Migration Ledger`

## 3. 页面详细定义

### 3.1 01 Foundations

#### 必含内容

- 颜色系统
- 文字层级
- 间距系统
- 圆角和阴影系统
- 组件语义 token
- 状态语义矩阵

#### 必须新增的后端映射变量

- `room/unread/notification`
- `room/unread/highlight`
- `room/state/invite`
- `room/state/tombstoned`
- `space/visibility/public`
- `space/visibility/private`
- `space/join_rule/invite`
- `friend/status/favorite`
- `friend/status/blocked`
- `sync/recovering`

### 3.2 02 Desktop Room List

#### 目标

覆盖桌面端房间列表的真实同步状态、房间状态和标签状态。

#### 必含 Frame

- `RoomList/Default`
- `RoomList/InitialLoading`
- `RoomList/IncrementalUpdating`
- `RoomList/Reconnecting`
- `RoomList/InviteRoom`
- `RoomList/UnreadNotification`
- `RoomList/UnreadHighlight`
- `RoomList/Encrypted`
- `RoomList/Tombstoned`
- `RoomList/TaggedPinned`
- `RoomList/SpaceEntry`
- `RoomList/Empty`
- `RoomList/CapabilityFallback`

#### 必含说明

- 区分 `notification_count` 与 `highlight_count`
- 展示邀请态行内 CTA
- 展示 `m.tag` 驱动的置顶/收藏样式
- 点击房间列表项后的详情展示必须发生在主内容区和右侧详情区，禁止补一张独立窗口稿

### 3.3 03 Desktop Spaces

#### 目标

覆盖空间导航、空间层级树、空间摘要和加入流转。

#### 必含 Frame

- `Space/List/UserSpaces`
- `Space/List/PublicSpaces`
- `Space/List/SearchResult`
- `Space/List/SearchEmpty`
- `Space/Tree/Default`
- `Space/Tree/LoadMore`
- `Space/Tree/SuggestedOnly`
- `Space/Tree/ChildRoom`
- `Space/Tree/ChildSpace`
- `Space/Summary/Public`
- `Space/Summary/PrivateVisible`
- `Space/Summary/InviteOnly`
- `Space/Summary/NoAccess`
- `Space/Breadcrumb/TreePath`

#### 必含说明

- `next_batch` 对应的“加载更多”节点
- `join_rule = invite` 的不可直接加入状态
- `tree_path` 对应的面包屑结构
- 空间详情、成员、设置统一在当前页壳层内表现，不再出独立空间窗口

### 3.4 04 Desktop Chat And Summary

#### 目标

覆盖聊天时间线、房间摘要侧栏和动态扩展状态。

#### 必含 Frame

- `Chat/Bubble/Self`
- `Chat/Bubble/Other`
- `Chat/Bubble/Failed`
- `Chat/Typing`
- `Chat/Receipts`
- `Chat/Presence`
- `Chat/ReadOnlyRoom`
- `Chat/TombstonedRoom`
- `RoomSummary/Default`
- `RoomSummary/NoPermission`
- `RoomSummary/Stats`
- `RoomSummary/Members`
- `RoomSummary/InlineSettings`
- `RoomSummary/InlineInvite`

### 3.5 05 Desktop Friends

#### 目标

覆盖好友能力开启、关闭、为空、存在待处理请求等真实状态。

#### 必含 Frame

- `Friend/CapabilityEnabled`
- `Friend/CapabilityDisabled`
- `Friend/List/Empty`
- `Friend/List/Favorite`
- `Friend/List/Normal`
- `Friend/List/Blocked`
- `Friend/List/HiddenFilter`
- `Friend/Request/Incoming`
- `Friend/Request/Outgoing`
- `Friend/Request/AcceptedJumpToDM`
- `Friend/Group/Default`
- `Friend/Group/Collapsed`

#### 必含说明

- `favorite / normal / blocked / hidden` 必须作为真实状态值入稿
- 接受好友请求后应出现跳转至 DM 的过渡态
- 好友添加、好友验证、好友详情不得再设计为独立业务窗口

### 3.6 06 Mobile Room List

#### 目标

定义移动端房间列表在滑动、长按、邀请态和断线恢复中的视觉语义。

#### 必含 Frame

- `MobileRoomList/Default`
- `MobileRoomList/InviteRoom`
- `MobileRoomList/UnreadHighlight`
- `MobileRoomList/SwipeActions`
- `MobileRoomList/LongPressMenu`
- `MobileRoomList/Reconnecting`
- `MobileRoomList/Empty`

### 3.7 07 Mobile Spaces And Friends

#### 目标

把空间导航与好友关系页在移动端整合到真实可交互的层级路径中。

#### 必含 Frame

- `MobileSpace/List`
- `MobileSpace/Tree`
- `MobileSpace/BreadcrumbSheet`
- `MobileSpace/InviteOnly`
- `MobileFriend/List`
- `MobileFriend/CapabilityDisabled`
- `MobileFriend/RequestDrawer`
- `MobileFriend/ActionSheet`

### 3.8 08 Components

#### 分层建议

- Atoms
- Molecules
- Organisms
- Templates

#### 必做组件

- `Hula/RoomListItem`
- `Hula/RoomStateBadges`
- `Hula/RoomMetaCluster`
- `Hula/SpaceListItem`
- `Hula/SpaceTreeItem`
- `Hula/SpaceJoinButton`
- `Hula/SpaceBreadcrumb`
- `Hula/RoomSummaryPanel`
- `Hula/FriendCard`
- `Hula/FriendRequestItem`
- `Hula/CapabilityFallback`
- `Hula/SyncBanner`

### 3.9 09 Prototypes

#### 必含流程

- sliding sync 首次加载到增量更新
- 房间邀请接受/拒绝
- 空间树分页展开
- 空间邀请制加入失败提示
- 接受好友请求并进入 DM
- 好友功能关闭时的降级路径

### 3.10 10 QA And Handoff

#### 必含内容

- Redlines
- 变量映射表
- 组件属性矩阵
- 状态覆盖截图
- 权限态与降级态清单
- 联调备注：接口路径、字段来源、feature gate 风险

### 3.11 11 Migration Ledger

#### 目标

把被移除的弹窗、替代组件和对应设计稿挂钩，确保设计与实现同步清零冗余窗口。

#### 必含 Frame

- `Migration/RoomInvite/Before`
- `Migration/RoomInvite/After`
- `Migration/Announcement/Before`
- `Migration/Announcement/After`
- `Migration/FriendAdd/Before`
- `Migration/FriendAdd/After`
- `Migration/FriendVerify/Before`
- `Migration/FriendVerify/After`

#### 必含说明

- 每个迁移稿必须标注迁移编号，如 `MW-INVITE-001`
- `After` 稿必须明确写出落点组件，如 `RoomDetailPane`、`WorkbenchDetailPane`、`FriendDetailDrawer`
- 迁移页要附带代码路径和 Storybook story 名称，便于联调和验收

## 4. 命名规范

### 4.1 Frame 命名

统一格式：

`域/组件/状态`

示例：

- `RoomList/UnreadHighlight`
- `Space/Tree/LoadMore`
- `Friend/CapabilityDisabled`

### 4.2 Variant 属性

统一使用以下字段：

- `Theme`: `Light` / `Dark`
- `Platform`: `Desktop` / `Mobile`
- `State`: `Default` / `Loading` / `Empty` / `Error` / `Disabled`
- `Type`: `Room` / `DM` / `Space` / `Invite`
- `Permission`: `Allowed` / `ReadOnly` / `Forbidden`
- `Sync`: `Initial` / `Incremental` / `Recovering`

## 5. 变量规范

### 5.1 颜色变量

- `hula/room/unread/notification`
- `hula/room/unread/highlight`
- `hula/room/state/invite`
- `hula/space/state/public`
- `hula/space/state/invite_only`
- `hula/friend/status/favorite`
- `hula/friend/status/blocked`

### 5.2 组件变量

- `hula/component/room-item/bg/selected`
- `hula/component/space-tree/item/bg/hover`
- `hula/component/friend-card/bg`
- `hula/component/sync-banner/bg`

## 6. 交付强制要求

- 不允许产出后端没有对应字段或接口支持的状态稿
- 不允许把 invite-only 空间画成无条件可加入
- 不允许把好友能力画成默认永远可用
- 不允许把空间树画成永远全量展开且无分页
- 所有列表类页面都要有空态、无权限态、能力关闭态和加载态
- 不允许再产出新的“房间详情独立窗口”“成员列表独立窗口”“设置独立窗口”视觉稿

## 7. Visual Link Registry

本节作为当前文档内的视觉稿链接注册表，开发文档中的 `VisualSpec` 字段应引用这里的条目。若后续补充真实 Figma URL，可在 `ExternalLink` 列替换占位值。

| 视觉稿 ID | Figma 页面/Frame | 对应组件 | ExternalLink |
| --- | --- | --- | --- |
| `VIS-ROOM-LIST-001` | `02 Desktop Room List / RoomList/Default` | `RoomSessionList.vue` | `待补真实 Figma URL` |
| `VIS-ROOM-LIST-002` | `02 Desktop Room List / RoomList/Reconnecting` | `RoomSessionList.vue` | `待补真实 Figma URL` |
| `VIS-ROOM-DETAIL-003` | `04 Desktop Chat And Summary / RoomSummary/Default` | `RoomDetailPane.vue` | `待补真实 Figma URL` |
| `VIS-ROOM-DETAIL-004` | `04 Desktop Chat And Summary / RoomSummary/InlineInvite` | `RoomDetailPane.vue` | `待补真实 Figma URL` |
| `VIS-SPACE-001` | `03 Desktop Spaces / Space/Tree/LoadMore` | `WorkbenchDetailPane.vue`、`SpaceListPane.vue` | `待补真实 Figma URL` |
| `VIS-SPACE-002` | `03 Desktop Spaces / Space/Breadcrumb/TreePath` | `WorkbenchDetailPane.vue` | `待补真实 Figma URL` |
| `VIS-FRIEND-001` | `05 Desktop Friends / Friend/List/Favorite` | `FriendListView.vue` | `待补真实 Figma URL` |
| `VIS-FRIEND-002` | `05 Desktop Friends / Friend/CapabilityDisabled` | `FriendListView.vue` | `待补真实 Figma URL` |
| `VIS-MIGRATION-001` | `11 Migration Ledger / Migration/RoomInvite/After` | `RoomDetailPane.vue`、`WorkbenchDetailPane.vue` | `待补真实 Figma URL` |
| `VIS-MIGRATION-002` | `11 Migration Ledger / Migration/Announcement/After` | `WorkbenchDetailPane.vue` | `待补真实 Figma URL` |
| `VIS-MIGRATION-003` | `11 Migration Ledger / Migration/FriendAdd/After` | `FriendListView.vue` | `待补真实 Figma URL` |

## 8. 前端对接说明

实现映射顺序建议为：

1. `HULA_UI_SYSTEM_MESSAGES_FRIENDS.md`
2. `HULA_COMPONENT_REFACTOR_CHECKLIST.md`
3. `HULA_FRONTEND_WORKBREAKDOWN.md`

设计稿中的任何状态命名，都应能追溯到以下后端来源之一：

- sliding sync 房间载荷
- room summary 接口
- spaces 系列接口
- friends 系列接口
- tags / account_data / m.direct 数据

同时应能追溯到以下前端落点之一：

- 对应 Storybook story
- 对应运行时组件
- 对应迁移编号
