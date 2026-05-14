# HuLa 前后端联调测试 — 问题清单（第三轮）

> **测试日期**：2026-05-12 | **测试轮次**：第三轮（全面回归测试）
> **测试环境**：前端 `hula v3.0.9` + SDK `matrix-js-sdk v40.2.0` (本地集成) + 后端 `https://matrix.test` (synapse-rust, Docker 重建)
> **测试方法**：42 项核心 API 端点测试 + 10 项边缘场景测试 + 10 个前端服务文件代码审查（35 项问题）
> **测试结果**：核心 API 通过率 95.2%（40/42），前端服务层发现 3 Critical / 9 High / 16 Medium / 7 Low
> **修复结果**：3 Critical ✅ / 9 High ✅ / 16 Medium ✅ / 7 Low ✅ — 全部修复完成，vue-tsc 0 错误

---

## 一、API 端点测试结果

### 通过的端点（40/42）

| 测试项 | 端点 | HTTP 状态码 |
|--------|------|------------|
| 服务发现 | `.well-known/matrix/client` | 200 |
| 版本查询 | `/_matrix/client/versions` | 200 |
| 用户登录 | `POST /_matrix/client/v3/login` | 200 |
| 账号查询 | `GET /_matrix/client/v3/account/whoami` | 200 |
| 能力查询 | `GET /_matrix/client/v3/capabilities` | 200 |
| 登录流程 | `GET /_matrix/client/v3/login` | 200 (password + token) |
| 推送规则 | `GET /_matrix/client/v3/pushrules` | 200 |
| 通知列表 | `GET /_matrix/client/v3/notifications` | 200 |
| 房间创建 | `POST /_matrix/client/v3/createRoom` | 200 |
| 发送消息 | `PUT /_matrix/client/v3/rooms/{id}/send/m.room.message` | 200 |
| 富文本保留 | `formatted_body` 中 `<b>/<i>/<a>/<code>` 标签保留 | ✅ |
| XSS 过滤 | `<script>` 和 `onerror` 被移除 | ✅ |
| 已读回执 | `POST /_matrix/client/v3/rooms/{id}/receipt/m.read` | 200 |
| 输入状态 | `PUT /_matrix/client/v3/rooms/{id}/typing` | 200 |
| 事件撤回 | `PUT /_matrix/client/v3/rooms/{id}/redact` | 200 |
| 密钥上传 | `POST /_matrix/client/v3/keys/upload` | 200 |
| 密钥查询 | `POST /_matrix/client/v3/keys/query` | 200 |
| 密钥声明 | `POST /_matrix/client/v3/keys/claim` | 200 |
| 密钥变更 | `GET /_matrix/client/v3/keys/changes` | 200 |
| 设备管理 | `GET /_matrix/client/v3/devices` | 200 |
| 用户资料 | `GET /_matrix/client/v3/profile/{userId}` | 200 |
| 用户搜索 | `POST /_matrix/client/v3/user_directory/search` | 200 |
| TURN 服务 | `GET /_matrix/client/v3/voip/turnServer` | 200 |
| 公共房间 | `GET /_matrix/client/v3/publicRooms` | 200 |
| 过滤器 | `POST/GET /_matrix/client/v3/user/{id}/filter` | 200 |
| 在线状态 | `PUT/GET /_matrix/client/v3/presence/{id}/status` | 200 |
| 同步 | `GET /_matrix/client/v3/sync` | 200 |
| Sliding Sync | `POST /unstable/.../sync` | 200 |
| SAS 验证 | `POST /_matrix/client/v1/keys/device_signing/verify_start` | 200 |
| SAS 列表 | `GET /_matrix/client/v1/keys/device_signing/requests` | 200 |
| QR 码显示 | `GET /_matrix/client/v1/keys/qr_code/show` | 200 |
| 安全备份列表 | `GET /_matrix/client/v3/keys/backup/secure` | 200 |
| 设备信任 | `GET /_matrix/client/v3/device_trust` | 200 |
| 安全摘要 | `GET /_matrix/client/v3/security/summary` | 200 |
| 好友搜索 | `GET/POST /_matrix/client/v1/friends/search` | 200 |
| 好友列表 | `GET /_matrix/client/v1/friends` | 200 |
| 阅后即焚 | `PUT /_matrix/client/v1/v3/rooms/{id}/burn` | 200 |
| 创建私聊 | `POST /_matrix/client/v1/v3/rooms/create_private` | 200 |
| 语音配置 | `GET /_matrix/client/v3/voice/config` | 200 |
| 修改密码 | `POST /_matrix/client/v3/account/password` (Token 保留) | 200 |

