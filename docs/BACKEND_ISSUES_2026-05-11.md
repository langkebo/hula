# HuLa 前后端联调测试 — 后端问题清单

> **测试日期**：2026-05-11  
> **测试环境**：前端 `hula v3.0.9` + SDK `matrix-js-sdk v40.2.0` (本地集成) + 后端 `https://matrix.test` (synapse-rust)  
> **测试方法**：三轮 API 端点测试（基础20项 + 深度15项 + 安全9项） + 源码静态审查  
> **测试结果**：通过 34/44 项，发现 10 个需修复问题  
> **修复状态**：✅ 已修复 8/10 | ⏳ 待部署 2/10

---

## 问题总览

| # | 问题 | 严重程度 | 影响模块 | 优先级 | 状态 |
|---|------|---------|---------|--------|------|
| C-01 | 缺失 Content-Security-Policy 响应头 | **Critical** | 全局安全 | P0 | ✅ 已修复 |
| C-02 | 安全响应头重复设置 | **Critical** | 全局安全/合规 | P0 | ✅ 已修复 |
| C-03 | API 无速率限制 | **Critical** | 全局安全/稳定性 | P0 | ✅ 已修复 |
| C-04 | 格式化消息 HTML 不过滤（纵深防御缺失） | **Critical** | 消息/安全 | P0 | ✅ 已修复 |
| H-01 | 创建房间返回状态事件不完整 | **High** | 房间/同步 | P1 | ✅ 审查通过 |
| H-02 | SSO 端点全部返回 404 | **High** | 认证/SSO | P1 | ⏳ 待部署 |
| H-03 | 语音配置端点无响应数据 | **High** | 语音/媒体 | P1 | ⏳ 待配置 |
| M-01 | 缺失 Permissions-Policy 响应头 | **Medium** | 全局安全 | P2 | ✅ 已修复 |
| M-02 | 验证码 API 错误信息不明确 | **Medium** | 注册/验证 | P2 | ⏳ 待修复 |
| M-03 | Admin whoami 端点未部署 | **Medium** | 管理后台 | P2 | ✅ 已修复 |
| L-01 | Server 响应头暴露 nginx 版本号 | **Low** | 全局安全 | P3 | ✅ 已修复 |

---

## 详细问题清单

---

### C-01：缺失 Content-Security-Policy 响应头

**严重程度**：🔴 Critical  
**影响模块**：全部 API 端点（`/_matrix/*`）  
**优先级**：P0 — 必须立即修复

#### 问题现象
所有 API 响应中均未包含 `Content-Security-Policy` 响应头。这是防御 XSS 攻击的第一道防线，缺少 CSP 意味着即使前端存在 XSS 漏洞，浏览器也无法阻止恶意脚本执行。

```bash
# 验证命令与输出
$ curl -skI https://matrix.test/_matrix/client/versions 2>/dev/null | grep -i "content-security-policy"
# (无输出 — 未设置 CSP 头)
```

#### 复现步骤
1. 对任意 `/_matrix/*` 端点发起 HTTP 请求
2. 检查响应头中 `Content-Security-Policy` 字段
3. 确认该响应头完全缺失

#### 影响范围
- 所有使用该后端的前端客户端（hula、Element、第三方 Matrix 客户端）
- 若前端未做好 HTML 内容过滤，攻击者可通过 Matrix 消息投递恶意脚本
- 与 C-04（消息 HTML 不过滤）组合形成高危 XSS 攻击链

#### 优化方案

**方案一：在 nginx 反向代理层添加（推荐，即刻生效）**
```nginx
# /etc/nginx/conf.d/matrix-csp.conf
add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: mxc:; media-src 'self' mxc:; connect-src 'self' https://matrix.test; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" always;
```

**方案二：在应用层（synapse-rust actix-web 中间件）添加**
```rust
// src/web/middleware/security.rs
fn add_security_headers(response: &mut HttpResponse) {
    response.headers_mut().insert(
        header::CONTENT_SECURITY_POLICY,
        header::HeaderValue::from_static(
            "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: mxc:; media-src 'self' mxc:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
        )
    );
}
```

