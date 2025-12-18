# E2EE 消息自毁功能 API 文档

**版本**: 1.1.0
**创建日期**: 2025-12-12
**作者**: HuLa Team

---

## 概述

消息自毁功能允许用户设置加密消息的存活时间，消息在满足条件后会自动从服务器和客户端删除。

### 核心规则

- **最短时间**: 对方阅读后 5 分钟自动销毁
- **最长时间**: 消息创建后 3 天自动销毁（无论是否已读）
- **销毁时间计算**: `destructAt = min(readAt + 5min, sendTime + timer, sendTime + 3days)`

---

## API 端点

### 1. 发送加密消息（支持自毁）

**接口**: `POST /chat/e2ee/msg`

**描述**: 发送端到端加密消息，支持设置自毁定时器

**请求头**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**:
```json
{
  "roomId": 1001,
  "encryptedMessage": {
    "conversationId": "conv_123456",
    "recipientId": 10002,
    "keyId": "session_key_001",
    "algorithm": "AES_GCM",
    "ciphertext": "Base64编码的密文",
    "iv": "Base64编码的IV",
    "tag": "Base64编码的认证标签",
    "signature": "Base64编码的签名",
    "contentType": "text",
    "selfDestructTimer": 300000
  }
}
```

**参数说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| roomId | Long | 是 | 房间ID |
| encryptedMessage | Object | 是 | 加密消息对象 |
| encryptedMessage.conversationId | String | 是 | 会话ID |
| encryptedMessage.recipientId | Long | 否 | 接收者ID（私聊） |
| encryptedMessage.keyId | String | 是 | 会话密钥ID |
| encryptedMessage.algorithm | String | 是 | 加密算法（AES_GCM） |
| encryptedMessage.ciphertext | String | 是 | Base64编码的密文 |
| encryptedMessage.iv | String | 是 | Base64编码的初始化向量 |
| encryptedMessage.tag | String | 否 | Base64编码的认证标签 |
| encryptedMessage.signature | String | 否 | Base64编码的消息签名 |
| encryptedMessage.contentType | String | 是 | 内容类型（text/image/file等） |
| **encryptedMessage.selfDestructTimer** | **Long** | **否** | **自毁定时器（毫秒）** |

**selfDestructTimer 可选值**:
- `null` 或不传：不启用自毁功能
- `300000`：5 分钟（5 * 60 * 1000）
- `3600000`：1 小时（60 * 60 * 1000）
- `86400000`：1 天（24 * 60 * 60 * 1000）
- `259200000`：3 天（3 * 24 * 60 * 60 * 1000）

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "message": {
      "id": 123456,
      "roomId": 1001,
      "fromUser": {
        "userId": 10001,
        "username": "Alice"
      },
      "content": "[加密消息]",
      "encrypted": true,
      "encryptedMessageId": 789012,
      "sendTime": 1702368000000
    }
  }
}
```

---

### 2. 标记消息为已读（新增）

**接口**: `POST /chat/e2ee/msg/{msgId}/read`

**描述**: 接收方阅读消息时调用，触发阅后5分钟自毁倒计时

**请求头**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| msgId | Long | 是 | 消息ID |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| readAt | Long | 是 | 阅读时间戳（毫秒） |

**请求示例**:
```
POST /chat/e2ee/msg/123456/read?readAt=1702368000000
```

**响应示例**:
```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

**错误响应**:
```json
{
  "code": 403,
  "message": "无权操作此消息",
  "data": null
}
```

**说明**:
- 只有接收者（recipientId）可以标记消息为已读
- 如果消息启用了自毁功能，会重新计算销毁时间
- 新的销毁时间：`destructAt = min(readAt + 5min, originalDestructAt)`
- 发送方会收到已读回执通知（通过WebSocket）

---

## WebSocket 推送

### 1. 消息已读通知

**Topic**: `e2ee_message_read`

**推送对象**: 发送方

