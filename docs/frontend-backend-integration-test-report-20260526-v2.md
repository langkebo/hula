# 前后端联调测试报告 v2

**日期**: 2026-05-26
**后端**: https://matrix.test (synapse-rust)
**前端**: /Users/ljf/Desktop/hu_ts/hula
**SDK**: /Users/ljf/Desktop/hu_ts/matrix-js-sdk

---

## 一、测试总览

| 维度 | 结果 |
|------|------|
| API 集成测试 | **73/75 PASS (97.3%)** |
| SDK 单元测试 | **4833/4833 PASS (100%)** |
| 前端编译 | **vue-tsc --noEmit PASS** |
| 后端编译 | **cargo check PASS** |
| Docker 部署 | **4/4 容器 healthy** |

---

## 二、API 集成测试详情

### 模块通过率

| 模块 | 通过/总数 | 平均响应时间 |
|------|----------|-------------|
| Discovery | 3/3 | 51ms |
| Auth | 5/5 | 83ms |
| Account | 4/4 | 22ms |
| Room | 11/11 | 37ms |
| Message | 6/6 | 26ms |
| E2EE | 8/8 | 20ms |
| Friend | 10/10 | 34ms |
| Presence | 2/2 | 37ms |
| Media | 3/4 | 17ms |
| Search | 1/1 | 18ms |
| Push | 2/2 | 18ms |
| Sync | 1/1 | 52ms |
| BurnAfterRead | 1/1 | 9ms |
| KeyRotation | 3/3 | 9ms |
| KeyBackup | 1/1 | 23ms |
| AccountData | 2/2 | 23ms |
| Reaction | 1/1 | 23ms |
| Relations | 1/1 | 14ms |
| Thread | 1/1 | 24ms |
| SDK-Align | 3/3 | 17ms |
| Error | 2/3 | 13ms |
| UIA | 2/2 | 231ms |

### 2 项 FAIL 分析（均为测试脚本问题，非后端 bug）

| # | 测试项 | 状态 | 原因 | 结论 |
|---|--------|------|------|------|
| 1 | GET /thumbnail | FAIL | 测试脚本对二进制响应尝试 JSON 解析 | **非 bug**，thumbnail 返回图片二进制数据 |
| 2 | POST /createRoom 空 body | FAIL | Matrix 规范要求 POST body 必须是有效 JSON，空 body 不是有效 JSON | **非 bug**，后端正确返回 400 |

---

## 三、关键验证项

### 3.1 认证与账户 (5/5 PASS)

- 登录/注册：密码登录 + dummy 认证注册均正常
- whoami：返回正确 user_id
- capabilities：返回 capabilities 对象
- profile：读写 displayname、avatar_url 正常
- 3PID：接口正常

### 3.2 房间与消息 (11/11 PASS)

- 创建房间：private/public/DM 均正常
- 发送消息：PUT 和 POST 方法均支持
- 消息类型：m.text、m.image 均正常
- 编辑/撤回：m.replace 和 redact 正常
- 消息获取：GET /messages 返回 chunk
- 房间状态/成员：正常
- Typing：PUT /typing 正常
- Read receipt：POST /receipt 正常
- 房间 account_data/tags：正常
- 邀请：POST /invite 正常

### 3.3 E2EE 与设备 (8/8 PASS)

- 设备列表：GET /devices 正常
- 密钥上传：POST /keys/upload 正常
- 密钥查询：POST /keys/query 正常
- **OTK 泄漏检查**：device_keys 中无 signed_curve25519 密钥 ✓
- 密钥变更：GET /keys/changes 正常
- ToDevice：PUT /sendToDevice 正常，返回 failures 字段 ✓
- 密钥声明：POST /keys/claim 正常

### 3.4 好友与社交 (10/10 PASS)

- 好友列表：GET /v3/friends 正常（15ms，优化后）
- 发送好友请求：POST /v3/friends 和 POST /v1/friends/request 均正常
- 接收/发出请求：GET /friends/requests/incoming|outgoing 正常
- 接受好友请求：POST /v1/friends/request/{user_id}/accept 正常
- 好友检查：GET /v3/friends/check 正常
- 好友搜索：GET /v3/friends/search 正常
- 好友建议：GET /v1/friends/suggestions 正常
- 好友分组：GET /v1/friends/groups 正常
- 在线状态：PUT/GET /presence 正常

### 3.5 媒体 (3/4 PASS)