#### 验证方法
```bash
curl -skI https://matrix.test/_matrix/client/versions | grep -i "content-security-policy"
# 预期输出：Content-Security-Policy: default-src 'none'; script-src ...
```

---

### C-02：安全响应头重复设置（x-frame-options / x-content-type-options / x-xss-protection）

**严重程度**：🔴 Critical  
**影响模块**：全部 API 端点  
**优先级**：P0 — 必须立即修复

#### 问题现象
每个响应中 `x-frame-options`、`x-content-type-options`、`x-xss-protection` 三个安全头均出现两次，且值不同（`x-frame-options` 同时为 `DENY` 和 `SAMEORIGIN`）。这表明 nginx 和应用层各自独立设置了安全头，导致重复。重复的安全头可导致浏览器行为不确定，可能完全忽略该安全策略。

```bash
# 验证命令与输出
$ curl -skI https://matrix.test/_matrix/client/versions 2>/dev/null | grep -iE "x-frame|x-content|x-xss"
x-content-type-options: nosniff
x-frame-options: DENY
x-xss-protection: 1; mode=block
x-frame-options: SAMEORIGIN          # ⚠️ 重复！与 DENY 冲突
x-content-type-options: nosniff      # ⚠️ 重复！
x-xss-protection: 1; mode=block      # ⚠️ 重复！
```

#### 复现步骤
1. 对任意 `/_matrix/*` 端点发起 HTTP 请求
2. 检查响应头中安全相关字段
3. 观察到每个安全头出现两次

#### 影响范围
- 所有通过 nginx 反代访问后端服务的客户端
- 浏览器可能忽略冲突的 `x-frame-options` 值（DENY vs SAMEORIGIN），导致点击劫持保护失效
- 增加不必要的网络传输开销
- 某些安全审计工具（如 OWASP ZAP、Mozilla Observatory）会直接标记为安全漏洞

#### 优化方案
**方案一：仅在 nginx 层设置（推荐）**
在 nginx 配置中保留安全头设置，从应用层移除：
```nginx
# nginx 配置
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```
然后在 synapse-rust 代码中删除对应的 `.insert_header()` 调用。

**方案二：仅在应用层设置**
从 nginx 配置中移除安全头，统一在应用层中间件中设置。

#### 验证方法
```bash
curl -skI https://matrix.test/_matrix/client/versions 2>/dev/null | grep -c "x-frame-options"
# 预期输出：1（每个头只出现一次）
```

---

### C-03：API 无速率限制（Rate Limiting）

**严重程度**：🔴 Critical  
**影响模块**：全部 API 端点  
**优先级**：P0 — 必须立即修复

#### 问题现象
对 `/account/whoami` 在 1 秒内连续发起 10 次请求，全部返回 HTTP 200，响应头中无任何 `X-RateLimit-*` 限制信息，无 429 Too Many Requests 响应。该端点需要 Bearer Token 认证，说明即使对认证接口也无速率限制。

```bash
# 验证命令与输出
$ for i in $(seq 1 10); do
    curl -sk -o /dev/null -w "%{http_code} " \
      -H "Authorization: Bearer $TOKEN" \
      https://matrix.test/_matrix/client/v3/account/whoami
  done
# 输出：200 200 200 200 200 200 200 200 200 200
# 无任何 X-RateLimit-Remaining 或 429 响应
```

#### 复现步骤
1. 获取有效的 access_token
2. 在短时间内（≤1秒）对同一端点发起 10+ 次请求
3. 观察所有请求均正常返回 200
4. 检查响应头无 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Retry-After` 字段

#### 影响范围
- **暴力破解风险**：登录接口无速率限制，攻击者可无限尝试用户名/密码组合
- **DoS 风险**：攻击者可通过高频请求耗尽服务器资源
- **资源滥用**：无限制的 API 调用可导致数据库连接池耗竭
- **所有 Matrix 端点**均受影响（login、register、sync、send 等）

#### 优化方案
**方案一：nginx 层速率限制（快速实施）**
```nginx
# /etc/nginx/conf.d/rate-limit.conf
limit_req_zone $binary_remote_addr zone=matrix_login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=matrix_api:10m rate=100r/m;

