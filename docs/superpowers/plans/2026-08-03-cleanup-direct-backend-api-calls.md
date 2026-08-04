# 清理旧 hula 后端 API 直接调用实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面清理项目中所有绕过 Matrix SDK 的直接 HTTP 调用，统一通过 SDK 高层方法或 `matrixHttpClient` 封装层实现后端交互。

**Architecture:** 项目已有 `MatrixHttpClient` 封装层（`src/services/matrix/MatrixHttpClient.ts`），它包装了 SDK 的 `client.http.authedRequest`，提供统一的错误处理、日志和 AI 扩展端点检测。清理工作分两类：(1) SDK 有高层方法的调用（如 `client.relations()`、`client.getPushRules()`），直接替换为 SDK 方法；(2) SDK 无高层方法的 synapse-rust 扩展调用（如 `notifications_ack`），统一到 `matrixHttpClient.request()` 或 `authedRequestWithPath()`。

**Tech Stack:** TypeScript, Vue 3, matrix-js-sdk (local), Vitest

## Global Constraints

- 所有 Matrix SDK 调用必须通过 `src/services/matrix/` 中的服务类，组件不得直接调用 SDK
- synapse-rust manager extensions 通过 `client.getFriendManager()` 等方式访问，属于合规的 SDK 调用
- `matrixHttpClient.request()` 是项目统一的 HTTP 封装，内部使用 `client.http.authedRequest`，属于合规的 SDK 调用
- `authedRequestWithPath()` 是处理含前缀路径的辅助函数，属于合规的 SDK 调用
- Worker 中的 `fetch` 调用因架构限制（SDK 在 worker 中运行，预登录 API 需在 SDK 初始化前调用），部分需保留
- 每个任务完成后必须运行相关测试验证，全部任务完成后运行完整测试套件
- 使用 `pnpm vitest run <path>` 运行单个测试文件，`pnpm test:run` 运行全部测试
- 使用 `vue-tsc --noEmit` 验证类型安全

## 排查结果汇总

### A. 直接 `client.http.authedRequest` 调用（应替换为 SDK 高层方法或 matrixHttpClient）

| 文件 | 行号 | 调用 | SDK 替代方法 |
|---|---|---|---|
| MatrixMessageRelationService.ts | L512 | GET RELATIONS.BASE | `client.relations(roomId, eventId, relType?, eventType?, opts?)` |
| MatrixMessageRelationService.ts | L539 | GET RELATIONS.BY_TYPE | `client.relations(roomId, eventId, relType, eventType?, opts?)` |
| MatrixMessageRelationService.ts | L556 | GET RELATIONS.AGGREGATIONS | `client.relations()` + 客户端聚合 |
| MatrixMessageRelationService.ts | L582 | POST RELATIONS.SEND | `client.sendEvent(roomId, eventType, content, txnId)` |
| MatrixNotificationService.ts | L369 | GET NOTIFICATIONS | `client.getNotifications(from?, limit?, only?)` |
| MatrixNotificationService.ts | L380 | POST NOTIFICATIONS_ACK | 无 SDK 方法 → 统一到 `matrixHttpClient` |
| MatrixNotificationService.ts | L424 | POST RECEIPT | `client.sendReceipt(roomId, eventId, 'm.read', data?)` |
| MatrixNotificationService.ts | L439 | GET PUSH_RULES | `client.getPushRules()` |
| MatrixNotificationService.ts | L454 | PUT PUSH_RULES/... | `client.addPushRule(scope, kind, ruleId, body)` |
| MatrixNotificationService.ts | L469 | DELETE PUSH_RULES/... | `client.deletePushRule(scope, kind, ruleId)` |
| MatrixNotificationService.ts | L483 | GET PUSHERS | `client.getPushers()` |
| MatrixNotificationService.ts | L498 | POST PUSHERS/set | `client.setPusher(pusher)` |
| MatrixAccountService.ts | L380 | (需确认) | 统一到 `matrixHttpClient` |

