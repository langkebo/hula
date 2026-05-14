# HULA 房间列表、空间列表、消息与好友 UI 规范

## 1. 文档目标

本文档用于把 `HuLa` 客户端侧的列表与关系类 UI 设计，统一校准到后端项目 `synapse-rust` 的真实能力上。文档覆盖以下四类核心域：

- 房间列表：普通房间、群组、直聊、邀请态房间
- 空间列表：空间总览、空间树、空间子房间、空间成员与加入流转
- 消息区：房间时间线、消息元信息、已读/输入中/在线状态扩展
- 好友关系：好友列表、好友请求、好友分组、好友转直聊

本规范不再把 UI 设计建立在纯前端假设上，而是以后端已经存在的接口、数据结构、权限规则和增量同步机制为基线。

## 2. 后端基线

### 2.1 架构结论

`synapse-rust` 的核心链路是稳定的 `route -> service -> storage` 分层：

- `route` 负责版本路径、权限入口、参数校验和响应整形
- `service` 负责业务规则、权限判断、状态同步、派生字段计算
- `storage` 负责真实数据模型、排序、分页、筛选和持久化

对 UI 设计最重要的含义是：

- 页面能力是否存在，必须以后端路由是否暴露为准
- 某个按钮是否可见，必须以后端权限规则是否允许为准
- 列表排序、分页和增量刷新，应优先复用后端现有语义，而不是前端自行发明第二套规则

### 2.2 UI 相关后端能力总览

| UI 域 | 主接口/能力 | 关键数据来源 | 设计约束 |
| --- | --- | --- | --- |
| 房间列表 | `POST /_matrix/client/v3/sync` | sliding sync 房间载荷 | 支持增量同步、窗口化加载、扩展数据 |
| 房间摘要 | `/rooms/{room_id}/summary*` | `room_summaries`、成员、状态、统计 | 读取需房间成员；管理需房间创建者 |
| 空间列表 | `/spaces/public`、`/spaces/user`、`/spaces/search` | `spaces` | 可见性受 `is_public` 与成员关系约束 |
| 空间树 | `/spaces/{space_id}/hierarchy`、`/hierarchy/v1`、`/tree_path` | `space_children`、`space_members` | 支持分页、`suggested_only`、路径面包屑 |
| 直聊识别 | `/direct`、`/rooms/{room_id}/dm`、`/rooms/{room_id}/dm/partner` | `m.direct` 账户数据 + 成员回推 | DM 可由账户数据或双人房成员结构推导 |
| 房间标签 | `/user/{user_id}/rooms/{room_id}/tags` | `room_tags` | 支持置顶/分类类房间标签 |
| 好友关系 | `/friends*` | `m.friends.list`、`m.friends.groups`、`friend_requests` | 受 `friends` feature gate 控制 |
| 消息辅助状态 | sliding sync `extensions` | `account_data`、`receipts`、`typing`、`presence` | 允许消息区与列表联动展示次级状态 |

### 2.3 版本与特性注意事项

- 房间摘要和空间接口同时覆盖 `v1`、`r0`、`v3` 的多个前缀，客户端应统一收口到一套调用封装。
- sliding sync 已提供 `v3` 正式入口，也保留 `MSC3575` 的 unstable 路径，适合做兼容兜底。
- 好友接口是 feature-gated 能力。`Cargo.toml` 中 `friends` 被纳入默认 `all-extensions`，但最小化部署可以禁用，所以 UI 不能默认好友能力恒定存在。

### 2.4 matrix-js-sdk 事件与组件接口基线

在 `matrix-js-sdk` 这一层，UI 不应直接把所有逻辑绑定在 HTTP 返回值上，而应优先利用 SDK 已经稳定暴露的事件与管理器接口：

