# HuLa 项目改造规范：集成 Matrix 协议

## 一、项目概述

### 1.1 项目目标

将 HuLa 项目从自定义 WebSocket 通信改造为基于 Matrix 协议的跨平台即时通讯应用，实现与 element-web 后端的完全兼容。

### 1.2 改造范围

- 删除冗余的自定义通信模块
- 集成 matrix-js-sdk
- 重构状态管理以适配 Matrix 数据模型
- 保留跨平台能力和现有 UI 风格

### 1.3 技术约束

- 保持 Vue 3 + TypeScript + Vite + Tauri 技术栈
- 保持 Naive UI + Vant UI 组件库
- 保持 Pinia 状态管理
- 保持 UnoCSS 样式方案

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    HuLa Frontend (Vue 3)                │
├─────────────────────────────────────────────────────────┤
│  UI Layer (Naive UI + Vant)                             │
│  ├── Views (页面组件)                                    │
│  ├── Components (通用组件)                               │
│  └── Layout (布局组件)                                   │
├─────────────────────────────────────────────────────────┤
│  State Layer (Pinia)                                    │
│  ├── MatrixStore (Matrix 客户端管理)                     │
│  ├── RoomStore (房间/会话管理)                           │
│  ├── UserStore (用户管理)                                │
│  └── SettingsStore (设置管理)                            │
├─────────────────────────────────────────────────────────┤
│  Service Layer                                          │
│  ├── MatrixClientService (Matrix 客户端封装)             │
│  ├── MatrixEventService (事件处理)                       │
│  ├── MatrixRoomService (房间操作)                        │
│  └── MatrixCryptoService (加密管理)                      │
├─────────────────────────────────────────────────────────┤
│  SDK Layer                                             │
│  ├── matrix-js-sdk (Matrix 协议实现)                     │
│  └── @matrix-org/olm (端到端加密)                        │
├─────────────────────────────────────────────────────────┤
│  Platform Layer (Tauri)                                │
│  ├── Native APIs (文件系统、通知等)                       │
│  └── Cross-platform Support                            │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流设计

```
用户操作 → Vue组件 → Pinia Store → Matrix Service → matrix-js-sdk → Matrix Server
                ↓
         UI 响应式更新 ← 状态变更 ← 事件监听 ← Matrix Event
```

### 2.3 模块依赖关系

```
stores/
├── matrix.ts (核心客户端状态)
├── room.ts (依赖 matrix.ts)
├── user.ts (依赖 matrix.ts)
└── settings.ts (独立)

services/matrix/
├── MatrixClientService.ts (核心，被所有服务依赖)
├── MatrixRoomService.ts (依赖 MatrixClientService)
├── MatrixEventService.ts (依赖 MatrixClientService)
└── MatrixCryptoService.ts (依赖 MatrixClientService)
```

## 三、冗余代码删除规范

### 3.1 必须删除的文件和目录

#### 3.1.1 WebSocket 相关文件

| 文件路径 | 删除原因 | 替代方案 |
|---------|---------|---------|
| `src/services/webSocketRust.ts` | 自定义 WebSocket 实现 | matrix-js-sdk 内置通信 |
| `src/services/webSocketAdapter.ts` | WebSocket 适配器 | 不再需要 |
| `src/services/wsType.ts` | WebSocket 类型定义 | 使用 matrix-js-sdk 类型 |

#### 3.1.2 朋友圈相关文件

| 文件路径 | 删除原因 | 说明 |
|---------|---------|------|
| `src/stores/feed.ts` | 朋友圈功能 | Matrix 协议暂不支持 |
| `src/stores/feedNotification.ts` | 朋友圈通知 | Matrix 协议暂不支持 |
| `src/mobile/views/community/` | 社区功能目录 | Matrix 协议暂不支持 |
| `src/plugins/dynamic/` | 动态插件 | Matrix 协议暂不支持 |

#### 3.1.3 Rust WebSocket 模块

| 目录路径 | 删除原因 | 替代方案 |
|---------|---------|---------|
| `src-tauri/src/websocket/` | Rust WebSocket 实现 | matrix-js-sdk 替代 |

#### 3.1.4 相关类型和枚举

需要从以下文件中移除相关类型定义：
- `src/services/types.ts` - 移除朋友圈相关类型
- `src/enums/index.ts` - 移除 WebSocket 相关枚举

### 3.2 需要保留但重构的模块

| 模块路径 | 重构内容 |
|---------|---------|
| `src/stores/chat.ts` | 重命名为 `room.ts`，适配 Matrix Room 模型 |
| `src/stores/user.ts` | 适配 Matrix User 模型 |
| `src/stores/contacts.ts` | 适配 Matrix 联系人 API |
| `src/stores/group.ts` | 适配 Matrix Room Member API |
| `src/stores/global.ts` | 重构会话管理逻辑 |