### B. 直接 `client.http.request` 调用（token refresh）

| 文件 | 行号 | 调用 | 处理方式 |
|---|---|---|---|
| MatrixTokenManager.ts | L67 | POST /refresh | 统一到 `matrixHttpClient` |
| MatrixClientService.ts | L356 | POST /refresh | 统一到 `matrixHttpClient` |

### C. Worker 中的 `fetch` 调用

| 文件 | 行号 | 调用 | 处理方式 |
|---|---|---|---|
| matrixSdk.worker.ts | L572 | GET /_matrix/client/versions | 保留（预登录 API，SDK 未初始化） |
| matrixSdk.worker.ts | L635 | (需确认) | 评估是否可移到服务层 |
| matrixSdk.worker.ts | L672 | (需确认) | 评估是否可移到服务层 |

---

### Task 1: 清理 MatrixMessageRelationService 中的直接 HTTP 调用

**Files:**
- Modify: `src/services/matrix/messaging/MatrixMessageRelationService.ts:505-595`
- Test: `src/services/matrix/messaging/__tests__/MatrixMessageRelationService.test.ts`

**Interfaces:**
- Consumes: `matrixClientService.getClient()` 返回 `MatrixClient | null`
- Produces: 修改后的 `fetchRelations`、`fetchRelationsByType`、`fetchAggregations`、`sendRelation` 方法

**背景**: SDK 提供了 `client.relations(roomId, eventId, relationType, eventType, opts)` 高层方法（位于 `matrix-js-sdk/src/client.ts:3176`），返回 `IPaginatedResponse<MatrixEvent>`。当前代码直接调用 `client.http.authedRequest` 获取原始 JSON 响应，需改为使用 SDK 方法。

- [ ] **Step 1: 读取当前实现并理解返回类型**

Read: `src/services/matrix/messaging/MatrixMessageRelationService.ts` L490-600

确认 `RelationsResponse` 类型定义和调用方的期望返回类型。

- [ ] **Step 2: 编写失败测试 - fetchRelations 使用 SDK 方法**

```typescript
// 在 MatrixMessageRelationService.test.ts 中添加
it('fetchRelations uses client.relations() instead of http.authedRequest', async () => {
  const mockRelations = vi.fn().mockResolvedValue({ events: [], nextBatch: undefined })
  mockClient.relations = mockRelations
  mockClient.http.authedRequest = vi.fn() // 不应被调用

  await service.fetchRelations('!room:server', '$event:server')

  expect(mockRelations).toHaveBeenCalledWith('!room:server', '$event:server', undefined, undefined, expect.anything())
  expect(mockClient.http.authedRequest).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/messaging/__tests__/MatrixMessageRelationService.test.ts`
Expected: FAIL

- [ ] **Step 4: 修改 fetchRelations 使用 client.relations()**

```typescript
async fetchRelations(
  roomId: string,
  eventId: string,
  options?: { from?: string; to?: string; limit?: number; dir?: 'b' | 'f' }
): Promise<RelationsResponse | null> {
  const client = matrixClientService.getClient()
  if (!client) return null
  try {
    const opts: Record<string, unknown> = {}
    if (options?.limit) opts.limit = options.limit
    if (options?.dir) opts.dir = options.dir
    if (options?.from) opts.from = options.from

    const result = await client.relations(roomId, eventId, undefined, undefined, opts)
    // SDK 返回 { events: MatrixEvent[], nextBatch?: string }
    // 转换为 RelationsResponse 格式
    return {
      chunk: result.events.map((e) => e.event),
      next_batch: result.nextBatch
    } as RelationsResponse
  } catch (err) {
    logger.error(`[MessageRelation] 获取关系列表失败: ${err}`)
    return null
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/messaging/__tests__/MatrixMessageRelationService.test.ts`
Expected: PASS

- [ ] **Step 6: 同样修改 fetchRelationsByType**

将 `client.http.authedRequest('GET', MATRIX_PATHS.RELATIONS.BY_TYPE(...))` 替换为 `client.relations(roomId, eventId, relType, undefined, opts)`。

