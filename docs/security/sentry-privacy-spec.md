# Sentry 接入隐私脱敏规范 (P2-SEC-03)

> 版本: v1.0.0  
> 状态: **草案**

## 1. 概述

Sentry 用于监控 `hula` 应用的运行时错误和性能瓶颈。由于 IM 应用涉及大量用户私密信息（聊天内容、Token、密钥等），在接入 Sentry 之前必须建立严格的脱敏规范，确保任何敏感数据都不会上传至云端。

## 2. 脱敏原则

- **客户端预处理**: 所有脱敏逻辑必须在客户端（SDK 侧）完成，禁止上传原始数据后在服务端过滤。
- **最小化上报**: 仅上报堆栈跟踪和必要的上下文（如平台版本、OS 类型），禁止上报原始 `event` 对象。
- **白名单机制**: 仅允许预定义的、非敏感的字段进入上下文。

## 3. 具体脱敏规则

### 3.1 核心凭证 (Identity & Auth)
- **Token**: 严禁上报 `access_token`, `refresh_token`。
- **密钥**: 严禁上报 `recovery_key`, `secret_storage_key`。
- **密码**: 严禁上报任何包含 `password`, `pwd` 的字段。

### 3.2 用户隐私 (PII)
- **聊天内容**: 严禁上报消息正文（`body.content`）。
- **个人信息**: 手机号、邮箱、真实姓名必须经过掩码处理（如 `138****6789`）。
- **设备指纹**: 仅上报脱敏后的 `enhancedFingerprint`。

### 3.3 网络请求 (Breadcrumbs)
- **URL**: 仅保留 API 路径，移除所有 Query 参数。
- **Headers**: 移除 `Authorization`, `Cookie`, `Set-Cookie`。
- **Body**: 严禁记录请求体和响应体。

## 4. 技术实现建议 (Vue/Sentry SDK)

使用 `beforeSend` 和 `beforeBreadcrumb` 钩子：

```typescript
import * as Sentry from "@sentry/vue";

Sentry.init({
  beforeSend(event) {
    // 1. 递归清洗 event.extra 和 event.context
    // 2. 使用现有的 Logger.redactObject 逻辑
    return redactEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
      // 移除敏感 Headers 和 URL 参数
      delete breadcrumb.data.headers;
    }
    return breadcrumb;
  }
});
```

## 5. 持续审计

- 每季度进行一次 Sentry 存储审计，确保无敏感数据漏网。
- 凡是新增的核心 Service 逻辑，必须同步更新脱敏白名单。