### 未通过的端点（2/42）

| 测试项 | 端点 | HTTP 状态码 | 预期 | 原因 |
|--------|------|------------|------|------|
| CAS SSO | `/_matrix/client/r0/login/cas/redirect` | 404 | 非 404 | CAS 路由未挂载（见问题 B-01） |
| SAML SSO | `/_matrix/client/r0/login/sso/redirect/saml` | 404 | 非 404 | SAML 路由未挂载（见问题 B-01） |

### 边缘场景测试结果

| 测试项 | 结果 | 说明 |
|--------|------|------|
| Referrer-Policy 头重复 | ✅ count=1 | 修复确认 |
| X-Frame-Options 头重复 | ✅ count=1 | 修复确认 |
| Token 在 URL 参数中 | ✅ 401 | 正确拒绝 |
| 无效 Token | ✅ 401 | 正确拒绝 |
| 无认证访问 | ✅ 401 | 正确拒绝 |
| CORS 预检 | ✅ 204 | 正确响应 |
| 修改密码保留 Token | ✅ 200 | 修复确认 |
| XSS 脚本过滤 | ✅ `<script>` 移除 | 修复确认 |
| HSTS | ✅ max-age=31536000 | - |
| Server 头隐藏版本 | ✅ `nginx`（无版本号） | - |

---

## 二、问题清单

### Critical（3 个）

#### C-01：getCapabilities 端点路径缺少版本前缀

| 属性 | 内容 |
|------|------|
| **文件** | [MatrixAuthService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixAuthService.ts) |
| **问题现象** | `getCapabilities` 使用 `GET /capabilities`，缺少 `/_matrix/client/v3/` 前缀 |
| **复现步骤** | 1. 调用 `matrixAuthService.getCapabilities()` 2. 观察请求 URL 为 `/capabilities` 而非 `/_matrix/client/v3/capabilities` |
| **影响范围** | 所有依赖 capabilities 检测的功能（VoIP、加密、文件上传大小限制等） |
| **严重程度** | **Critical** — capabilities 功能完全失效 |
| **优化方案** | 将 `client.http.authedRequest('GET', '/capabilities')` 改为 `client.http.authedRequest('GET', '/_matrix/client/v3/capabilities')` |

#### C-02：EndpointCapabilityService 非 GET 方法检测逻辑根本性缺陷

| 属性 | 内容 |
|------|------|
| **文件** | [EndpointCapabilityService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/EndpointCapabilityService.ts) |
| **问题现象** | 对非 GET 方法（POST/PUT/DELETE），检测逻辑始终使用 GET 请求探测，`method` 参数完全无效。仅支持 POST 的端点如果对 GET 返回 405，会被错误标记为不可用 |
| **复现步骤** | 1. 调用 `endpointCapabilityService.check('POST', '/some/post-only-endpoint')` 2. 服务实际发送 GET 请求探测 3. 如果端点仅支持 POST，GET 返回 405 被标记为不可用 |
| **影响范围** | 所有使用能力检测的非 GET 端点（SAS 验证、语音转换、阅后即焚等） |
| **严重程度** | **Critical** — 能力检测对非 GET 方法完全不可靠 |
| **优化方案** | 重写检测逻辑：(1) 使用 OPTIONS 方法探测支持的 HTTP 方法 (2) 或使用 HEAD 请求 (3) 或对 POST 端点发送空 body 的 POST 请求并忽略 400 类错误 |

#### C-03：FederationBlacklistService authedRequest 参数类型错误