| SDK 域 | 关键接口 | UI 价值 |
| --- | --- | --- |
| 同步生命周期 | `ClientEvent.Sync` + `SyncState` | 控制首屏加载、断线恢复、重连横幅 |
| 全局事件流 | `ClientEvent.Event`、`ClientEvent.Room` | 统一接收新增事件、房间刷新和房间级重算 |
| 房间事件 | `RoomEvent.Timeline`、`RoomEvent.UnreadNotifications`、`RoomEvent.Summary`、`RoomEvent.Tags` | 房间列表预览、未读数、摘要和标签更新 |
| 成员事件 | `RoomMemberEvent.Membership`、`RoomMemberEvent.Name`、`RoomMemberEvent.Typing` | 成员列表、在线/输入中状态、昵称变化 |
| 事件模型 | `MatrixEvent`、`MatrixEventEvent.Status`、`MatrixEventEvent.Decrypted` | 渲染发送状态、解密状态、失败重试和消息元信息 |
| 事件管理器 | `EventManager` | 拉取消息分页、事件上下文、线程列表 |
| 房间摘要管理器 | `RoomSummaryManager` | 详情面板、人数统计、未读数、元信息 |
| 直聊管理器 | `DirectMessageManager` | `m.direct` 读取、DM 回退识别、DM 房间创建 |
| 好友管理器 | `FriendManager` | 好友列表、请求列表、接受后返回 `room_id` |
| 空间管理器 | `SpaceManager` | 用户空间、公开空间、层级树、加入/离开、树路径 |

前端文档和实现需要遵循两条规则：

- 首选 “SDK 事件 -> 组件状态 -> 视觉更新” 的链路，而不是每个组件各自重复轮询接口。
- 只有在 SDK 尚未覆盖某能力时，才允许组件直接调用服务层 HTTP 封装。

## 3. 数据合同与真实字段

### 3.1 房间列表主数据源：sliding sync

房间列表应优先使用 `POST /_matrix/client/v3/sync` 及其 unstable 同名接口作为主数据源。列表项已经可直接获得以下关键字段：

| 字段 | 含义 | UI 用途 |
| --- | --- | --- |
| `room_id` | 房间 ID | 列表主键、跳转目标 |
| `name` | 房间名 | 标题显示 |
| `avatar` | 房间头像 | 头像区 |
| `is_dm` | 是否直聊 | 切换单聊布局和默认文案 |
| `is_encrypted` | 是否加密 | 加密角标、安全说明 |
| `is_tombstoned` | 是否已迁移/废弃 | 禁用输入、显示迁移提示 |
| `invited` | 是否邀请态 | 展示接受/拒绝 CTA |
| `highlight_count` | 高优先级未读 | `@我` / 红点强提醒 |
| `notification_count` | 普通未读 | 常规未读徽章 |
| `timestamp` | 房间排序时间戳 | 列表排序、最近更新时间 |
| `bump_stamp` | bump 时间 | 新消息驱动排序优化 |

房间列表文档和实现必须明确：

- `highlight_count` 与 `notification_count` 是两层语义，不能合并成一个数字。
- 邀请态房间是列表一等状态，不应被当作异常态处理。
- tombstoned 房间需要保留可见性，但交互上必须降级。

### 3.2 房间补充数据源：room summary

当列表需要更完整的房间元信息时，可从 `/rooms/{room_id}/summary` 及其子接口补充：

| 字段 | 来源 | UI 用途 |
| --- | --- | --- |
| `room_type` | room summary | 区分普通房间 / `m.space` |
| `topic` | room summary | 二级描述、详情页摘要 |
| `canonical_alias` | room summary | 别名信息、复制入口 |
| `join_rule` | room summary | 显示公开/邀请加入策略 |
| `history_visibility` | room summary | 历史可见性说明 |
| `guest_access` | room summary | 游客访问提示 |
| `is_direct` | room summary | 直聊兜底识别 |
| `is_space` | room summary | 空间入口识别 |
| `is_encrypted` | room summary | 安全角标 |
| `member_count` | room summary | 房间人数 |
| `joined_member_count` | room summary | 已加入人数 |
| `invited_member_count` | room summary | 待接受人数 |
| `heroes` | room summary | 无房间名时的人名/头像组合 |
| `last_event_ts` | room summary | 列表排序与更新提示 |
| `last_message_ts` | room summary | 消息型排序辅助 |

补充规则：

- 房间摘要读取要求用户是房间成员。
- 房间摘要修改、成员管理、统计重算等管理操作，仅房间创建者可执行。
- `/_synapse/room_summary/v1/summaries` 已提供当前用户摘要列表，可作为非实时回退或二次校验来源。

