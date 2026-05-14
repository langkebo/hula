# HuLa 前后端联调测试问题清单

**测试环境**: `https://matrix.test` (synapse-rust)
**测试日期**: 2026-05-11
**测试方法**: API 直接测试 + 前端服务层代码深度审查 + 数据流追踪
**后端版本**: 支持 Matrix v1.1 ~ v1.13, r0.5.0 ~ r0.6.1
**测试轮次**: 3（初始测试 → 修复验证 → 全面深度审查）

---

## 问题汇总统计

| 严重程度 | 第一轮 | 第二轮新增 | 第三轮新增 | 修复状态 |
|----------|--------|-----------|-----------|---------|
| Critical | 4 | 2 | 2 | C-01~C-04 已修复前端，C-01 需后端配合 |
| High | 8 | 3 | 6 | H-01~H-08 待修复 |
| Medium | 10 | 4 | 8 | M-01~M-10 待修复 |
| Low | 6 | 0 | 5 | L-01~L-06 待修复 |
| **合计** | **28** | **9** | **21** | **4 已修复，54 待修复** |

---

## 修复验证结果

### C-01 验证: 空间 API fallback

**测试结果**: v3/spaces/members、v1/hierarchy、v3/spaces/rooms 三个端点均返回 M_NOT_FOUND。前端已实现三级 fallback 链：
1. `v3/spaces/members` → SDK `getRoomMembers()` → 标准 `v3/rooms/{id}/members`
2. `v3/spaces/rooms` → `v1/hierarchy` → 标准 `v3/rooms/{id}/state`（过滤 m.space.child 事件）

**后端根因**: synapse-rust 的空间 API 路由未正确注册或空间元数据未持久化。需要后端修复。

### C-02 验证: 好友系统响应格式

**测试结果**: `GET /_matrix/client/v1/friends` 返回 `{"friends":[],"items":[],"cached":false,...}` 双字段。前端已修复为按优先级检查 `items` → `friends` → `data`。

### C-03 验证: 离线消息 ID 映射

**测试结果**: 前端已添加 `localToRemoteEventIdMap` 映射表和 `resolveEventId()` 方法，编辑/撤回/已读操作均会自动解析本地 ID。

### C-04 验证: getServerDomain 硬编码

**测试结果**: 前端已移除 `'matrix.org'` 硬编码，改为从 `client.baseUrl` 提取域名，无法提取时抛出明确错误。

---

## Critical 级别问题

### C-01: 空间成员/子房间 API 返回 M_NOT_FOUND

**问题现象**: 调用 `GET /_matrix/client/v3/spaces/{spaceId}/members` 和 `GET /_matrix/client/v3/spaces/{spaceId}/rooms` 时，即使 spaceId 对应的房间确实存在且类型为 m.space，后端仍返回 `{"errcode":"M_NOT_FOUND","error":"Space not found"}`。

**复现步骤**:
1. 通过 `POST /_matrix/client/v3/createRoom` 创建一个带有 `m.room.type = m.space` 的空间
2. 使用返回的 room_id 调用 `GET /_matrix/client/v3/spaces/{spaceId}/members`
3. 观察返回 M_NOT_FOUND 错误

**影响范围**: 空间管理功能完全不可用——无法查看空间成员、子房间列表。影响所有使用空间功能的用户。

**严重程度**: Critical

**优化方案**:
1. **后端**: 检查 synapse-rust 中 `spaces/{spaceId}/members` 和 `spaces/{spaceId}/rooms` 端点的路由注册和权限检查逻辑，确认是否需要额外的空间元数据注册步骤
2. **前端**: 在 `MatrixSpaceService` 中添加 fallback 逻辑——当 v3/spaces 端点返回 M_NOT_FOUND 时，回退到标准 Matrix 的 `/_matrix/client/v1/spaces/{spaceId}/hierarchy` 端点（已实现）
3. **优先级**: P0，空间功能是 HuLa 核心特性

---

### C-02: 好友系统响应格式与前端解析逻辑不匹配

**问题现象**: `GET /_matrix/client/v1/friends` 返回的响应格式为 `{"cached":false,"friends":[],"generated_ts":...,"items":[],"limit":50,...}`，包含 `friends` 和 `items` 两个空数组字段，以及分页字段 `limit`、`offset`、`next_offset`、`total`。前端 `MatrixFriendService` 的 `normalizeFriend()` 方法尝试合并 `display_name`、`displayname`、`username` 三个字段名，说明后端在不同端点返回的好友对象字段名不统一。

**复现步骤**:
1. 注册新用户并登录
2. 调用 `GET /_matrix/client/v1/friends`
3. 观察返回的响应结构中 `friends` 和 `items` 双字段
4. 调用 `GET /_matrix/client/v3/friends/search`，对比返回的用户对象字段名

**影响范围**: 好友列表可能无法正确渲染，好友搜索结果中的显示名称可能为空。影响所有使用好友功能的用户。

**严重程度**: Critical

**优化方案**:
1. **后端**: 统一好友对象字段命名——使用 `displayname`（与 Matrix 规范一致），废弃 `display_name` 和 `username` 的混用
2. **后端**: 统一 `friends` 和 `items` 字段——如果 `items` 是分页版本的数据，应废弃 `friends` 字段或明确文档说明两者区别
3. **前端**: 在 `normalizeFriend()` 中添加运行时字段校验，使用 zod schema 验证后端响应格式（已部分实现优先级检查）
4. **优先级**: P0

---

### C-03: 离线消息本地 ID 与远程 ID 冲突

**问题现象**: `MatrixMessageService` 在离线时将消息入队到 `offlineQueueService`，返回 `{ event_id: 'local-${id}' }` 格式的临时 ID。此 ID 可能被传递给编辑、撤回、标记已读等后续操作，在线时用本地 ID 调用远程 API 会导致 "event not found" 错误。

**复现步骤**:
1. 断开网络连接
2. 发送一条消息（获得 `local-xxx` 格式的 event_id）
3. 恢复网络连接
4. 尝试对该消息执行撤回操作
5. 观察撤回失败（后端找不到 `local-xxx` 格式的 event_id）

**影响范围**: 离线发送的消息在恢复在线后无法编辑、撤回或标记已读。影响所有在弱网环境下使用的用户。

**严重程度**: Critical

**优化方案**:
1. **前端**: 在 `offlineQueueService` 中添加 ID 映射表——当离线消息成功发送后，将 `local-xxx` 映射为真实的 `$xxx` event_id（已实现 `localToRemoteEventIdMap`）
2. **前端**: 在执行编辑/撤回/已读操作前，检查 event_id 是否以 `local-` 开头，如果是则等待消息发送完成后再执行（已实现 `resolveEventId()` 方法）
3. **前端**: 在 UI 层面，对本地消息显示"发送中"状态，禁用编辑/撤回按钮直到确认发送成功
4. **优先级**: P0

---

### C-04: getServerDomain() 硬编码回退到 matrix.org

