# HuLa 跨端同步问题排查与优化方案（基于代码深度分析）

## 一、后端 (synapse-rust) 能力分析

### 已实现的能力
- `SyncService.sync()` 支持全量/增量同步（`full_state` 参数）
- `SyncToken` 设计合理，支持流式增量：`s{stream_id}_{to_device}_{device_list}`
- 房间未读计数正确返回：`unread_notifications.highlight_count` 和 `notification_count`
- 增量同步支持长轮询（`wait_for_incremental_update`，最多等待 timeout 毫秒）
- 事件拉取限制为 50 条/批次（`limit = 50`）
- 支持按房间过滤同步（`room_sync`）

### 注意事项
- 移动端网络切换时，后端不会主动推送，依赖客户端重新发起 sync
- 大房间首次全量同步时，state 事件可能较多，需要客户端分页处理

## 二、SDK (matrix-js-sdk) 能力分析

### 已实现的能力
- `SyncApi` 完整实现 Matrix C-S 同步协议
- `SlidingSync` 实现 MSC3886，支持列表、过滤、增量更新
- `SlidingSyncSdk` 提供 Sliding Sync 高级 API
- 支持 `cryptoCallbacks` 用于端到端加密同步
- 支持 `pendingEventOrdering` 控制事件顺序

### 移动端优化点（SDK 已支持但 hula 未使用）
- `pollTimeout` 可调整长轮询超时（移动端应缩短）
- `initialSyncLimit` 可控制首次同步房间数
- `IndexedDBStore` 支持持久化存储（移动端未启用）

## 三、前端 hula 核心问题（基于代码排查）

### 问题1：SyncService 实现过于简单，未处理增量同步细节

**代码位置**：`hula/src/services/matrix/MatrixSyncService.ts:69-93`

```typescript
async startSync(options?: SyncOptions): Promise<void> {
  // 只是简单调用 client.sync()
  await extendedClient.sync?.((options as Record<string, unknown>) || {})
}
```

**问题**：
- 没有保存 `next_batch` token，无法恢复同步位置
- 没有处理 `full_state` 参数，首次全量同步可能不完整
- 没有处理 `timeout` 参数，移动端长轮询超时设置不合理
- 没有错误重试机制，网络波动后同步中断

**影响**：
- 应用重启后需要重新全量同步（浪费流量和电量）
- 网络切换后同步中断无法自动恢复

### 问题2：未读计数仅基于本地计算，未使用后端返回值

**代码位置**：`hula/src/services/matrix/MatrixSyncService.ts:178-204`

```typescript
getUnreadNotificationCount(): number {
  let total = 0
  const rooms = this.getJoinedRooms()
  for (const room of rooms) {
    const extendedRoom = room as unknown as ExtendedRoomForSync
    const unread = extendedRoom.getUnreadNotificationCount?.()
    total += unread?.highlight || 0
  }
  return total
}
```

**问题**：
- 遍历所有房间计算，性能差（O(n) 复杂度）
- 未使用后端返回的 `notification_count` 字段（已在 sync 响应中提供）
- 移动端每次打开会话列表都会触发全量计算

**后端支持**：`synapse-rust/src/services/sync_service.rs:542-544` 已返回：
```rust
let (highlight_count, notification_count) = self.get_unread_counts(room_id, user_id).await?;
```

### 问题3：移动端未启用 Sliding Sync 优化

**代码位置**：`hula/src/services/matrix/MatrixClientService.ts:242-275`

```typescript
// 固定 timeline_limit: 20
const slidingSync = new SlidingSyncCtor(
  config.homeserverUrl,
  lists,
  { timeline_limit: 20, ... },  // 桌面端和移动端相同
  tempClient,
  2000
)
```

**问题**：
- 移动端未根据平台调整 `timeline_limit`（应为 10 或更少）
- 移动端未设置 `required_state` 最小化（只拉取必要字段）
- `MatrixSlidingSyncService` 只在桌面端初始化，移动端完全未使用

**影响**：
- 移动端仍使用传统 `/sync` 轮询，耗电高、流量大
- 弱网环境下同步慢

### 问题4：Token 刷新机制不完整

**代码位置**：`hula/src/services/matrix/MatrixClientService.ts:317-319`