### 3.3 房间排序与可见范围

房间摘要列表的存储层对当前用户按如下逻辑筛选与排序：

- 只返回 `membership IN ('join', 'invite')` 的房间
- 默认按 `last_event_ts DESC NULLS LAST` 排序

这意味着 UI 设计应遵循：

- “已加入”和“邀请中”都属于房间列表可见范围
- 默认排序优先使用后端时间戳，不应前端另造复杂本地排序
- 置顶、收藏等个性化顺序应叠加在后端基础排序之上，而不是替代它

### 3.4 空间数据合同

空间实体和空间层级已经具备完整的数据模型：

#### 空间实体 `Space`

- `space_id`
- `room_id`
- `name`
- `topic`
- `avatar_url`
- `creator`
- `join_rule`
- `visibility`
- `is_public`
- `parent_space_id`
- `room_type`

#### 空间子项 `SpaceChild`

- `room_id`
- `is_suggested`
- `via_servers`
- `order`
- `suggested`
- `added_by`
- `removed_ts`

#### 分页层级项 `SpaceHierarchyRoom`

- `room_id`
- `name`
- `topic`
- `avatar_url`
- `join_rule`
- `world_readable`
- `guest_can_join`
- `num_joined_members`
- `room_type`
- `children_state`

因此空间列表与空间树 UI 必须准确表达：

- 子节点既可能是普通房间，也可能继续是子空间
- `suggested_only` 是真实存在的筛选维度
- `tree_path` 与 `parents` 已可支撑面包屑和反向定位
- 空间树并非一次性全量返回，`hierarchy/v1` 已提供 `next_batch` 分页

### 3.5 直聊与好友数据合同

#### 直聊

后端为直聊提供两套并存能力：

- `m.direct` 账户数据映射：某用户 ID 对应多个 DM 房间 ID
- 双人房成员结构回推：当 `m.direct` 为空时，可从仅有两名成员的房间反推 DM

这意味着 UI 不应只依赖单一字段判断 DM。

#### 好友

好友并不是简单的用户目录结果，而是由独立关系模型维护：

- 好友列表状态事件：`m.friends.list`
- 好友分组状态事件：`m.friends.groups`
- 好友请求表：`friend_requests`
- 接受好友后会创建 `trusted_private_chat` 直聊房间，并写入好友列表

好友项当前真实状态值包括：

- `favorite`
- `normal`
- `blocked`
- `hidden`

UI 文档中原来的“特别关心 / 普通好友 / 已屏蔽”分组，应校正为：

- 可直接映射 `favorite`、`normal`、`blocked`
- `hidden` 更适合作为默认隐藏分组或高级筛选，不建议与普通分组并列常驻显示

## 4. 房间列表专项 UI 方案

### 4.1 信息结构

每个房间列表项拆分为四区：

1. 头像区：房间头像、加密角标、直聊标识、邀请态角标
2. 主信息区：名称、hero 回退名称、最近消息摘要或状态摘要
3. 状态区：`@我`、未读数、静音/标签、tombstoned/邀请/发送异常
4. 时间区：排序时间、同步状态、增量更新反馈

### 4.2 字段到 UI 的映射规则

| 后端字段 | UI 表现 |
| --- | --- |
| `highlight_count > 0` | 高优先级红色徽章，优先于普通未读 |
| `notification_count > 0` 且 `highlight_count = 0` | 中性或品牌色未读徽章 |
| `invited = true` | 列表项右侧显示接受/拒绝二级入口 |
| `is_dm = true` | 使用单聊文案与头像规则 |
| `is_encrypted = true` | 显示端到端加密角标 |
| `is_tombstoned = true` | 降低饱和度并显示“已迁移”提示 |
| `room_type = m.space` 或 `is_space = true` | 进入空间视图而非普通聊天视图 |
| `heroes` 非空且 `name` 为空 | 生成默认标题与头像堆叠 |

### 4.3 排序与分区

推荐的桌面端列表分区：

- 置顶区：来自 `m.tag` / 本地置顶策略的前置分组
- 邀请区：`invited = true` 的房间，数量较少时可内联，较多时折叠
- 普通区：按 `timestamp` 或 `last_event_ts` 倒序
- 空间入口区：`is_space = true` 的项目可与房间列表混排，也可在宽屏独立侧栏展示