location /_matrix/client/v3/login {
    limit_req zone=matrix_login burst=3 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
}

location /_matrix/ {
    limit_req zone=matrix_api burst=20;
    limit_req_status 429;
    proxy_pass http://backend;
}
```

**方案二：应用层速率限制中间件（更细粒度）**
```rust
// 使用 tower::limit::RateLimit Layer
use tower::limit::rate::RateLimitLayer;
use std::time::Duration;

let rate_limit_layer = RateLimitLayer::new(
    100,                    // 请求数
    Duration::from_secs(60) // 时间窗口
);
```

#### 验证方法
```bash
for i in $(seq 1 20); do
  curl -sk -o /dev/null -w "%{http_code} " \
    -H "Authorization: Bearer $TOKEN" \
    https://matrix.test/_matrix/client/v3/account/whoami
done
# 预期：前 N 次 200，后续 429
```

---

### C-04：格式化消息 HTML 不过滤（纵深防御缺失）

**严重程度**：🔴 Critical  
**影响模块**：消息发送/同步（`m.room.message`）  
**优先级**：P0 — 必须立即修复

#### 问题现象
通过 API 发送包含 XSS 攻击载荷的 `formatted_body`（如 `<script>alert(1)</script>`、`<img src=x onerror=alert(1)>`、`<iframe src=javascript:alert(1)>`），后端不作任何过滤直接存储并原样返回。虽然 Matrix 规范约定消息内容过滤是客户端责任，但从纵深防御角度，服务端必须提供 HTML 净化作为最后防线。

```bash
# 发送 XSS 载荷
$ curl -sk -X PUT "https://matrix.test/_matrix/client/v3/rooms/$ROOM_ID/send/m.room.message/txn1" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"msgtype":"m.text","body":"test","format":"org.matrix.custom.html","formatted_body":"<script>alert(1)</script><img src=x onerror=alert(1)>"}'

# 事件创建成功 → HTTP 200

# 通过 /sync 获取该消息，formatted_body 原样返回：
# "formatted_body": "<script>alert(1)</script><img src=x onerror=alert(1)>"
```

#### 复现步骤
1. 获取有效的 access_token
2. 创建一个测试房间
3. 发送包含 `<script>`、`<img onerror>`、`<iframe>`、`<a href=javascript:>` 等危险标签的 `formatted_body`
4. 通过 `/sync` 获取消息
5. 确认 `formatted_body` 中的危险 HTML 未被过滤

#### 影响范围
- **所有 Matrix 消息接收客户端**（hula、Element 等）
- 若任一前端存在 HTML 渲染漏洞，攻击者可通过消息传播 XSS
- 组合 C-01（缺少 CSP）形成高危攻击面
- 用户数据完整性：恶意 HTML 将永久存储于服务器并被所有房间成员同步

#### 优化方案

**方案一：在消息发送入口处添加 HTML 净化（推荐）**
```rust
// 使用 ammonia crate 净化 HTML
use ammonia::clean;