- [ ] **Step 7: 修改 fetchAggregations**

聚合查询（`MATRIX_PATHS.RELATIONS.AGGREGATIONS`）SDK 的 `client.relations()` 不直接支持，但可通过指定 `relationType` + 客户端聚合实现。如果 SDK 不支持聚合端点，保留 `authedRequestWithPath` 调用（统一到封装层）。

- [ ] **Step 8: 修改 sendRelation**

将 `client.http.authedRequest('POST', MATRIX_PATHS.RELATIONS.SEND(...))` 替换为 `client.sendEvent(roomId, eventType, content, txnId)`。

- [ ] **Step 9: 运行全部相关测试**

Run: `pnpm vitest run src/services/matrix/messaging/__tests__/`
Expected: ALL PASS

- [ ] **Step 10: 提交**

```bash
git add src/services/matrix/messaging/MatrixMessageRelationService.ts src/services/matrix/messaging/__tests__/MatrixMessageRelationService.test.ts
git commit -m "refactor: replace direct http.authedRequest with SDK client.relations() in MessageRelationService"
```

---

### Task 2: 清理 MatrixNotificationService 中的直接 HTTP 调用

**Files:**
- Modify: `src/services/matrix/notifications/MatrixNotificationService.ts:360-500`
- Test: `src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts`

**Interfaces:**
- Consumes: `matrixClientService.getClient()` 返回 `MatrixClient | null`
- Produces: 修改后的 `fetchNotifications`、`ackNotification`、`sendReadReceipt`、`fetchPushRules`、`setPushRuleByScope`、`deletePushRuleByScope`、`fetchPushers`、`setPusherByBody` 方法

**背景**: SDK 提供了 `client.getNotifications()`、`client.getPushRules()`、`client.getPushers()`、`client.setPusher()`、`client.sendReceipt()` 等高层方法。`ackNotification` 是 synapse-rust 特有端点，SDK 无对应方法，需统一到 `matrixHttpClient`。

- [ ] **Step 1: 编写失败测试 - fetchPushRules 使用 SDK 方法**

```typescript
it('fetchPushRules uses client.getPushRules() instead of http.authedRequest', async () => {
  const mockPushRules = { global: {} }
  mockClient.getPushRules = vi.fn().mockResolvedValue(mockPushRules)
  mockClient.http.authedRequest = vi.fn()

  const result = await service.fetchPushRules()

  expect(mockClient.getPushRules).toHaveBeenCalled()
  expect(mockClient.http.authedRequest).not.toHaveBeenCalled()
  expect(result).toEqual(mockPushRules)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts`
Expected: FAIL

- [ ] **Step 3: 修改 fetchPushRules 使用 client.getPushRules()**

```typescript
async fetchPushRules(): Promise<IPushRules> {
  const client = this.getNotificationClient()
  try {
    return await client.getPushRules()
  } catch (err) {
    logger.error(`[MatrixNotification] 获取推送规则失败: ${err}`)
    throw err
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts`
Expected: PASS

- [ ] **Step 5: 修改 fetchPushers 使用 client.getPushers()**

```typescript
async fetchPushers(): Promise<Array<Record<string, unknown>>> {
  const client = this.getNotificationClient()
  try {
    const result = await client.getPushers()
    return (result as { pushers?: Array<Record<string, unknown>> }).pushers ?? []
  } catch (err) {
    logger.error(`[MatrixNotification] 获取推送设备列表失败: ${err}`)
    throw err
  }
}
```

- [ ] **Step 6: 修改 setPusherByBody 使用 client.setPusher()**

```typescript
async setPusherByBody(pusher: Record<string, unknown>): Promise<void> {
  const client = this.getNotificationClient()
  try {
    await client.setPusher(pusher as Parameters<typeof client.setPusher>[0])
    logger.info('[MatrixNotification] 设置推送设备成功')
  } catch (err) {
    logger.error(`[MatrixNotification] 设置推送设备失败: ${err}`)
    throw err
  }
}
```

