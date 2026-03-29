# HuLa Room 数据架构文档

## 概述

本文档描述了 HuLa 前后端的 Room 数据架构，基于原设计图结合实际代码优化完善。

---

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HuLa Matrix 系统                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────┐           ┌───────────────────────────────┐  │
│  │       前端 (Vue/Pinia)    │           │      后端 (synapse-rust)     │  │
│  │                          │           │                               │  │
│  │  ┌────────────────────┐  │           │  ┌─────────────────────────┐  │  │
│  │  │   useRoomStore     │  │           │  │     RoomService         │  │  │
│  │  │   - rooms Map      │  │           │  │  - create_room()        │  │  │
│  │  │   - RoomInfo[]     │  │──────────▶│  │  - join_room()          │  │  │
│  │  │   - messages Map   │  │           │  │  - leave_room()         │  │  │
│  │  └────────────────────┘  │           │  │  - get_room()           │  │  │
│  │            │              │           │  └─────────────────────────┘  │  │
│  │            ▼              │           │                               │  │
│  │  ┌────────────────────┐  │           │  ┌─────────────────────────┐  │  │
│  │  │    RoomInfo        │  │──────────▶│  │  RoomSummaryService     │  │  │
│  │  │ - roomId           │  │           │  │  - get_summary()        │  │  │
│  │  │ - name             │  │           │  │  - update_summary()     │  │  │
│  │  │ - avatarUrl        │  │           │  │  - get_members()        │  │  │
│  │  │ - isDirect         │  │           │  │  - increment_unread()   │  │  │
│  │  │ - isEncrypted      │  │           │  └─────────────────────────┘  │  │
│  │  │ - unreadCount      │  │           │                               │  │
│  │  │ - highlightCount   │  │           │                               │  │
│  │  │ - notificationCnt  │  │           │                               │  │
│  │  │ - lastMessage      │  │           │                               │  │
│  │  │ - lastMessageTime  │  │           │                               │  │
│  │  │ - members[]        │  │           │                               │  │
│  │  └────────────────────┘  │           │                               │  │
│  └──────────────────────────┘           └───────────────────────────────┘  │
│                                        │                                     │
│                                        ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         数据库层 (PostgreSQL)                          │ │
│  │                                                                         │ │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐  │ │
│  │  │     rooms      │  │ room_summaries │  │   room_memberships       │  │ │
│  │  │ ────────────── │  │ ─────────────── │  │ ──────────────────────── │  │ │
│  │  │ room_id (PK)   │  │ room_id (PK)    │  │ room_id + user_id (PK)   │  │ │
│  │  │ name           │  │ name            │  │ user_id (FK)            │  │ │
│  │  │ topic          │  │ avatar_url      │  │ membership              │  │ │
│  │  │ creator (FK)   │  │ topic           │  │ display_name            │  │ │
│  │  │ created_ts     │  │ member_count    │  │ avatar_url              │  │ │
│  │  │ is_public      │  │ joined_count    │  │ join_ts                 │  │ │
│  │  └────────────────┘  │ canonical_alias │  └────────────────────────────┘  │
│  │                       └─────────────────┘                                 │ │
│  │                                                                         │ │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐  │ │
│  │  │room_directory  │  │  room_aliases    │  │      room_tags            │  │ │
│  │  │ ────────────── │  │ ─────────────── │  │ ──────────────────────── │  │ │
│  │  │ room_id (PK)   │  │ room_id (FK)    │  │ room_id + user_id (PK)   │  │ │
│  │  │ canonical_al   │  │ alias (PK)      │  │ user_id (FK)            │  │ │
│  │  │ member_count   │  │ creator (FK)   │  │ tag_name                 │  │ │
│  │  │ join_rule      │  │ created_ts     │  │ is_public                │  │ │
│  │  │ is_public      │  └─────────────────┘  └────────────────────────────┘  │
│  │  │ is_searchable  │                                                       │ │
│  │  └────────────────┘                                                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、前端数据结构

### 2.1 RoomInfo（房间信息）

```typescript
interface RoomMemberInfo {
  userId: string           // 用户 ID
  name: string             // 显示名称
  avatarUrl?: string       // 头像 URL
  powerLevel?: number      // 权限等级
}

interface RoomInfo {
  roomId: string           // 房间 ID
  name: string            // 房间名称
  avatarUrl: string | null // 头像 URL
  isDirect: boolean       // 是否为私信房间
  isEncrypted: boolean    // 是否加密
  unreadCount: number     // 未读消息数
  highlightCount: number  // 高亮消息数 (@我的)
  notificationCount: number // 通知消息数
  lastMessage: string | null // 最后一条消息内容
  lastMessageTime: number | null // 最后消息时间
  members: RoomMemberInfo[] // 成员列表
}
```

### 2.2 核心 Store 结构

