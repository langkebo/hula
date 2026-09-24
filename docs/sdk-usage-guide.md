# Matrix SDK 前端使用指南

> **版本**：40.2.0-langkebo.5  
> **创建日期**：2026-09-24  
> **适用范围**：Tjg 前端（HuLa）+ matrix-js-sdk fork

---

## 一、快速入门

### 1.1 SDK 服务获取方式

Tjg 前端将 Matrix.js-SDK 的功能封装为 **Service 单例**，通过统一入口 `@/services/matrix` 访问：

```typescript
import {
  matrixSpaceService,      // Space 空间管理
  matrixVoiceService,      // 语音消息管理
  matrixEventReportService,// 事件举报管理
  matrixRoomSummaryService,// 房间统计管理
  matrixOidcService        // OIDC 认证管理
} from '@/services/matrix'

// 可直接使用服务单例
const spaceInfo = await matrixSpaceService.createSpace({ name: '测试空间' })
```

所有服务均为单例实例，无需手动 `new`。

### 1.2 获取底层 MatrixClient（如需直接使用 SDK）

若需调用 SDK 原始方法，可通过 `matrixClientService` 获取客户端实例：

```typescript
import { matrixClientService } from '@/services/matrix'

const client = matrixClientService.getClient()
if (client) {
  // 例如：获取已加入房间列表
  const rooms = client.getJoinedRooms()
}
```

> **注意**：除特殊场景外，优先使用已封装的 Service 方法。

---

## 二、Space 空间管理

Space 服务通过 `matrixSpaceService` 访问，核心能力被划分为以下子模块（对应内部实现）：

### 2.1 子模块划分

| 子模块 | 功能范围 | 主要方法 |
|--------|----------|----------|
| **SpaceLifecycleService** | 空间 CRUD（创建、读取、更新、删除） | `createSpace`, `getSpace`, `updateSpace`, `deleteSpace` |
| **SpaceQueryService**     | 查询（公共空间、搜索、用户空间、空间统计） | `getPublicSpaces`, `searchSpaces`, `getUserSpaces`, `getSpaceStatistics` |
| **SpaceChildService**     | 子房间管理 | `getSpaceChildren`, `addChild`, `removeChild`, `getSpaceRooms` |
| **SpaceMemberService**    | 成员管理 | `getSpaceMembers`, `inviteToSpace`, `joinSpace`, `leaveSpace` |
| **SpaceHierarchyService** | 层级管理 | `getSpaceHierarchy`, `getSpaceHierarchyPage`, `getSpaceTreePath` |

> 说明：实际服务 `matrixSpaceService` 为 `SpaceService` 类的单例，其内部通过组合方式提供上述功能。日常开发可直接调用 `matrixSpaceService.xxx()`。

### 2.2 常用场景示例

#### 创建空间
```typescript
import { matrixSpaceService } from '@/services/matrix'

const space = await matrixSpaceService.createSpace({
  name: '我的空间',
  topic: '这是一个测试空间',
  visibility: 'public',
  powerLevelContentOverride: {
    users_default: 0,
    events_default: 0,
    states_default: 50,
  },
})

console.log(`创建成功：${space.spaceId}`)
```

#### 获取空间层级（含子空间和成员）
```typescript
import { matrixSpaceService } from '@/services/matrix'

// 参数：spaceId, limit (可选), from (可选)
const hierarchy = await matrixSpaceService.getSpaceHierarchy('!abc:example.com', 50, 0)
console.log(`空间名称：${hierarchy.name}`)
console.log(`子空间数量：${hierarchy.children.length}`)
console.log(`成员数量：${hierarchy.members.length}`)
```

#### 搜索公共空间
```typescript
import { matrixSpaceService } from '@/services/matrix'

const spaces = await matrixSpaceService.searchSpaces('技术', 20)
spaces.forEach((space) => {
  console.log(`${space.name}: ${space.num_joined_members} 成员`)
})
```

#### 获取用户的空间列表
```typescript
import { matrixSpaceService } from '@/services/matrix'

const mySpaces = await matrixSpaceService.getUserSpaces()
console.log(`空间数量：${mySpaces.length}`)
```

### 2.3 缓存机制

> **当前状态**：`matrixSpaceService` 暂未内置查询缓存（原方案中的 `SpaceQueryManager` LRU 缓存未落地）。查询每次直达后端，依赖 `getUserSpaces()` 内置的 3 秒超时 + 本地房间回退（详见 `spaceQueries.ts`）。缓存能力规划见 [sdk-optimization-plan.md](./sdk-optimization-plan.md) 阶段三。

---

## 三、Room Summary 房间统计管理

通过 `matrixRoomSummaryService` 访问，提供房间统计、未读标记等能力。

### 3.1 核心功能

| 方法 | 说明 |
|------|------|
| `getRoomSummary(roomId)` | 获取房间统计信息（如聊天消息统计） |
| `getRoomStats(roomId)` | 获取房间高级统计（如成员活跃度、消息统计） |
| `recalculateStats(roomId)` | 重新计算统计（管理员专用） |
| `clearUnreadSummary(roomId)` | 清除房间未读标记 |

