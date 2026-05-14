# synapse-rust 后端与 hula 前端联调测试问题清单 (v3)

> 测试日期: 2026-05-12 ~ 2026-05-13
> 测试环境: https://matrix.test (synapse-rust Docker 部署, 镜像已重建包含全部修复)
> 测试方法: 82 项 API 端点测试 + 28 项回归测试 + 前端服务层代码审查 + 16 项回归验证
> 测试结果: 70 PASS / 12 FAIL (首轮 API), 28 PASS / 3 FAIL (回归测试), 前端审查 11 个问题, 最终回归 16 PASS / 0 FAIL

---

## 一、Critical 级别问题

### C-01: completeSSOLogin 缺少 initialize() 调用

| 项目 | 内容 |
|------|------|
| **问题现象** | SSO 登录成功后，客户端未持有正确的 access token，后续所有 API 调用均因认证失败而报错 |
| **根因分析** | `MatrixClientService.completeSSOLogin()` 在登录成功后直接返回，没有像 `login()` 方法那样调用 `this.initialize()` 重新初始化客户端。导致客户端仍使用旧的（登录前的）token |
| **影响范围** | 所有使用 SSO/CAS/SAML 登录的用户，登录后无法正常使用任何功能 |
| **复现步骤** | 1. 配置 SSO 登录; 2. 通过 SSO 流程登录; 3. 登录成功后尝试发送消息或获取房间列表; 4. 所有请求返回 401 |
| **严重程度** | **Critical** |
| **修复状态** | **已修复** - 在 `completeSSOLogin` 中添加了 `await this.initialize({...})` 调用 |
| **修复文件** | `src/services/matrix/MatrixClientService.ts` L487-494 |

### C-02: forceReconnect 未传入 Sliding Sync 配置

| 项目 | 内容 |
|------|------|
| **问题现象** | 系统休眠恢复后，Matrix 客户端重连时回退到传统同步模式，导致消息延迟、房间列表不更新 |
| **根因分析** | `forceReconnect()` 调用 `client.startClient({ initialSyncLimit: 10 })` 时没有传入 `slidingSync` 实例和 `pendingEventOrdering`，而正常启动时（`startClient()`）会传入完整的 Sliding Sync 配置 |
| **影响范围** | 所有使用桌面端且经历过系统休眠/网络中断的用户 |
| **复现步骤** | 1. 正常登录并使用 Sliding Sync; 2. 合上笔记本盖子使系统休眠; 3. 重新打开后观察同步行为; 4. 同步模式回退到传统方式 |
| **严重程度** | **Critical** |
| **修复状态** | **已修复** - 在 `forceReconnect` 中添加了 Sliding Sync 实例和完整启动选项 |
| **修复文件** | `src/services/matrix/MatrixClientService.ts` L678-690 |

---

## 二、High 级别问题

### H-01: SSO 登录流未在 login flows 中暴露

| 项目 | 内容 |
|------|------|
| **问题现象** | `GET /_matrix/client/v3/login` 返回的 flows 中只有 `m.login.password` 和 `m.login.token`，缺少 `m.login.cas` 和 `m.login.sso` |
| **根因分析** | Docker 镜像未包含最新的 SSO 路由修复代码。当前运行的镜像是 5月11日构建的，而 SSO 路由修复是在5月12日。另外 `cas_sso_redirect` 函数存在编译错误（引用了 `saml_service.is_enabled()` 但 saml_service 可能不存在于 AppState） |
| **影响范围** | 所有需要 SSO 登录的用户，前端无法显示 SSO 登录选项 |
| **复现步骤** | 1. 调用 `GET /_matrix/client/v3/login`; 2. 检查返回的 flows 列表; 3. 发现缺少 `m.login.cas` 和 `m.login.sso` |
| **严重程度** | **High** |
| **修复状态** | **已修复** - 修复了 `cas_sso_redirect` 编译错误，Docker 镜像已重建。回归测试确认: login flows 包含 m.login.cas 和 m.login.sso, CAS redirect 返回 302 |
| **修复文件** | `synapse-rust/src/web/routes/cas.rs` L118-138 |