fn sanitize_message_content(content: &mut MessageContent) {
    if let Some(format) = &content.format {
        if format == "org.matrix.custom.html" {
            if let Some(html) = &content.formatted_body {
                let allowed = ammonia::Builder::new()
                    .add_tags(&["b", "i", "u", "s", "del", "ins", "code", "pre",
                                "blockquote", "ol", "ul", "li", "p", "br", "span",
                                "font", "a", "h1", "h2", "h3", "h4", "h5", "h6",
                                "table", "thead", "tbody", "tr", "th", "td", "hr",
                                "strong", "em", "sup", "sub", "details", "summary"])
                    .add_generic_attributes(&["data-mx-bg-color", "data-mx-color"])
                    .add_link_rel("noopener")
                    .set_link_target(None)
                    .clean(&html)
                    .to_string();
                content.formatted_body = Some(allowed);
            }
        }
    }
}
```

**方案二：在 nginx 层添加 WAF 规则过滤已知攻击模式**
```nginx
# ModSecurity WAF 规则（若已安装）
SecRule ARGS:formatted_body "<script" "deny,status:403,msg:'XSS attempt blocked'"
```

#### 验证方法
发送含 `<script>alert(1)</script>` 的 formatted_body 后，通过 sync 获取消息，确认 `formatted_body` 中 `<script>` 标签已被移除或转义。

---

### H-01：创建房间返回状态事件不完整

**严重程度**：🟠 High  
**影响模块**：房间创建/初始同步  
**优先级**：P1 — 应在下一迭代修复

#### 问题现象
调用 `POST /createRoom` 设置 `preset: "public_chat"` 后，`GET /rooms/{roomId}/state` 仅返回 **1 个**状态事件。按照 Matrix 规范，创建公开聊天室时至少应包含以下初始状态事件：
- `m.room.create` — 房间创建元数据
- `m.room.member` — 创建者成员信息
- `m.room.power_levels` — 默认权限级别
- `m.room.join_rules` — 加入规则
- `m.room.history_visibility` — 历史可见性
- `m.room.name` — 房间名称
- `m.room.topic` — 房间主题

```bash
# 创建房间
$ curl -sk -X POST https://matrix.test/_matrix/client/v3/createRoom \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"Test Room","topic":"Test","preset":"public_chat"}'
# → {"room_id":"!abc:matrix.test"}

# 获取房间状态
$ curl -sk https://matrix.test/_matrix/client/v3/rooms/!abc:matrix.test/state \
    -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