- 上传：POST /upload 正常（30ms），返回 mxc:// URI
- 下载：GET /download 正常
- 预览 URL：GET /preview_url 正常

### 3.6 搜索与推送 (3/3 PASS)

- 搜索：POST /search 正常
- 推送规则：GET /pushrules 正常
- 推送器：GET /pushers 正常

### 3.7 同步 (1/1 PASS)

- GET /sync：返回 next_batch ✓（之前 400 问题已解决）

### 3.8 UIA 兼容性 (2/2 PASS)

- identifier 格式：`{"type":"m.id.user","user":"itest_alice"}` ✓
- user_id 格式：`"@itest_alice:matrix.test"` ✓
- 密码修改：两种格式均正常

### 3.9 错误处理 (2/3 PASS)

- 无效 token → 401 M_UNAUTHORIZED ✓
- 不存在的房间 → 404 M_NOT_FOUND ✓
- 空 body → 400（符合规范）

---

## 四、性能指标

| API | 平均响应时间 | 优化前 | 提升 |
|-----|-------------|--------|------|
| GET /friends (冷) | 15ms | 171ms | **91%** |
| GET /friends (热) | ~9ms | 171ms | **95%** |
| POST /createRoom | 106ms | - | - |
| POST /login | 170ms | - | - |
| PUT /send message | 30ms | - | - |
| POST /keys/upload | 44ms | - | - |
| GET /sync | 52ms | - | - |

### 性能优化措施

1. **数据库部分索引**（新增 4 个）：
   - `idx_events_friend_room` — friend room 查找
   - `idx_events_friend_list` — friend list content 查找
   - `idx_friend_requests_receiver_status` — 好友请求查询
   - `idx_friend_requests_sender_status` — 好友请求查询

2. **Redis 缓存 friend_room_id**：TTL 1h，每次请求减少 1 次 SQL

3. **好友列表缓存 TTL**：30s → 300s

4. **SDK 并行请求**：`sync()`/`start()` 从串行改为 `Promise.all`

---

## 五、前端 uid 空值问题修复

**问题**：多处代码直接访问 `fromUser.uid` / `userInfo!.uid` 无空值保护，当消息数据不完整时导致运行时崩溃。

**修复文件**（8 个）：

| 文件 | 修复 |
|------|------|
| ChatMain.vue | `item.fromUser.uid` → `item.fromUser?.uid ?? ''` |
| renderMessage/index.vue | `props.fromUser!.uid` → `props.fromUser?.uid ?? ''` |
| useMessageUser.ts | 所有 `props.fromUser.uid` → `props.fromUser?.uid ?? ''` |
| messageMutations.ts | 添加 `pushMsg` 防御性归一化 + 可选链 |
| ChatMultiMsg.vue | `message.fromUser.uid` → `message.fromUser?.uid ?? ''` |
| layout/index.vue | `data.fromUser.uid` → `data.fromUser?.uid` |
| MatrixRuntimeSessionService.ts | `msg.fromUser.uid` → `msg.fromUser?.uid ?? ''` |
| MatrixRoomStoreAdapter.ts | `event.sender` → `(event.sender as string \| undefined) ?? ''` |

---

## 六、SDK 单元测试

| 指标 | 结果 |
|------|------|
| 测试文件 | 363/363 PASS |
| 测试用例 | 4833/4833 PASS |
| 修复项 | e2ee-manager createSecureBackup 验证逻辑测试对齐 |

---

## 七、待处理事项

### P3 未实现端点（长期规划）

1. Feature Flags API
2. Rendezvous API
3. 用户级举报 API

### 设计决策保留项（MINOR）

1. Room `forget()` 发送非标准 `delete_room` 字段（synapse-rust 扩展）
2. KeyBackup `deleteBackupVersion` 的 `deleted` 始终为 true

### Nginx 限流配置

- 当前 `rate=600r/m` (10r/s) burst=20
- 集成测试中 150ms 间隔可避免 429
- 生产环境建议根据实际负载调整

---

## 八、测试脚本

完整测试脚本位于：`/Users/ljf/Desktop/hu_ts/hula/scripts/integration-test-full.py`

运行方式：
```bash
cd /Users/ljf/Desktop/hu_ts/hula
python3 scripts/integration-test-full.py
```

JSON 详细报告：`/Users/ljf/Desktop/hu_ts/hula/docs/integration-test-report-latest.json`