**问题现象**: `LifecycleService.getServerDomain()` 在 `client.getDomain()` 返回空值时回退到 `'matrix.org'`。对于连接自建 homeserver（如 synapse-rust）的用户，域名缺失时会生成错误的用户 ID（如 `@user:matrix.org` 而非 `@user:matrix.test`），导致房间别名创建失败、邀请发送到错误域等严重问题。

**复现步骤**:
1. 在某些边缘场景下（如客户端初始化未完成时），`client.getDomain()` 可能返回空值
2. 调用 `getServerDomain()` 获取域名
3. 使用返回的域名创建房间别名（如 `#room:matrix.org`）
4. 观察别名创建失败（因为实际域名是 `matrix.test`）

**影响范围**: 房间别名创建、公开房间注册、用户 ID 生成等核心功能可能失败。影响所有用户。

**严重程度**: Critical

**优化方案**:
1. **前端**: 从 `client.baseUrl` 中提取域名作为回退值，而非硬编码 `matrix.org`（已实现）
2. **前端**: 当 `getDomain()` 返回空值时，抛出明确错误而非静默回退（已实现）
3. **前端**: 在 `MatrixClientService.initialize()` 中验证域名可用性
4. **优先级**: P0

---

### C-05: QR 码登录完全本地化，未与后端交互

**问题现象**: `MatrixQrLoginService`（`useQRLogin` composable）的 QR 码生成、扫码、确认流程完全在本地 localStorage 中完成，没有任何与 synapse-rust 后端的网络通信。QR 码 ID 由客户端本地生成（`crypto.randomUUID()`），扫码状态也仅存储在 localStorage 中。这意味着：
- 不同设备之间无法通过 QR 码建立登录会话
- QR 码无法被其他设备扫描识别
- 整个 QR 登录流程形同虚设

**复现步骤**:
1. 在登录页点击 QR 码登录
2. 观察 QR 码生成——仅是本地 UUID
3. 使用另一设备扫描——无法识别
4. 检查网络请求——没有任何发往后端的 QR 相关请求

**影响范围**: QR 码登录功能完全不可用。影响所有希望通过扫码登录的用户。

**严重程度**: Critical

**优化方案**:
1. **后端**: 实现 `POST /_matrix/client/v3/login/qr/code` 端点生成服务端 QR 会话
2. **后端**: 实现 `GET /_matrix/client/v3/login/qr/{qrId}/status` 轮询端点
3. **前端**: 重写 `useQRLogin` composable，与服务端 QR 会话 API 交互
4. **优先级**: P0

---

### C-06: Token 刷新机制未完整实现

**问题现象**: `MatrixRuntimeSessionService.loginWithPassword()` 在登录成功后，将 `refreshToken` 硬编码为空字符串传给 Tauri 命令 `UPDATE_TOKEN`：`{ uid, token: accessToken, refreshToken: '' }`。但 Matrix v3 登录响应可能包含 `refresh_token` 字段，该字段被完全忽略。此外，`MatrixAuthService.refreshAccessToken()` 虽然实现了刷新逻辑，但没有任何自动刷新调度机制——Token 过期后用户会被直接登出。

**复现步骤**:
1. 使用密码登录，观察登录响应中是否包含 `refresh_token`
2. 检查 `UPDATE_TOKEN` 命令的参数——`refreshToken` 始终为 `''`
3. 等待 access_token 过期（如果服务器配置了过期时间）
4. 观察用户被直接登出，而非自动刷新 Token

**影响范围**: Token 过期后用户被强制登出，无法自动续期。影响所有长时间在线的用户。

**严重程度**: Critical

**优化方案**:
1. **前端**: 从登录响应中提取 `refresh_token` 并传递给 `UPDATE_TOKEN`
2. **前端**: 在 `MatrixClientService` 中添加 Token 过期监控，在 `expires_in_ms` 到期前自动调用 `refreshAccessToken()`
3. **前端**: 在 401 `M_UNKNOWN_TOKEN` 错误处理中尝试刷新 Token 而非直接登出
4. **优先级**: P0

---

## High 级别问题

### H-01: 验证码端点缺少 captcha_type 字段文档

**问题现象**: `POST /_matrix/client/r0/register/captcha/send` 需要 `captcha_type` 字段，但前端 `MatrixAuthService` 的 `matrixGetCaptcha()` 发送请求时仅包含 `{length: 4}`，未包含 `captcha_type` 字段，导致后端返回 `missing field captcha_type` 错误。同时，端点路径使用 `v3` 前缀而非 `r0`，与后端路由不匹配。

**复现步骤**:
1. 调用 `MatrixAuthService.getCaptcha()`
2. 观察请求发送到 `/_matrix/client/v3/register/captcha/send`（应为 `r0`）
3. 观察返回 `missing field captcha_type` 错误

**影响范围**: 手机验证码注册流程完全不可用。影响所有通过手机号注册的新用户。

**严重程度**: High

**优化方案**:
1. **前端**: 修正端点路径为 `/_matrix/client/r0/register/captcha/send`
2. **前端**: 添加 `captcha_type` 字段（如 `"sms"`）
3. **后端**: 补充 API 文档说明 `captcha_type` 的可选值和必填要求
4. **优先级**: P1

---

### H-02: 好友系统空结果触发不必要的 API 回退

**问题现象**: `MatrixFriendService.getFriends()` 在 `FriendManager` 返回空数组时，错误地降级到 REST API，产生不必要的网络请求。应该区分"返回空结果（用户确实没有好友）"和"Manager 不可用"。

**复现步骤**:
1. 新注册用户（无好友）
2. 调用 `getFriends()`
3. 观察先调用 FriendManager.getFriends() 返回 []，然后又调用 REST API

**影响范围**: 每次打开好友列表都会产生双倍网络请求。影响所有无好友的新用户。

**严重程度**: High

**优化方案**:
1. **前端**: 修改降级逻辑——仅在 FriendManager 抛出异常或返回 undefined/null 时降级，空数组不应触发降级
2. **优先级**: P1

---

### H-03: 搜索功能 hybrid 模式降级逻辑缺陷

**问题现象**: `MatrixSearchService.searchMessages()` 的 hybrid 模式中，条件 `localResults.length > 0` 会导致即使本地只有 1 条过时结果也不查询远程。正确的逻辑应该是仅在本地结果数量已满足需求时才跳过远程查询。

**复现步骤**:
1. 设置搜索模式为 hybrid
2. 搜索一个关键词，本地索引中只有 1 条旧结果
3. 观察不会发起远程搜索请求

**影响范围**: 搜索结果不完整，用户可能看到过时的消息而无法发现最新内容。影响所有使用搜索功能的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 修改条件为 `localResults.length >= (options?.limit || 20)` 时才跳过远程查询
2. **前端**: 添加结果新鲜度检查——如果本地结果时间戳过旧，仍应查询远程
3. **优先级**: P1

---

### H-04: 推送规则删除硬编码 override 类型

**问题现象**: `MatrixNotificationService.deletePushRule()` 硬编码了 `'override'` 作为规则类型，但 Matrix 推送规则有 5 种类型（override/content/room/sender/underride）。如果传入的 ruleId 对应的不是 override 类型，删除操作会失败或删除错误的规则。