- [ ] **Step 7: 修改 sendReadReceipt 使用 client.sendReceipt()**

```typescript
private async sendReadReceipt(roomId: string, eventId: string): Promise<boolean> {
  const client = this.getNotificationClient()
  try {
    await client.sendReceipt(roomId, eventId, 'm.read')
    logger.info(`[MatrixNotification] 已读回执发送成功: ${roomId}/${eventId}`)
    return true
  } catch (err) {
    logger.error(`[MatrixNotification] 已读回执发送失败: ${err}`)
    return false
  }
}
```

- [ ] **Step 8: 修改 fetchNotifications 使用 client.getNotifications()**

```typescript
async fetchNotifications(from?: string, limit = 20): Promise<{
  notifications: Array<Record<string, unknown>>
  next_token?: string
}> {
  const client = this.getNotificationClient()
  try {
    const result = await client.getNotifications(from, limit)
    return {
      notifications: (result as { notifications?: Array<Record<string, unknown>> }).notifications ?? [],
      next_token: (result as { next_token?: string }).next_token
    }
  } catch (err) {
    logger.error(`[MatrixNotification] 获取通知列表失败: ${err}`)
    return { notifications: [] }
  }
}
```

- [ ] **Step 9: 修改 setPushRuleByScope 和 deletePushRuleByScope**

检查 SDK 是否有 `client.addPushRule(scope, kind, ruleId, body)` 和 `client.deletePushRule(scope, kind, ruleId)` 方法。如果有，替换为 SDK 方法；如果没有，统一到 `matrixHttpClient.request()`。

```typescript
async setPushRuleByScope(scope: string, kind: string, ruleId: string, body: Record<string, unknown>): Promise<void> {
  const client = this.getNotificationClient()
  try {
    await client.addPushRule(scope, kind, ruleId, body)
    logger.info(`[MatrixNotification] 设置推送规则成功: ${scope}/${kind}/${ruleId}`)
  } catch (err) {
    logger.error(`[MatrixNotification] 设置推送规则失败: ${err}`)
    throw err
  }
}

async deletePushRuleByScope(scope: string, kind: string, ruleId: string): Promise<void> {
  const client = this.getNotificationClient()
  try {
    await client.deletePushRule(scope, kind, ruleId)
    logger.info(`[MatrixNotification] 删除推送规则成功: ${scope}/${kind}/${ruleId}`)
  } catch (err) {
    logger.error(`[MatrixNotification] 删除推送规则失败: ${err}`)
    throw err
  }
}
```

- [ ] **Step 10: 修改 ackNotification 统一到 matrixHttpClient**

`NOTIFICATIONS_ACK` 是 synapse-rust 特有端点，SDK 无对应方法，统一到 `matrixHttpClient`：

```typescript
async ackNotification(notificationId: string): Promise<boolean> {
  const client = this.getNotificationClient()
  try {
    await matrixHttpClient.request(
      'POST',
      MATRIX_PATHS.NOTIFICATION.NOTIFICATIONS_ACK(notificationId)
    )
    logger.info(`[MatrixNotification] 通知确认成功: ${notificationId}`)
    return true
  } catch (err) {
    logger.error(`[MatrixNotification] 通知确认失败: ${err}`)
    return false
  }
}
```

注意：需在文件顶部添加 `import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'`。

- [ ] **Step 11: 运行全部相关测试**

Run: `pnpm vitest run src/services/matrix/notifications/__tests__/`
Expected: ALL PASS

- [ ] **Step 12: 提交**

```bash
git add src/services/matrix/notifications/MatrixNotificationService.ts src/services/matrix/notifications/__tests__/
git commit -m "refactor: replace direct http.authedRequest with SDK methods in NotificationService"
```

---

### Task 3: 清理 MatrixAccountService 中的直接 HTTP 调用

**Files:**
- Modify: `src/services/matrix/user/MatrixAccountService.ts:380`
- Test: `src/services/matrix/user/__tests__/MatrixAccountService.test.ts`