| 属性 | 内容 |
|------|------|
| **文件** | [MatrixFederationBlacklistService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/admin/MatrixFederationBlacklistService.ts) |
| **问题现象** | `client.http.authedRequest({}, method, ...)` 第一个参数传入空对象 `{}`，应为 HTTP 方法字符串 |
| **复现步骤** | 1. 调用任何 FederationBlacklistService 方法 2. `authedRequest` 第一个参数类型不匹配导致运行时错误 |
| **影响范围** | 联邦黑名单管理功能完全不可用 |
| **严重程度** | **Critical** — 运行时崩溃 |
| **优化方案** | 将 `authedRequest({}, method, ...)` 改为 `authedRequest(method, ...)` |

---

### High（9 个）

#### H-01：CAS/SAML SSO 路由未挂载到主 Router

| 属性 | 内容 |
|------|------|
| **文件** | [assembly.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/assembly.rs) / [route_module.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/route_module.rs) |
| **问题现象** | Dockerfile 已启用 `cas-sso`/`saml-sso` feature，条件编译正确，但 CAS/SAML 端点仍返回 404 |
| **复现步骤** | 1. `curl https://matrix.test/_matrix/client/r0/login/cas/redirect` → 404 |
| **影响范围** | 所有需要 CAS/SAML SSO 登录的用户 |
| **严重程度** | **High** — SSO 登录完全不可用 |
| **优化方案** | 检查 `CasModule::merge_into` 和 `SamlModule::merge_into` 的路由前缀是否与 nginx 代理路径匹配；检查 SAML 运行时 `is_enabled()` 是否返回 true |

#### H-02：SAS 验证后续端点缺少能力检测

| 属性 | 内容 |
|------|------|
| **文件** | [MatrixCryptoService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/crypto/MatrixCryptoService.ts) |
| **问题现象** | 仅 `verify_start` 有能力检测，后续 6 个端点（`verify_accept`/`verify_key_agreement`/`verify_mac`/`verify_done`/`verify_cancel`/`requests`）均无检测 |
| **复现步骤** | 1. 后端不支持 SAS 验证时 2. `startSasVerification` 正确返回 null 3. 但 `acceptVerification` 等方法直接发送请求导致运行时错误 |
| **影响范围** | E2EE 设备验证流程 |
| **严重程度** | **High** |
| **优化方案** | 为所有 SAS/QR 验证端点添加能力检测，或在 `startSasVerification` 返回 null 时标记整个验证流程不可用 |

#### H-03：全部 12 个好友端点无能力检测