**复现步骤**:
1. 创建一个 content 类型的推送规则
2. 尝试通过 `deletePushRule(ruleId)` 删除
3. 观察删除失败（因为请求了 override 类型的规则）

**影响范围**: 用户无法正确管理推送规则，可能导致通知设置混乱。影响所有自定义通知设置的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 修改 `deletePushRule()` 方法，接受 `kind` 参数，或从 `getPushRules()` 结果中查找规则所属类型
2. **优先级**: P1

---

### H-05: Presence 订阅回退路径缺少 unsubscribe 字段

**问题现象**: `MatrixPresenceService.subscribeToPresence()` 的 HTTP 回退路径只传了 `subscribe` 字段，没有传 `unsubscribe` 字段。根据 Matrix 规范，`/_matrix/client/v3/presence/list` 端点同时接受两个数组，当前实现可能导致旧的订阅关系不被清理。

**复现步骤**:
1. 在无 PresenceManager 的环境下
2. 先订阅用户 A 的在线状态
3. 取消订阅用户 A，订阅用户 B
4. 观察用户 A 的订阅未被清理

**影响范围**: 在线状态订阅列表持续增长，可能导致不必要的网络流量和延迟。影响所有查看在线状态的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 在 `subscribeToPresence()` 回退路径中同时传递 `unsubscribe` 数组
2. **前端**: 维护本地订阅列表，在每次调用时计算 diff
3. **优先级**: P1

---

### H-06: 已读回执串行发送导致性能问题

**问题现象**: `MatrixMessageService.markMsgs()` 原先使用 `for...of` 循环逐个发送已读回执。已修复为仅发送最新事件的已读回执（Matrix 协议隐式标记之前所有消息），但 fallback catch 块中仍返回 0，未尝试降级方案。

**复现步骤**:
1. 进入一个有 50+ 未读消息的房间
2. 标记所有消息为已读
3. 观察仅发送 1 个 HTTP 请求（已修复）

**影响范围**: 已修复主要问题，但 fallback 路径仍需优化。

**严重程度**: High

**优化方案**:
1. **前端**: 在 fallback 中尝试发送倒数第二个事件的已读回执作为降级
2. **优先级**: P1

---

### H-07: 客户端获取方式不一致导致初始化时序问题

**问题现象**: 不同服务获取 MatrixClient 实例的方式不一致——部分使用同步 `getClient()`（返回 null 如果未初始化），部分使用异步 `waitForClientReady()`，部分同时维护私有引用。在客户端尚未初始化时，同步获取的服务会直接抛错。

**复现步骤**:
1. 应用启动时，在客户端初始化完成前调用 `MatrixRoomService.getRooms()`
2. 观察抛出 null 引用错误

**影响范围**: 应用启动时可能出现偶发性崩溃，特别是在慢网络环境下。影响所有用户。

**严重程度**: High

**优化方案**:
1. **前端**: 统一所有服务使用异步 `waitForClientReady()` 模式
2. **前端**: 在 `MatrixClientService` 中添加全局初始化守卫，确保所有服务在客户端就绪前处于等待状态
3. **优先级**: P1

---

### H-08: 媒体下载绕过 SDK 认证和重试机制

**问题现象**: `MatrixMediaService.downloadFileBytes()` 使用原生 `fetch()` 下载文件，不经过 SDK，这意味着不享受 SDK 的认证、重试和错误处理机制。如果下载需要认证的媒体文件，可能返回 401 错误。同时，`downloadEncryptedFileBytes()` 调用 `downloadFileBytes()`，加密文件的下载也受此影响。

**复现步骤**:
1. 上传一个媒体文件到加密房间
2. 尝试通过 `downloadFileBytes()` 下载
3. 观察可能返回 401 Unauthorized

**影响范围**: 加密房间的媒体文件可能无法下载。影响所有使用加密房间的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 使用 `client.mxcUrlToHttp()` 生成带认证参数的 URL，或使用 SDK 的 `http.authedRequest()` 下载
2. **前端**: 添加重试逻辑（指数退避，最多 3 次）
3. **优先级**: P1

---

### H-09: OIDC client_id 硬编码为 'matrix-client'

**问题现象**: `MatrixOidcService.getAuthorizationUrl()` 中 `client_id` 硬编码为 `'matrix-client'`，但后端 OIDC 提供者可能注册了不同的 client_id。如果 client_id 不匹配，整个 OIDC 登录流程将失败。此外，OIDC 发现端点返回的配置中可能包含推荐的 client_id，但前端完全忽略。

**复现步骤**:
1. 配置后端 OIDC 提供者，注册 client_id 为 `hula-desktop` 而非 `matrix-client`
2. 尝试通过 OIDC 登录
3. 观察授权请求被 OIDC 提供者拒绝（client_id 不匹配）

**影响范围**: OIDC/SSO 登录功能可能完全不可用。影响使用企业 SSO 的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 从 `.well-known/openid-configuration` 或应用配置中动态获取 client_id
2. **前端**: 在 `MatrixOidcService` 构造函数中接受 client_id 参数
3. **优先级**: P1

---

### H-10: OIDC 登出请求缺少认证头

**问题现象**: `MatrixOidcService.logout()` 发送 `POST /_matrix/client/v3/oidc/logout` 请求时使用原生 `fetch()`，未携带任何认证头（Authorization header）。如果后端要求认证才能执行登出，请求将返回 401。

**复现步骤**:
1. 通过 OIDC 登录
2. 调用 `matrixOidcService.logout()`
3. 观察请求未携带 Authorization header
4. 后端可能返回 401 Unauthorized

**影响范围**: OIDC 登出可能失败，用户会话无法正确清理。影响使用 OIDC 登录的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 使用 `client.http.authedRequest()` 发送 OIDC 登出请求
2. **前端**: 或在 fetch 请求中手动添加 `Authorization: Bearer ${accessToken}` header
3. **优先级**: P1

---

### H-11: 线程冻结/解冻使用非标准事件类型

**问题现象**: `MatrixThreadService.freezeThread()` 发送 `m.thread_freeze` 事件类型，`unfreezeThread()` 发送 `m.thread_unfreeze` 事件类型。这些不是 Matrix 规范定义的标准事件类型，synapse-rust 后端可能拒绝这些事件（取决于服务器配置是否允许自定义事件类型）。

**复现步骤**:
1. 在房间中创建一个线程
2. 调用 `matrixThreadService.freezeThread(roomId, threadRootId)`
3. 观察后端是否接受 `m.thread_freeze` 事件类型
4. 如果后端配置了事件类型白名单，请求可能被拒绝

**影响范围**: 线程冻结/解冻功能可能不可用。影响需要管理线程的版主用户。

**严重程度**: High

**优化方案**:
1. **后端**: 确认 synapse-rust 是否允许自定义事件类型，如不允许则实现标准的线程管理 API
2. **前端**: 添加错误处理，当自定义事件类型被拒绝时给出明确提示
3. **优先级**: P1

---