排序原则：

- 默认尊重后端同步时间戳
- 本地标签排序只能在同分区内微调
- 不建议仅因未读数就打乱最近活跃顺序

### 4.4 交互优化

桌面端：

- 单击打开房间
- 单击后只更新当前选中态、主聊天区和右侧详情区，不允许再打开独立业务窗口
- 右键显示 `标记已读 / 打标签 / 复制房间 ID / 查看摘要 / 更多`
- hover 只暴露轻量操作，不承载关键状态

移动端：

- 左滑显示 `已读 / 标签 / 更多`
- 邀请态房间在滑动之外保留主按钮，避免误触路径过长
- 长按面板中应包含 `查看摘要`，因为后端已有 room summary 查询能力

### 4.5 loading / reconnect / 增量同步

房间列表必须围绕 sliding sync 设计，而不是一次性请求模型：

- 首次同步：显示骨架屏和分区占位
- 增量同步：只更新受影响列表项，不整表重绘
- 断线重连：展示顶部轻量横幅，不覆盖列表点击
- 限流或重试中：保留旧数据，只提示“正在恢复同步”
- 分页窗口变更：优先使用虚拟列表与窗口化渲染

SDK 事件映射建议：

- `ClientEvent.Sync -> SyncState.Prepared/Syncing/Reconnecting/Error`：驱动 `loading / reconnect / retry` 横幅
- `RoomEvent.UnreadNotifications`：驱动未读徽章和读标记更新
- `RoomEvent.Summary`：驱动列表项标题、副标题、hero 兜底名刷新
- `RoomEvent.Tags`：驱动置顶/收藏/分类分区微调

### 4.6 响应式方案

- `>= 1280px`：房间列表、聊天区、详情侧栏三栏布局
- `768px - 1279px`：房间列表 + 聊天区双栏，详情改抽屉
- `< 768px`：房间列表与聊天区分屏；摘要、标签、成员等详情进入二级页

### 4.7 无障碍与性能

- 列表项读屏文案至少包含房间名、最近摘要、未读数、是否邀请
- `highlight_count` 不能只靠颜色表达，需附带文案或图标冗余
- 虚拟列表中避免复杂滤镜和大面积半透明模糊
- 增量更新时保证焦点项不跳位，特别是键盘用户正在浏览时

## 5. 空间列表专项 UI 方案

### 5.1 UI 目标

空间列表不是普通树控件，而是“导航 + 聚合 + 权限感知”的复合视图。它应真实反映：

- 空间的公开性、可见性、加入门槛
- 子空间与子房间的层级关系
- `suggested` 子项的优先展示语义
- `tree_path` 和 `parents` 支持的面包屑回溯能力

### 5.2 推荐布局

桌面端推荐三段式：

1. 空间侧栏：用户空间、公开空间、搜索结果
2. 空间树区：当前空间的子空间/子房间分层列表
3. 内容区：选中房间的聊天内容或空间摘要

移动端推荐两层：

- 一级：空间列表或用户空间入口
- 二级：空间树与房间集合
- 三级：具体房间聊天页

### 5.3 空间项状态矩阵

| 后端状态 | UI 表达 |
| --- | --- |
| `is_public = true` | 显示公开标识，可直接浏览 |
| `join_rule = invite` | 显示邀请加入说明；无邀请时按钮禁用 |
| `visibility = public` | 支持未登录或未加入预览时的公开描述 |
| `room_type = m.space` | 用空间图标与导航型文案 |
| `is_suggested = true` | 在空间树中靠前显示并添加推荐标签 |
| `next_batch != null` | 树尾显示“加载更多”而非假全量展开 |

### 5.4 空间树交互

- 层级展开默认按需加载，不一次性展开全树
- 对 `hierarchy/v1` 使用“加载更多子项”交互，而不是无限自动请求
- `tree_path` 用于顶部面包屑；点击任一层级应回到对应空间节点
- 子项若为普通房间，则进入房间详情；若为子空间，则进入下一层空间树
- 建议为 `suggested_only` 提供切换开关，但默认打开与否应由产品策略决定

SDK 接口映射建议：

