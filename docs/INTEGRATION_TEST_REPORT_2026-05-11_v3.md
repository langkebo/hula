# HuLa 前后端联调测试报告 v3

**测试日期**: 2026-05-11
**后端版本**: synapse-rust 0.1.0 (本地构建)
**前端版本**: HuLa (Tauri v2 + Vue 3)
**测试环境**: https://matrix.test
**测试方法**: API 端点直接调用 + 前端服务层代码审查

---

## 测试环境信息

| 组件 | 版本/状态 |
|------|----------|
| synapse-rust | 0.1.0 (Docker 本地构建, healthy) |
| PostgreSQL | 16-alpine (healthy) |
| Redis | 7-alpine (healthy) |
| Nginx | 1.27-alpine (healthy) |
| 支持的 Matrix 版本 | r0.5.0 ~ v1.13 |
| 默认房间版本 | 10 |
| unstable_features | m.lazy_load_members, m.require_identity_server, m.supports_login_via_phone_number, org.matrix.msc3245/3266/3882/3916/3983 |

---

## 问题清单

### Critical (2)

#### C-01: 好友请求发送接口无响应体

| 项目 | 详情 |
|------|------|
| **问题现象** | `POST /_matrix/client/v1/friends/requests/send` 返回空响应体（HTTP 200 但无 JSON），前端无法判断请求是否成功 |
| **复现步骤** | 1. 注册用户 A 和 B; 2. 用 A 的 token 调用 `POST /v1/friends/requests/send` body `{"target_user_id":"@B:matrix.test"}`; 3. 观察返回值 |
| **实际响应** | 空字符串 |
| **期望响应** | `{"request_id":"...","status":"pending"}` 或至少 `{}` |
| **影响范围** | 好友系统核心流程，所有用户的好友添加功能 |
| **严重程度** | **Critical** |
| **优化方案** | 后端 `friends/requests/send` 端点需返回 JSON 响应体，至少包含请求状态和 request_id |
| **优先级** | P0 |

#### C-02: 好友请求接受后好友列表仍为空

| 项目 | 详情 |
|------|------|
| **问题现象** | 用户 A 向 B 发送好友请求，B 调用 `accept` 接口后，A 的好友列表 `GET /v1/friends` 仍返回 `friends:[], items:[]` |
| **复现步骤** | 1. A 发送好友请求给 B; 2. B 调用 `POST /v1/friends/requests/accept`; 3. A 查询 `GET /v1/friends`; 4. 好友列表仍为空 |
| **实际响应** | `{"cached":true,"friends":[],"items":[],"total":0}` |
| **期望响应** | `friends` 或 `items` 中包含对方用户信息 |
| **影响范围** | 好友系统核心功能完全不可用 |
| **严重程度** | **Critical** |
| **优化方案** | 检查后端 `accept` 端点是否正确更新了双向好友关系；确认 `friends` 列表查询是否正确 JOIN 了好友关系表 |
| **优先级** | P0 |

---

### High (4)

