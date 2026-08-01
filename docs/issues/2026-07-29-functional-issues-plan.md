# HuLa 功能性问题技术解决方案

> 制定日期：2026-07-29
> 涉及问题：房间列表筛选 / 公告加载失败 / 头像弹窗功能对齐 / 右键菜单完善 / 空间列表不显示

---

## 问题 1：房间列表筛选逻辑优化

### 1.1 现状分析

**数据流全链路：**
1. `chatStore.sessionList`（[chat/session.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/chat/session.ts)）从 Matrix SDK SlidingSync 获取**所有**会话（GROUP + SINGLE + SPACE）
2. `useSessionListState`（[useSessionListState.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/composables/workbench/useSessionListState.ts#L64-L68)）的 `sessionList` computed 直接返回原始列表，**未做类型过滤**
3. [RoomList.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/homeWindow/RoomList.vue#L77) 在组件层过滤：`sessionList.filter(item => item.type === RoomTypeEnum.GROUP)`
4. [useMessageSessionFilters](file:///Users/ljf/Desktop/hu_ts/hula/src/composables/workbench/useMessageSessionFilters.ts#L43-L53) 的 `sessionTypeFilter` 同样基于 `RoomTypeEnum.GROUP` 筛选

**问题根源：**
- 过滤逻辑分散在组件层，`sessionList` 计算属性返回全量数据，导致不同组件需要各自重复过滤
- `WORKBENCH_SESSION_TYPE_FILTERS`（[spaceNavigation.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/router/spaceNavigation.ts#L9-L13)）定义了 `all | group | single` 三种筛选器，但 SPACE 类型没有独立筛选器，空间可能混入 `all` 结果
- RoomList.vue 虽然过滤了 GROUP，但如果有 SPACE 类型的会话混入（SlidingSync 可能返回），不会被过滤掉

### 1.2 解决方案

**步骤 1：在 `useSessionListState` 中新增 `groupSessionList` computed**

```typescript
// useSessionListState.ts
const groupSessionList = computed(() =>
  sessionList.value.filter((item) => item.type === RoomTypeEnum.GROUP)
)
```

**步骤 2：RoomList.vue 改用 `groupSessionList`**

将 RoomList.vue 的 `roomSessionList` computed 从自行过滤改为直接使用 composable 提供的 `groupSessionList`。

**步骤 3：在 `sessionTypeFilter` 中排除 SPACE 类型**

```typescript
// useMessageSessionFilters.ts - filteredSessionList 中增加 SPACE 过滤
const filteredSessionList = computed(() => {
  return sessionList.value.filter((item) => {
    // 排除空间类型，空间只在空间列表页展示
    if (item.type === RoomTypeEnum.SPACE) return false
    // ...其余筛选逻辑
  })
})
```

**步骤 4：确认 SlidingSync 配置**

确认 [MatrixSlidingSyncService](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/sync/MatrixSlidingSyncService.ts) 的 list filter 中是否已按 room_type 分类，避免在消息列表 sync 中拉取 SPACE 房间。

### 1.3 测试方案

- 单测：`useSessionListState.test.ts` 新增 `groupSessionList` 只返回 GROUP 类型的断言
- 单测：`useMessageSessionFilters.test.ts` 新增 SPACE 类型被过滤的断言
- E2E：创建空间后切换到房间列表，确认空间不出现在房间列表中

---

## 问题 2：房间公告加载失败

### 2.1 现状分析

**调用链：**
1. [ChatMain.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/ChatMain.vue) `loadTopAnnouncement` → `announcementStore.getGroupAnnouncementList`
2. [announcement.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/announcement.ts#L57-L124) `loadGroupAnnouncements` → `matrixRoomQueryService.getRoom(targetRoomId, false)` → `room.currentState.getStateEvents(EventType.RoomTopic, '')`
3. 失败时 `catch` 块调用 `showFeedback('加载群公告失败', 'error')` 并设置 `announError = true`
4. [ChatSidebar.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/ChatSidebar.vue#L50-L64) 显示 `announError` 时渲染"加载失败"提示

**问题根源：**
- 新建房间后，`matrixRoomQueryService.getRoom(roomId, false)` 可能返回 `null`（房间尚未通过 SlidingSync 完全加载到客户端）
- 即使 `room` 存在，`room.currentState` 可能尚未同步 `m.room.topic` 和 `m.room.pinned_events` 状态事件，导致 `getStateEvents` 抛出异常
- `room.findEventById?.(eventId)` 对于 pinned events 可能找不到事件（事件尚未从后端拉取）
- 以上任何异常都会进入 `catch` 块，显示"加载公告失败"，但**新房间本来就没有公告**，应显示空状态而非错误

### 2.2 解决方案

**步骤 1：在 `loadGroupAnnouncements` 中对状态读取做细粒度容错**

```typescript
// announcement.ts - loadGroupAnnouncements
const room = await matrixRoomQueryService.getRoom(targetRoomId, false)
if (!room) {
  // 房间尚未加载完成，不视为错误，静默返回空列表
  announList.value = []
  announNum.value = 0
  announError.value = false
  return
}

const announcements: Announcement[] = []

// 对 topic 读取单独 try-catch
try {
  const topic = room.currentState.getStateEvents(EventType.RoomTopic, '')
  if (topic) {
    const content = topic.getContent()
    announcements.push({ /* ... */ })
  }
} catch (e) {
  logger.warn('读取 room topic 失败（可能尚未同步）:', e)
}

// 对 pinned events 读取单独 try-catch
try {
  const pinnedEvents = room.currentState.getStateEvents(EventType.RoomPinnedEvents, '')
  if (pinnedEvents) {
    // ... 现有逻辑
  }
} catch (e) {
  logger.warn('读取 pinned events 失败（可能尚未同步）:', e)
}
```

**步骤 2：ChatMain.vue 的 `loadTopAnnouncement` 已有的 try-catch 中，不再向上抛出**

ChatMain.vue 中 `loadTopAnnouncement` 已有 try-catch，在 catch 中 `topAnnouncement.value = null`。确认 store 层不再调用 `showFeedback`，改为由调用方决定是否提示。

**步骤 3：ChatSidebar.vue 的错误提示改为空状态提示**

当 `announNum === 0 && !announError` 时显示默认文案（已有此逻辑，确保 `announError` 不被错误设置）。

### 2.3 测试方案

- 单测：`announcement.test.ts` 新增用例：`getRoom` 返回 null 时不设置 `announError`，返回空列表
- 单测：`getStateEvents` 抛异常时不设置 `announError`，返回空列表
- 手动测试：创建新房间 → 点击该房间 → 确认 ChatSidebar 显示默认文案而非"加载失败"

---

## 问题 3：头像点击弹窗功能对齐

### 3.1 现状分析

**组件：** [InfoPopover.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/InfoPopover.vue)

**当前功能项：**
| 功能 | 触发条件 | 后端 API 支持 | 状态 |
|------|---------|-------------|------|
| 编辑资料 | `isCurrentUserUid`（自己） | `MatrixProfileService.setDisplayName` / `setAvatarUrl` | 已实现 |
| 发消息 | `isMyFriend`（好友） | `openMsgSession` | 已实现 |
| 添加好友 | 非好友 | `contactStore.startDirectRoom` | 已实现 |
| 更换头像 | 点击头像（自己） | `useAvatarUpload` + `MatrixProfileService.updateAvatar` | 已实现 |
| 在线状态 | 所有人 | `userStatusStore` | 已实现 |
| 点赞 | — | **无后端 API** | **未在 InfoPopover 中实现** |

**问题根源：**
- InfoPopover.vue 当前**没有**点赞功能，用户提到的"点赞"可能在其他组件中，或是需求文档中的待实现项
- 头像上传功能已有 `useAvatarUpload` composable 和 `MatrixProfileService.updateAvatar`，但需确认 `openEditInfo` 弹窗中是否有完整的更换头像 UI
- `SynapseRustExtensionsService` 中无点赞相关 API，确认后端不支持

### 3.2 解决方案

**步骤 1：确认点赞功能是否存在**

搜索整个前端代码库确认"点赞"是否在任何组件中被实现。如果存在且后端不支持，移除相关 UI 和逻辑。

**步骤 2：完善头像更换功能**

确认 `openEditInfo`（通过 `MittEnum.OPEN_EDIT_INFO` 事件触发）打开的编辑弹窗中包含头像上传 UI。如果缺失，在编辑弹窗中集成 `useAvatarUpload`。

**步骤 3：移除后端不支持的功能项**

如果发现任何无后端支撑的功能入口（如点赞），从 UI 中移除，避免功能断层。

### 3.3 测试方案

- 单测：`InfoPopover` 的渲染测试，确认按钮根据用户关系正确显示
- 手动测试：点击自己头像 → 确认可更换头像；点击好友头像 → 确认显示"发消息"；点击陌生人头像 → 确认显示"添加好友"

---

## 问题 4：右键功能完善

### 4.1 现状分析

**三个列表的右键菜单现状：**

| 列表 | 实现位置 | 菜单项 | 状态 |
|------|---------|--------|------|
| 消息列表 | [useMessage.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/composables/chat/useMessage.ts#L139-L371) | 置顶/取消置顶、低优先级、复制账号、标记未读、消息免打扰设置、屏蔽/取消屏蔽、从列表移除、密友聊天、删除好友/退出群聊 | **完整** |
| 房间列表 | [RoomList.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/homeWindow/RoomList.vue#L64) 复用 `useMessage()` | 同消息列表 | **完整（复用消息列表逻辑）** |
| 好友列表 | [FriendListView.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/friend/FriendListView.vue#L613-L689) | 发消息、加密聊天、密友聊天、设置备注、设置昵称、设为特别关心/普通/拉黑、删除好友 | **完整** |

**问题根源：**
- 三个列表的右键菜单**功能项已基本完整**，问题可能在于：
  1. **"标记未读"** 菜单项（[useMessage.ts:194-197](file:///Users/ljf/Desktop/hu_ts/hula/src/composables/chat/useMessage.ts#L194-L197)）只有 `label` 和 `icon`，**缺少 `click` 回调**，点击无效果
  2. 右键菜单在 RoomList.vue 中是否正确绑定到 HulaRoomListItem 需确认
  3. 好友列表的右键菜单使用独立的 `ContextMenu` 组件和 `switch(label)` 模式，与消息列表的 `OPT.RightMenu` 模式不一致

### 4.2 解决方案

**步骤 1：补全"标记未读"功能**

```typescript
// useMessage.ts - menuList 中 "标记未读" 项
{
  label: () => t('menu.mark_unread'),
  icon: 'message-unread',
  click: (item: SessionItem) => {
    // 将会话标记为未读：设置 unreadCount 至少为 1
    chatStore.updateSession(item.roomId, { unreadCount: Math.max(item.unreadCount, 1) })
    showFeedback(t('message.message_menu.mark_unread_success'), 'success')
  }
}
```

**步骤 2：确认 RoomList.vue 右键菜单事件链路**

RoomList.vue → RoomSessionList.vue → HulaRoomListItem.vue 的事件传递链路：`visibleMenu` / `visibleSpecialMenu` prop → `@select` event → `handleSelect` → `menuItem.click(item)`。确认此链路无断点。

**步骤 3：统一好友列表右键菜单模式（可选）**

将 FriendListView 的 `switch(label)` 模式迁移为 `OPT.RightMenu[]` 模式，与消息列表保持一致。此项为优化，非阻塞。

### 4.3 测试方案

- 单测：`useMessage.test.ts` 新增"标记未读" click 回调测试
- E2E：在消息列表右键 → 点击"标记未读" → 确认会话显示未读角标
- 手动测试：三个列表分别右键 → 确认菜单项完整且可点击

---

## 问题 5：空间列表不展示已创建的空间

### 5.1 现状分析

**数据加载链路：**
1. [SpaceList.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/homeWindow/SpaceList.vue#L35) `onMounted` → `useSpaces().load()`
2. [useSpaces.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/composables/space/useSpaces.ts#L31-L42) `load()` → `matrixSpaceService.getSpaces()`
3. [MatrixSpaceService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/room/MatrixSpaceService.ts#L544-L567) `getSpaces()` → `getUserSpaces()`
4. `getUserSpaces()` 调用 `manager.getUserSpaces()`（SpaceManager SDK 方法），3s 超时后回退到 `client.getRooms().filter(room => room.isSpaceRoom())`

**创建空间流程：**
1. [MatrixSpaceService.ts:120-170](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/room/MatrixSpaceService.ts#L120-L170) `createSpace()` → `client.createRoom({ creation_content: { type: 'm.space' } })` → `manager.createSpace()`（注册到后端，非致命）
2. [useSpaces.ts:44-58](file:///Users/ljf/Desktop/hu_ts/hula/src/composables/space/useSpaces.ts#L44-L58) `create()` → 创建后调用 `load()` 刷新

**问题根源：**
- `manager.getUserSpaces()` 可能返回**过时缓存**（SpaceManager 尚未同步新创建的空间），3s 内成功返回但列表不含新空间
- 此时**不会触发回退逻辑**（因为 `manager.getUserSpaces()` 没有超时或报错，只是返回的列表不含新空间）
- `manager.createSpace()` 注册失败时仅日志记录为"非致命"，但后续 `getUserSpaces()` 依赖 SpaceManager 的注册数据
- 回退路径 `client.getRooms().filter(room => room.isSpaceRoom())` 理论上能拿到新创建的空间（`client.createRoom` 后房间已在客户端），但因 `manager.getUserSpaces()` 成功返回而不会走到回退

### 5.2 解决方案

**步骤 1：创建空间后乐观更新列表**

```typescript
// useSpaces.ts - create 方法
const create = async (options: SpaceOptions): Promise<SpaceInfo | null> => {
  mutating.value = true
  error.value = null
  try {
    const result = await matrixSpaceService.createSpace(options)
    if (result) {
      // 乐观更新：立即将新空间加入列表头部，避免等待 SpaceManager 同步
      spaces.value = [result, ...spaces.value.filter((s) => s.spaceId !== result.spaceId)]
      // 异步刷新以确保数据一致
      void load()
    }
    return result
  } catch (err) {
    logger.error('create space failed', err)
    error.value = err instanceof Error ? err.message : String(err)
    return null
  } finally {
    mutating.value = false
  }
}
```

**步骤 2：`getUserSpaces()` 合并本地房间数据**

```typescript
// MatrixSpaceService.ts - getUserSpaces
async getUserSpaces(): Promise<SpaceInfo[]> {
  const client = matrixClientService.getClient()
  if (!client) return []

  // 从本地客户端获取所有空间房间（即时数据，不依赖 SpaceManager 同步）
  const localSpaces = client.getRooms()
    .filter((room) => room.isSpaceRoom())
    .map((room) => this.roomToSpaceInfo(room))

  try {
    const manager = this.getSpaceManager()
    const managerSpaces = await this.withTimeout(manager.getUserSpaces(), 3000, 'getUserSpaces')
    const managerIds = new Set(managerSpaces.map((s) => s.space_id))

    // 合并：以 SpaceManager 数据为主，补充本地有但 SpaceManager 未返回的空间
    const merged = [
      ...managerSpaces.map((s) => this.sdkSpaceToSpaceInfo(s)),
      ...localSpaces.filter((local) => !managerIds.has(local.spaceId))
    ]
    return merged
  } catch (err) {
    logger.error('[Space] SpaceManager 获取失败，使用本地数据:', err)
    return localSpaces
  }
}
```

**步骤 3：监听 SlidingSync 新房间事件**

在 SpaceList.vue 或 useSpaces 中监听 SlidingSync 的房间加入事件，当新空间房间同步到客户端时自动刷新列表。

### 5.3 测试方案

- 单测：`useSpaces.test.ts` 新增用例：`create()` 后 `spaces` 列表立即包含新空间
- 单测：`MatrixSpaceService.test.ts` 新增用例：`getUserSpaces()` 合并本地和 SpaceManager 数据
- E2E：创建空间 → 确认空间列表立即显示新空间 → 刷新页面后仍然显示

---

## 实施优先级

| 优先级 | 问题 | 原因 |
|--------|------|------|
| P0 | 问题 2：公告加载失败 | 直接影响新房间使用体验，出现错误提示 |
| P0 | 问题 5：空间列表不显示 | 核心功能不可用 |
| P1 | 问题 1：房间列表筛选 | 数据正确性问题，可能显示错误内容 |
| P1 | 问题 4：右键菜单完善 | "标记未读"功能缺失 |
| P2 | 问题 3：头像弹窗对齐 | 需先确认点赞功能是否存在再决定 |

---

## 接口调用规范

### 涉及的 Matrix / synapse-rust API

| 功能 | API / 方法 | 端点 |
|------|-----------|------|
| 获取房间状态 | `room.currentState.getStateEvents(eventType, stateKey)` | 本地客户端缓存 |
| 发送状态事件 | `client.sendStateEvent(roomId, eventType, content, stateKey)` | `PUT /_matrix/client/v3/rooms/{roomId}/state/{eventType}/{stateKey}` |
| 创建房间 | `client.createRoom(options)` | `POST /_matrix/client/v3/createRoom` |
| 获取用户空间 | `manager.getUserSpaces()` | SpaceManager SDK（封装 synapse-rust 扩展） |
| 创建空间 | `manager.createSpace(options)` | SpaceManager SDK |
| 设置头像 | `MatrixProfileService.setAvatarUrl(mxcUrl)` | `PUT /_matrix/client/v3/profile/{userId}/avatar_url` |
| 上传媒体 | `MatrixMediaService.upload(file)` | `POST /_matrix/media/v3/upload` |
| 设置房间标签 | `client.setRoomTag(roomId, tag, { order })` | `PUT /_matrix/client/v3/user/{userId}/rooms/{roomId}/tags/{tag}` |
| 隐藏会话 | Tauri command `hide_contact_command` | 本地 SQLite |

### 错误处理规范

- 所有 Matrix SDK 调用必须包在 try-catch 中
- 对"数据不存在"场景（新房间无公告、新空间未同步）返回空列表而非抛出错误
- 对"网络/权限错误"场景才设置 error 状态并显示错误提示
- 使用 `logger.warn` 记录非致命异常，`logger.error` 记录需排查的异常