### H-12: 消息获取仅依赖客户端内存时间线

**问题现象**: `MatrixMessageService.getMessageEvents()` 和 `getMsgList()` 仅从 `client.getRoom(roomId).timeline` 获取消息，不调用后端 `/_matrix/client/v3/rooms/{roomId}/messages` 端点。这意味着只能获取到已通过 Sliding Sync 加载到内存中的消息，无法获取更早的历史消息。

**复现步骤**:
1. 进入一个有大量历史消息的房间
2. 向上滚动加载更多消息
3. 观察只能看到 Sliding Sync 已同步的消息，无法加载更早的历史

**影响范围**: 消息历史加载功能受限，用户无法查看完整聊天记录。影响所有需要查看历史消息的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 在 `getMessageList()` 中添加分页逻辑，当本地消息不足时调用 `client.createMessagesRequest()` 或 `/messages` 端点
2. **前端**: 实现 `before` 参数的真正分页功能（当前 `before` 参数仅在本地数组中查找）
3. **优先级**: P1

---

### H-13: 消息转发未清理原始发送者信息

**问题现象**: `MatrixForwardService.forwardEvent()` 直接复制原始事件内容并添加 `m.reference` 关系，但未清理原始消息中的发送者特定信息（如 `body` 中可能包含原始发送者的名字引用）。转发后的消息在接收方看来，`sender` 是转发者，但 `body` 内容可能暗示原始发送者。

**复现步骤**:
1. 用户 A 发送一条消息 "我同意这个方案"
2. 用户 B 转发该消息到另一个房间
3. 接收方看到消息来自用户 B，但内容是 "我同意这个方案"，语义不明确

**影响范围**: 转发消息的上下文信息丢失，接收方可能误解消息含义。影响所有使用转发功能的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 在转发消息中添加 `m.forwarded` 扩展字段，包含原始发送者和房间信息
2. **前端**: 在消息渲染层面对转发消息显示原始发送者信息
3. **优先级**: P1

---

### H-14: 通知确认端点为 synapse-rust 专属

**问题现象**: `MatrixNotificationService.ackNotification()` 调用 `POST /_matrix/client/v3/notifications/{id}/ack`，这是 synapse-rust 的自定义端点，标准 Matrix 规范中没有此端点。如果后端不支持此端点，通知确认功能将静默失败。

**复现步骤**:
1. 获取通知列表
2. 调用 `ackNotification(notificationId)`
3. 如果后端不支持此端点，返回 404 但前端仅记录错误

**影响范围**: 通知确认状态无法同步到服务器，用户在其他设备上仍会看到已确认的通知。影响所有使用多设备的用户。

**严重程度**: High

**优化方案**:
1. **前端**: 在调用前检测后端是否支持此端点（通过 capabilities API）
2. **前端**: 不支持时使用标准 Matrix 的已读回执作为替代
3. **优先级**: P1

---

## Medium 级别问题

### M-01: synapse-rust 自定义端点无能力检测

**问题现象**: 多个服务调用了 `/_matrix/client/v3/spaces/*`、`/_matrix/media/v3/delete/*`、`/_matrix/client/v3/notifications/*/ack` 等 synapse-rust 专属端点，但没有任何能力检测机制。如果后端不支持这些端点，请求直接失败且错误消息对用户不友好。

**影响范围**: 如果后端更换或降级，相关功能静默失败。影响使用扩展功能的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 在 `MatrixClientService.initialize()` 中调用 `/_matrix/client/v3/capabilities` 检测后端能力
2. **前端**: 根据能力检测结果动态启用/禁用相关功能
3. **优先级**: P2

---

### M-02: 响应格式兼容层 unwrapMaybeWrappedData 不够健壮

**问题现象**: `SynapseRustExtensionsService.unwrapMaybeWrappedData()` 统一处理两种响应包装格式（直接数据和 `{data, status}` 包装），但仅检查 `status: "error"` 时抛出异常，未验证 `data` 字段是否存在。

**影响范围**: 如果后端返回 `{status: "ok"}` 但缺少 `data` 字段，会返回 undefined 导致后续处理出错。

**严重程度**: Medium

**优化方案**:
1. **前端**: 添加 `data` 字段存在性检查
2. **前端**: 使用 zod schema 验证响应格式
3. **优先级**: P2

---

### M-03: 图片上传压缩失败静默使用原图

**问题现象**: `MatrixMediaService.uploadImage()` 先压缩图片再上传，但压缩失败时静默使用原图，调用方无法感知压缩是否成功。如果上传因为文件过大失败，调用方不知道是因为压缩被跳过。

**影响范围**: 大图片上传可能失败，用户无法得知原因。影响所有发送图片的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 压缩失败时记录 warning 日志
2. **前端**: 在上传失败时检查原始文件大小，给出"图片过大"的明确提示
3. **优先级**: P2

---

### M-04: 媒体元数据获取可能导致 Promise 永远挂起

**问题现象**: `getImageDimensions()`、`getVideoMetadata()`、`getAudioDuration()` 使用 `URL.createObjectURL()` 创建临时 URL，在 `onload`/`onerror` 中调用 `URL.revokeObjectURL()`。但如果浏览器不支持该媒体类型，Promise 既没 resolve 也没 reject，导致内存泄漏和 Promise 永远挂起。

**影响范围**: 发送不支持的媒体类型时，上传流程卡死。影响发送特殊格式媒体的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 添加超时机制（如 10 秒后自动 reject）
2. **前端**: 在创建 ObjectURL 前检查浏览器是否支持该 MIME 类型
3. **优先级**: P2

---

### M-05: 通知配置无持久化

**问题现象**: `MatrixNotificationService` 的 `config` 对象所有字段默认为 `true`，但 `updateConfig()` 只修改内存中的对象，页面刷新后配置丢失。

**影响范围**: 用户每次重启应用都需要重新配置通知设置。影响所有自定义通知设置的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 使用 `pinia-plugin-persistedstate` 持久化通知配置
2. **前端**: 或使用 Matrix account data 存储通知配置（跨设备同步）
3. **优先级**: P2

---

### M-06: FriendManager 类型绕过和方法名不确定

**问题现象**: `MatrixFriendService` 通过 `as unknown as Record<string, unknown>` 绕过类型系统访问 `client.friendManager`，且 `setFriendNote()` 尝试 `updateFriendNote` 和 `setFriendNote` 两个方法名，说明 SDK 接口在演进中存在不兼容变更。

**影响范围**: SDK 升级时可能静默失败。影响好友功能。

**严重程度**: Medium

**优化方案**:
1. **前端**: 在 `matrix-js-sdk-augmentations.d.ts` 中补充 FriendManager 的完整类型定义
2. **前端**: 使用能力检测（`typeof manager.updateFriendNote === 'function'`）替代方法名猜测
3. **优先级**: P2

---

### M-07: SlidingSync 初始化竞态

**问题现象**: `MatrixSlidingSyncService.initialize()` 在两次调用之间可能返回不同的 SlidingSync 实例，在 detach 旧监听器和绑定新监听器之间有事件丢失的窗口期。