#### H-01: 好友列表响应格式双字段冗余

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v1/friends` 同时返回 `friends` 和 `items` 两个空数组字段，前端不确定应消费哪个字段 |
| **复现步骤** | 调用 `GET /_matrix/client/v1/friends` |
| **实际响应** | `{"cached":true,"friends":[],"generated_ts":...,"items":[],"limit":50,"next_offset":null,"offset":0,"room_id":"!xxx","total":0,"version":1}` |
| **期望行为** | 只保留一个字段（推荐 `items` 作为分页数据，`friends` 作为兼容别名标记为 deprecated） |
| **影响范围** | 前端好友列表渲染逻辑需要同时处理两个字段，增加维护复杂度 |
| **严重程度** | **High** |
| **优化方案** | 后端统一响应格式，推荐保留 `items` 作为分页数据源，`friends` 标记为 deprecated；前端优先消费 `items`，`friends` 作为 fallback |
| **优先级** | P1 |

#### H-02: CAPTCHA 发送接口内部错误

| 项目 | 详情 |
|------|------|
| **问题现象** | `POST /_matrix/client/r0/register/captcha/send` 返回 `M_UNKNOWN: An internal error occurred` |
| **复现步骤** | 1. 使用已登录用户 token; 2. 调用 `POST /r0/register/captcha/send` body `{"target":"13800138000","captcha_type":"sms"}` |
| **实际响应** | `{"errcode":"M_UNKNOWN","error":"An internal error occurred"}` |
| **期望响应** | `{"success":true,"captcha_id":"..."}` 或明确的错误码 |
| **影响范围** | 忘记密码流程中的验证码功能不可用 |
| **严重程度** | **High** |
| **优化方案** | 1. 检查后端 CAPTCHA 服务配置（SMS 网关是否配置）; 2. 返回更具体的错误码（如 `M_CAPTCHA_SERVICE_UNAVAILABLE`）; 3. 前端添加降级处理 |
| **优先级** | P1 |

#### H-03: AI Connections 和 MCP Tools 端点返回空响应

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v1/ai/connections` 和 `GET /v1/mcp/tools` 返回空字符串（HTTP 200 但无 JSON） |
| **复现步骤** | 使用已登录用户 token 调用上述端点 |
| **实际响应** | 空字符串 |
| **期望响应** | `{"connections":[]}` 或 `{"tools":[]}` |
| **影响范围** | AI 连接管理功能前端无法正常渲染（空响应导致 JSON 解析失败） |
| **严重程度** | **High** |
| **优化方案** | 后端需确保即使无数据也返回有效的 JSON 空数组响应 |
| **优先级** | P1 |

#### H-04: Special Friends 端点返回空响应

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v1/friends/special` 返回空字符串 |
| **复现步骤** | 使用已登录用户 token 调用 |
| **实际响应** | 空字符串 |
| **期望响应** | `{"users":[]}` 或类似结构 |
| **影响范围** | 特别关注好友功能前端解析失败 |
| **严重程度** | **High** |
| **优化方案** | 后端返回有效 JSON 响应 |
| **优先级** | P1 |

---

### Medium (5)

#### M-01: Profile API 对 URL 编码的 user_id 处理异常

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v3/profile/@testuser1:matrix.test` 返回 `M_INVALID_PARAM: Invalid user_id format: must start with @` |
| **复现步骤** | 直接使用 `@testuser1:matrix.test` 作为 URL 路径参数调用 profile 端点 |
| **根因分析** | Nginx 或后端对 `@` 符号的 URL 编码处理不一致，`@` 被 URL 编码为 `%40` 后后端可能未正确解码 |
| **影响范围** | 前端获取用户资料失败 |
| **严重程度** | **Medium** |
| **优化方案** | 1. 后端确保正确解码 URL 编码的 user_id; 2. 前端调用时使用 `encodeURIComponent()` 编码 user_id |
| **优先级** | P2 |