**Interfaces:**
- Consumes: `matrixClientService.getClient()` 返回 `MatrixClient | null`
- Produces: 修改后的方法（需确认具体方法名和功能）

- [ ] **Step 1: 读取 L380 附近的代码，确认调用上下文**

Read: `src/services/matrix/user/MatrixAccountService.ts` L370-400

- [ ] **Step 2: 确认 SDK 是否有对应的高层方法**

检查 SDK 中是否有对应的方法（如 `client.getAccountData()`、`client.setAccountData()` 等）。

- [ ] **Step 3: 如果有 SDK 方法，替换为 SDK 方法；如果没有，统一到 matrixHttpClient**

```typescript
// 如果 SDK 有对应方法
const result = await client.someMethod(params)

// 如果 SDK 没有对应方法
const result = await matrixHttpClient.request<T>('GET', MATRIX_PATHS.SOME.PATH)
```

- [ ] **Step 4: 更新测试**

```typescript
it('uses SDK method instead of http.authedRequest', async () => {
  mockClient.someMethod = vi.fn().mockResolvedValue(expected)
  mockClient.http.authedRequest = vi.fn()

  await service.someMethod()

  expect(mockClient.someMethod).toHaveBeenCalled()
  expect(mockClient.http.authedRequest).not.toHaveBeenCalled()
})
```

- [ ] **Step 5: 运行测试**

Run: `pnpm vitest run src/services/matrix/user/__tests__/MatrixAccountService.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/user/MatrixAccountService.ts src/services/matrix/user/__tests__/MatrixAccountService.test.ts
git commit -m "refactor: replace direct http.authedRequest in AccountService"
```

---

### Task 4: 清理 token refresh 中的直接 HTTP 调用

**Files:**
- Modify: `src/services/matrix/MatrixTokenManager.ts:67`
- Modify: `src/services/matrix/MatrixClientService.ts:356`
- Test: `src/services/matrix/__tests__/MatrixTokenManager.test.ts`（如存在）

**背景**: 当前代码直接调用 `client.http.request('POST', '/refresh', ...)` 刷新 access token。这是 Matrix 协议的 token refresh 端点，SDK 内部可能已有 token 刷新机制。

- [ ] **Step 1: 检查 SDK 是否有 token refresh 方法**

在 matrix-js-sdk 中搜索 `refreshToken` 或 `refreshAccessToken` 方法。

Run: `grep -r "refreshToken\|refreshAccessToken" ../matrix-js-sdk/src/ --include="*.ts" -l`

- [ ] **Step 2: 如果 SDK 有 refresh 方法，替换为 SDK 方法**

```typescript
// MatrixTokenManager.ts
if (typeof client.refreshToken === 'function') {
  const result = await client.refreshToken(refreshToken)
  // 处理结果
} else {
  // 回退到 matrixHttpClient
  const result = await matrixHttpClient.request('POST', '/refresh', { body: { refresh_token: refreshToken } })
}
```

- [ ] **Step 3: 如果 SDK 没有 refresh 方法，统一到 matrixHttpClient**

```typescript
const result = await matrixHttpClient.request<{ access_token: string; refresh_token?: string }>(
  'POST',
  '/refresh',
  { body: { refresh_token: refreshToken } }
)
```

- [ ] **Step 4: 更新测试**

- [ ] **Step 5: 运行测试**