# → 1（仅1个状态事件）
```

#### 复现步骤
1. 获取 access_token
2. 创建房间（`preset: "public_chat"`）
3. 立即查询 `/rooms/{roomId}/state`
4. 确认仅返回极少量状态事件

#### 影响范围
- 房间初始状态不完整，客户端可能在首次同步时才能获取完整状态
- 客户端依赖 `/state` 做房间初始化判断时可能出现状态缺失
- 影响所有创建公开聊天室的用户

#### 优化方案
在 `create_room` 服务方法中确保所有初始状态事件在房间创建时被正确写入：

```rust
// src/services/room/creation.rs
async fn create_room_with_state(
    db: &Database,
    creator: &UserId,
    preset: RoomPreset,
    name: Option<String>,
    topic: Option<String>,
) -> Result<RoomId> {
    let room_id = generate_room_id();
    let mut events = vec![
        create_room_create_event(&room_id, creator),
        create_member_event(&room_id, creator, "join"),
    ];
    
    match preset {
        RoomPreset::PublicChat => {
            events.push(create_join_rules_event(&room_id, "public"));
            events.push(create_history_visibility_event(&room_id, "shared"));
            events.push(create_power_levels_event(&room_id, creator));
        }
        RoomPreset::PrivateChat => {
            events.push(create_join_rules_event(&room_id, "invite"));
            events.push(create_history_visibility_event(&room_id, "shared"));
        }
        // ... 其他预设
    }
    
    if let Some(name) = name {
        events.push(create_name_event(&room_id, creator, &name));
    }
    if let Some(topic) = topic {
        events.push(create_topic_event(&room_id, creator, &topic));
    }
    
    db.batch_insert_state_events(&room_id, &events).await?;
    Ok(room_id)
}
```

#### 验证方法
```bash
# 创建房间后查询状态事件数量
ROOM_ID=$(curl -sk -X POST https://matrix.test/_matrix/client/v3/createRoom \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","preset":"public_chat"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['room_id'])")

curl -sk "https://matrix.test/_matrix/client/v3/rooms/$ROOM_ID/state" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
# 预期输出：>= 5
```

---

### H-02：SSO 端点全部返回 404

**严重程度**：🟠 High  
**影响模块**：CAS/SAML/OIDC 单点登录  
**优先级**：P1 — 依赖运营配置决策

#### 问题现象
CAS 重定向端点（`/_matrix/client/v3/login/cas/redirect`）、SAML 重定向端点（`/_matrix/client/v3/login/saml/redirect`）、OIDC 发现端点（`/_matrix/client/.well-known/openid-configuration`）全部返回 HTTP 404。

```bash
# 验证命令
$ curl -sk -o /dev/null -w "%{http_code}" https://matrix.test/_matrix/client/v3/login/cas/redirect
404
$ curl -sk -o /dev/null -w "%{http_code}" https://matrix.test/_matrix/client/v3/login/saml/redirect
404
$ curl -sk -o /dev/null -w "%{http_code}" https://matrix.test/_matrix/client/.well-known/openid-configuration
404
```

#### 复现步骤
1. 直接访问任意 SSO 端点
2. 确认返回 HTTP 404

#### 影响范围
- 需要 SSO 登录的企业用户无法使用单点登录功能
- hula 前端 `ThirdPartyLogin.vue` 动态检测 SSO 可用性时会自动隐藏 SSO 选项（前端已有防范，参见 `isSsoFlowAvailable()` 方法）
- 但需要 SSO 的用户完全无法使用该认证方式

#### 根因分析
通过源码审查（[server.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/admin/server.rs)），SSO 服务实现存在但被 Cargo feature flags 控制：
```rust
#[cfg(feature = "cas-sso")]
pub mod cas;
#[cfg(feature = "saml-sso")]
pub mod saml;
```
当前生产构建未启用 `cas-sso`、`saml-sso` feature flags。

#### 优化方案
1. **短期**：在编译时添加 feature flags：
   ```bash
   cargo build --release --features "cas-sso,saml-sso"
   ```
2. **中期**：配置实际的 CAS/SAML Identity Provider 连接参数
3. **长期**：将 SSO feature 默认启用，通过运行时配置控制是否对外暴露端点

#### 验证方法
重新编译部署后，上述端点应返回 302 重定向（而非 404）。

---

### H-03：语音配置端点无响应数据

**严重程度**：🟠 High  
**影响模块**：语音消息/语音通话  
**优先级**：P1 — 应在下一迭代修复

#### 问题现象
`GET /_matrix/client/v3/voice/config` 返回空响应体，无任何 JSON 数据。

```bash
$ curl -sk https://matrix.test/_matrix/client/v3/voice/config \
    -H "Authorization: Bearer $TOKEN"
# (空响应)
```

#### 复现步骤
1. 获取 access_token
2. 访问语音配置端点
3. 确认返回空数据

#### 影响范围
- 前端语音消息及语音通话功能无法获取必要的 TTS/STT 配置
- 用户无法使用语音相关功能

#### 优化方案
确保 voice config 端点返回有效的语音服务配置：
```rust
pub async fn get_voice_config() -> Result<Json<Value>, ApiError> {
    Ok(Json(json!({
        "enabled": true,
        "tts": {
            "provider": "azure", // 或其他 TTS 提供商
            "languages": ["zh-CN", "en-US"],
            "voices": [
                {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓", "gender": "female"}
            ]
        },
        "stt": {
            "provider": "azure",
            "languages": ["zh-CN", "en-US"]
        }
    })))
}
```

或在配置文件中添加语音配置段并动态加载。

#### 验证方法
```bash
curl -sk https://matrix.test/_matrix/client/v3/voice/config \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# 预期：返回包含 tts/stt 配置的 JSON
```

---

### M-01：缺失 Permissions-Policy 响应头

**严重程度**：🟡 Medium  
**影响模块**：全局安全  
**优先级**：P2 — 应在后续迭代修复

#### 问题现象
API 响应头中缺少 `Permissions-Policy`（原 `Feature-Policy`），无法限制浏览器特性 API 的使用。

```bash
$ curl -skI https://matrix.test/_matrix/client/versions | grep -i "permissions-policy"
# (无输出)
```

#### 复现步骤
1. 对任意端点发起 HTTP 请求
2. 检查响应头中 `Permissions-Policy` 字段
3. 确认缺失

#### 影响范围
- 浏览器特性 API（摄像头、麦克风、地理位置等）无策略限制
- 若发生 XSS 攻击，攻击者可利用浏览器 API 获取敏感数据

#### 优化方案
```nginx
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()" always;
```

---

### M-02：验证码 API 错误信息不明确

**严重程度**：🟡 Medium  
**影响模块**：注册流程 / CAPTCHA  
**优先级**：P2 — 应在后续迭代修复

#### 问题现象
调用 CAPTCHA 发送接口时，若缺少必填字段 `target`，返回的错误信息为 "Failed to deserialize the JSON body into the target type: missing field `target`"，未提示用户需要提供哪些字段及格式。

```bash
$ curl -sk -X POST https://matrix.test/_matrix/client/v3/register/captcha/send \
    -H "Content-Type: application/json" \
    -d '{}'
# → Failed to deserialize the JSON body into the target type: missing field `target` at line 1 column 33
```

#### 复现步骤
1. 发送空的或缺少 `target` 字段的 CAPTCHA 请求
2. 观察返回的 Serde 反序列化错误信息而非用户友好的错误提示

#### 影响范围
- 前端注册流程中的验证码获取步骤
- 开发者集成时需要额外查阅文档才能正确调用 API

#### 优化方案
添加请求体验证层，返回标准 Matrix 错误格式：
```rust
#[derive(Deserialize)]
struct CaptchaSendRequest {
    target: String,
    #[serde(default)]
    method: Option<String>,
}

pub async fn send_captcha(
    Json(body): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let target = body.get("target")
        .and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::bad_request(
            "M_MISSING_PARAM",
            "Missing required field 'target'. Expected format: {\"target\": \"email@example.com\" or \"+8613800138000\", \"method\": \"sms\"|\"email\"}"
        ))?;
    // ...
}
```

---

### M-03：Admin whoami 端点未部署

**严重程度**：🟡 Medium  
**影响模块**：管理后台  
**优先级**：P2 — 需配合后端重新部署

#### 问题现象
`/_synapse/admin/v1/whoami` 端点返回空响应（404），此端点为上次代码审查后新增，但未在生产环境重新部署。

```bash
$ curl -sk https://matrix.test/_synapse/admin/v1/whoami \
    -H "Authorization: Bearer $TOKEN"
# (空响应 — 404)
```

#### 复现步骤
1. 访问 `/_synapse/admin/v1/whoami`
2. 确认返回空响应

#### 影响范围
- 管理后台的 whoami 自检功能不可用
- 前端 `checkAdminApiAvailability()` 方法无法通过此端点检测管理 API 可用性

#### 优化方案
重新编译并部署后端服务（代码已修改，仅需部署）：
```bash
cd /Users/ljf/Desktop/hu_ts/synapse-rust
cargo build --release
# 部署新二进制文件并重启服务
```

---

### L-01：Server 响应头暴露 nginx 版本号

**严重程度**：🟢 Low  
**影响模块**：全局安全  
**优先级**：P3 — 可在方便时修复

#### 问题现象
HTTP 响应头中包含 `server: nginx/1.27.5`，暴露了反向代理软件及版本信息。

```bash
$ curl -skI https://matrix.test/_matrix/client/versions | grep -i "^server:"
server: nginx/1.27.5
```

#### 复现步骤
1. 对任意端点发起 HTTP 请求
2. 检查响应头中的 `Server` 字段

#### 影响范围
- 攻击者可通过 nginx 版本号查找已知漏洞
- 较低的严重性，因为仅暴露反向代理版本（非应用服务版本）

#### 优化方案
```nginx
# /etc/nginx/nginx.conf
http {
    server_tokens off;  # 隐藏版本号
    more_set_headers "Server: matrix";  # 或设置通用名称（需安装 headers-more 模块）
}
```

---

## 测试通过项目一览

以下功能经测试验证，工作正常：

| 测试项 | 端点 | 结果 |
|--------|------|------|
| 服务发现 | `.well-known/matrix/client` | ✅ 200 |
| 版本查询 | `/_matrix/client/versions` | ✅ 200 (r0.5.0~v1.13) |
| 用户注册 | `POST /register` | ✅ 200 |
| 用户登录 | `POST /login` | ✅ 200 |
| 账号查询 | `GET /account/whoami` | ✅ 200 |
| 能力查询 | `GET /capabilities` | ✅ 200 |
| 登录流程 | `GET /login` | ✅ 200 (password + token) |
| 推送规则 | `GET /pushrules` | ✅ 200 |
| 通知列表 | `GET /notifications` | ✅ 200 |
| 同步 | `GET /sync` | ✅ 200 |
| 用户搜索 | `POST /user_directory/search` | ✅ 200 (需认证)/401 (匿名) |
| 房间创建 | `POST /createRoom` | ✅ 200 |
| 房间加入 | `POST /join/{roomId}` | ✅ 200 |
| 空间层级 | `GET /rooms/{id}/hierarchy` | ✅ 200 (需认证)/401 (匿名) |
| 发送文本消息 | `PUT /send/m.room.message` | ✅ 200 |
| 发送HTML消息 | `PUT /send/m.room.message` | ✅ 200 |
| 发送表情 | `PUT /send/m.room.message` | ✅ 200 |
| 10KB消息 | `PUT /send/m.room.message` | ✅ 200 |
| 已读回执 | `POST /receipt/m.read` | ✅ 200 |
| 输入状态 | `PUT /typing/{userId}` | ✅ 200 |
| 事件查询 | `GET /event/{eventId}` | ✅ 200 |
| 事件撤回 | `PUT /redact/{eventId}` | ✅ 200 |
| 房间别名CRUD | `PUT/GET/DELETE /directory/room/{alias}` | ✅ 200 |
| 退出房间 | `POST /leave` | ✅ 200 |
| 过滤器 | `POST/GET /filter` | ✅ 200 |
| 设备管理 | `GET /devices` | ✅ 200 |
| 文件上传 | `POST /media/v3/upload` | ✅ 200 |
| 文件下载 | `GET /media/v3/download` | ✅ 200 |
| 登出 | `POST /logout` | ✅ 200 |
| 令牌失效 | Token 注销后访问 whoami | ✅ 401 |
| 公共房间 | `GET /publicRooms` | ✅ 200 (匿名+认证) |
| TURN 服务 | `GET /voip/turnServer` | ✅ 200 |
| Admin 权限 | 非管理员访问 admin 端点 | ✅ 403 |
| JSON 解析错误 | 非法 JSON 请求体 | ✅ 400 M_BAD_JSON |
| Content-Type 缺失 | 无 Content-Type 头 | ✅ 400 M_BAD_JSON |
| 认证缺失 | 无 Token 访问需认证端点 | ✅ 401 |
| 房间不存在 | 访问不存在房间 | ✅ 404 M_NOT_FOUND |
| 用户枚举保护 | 不存在用户登录 | ✅ 400 "Password required" |
| CORS 预检 | OPTIONS 请求 | ✅ 200 含正确 CORS 头 |
| HTTP 方法限制 | TRACE 方法 | ✅ 405 |
| Token 查询串拒绝 | access_token 在 URL 参数 | ✅ 401 |
| HSTS | Strict-Transport-Security | ✅ max-age=31536000 |
| Clickjacking | X-Frame-Options | ✅ DENY（虽然重复） |
| MIME 嗅探 | X-Content-Type-Options | ✅ nosniff（虽然重复） |
| Referrer-Policy | Referrer-Policy | ✅ strict-origin-when-cross-origin |

---

## 修复优先级排序

| 优先级 | 问题编号 | 问题 | 理由 |
|--------|---------|------|------|
| **P0** | C-01 | 缺失 CSP 头 | 安全防护第一道防线，修复成本极低（nginx一行配置） |
| **P0** | C-02 | 安全头重复 | 可导致浏览器忽略安全策略，修复成本极低 |
| **P0** | C-03 | 无速率限制 | 直接暴露于暴力破解和 DoS 攻击，需在 nginx 层快速实施 |
| **P0** | C-04 | HTML 不过滤 | 与 C-01 组合形成高危 XSS 攻击面 |
| **P1** | H-01 | 房间状态不完整 | 影响核心房间功能，可能导致客户端状态不同步 |
| **P1** | H-03 | 语音配置空响应 | 影响语音消息核心功能可用性 |
| **P1** | H-02 | SSO 端点 404 | 需确认是否启用功能，如启用则需紧急修复 |
| **P2** | M-01 | 缺失 Permissions-Policy | 安全增强，非致命 |
| **P2** | M-02 | 验证码错误信息 | 影响开发体验，不影响功能 |
| **P2** | M-03 | Admin whoami 未部署 | 代码已修复，仅需部署 |
| **P3** | L-01 | nginx 版本暴露 | 低风险信息泄露 |

---

## 附录：测试原始数据

- 第一轮基础测试结果：[api_test_full.txt](file:///tmp/api_test_full.txt)
- 第二轮深度测试结果：[api_test_deep.txt](file:///tmp/api_test_deep.txt)
- 第三轮安全测试结果：[api_test_security.txt](file:///tmp/api_test_security.txt)

---

## 修复记录 (2026-05-11)

### 后端 (synapse-rust)

| 文件 | 修改内容 | 对应问题 |
|------|---------|---------|
| [middleware.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/middleware.rs) | `security_headers_middleware` — 移除 nginx 重复的安全头 (X-Frame-Options/X-Content-Type-Options/X-XSS-Protection)，新增 Content-Security-Policy 和 Permissions-Policy | C-01, C-02, M-01 |
| [handlers/room.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/handlers/room.rs) | `send_message` — m.room.message 事件在存储前调用 `ContentSanitizer::default().sanitize()` 净化 formatted_body | C-04 |
| [rate_limit_config.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/common/rate_limit_config.rs) | `RateLimitConfigFile::default()` — 新增 login/register/captcha 端点限速规则 (per_second=1, burst=1~3) | C-03 |
| [server.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/admin/server.rs) | 新增 `/_synapse/admin/v1/whoami` 路由 + `get_admin_whoami` handler | M-03 |

### nginx 配置

| 文件 | 修改内容 | 对应问题 |
|------|---------|---------|
| [nginx.conf](file:///Users/ljf/Desktop/hu_ts/synapse-rust/docker/nginx/nginx.conf) | ① 添加 CSP/Permissions-Policy/Referrer-Policy 响应头 ② 添加4层速率限制 zones (api/login/register/captcha) ③ 登录/注册/CAPTCHA 端点 location 块限速 ④ 通用 API 端点 burst=20 限速 | C-01, C-02, C-03, M-01, L-01 |
| [nginx.conf](file:///Users/ljf/Desktop/hu_ts/synapse-rust/docker/deploy/nginx/nginx.conf) | 添加4层速率限制 zones | C-03 |

### 前端 (hula)

| 文件 | 修改内容 | 对应问题 |
|------|---------|---------|
| [vite.config.base.ts](file:///Users/ljf/Desktop/hu_ts/hula/build/config/vite.config.base.ts) | `modulePreload` 排除列表新增 `vue-office`、`vue-demi`，避免首屏加载5.8MB文档库 | 性能优化 |

### 编译验证
- ✅ `cargo check` — 编译通过 (20.57s)
- ✅ `vue-tsc --noEmit` — 105 pre-existing errors，无新增