```typescript
// 房间 Store
const useRoomStore = defineStore('room', () => {
  // 房间 Map，用于快速查找
  rooms: Map<string, RoomInfo>
  
  // 当前房间 ID
  currentRoomId: string | null
  
  // 消息 Map
  messages: Map<string, MessageType[]>
  
  // 计算属性
  roomList: RoomInfo[]      // 按时间排序的房间列表
  currentRoom: RoomInfo    // 当前房间
  directRooms: RoomInfo[]  // 私信房间列表
  groupRooms: RoomInfo[]  // 群组房间列表
})
```

---

## 三、后端数据结构

### 3.1 RoomService

| 方法 | 说明 |
|------|------|
| `create_room()` | 创建房间 |
| `join_room()` | 加入房间 |
| `leave_room()` | 离开房间 |
| `get_room()` | 获取房间信息 |
| `get_user_rooms()` | 获取用户房间列表 |
| `get_room_messages()` | 获取房间消息 |

### 3.2 RoomSummaryService

| 方法 | 说明 |
|------|------|
| `get_summary()` | 获取房间摘要 |
| `update_summary()` | 更新房间摘要 |
| `get_members()` | 获取房间成员 |
| `update_state()` | 更新房间状态 |
| `increment_unread()` | 增加未读数 |
| `clear_unread()` | 清除未读数 |

---

## 四、数据库表结构

### 4.1 rooms（房间主表）

```sql
CREATE TABLE rooms (
    room_id TEXT PRIMARY KEY,
    name TEXT,
    topic TEXT,
    creator TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    room_version TEXT DEFAULT '6',
    created_ts BIGINT NOT NULL
);
```

### 4.2 room_summaries（房间摘要表）

```sql
CREATE TABLE room_summaries (
    room_id TEXT PRIMARY KEY,
    name TEXT,
    avatar_url TEXT,
    topic TEXT,
    canonical_alias TEXT,
    member_count BIGINT DEFAULT 0,
    joined_count BIGINT DEFAULT 0,
    topic_updated_ts BIGINT
);
```

### 4.3 room_memberships（房间成员表）

```sql
CREATE TABLE room_memberships (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    membership TEXT NOT NULL,  -- 'join', 'leave', 'ban', 'invite'
    display_name TEXT,
    avatar_url TEXT,
    join_ts BIGINT,
    UNIQUE(room_id, user_id)
);
```

### 4.4 room_directory（房间目录表）

```sql
CREATE TABLE room_directory (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    is_searchable BOOLEAN DEFAULT TRUE,
    app_service_id TEXT,
    canonical_alias TEXT,
    member_count INTEGER DEFAULT 0,
    join_rule TEXT
);
```

### 4.5 room_aliases（房间别名表）

```sql
CREATE TABLE room_aliases (
    room_id TEXT NOT NULL,
    alias TEXT PRIMARY KEY,
    creator TEXT,
    created_ts BIGINT
);
```

### 4.6 room_tags（房间标签表）

```sql
CREATE TABLE room_tags (
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    PRIMARY KEY(room_id, user_id, tag_name)
);
```

---

## 五、API 设计

### 5.1 房间相关 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/_matrix/client/v3/rooms/{room_id}` | 获取房间信息 |
| POST | `/_matrix/client/v3/createRoom` | 创建房间 |
| POST | `/_matrix/client/v3/rooms/{room_id}/join` | 加入房间 |
| POST | `/_matrix/client/v3/rooms/{room_id}/leave` | 离开房间 |
| GET | `/_matrix/client/v3/user/{user_id}/rooms` | 获取用户房间列表 |
| GET | `/_matrix/client/v3/rooms/{room_id}/messages` | 获取房间消息 |

### 5.2 摘要相关 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/_matrix/client/v3/rooms/{room_id}/summary` | 获取房间摘要 |
| PUT | `/_matrix/client/v3/rooms/{room_id}/summary` | 更新房间摘要 |

### 5.3 目录相关 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/_matrix/client/v3/directory/rooms` | 获取公开房间列表 |
| GET | `/_matrix/client/v3/directory/rooms/{room_alias}` | 通过别名查找房间 |
| PUT | `/_matrix/client/v3/directory/rooms/{room_id}/alias` | 设置房间别名 |

---

## 六、数据流向

```
用户操作
    │
    ▼
┌─────────────────┐
│  前端 RoomStore │  ◀── loadRooms() / joinRoom() / leaveRoom()
│  - rooms Map    │
│  - RoomInfo[]  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ MatrixRoomService│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│ matrix-js-sdk   │────▶│ synapse-rust API  │
└─────────────────┘     └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   PostgreSQL     │
                        │ - rooms          │
                        │ - room_summaries │
                        │ - room_memberships│
                        └──────────────────┘
```

---

## 七、优化建议

### 7.1 前端优化

1. **分离展示与详情数据**
   - RoomObject 用于列表展示
   - RoomDetail 按需加载（进入房间时）

2. **添加缓存层**
   - 使用 LRU 缓存 RoomDetail
   - 预加载热门房间详情

3. **增量更新**
   - 使用 Sliding Sync 获取增量更新
   - 避免全量刷新

### 7.2 后端优化