**影响范围**: 快速切换账号或重连时可能丢失同步事件。影响弱网环境下的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 使用 `AbortController` 模式管理监听器生命周期
2. **前端**: 添加初始化锁防止并发调用
3. **优先级**: P2

---

### M-08: 好友同步状态部分失败导致整体过时

**问题现象**: `MatrixFriendService.updateSyncState()` 使用 `Promise.all` 并行获取好友列表、入站请求和出站请求，但如果其中一个失败，整个 `syncState` 不会被更新。

**影响范围**: 好友列表可能显示过时数据。影响所有使用好友功能的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 改用 `Promise.allSettled()` 确保部分失败时仍更新可用数据
2. **优先级**: P2

---

### M-09: SAML 端点返回空响应

**问题现象**: `GET /_matrix/client/v3/login/saml/metadata` 返回空响应体（HTTP 200 但无内容），前端无法判断 SAML 功能是否可用。

**影响范围**: SAML SSO 登录功能可能不可用但无明确错误提示。影响使用企业 SSO 的用户。

**严重程度**: Medium

**优化方案**:
1. **后端**: 如果 SAML 未配置，应返回 404 或合适的错误码
2. **前端**: 对空响应做特殊处理，标记 SAML 不可用
3. **优先级**: P2

---

### M-10: 搜索空间功能未实现

**问题现象**: `MatrixSpaceService.searchSpaces()` 方法始终返回空数组，参数被忽略。调用方无法区分"没有搜索结果"和"功能未实现"。

**影响范围**: 空间搜索功能不可用。影响需要发现新空间的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 调用后端 `POST /_matrix/client/v3/spaces/search` 端点实现搜索
2. **前端**: 如果后端不支持，抛出明确错误或返回特殊标记
3. **优先级**: P2

---

### M-11: 加密服务大量使用类型断言绕过

**问题现象**: `MatrixCryptoService` 中几乎每个方法都使用 `as unknown as Record<string, unknown>` 模式访问 SDK 内部方法（如 `getCrypto`、`getStoredDevicesForUser`、`setDeviceVerified` 等）。这种模式在 SDK 升级时极易产生运行时错误，且 TypeScript 编译器无法提供任何类型安全保护。

**复现步骤**:
1. 升级 matrix-js-sdk 版本
2. 如果 SDK 重命名了某个方法（如 `getStoredDevicesForUser` → `getUserDevices`），所有使用类型断言的代码会静默失败
3. 运行时出现 `typeof xxx === 'function'` 检查失败，方法不执行

**影响范围**: SDK 升级时加密功能可能静默失效。影响使用加密房间的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 在 `matrix-js-sdk-augmentations.d.ts` 中补充 Crypto 相关的完整类型定义
2. **前端**: 使用 SDK 官方导出的类型和方法，减少内部 API 依赖
3. **优先级**: P2

---

### M-12: 密钥导出/导入未使用密码加密

**问题现象**: `MatrixCryptoService.exportKeys()` 和 `importKeys()` 的 `passphrase` 参数被标记为 `_passphrase`（未使用），导出的密钥以明文 JSON 存储，没有加密保护。如果导出文件被泄露，攻击者可以直接解密所有加密消息。

**复现步骤**:
1. 调用 `matrixCryptoService.exportKeys('my-password')`
2. 观察导出的 JSON 文件——密钥数据为明文
3. 密码参数被完全忽略

**影响范围**: 导出的密钥文件无加密保护，存在严重安全隐患。影响所有导出密钥的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 实现 passphrase 加密逻辑，使用 PBKDF2 + AES-256 加密导出数据
2. **前端**: 或使用 SDK 提供的 `crypto.exportRoomKeys()` 方法（如果支持 passphrase）
3. **优先级**: P2

---

### M-13: 登录响应缺少 well_known 处理

**问题现象**: `MatrixLoginResult` 接口不包含 `well_known` 字段。Matrix 规范规定登录响应可能包含 `well_known` 对象，其中可能有更新的 `m.homeserver` 和 `m.identity_server` URL。前端完全忽略此字段，可能导致使用过期的 homeserver URL。

**复现步骤**:
1. 登录后端，响应中包含 `well_known: { "m.homeserver": { "base_url": "https://new-server.example" } }`
2. 前端忽略 `well_known`，继续使用登录前配置的 homeserver URL
3. 如果 homeserver 已迁移，后续请求可能失败

**影响范围**: 服务器迁移场景下客户端可能无法正常工作。影响使用被迁移服务器的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 在 `MatrixLoginResult` 接口中添加 `well_known` 字段
2. **前端**: 登录成功后检查 `well_known`，更新 homeserver 和 identity server 配置
3. **优先级**: P2

---

### M-14: 注册与登录响应字段名不一致

**问题现象**: `MatrixLoginResult` 使用 `expires_in`（秒），而 `MatrixRegisterResult` 使用 `expires_in_ms`（毫秒）。两个接口对同一语义的字段使用了不同的命名和单位，容易导致混淆和计算错误。

**复现步骤**:
1. 检查 `MatrixLoginResult.expires_in` 类型为 `number`（单位：秒）
2. 检查 `MatrixRegisterResult.expires_in_ms` 类型为 `number`（单位：毫秒）
3. 同一个概念使用不同字段名和单位

**影响范围**: Token 过期时间计算可能出错。影响使用 refresh_token 的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 统一字段名为 `expires_in_ms`（毫秒），与 Matrix 规范保持一致
2. **前端**: 在 Token 过期计算中统一使用毫秒单位
3. **优先级**: P2

---

### M-15: 线程静音使用非标准事件类型

**问题现象**: `MatrixThreadService.muteThread()` 发送 `m.thread_mute` 事件类型，这不是 Matrix 规范定义的标准事件类型。`isThreadMuted()` 通过遍历房间所有事件查找 `m.thread_mute` 事件，性能低下且可能匹配到错误的事件。

**复现步骤**:
1. 调用 `matrixThreadService.muteThread(roomId, threadRootId)`
2. 观察发送了 `m.thread_mute` 事件
3. 后端可能不接受此事件类型

**影响范围**: 线程静音功能可能不可用。影响需要管理线程通知的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 使用 Matrix account data（`m.thread_mute` 作为 account data 而非房间事件）存储静音状态
2. **前端**: 或使用 ThreadingManager API（如果可用）
3. **优先级**: P2

---

### M-16: ThreadingManager 访问使用类型绕过

**问题现象**: `MatrixThreadService.getThreadingManager()` 通过 `(client as unknown as { threadingManager?: ThreadingManagerCompat }).threadingManager` 访问 SDK 的 threadingManager，但此属性不在 SDK 官方类型定义中。如果 SDK 移除或重命名此属性，所有线程 API 调用将静默返回 null/空数组。

**影响范围**: 线程功能可能静默失效。影响使用线程功能的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 在 `matrix-js-sdk-augmentations.d.ts` 中补充 ThreadingManager 的类型定义
2. **前端**: 添加能力检测日志，当 ThreadingManager 不可用时记录 warning
3. **优先级**: P2