- `SpaceManager.getUserSpaces()`：驱动空间侧栏
- `SpaceManager.getPublicSpaces()`：驱动公开空间发现页
- `SpaceManager.getSpaceHierarchyV1()`：驱动分页空间树
- `SpaceManager.getSpaceTreePath()`：驱动面包屑与回溯定位
- `SpaceManager.joinSpace()/leaveSpace()`：驱动加入/退出按钮状态切换

### 5.5 加入与权限流转

- 公开空间：主按钮为 `加入` 或 `查看`
- 私有可见空间：若当前用户可见但未加入，可显示 `申请加入` 或只读说明
- 邀请制空间：若无 invite membership，按钮需置灰并解释原因，不能伪装成可操作按钮
- 仅创建者可修改空间资料、增删子项，因此编辑入口必须在 UI 上做权限裁剪

### 5.6 空间摘要视图

空间摘要应建立在 `/summary` 与 `/summary/with_children` 基础上，至少包含：

- 空间名称、头像、topic
- `join_rule`
- 是否公开可读 `world_readable`
- 是否允许游客加入 `guest_can_join`
- `num_joined_members`
- 子项列表 `children`
- 子项状态 `children_state`

不建议前端自行拼装“空间概览卡片”字段，优先复用服务端摘要返回。

### 5.7 响应式、性能、无障碍

- 移动端树节点热区不小于 44px
- 树节点的展开/收起必须支持键盘和读屏状态播报
- 分页层级列表优先增量追加，不整棵树重建
- 深层空间嵌套时要限制首屏深度，避免过重首屏计算与渲染

## 6. 消息区与房间详情 UI 规范

### 6.1 真实可用的次级状态

sliding sync `extensions` 已支持：

- `account_data`
- `receipts`
- `typing`
- `presence`
- `to_device`
- `e2ee`

因此消息区可以在不额外发散协议的前提下实现：

- 输入中状态
- 已读回执与读到位置提示
- 在线状态或最近活跃提示
- 端到端加密相关状态角标

### 6.2 设计约束

- 时间戳不能完全依赖 hover，可弱显示但必须稳定存在
- 回执、输入中、在线状态属于“次级动态信息”，不应挤占主消息正文层级
- 对 tombstoned 房间、只读房间、邀请态房间，输入区必须按权限降级

### 6.3 房间摘要侧栏

当屏幕宽度允许时，消息区右侧详情建议复用房间摘要接口展示：

- 房间概览
- 加密状态
- 成员数量
- 主题与别名
- 房间统计信息 `/summary/stats`
- 成员摘要 `/summary/members`

对应 SDK 推荐接口：

- `RoomSummaryManager.getRoomSummary(roomId)`
- `RoomSummaryManager.getRoomSummaryMembers(roomId)`
- `RoomSummaryManager.getRoomSummaryStats(roomId)`
- `EventManager.getMessages(roomId, ...)` 或 `createMessagesRequest(...)`

## 7. 好友与直聊 UI 规范

### 7.1 能力门禁

好友 UI 必须先做能力探测：

- 若后端未编译 `friends` feature，好友页应降级为“通讯录能力不可用”空态
- 若接口可用但列表为空，不应直接判定为异常，因为 `GET /friends` 会先创建一个 `m.friends` 房间，再返回空数组

### 7.2 好友列表真实来源

好友列表数据并非用户目录搜索结果，而是 `m.friends.list` 最新状态事件中的 `friends` 数组。单项默认可包含：

- `user_id`
- `since`
- `status`
- `added_at`
- `note`
- `displayname`
- `status_updated_ts`
- `displayname_updated_ts`

因此好友页必须支持：

- 备注名优先显示
- 基于 `status` 的分组与过滤
- 空列表、隐藏列表、阻止列表的差异化空态

### 7.3 好友请求与接受后路径

接受好友请求时，后端会：

1. 校验存在 pending 请求
2. 双向写入好友关系
3. 创建 `trusted_private_chat` 且 `is_direct = true` 的 DM 房间
4. 返回新建 `room_id`

UI 最佳路径应是：

- 接受成功后立即跳转或预创建会话项
- 好友页与房间列表同时刷新
- 若房间列表尚未收到增量同步，先用返回的 `room_id` 建立本地过渡态