1. **完善 RoomSummaryService**
   - 添加批量获取摘要接口
   - 实现增量更新

2. **添加索引**
   ```sql
   CREATE INDEX idx_room_summaries_name ON room_summaries(name);
   CREATE INDEX idx_room_memberships_user ON room_memberships(user_id);
   CREATE INDEX idx_room_directory_public ON room_directory(is_public);
   ```

3. **缓存层**
   - Redis 缓存热点数据
   - 缓存房间摘要

---

## 八、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-03-25 | 初始版本，结合前后端实际架构 |
| v1.1 | 2026-03-25 | 新增虚拟列表组件 (RoomVirtualList + RoomListItem) |

## 九、组件结构

### 9.1 房间列表组件

```
RoomVirtualList.vue
├── VirtualList (底层虚拟滚动)
│   ├── 滚动事件处理
│   ├── 可见区域计算
│   └── Sliding Sync 集成
└── RoomListItem (房间项)
    ├── 头像 (NAvatar)
    ├── 名称 + 未读徽章
    ├── 最后消息预览
    ├── 时间戳
    └── 高亮指示器
```

### 9.2 核心特性

- **虚拟滚动**: 只渲染可见区域的房间项，性能优化
- **按需加载**: 进入可见区域时自动加载详情
- **预加载优化**: 预加载即将进入可见区域的房间详情
- **Sliding Sync 集成**: 自动更新可见范围，同步未读计数

## 十、性能优化

### 10.1 性能监控

| 工具 | 说明 |
|------|------|
| `RoomPerformance.ts` | 性能监控工具类 |
| FPS 监控 | 滚动帧率追踪 |
| 渲染时间 | 列表/项渲染时间 |
| 内存监控 | JS Heap 使用情况 |

### 10.2 防抖优化

- `debouncedLoadRoomDetails()` - 滚动场景下防抖加载详情
- 延迟 300ms，合并多次请求

---

## 十一、响应式设计（桌面端 + 移动端）

### 11.1 共用组件

所有 Room 列表组件均采用响应式设计，桌面端和移动端共用同一套组件：

| 组件 | 桌面端 | 移动端 |
|------|--------|--------|
| RoomVirtualList | 固定宽度 sidebar | 全屏列表 |
| RoomListItem | 显示更多元信息 | 精简显示 |
| VirtualList | 较大行高 (72px) | 紧凑行高 (56px) |

### 11.2 响应式断点

```typescript
// 响应式断点定义
const breakpoints = {
  mobile: 768,    // 手机
  tablet: 1024,   // 平板
  desktop: 1280  // 桌面
}
```

### 11.3 自适应特性

| 特性 | 实现方式 |
|------|----------|
| 列表宽度 | CSS `width: 100%` / `max-width: 320px` |
| 头像尺寸 | 桌面 48px / 移动端 40px |
| 项间距 | 桌面 12px / 移动端 8px |
| 字体大小 | 桌面 15px / 移动端 14px |
| 显示内容 | 桌面显示完整 / 移动端省略 |

### 11.4 触摸优化

- 移动端支持长按弹出右键菜单
- 滑动快速操作（左滑删除、右滑已读）
- 虚拟列表兼容触摸滚动

### 11.5 数据层统一

桌面端和移动端共用同一个 `useRoomStore`，数据源完全一致：

```typescript
// 统一的数据源
const roomStore = useRoomStore()

// 桌面端和移动端调用相同方法
roomStore.loadRooms()        // 加载房间列表
roomStore.loadRoomDetails()  // 加载详情（防抖）
roomStore.handleIncrementalUpdate() // 增量更新
```

---

## 十二、任务完成状态

### ✅ 已完成任务

| 状态 | 任务 | 说明 |
|------|------|------|
| ✅ | 数据结构分离 | RoomInfo + RoomDetail 分离 |
| ✅ | LRU 缓存 | 50 个房间缓存 |
| ✅ | 按需加载 | loadRoomDetail() |
| ✅ | 批量加载 | loadRoomDetails() + 并发控制 |
| ✅ | 缓存管理 | clear/prune/getCacheStats |
| ✅ | 批量 API | 后端 /summaries/batch |
| ✅ | Sliding Sync | 增量更新支持 |
| ✅ | 虚拟列表 | RoomVirtualList 组件 |
| ✅ | 性能监控 | RoomPerformance 工具 |
| ✅ | 防抖优化 | 300ms 延迟加载 |
| ✅ | 响应式设计 | 桌面端 + 移动端共用 |

### 📋 后续可优化项

| 状态 | 任务 | 优先级 |
|------|------|--------|
| ⏳ | 移动端手势操作 | 中 |
| ⏳ | 离线模式支持 | 中 |
| ⏳ | PWA 离线缓存 | 低 |

---

## 十三、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-03-25 | 初始版本，结合前后端实际架构 |
| v1.1 | 2026-03-25 | 新增虚拟列表组件 (RoomVirtualList + RoomListItem) |
| v1.2 | 2026-03-25 | 新增性能监控、响应式设计、完成状态 |