```typescript
// 登录时启动了刷新
if (loginResponse.refresh_token && loginResponse.expires_in) {
  this.startTokenRefresh(loginResponse.expires_in, loginResponse.refresh_token)
}
```

**问题**：
- `startTokenRefresh` 只在登录时调用，应用从后台恢复时不会重新启动
- 移动端应用进入后台后，定时器可能被系统挂起，恢复后未重新调度
- 刷新失败时没有降级策略（如提示用户重新登录）

### 问题5：缺少网络状态感知

**代码位置**：`hula/src/services/matrix/MatrixSyncService.ts` 和 `MatrixClientService.ts`

**问题**：
- `startSync` 不检查网络状态，离线时也会发起请求
- 没有监听 `online`/`offline` 事件，网络恢复后不会自动重连
- 没有处理网络类型切换（WiFi ↔ 蜂窝），无法动态调整同步频率

### 问题6：移动端同步页面无实际功能

**代码位置**：`hula/src/mobile/views/SyncData.vue`

**问题**：
- 页面存在但只有空白 UI，无实际同步逻辑
- 没有显示当前同步状态（SYNCING/ERROR/CATCHUP）
- 没有同步进度（已同步房间数/总房间数）
- 没有手动触发同步的按钮

### 问题7：消息缓存策略不足

**代码位置**：`hula/src/stores/room.ts:166-191`

```typescript
function _pruneMessagesCache(): void {
  // 仅按 LRU 保留 20 个房间
  if (roomIds.length <= MAX_MESSAGE_CACHE_ROOMS) return
  // 删除不在保留列表中的房间消息
}
```

**问题**：
- 缓存仅保存在内存中，应用重启后丢失
- 移动端内存限制更严，20 个房间可能过大
- 没有使用 IndexedDB 持久化消息
- 切换设备后历史消息无法恢复

### 问题8：加密密钥未跨设备同步

**代码位置**：`hula/src/services/matrix/MatrixKeyBackupService.ts` 和 `MatrixSecureBackupService.ts`

**问题**：
- `MatrixKeyBackupService` 已实现但未在移动端初始化
- 新设备登录后没有自动恢复密钥的流程
- 用户手动恢复密钥的 UI 入口不明确

### 问题9：事件监听器内存泄漏

**代码位置**：`hula/src/services/matrix/MatrixClientService.ts:479-499`

```typescript
async stopClient(): Promise<void> {
  if (this.client) {
    this.cleanupEventListeners()  // 清理了部分监听器
    this.client.stopClient()
  }
}
```

**问题**：
- `setupEventListeners` 中添加的监听器没有完全清理
- `MatrixSlidingSyncService` 的事件处理器在销毁时清理，但移动端从未初始化
- 多次登录登出可能导致监听器累积

### 问题10：缺少离线消息队列

**代码位置**：整个 `hula/src/services/matrix/` 目录

**问题**：
- 离线时发送的消息直接失败，没有队列缓存
- 网络恢复后不会自动重发
- 没有消息发送状态管理（发送中/成功/失败）

## 四、优化方案

### 4.1 完善 SyncService（P0）

**目标**：支持 token 持久化、增量同步、错误重试

**实施**：
```typescript
// src/services/matrix/MatrixSyncService.ts
class SyncService {
  private syncToken: string | null = null
  private retryCount = 0
  private maxRetries = 3

  async startSync(options?: SyncOptions): Promise<void> {
    if (!this.client) throw new Error('Client 未初始化')
    
    // 从存储加载上次的 sync token
    if (!this.syncToken) {
      this.syncToken = await this.loadSyncToken()
    }

    const syncParams = {
      since: this.syncToken,
      timeout: this.getSyncTimeout(),  // 移动端 30s，桌面端 60s
      full_state: !this.syncToken,      // 无 token 时全量同步
      set_presence: 'online'
    }

    try {
      const response = await this.client.sync(syncParams)
      this.syncToken = response.next_batch
      await this.saveSyncToken(this.syncToken)
      this.retryCount = 0
      this.processSyncResponse(response)
    } catch (err) {
      await this.handleSyncError(err)
    }
  }

  private async handleSyncError(err: Error): Promise<void> {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      const delay = Math.pow(2, this.retryCount) * 1000
      await sleep(delay)
      return this.startSync()
    }
    // 达到最大重试次数，通知用户
    this.emit('sync_error', err)
  }
}
```