SDK 侧建议直接使用：

- `FriendManager.getFriends()`
- `FriendManager.getIncomingRequests()`
- `FriendManager.acceptFriendRequest(userId)`，读取返回的 `room_id`
- `DirectMessageManager.getDmForUser(userId)` 作为会话回查
- `DirectMessageManager.getDMRooms()` 作为 DM 列表补偿刷新

### 7.4 好友分组与状态映射

建议默认分组：

- 收藏好友：`favorite`
- 普通好友：`normal`
- 已屏蔽：`blocked`
- 已隐藏：`hidden`，默认折叠或只在筛选中展示

原文档中的“特别关心”可以保留为产品文案，但实现层必须映射到 `favorite`。

### 7.5 好友推荐

后端已支持两类推荐：

- 基于共同好友
- 基于共同房间

若 UI 需要“你可能认识的人”，应明确标注推荐理由，而不是展示成普通好友列表。

## 8. 设计 Token 与状态语义补充

结合后端能力，组件级语义 token 需要新增或固定以下用途：

- `--hula-room-unread-badge-bg`: 普通未读
- `--hula-room-highlight-badge-bg`: 高优先级未读/提及
- `--hula-room-invite-bg`: 邀请态背景
- `--hula-room-tombstoned-text`: 迁移房间文本
- `--hula-space-public-badge-bg`: 公开空间标签
- `--hula-space-invite-badge-bg`: 邀请制空间标签
- `--hula-friend-favorite-badge-bg`: 收藏好友状态
- `--hula-friend-blocked-badge-bg`: 已屏蔽状态
- `--hula-sync-recovering-bg`: 增量同步恢复横幅

## 9. 实施约束

### 9.0 弹窗清零约束

以下信息域不得再创建新的独立 `WebviewWindow`：

- 房间详情
- 房间成员列表
- 房间公告查看/编辑
- 房间设置
- 好友添加、好友验证、好友详情
- 空间设置、空间成员、空间加入说明

统一替代原则：

- 桌面端优先使用右侧详情区或同页分栏
- 中窄屏优先使用抽屉
- 局部轻操作使用浮层/Popover
- 仅当交互不可在现有壳层中承载时，才允许短生命周期模态框

明确禁止：

- 点击房间列表项后再弹出“房间信息独立窗口”
- 从详情区跳出第二个业务窗口展示同类信息
- 同一信息既有右侧详情区又有单独弹窗入口

### 9.1 前端不得假设的能力

以下能力当前不能在 UI 文档中写成“必有”：

- 好友接口永远开启
- 房间列表永远全量返回
- 空间树永远一次性返回完成
- 所有私有空间都允许当前用户查看摘要
- 邀请制空间可以直接加入

### 9.2 前端应主动利用的能力

以下能力已经存在，建议在实现中优先使用：

- room summary 作为房间元信息统一来源
- sliding sync 作为房间列表的增量主通道
- `m.direct` + 双人成员回推 双重识别 DM
- `m.tag` 作为收藏/置顶/分类元数据承载
- `tree_path` / `parents` 构建空间面包屑与回溯导航
- `ClientEvent.Sync` / `RoomEvent.*` / `RoomMemberEvent.*` 构建响应式 UI 状态更新

## 10. 验收标准

### 10.1 功能准确性

- 房间列表状态与后端字段一一对应，不再混淆高亮未读与普通未读
- 空间列表能够正确区分公开、私有、邀请制三类空间
- 好友列表状态值与后端真实枚举一致
- 直聊识别同时兼容 `m.direct` 与成员结构回推

### 10.2 体验质量

- 用户可在 3 秒内完成房间列表扫读
- 用户可在 2 次交互内进入某个空间下的目标房间
- 用户接受好友请求后能立即进入对应直聊或看到明确反馈
- 点击房间列表项后无二次弹窗，信息直接在主聊天区与右侧详情区更新

### 10.3 工程可实施性

- 所有列表项字段均有明确后端来源
- 所有管理操作均有明确权限前置说明
- 所有降级态都能对应后端未开启、无权限或无数据三种不同原因
- 所有房间/空间/好友业务组件都必须能映射到 SDK 管理器或事件接口