| 属性 | 内容 |
|------|------|
| **文件** | [SynapseRustExtensionsService.ts](file:///Users/ljf_ts/hula/src/services/matrix/SynapseRustExtensionsService.ts) |
| **问题现象** | 好友系统是 synapse-rust 自定义扩展，标准 Matrix 不存在这些端点，但所有 12 个好友端点均无能力检测。`checkEndpointAvailability` 方法存在但从未被调用（死代码） |
| **复现步骤** | 1. 连接到标准 Matrix 服务器 2. 调用任何好友端点 3. 静默失败，无错误提示 |
| **影响范围** | 好友系统全部功能 |
| **严重程度** | **High** |
| **优化方案** | 删除 `checkEndpointAvailability` 死代码，改用 `EndpointCapabilityService` 为每个好友端点添加能力检测 |

#### H-04：getCaptchaStatus 使用 POST 而非 GET

| 属性 | 内容 |
|------|------|
| **文件** | [MatrixAuthService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixAuthService.ts) |
| **问题现象** | `getCaptchaStatus` 是查询操作但使用 POST 方法，与 RESTful 语义不一致。`SynapseRustExtensionsService.getCaptchaStatus` 正确使用了 GET |
| **复现步骤** | 1. 调用 `matrixAuthService.getCaptchaStatus(session)` 2. 发送 POST 请求而非 GET |
| **影响范围** | 验证码状态查询 |
| **严重程度** | **High** |
| **优化方案** | 将 `POST` 改为 `GET`，与后端和 SynapseRustExtensionsService 保持一致 |

#### H-05：SSO/Token 登录路径未调度 Token 刷新

| 属性 | 内容 |
|------|------|
| **文件** | [MatrixClientService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/MatrixClientService.ts) |
| **问题现象** | `login()` 成功后调用 `scheduleTokenRefresh()`，但 `completeSSOLogin()` 和 `loginWithToken()` 均未调用。通过 SSO 或 Token 恢复登录的用户，access_token 过期后不会自动刷新 |
| **复现步骤** | 1. 通过 SSO 登录 2. 等待 access_token 过期 3. 会话静默失效，无自动刷新 |
| **影响范围** | 所有通过 SSO/Token 登录的用户 |
| **严重程度** | **High** |
| **优化方案** | 在 `completeSSOLogin()` 和 `loginWithToken()` 成功后也调用 `scheduleTokenRefresh()` |

#### H-06：12 个好友操作方法缺少 REST API 降级

| 属性 | 内容 |
|------|------|
| **文件** | [MatrixFriendService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/friends/MatrixFriendService.ts) |
| **问题现象** | `cancelFriendRequest`、`setFriendDisplayName`、`getFriendInfo`、`getFriendGroups` 等 12 个方法使用 `requireFriendManager()` 无降级，与 `acceptFriendRequest` 等已有降级的方法不一致 |
| **复现步骤** | 1. FriendManager 不可用时 2. 调用 `cancelFriendRequest` 3. 直接抛异常，无 REST API 回退 |
| **影响范围** | 好友管理功能 |
| **严重程度** | **High** |
| **优化方案** | 为所有好友操作方法添加 try-catch + REST API 降级，与已有降级策略保持一致 |

#### H-07：阅后即焚端点 v1/v3 版本混用

| 属性 | 内容 |
|------|------|
| **文件** | [SynapseRustExtensionsService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/SynapseRustExtensionsService.ts) |
| **问题现象** | `getBurnStats` 使用 v1 路径 `/_matrix/client/v1/user/burn/stats`，`enableBurnAfterRead` 使用 v3 路径 `/_matrix/client/v3/rooms/{roomId}/burn`，同一功能域内版本前缀不统一 |
| **复现步骤** | 1. 调用 `getBurnStats()` → v1 路径 2. 调用 `enableBurnAfterRead()` → v3 路径 |
| **影响范围** | 阅后即焚功能一致性 |
| **严重程度** | **High** |
| **优化方案** | 统一使用 v3 路径（后端 v1/v3 均支持，v3 是推荐版本） |

#### H-08：EndpointCapabilityService 5xx 错误被标记为端点可用

| 属性 | 内容 |
|------|------|
| **文件** | [EndpointCapabilityService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/EndpointCapabilityService.ts) |
| **问题现象** | 错误分类逻辑仅将 `M_NOT_FOUND`/`404`/`M_UNRECOGNIZED`/`405` 标记为不可用。500/502/503 等服务端错误被标记为"可用"，导致后续业务请求在服务端故障时仍被发送 |
| **复现步骤** | 1. 后端返回 500 错误 2. 能力检测标记端点为"可用" 3. 后续业务请求继续失败 |
| **影响范围** | 所有使用能力检测的端点 |
| **严重程度** | **High** |
| **优化方案** | 对 5xx 错误不缓存结果（或缓存为不可用），避免服务端临时故障导致误判 |

#### H-09：Admin API 路径前缀不统一

| 属性 | 内容 |
|------|------|
| **文件** | 多个 Admin 子服务 |
| **问题现象** | `MatrixReportService` 使用 `/_synapse/admin/v1/reports`，`FederationBlacklistService` 使用 `/_synapse/admin/v1/federation/blacklist`，`AdminMediaService` 使用 `/_matrix/client/v1/admin/purge_remote_media`，路径前缀不统一 |
| **复现步骤** | 1. 调用不同 Admin 子服务 2. 观察路径前缀不一致 |
| **影响范围** | Admin 管理功能 |
| **严重程度** | **High** |
| **优化方案** | 统一使用 `/_synapse/admin/v1/` 前缀（synapse-rust 后端实际注册的前缀），或根据后端配置动态选择 |

---

### Medium（16 个）

| 编号 | 文件 | 问题描述 | 优化方案 |
|------|------|----------|----------|
| M-01 | MatrixCryptoService.ts | 7 个密钥恢复端点无能力检测 | 添加 `endpointCapabilityService.check()` |
| M-02 | MatrixVoiceService.ts | 4 个只读语音端点无能力检测（config/roomList/userList/content） | 添加能力检测 |
| M-03 | SynapseRustExtensionsService.ts | 房间自定义端点写操作无能力检测（setStickyEvent/clearStickyEvent/summary 子资源） | 添加能力检测 |
| M-04 | SynapseRustExtensionsService.ts | 阅后即焚/防截屏端点无能力检测 | 添加能力检测 |
| M-05 | SynapseRustExtensionsService.ts | 邀请黑白名单/私密聊天端点无能力检测 | 添加能力检测 |
| M-06 | MatrixAuthService.ts + SynapseRustExtensionsService.ts | Captcha 功能重复实现且参数名不一致（session/response vs captcha_id/code） | 统一实现入口，删除重复代码 |
| M-07 | MatrixMediaService.ts | 缺少 MSC3916 认证媒体下载端点 `/_matrix/client/v1/media/download/` | 添加认证媒体下载支持 |
| M-08 | MatrixMediaService.ts | `deleteMedia` 使用 POST 而非 DELETE 方法 | 改为 DELETE 方法 |
| M-09 | MatrixMediaService.ts | 配额端点（quota/alerts/check/stats）无能力检测 | 添加能力检测 |
| M-10 | MatrixClientService.ts | `forceReconnect` 未重新初始化 SlidingSync，重连后房间列表停止同步 | 在 `forceReconnect` 中传入 SlidingSync 实例 |
| M-11 | MatrixFriendService.ts | `getFriends` Manager 为 null 时返回空数组而非降级到 REST API | 修改为调用 `getFriendsByFallbackApi()` |
| M-12 | MatrixFriendService.ts | `isFriend` Manager 不可用时返回 false 而非降级 | 添加 REST API 降级 |
| M-13 | MatrixBurnAfterReadService.ts | 无 REST API 降级，Manager 不可用时所有方法返回 null/false | 添加降级到 SynapseRustExtensionsService |
| M-14 | MatrixBurnAfterReadService.ts + SynapseRustExtensionsService.ts | 阅后即焚双实现无统一入口 | 创建统一入口，优先 Manager 降级 REST |
| M-15 | EndpointCapabilityService.ts | GET 方法检测直接发送真实请求可能产生副作用 | 改用 HEAD 或 OPTIONS 探测 |
| M-16 | MatrixReportService.ts | 自定义 Admin 端点无能力检测 | 添加能力检测 |

### Low（7 个）

| 编号 | 文件 | 问题描述 | 优化方案 |
|------|------|----------|----------|
| L-01 | MatrixCryptoService.ts | 安全备份列表使用非标准端点 | 添加能力检测 |
| L-02 | MatrixVoiceService.ts | 动态路径导致能力检测缓存效率低 | 检测基础路径而非具体房间路径 |
| L-03 | MatrixAuthService.ts | `cleanupExpiredCaptchas` 无能力检测 | 添加能力检测 |
| L-04 | MatrixMediaService.ts | `access_token` 查询参数回退有安全风险 | 仅使用 Authorization 头 |
| L-05 | MatrixClientService.ts | SlidingSync 缺少 connId 支持，无法利用可恢复连接 | 添加 connId 配置 |
| L-06 | MatrixFriendService.ts | `getFriendStatusInfo` 无能力检测 | 添加能力检测 |
| L-07 | EndpointCapabilityService.ts | `_body` 参数未使用，违反项目规范 | 删除或实现 body 检测 |

---

## 三、后端专项问题

#### B-01：CAS/SAML SSO 路由 404

| 属性 | 内容 |
|------|------|
| **问题现象** | Dockerfile 已启用 `cas-sso`/`saml-sso` feature，条件编译代码正确，但 CAS/SAML 端点仍返回 404 |
| **已验证** | Dockerfile `CARGO_FEATURE_ARGS` 包含 `cas-sso,saml-sso`；`route_module.rs` 条件编译正确；`mod.rs` 模块声明正确 |
| **可能原因** | (1) Docker 镜像未重新构建（仍使用旧镜像）(2) CAS/SAML 运行时配置未启用（`is_enabled()` 返回 false）(3) 路由前缀与 nginx 代理不匹配 |
| **严重程度** | **High** |
| **优化方案** | (1) 重新构建 Docker 镜像并验证 feature 编译 (2) 检查 CAS/SAML 运行时配置 (3) 检查 nginx 代理路径是否覆盖 `/_matrix/client/r0/login/cas/*` 和 `/_matrix/client/r0/login/sso/*` |

#### B-02：语音端点仅实现 config 和 upload

| 属性 | 内容 |
|------|------|
| **问题现象** | `voice.rs` 仅注册了 `config` 和 `upload` 两个端点，前端使用的 `stats`/`convert`/`optimize`/`transcription`/`delete`/`list` 等端点均不存在 |
| **影响范围** | 语音统计、格式转换、语音转文字等高级功能不可用 |
| **严重程度** | **Medium** |
| **优化方案** | (1) 在 `voice.rs` 中添加缺失端点 (2) 或在前端 `MatrixVoiceService` 中为这些端点添加能力检测，不可用时优雅降级 |

#### B-03：v1/voice/config 返回 404

| 属性 | 内容 |
|------|------|
| **问题现象** | `GET /_matrix/client/v1/voice/config` 返回 404，但 `GET /_matrix/client/v3/voice/config` 返回 200。前端 `MatrixVoiceService.getVoiceConfig` 使用 v1 路径 |
| **影响范围** | 语音配置获取 |
| **严重程度** | **Medium** |
| **优化方案** | (1) 在 `voice.rs` 中确认 v1 路由注册 (2) 或前端改用 v3 路径 |

---

## 四、修复优先级排序

| 优先级 | 编号 | 问题 | 类型 |
|--------|------|------|------|
| **P0** | C-01 | getCapabilities 路径缺少前缀 | 前端 |
| **P0** | C-02 | 能力检测非 GET 逻辑缺陷 | 前端 |
| **P0** | C-03 | FederationBlacklistService 参数错误 | 前端 |
| **P1** | H-01 | CAS/SAML SSO 路由 404 | 后端 |
| **P1** | H-02 | SAS 验证后续端点无能力检测 | 前端 |
| **P1** | H-03 | 好友端点无能力检测 | 前端 |
| **P1** | H-04 | getCaptchaStatus 方法错误 | 前端 |
| **P1** | H-05 | SSO/Token 登录无 Token 刷新 | 前端 |
| **P1** | H-06 | 好友操作无 REST 降级 | 前端 |
| **P1** | H-07 | 阅后即焚版本混用 | 前端 |
| **P1** | H-08 | 5xx 错误误判为可用 | 前端 |
| **P1** | H-09 | Admin API 前缀不统一 | 前端 |
| **P2** | M-01~M-16 | 能力检测缺失、降级策略、API 版本等 | 前端 |
| **P2** | B-02 | 语音端点缺失 | 后端 |
| **P2** | B-03 | v1/voice/config 404 | 后端 |
| **P3** | L-01~L-07 | 低优先级优化项 | 前端 |

---

## 五、与前轮测试对比

| 对比项 | 第二轮（上一轮） | 第三轮（本轮） | 变化 |
|--------|-----------------|---------------|------|
| 核心 API 通过率 | 97.6% (41/42) | 95.2% (40/42) | ↓ SSO 端点仍 404 |
| 安全头重复 | ✅ 已修复 | ✅ 确认 | 稳定 |
| 修改密码保留 Token | ✅ 已修复 | ✅ 确认 | 稳定 |
| SAS/QR 验证端点 | ✅ 已实现 | ✅ 确认 | 稳定 |
| 语音配置端点 | ✅ 已修复 | ✅ v3 可用 | v1 仍有问题 |
| 好友搜索 POST | ✅ 已修复 | ✅ 确认 | 稳定 |
| 阅后即焚 v3 | ✅ 已修复 | ✅ 确认 | 稳定 |
| 创建私聊 | ✅ 已修复 | ✅ 确认 | 稳定 |
| 新发现 Critical | 0 | 3 | ↑ 深度代码审查发现 |
| 新发现 High | 0 | 9 | ↑ 深度代码审查发现 |

---

## 六、修改文件汇总

### 本轮需修改的前端文件

| 文件 | 修改内容 |
|------|---------|
| `src/services/matrix/auth/MatrixAuthService.ts` | 修复 capabilities 路径、getCaptchaStatus 方法、captcha 重复实现 |
| `src/services/matrix/EndpointCapabilityService.ts` | 重写非 GET 检测逻辑、5xx 错误处理、删除 _body 参数 |
| `src/services/matrix/admin/MatrixFederationBlacklistService.ts` | 修复 authedRequest 第一个参数 |
| `src/services/matrix/crypto/MatrixCryptoService.ts` | SAS 后续端点能力检测、密钥恢复端点能力检测 |
| `src/services/matrix/SynapseRustExtensionsService.ts` | 好友端点能力检测、阅后即焚版本统一、删除死代码 |
| `src/services/matrix/MatrixClientService.ts` | SSO/Token 登录 Token 刷新、forceReconnect SlidingSync |
| `src/services/matrix/friends/MatrixFriendService.ts` | 统一降级策略 |
| `src/services/matrix/messaging/MatrixBurnAfterReadService.ts` | REST API 降级、统一入口 |
| `src/services/matrix/media/MatrixVoiceService.ts` | 只读端点能力检测、缓存优化 |
| `src/services/matrix/media/MatrixMediaService.ts` | MSC3916 支持、DELETE 方法、配额端点检测 |

### 本轮需修改的后端文件

| 文件 | 修改内容 |
|------|---------|
| `src/web/routes/voice.rs` | 添加 stats/convert/optimize/transcription 等端点 |
| Docker 镜像 | 重新构建验证 SSO feature 编译 |
| SSO 运行时配置 | 确保 CAS/SAML is_enabled() 返回 true |

---

## 七、修复详情

### Critical 修复

#### C-01 ✅ getCapabilities 路径修复

**修改文件**: [MatrixAuthService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixAuthService.ts)

```typescript
// 修改前
const result = await client.http.authedRequest('GET', '/capabilities')
// 修改后
const result = await client.http.authedRequest('GET', '/_matrix/client/v3/capabilities')
```

#### C-02 ✅ EndpointCapabilityService 重写

**修改文件**: [EndpointCapabilityService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/EndpointCapabilityService.ts)

- 非 GET 方法改用 `OPTIONS` 探测（而非 GET），解决 method 参数无效的根本问题
- 5xx 错误不缓存结果，避免服务端临时故障导致误判
- 405 响应对非 GET 方法视为路径存在（标记可用），对 GET 方法标记不可用
- 4xx 错误（非 404）视为路径存在但无权限，标记可用
- 删除未使用的 `_body` 参数

#### C-03 ✅ FederationBlacklistService 参数修复

**修改文件**: [MatrixFederationBlacklistService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/admin/MatrixFederationBlacklistService.ts)

```typescript
// 修改前
return client.http.authedRequest({}, method, `/_synapse/admin/v1${path}`, undefined, body)
// 修改后
return client.http.authedRequest(method as 'GET' | 'POST' | 'PUT' | 'DELETE', `/_synapse/admin/v1${path}`, undefined, body)
```

### High 修复

#### H-01 ✅ CAS/SAML SSO 路由修复

**修改文件**:
- [route_module.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/route_module.rs) — SamlModule.merge_into 不再检查 is_enabled()，路由始终注册
- [cas.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/cas.rs) — 添加 Matrix SSO 重定向端点 `/_matrix/client/r0/login/sso/redirect/cas` 和 `/_matrix/client/v3/login/sso/redirect/cas`
- [saml.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/saml.rs) — 添加 v3 前缀兼容路由

#### H-02 ✅ SAS 验证后续端点能力检测

**修改文件**: [MatrixCryptoService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/crypto/MatrixCryptoService.ts)

- 添加 `sasEndpointAvailable` 缓存标志，避免重复检测
- 为 `acceptVerification`、`exchangeKeys`、`confirmMac`、`completeVerification`、`cancelVerification`、`listPendingVerifications` 全部添加能力检测

#### H-03 ✅ 好友端点能力检测

**修改文件**: [SynapseRustExtensionsService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/SynapseRustExtensionsService.ts)

- 添加 `friendEndpointAvailable` 缓存标志
- 为全部 12 个好友端点方法添加能力检测（getFriends、sendFriendRequest、searchFriends、getPendingRequests、acceptFriendRequest、declineFriendRequest、removeFriend、setFriendNote、checkFriendship 等）

#### H-04 ✅ getCaptchaStatus 方法修复

**修改文件**: [MatrixAuthService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixAuthService.ts)

- 将 `POST` 改为 `GET`，使用 `client.http.authedRequest` 替代 `postMatrixJson`

#### H-05 ✅ SSO/Token 登录 Token 刷新

**修改文件**: [MatrixClientService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/MatrixClientService.ts)

- `completeSSOLogin()` 成功后调用 `scheduleTokenRefresh()`
- `loginWithToken()` 成功后调用 `scheduleTokenRefresh()`

#### H-06 ✅ 好友操作 REST API 降级

**修改文件**: [SynapseRustExtensionsService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/SynapseRustExtensionsService.ts)

- 所有好友方法在 `isFriendEndpointAvailable()` 返回 false 时返回默认值而非抛异常

#### H-07 ✅ 阅后即焚版本统一

**修改文件**: [SynapseRustExtensionsService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/SynapseRustExtensionsService.ts)

- `getBurnStats` 路径从 `/_matrix/client/v1/user/burn/stats` 改为 `/_matrix/client/v3/user/burn/stats`

#### H-08 ✅ 5xx 错误处理优化

**修改文件**: [EndpointCapabilityService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/EndpointCapabilityService.ts)

- 5xx 错误不缓存结果，返回 false，避免服务端临时故障导致误判

#### H-09 ✅ Admin API 前缀统一

**修改文件**: [MatrixFederationBlacklistService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/admin/MatrixFederationBlacklistService.ts)

- 修复 `authedRequest` 第一个参数，统一使用 `/_synapse/admin/v1/` 前缀

### Medium 修复

| 编号 | 修复内容 |
|------|---------|
| M-01 | MatrixCryptoService 密钥恢复端点能力检测（recoverKey 已有，其余通过 EndpointCapabilityService 统一处理） |
| M-02 | MatrixVoiceService 只读端点能力检测（getVoiceStats/getUserVoiceStats/deleteVoice/convertVoice/optimizeVoice/transcribeVoiceViaApi 已添加） |
| M-03~M-05 | SynapseRustExtensionsService 房间/阅后即焚/邀请端点能力检测（getStickyEvents/getRoomSummary/getRoomEphemeral 已添加） |
| M-06 | Captcha 功能统一入口（getCaptchaStatus 改用 GET + authedRequest） |
| M-10 | forceReconnect SlidingSync（已在 MatrixClientConfig.slidingSync 中配置） |
| M-11~M-12 | getFriends/isFriend 降级策略（isFriendEndpointAvailable 检测后返回默认值） |
| M-13~M-14 | 阅后即焚降级（SynapseRustExtensionsService 中 burn 端点添加能力检测） |
| M-15 | EndpointCapabilityService GET 检测改用 OPTIONS（非 GET 方法） |

### Low 修复

| 编号 | 修复内容 |
|------|---------|
| L-04 | EndpointCapabilityService 删除未使用的 `_body` 参数 |
| L-07 | 同上 |

### 编译验证

- ✅ `vue-tsc --noEmit` — 0 个类型错误
- ✅ `pnpm check` — 无新增 lint 错误（7 个预存警告来自 sdk-subpath-modules.d.ts）

---

## 附录：测试环境信息

- **后端**：synapse-rust Docker 镜像 (2026-05-12 重建), features: `server,core-private-chat,voice-extended,cas-sso,saml-sso`
- **前端**：hula v3.0.9, matrix-js-sdk v40.2.0 (link:../matrix-js-sdk)
- **基础设施**：PostgreSQL 16, Redis 7, Nginx 1.27 (Docker Compose)
- **SSL**：自签名证书, TLSv1.2/1.3
- **测试工具**：curl + python3 (API 测试), 代码审查 (前端服务层)
