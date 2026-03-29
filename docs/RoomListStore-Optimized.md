# RoomListStore 优化方案

## 一、当前问题

1. **数据结构混合** - 展示数据和详情数据放在一起
2. **缺乏缓存策略** - 每次都重新获取详情
3. **性能瓶颈** - 加载大量房间时效率低
4. **类型不完整** - 缺少与后端对应的类型定义

## 二、优化方案

### 2.1 分离展示与详情数据

```
RoomInfo (展示用，轻量)
├── roomId
├── name
├── avatarUrl
├── isDirect
├── isEncrypted
├── unreadCount / highlightCount / notificationCount
├── lastMessage
├── lastMessageTime
├── members[] (仅基本信息)
└── detail (可选，按需加载)

RoomDetail (详情，按需加载)
├── roomId
├── topic
├── memberCount / joinedCount
├── ownerId
├── joinRule
├── canonicalAlias
├── createdTs
└── isPublic
```

### 2.2 缓存策略

- **LRU 缓存** - 缓存 RoomDetail，限制最大数量
- **预加载** - 后台预加载即将进入的房间详情
- **懒加载** - 进入房间时才加载详情

### 2.3 批量优化

- **批量获取摘要** - 一次 API 调用获取多个房间摘要
- **增量更新** - 使用 Sliding Sync 增量同步

## 三、API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/_matrix/client/v3/rooms/{room_id}/summary` | 获取房间摘要 |
| POST | `/_matrix/client/v3/rooms/batch_summaries` | 批量获取摘要 |

## 四、实施步骤

1. ✅ 分离 RoomInfo 和 RoomDetail 类型
2. ✅ 添加 loadRoomDetail / loadRoomDetails 方法
3. ✅ 实现 LRU 缓存
4. ✅ MatrixRoomService 添加摘要方法
5. ✅ 后端批量获取 API (/_synapse/room_summary/v1/summaries/batch)
6. ✅ Sliding Sync 增量更新
7. ✅ 虚拟列表组件 (RoomVirtualList.vue + RoomListItem.vue)

## 五、组件结构

### 5.1 虚拟列表组件

```
RoomVirtualList.vue
├── VirtualList (底层虚拟滚动)
│   ├── 滚动事件处理
│   └── 可见区域计算
└── RoomListItem (房间项)
    ├── 头像
    ├── 名称 + 未读数
    ├── 最后消息预览
    └── 时间 + 标签
```

### 5.2 核心特性

- **虚拟滚动**: 只渲染可见区域的房间项
- **按需加载**: 进入可见区域时加载详情
- **预加载优化**: 预加载即将进入可见区域的房间详情
- **Sliding Sync 集成**: 自动更新可见范围

## 六、API 总结

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/_matrix/client/v3/sync` | Sliding Sync 主接口 |
| POST | `/_synapse/room_summary/v1/summaries/batch` | 批量获取摘要 |
| POST | `/_synapse/sliding_sync/v1/notifications` | 批量获取未读计数 |