### 4.2 优化未读计数（P0）

**目标**：使用后端返回值，避免遍历

**实施**：
```typescript
// src/stores/room.ts
function updateUnreadCountsFromSync(syncResponse: ISyncResponse) {
  for (const [roomId, roomData] of Object.entries(syncResponse.rooms?.join || {})) {
    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      // 直接使用后端返回的未读数
      roomInfo.notificationCount = roomData.unread_notifications?.notification_count || 0
      roomInfo.highlightCount = roomData.unread_notifications?.highlight_count || 0
      rooms.value.set(roomId, roomInfo)
    }
  }
}
```

### 4.3 移动端 Sliding Sync 适配（P0）

**目标**：移动端使用 Sliding Sync 减少流量和电量消耗

**实施**：
```typescript
// src/services/matrix/MatrixClientService.ts
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
const timelineLimit = isMobile ? 10 : 20
const requiredState = isMobile 
  ? [['m.room.name', ''], ['m.room.avatar', '']]  // 移动端只拉必要字段
  : [['m.room.name', ''], ['m.room.avatar', ''], ['m.room.encryption', '']]

// 移动端启用 Sliding Sync
if (isMobile) {
  await matrixSlidingSyncService.initialize()
  matrixSlidingSyncService.setListFilters('default', {
    timeline_limit: timelineLimit,
    required_state: requiredState
  })
}
```

### 4.4 Token 刷新增强（P1）

**目标**：应用恢复后重新调度刷新定时器

**实施**：
```typescript
// src/services/matrix/MatrixClientService.ts
// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && this.refreshToken) {
    // 应用恢复，重新计算剩余时间
    const remaining = this._tokenExpiresIn - (Date.now() - this._tokenStartTime)
    if (remaining < 5 * 60 * 1000) {  // 少于5分钟立即刷新
      this.refreshAccessToken()
    } else {
      this.startTokenRefresh(remaining, this.refreshToken)
    }
  }
})
```

### 4.5 网络状态感知（P1）

**目标**：网络恢复后自动重连并同步

**实施**：
```typescript
// src/composables/useNetworkAwareSync.ts
import { useOnline } from '@vueuse/core'

export function useNetworkAwareSync() {
  const isOnline = useOnline()
  
  watch(isOnline, async (online) => {
    if (online && matrixClientService.getClient()) {
      // 网络恢复，立即触发增量同步
      await matrixSyncService.startSync({ full_state: false })
      // 重试离线队列中的消息
      await offlineMessageQueue.retryPending()
    }
  })

  // 监听网络类型切换（移动端）
  const connection = (navigator as any).connection
  connection?.addEventListener('change', () => {
    const isSlow = connection.effectiveType === '2g' || connection.effectiveType === '3g'
    if (isSlow) {
      matrixSyncService.setSyncInterval(60000)  // 慢速网络降低同步频率
    } else {
      matrixSyncService.setSyncInterval(30000)
    }
  })
}
```

### 4.6 完善移动端同步页面（P2）

**目标**：提供同步状态可视化和手动控制

**实施**：
```vue
<!-- src/mobile/views/SyncData.vue -->
<template>
  <div class="sync-data-page">
    <div class="sync-status">
      <van-icon :name="statusIcon" />
      <span>{{ statusText }}</span>
    </div>
    <div class="sync-progress" v-if="isSyncing">
      <van-progress :percentage="progress" />
      <span>{{ syncedRooms }}/{{ totalRooms }} 房间</span>
    </div>
    <van-cell-group>
      <van-cell title="上次同步时间" :value="lastSyncTime | formatDate" />
      <van-cell title="同步 Token" :value="syncToken | truncate" />
    </van-cell-group>
    <van-button @click="manualSync" :loading="isSyncing" block>
      手动同步
    </van-button>
    <van-button @click="clearCache" plain block>
      清理缓存
    </van-button>
  </div>
</template>

<script setup>
import { useSyncMonitor } from '@/composables/useSyncMonitor'

const { status, progress, syncedRooms, totalRooms, lastSyncTime, syncToken } = useSyncMonitor()

const manualSync = async () => {
  await matrixSyncService.startSync({ full_state: false })
  showToast('同步完成')
}

const clearCache = async () => {
  await messageCacheDB.clear()
  showToast('缓存已清理')
}
</script>
```