Run: `pnpm vitest run src/services/matrix/__tests__/`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/MatrixTokenManager.ts src/services/matrix/MatrixClientService.ts
git commit -m "refactor: unify token refresh through matrixHttpClient"
```

---

### Task 5: 评估并清理 Worker 中的 fetch 调用

**Files:**
- Modify: `src/workers/matrixSdk.worker.ts:570-680`
- Test: `src/workers/__tests__/matrixSdk.worker.test.ts`（如存在）

**背景**: Worker 中的 `fetch` 调用用于 SDK 初始化前的预登录 API（如 `/_matrix/client/versions`、login flows）。这些调用在 SDK 客户端实例化之前执行，无法使用 `client.http.authedRequest`。

- [ ] **Step 1: 读取 worker 中的 3 处 fetch 调用**

Read: `src/workers/matrixSdk.worker.ts` L560-690

- [ ] **Step 2: 评估每处调用**

| 调用 | 是否可移到服务层 | 原因 |
|---|---|---|
| `/_matrix/client/versions` | 否 | SDK 未初始化，用于登录前版本检查 |
| (第2处) | 需确认 | 需读取代码确认用途 |
| (第3处) | 需确认 | 需读取代码确认用途 |

- [ ] **Step 3: 对于可移到服务层的调用，创建服务层方法**

```typescript
// 在 MatrixAuthService 中添加
async getServerVersions(baseUrl: string): Promise<ServerVersionsResult> {
  return matrixHttpClient.request('GET', '/_matrix/client/versions', { /* baseUrl */ })
}
```

- [ ] **Step 4: 对于必须保留的调用，添加注释说明原因**

```typescript
// 注意：此处直接使用 fetch 是因为 SDK 客户端尚未初始化，
// 无法使用 client.http.authedRequest。这是登录前的必要调用。
const response = await fetch(url, { method: 'GET', headers })
```

- [ ] **Step 5: 运行测试**

Run: `pnpm vitest run src/workers/`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/workers/matrixSdk.worker.ts
git commit -m "refactor: document and minimize direct fetch calls in worker"
```

---

### Task 6: 全面测试验证

**Files:**
- Test: 全项目测试套件

- [ ] **Step 1: 运行完整测试套件**

Run: `pnpm test:run`
Expected: 无新增失败（对比清理前的基准）

- [ ] **Step 2: 运行类型检查**

Run: `vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 运行代码检查**

Run: `pnpm check`
Expected: 无新增错误

- [ ] **Step 4: 验证无直接 client.http.authedRequest 调用**

Run: `grep -rn "client\.http\.authedRequest" src/services/matrix/ --include="*.ts" | grep -v "__tests__" | grep -v "MatrixHttpClient.ts"`
Expected: 0 结果（所有调用已替换为 SDK 高层方法或统一到 matrixHttpClient）

- [ ] **Step 5: 验证无直接 client.http.request 调用**

Run: `grep -rn "client\.http\.request" src/services/matrix/ --include="*.ts" | grep -v "__tests__" | grep -v "MatrixHttpClient.ts"`
Expected: 0 结果

- [ ] **Step 6: 验证 worker 中的 fetch 调用有注释说明**

Run: `grep -n "fetch(" src/workers/matrixSdk.worker.ts`
Expected: 每处 fetch 调用上方有注释说明保留原因

- [ ] **Step 7: 启动开发服务器验证功能**

Run: `pnpm dev`
在浏览器中验证：
- 消息关系（反应、编辑、回复）正常显示
- 通知列表正常加载
- 推送规则设置正常
- 已读回执正常发送
- Token 刷新正常工作

- [ ] **Step 8: 最终提交**

```bash
git add -A
git commit -m "test: verify all backend API calls go through SDK after cleanup"
```

---

## Self-Review

### Spec coverage
- ✅ 排查所有直接 HTTP 调用 → 排查结果汇总表
- ✅ 清理 `client.http.authedRequest` → Task 1, 2, 3
- ✅ 清理 `client.http.request` → Task 4
- ✅ 清理 worker `fetch` → Task 5
- ✅ 全面测试验证 → Task 6

### Placeholder scan
- Task 3 Step 2 需确认 SDK 方法名 — 这是因为需要读取代码后才能确定，不是占位符
- Task 4 Step 1 需检查 SDK 方法 — 同上
- Task 5 Step 2 需确认调用用途 — 同上

### Type consistency
- `RelationsResponse` 类型在 Task 1 中保持一致
- `IPushRules` 类型在 Task 2 中保持一致
- `matrixHttpClient.request()` 签名在所有任务中一致