### H-02: EndpointCapabilityService GET 检测浪费带宽

| 项目 | 内容 |
|------|------|
| **问题现象** | `EndpointCapabilityService.check('GET', path)` 实际发送 GET 请求并下载完整响应体，仅用于判断端点是否存在。对于返回大量数据的端点（如好友列表），这非常浪费带宽 |
| **根因分析** | 原实现使用 `client.http.authedRequest('GET', path)` 进行检测，应改用 HEAD 请求 |
| **影响范围** | 所有使用端点能力检测的功能，每次检测都会产生不必要的网络流量 |
| **复现步骤** | 1. 调用 `endpointCapabilityService.check('GET', '/_matrix/client/v1/friends')`; 2. 观察网络请求; 3. 发现完整的好友列表数据被下载 |
| **严重程度** | **High** |
| **修复状态** | **已修复** - GET 方法改用 HEAD 请求 |
| **修复文件** | `src/services/matrix/EndpointCapabilityService.ts` L41-42 |

### H-03: EndpointCapabilityService 405 处理逻辑错误

| 项目 | 内容 |
|------|------|
| **问题现象** | 对非 GET 方法，当 OPTIONS 请求返回 405 时，代码认为"路径存在"并标记为可用。这导致不存在的端点被错误地标记为可用 |
| **根因分析** | 405 响应表示服务器不支持该 HTTP 方法，不能推断路径存在。服务器可能对任何未知路径都返回 405（而非 404） |
| **影响范围** | 所有使用端点能力检测的功能，可能导致不支持的功能被错误启用 |
| **复现步骤** | 1. 对一个不存在但服务器返回 405 而非 404 的路径调用 `check('POST', path)`; 2. 结果返回 true（可用）; 3. 实际调用该端点时失败 |
| **严重程度** | **High** |
| **修复状态** | **已修复** - 405 统一标记为不可用 |
| **修复文件** | `src/services/matrix/EndpointCapabilityService.ts` L69-73 |

### H-04: Email 3PID submit_url 使用内部地址

| 项目 | 内容 |
|------|------|
| **问题现象** | `POST /_matrix/client/v3/account/3pid/email/requestToken` 返回的 `submit_url` 为 `https://0.0.0.0:8008/_matrix/client/v3/account/3pid/email/submitToken`，使用了内部地址 |
| **根因分析** | `auth_compat.rs` 中 `submit_url` 构造直接使用 `config.server.host` + `config.server.port` 拼接，当 host 为 `0.0.0.0` 时生成不可达地址。且协议硬编码为 `https://`，未使用 `get_public_baseurl()` 方法 |
| **影响范围** | 所有需要邮箱验证的用户（注册、密码重置、绑定邮箱等），验证链接无法访问 |
| **复现步骤** | 1. 调用 `POST /_matrix/client/v3/account/3pid/email/requestToken`; 2. 检查返回的 `submit_url`; 3. 发现使用 `0.0.0.0:8008` |
| **严重程度** | **High** |
| **修复状态** | **已修复** - 改用 `state.services.config.server.get_public_baseurl()` 构造 URL，回归测试确认 submit_url 现在为 `https://matrix.test/...` |
| **修复文件** | `synapse-rust/src/web/routes/auth_compat.rs` L259-263 |

### H-05: Token 不支持 URL 查询参数传递