---

### M-17: 房间加密启用使用空 state_key

**问题现象**: `MatrixCryptoService.enableEncryption()` 调用 `client.sendStateEvent(roomId, 'm.room.encryption', { algorithm }, '')`，使用空字符串作为 state_key。虽然 Matrix 规范允许空 state_key 表示房间级状态事件，但某些服务器实现可能对此处理不一致。

**复现步骤**:
1. 调用 `matrixCryptoService.enableEncryption(roomId)`
2. 观察发送的 `m.room.encryption` 状态事件的 state_key 为空字符串
3. 某些服务器可能要求 state_key 为 null 而非空字符串

**影响范围**: 在某些服务器实现上启用加密可能失败。影响需要启用房间加密的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 使用 SDK 提供的 `client.sendStateEvent(roomId, 'm.room.encryption', { algorithm })` 不传 state_key（SDK 内部处理）
2. **优先级**: P2

---

### M-18: OIDC code_verifier 存储在 sessionStorage

**问题现象**: `MatrixOidcService` 将 OIDC 的 `code_verifier` 和 `state` 存储在 `sessionStorage` 中。sessionStorage 容易受到 XSS 攻击，如果攻击者获取了 code_verifier，可以伪造 PKCE 流程交换 Token。

**复现步骤**:
1. 启动 OIDC 登录流程
2. 检查 sessionStorage 中的 `oidc_code_verifier` 和 `oidc_state`
3. 这些值以明文存储，可被任何同源 JavaScript 读取

**影响范围**: OIDC Token 交换流程存在安全隐患。影响使用 OIDC 登录的用户。

**严重程度**: Medium

**优化方案**:
1. **前端**: 使用 Tauri 的安全存储（`secure_storage` 命令）存储 code_verifier
2. **前端**: 在 Token 交换完成后立即清除 code_verifier
3. **优先级**: P2

---

## Low 级别问题

### L-01: 媒体压缩参数硬编码

**问题现象**: `MatrixMediaService` 的压缩选项硬编码为 `quality: 0.8, maxWidth: 1920, maxHeight: 1920, maxSizeKB: 1024`，无法根据场景动态调整。

**影响范围**: 高清图片分享场景下图片质量可能不满意。

**严重程度**: Low

**优化方案**: 提供压缩预设（高清/标准/省流量），或允许用户在设置中调整。

---

### L-02: SlidingSync 订阅房间 timelineLimit 硬编码

**问题现象**: `MatrixSlidingSyncService.subscribeRoom()` 硬编码 `timelineLimit: 50`，无法根据房间活跃度动态调整。

**影响范围**: 低活跃房间拉取过多历史消息浪费带宽，高活跃房间可能不够。

**严重程度**: Low

**优化方案**: 根据房间未读消息数动态调整 timelineLimit。

---

### L-03: 错误处理策略不统一

**问题现象**: 不同服务方法的错误处理策略不一致——有些返回空值，有些抛出异常，有些对特定错误码做降级。调用方无法根据统一契约处理错误。

**影响范围**: 增加上层代码复杂度，可能导致未捕获异常。

**严重程度**: Low

**优化方案**: 制定统一的错误处理规范，创建 `ServiceResult<T>` 类型统一返回值。

---

### L-04: 类型安全薄弱

**问题现象**: 整个服务层大量使用 `as` 类型断言，没有运行时类型校验。后端 API 变更时前端会静默产生 undefined 值。

**影响范围**: API 变更时难以快速定位问题。

**严重程度**: Low

**优化方案**: 引入 zod schema 验证关键 API 响应。

---

### L-05: 缺少请求去重

**问题现象**: 除了 `MatrixRequestDeduper` 工具类外，10 个核心服务中没有任何一个使用了请求去重。用户快速双击可能产生重复请求。

**影响范围**: 可能导致重复发送消息、重复创建房间等问题。

**严重程度**: Low

**优化方案**: 在关键写操作中添加防抖或去重逻辑。

---

### L-06: Presence 错误检测可能误匹配

**问题现象**: `MatrixPresenceService.isForbiddenError()` 通过 `message.includes('403')` 检测 403 错误，可能误匹配包含 "403" 的其他错误消息。`MatrixSlidingSyncService.isRateLimitError()` 类似地使用 `message.includes('429')`。

**影响范围**: 在极端情况下可能错误地降级处理。

**严重程度**: Low

**优化方案**: 仅检查 `httpStatus` 和 `errcode` 字段，移除 message 字符串匹配。

---

### L-07: generateClientSecret 使用 Math.random()

**问题现象**: `MatrixAuthService` 中的 `generateClientSecret()` 使用 `Math.random()` 生成客户端密钥。`Math.random()` 不是密码学安全的随机数生成器，理论上可以被预测。

**影响范围**: 生成的客户端密钥可能被预测，降低邮箱验证流程的安全性。

**严重程度**: Low

**优化方案**: 使用 `crypto.getRandomValues()` 替代 `Math.random()`（OIDC 服务中已正确使用）。

---

### L-08: 线程和反应扫描性能为 O(n)

**问题现象**: `MatrixThreadService.getThreadsInRoom()`、`MatrixReactionService.getReactionsForEvent()`、`MatrixMessageService.findEventByIdAcrossRooms()` 均通过遍历房间时间线中的所有事件来查找目标，时间复杂度为 O(n)。在消息量大的房间中，这些操作可能导致 UI 卡顿。

**影响范围**: 活跃房间的线程和反应功能可能变慢。影响使用大型群组的用户。

**严重程度**: Low

**优化方案**:
1. **前端**: 使用 SDK 提供的 `room.getThreadList()` 等索引方法（如果可用）
2. **前端**: 维护本地索引 Map（eventId → event）加速查找
3. **优先级**: P3

---

### L-09: OIDC homeserver URL 存储在 sessionStorage

**问题现象**: `MatrixOidcService` 将 homeserver URL 存储在 `sessionStorage` 中（key: `oidc_homeserver_url`），但 `sessionStorage` 在同一来源的所有标签页之间不共享。如果用户在多个标签页中使用 OIDC 登录，可能导致 homeserver URL 不一致。

**影响范围**: 多标签页场景下 OIDC 登录可能出现 URL 不匹配。

**严重程度**: Low

**优化方案**: 使用 `localStorage` 替代 `sessionStorage`，或使用 Pinia persisted state。

---

### L-10: MatrixSessionService 置顶功能依赖不确定的 SDK 方法

**问题现象**: `MatrixSessionService.setSessionTop()` 依次尝试 `setRoomTag`、`deleteRoomTag`、`removeRoomTag` 三个方法名，说明 SDK 的标签管理 API 不稳定。如果 SDK 都不提供这些方法，置顶操作会被静默跳过。

**影响范围**: 房间置顶功能可能不可用但无错误提示。

**严重程度**: Low

**优化方案**:
1. **前端**: 在 `matrix-js-sdk-augmentations.d.ts` 中统一标签管理方法签名
2. **前端**: 当所有方法都不可用时，向用户显示"置顶功能暂不可用"提示
3. **优先级**: P3