### 3.3 可选保留模块

| 模块路径 | 保留原因 |
|---------|---------|
| `src/plugins/robot/` | AI 助手功能，作为独立模块保留 |
| `src-tauri/` (除 websocket 外) | Tauri 跨平台支持 |

## 四、新增模块规范

### 4.1 Matrix 服务层

#### 4.1.1 MatrixClientService

```typescript
// src/services/matrix/MatrixClientService.ts
export class MatrixClientService {
  private client: MatrixClient | null = null;
  
  // 核心方法
  async initialize(homeserverUrl: string): Promise<void>;
  async login(username: string, password: string): Promise<void>;
  async logout(): Promise<void>;
  async startClient(): Promise<void>;
  async stopClient(): Promise<void>;
  
  // 状态获取
  getClient(): MatrixClient | null;
  getConnectionState(): ConnectionState;
  getUserId(): string | null;
  
  // 事件监听
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}
```

#### 4.1.2 MatrixRoomService

```typescript
// src/services/matrix/MatrixRoomService.ts
export class MatrixRoomService {
  // 房间操作
  async getRooms(): Promise<Room[]>;
  async getRoom(roomId: string): Promise<Room | null>;
  async createRoom(options: ICreateRoomOpts): Promise<Room>;
  async joinRoom(roomId: string): Promise<Room>;
  async leaveRoom(roomId: string): Promise<void>;
  
  // 成员管理
  async getMembers(roomId: string): Promise<RoomMember[]>;
  async inviteUser(roomId: string, userId: string): Promise<void>;
  async kickUser(roomId: string, userId: string): Promise<void>;
  
  // 房间设置
  async setRoomName(roomId: string, name: string): Promise<void>;
  async setRoomTopic(roomId: string, topic: string): Promise<void>;
}
```

#### 4.1.3 MatrixEventService

```typescript
// src/services/matrix/MatrixEventService.ts
export class MatrixEventService {
  // 消息发送
  async sendTextMessage(roomId: string, text: string): Promise<string>;
  async sendImageMessage(roomId: string, file: File): Promise<string>;
  async sendFileMessage(roomId: string, file: File): Promise<string>;
  async sendVideoMessage(roomId: string, file: File): Promise<string>;
  async sendAudioMessage(roomId: string, file: File): Promise<string>;
  
  // 消息操作
  async redactEvent(roomId: string, eventId: string): Promise<void>;
  async sendMessageReceipt(roomId: string, eventId: string, type: ReceiptType): Promise<void>;
  
  // 消息获取
  async getEventTimeline(roomId: string, eventId: string): Promise<EventTimeline>;
  async getRoomTimeline(roomId: string, limit?: number): Promise<MatrixEvent[]>;
  async paginateTimeline(timeline: EventTimeline, direction: Direction, limit: number): Promise<MatrixEvent[]>;
}
```

#### 4.1.4 MatrixCryptoService

```typescript
// src/services/matrix/MatrixCryptoService.ts
export class MatrixCryptoService {
  // 加密初始化
  async initializeCrypto(): Promise<void>;
  
  // 设备验证
  async verifyDevice(userId: string, deviceId: string): Promise<void>;
  async unverifyDevice(userId: string, deviceId: string): Promise<void>;
  async getDeviceVerificationStatus(userId: string, deviceId: string): Promise<VerificationStatus>;
  
  // 密钥管理
  async backupKeys(): Promise<void>;
  async restoreKeys(backupKey: string): Promise<void>;
  async exportKeys(passphrase: string): Promise<string>;
  async importKeys(data: string, passphrase: string): Promise<void>;
}
```

### 4.2 Pinia Store 规范

#### 4.2.1 MatrixStore

```typescript
// src/stores/matrix.ts
export const useMatrixStore = defineStore('matrix', () => {
  // 状态
  const client = ref<MatrixClient | null>(null);
  const connectionState = ref<ConnectionState>('DISCONNECTED');
  const userId = ref<string | null>(null);
  const deviceId = ref<string | null>(null);
  const isLoggedIn = computed(() => !!client.value && !!userId.value);
  
  // 方法
  async function initialize(homeserverUrl: string): Promise<void>;
  async function login(username: string, password: string): Promise<void>;
  async function loginWithToken(token: string): Promise<void>;
  async function logout(): Promise<void>;
  
  return {
    client,
    connectionState,
    userId,
    deviceId,
    isLoggedIn,
    initialize,
    login,
    loginWithToken,
    logout,
  };
});
```

#### 4.2.2 RoomStore