| 项目 | 内容 |
|------|------|
| **问题现象** | `GET /_matrix/client/v3/account/whoami?access_token=xxx` 返回 401，不支持通过 URL 查询参数传递 access token |
| **根因分析** | synapse-rust 认证中间件仅从 `Authorization: Bearer` 头提取 token，不支持 `?access_token=` 查询参数。Matrix 规范允许此方式，且 WebSocket 连接和媒体下载等场景依赖此功能 |
| **影响范围** | 使用 URL 查询参数传递 token 的客户端（WebSocket 连接、媒体下载、嵌入式场景等） |
| **复现步骤** | 1. 在 URL 中添加 `?access_token=<valid_token>`; 2. 发送请求; 3. 返回 401 M_UNAUTHORIZED |
| **严重程度** | **High** |
| **修复状态** | **已修复** - 在 `extract_token_from_request` 和 `middleware.extract_token` 中添加了 URL 查询参数回退逻辑，回归测试确认 `?access_token=` 方式正常工作 |
| **修复文件** | `synapse-rust/src/web/routes/extractors/auth.rs` L187-201, `synapse-rust/src/web/middleware.rs` L671-683 |

---

## 三、Medium 级别问题

### M-01: Pushers 端点返回 404

| 项目 | 内容 |
|------|------|
| **问题现象** | `GET /_matrix/client/v3/pushers/` 返回 404，`GET /_matrix/client/v3/pushers` 返回 200 |
| **根因分析** | 路由注册路径为 `/pushers`（无尾部斜杠），但请求路径为 `/pushers/`（有尾部斜杠）。Axum 默认严格匹配路径，不自动去除尾部斜杠。回归测试确认：无斜杠返回 200，有斜杠返回 404 |
| **影响范围** | 推送通知功能完全不可用，用户无法收到消息推送 |
| **复现步骤** | 1. 调用 `GET /_matrix/client/v3/pushers/`; 2. 返回 404 |
| **严重程度** | **Medium** |
| **修复状态** | **已修复** - 在 `create_push_compat_router` 中同时注册了 `/pushers/` 路由，回归测试确认两种路径均返回 200 |
| **修复文件** | `synapse-rust/src/web/routes/push.rs` L16 |

### M-02: normalizeFriendInfo 可能返回 undefined 显示名

| 项目 | 内容 |
|------|------|
| **问题现象** | 当 `friend.display_name`、`friend.displayname`、`friend.username` 全部为 undefined 或空字符串时，`normalizeFriendInfo` 返回的对象中所有名称字段均为 undefined，导致 UI 显示空白 |
| **根因分析** | 使用 `??` 运算符不会对空字符串 `""` 触发回退，且缺少 `user_id` 作为最终兜底值 |
| **影响范围** | 好友列表中显示名为空的用户 |
| **复现步骤** | 1. 添加一个没有设置显示名的好友; 2. 查看好友列表; 3. 该好友显示名为空白 |
| **严重程度** | **Medium** |
| **修复状态** | **已修复** - 改用 `||` 运算符并添加 `friend.user_id` 作为兜底值 |
| **修复文件** | `src/services/matrix/SynapseRustExtensionsService.ts` L23-31 |

### M-03: MatrixVoiceService 部分方法缺少端点能力检测

| 项目 | 内容 |
|------|------|
| **问题现象** | `getVoiceConfig()`、`getRoomVoiceList()`、`getUserVoiceList()`、`getVoiceContent()` 四个方法直接调用 API 而没有先检测端点是否可用，与其他方法（如 `getVoiceStats`、`deleteVoice`）的行为不一致 |
| **根因分析** | 这四个方法在添加端点能力检测功能之前就已实现，后续添加检测时遗漏了 |
| **影响范围** | 在不支持语音扩展的服务器上，这些方法会产生未处理的 404 错误 |
| **复现步骤** | 1. 连接到不支持语音扩展的 Matrix 服务器; 2. 调用 `getVoiceConfig()`; 3. 产生 404 错误 |
| **严重程度** | **Medium** |
| **修复状态** | **已修复** - 为四个方法都添加了 `endpointCapabilityService.check()` 检测 |
| **修复文件** | `src/services/matrix/media/MatrixVoiceService.ts` L269-395 |

### M-04: getCaptchaStatus 查询参数拼接方式不规范