**消息格式**:
```json
{
  "type": "MESSAGE_READ",
  "data": {
    "messageId": 123456,
    "conversationId": "conv_123456",
    "senderId": 10001,
    "readerId": 10002,
    "readAtTimestamp": 1702368000000,
    "notificationType": "MESSAGE_READ"
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | Long | 消息ID |
| conversationId | String | 会话ID |
| senderId | Long | 发送方ID（接收通知的用户） |
| readerId | Long | 阅读者ID（标记消息为已读的用户） |
| readAtTimestamp | Long | 阅读时间戳（毫秒） |
| notificationType | String | 通知类型（MESSAGE_READ） |

---

### 2. 消息销毁通知

**Topic**: `e2ee_message_destruct`

**推送对象**: 发送方和接收方

**消息格式**:
```json
{
  "type": "MESSAGE_DESTRUCTED",
  "data": {
    "messageId": 123456,
    "conversationId": "conv_123456",
    "senderId": 10001,
    "recipientId": 10002,
    "roomId": null,
    "tenantId": 1,
    "destructedAt": 1702368300000,
    "destructReason": "SELF_DESTRUCT",
    "notificationType": "MESSAGE_DESTRUCTED"
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| messageId | Long | 消息ID |
| conversationId | String | 会话ID |
| senderId | Long | 发送方ID |
| recipientId | Long | 接收方ID（私聊） |
| roomId | Long | 群聊ID（群聊） |
| tenantId | Long | 租户ID |
| destructedAt | Long | 销毁时间戳（毫秒） |
| destructReason | String | 销毁原因（SELF_DESTRUCT） |
| notificationType | String | 通知类型（MESSAGE_DESTRUCTED） |

**客户端处理**:
1. 收到通知后，从本地存储删除该消息
2. 从UI界面移除消息显示
3. 停止该消息的倒计时器

---

## 数据模型

### MessageEncrypted 实体

```sql
CREATE TABLE `im_message_encrypted` (
  -- 原有字段...

  -- 新增字段
  `self_destruct_timer` BIGINT NULL COMMENT '自毁定时器(毫秒) - 客户端设置的消息存活时间',
  `read_at` DATETIME NULL COMMENT '消息被读取时间 - 接收方阅读消息时由客户端上报',
  `destruct_at` DATETIME NULL COMMENT '消息销毁时间（自动计算） - 计算规则: min(readAt + 5min, sendTime + selfDestructTimer, sendTime + 3days)',

  -- 索引
  KEY `idx_destruct_at` (`destruct_at`),
  KEY `idx_read_at` (`read_at`),
  KEY `idx_self_destruct` (`self_destruct_timer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 使用示例

### 前端示例（TypeScript）

#### 1. 发送带自毁定时器的消息

```typescript
import { e2eeStore } from '@/stores/e2ee'
import { SelfDestructTimer } from '@/types/selfDestruct'

// 发送5分钟自毁消息
async function sendSelfDestructMessage(
  roomId: string,
  recipientId: number,
  message: string
) {
  await e2eeStore.encryptAndSendMessage(
    roomId,
    recipientId,
    message,
    'text',
    undefined,
    SelfDestructTimer.FIVE_MINUTES  // 5分钟自毁
  )
}
```

#### 2. 标记消息为已读

```typescript
import { e2eeApi } from '@/services/api/e2ee'

// 用户阅读消息时调用
async function markMessageAsRead(messageId: number) {
  const readAt = Date.now()
  await e2eeApi.markMessageAsRead(messageId, readAt)
}
```

#### 3. 处理WebSocket通知

```typescript
import { selfDestructManager } from '@/services/selfDestructManager'

// 监听消息销毁通知
websocket.on('MESSAGE_DESTRUCTED', (data) => {
  const { messageId, conversationId } = data

  // 从本地存储删除消息
  chatStore.deleteMsg(messageId)

  // 清理自毁任务
  selfDestructManager.clearTask(messageId, conversationId)

  console.log(`消息 ${messageId} 已自毁`)
})

// 监听消息已读通知
websocket.on('MESSAGE_READ', (data) => {
  const { messageId, readAtTimestamp } = data

  // 更新消息状态
  chatStore.updateMessageStatus(messageId, 'read', readAtTimestamp)

  console.log(`消息 ${messageId} 已被对方阅读`)
})
```

---

### 后端示例（Java）

#### 1. 保存带自毁定时器的消息

```java
@PostMapping("/chat/e2ee/msg")
public R<ChatMessageResp> sendEncryptedMsg(@Valid @RequestBody EncryptedChatMessageReq request) {
    // 消息会自动计算初始销毁时间
    Long msgId = e2eeChatService.sendEncryptedMessage(request, ContextUtil.getUid());

    ChatMessageResp resp = e2eeChatService.getEncryptedMessageResp(msgId, ContextUtil.getUid());

    return R.success(resp);
}
```

#### 2. 标记消息为已读

```java
@PostMapping("/chat/e2ee/msg/{msgId}/read")
public R<Void> markMessageAsRead(
    @PathVariable Long msgId,
    @RequestParam Long readAt
) {
    // 更新readAt并重新计算destructAt
    e2eeChatService.markMessageAsRead(msgId, readAt, ContextUtil.getUid());

    return R.success();
}
```

#### 3. 定时清理任务

```java
@Scheduled(cron = "0 * * * * ?")  // 每分钟执行
public void cleanupSelfDestructMessages() {
    int cleanedCount = messageService.cleanupSelfDestructMessages();

    if (cleanedCount > 0) {
        log.info("清理自毁消息完成，删除 {} 条", cleanedCount);
    }
}
```

---

## 错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 400 | 参数错误 | 检查请求参数是否正确 |
| 401 | 未授权 | 检查token是否有效 |
| 403 | 无权操作 | 只有接收者可以标记消息为已读 |
| 404 | 消息不存在 | 消息可能已被删除或不存在 |
| 500 | 服务器错误 | 联系技术支持 |

---

## 注意事项

### 1. 时间精度

- 所有时间戳使用毫秒级精度
- 客户端和服务器应保持时间同步
- 建议使用服务器时间校准

### 2. 网络延迟

- 标记已读请求可能有延迟
- 销毁通知推送可能有延迟
- 客户端应实现本地倒计时补偿

### 3. 离线消息

- 接收方离线时无法立即触发阅读状态
- 依赖发送时间戳的最长保留期（3天）
- 上线后应尽快标记为已读

### 4. 多设备同步

- 同一用户多设备登录时，阅读状态需同步
- 服务器通过WebSocket推送 `readAt` 给所有设备
- 客户端收到推送后应更新本地状态

### 5. 数据一致性

- 消息删除是不可逆的
- 删除前应确保客户端已收到通知
- 建议实现删除确认机制

---

## 最佳实践

### 1. 客户端实现

```typescript
// 1. 使用自毁管理器统一管理
import { selfDestructManager } from '@/services/selfDestructManager'

// 2. 初始化时注册回调
selfDestructManager.init(
  (messageId, roomId) => {
    // 删除消息
    chatStore.deleteMsg(messageId)
  },
  (messageId, roomId, readAt) => {
    // 更新已读状态
    chatStore.updateReadStatus(messageId, readAt)
  }
)

// 3. 收到新消息时注册
onMessageReceived((message) => {
  if (message.selfDestructTimer) {
    selfDestructManager.registerMessage(message)
  }
})

// 4. 阅读消息时标记
onMessageRead((message) => {
  if (message.selfDestructTimer && !message.readAt) {
    selfDestructManager.markMessageAsRead(message)
    // 同时调用API
    markMessageAsRead(message.id)
  }
})
```

### 2. 服务器实现

```java
// 1. 使用事务确保数据一致性
@Transactional(rollbackFor = Exception.class)
public void markMessageAsRead(Long messageId, Long readAt, Long userId) {
    // 更新数据库
    updateReadStatus(messageId, readAt, userId)

    // 发布事件（事务提交后）
    applicationEventPublisher.publishEvent(
        new MessageReadEvent(messageId, conversationId, senderId, userId, readAtTime)
    )
}

// 2. 使用定时任务清理
@Scheduled(cron = "0 * * * * ?")
public void cleanupSelfDestructMessages() {
    // 批量查询到期消息
    List<MessageEncrypted> expired = findExpiredMessages()

    // 批量删除
    batchDelete(expired)

    // 批量发送通知
    batchNotifyClients(expired)
}
```

---

## 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.1.0 | 2025-12-12 | 新增消息自毁功能 |
| 1.0.0 | 2025-01-01 | 初始版本 |

---

## 参考资料

- [消息自毁功能实现文档](../MESSAGE_SELF_DESTRUCT_IMPLEMENTATION.md)
- [消息自毁功能完成总结](../SELF_DESTRUCT_FINAL_SUMMARY.md)
- [E2EE 最佳实践](../guides/e2ee-best-practices.md)
- [数据库迁移脚本](../../luohuo-cloud/luohuo-im/sql/e2ee_self_destruct_migration.sql)

---

**文档维护**: HuLa Team
**最后更新**: 2025-12-12
**联系方式**: tech@hula.im
