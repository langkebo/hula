# E2EE端到端加密 API 使用指南

## 📚 目录

- [概述](#概述)
- [快速开始](#快速开始)
- [API接口](#api接口)
- [密钥管理](#密钥管理)
- [消息加密](#消息加密)
- [灰度发布](#灰度发布)
- [监控告警](#监控告警)
- [常见问题](#常见问题)

---

## 概述

HuLa E2EE（End-to-End Encryption）提供了完整的端到端加密解决方案，确保消息在传输和存储过程中的安全性。

### 核心特性

- **零信任架构**：服务器永不解密消息内容
- **多层加密**：RSA-OAEP密钥交换 + AES-256-GCM消息加密
- **前向安全**：支持临时密钥和密钥派生
- **消息签名**：可选的RSA-PSS消息签名验证
- **灰度发布**：支持按用户灰度开启E2EE功能

### 技术栈

- **加密算法**：RSA-OAEP 2048/4096, AES-256-GCM
- **签名算法**：RSA-PSS with SHA-256
- **密钥存储**：MySQL + Redis缓存
- **消息传输**：RocketMQ + WebSocket

---

## 快速开始

### 1. 生成密钥对（客户端）

```javascript
// 使用Web Crypto API生成RSA密钥对
const keyPair = await window.crypto.subtle.generateKey(
  {
    name: "RSA-OAEP",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  },
  true,
  ["encrypt", "decrypt"]
);

// 导出公钥为SPKI格式
const publicKeySpki = await window.crypto.subtle.exportKey(
  "spki",
  keyPair.publicKey
);
const publicKeyBase64 = btoa(
  String.fromCharCode(...new Uint8Array(publicKeySpki))
);
```

### 2. 上传公钥

```bash
POST /e2ee/keys/upload
Content-Type: application/json
Authorization: Bearer {your_token}

{
  "keyId": "abc12345_1704729600000",
  "algorithm": "RSA_OAEP",
  "spki": "{base64_encoded_public_key}",
  "fingerprint": "{sha256_fingerprint}"
}
```

### 3. 加密并发送消息

```bash
POST /e2ee/messages
Content-Type: application/json
Authorization: Bearer {your_token}

{
  "conversationId": "conv_12345",
  "recipientId": 10001,
  "keyId": "abc12345_1704729600000",
  "algorithm": "AES_GCM",
  "ciphertext": "{base64_encrypted_message}",
  "iv": "{base64_iv}",
  "tag": "{base64_auth_tag}",
  "contentType": "text/plain",
  "messageSize": 256
}
```

---

## API接口

### 密钥管理

#### 上传公钥

```
POST /e2ee/keys/upload
```

**请求参数：**

| 参数       | 类型   | 必填 | 说明                         |
| ---------- | ------ | ---- | ---------------------------- |
| keyId      | String | 是   | 密钥ID（唯一标识）           |
| algorithm  | String | 是   | 密钥算法（RSA_OAEP）         |
| spki       | String | 是   | SPKI格式公钥（Base64编码）   |
| fingerprint| String | 是   | 公钥指纹（SHA-256哈希）      |

**响应示例：**

```json
{
  "code": 200,
  "message": "success",
  "data": null
}
```

#### 获取用户公钥

```
GET /e2ee/keys/{userId}?keyId={keyId}
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "userId": 10001,
    "keyId": "abc12345_1704729600000",
    "algorithm": "RSA_OAEP",
    "spki": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
    "fingerprint": "sha256_fingerprint_here",
    "isValid": true,
    "expiresAt": "2025-12-31T23:59:59"
  }
}
```

#### 批量获取公钥

```
POST /e2ee/keys/batch
```

**请求参数：**

```json
{
  "userIds": [10001, 10002, 10003],
  "onlyLatest": true
}
```

### 会话密钥管理

#### 分发会话密钥包

```
POST /e2ee/sessions/{sessionId}/key-package
```

**请求参数：**

```json
{
  "keyId": "session_key_123",
  "recipientId": 10002,
  "wrappedKey": "{rsa_encrypted_aes_key}",
  "algorithm": "AES_GCM",
  "forwardSecret": true,
  "ephemeralPublicKey": "{optional_ephemeral_key}"
}
```

#### 获取待接收密钥包

```
GET /e2ee/sessions/key-packages/pending
```

### 加密消息

#### 发送加密消息

```
POST /e2ee/messages
```

**完整请求示例：**

```json
{
  "conversationId": "conv_12345",
  "recipientId": 10002,
  "roomId": null,
  "msgId": 1001,
  "keyId": "key_12345",
  "algorithm": "AES_GCM",
  "ciphertext": "SGVsbG8gV29ybGQ=",
  "iv": "cmFuZG9tX2l2XzEyMw==",
  "tag": "YXV0aF90YWdfMTIz",
  "signature": "{optional_message_signature}",
  "contentType": "text/plain",
  "encryptedExtra": "{optional_encrypted_metadata}",
  "messageSize": 256,
  "encryptionTimeMs": 15
}
```

#### 获取加密消息列表

```
GET /e2ee/messages/{conversationId}?cursor={cursor}&limit=20
```

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1001,
        "conversationId": "conv_12345",
        "senderId": 10001,
        "keyId": "key_12345",
        "ciphertext": "SGVsbG8=",
        "iv": "aXZfMTIz",
        "tag": "dGFnXzEyMw==",
        "createTime": "2025-01-01T12:00:00"
      }
    ],
    "cursor": 1001,
    "hasMore": true
  }
}
```

---

## 密钥管理

### 密钥生命周期

```
生成 → 上传 → 激活 → 使用 → 轮换 → 过期 → 清理
```

### 密钥轮换

**推荐策略**：
- 定期轮换（90天）
- 检测到安全事件时立即轮换
- 设备丢失时撤销相关密钥

**轮换流程**：
1. 生成新密钥对
2. 上传新公钥
3. 更新客户端本地密钥
4. 使用新密钥加密新消息
5. 保留旧密钥用于解密历史消息

### 密钥恢复

```
POST /e2ee/recovery/request
```

**请求参数：**

```json
{
  "keyId": "lost_key_123",
  "recoveryType": "DEVICE_LOSS",
  "reason": "设备丢失需要恢复密钥"
}
```

---

## 灰度发布

### 管理接口（需要管理员权限）

#### 设置全局开关

```bash
POST /e2ee/admin/feature-toggle/global?enabled=true
```

#### 设置灰度百分比

```bash
# 为10%的用户开启E2EE
POST /e2ee/admin/feature-toggle/rollout?percentage=10
```

#### 添加白名单用户

```bash
POST /e2ee/admin/feature-toggle/whitelist/10001
```

#### 检查用户E2EE状态

```bash
GET /e2ee/admin/feature-toggle/check/10001
```

**响应示例：**

```json
{
  "userId": 10001,
  "e2eeEnabled": true,
  "globalEnabled": true,
  "inWhitelist": true,
  "inBlacklist": false,
  "rolloutPercentage": 50
}
```

---

## 监控告警

### 健康检查

```
GET /e2ee/health
```

**响应示例：**

```json
{
  "enabled": true,
  "status": "UP",
  "activeUsers": 1250,
  "activeSessions": 3200,
  "services": {
    "keyService": "UP",
    "messageService": "UP",
    "cacheService": "UP"
  },
  "performance": {
    "encryptionAlgorithm": "AES-GCM",
    "avgEncryptionTime": "12ms",
    "cacheHitRate": "95%"
  }
}
```

### 性能指标

```
GET /e2ee/metrics
```

访问 Prometheus 指标：

```
GET /actuator/prometheus
```

**关键指标：**

- `e2ee_encryption_time` - 加密操作耗时
- `e2ee_decryption_time` - 解密操作耗时
- `e2ee_messages_encrypted_total` - 加密消息总数
- `e2ee_cache_hit_total` - 缓存命中次数
- `e2ee_errors_total` - 错误总数

---

## 常见问题

### Q1: 如何选择加密算法？

**推荐配置**：
- **密钥交换**：RSA-OAEP 2048位
- **消息加密**：AES-256-GCM
- **消息签名**：RSA-PSS with SHA-256（可选）

### Q2: 消息签名是必需的吗？

默认情况下**不是必需的**，但强烈建议在以下场景启用：
- 群组消息
- 高安全要求的对话
- 需要消息不可否认性的场景

配置要求签名：

```yaml
e2ee:
  encryption:
    require-signature: true
```

### Q3: 如何处理密钥过期？

**自动处理**：
- 系统每天凌晨3点自动清理过期密钥
- 过期密钥不会被删除，只标记为无效
- 客户端应定期检查密钥状态并轮换

**手动处理**：

```bash
POST /e2ee/cleanup/keys
```

### Q4: 如何保证消息的前向安全？

启用**临时密钥**和**密钥派生**：

```json
{
  "forwardSecret": true,
  "ephemeralPublicKey": "{dh_public_key}",
  "kdfAlgorithm": "HKDF-SHA256",
  "kdfInfo": "session_context_info"
}
```

### Q5: 支持的最大消息大小是多少？

默认**10MB**，可在配置中调整：

```yaml
e2ee:
  security:
    max-message-size: 10485760  # 10MB in bytes
```

### Q6: 如何查看审计日志？

通过Redis查询：

```bash
# 查看今日审计日志
redis-cli LRANGE e2ee:audit:2025-01-01 0 -1
```

或使用管理接口（待实现）：

```
GET /e2ee/admin/audit/logs?startDate=2025-01-01&action=MESSAGE_ENCRYPT
```

### Q7: 性能优化建议

1. **启用缓存预热**：

```yaml
e2ee:
  cache:
    warmup-enabled: true
    warmup-hot-user-count: 100
```

2. **批量操作**：

```bash
# 批量获取公钥而不是单个请求
POST /e2ee/keys/batch
```

3. **使用Redis集群**：配置Redis主从或集群提高可用性

4. **监控关键指标**：
   - 缓存命中率 > 90%
   - 平均加密延迟 < 100ms
   - 错误率 < 1%

---

## 配置示例

### application-e2ee.yml

```yaml
e2ee:
  # 全局开关
  enabled: true

  # 加密配置
  encryption:
    default-algorithm: AES-GCM
    aes-key-size: 256
    rsa-key-size: 2048
    require-signature: false

  # 密钥管理
  key-management:
    key-validity-days: 365
    key-rotation-days: 90
    auto-rotation: false

  # 缓存配置
  cache:
    enabled: true
    public-key-ttl: 30d
    session-key-ttl: 24h

  # 性能配置
  performance:
    batch-query-max-size: 100
    metrics-enabled: true

  # 安全策略
  security:
    verify-content-hash: true
    replay-detection-enabled: true

  # 审计配置
  audit:
    enabled: true
    retention-days: 90
```

---

## 技术支持

如有问题，请联系：
- 📧 Email: support@hula.com
- 📚 文档: https://docs.hula.com/e2ee
- 🐛 Issue: https://github.com/hula/issues

---

**最后更新时间**: 2025-01-01
**文档版本**: v1.0.0