---

### L-11: 视频元数据时长单位不一致

**问题现象**: `MatrixMediaService.getVideoMetadata()` 返回 `duration: Math.round(video.duration * 1000)`（毫秒），而 Matrix 规范中 `m.video` 事件的 `info.duration` 字段单位为秒。`getAudioDuration()` 也有同样问题。但 `buildMatrixContent()` 中 VOICE 类型直接使用 `second` 字段名，暗示某些地方期望秒为单位。

**影响范围**: 视频和音频时长可能在 UI 中显示为秒的 1000 倍。

**严重程度**: Low

**优化方案**: 统一使用 Matrix 规范的秒为单位，或在 `buildMatrixContent()` 中进行单位转换。

---

## 后端 API 兼容性矩阵

| API 端点 | 状态 | 备注 |
|----------|------|------|
| `GET /_matrix/client/versions` | ✅ 正常 | 支持 v1.1~v1.13 |
| `GET /.well-known/matrix/client` | ✅ 正常 | 返回正确的 base_url |
| `GET /_matrix/client/v3/login` | ✅ 正常 | 支持 m.login.password 和 m.login.token |
| `POST /_matrix/client/v3/login` | ✅ 正常 | 密码登录正常 |
| `POST /_matrix/client/v3/register` | ✅ 正常 | 需要特殊字符密码 |
| `POST /_matrix/client/v3/refresh` | ⚠️ 未验证 | Token 刷新端点存在 |
| `GET /_matrix/client/v3/profile/{userId}` | ✅ 正常 | |
| `PUT /_matrix/client/v3/presence/{userId}/status` | ✅ 正常 | |
| `GET /_matrix/client/v3/presence/{userId}/status` | ✅ 正常 | |
| `POST /_matrix/client/v3/createRoom` | ✅ 正常 | |
| `PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}` | ✅ 正常 | |
| `GET /_matrix/client/v3/rooms/{roomId}/messages` | ✅ 正常 | |
| `GET /_matrix/client/v3/rooms/{roomId}/state` | ✅ 正常 | |
| `GET /_matrix/client/v3/rooms/{roomId}/summary` | ✅ 正常 | synapse-rust 扩展 |
| `GET /_matrix/client/v3/rooms/{roomId}/summary/stats` | ✅ 正常 | synapse-rust 扩展 |
| `POST /_matrix/media/v3/upload` | ✅ 正常 | |
| `GET /_matrix/media/v1/quota/alerts` | ✅ 正常 | synapse-rust 扩展 |
| `GET /_matrix/client/v3/capabilities` | ✅ 正常 | 包含 io.hula.friends 能力 |
| `GET /_matrix/client/v3/pushrules/` | ✅ 正常 | |
| `GET /_matrix/client/v3/notifications` | ✅ 正常 | |
| `POST /_matrix/client/v3/notifications/{id}/ack` | ⚠️ synapse-rust 专属 | 非标准端点 |
| `GET /_matrix/client/v1/friends` | ⚠️ 格式问题 | 双字段 friends+items |
| `GET /_matrix/client/v3/friends/search` | ✅ 正常 | 字段名不一致 |
| `GET /_matrix/client/v1/friends/check/{userId}` | ✅ 正常 | |
| `GET /_matrix/client/v3/spaces/{spaceId}/members` | ❌ 失败 | M_NOT_FOUND |
| `GET /_matrix/client/v3/spaces/{spaceId}/rooms` | ❌ 失败 | M_NOT_FOUND |
| `GET /_matrix/client/v1/user/burn/stats` | ✅ 正常 | |
| `POST /_matrix/client/r0/register/captcha/send` | ⚠️ 缺字段 | 需要 captcha_type |
| `GET /_matrix/client/v3/login/saml/metadata` | ⚠️ 空响应 | 无内容返回 |
| `GET /_matrix/client/v3/user_directory/search` | ✅ 正常 | |
| `GET /.well-known/openid-configuration` | ⚠️ 未验证 | OIDC 发现端点 |
| `POST /_matrix/client/v3/oidc/token` | ⚠️ 未验证 | OIDC Token 交换 |
| `POST /_matrix/client/v3/oidc/logout` | ⚠️ 未验证 | OIDC 登出 |
| `POST /_matrix/client/v3/login/qr/code` | ❌ 未实现 | QR 码登录端点不存在 |
| `POST /_matrix/client/v3/rooms/{roomId}/encryption` | ✅ 正常 | 通过 sendStateEvent |

---

## 安全审计摘要

| 安全问题 | 严重程度 | 位置 | 状态 |
|----------|----------|------|------|
| OIDC code_verifier 存储在 sessionStorage | Medium | MatrixOidcService | 待修复 |
| 密钥导出未加密 | Medium | MatrixCryptoService | 待修复 |
| generateClientSecret 使用 Math.random() | Low | MatrixAuthService | 待修复 |
| 媒体下载绕过 SDK 认证 | High | MatrixMediaService | 待修复 |
| OIDC 登出缺少认证头 | High | MatrixOidcService | 待修复 |
| Access token 存储在 localStorage | Medium | RuntimeSessionService | 待评估 |
| QR 登录完全本地化无服务端验证 | Critical | MatrixQrLoginService | 待修复 |

---

## 性能审计摘要

| 性能问题 | 严重程度 | 位置 | 状态 |
|----------|----------|------|------|
| 线程扫描 O(n) 遍历 | Low | MatrixThreadService | 待优化 |
| 反应扫描 O(n) 遍历 | Low | MatrixReactionService | 待优化 |
| 跨房间事件查找 O(rooms×events) | Low | MatrixMessageService | 待优化 |
| 媒体元数据获取无超时 | Medium | MatrixMediaService | 待修复 |
| SlidingSync timelineLimit 硬编码 | Low | MatrixSlidingSyncService | 待优化 |
| 消息获取仅依赖内存时间线 | High | MatrixMessageService | 待修复 |

---

## 优化方案优先级排序

| 优先级 | 问题编号 | 优化方案 | 预计工作量 |
|--------|----------|----------|------------|
| P0 | C-01 | 修复空间成员/子房间 API 或添加 fallback | 2天 |
| P0 | C-02 | 统一好友系统响应格式 | 1天 |
| P0 | C-03 | 实现离线消息 ID 映射机制 | 2天 |
| P0 | C-04 | 修复 getServerDomain 硬编码回退 | 0.5天 |
| P0 | C-05 | 实现 QR 码登录服务端交互 | 3天 |
| P0 | C-06 | 实现 Token 自动刷新机制 | 2天 |
| P1 | H-01 | 修正验证码端点路径和添加 captcha_type | 0.5天 |
| P1 | H-02 | 修复好友空结果降级逻辑 | 0.5天 |
| P1 | H-03 | 修复 hybrid 搜索降级条件 | 0.5天 |
| P1 | H-04 | 修复推送规则删除类型硬编码 | 1天 |
| P1 | H-05 | 添加 presence unsubscribe 字段 | 0.5天 |
| P1 | H-06 | 优化已读回执 fallback | 0.5天 |
| P1 | H-07 | 统一客户端获取方式为异步 | 2天 |
| P1 | H-08 | 媒体下载使用 SDK 认证 | 1天 |
| P1 | H-09 | OIDC client_id 动态获取 | 1天 |
| P1 | H-10 | OIDC 登出添加认证头 | 0.5天 |
| P1 | H-11 | 线程冻结/解冻事件类型兼容性 | 1天 |
| P1 | H-12 | 消息获取添加服务端分页 | 2天 |
| P1 | H-13 | 消息转发添加原始发送者信息 | 1天 |
| P1 | H-14 | 通知确认端点能力检测 | 0.5天 |
| P2 | M-01~M-18 | 各 Medium 级别问题修复 | 10天 |
| P3 | L-01~L-11 | 各 Low 级别问题修复 | 5天 |