> **注意**：Service 的方法命名与 SDK 保持一致，需仔细对照方法签名和参数类型。

### 3.2 使用示例

#### 获取房间统计信息
```typescript
import { matrixRoomSummaryService } from '@/services/matrix'

const stats = await matrixRoomSummaryService.getRoomStats('!room:example.com')
console.log(`统计信息：`, stats)
```

#### 重新计算统计（管理员）
```typescript
import { matrixRoomSummaryService } from '@/services/matrix'

await matrixRoomSummaryService.recalculateStats('!room:example.com')
console.log('统计已重新计算')
```

#### 清除未读（用户操作后）
```typescript
import { matrixRoomSummaryService } from '@/services/matrix'

await matrixRoomSummaryService.clearUnreadSummary('!room:example.com')
console.log('未读已清除')
```

---

## 四、Event Report 举报管理

通过 `matrixEventReportService` 访问，提供事件举报全流程管理。

### 4.1 核心功能

| 功能 | 方法 | 说明 |
|------|------|------|
| 创建举报 | `createReport` | 举报某条消息 |
| 列出举报 | `listReports` | 分页查询举报列表 |
| 查看详情 | `getReport` | 获取单个举报详情 |
| 更新状态 | `updateReport` | 修改举报状态 |
| 解决举报 | `resolveReport` | 标记为已处理 |
| 忽略举报 | `dismissReport` | 忽略该举报 |
| 升级举报 | `escalateReport` | 升级到更高权限 |
| 屏蔽用户 | `blockUser` | 临时屏蔽用户 |

### 4.2 使用示例

#### 举报恶意消息
```typescript
import { matrixEventReportService } from '@/services/matrix'

const report = await matrixEventReportService.createReport({
  room_id: '!room:example.com',
  event_id: '$abc123:example.com',
  reason: '发送垃圾广告',
})

console.log(`举报已提交：${report.reportId}`)
```

#### 查看所有举报
```typescript
import { matrixEventReportService } from '@/services/matrix'

const reports = await matrixEventReportService.listReports({
  roomId: '!room:example.com',
  limit: 20,
  from: 0,
})

reports.forEach((r) => {
  console.log(`[${r.state}] ${r.senderId}: ${r.reason}`)
})
```

#### 处理举报
```typescript
// 解决举报
await matrixEventReportService.resolveReport('report_123')
console.log('举报已解决')

// 屏蔽用户（防止再次骚扰）
await matrixEventReportService.blockUser('@spammer:example.com', {
  reason: '持续发送垃圾消息',
})
```

---

## 五、Voice 语音消息管理

通过 `matrixVoiceService` 访问，支持上传、获取语音消息。

### 5.1 核心功能

| 方法 | 说明 |
|------|------|
| `uploadVoice(roomId, audioBlob, opts?)` | 上传语音消息（支持加密房间） |
| `listRoomVoiceMessages(roomId, opts?)` | 获取房间语音列表 |
| `listUserVoiceMessages(userId, opts?)` | 获取用户语音列表 |
| `getVoiceConfig()` | 获取语音配置 |

### 5.2 使用示例

#### 上传语音消息
```typescript
import { matrixVoiceService } from '@/services/matrix'

// 明文房间
const result = await matrixVoiceService.uploadVoice(
  roomId,
  audioBlob,
  {
    duration_ms: 5000,
    waveform: [120, 130, 125, ...],
  },
)

// 加密房间（自动加密）
if (matrixClientService.getClient()?.isRoomEncrypted(roomId)) {
  const encryptedResult = await matrixVoiceService.uploadVoice(
    roomId,
    audioBlob,
    {
      duration_ms: 5000,
      encrypt: true, // SDK 自动处理加密
    },
  )
}
```

#### 获取语音列表
```typescript
import { matrixVoiceService } from '@/services/matrix'

// 房间语音列表
const voices = await matrixVoiceService.getRoomVoiceList('!room:example.com', 50, 0)

// 用户语音列表
const userVoices = await matrixVoiceService.getUserVoiceList('@user:example.com', 50, 0)

voices.forEach((voice) => {
  console.log(`时长：${voice.duration_ms}ms, 大小：${voice.size_bytes}B`)
})
```

---

## 六、OIDC 认证管理

通过 `matrixOidcService` 访问，提供 OIDC 登录、授权等功能。

### 6.1 核心功能

| 方法 | 说明 |
|------|------|
| `discoverOidc(homeserverUrl)` | 发现 OIDC Provider 配置 |
| `isOidcEnabled()` | 检查当前 HS 是否启用 OIDC |
| `getAuthorizationUrl(params)` | 获取授权页面 URL |
| `handleCallback(code, state)` | 处理回调，交换令牌 |
| `getUserInfo()` | 获取当前用户信息 |
| `logout()` | OIDC 登出 |
| `exchangeOidcForMatrixToken(...)` | OIDC 令牌换取 Matrix Token |

### 6.2 使用示例