#### M-02: Account Data 查询权限判断过于严格

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v3/user/@testuser1:matrix.test/account_data/m.direct` 返回 `M_FORBIDDEN: Cannot get account data for other users`，但请求者就是该用户本人 |
| **复现步骤** | 使用 @testuser1 的 token 请求自己的 account_data |
| **根因分析** | 可能是 user_id URL 编码问题（同 M-01），后端将编码后的 user_id 视为不同用户 |
| **影响范围** | DM 房间映射获取失败，可能导致 DM 列表显示异常 |
| **严重程度** | **Medium** |
| **优化方案** | 同 M-01，确保 URL 解码一致性 |
| **优先级** | P2 |

#### M-03: Token 刷新接口错误信息不明确

| 项目 | 详情 |
|------|------|
| **问题现象** | `POST /v3/refresh` 使用 refresh_token 时返回 `M_UNAUTHORIZED: Invalid refresh token` |
| **复现步骤** | 使用注册返回的 refresh_token 调用 refresh 接口 |
| **根因分析** | 可能是 refresh_token 格式或传递方式不匹配 |
| **影响范围** | 长时间使用后 token 过期无法自动刷新，用户需重新登录 |
| **严重程度** | **Medium** |
| **优化方案** | 1. 验证 refresh_token 的存储和验证逻辑; 2. 确认前端传递 refresh_token 的字段名是否与后端一致 |
| **优先级** | P2 |

#### M-04: Admin API 对非管理员返回 M_FORBIDDEN 而非能力检测

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /_synapse/admin/v1/whoami` 对非管理员用户返回 `M_FORBIDDEN`，前端无法区分"不是管理员"和"Admin API 不可用" |
| **复现步骤** | 使用普通用户 token 调用 admin 端点 |
| **影响范围** | 前端 Admin 面板能力检测依赖错误码判断，可能误判 |
| **严重程度** | **Medium** |
| **优化方案** | 前端已通过 `capabilities` API 的 `io.hula.admin` 标志进行能力检测，不依赖 admin API 的错误码。但建议后端在 capabilities 中明确暴露 admin-api 可用性 |
| **优先级** | P2 |

#### M-05: Device 列表缺少 last_seen_ip 和 last_seen_ts 格式

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v3/devices` 返回的设备信息中 `last_seen_ts` 为时间戳数字，缺少 `last_seen_ip` 字段 |
| **实际响应** | `{"devices":[{"device_id":"vYENninxftdzBNrH0vh0bg","display_name":null,"last_seen_ts":1778458015646}]}` |
| **期望响应** | 包含 `last_seen_ip`、`last_seen_ts`（ISO 格式或时间戳均可）和 `user_id` 字段 |
| **影响范围** | 设备管理页面信息展示不完整 |
| **严重程度** | **Medium** |
| **优化方案** | 后端补充 `last_seen_ip` 字段；前端对缺失字段做容错处理 |
| **优先级** | P2 |

---

### Low (3)

#### L-01: Capabilities 响应中 io.hula.friends 结构不规范

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v3/capabilities` 返回 `capabilities.io.hula.friends` 为 `{"enabled":true}` 而非布尔值，同时 `unstable_features.io.hula.friends` 为 `true`（布尔值） |
| **实际响应** | `{"capabilities":{"io.hula.friends":{"enabled":true},...},"unstable_features":{"io.hula.friends":true}}` |
| **影响范围** | 前端能力检测逻辑需要同时检查两处，增加复杂度 |
| **严重程度** | **Low** |
| **优化方案** | 统一为 `capabilities.io.hula.friends: true`（布尔值），与 Matrix 规范保持一致 |
| **优先级** | P3 |

#### L-02: Client Config 缺少 io.hula.admin 能力标志

| 项目 | 详情 |
|------|------|
| **问题现象** | `GET /v1/config/client` 的 `features` 中包含 `e2ee/spaces/threads/voip` 但缺少 `admin` 标志 |
| **影响范围** | 前端需要额外调用 capabilities API 检测 admin 能力 |
| **严重程度** | **Low** |
| **优化方案** | 在 client config 的 features 中添加 `"admin": true/false` |
| **优先级** | P3 |

#### L-03: Reaction 事件 ID 格式异常

| 项目 | 详情 |
|------|------|
| **问题现象** | 发送 Reaction 后返回的 event_id 格式为 `$1778458106967$e-izHhzJ3HN09YNMfhpvde0q:`（末尾缺少 server_name） |
| **实际响应** | `{"event_id":"$1778458106967$e-izHhzJ3HN09YNMfhpvde0q:"}` |
| **期望响应** | `{"event_id":"$1778458106967$e-izHhzJ3HN09YNMfhpvde0q:matrix.test"}` |
| **影响范围** | 可能导致事件引用异常，影响 Reaction 关联 |
| **严重程度** | **Low** |
| **优化方案** | 后端检查 event_id 生成逻辑，确保包含完整的 server_name |
| **优先级** | P3 |