### 4.7 消息持久化缓存（P1）

**目标**：使用 IndexedDB 持久化消息，支持离线阅读

**实施**：
```typescript
// src/utils/storage/messageCache.ts
import { openDB, IDBPDatabase } from 'idb'

class MessageCacheDB {
  private db: IDBPDatabase | null = null

  async init() {
    this.db = await openDB('hula-messages', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('messages', { keyPath: 'eventId' })
          db.createObjectStore('rooms', { keyPath: 'roomId' })
        }
        if (oldVersion < 2) {
          const msgStore = db.transaction('messages', 'readwrite').objectStore('messages')
          msgStore.createIndex('roomId', 'roomId')
          msgStore.createIndex('timestamp', 'originServerTs')
        }
      }
    })
  }

  async saveMessages(roomId: string, messages: MessageType[]) {
    const tx = this.db!.transaction('messages', 'readwrite')
    for (const msg of messages) {
      await tx.store.put({ ...msg, roomId })
    }
    await tx.done

    // 更新房间最后消息时间
    await this.db!.put('rooms', {
      roomId,
      lastMessageTime: messages[messages.length - 1]?.originServerTs,
      updatedAt: Date.now()
    })
  }

  async loadRoomMessages(roomId: string, limit = 50): Promise<MessageType[]> {
    const index = this.db!.transaction('messages').store.index('roomId')
    const messages = await index.getAll(roomId)
    return messages.sort((a, b) => b.originServerTs - a.originServerTs).slice(0, limit)
  }

  // 移动端自动清理超过7天的消息
  async cleanOldMessages(days = 7) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const tx = this.db!.transaction('messages', 'readwrite')
    let cursor = await tx.store.openCursor()
    while (cursor) {
      if (cursor.value.originServerTs < cutoff) {
        await cursor.delete()
      }
      cursor = await cursor.continue()
    }
    await tx.done
  }
}
```

### 4.8 跨设备密钥同步（P1）

**目标**：新设备登录后自动恢复密钥

**实施**：
```typescript
// src/services/matrix/MatrixKeyBackupService.ts
async autoRestoreKeysOnNewDevice(): Promise<boolean> {
  const client = matrixClientService.getClient()
  const crypto = client?.getCrypto()
  if (!crypto) return false

  // 检查是否有云端备份
  const backupInfo = await crypto.getKeyBackupInfo()
  if (!backupInfo) {
    console.warn('No key backup found')
    return false
  }

  // 恢复密钥
  try {
    await crypto.restoreKeyBackup(backupInfo)
    await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false })
    console.info('Keys restored successfully')
    return true
  } catch (err) {
    console.error('Key restore failed:', err)
    return false
  }
}

// 在 MatrixClientService.startClient() 后调用
async startClient(): Promise<void> {
  await this.client!.startClient(...)
  // 新设备自动恢复密钥
  if (!this.hasRestoredKeys) {
    await matrixKeyBackupService.autoRestoreKeysOnNewDevice()
    this.hasRestoredKeys = true
  }
}
```

### 4.9 离线消息队列（P2）

**目标**：离线时缓存消息，网络恢复后自动重发

**实施**：
```typescript
// src/services/offline/OfflineMessageQueue.ts
class OfflineMessageQueue {
  private queue: PendingMessage[] = []
  private isProcessing = false

  async add(roomId: string, content: IMessageContent): Promise<string> {
    const pendingId = uuid()
    this.queue.push({
      id: pendingId,
      roomId,
      content,
      status: 'pending',
      createdAt: Date.now()
    })
    await this.persistQueue()
    this.process()
    return pendingId
  }

  async process(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      const msg = this.queue[0]
      try {
        const eventId = await matrixEventService.sendMessage(msg.roomId, msg.content)
        msg.status = 'sent'
        msg.eventId = eventId
        this.queue.shift()
        await this.persistQueue()
      } catch (err) {
        if (!navigator.onLine) break  // 离线则暂停
        msg.retryCount = (msg.retryCount || 0) + 1
        if (msg.retryCount >= 3) {
          msg.status = 'failed'
          this.queue.shift()
          this.emit('send_failed', msg)
        }
        await sleep(2000)
      }
    }
    this.isProcessing = false
  }
}
```