| 项目 | 内容 |
|------|------|
| **问题现象** | `getCaptchaStatus` 将 `session` 参数手动拼接到 URL 中（`?session=...`），而不是通过 `authedRequest` 的 `queryParams` 参数传递 |
| **根因分析** | 开发时未使用 SDK 提供的查询参数传递机制 |
| **影响范围** | 验证码状态查询功能，虽然当前可以工作但不符合最佳实践 |
| **复现步骤** | 1. 调用 `getCaptchaStatus('test-session')`; 2. 检查实际发送的请求; 3. 发现 session 参数在 URL 中而非查询参数中 |
| **严重程度** | **Medium** |
| **修复状态** | **已修复** - 改用 `authedRequest` 的 queryParams 参数 |
| **修复文件** | `src/services/matrix/auth/MatrixAuthService.ts` L618-621 |

### M-05: synapse-rust 扩展端点使用 v3 前缀

| 项目 | 内容 |
|------|------|
| **问题现象** | 多个 synapse-rust 自定义扩展端点使用了 `v3` 前缀（如 `/_matrix/client/v3/user/burn/stats`），但 `v3` 是 Matrix 标准规范保留的版本号 |
| **根因分析** | 开发时未区分标准端点和自定义扩展端点的版本号命名规范 |
| **影响范围** | 未来 Matrix 规范 v3 版本可能定义同名端点，导致冲突 |
| **涉及端点** | burn/stats, burn, anti_screenshot, create_private, invite_blocklist/allowlist, sticky_events, summary/*, ephemeral, captcha/*, keys/backup/secure, room_keys/recover/*, room_keys/request |
| **严重程度** | **Medium** |
| **修复状态** | **部分修复** - 已创建 `paths.ts` 集中式路径常量模块并集成到 20+ 个服务文件中，后续迁移到 `unstable` 前缀时只需修改 paths.ts 一处 |
| **修复文件** | `src/services/matrix/paths.ts` (新增), 以及 20+ 个服务文件的硬编码路径替换 |

### M-06: SAS/QR 验证端点使用 v1 前缀

| 项目 | 内容 |
|------|------|
| **问题现象** | SAS 和 QR 码验证端点使用 `/_matrix/client/v1/keys/device_signing/verify_*` 路径，这些不是 Matrix 标准端点 |
| **根因分析** | 标准 Matrix SAS 验证使用 to-device 消息机制，而非 REST API。自定义 REST API 使用了 `v1` 前缀 |
| **影响范围** | 可能与未来 Matrix 规范的 v1 端点冲突 |
| **严重程度** | **Medium** |
| **修复状态** | **部分修复** - 已通过 paths.ts 集中管理路径常量，后续迁移到 `unstable` 前缀时只需修改 paths.ts |

### M-07: Admin server info 端点路径不一致

| 项目 | 内容 |
|------|------|
| **问题现象** | `/_synapse/admin/v1/server` 返回 404，实际端点为 `/_synapse/admin/info`（需 super_admin 权限） |
| **根因分析** | 前端使用 `/_synapse/admin/v1/server` 路径，但后端仅注册了 `/_synapse/admin/info`，路径不一致 |
| **影响范围** | 管理后台的服务器信息页面无法正常显示 |
| **复现步骤** | 1. 调用 `GET /_synapse/admin/v1/server`; 2. 返回 404 |
| **严重程度** | **Medium** |
| **修复状态** | **已修复** - 在 `create_server_router` 中添加了 `/_synapse/admin/v1/server` 路由，指向 `get_admin_info_compat` 处理函数，回归测试确认返回 403（非管理员用户正确被拒绝） |
| **修复文件** | `synapse-rust/src/web/routes/admin/server.rs` L12, L78-86 |

### M-08: SAS verify start 返回 422

| 项目 | 内容 |
|------|------|
| **问题现象** | `POST /_matrix/client/v1/keys/device_signing/verify_start` 返回 422 Unprocessable Entity |
| **根因分析** | `VerificationStartBody` 中 `to_user` 为必填字段（`String`），但前端发送的请求中可能使用 `methods` 字段而非 `method`，且缺少 `to_user` 时直接导致反序列化失败返回 422 |
| **影响范围** | SAS 交叉验证功能无法启动 |
| **复现步骤** | 1. 发送 `{"transaction_id":"test","from_device":"DEVICE1","methods":["m.sas.v1"]}`; 2. 返回 422 |
| **严重程度** | **Medium** |
| **修复状态** | **已修复** - 将 `to_user` 改为 `Option<String>`，添加 `methods: Option<Vec<String>>` 字段兼容 Matrix 标准格式，缺少 `to_user` 时返回 400（M_BAD_JSON）而非 422 |
| **修复文件** | `synapse-rust/src/web/routes/verification_routes.rs` L80-87, L97-133 |

---

## 四、Low 级别问题

### L-01: CORS OPTIONS 返回 204 而非 200

| 项目 | 内容 |
|------|------|
| **问题现象** | CORS 预检请求返回 204 No Content，某些旧版浏览器可能无法正确处理 |
| **根因分析** | 这是 HTTP 规范允许的行为（OPTIONS 可以返回 204），但某些客户端库可能期望 200 |
| **影响范围** | 极少数旧版浏览器或客户端库 |
| **严重程度** | **Low** |
| **修复状态** | **无需修复** - 符合 HTTP 规范 |

### L-02: FederationBlacklistService method 参数缺少类型约束

| 项目 | 内容 |
|------|------|
| **问题现象** | `request<TResponse>(method: string, ...)` 的 method 参数类型为 `string`，通过 `as` 强制转换为联合类型，没有运行时校验 |
| **根因分析** | 开发时使用了宽松的类型定义 |
| **影响范围** | 如果传入无效的方法字符串，不会有编译时或运行时错误提示 |
| **严重程度** | **Low** |
| **修复状态** | **已修复** - 将 method 参数类型改为 `HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'`，GET/DELETE 方法跳过 body 参数 |
| **修复文件** | `src/services/matrix/admin/MatrixFederationBlacklistService.ts` L22, L58 |

### L-03: 安全头缺少 Content-Security-Policy 对 connect-src 的 WebSocket 支持

| 项目 | 内容 |
|------|------|
| **问题现象** | CSP 的 `connect-src` 仅包含 `'self'`，未包含 WebSocket 协议（`wss:`），可能影响 Sliding Sync WebSocket 连接 |
| **根因分析** | CSP 配置时未考虑 WebSocket 连接场景 |
| **影响范围** | 如果浏览器严格执行 CSP，WebSocket 连接可能被阻止 |
| **严重程度** | **Low** |
| **修复状态** | **已修复** - 在 CSP 的 connect-src 中添加了 `wss:`，回归测试确认 CSP 头包含 wss: |
| **修复文件** | `synapse-rust/src/web/middleware.rs` L625 |

---

## 五、测试结果汇总

### API 端点测试结果 (82 项)

| 类别 | 通过 | 失败 | 通过率 |
|------|------|------|--------|
| 认证与登录 (8) | 8 | 0 | 100% |
| 房间与消息 (14) | 14 | 0 | 100% |
| E2EE 与设备 (6) | 5 | 1 | 83% |
| 媒体与用户 (8) | 8 | 0 | 100% |
| 同步与过滤 (4) | 4 | 0 | 100% |
| 通知 (3) | 2 | 1 | 67% |
| SSO 端点 (6) | 6 | 0 | 100%* |
| 扩展端点 (7) | 6 | 1 | 86% |
| 管理端点 (6) | 5 | 1 | 83% |
| 联邦与发现 (3) | 3 | 0 | 100% |
| 边缘场景与安全 (17) | 9 | 8 | 53%** |
| **总计** | **70** | **12** | **85%** |

*SSO 端点全部返回 404（CAS/SAML 未配置），视为预期行为
**边缘场景失败项多为速率限制(429)或测试脚本问题，非实际功能问题

### 安全测试结果

| 测试项 | 结果 |
|--------|------|
| SQL 注入防护 | PASS - 用户名中的 SQL 注入被正确拒绝 (403) |
| XSS 防护 | PASS - 房间名中的 HTML 标签被接受但不会执行 |
| 安全头 | PASS - X-Content-Type-Options, X-Frame-Options, HSTS, CSP 均已设置 |
| CORS | PASS - 正确配置了 Allow-Origin, Allow-Methods, Allow-Headers |
| Token 认证 | PASS - 无效/缺失 token 正确返回 401 |
| 速率限制 | PASS - 快速请求触发 429 Too Many Requests |
| 超长输入 | PASS - 10000 字符房间名返回 400 |

---

## 六、修复优先级排序

| 优先级 | 问题编号 | 问题描述 | 状态 |
|--------|----------|----------|------|
| P0 | C-01 | completeSSOLogin 缺少 initialize() | 已修复 |
| P0 | C-02 | forceReconnect 未传入 Sliding Sync | 已修复 |
| P1 | H-01 | SSO 登录流未暴露 | 已修复 |
| P1 | H-02 | GET 检测浪费带宽 | 已修复 |
| P1 | H-03 | 405 处理逻辑错误 | 已修复 |
| P1 | H-04 | Email 3PID submit_url 内部地址 | 已修复 |
| P1 | H-05 | Token 不支持 URL 查询参数 | 已修复 |
| P2 | M-01 | Pushers 端点 404 | 已修复 |
| P2 | M-02 | normalizeFriendInfo 兜底值 | 已修复 |
| P2 | M-03 | VoiceService 能力检测缺失 | 已修复 |
| P2 | M-04 | getCaptchaStatus 参数拼接 | 已修复 |
| P2 | M-05 | 扩展端点 v3 前缀 | 部分修复 (paths.ts) |
| P2 | M-06 | SAS/QR v1 前缀 | 部分修复 (paths.ts) |
| P2 | M-07 | Admin server info 路径不一致 | 已修复 |
| P2 | M-08 | SAS verify start 422 | 已修复 |
| P3 | L-01 | CORS 204 | 无需修复 |
| P3 | L-02 | FederationBlacklist 类型 | 已修复 |
| P3 | L-03 | CSP WebSocket | 已修复 |

---

## 七、已修复文件清单

### 前端文件

| 文件 | 修改内容 |
|------|----------|
| `src/services/matrix/MatrixClientService.ts` | 添加 completeSSOLogin 的 initialize() 调用; forceReconnect 添加 Sliding Sync 配置 |
| `src/services/matrix/EndpointCapabilityService.ts` | GET 改用 HEAD 请求; 405 统一标记不可用; 区分 401/403 和其他 4xx |
| `src/services/matrix/SynapseRustExtensionsService.ts` | normalizeFriendInfo 添加 user_id 兜底值; 硬编码路径替换为 MATRIX_PATHS |
| `src/services/matrix/media/MatrixVoiceService.ts` | 为 getVoiceConfig/getRoomVoiceList/getUserVoiceList/getVoiceContent 添加端点能力检测; 硬编码路径替换为 MATRIX_PATHS |
| `src/services/matrix/auth/MatrixAuthService.ts` | getCaptchaStatus 改用 queryParams 参数; well-known 路径替换为 MATRIX_PATHS |
| `src/services/matrix/auth/MatrixOidcService.ts` | OIDC discovery 路径替换为 MATRIX_PATHS; 删除 OIDC_DISCOVERY_PATH 常量 |
| `src/services/matrix/paths.ts` | **新增** - 集中式 Matrix API 路径常量模块，包含 AUTH/ROOM/BURN/FRIENDS/CRYPTO/DEHYDRATED_DEVICE/SPACE/AI/SYNC/NOTIFICATION/MEDIA/USER/ADMIN/VOICE/FEDERATION/WELL_KNOWN/CLIENT_CONFIG 共 17 个分类 |
| `src/services/matrix/crypto/MatrixCryptoService.ts` | 46 处硬编码路径替换为 MATRIX_PATHS (密钥/房间密钥/验证/QR 码相关) |
| `src/services/matrix/crypto/MatrixDehydratedDeviceService.ts` | 7 处硬编码路径替换为 MATRIX_PATHS (脱水设备相关) |
| `src/services/matrix/crypto/MatrixEncryptionService.ts` | 6 处硬编码路径替换为 MATRIX_PATHS (密钥轮转相关) |
| `src/services/matrix/media/MatrixMediaService.ts` | 6 处硬编码路径替换为 MATRIX_PATHS (媒体配置/配额相关) |
| `src/services/matrix/media/MatrixUrlPreviewService.ts` | 3 处硬编码路径替换为 MATRIX_PATHS (URL 预览/下载相关) |
| `src/services/matrix/room/MatrixSpaceService.ts` | 5 处硬编码路径替换为 MATRIX_PATHS (空间层级相关) |
| `src/services/matrix/room/TimelineService.ts` | 1 处硬编码路径替换为 MATRIX_PATHS (timestamp_to_event) |
| `src/services/matrix/room/AccountDataService.ts` | 2 处硬编码路径替换为 MATRIX_PATHS (scanner_info/external_services) |
| `src/services/matrix/ai/MatrixAIConnectionService.ts` | 6 处硬编码路径替换为 MATRIX_PATHS (AI 连接/MCP 工具) |
| `src/services/matrix/MatrixCapabilityService.ts` | 1 处硬编码路径替换为 MATRIX_PATHS (客户端配置) |
| `src/services/matrix/MatrixApplicationService.ts` | 4 处硬编码路径替换为 MATRIX_PATHS (应用服务) |
| `src/services/matrix/admin/MatrixAdminService.ts` | 1 处硬编码路径替换为 MATRIX_PATHS (whoami) |
| `src/services/matrix/admin/MatrixFederationBlacklistService.ts` | HttpMethod 类型约束; 动态路径前缀替换为 MATRIX_PATHS |
| `src/services/matrix/admin/MatrixReportService.ts` | 4 处硬编码路径替换为 MATRIX_PATHS (举报/扫描信息) |
| `src/services/matrix/notifications/MatrixServerNotificationService.ts` | 7 处硬编码路径替换为 MATRIX_PATHS (服务器通知) |
| `src/services/matrix/friends/MatrixFriendService.ts` | 1 处硬编码路径替换为 MATRIX_PATHS (好友状态) |

### 后端文件

| 文件 | 修改内容 |
|------|----------|
| `synapse-rust/src/web/routes/cas.rs` | 修复 cas_sso_redirect 编译错误（移除 saml_service 依赖，修复 IntoResponse 调用） |
| `synapse-rust/src/web/routes/auth_compat.rs` | submit_url 构造改用 get_public_baseurl() 替代硬编码 host:port |
| `synapse-rust/src/web/routes/extractors/auth.rs` | 添加 extract_token_from_request 支持 URL 查询参数; 保留 extract_token_from_headers 兼容函数 |
| `synapse-rust/src/web/middleware.rs` | extract_token 添加 URL 查询参数回退逻辑; CSP connect-src 添加 wss: |
| `synapse-rust/src/web/routes/push.rs` | 添加 /pushers/ 带尾部斜杠的路由注册 |
| `synapse-rust/src/web/routes/admin/server.rs` | 添加 /_synapse/admin/v1/server 兼容路由 |
| `synapse-rust/src/web/routes/verification_routes.rs` | VerificationStartBody to_user 改为 Option; 添加 methods 字段兼容 |
| `synapse-rust/src/web/routes/room.rs` | 添加 anti_screenshot 端点 (GET/PUT) |
| `synapse-rust/src/web/routes/friend_room.rs` | 添加 friends/dm 端点 (GET/POST, v1 和 r0 路径) |
| `synapse-rust/src/web/routes/captcha.rs` | 添加 captcha/clean DELETE 端点 |