---

## 正常工作的功能

| 功能 | 状态 | 备注 |
|------|------|------|
| 用户注册 (m.login.dummy) | ✅ | 返回 access_token, refresh_token, device_id |
| 用户登录 (m.login.password) | ✅ | 正常返回 |
| WHOAMI | ✅ | 正确返回 user_id 和 device_id |
| Capabilities | ✅ | 包含 io.hula.friends 标志 |
| 创建房间 | ✅ | 正常创建，返回 room_id |
| 创建空间 (m.space) | ✅ | 正常创建，room_type 正确 |
| 空间添加子房间 | ✅ | m.space.child 事件正常 |
| 空间层级查询 | ✅ | 正确返回父子关系 |
| 发送消息 | ✅ | 正常返回 event_id |
| 消息搜索 | ✅ | 搜索结果正确 |
| 输入通知 (typing) | ✅ | 返回 expires_at |
| 已读回执 (m.read) | ✅ | 正常标记 |
| 消息撤回 (redact) | ✅ | 正常撤回 |
| 在线状态 (presence) | ✅ | 设置和查询均正常 |
| 修改昵称 (displayname) | ✅ | 正常更新 |
| 修改头像 (avatar_url) | ✅ | 正常更新 |
| 推送规则 (pushrules) | ✅ | 5 个分类均返回 |
| 媒体上传 | ✅ | 返回 mxc:// URI |
| 用户目录搜索 | ✅ | 搜索结果正确 |
| 阅后即焚 (burn_after_read) | ✅ | 状态事件正常设置 |
| Sync | ✅ | 正确返回 rooms 和 presence |
| 设备列表 | ✅ | 返回设备信息（字段不完整） |
| Client Config | ✅ | 返回完整配置 |
| Public Rooms | ✅ | 正常返回空列表 |
| DM 创建 | ✅ | is_direct 正常设置 |

---

## 优先级排序

| 优先级 | 问题ID | 问题摘要 |
|--------|--------|----------|
| P0 | C-01 | 好友请求发送无响应体 |
| P0 | C-02 | 好友接受后列表仍为空 |
| P1 | H-01 | 好友列表双字段冗余 |
| P1 | H-02 | CAPTCHA 发送内部错误 |
| P1 | H-03 | AI/MCP 端点空响应 |
| P1 | H-04 | Special Friends 空响应 |
| P2 | M-01 | Profile URL 编码问题 |
| P2 | M-02 | Account Data 权限误判 |
| P2 | M-03 | Token 刷新失败 |
| P2 | M-04 | Admin API 能力检测 |
| P2 | M-05 | Device 列表字段不完整 |
| P3 | L-01 | Capabilities 格式不规范 |
| P3 | L-02 | Client Config 缺 admin 标志 |
| P3 | L-03 | Reaction event_id 格式异常 |

---

## 前端已实施的优化措施

基于本次联调测试结果，前端已实施以下优化：

1. **Promise.allSettled 迁移** (10处) - 防止部分 API 失败导致整体功能不可用
2. **Admin API 能力检测** - 通过 capabilities API 检测，不依赖 admin 端点错误码
3. **好友列表双字段容错** - 同时消费 `friends` 和 `items` 字段
4. **CAPTCHA UI 集成** - 添加验证码图片展示和验证流程
5. **通知配置 account_data 同步** - DND 设置跨设备同步
6. **QR Login Bridge Service** - 优先使用 SDK 后端交互，降级到 localStorage
7. **AI Connection 设置页面** - 新增 AI 连接管理标签页
8. **JSON.parse 安全校验** - 关键数据添加 schema 校验
9. **shiki-core 按需加载** - 减少首屏加载体积