### 4.10 事件监听器清理完善（P2）

**目标**：防止内存泄漏

**实施**：
```typescript
// src/services/matrix/MatrixClientService.ts
private cleanupEventListeners(): void {
  // 清理所有 SDK 事件监听器
  this.sdkEventHandlers.forEach((handler, event) => {
    this.client?.off(event, handler)
  })
  this.sdkEventHandlers.clear()

  // 清理 Sliding Sync 监听器
  if (this.slidingSyncInstance) {
    matrixSlidingSyncService.destroy()
  }

  // 清理网络监听器
  window.removeEventListener('online', this.onOnlineHandler)
  window.removeEventListener('offline', this.onOfflineHandler)
}
```

## 五、实施优先级

| 优先级 | 任务 | 文件 | 预估工时 |
|--------|------|------|----------|
| P0 | 完善 SyncService（token持久化、重试） | `MatrixSyncService.ts` | 2天 |
| P0 | 优化未读计数 | `room.ts`, `MatrixSyncService.ts` | 0.5天 |
| P0 | 移动端 Sliding Sync 适配 | `MatrixClientService.ts`, `MatrixSlidingSyncService.ts` | 2天 |
| P1 | Token 刷新增强 | `MatrixClientService.ts` | 1天 |
| P1 | 网络状态感知 | `useNetworkAwareSync.ts` | 1天 |
| P1 | 消息持久化缓存 | `messageCache.ts`, `room.ts` | 2天 |
| P1 | 跨设备密钥同步 | `MatrixKeyBackupService.ts` | 1.5天 |
| P2 | 完善移动端同步页面 | `SyncData.vue`, `useSyncMonitor.ts` | 1天 |
| P2 | 离线消息队列 | `OfflineMessageQueue.ts` | 1.5天 |
| P2 | 事件监听器清理 | `MatrixClientService.ts` | 0.5天 |

**总计**：约 13 人日

## 六、验收标准

1. **增量同步正确**：重启应用后使用 token 恢复，不再全量同步
2. **未读计数准确**：桌面端和移动端未读数一致，误差为 0
3. **移动端 Sliding Sync**：流量消耗降低 50% 以上
4. **网络恢复自动同步**：断网 5 分钟后重连，10 秒内完成增量同步
5. **消息持久化**：应用重启后最近 50 条消息可见
6. **密钥跨设备恢复**：新设备登录后能解密历史消息（需用户确认）
7. **离线消息重发**：离线发送的消息在网络恢复后 30 秒内发出
8. **无内存泄漏**：多次登录登出后，内存占用稳定

## 七、相关文件清单

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `src/services/matrix/MatrixSyncService.ts` | 重构 | token持久化、重试、增量同步 |
| `src/services/matrix/MatrixClientService.ts` | 修改 | 移动端Sliding Sync、Token刷新增强 |
| `src/services/matrix/MatrixSlidingSyncService.ts` | 修改 | 移动端参数适配 |
| `src/stores/room.ts` | 修改 | 使用后端未读数 |
| `src/composables/useNetworkAwareSync.ts` | 新增 | 网络状态监听 |
| `src/composables/useSyncMonitor.ts` | 新增 | 同步状态监控 |
| `src/utils/storage/messageCache.ts` | 新增 | IndexedDB消息缓存 |
| `src/services/offline/OfflineMessageQueue.ts` | 新增 | 离线消息队列 |
| `src/services/matrix/MatrixKeyBackupService.ts` | 修改 | 自动密钥恢复 |
| `src/mobile/views/SyncData.vue` | 重写 | 同步状态页面 |

## 八、测试建议

### 功能测试
1. 应用重启后同步位置恢复正确
2. 断网重连后自动同步
3. 移动端 WiFi ↔ 5G 切换时同步不中断
4. 多设备同时在线消息实时同步
5. 离线发送消息，网络恢复后自动发出

### 性能测试
1. 首次全量同步耗时 < 30 秒（100 个房间）
2. 增量同步耗时 < 3 秒
3. 移动端内存占用 < 150MB
4. 移动端后台同步耗电 < 5%/小时

### 兼容性测试
- iOS Safari 15+
- Android Chrome 100+
- 微信内置浏览器
- 弱网环境（3G，限速 100KB/s）