#### 完整 OIDC 登录流程
```typescript
import { matrixOidcService } from '@/services/matrix'

// 1. 发现并验证 OIDC 配置
const discovery = await matrixOidcService.discoverOidc('https://matrix.example.com')

// 2. 获取授权页面 URL 并跳转
const authUrl = await matrixOidcService.getAuthorizationUrl({
  redirectUri: 'https://app.example.com/callback',
  // ...其他参数
})
if (authUrl) window.location.href = authUrl

// 3. 回调处理（在回调页面）
const tokens = await matrixOidcService.handleCallback(
  urlParams.get('code')!,
  urlParams.get('state')!
)

console.log(`登录成功：${tokens?.access_token}`)
```

---

## 七、最佳实践

### 7.1 错误处理

所有 Service 方法在出错时均会抛出标准错误，建议使用 `try/catch` 捕获并给用户友好提示：

```typescript
import { matrixSpaceService } from '@/services/matrix'

try {
  const space = await matrixSpaceService.createSpace({ name: '测试空间' })
  console.log('创建成功')
} catch (error) {
  console.error('创建空间失败:', error.message)
  // 显示错误提示给用户
  showErrorToast(error.message)
}
```

错误类型包括但不限于：
- `NetworkError`：网络请求失败
- `AuthError`：用户未登录或权限不足
- `ValidationError`：参数验证失败
- `MatrixError`：Matrix 服务器返回错误

### 7.2 性能优化

1. **批量操作**：使用 `Promise.all` 并行请求
2. **避免重复初始化**：Service 为单例，全局共享一实例
3. **超时控制**：部分查询方法内置超时保护（如 `getUserSpaces` 3 秒超时）

```typescript
// ✅ 推荐：并行获取数据
const [spaces, stats, hierarchy] = await Promise.all([
  matrixSpaceService.getUserSpaces(),
  matrixRoomSummaryService.getRoomStats('!room:example.com'),
  matrixSpaceService.getSpaceHierarchy('!space:example.com'),
])

// ❌ 不推荐：串行请求（会增加等待时间）
```

### 7.3 内存管理

Service 为单例，全程驻留内存。无需手动释放。如需切换账号或重新初始化，请调用 `matrixClientService.stopClient()` 后重新初始化。

---

## 八、常见问题

### Q1: 为什么看不到 `client.getSpaceManager()` 等方法？

**答**：Tjg 前端采用 Service 封装层，对外提供 `matrixSpaceService` 等单例。底层仍会调用 SDK 的 `getSpaceManager()`，但对业务层透明。直接使用 Service 能获得更统一的错误处理和缓存机制。

> 如需直接使用 SDK 原始能力，请通过 `matrixClientService.getClient()` 获取底层客户端。

### Q2: 缓存何时失效？

**答**：目前 `matrixSpaceService` 暂未内置查询缓存。每次查询都会直达后端，但内部有 3 秒超时 + 本地房间回退机制（详见 `spaceQueries.ts`）。缓存能力正在规划中，参考 [sdk-optimization-plan.md](./sdk-optimization-plan.md)。

### Q3: 如何监控服务性能？

**答**：目前 Service 层未提供统一的性能监控 API。如需了解请求情况，可查阅服务内部的日志输出（通过 `createLogger` 创建）。未来版本将引入 `getMetrics()` 接口。

### Q4: 服务之间如何协作？

**答**：Service 间通过共享 `matrixClientService` 获取的底层 `MatrixClient` 实例进行协作，确保状态一致。例如：
- `matrixSpaceService` 创建空间后，可通过 `matrixRoomSummaryService` 立即获取其统计
- 语音上传成功后，`matrixVoiceService` 会自动通知相关房间更新

---

## 九、附录：服务清单

### 核心服务单例

| 服务 | 导入路径 | 说明 |
|------|----------|------|
| `matrixSpaceService` | `@/services/matrix` | Space 空间管理（CRUD、查询、成员、子房间、层级） |
| `matrixVoiceService` | `@/services/matrix` | 语音消息管理（上传、列表、配置） |
| `matrixEventReportService` | `@/services/matrix` | 事件举报管理（创建、查询、处理、升级） |
| `matrixRoomSummaryService` | `@/services/matrix` | 房间统计管理（统计、未读、重算） |
| `matrixOidcService` | `@/services/matrix` | OIDC 认证管理（登录、注册、令牌、回调） |

### SDK 原始类型（按需导入）

| 类型 | 导入路径 | 说明 |
|------|----------|------|
| `MatrixClient` | `@/services/matrix/sdk` | 底层客户端实例 |
| `Room` | `@/services/matrix/sdk` | 房间对象 |
| `SpaceInfo` | `@/services/matrix` | 服务层空间信息接口（含 `spaceId`, `name`, `memberCount` 等） |
| `VoiceMessageResult` | `@/services/matrix` | 语音上传结果类型 |

> **注意**：建议优先使用服务层接口（如 `SpaceInfo`），除非特殊需要底层 SDK 类型。

---

## 十、文档维护

- 如有问题或建议，请提交 Issue 或 PR
- 最新版本：[sdk-encapsulation-audit-v2.md](../../sdk-encapsulation-audit-v2.md)
- 优化进度：参考项目看板 "SDK 封装层优化"