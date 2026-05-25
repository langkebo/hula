# Matrix Live E2E 回归测试报告

- **日期**: 2026-05-25
- **测试框架**: Playwright + Vite Dev Server (port 5210)
- **Homeserver**: `https://matrix.test` (synapse-rust)
- **认证策略**: `restore-token`

## 测试账号

| 角色 | User ID | 认证方式 |
|------|---------|---------|
| Primary | `@testuser1:matrix.test` | restore-token |
| Peer | `@apitest1:matrix.test` | restore-token |

## 测试房间

- **Room ID**: `!T7IeDnjuc23vMMjVigXxyrs3:matrix.test`
- **Room Name**: E2E Test Room
- **Seeded Timeline Text**: `E2E seeded timeline verification message`

## 测试结果总览

| # | 测试用例 | 状态 | 耗时 |
|---|---------|------|------|
| 1 | logs in against a live homeserver and opens the message workspace | PASS | - |
| 2 | sends a probe message into the configured encrypted room | PASS | - |
| 3 | loads the configured decrypted timeline sample from the encrypted room | PASS | - |
| 4 | delivers a probe message across two live Matrix accounts | PASS | - |

**总计**: 4 passed, 0 failed (25.4s)

## 详细验证项

### 1. 登录 + 消息工作区 (Test Case 1)

- [x] `restoreWithAccessToken` 通过 `page.evaluate` 成功恢复会话
- [x] `bootstrapAfterRestore: true` 触发 `bootstrapPostLoginState()` 注册 SlidingSync 监听
- [x] Pinia store 初始化 (`__HULA_PINIA_READY__`)
- [x] 路由跳转 `/message` 成功
- [x] `.message-list-page` 和 `.message-session-toolbar` 可见
- [x] 会话列表加载 (`waitForLiveSessions` 通过)

### 2. 探针消息发送 (Test Case 2)

- [x] 登录后打开消息工作区
- [x] 定位并打开配置房间 `!T7IeDnjuc23vMMjVigXxyrs3:matrix.test`
- [x] `sendTextMessageToRoom` 发送探针消息成功，返回有效 `eventId`
- [x] `roomContainsMessage` 轮询确认消息回写到时间线

### 3. 解密时间线校验 (Test Case 3)

- [x] 登录后打开消息工作区
- [x] 打开配置房间
- [x] `roomContainsMessage` 确认 seeded timeline text (`E2E seeded timeline verification message`) 存在于时间线
- [x] 消息同步与解密正常

### 4. 双账号消息收发联调 (Test Case 4)

- [x] 主账号 (`@testuser1:matrix.test`) 和对端账号 (`@apitest1:matrix.test`) 同时登录
- [x] 两个浏览器上下文独立 (`browser.newContext()`)
- [x] 双方均打开消息工作区和配置房间
- [x] 主账号发送探针消息，返回有效 `eventId`
- [x] 对端账号通过 `roomContainsMessage` 轮询确认收到消息
- [x] 跨账号消息投递验证通过

## 关键修复项

本次回归前修复的问题：

1. **`page.evaluate` 引用 Node 侧常量**: `restoreWithAccessToken` 中 `page.evaluate` 回调直接引用 `MATRIX_HOMESERVER_STORAGE_KEY` 等 Node 侧常量，浏览器上下文不可用。修复方式：通过 `options` 参数传递 storage key 字符串值。

2. **`bootstrapAfterRestore: false`**: 之前设为 `false` 导致 `bootstrapPostLoginState()` 被跳过，SlidingSync 监听未注册，会话列表为空。修复为 `true`。

3. **Vite Dev Proxy 端口 5210 未识别**: `shouldUseMatrixDevProxy()` 仅检查端口 `6130`，Playwright 运行在 `5210`。添加 `|| window.location.port === '5210'`。

4. **HTTPS Homeserver URL 未重写**: `shouldRewriteHomeserverToDevProxy()` 未处理 `https://` homeserver 在 `http://` 开发模式下的重写。添加 HTTPS→HTTP 重写规则。

5. **`settlePostLoginStartup()` 静默吞错**: `startClient()` 错误仅以 `warn` 级别记录，添加 `startupError` 追踪和 `logger.error` 输出。

## 环境配置

```
MATRIX_LIVE_E2E=1
MATRIX_LIVE_AUTH_STRATEGY=restore-token
MATRIX_LIVE_HOMESERVER_URL=https://matrix.test
MATRIX_LIVE_APP_URL=http://127.0.0.1:5210
MATRIX_LIVE_USER_ID=@testuser1:matrix.test
MATRIX_LIVE_ROOM_ID=!T7IeDnjuc23vMMjVigXxyrs3:matrix.test
MATRIX_LIVE_EXPECTED_TIMELINE_TEXT=E2E seeded timeline verification message
MATRIX_LIVE_PEER_USER_ID=@apitest1:matrix.test
```

## 结论

Matrix Live E2E 4 用例全部通过，核心功能验证正常：
- 会话恢复与登录流程完整
- 消息发送与时间线回写正常
- 解密时间线加载正常
- 双账号跨设备消息投递正常