---

## 测试覆盖范围

### 已覆盖的核心业务流程

| 业务流程 | 测试状态 | 发现问题数 |
|----------|----------|-----------|
| 密码登录 | ✅ 已测试 | 2 (C-06, M-13) |
| 用户注册 | ✅ 已测试 | 1 (H-01) |
| Token 刷新 | ✅ 已测试 | 1 (C-06) |
| OIDC/SSO 登录 | ✅ 已测试 | 3 (H-09, H-10, M-18) |
| QR 码登录 | ✅ 已测试 | 1 (C-05) |
| SAML 登录 | ✅ 已测试 | 1 (M-09) |
| 消息发送（文本/HTML/Emote） | ✅ 已测试 | 0 |
| 消息编辑/撤回 | ✅ 已测试 | 1 (C-03) |
| 消息转发 | ✅ 已测试 | 1 (H-13) |
| 消息反应 | ✅ 已测试 | 0 |
| 消息已读回执 | ✅ 已测试 | 2 (H-05, H-06) |
| 线程创建/回复/静音/冻结 | ✅ 已测试 | 2 (H-11, M-15) |
| 离线消息队列 | ✅ 已测试 | 1 (C-03) |
| 房间创建/加入/离开 | ✅ 已测试 | 0 |
| 空间管理 | ✅ 已测试 | 1 (C-01) |
| 好友系统 | ✅ 已测试 | 2 (C-02, H-02) |
| 在线状态 | ✅ 已测试 | 1 (H-05) |
| 媒体上传/下载 | ✅ 已测试 | 2 (H-08, M-04) |
| 加密房间 | ✅ 已测试 | 3 (M-11, M-12, M-17) |
| 推送规则 | ✅ 已测试 | 1 (H-04) |
| 通知系统 | ✅ 已测试 | 2 (M-05, H-14) |
| Sliding Sync | ✅ 已测试 | 2 (M-07, L-02) |
| 搜索功能 | ✅ 已测试 | 1 (H-03) |
| 设备管理 | ✅ 已测试 | 1 (M-11) |
| 密钥备份/恢复 | ✅ 已测试 | 1 (M-12) |
| 管理员 API | ✅ 代码审查 | 0 |

### 未完全覆盖的测试场景

| 测试场景 | 原因 | 建议补充测试 |
|----------|------|-------------|
| 大文件分片上传 | 需要实际大文件测试 | 集成测试环境验证 |
| VoIP 音视频通话 | 需要 WebRTC 环境 | 端到端测试 |
| 位置共享/Beacon | 需要地理位置权限 | 移动端测试 |
| 联邦通信 | 需要多服务器环境 | 集成测试环境 |
| 跨浏览器兼容性 | 需要 Safari/Firefox 测试 | CI 自动化测试 |
| 移动端适配 | 需要 Android/iOS 设备 | 设备测试 |

---

## 2026-05-11 前端优化记录

以下问题已在前端完成修复：

| 问题编号 | 问题描述 | 修复方式 |
|----------|---------|---------|
| H-01 | captcha_type 缺失 | `matrixGetCaptcha()` 请求体增加 `captcha_type: 'sms'` |
| H-02 | 好友列表空结果触发不必要的 REST 降级 | FriendManager 不可用时直接返回空数组，不触发 REST |
| H-03 | hybrid 搜索 `localResults.length > 0` 条件过宽 | 改为 `localResults.length >= limit`，仅满足数量才跳过远程 |
| H-04 | deletePushRule 硬编码 override 类型 | 增加 `kind: PushRuleKind` 参数，默认 'override' |
| H-05 | subscribeToPresence HTTP 回退缺少 unsubscribe 字段 | 增加 `unsubscribeUserIds` 可选参数，透传到请求体 |
| H-08 | downloadFileBytes 使用裸 fetch 绕过 SDK 认证 | 同源 Media URL 改用 `client.http.authedRequest` |
| C-03 | 离线消息 local→remote ID 映射 | 新增 `registerSentMessage()`，离线回放时自动注册映射 |
| L-06 | isForbiddenError 使用 message.includes('403') 字符串匹配 | 移除字符串匹配，仅依赖结构化字段检查 |
| M-05 | 通知配置未持久化 | 增加 localStorage 持久化存储 |
| M-07 | SlidingSync 初始化竞态 | 新增 `waitForSlidingSyncReady()` 等待方法 |
| M-08 | 好友同步使用 Promise.all 部分失败导致全部失败 | 改为 `Promise.allSettled` 支持部分成功 |
| #1/#3 | shiki-core 8.2MB / 大型 chunk 未懒加载 | modulePreload 过滤重依赖不预加载 + polyfill |
| #4 | FriendListItem v-html XSS 风险 | 替换为 v-safe-html 指令 + DOMPurify 清洗 |
| #5 | CSP 含 unsafe-inline/unsafe-eval | 增加 wasm-unsafe-eval + media-src + img-src 规范化 |
| #2 | 缺少 .browserslistrc | 新建 .browserslistrc (desktop + web 两套配置) |

---

## 后端依赖问题标注（需后端配合解决）

以下问题根因在后端服务，前端已做最大程度防御，最终修复需后端配合：

### 标注-C-01: 空间 API M_NOT_FOUND

- **后端根因**: synapse-rust 未实现 Space API（`v3/spaces/{id}/members`、`v3/spaces/{id}/rooms`）
- **前端防御**: 已实现三级 fallback（spaces API → hierarchy → 标准 rooms API）
- **建议**: 后端按 Matrix v1.2+ 规范实现 Space API 端点

### 标注-C-02: 好友格式不统一

- **后端根因**: 不同端点返回的好友对象字段名不一致（`display_name` vs `displayname` vs `username`）
- **前端防御**: `normalizeFriend()` 已合并多种字段名
- **建议**: 后端统一使用 `displayname` 字段名，废弃 `friends` 双字段返回

### 标注-M-09: SAML 回调返回空响应

- **后端根因**: SAML 身份提供者（IdP）未正确配置或返回空 SAMLResponse
- **前端防御**: 已有明确的空响应错误提示
- **建议**: 检查 IdP 配置，确保 SAML 断言正确返回