```typescript
// src/stores/room.ts
export const useRoomStore = defineStore('room', () => {
  // 状态
  const rooms = ref<Map<string, Room>>(new Map());
  const roomList = computed(() => Array.from(rooms.values()));
  const currentRoomId = ref<string | null>(null);
  const currentRoom = computed(() => currentRoomId.value ? rooms.get(currentRoomId.value) : null);
  
  // 方法
  async function loadRooms(): Promise<void>;
  async function createRoom(options: ICreateRoomOpts): Promise<Room>;
  async function joinRoom(roomId: string): Promise<Room>;
  async function leaveRoom(roomId: string): Promise<void>;
  function setCurrentRoom(roomId: string | null): void;
  
  return {
    rooms,
    roomList,
    currentRoomId,
    currentRoom,
    loadRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
  };
});
```

## 五、数据模型映射

### 5.1 用户模型映射

| HuLa 原模型 | Matrix 模型 | 映射说明 |
|------------|------------|---------|
| `uid` | `userId` | Matrix 用户 ID 格式为 `@user:server` |
| `name` | `displayName` | 显示名称 |
| `avatar` | `avatarUrl` | 头像 URL (mxc:// 格式) |
| `account` | `localpart` | 用户本地部分 |
| `activeStatus` | `presence` | 在线状态 |

### 5.2 房间模型映射

| HuLa 原模型 | Matrix 模型 | 映射说明 |
|------------|------------|---------|
| `roomId` | `roomId` | Matrix 房间 ID 格式为 `!id:server` |
| `name` | `name` | 房间名称 |
| `avatar` | `avatarUrl` | 房间头像 |
| `type` | `isDirect` | 单聊/群聊区分 |
| `unreadCount` | `getUnreadNotificationCount()` | 未读数 |
| `text` | `timeline[timeline.length-1]` | 最新消息 |

### 5.3 消息模型映射

| HuLa 原模型 | Matrix 模型 | 映射说明 |
|------------|------------|---------|
| `message.id` | `event.getId()` | 事件 ID |
| `message.roomId` | `event.getRoomId()` | 房间 ID |
| `message.type` | `event.getType()` | 事件类型 |
| `message.body` | `event.getContent().body` | 消息内容 |
| `message.sendTime` | `event.getTs()` | 发送时间戳 |
| `fromUser.uid` | `event.getSender()` | 发送者 ID |

## 六、UI 组件适配规范

### 6.1 消息渲染组件

需要适配以下 Matrix 事件类型：

| 事件类型 | 渲染方式 |
|---------|---------|
| `m.room.message` (m.text) | 文本消息组件 |
| `m.room.message` (m.emote) | 表情消息组件 |
| `m.room.message` (m.notice) | 通知消息组件 |
| `m.room.message` (m.image) | 图片消息组件 |
| `m.room.message` (m.video) | 视频消息组件 |
| `m.room.message` (m.audio) | 音频消息组件 |
| `m.room.message` (m.file) | 文件消息组件 |
| `m.room.message` (m.location) | 位置消息组件 |
| `m.room.encrypted` | 加密消息占位 |
| `m.room.redaction` | 撤回消息提示 |
| `m.room.member` | 成员变更通知 |

### 6.2 房间列表组件

需要适配以下功能：

- 房间排序（按时间/按名称）
- 未读数显示
- 置顶房间
- 房间分类（直接消息/群组）

### 6.3 登录组件

需要支持以下登录方式：

- 用户名密码登录
- SSO 登录
- OIDC 登录
- Token 登录

## 七、安全规范

### 7.1 凭证存储

- Access Token 必须加密存储
- 使用 Tauri 安全存储 API
- 支持生物识别解锁

### 7.2 端到端加密

- 默认启用端到端加密
- 实现设备验证流程
- 支持密钥备份和恢复

### 7.3 网络安全

- 强制使用 HTTPS/WSS
- 证书固定（可选）
- 代理支持

## 八、性能规范

### 8.1 内存管理

- 实现消息虚拟滚动
- 限制内存中的消息数量
- 及时清理不活跃房间的缓存

### 8.2 启动优化

- 延迟加载非核心模块
- 实现骨架屏
- 优化首屏渲染时间

### 8.3 网络优化

- 实现消息分页加载
- 支持离线消息同步
- 实现网络状态监听

## 九、测试规范

### 9.1 单元测试

- 所有服务层方法必须有单元测试
- 测试覆盖率 ≥ 80%
- 使用 Vitest 测试框架

### 9.2 集成测试

- 测试 Matrix SDK 集成
- 测试状态管理流程
- 测试 UI 组件交互

### 9.3 端到端测试

- 测试完整登录流程
- 测试消息收发流程
- 测试房间管理流程

## 十、发布规范

### 10.1 版本号规则

- 主版本号：重大架构变更
- 次版本号：功能新增
- 修订号：Bug 修复

### 10.2 发布检查清单

- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 文档更新完成
- [ ] 性能指标达标
- [ ] 安全审计通过

### 10.3 回滚策略

- 保留上一个稳定版本的发布包
- 实现配置文件版本兼容
- 支持数据迁移回滚
