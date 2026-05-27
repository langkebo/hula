# 前后端联调测试报告

**测试日期**: 2026-05-26
**后端地址**: https://matrix.test (synapse-rust)
**前端项目**: /Users/ljf/Desktop/hu_ts/hula
**SDK项目**: /Users/ljf/Desktop/hu_ts/matrix-js-sdk
**测试工具**: curl HTTP 探测 + Node.js 集成测试脚本 + SDK 代码审查

---

## 一、测试概览

| 维度 | 数量 | 通过 | 失败 | 通过率 |
|------|------|------|------|--------|
| 后端 API 连通性测试 | 51 | 49 | 2 (预期) | 96.1% |
| SDK 深度模块测试 | 37 | 34 | 3 (预期) | 91.9% |
| 前端集成测试脚本 | 57 | 36 | 21 (限流) | 63.2%* |
| SDK 代码审查问题 | 21 | 15 已修复 | 6 待处理 | 71.4% |

*注：21个失败中18个因429限流导致，非功能性问题

---

## 二、后端 API 连通性测试结果

### 2.1 基础功能 (全部通过)

| 模块 | 测试项 | 状态 | 响应时间 |
|------|--------|------|----------|
| 版本发现 | GET /_matrix/client/versions | PASS | ~4ms |
| Well-Known | GET /.well-known/matrix/client | PASS | ~4ms |
| Well-Known | GET /.well-known/matrix/server | PASS | ~6ms |
| 登录流程 | GET /_matrix/client/v3/login | PASS | ~30ms |
| 密码登录 | POST /_matrix/client/v3/login | PASS | ~144ms |
| 身份验证 | GET /_matrix/client/v3/account/whoami | PASS | ~8ms |
| 服务端能力 | GET /_matrix/client/v3/capabilities | PASS | ~4ms |

### 2.2 房间操作 (全部通过)

| 测试项 | 状态 | 响应时间 |
|--------|------|----------|
| 创建房间 | PASS | ~118ms |
| 获取房间状态 | PASS | ~17ms |
| 获取成员列表 | PASS | ~17ms |
| 获取消息 | PASS | ~4ms |
| 发送消息 | PASS | ~9ms |
| 置顶事件(状态事件) | PASS | ~88ms |
| 设置已读标记 | PASS | ~12ms |
| 发送回执(POST) | PASS | ~16ms |
| 编辑事件 | PASS | ~96ms |
| 获取房间别名 | PASS | ~7ms |
| 房间能力 | PASS | ~3ms |
| 房间权限 | PASS | ~4ms |
| 房间版本 | PASS | ~3ms |
| 事件上下文 | PASS | ~4ms |
| 房间摘要 | PASS | ~3ms |
| 未读计数 | PASS | ~4ms |

### 2.3 用户与社交 (全部通过)

| 测试项 | 状态 | 响应时间 |
|--------|------|----------|
| 获取用户资料 | PASS | ~78ms |
| 设置显示名 | PASS | ~90ms |
| 设置头像 | PASS | ~17ms |
| 获取在线状态 | PASS | ~7ms |
| 设置在线状态 | PASS | ~76ms |
| 获取设备列表 | PASS | ~7ms |
| 用户目录搜索 | PASS | ~16ms |
| 好友列表 | PASS | ~171ms |
| 好友请求(收/发) | PASS | ~13ms |
| 好友建议 | PASS | ~10ms |

### 2.4 推送与通知 / 媒体 / 错误处理 (全部通过)

略，详见前次报告。

---

## 三、已修复问题汇总 (15项)

### 3.1 后端修复 (6项)

| # | 严重度 | 问题 | 修复文件 | 验证 |
|---|--------|------|----------|------|
| 1 | **P0 BUG** | OTK 值泄漏到 device_keys 的 keys 映射 | `e2ee/device_keys/service.rs` + `storage.rs` | PASS - keys/query 仅返回 ed25519/curve25519 |
| 2 | **P0 SPEC** | UIA `m.login.password` 不支持 `identifier` 对象和 localpart | `services/uia_service.rs` + `account_compat.rs` | PASS - identifier(localpart) 正确解析 |
| 3 | **P1** | Typing PUT/POST 响应格式不一致 | `web/routes/typing.rs` | PASS - 统一返回 `{}` |
| 4 | **P1** | Relations API 重复 `m.relates_to` | `services/relations_service.rs` | PASS - 仅在 content 内 |
| 5 | **P2** | KeyBackup GET 响应缺少 etag 字段 | `web/routes/key_backup.rs` | PASS - 返回 `etag` |
| 6 | **P2** | SendToDevice 响应缺少 `failures` 字段 | `web/routes/e2ee_routes.rs` | PASS - 返回 `{"failures":{}}` |

### 3.2 前端 SDK 修复 (9项)

| # | 严重度 | 问题 | 修复文件 | 验证 |
|---|--------|------|----------|------|
| 7 | **P0** | Typing 批量查询 `room_ids` vs `rooms` | `typing/index.ts` | 单元测试 PASS |
| 8 | **P0** | KeyRotation 全部接口字段名不匹配 | `key-rotation/index.ts` | 单元测试 11/11 PASS |
| 9 | **P0** | BurnAfterRead `burnMessage` 使用 POST 而非 PUT | `burn-after-read/index.ts` | 单元测试 PASS |
| 10 | **P0** | E2EE `createSecureBackup` 验证过严 | `e2ee/index.ts` | TypeScript 编译 PASS |
| 11 | **P2** | KeyBackup `etag` 字段标记为可选 | `key-backup/index.ts` | TypeScript 编译 PASS |
| 12 | **P2** | ToDevice `failures` 字段传递 | `to-device/index.ts` | TypeScript 编译 PASS |
| 13 | - | KeyRotation 单元测试对齐 | `spec/unit/key-rotation.spec.ts` | 11/11 PASS |
| 14 | - | Typing 单元测试期望值更新 | `spec/unit/typing.spec.ts` | PASS |
| 15 | - | BurnAfterRead 单元测试期望值更新 | `spec/unit/burn-after-read.spec.ts` | PASS |

---

## 四、待处理问题 (2项)

| # | 严重度 | 模块 | 问题描述 | 建议方案 |
|---|--------|------|----------|----------|
| 1 | MINOR | Room | `forget()` 发送非标准的 `delete_room` 字段 | 保留（synapse-rust 扩展） |
| 2 | MINOR | KeyBackup | `deleteBackupVersion` 的 `deleted` 始终为 true | 文档说明 |

### 已修复（本轮追加）

| # | 严重度 | 问题 | 修复文件 | 验证 |
|---|--------|------|----------|------|
| 3 | SIGNIFICANT | KeyRotation `updateConfig` 响应格式 | `key-rotation/index.ts` (已在前轮修复) | PASS |
| 4 | SIGNIFICANT | KeyRotation `checkKeyValidity` key_id 参数 | `key_rotation.rs` 添加 key_id 过滤 | PASS |
| 5 | SIGNIFICANT | E2EE 安全备份方法类型化 | `e2ee/index.ts` 添加类型定义 | PASS |
| 6 | MINOR | KeyBackup 存根路由清理 | `key_backup.rs` 移除存根路由和函数 | PASS |

### 未实现端点 (P3 - 长期)

| 端点 | 状态 |
|------|------|
| Feature Flags (`/v1/feature_flags`) | 404 - 未实现 |
| Rendezvous (`/unstable/rendezvous`) | 404 - 未实现 |
| 用户级举报 (`POST /report`) | 404 - 未实现 |
| Threading 自定义端点 | 自定义扩展，非标准 |
| EventReport/FeatureFlags | 使用 Admin API 前缀 |

---

## 五、性能指标

| 端点类别 | 平均响应时间 | P95 响应时间 | 备注 |
|----------|-------------|-------------|------|
| 认证 (登录) | ~144ms | ~200ms | 含密码哈希计算 |
| 房间创建 | ~118ms | ~150ms | |
| 消息发送 | ~9ms | ~20ms | |
| 状态查询 | ~5ms | ~15ms | |
| 同步 | ~14ms | ~30ms | |
| 媒体上传 | ~20ms | ~50ms | |
| 用户资料 | ~78ms | ~120ms | |
| 好友列表 | ~171ms | ~250ms | 较慢，需优化 |

---

## 六、修改文件清单

### 后端 (synapse-rust)

| 文件 | 修改内容 |
|------|----------|
| `src/e2ee/device_keys/service.rs` | `populate_user_keys` 添加算法白名单过滤，仅允许 ed25519/curve25519 |
| `src/e2ee/device_keys/storage.rs` | `get_all_device_keys` SQL 从 `NOT IN ('signed_curve25519')` 改为 `IN ('ed25519', 'curve25519')` |
| `src/services/uia_service.rs` | `verify_password_stage` 添加 `user_id` 字段支持和 localpart 解析 |
| `src/web/routes/account_compat.rs` | `change_password_uia` 添加 `user_id` 支持，identifier 可选 |
| `src/web/routes/typing.rs` | 统一 PUT/POST 响应为 `{}` |
| `src/services/relations_service.rs` | 移除顶层 `m.relates_to` 重复字段 |
| `src/web/routes/key_backup.rs` | `read_all_rooms` 添加 `etag` 字段 |
| `src/web/routes/e2ee_routes.rs` | `send_to_device` 返回 `{"failures":{}}` |

### 前端 SDK (matrix-js-sdk)

| 文件 | 修改内容 |
|------|----------|
| `src/typing/index.ts` | `room_ids` -> `rooms` |
| `src/key-rotation/index.ts` | 全部接口对齐后端 (`enabled`/`interval_ms`/`rotated_ts` 等) |
| `src/burn-after-read/index.ts` | `Method.Post` -> `Method.Put` |
| `src/e2ee/index.ts` | `createSecureBackup` 支持无 passphrase 模式，添加类型化请求体 |
| `src/key-backup/index.ts` | `etag` 改为可选字段 |
| `src/to-device/index.ts` | 传递 `failures` 字段 |
| `spec/unit/key-rotation.spec.ts` | 测试用例对齐新接口 |
| `spec/unit/typing.spec.ts` | 测试期望值更新 |
| `spec/unit/burn-after-read.spec.ts` | 测试期望值更新 |

---

## 七、验证结果

- **后端 cargo check**: PASS
- **后端 Docker 部署**: PASS (健康检查通过)
- **前端 TypeScript 编译**: PASS (仅1个预存 cross-signing OOM 问题)
- **前端单元测试**: 98/98 PASS (typing + burn-after-read + key-rotation)
- **P0 OTK 泄漏**: 验证 PASS - keys/query 仅返回设备密钥
- **P0 UIA identifier**: 验证 PASS - localpart 正确解析为完整 Matrix ID
- **P1 Typing 响应**: 验证 PASS - PUT/POST 统一返回 `{}`
- **P1 Relations 重复**: 验证 PASS - m.relates_to 仅在 content 内
- **P2 KeyBackup etag**: 验证 PASS - 响应包含 etag 字段
- **P2 ToDevice failures**: 验证 PASS - 响应包含 failures 字段

---

## 八、Hula Live E2E 追加验证

### 8.1 本轮前端问题收敛

| # | 严重度 | 问题 | 修复文件 | 结果 |
|---|--------|------|----------|------|
| 1 | P0 | Vite dev + workspace link 导致 `matrix-sdk-crypto-wasm` 资源加载失败，Rust Crypto 无法初始化 | `build/config/vite.config.base.ts` | PASS |
| 2 | P1 | token 恢复链缺少 `deviceId`，`initRustCrypto()` 在部分恢复场景直接跳过 | `src/services/matrix/MatrixClientService.ts` `src/stores/domains/chat/matrix.ts` `src/services/matrix/auth/MatrixRuntimeSessionService.ts` | PASS |
| 3 | P1 | 双账号接收端对同 `event_id` 的加密占位消息未回填明文正文 | `src/stores/domains/chat/room.ts` `src/services/matrix/room/RealtimeService.ts` | PASS |
| 4 | P2 | `matrix-live` 对过期 `roomId`、旧基线文本、弱登录判定和浏览器错误序列化不稳 | `e2e/support/matrixLive.ts` `e2e/matrix-live.spec.ts` | PASS |

### 8.2 真实链路回归结果

- 执行环境: `password-api` + `https://matrix.test` + 共享房间 `Matrix Live Shared Room 2026-05-26`
- 执行命令: `pnpm exec playwright test e2e/matrix-live.spec.ts --project=desktop-chromium --reporter=line`
- 结果: `4 passed (50.2s)`
- 覆盖项:
  - live 登录并进入消息页
  - 单账号向加密房间发送探针消息并回写
  - 历史明文样本解密校验，若房间基线漂移则自动发送新的时间线样本
  - 双账号跨端加密消息投递、同步与回读

### 8.3 仍需继续关注

- 快照中仍可见前端运行时错误 `Cannot read properties of undefined (reading 'uid')`
- 该错误未阻断本轮 `matrix-live` 四条真实用例通过，但说明消息页渲染链仍有潜在空值访问
- 建议后续继续排查 `ChatMain` / `RecycleScroller` 渲染路径中的用户信息空值保护

### 8.4 前端空值修复与 `restore-token` 回归

- 修复范围:
  - `src/components/rightBox/chatBox/ChatMain.vue`
  - `src/components/rightBox/renderMessage/index.vue`
  - `src/components/rightBox/renderMessage/useMessageUser.ts`
  - `src/components/rightBox/renderMessage/AudioCall.vue`
  - `src/components/rightBox/renderMessage/VideoCall.vue`
  - `src/components/rightBox/renderMessage/special/RecallMessage.vue`
  - `src/components/rightBox/renderMessage/special/BotMessage.vue`
- 修复内容:
  - 为消息页 `RecycleScroller` 项补齐发送者 UID 的兜底解析，避免 `item.fromUser` 暂时缺失时渲染崩溃
  - 为 `userStore.userInfo` 尚未完成回填的窗口期增加空值保护，避免消息组件在首屏恢复阶段直接读取 `userInfo!.uid`
  - 补充 `ChatMain` 单测，覆盖“当前用户信息缺失 + 消息发送者缺失”时仍可完成渲染
- 回归验证:
  - `pnpm exec vitest run src/components/rightBox/chatBox/__tests__/ChatMain.test.ts`
  - 结果: `3 passed`
  - 执行环境: `restore-token` + `https://matrix.test` + 共享房间 `Matrix Live Shared Room 2026-05-26`
  - 执行命令: `pnpm exec playwright test e2e/matrix-live.spec.ts --project=desktop-chromium --reporter=line`
  - 结果: `4 passed (54.8s)`
- 结论:
  - 先前快照中反复出现的 `Cannot read properties of undefined (reading 'uid')` 已在当前消息页主渲染链做前端兜底
  - `restore-token` 模式下登录恢复、消息页进入、单账号发消息、时间线明文校验、双账号收发四条 live 用例当前全部通过

### 8.5 剩余前端风险点复扫

- 继续回扫 `rightBox` 相关组件后，又发现几处同类 `uid` 直读点，主要分布在：
  - `src/components/rightBox/renderMessage/special/RecallMessage.vue`
  - `src/components/rightBox/renderMessage/File.vue`
  - `src/components/rightBox/chatBox/ChatMsgMultiChoose.vue`
  - `src/components/rightBox/ApplyList.vue`
- 本轮已补齐这些位置的空值保护，避免从撤回消息、文件消息、多选转发和申请列表入口再次触发相同类型崩溃
- 结果: 上述文件编辑后诊断均为 `0 errors`

### 8.6 `userInfo!.uid` 系统清理与回归

- 本轮继续对 `src/` 下残余 `userStore.userInfo!.uid` 做系统清理，共清除 `24` 处、覆盖 `14` 个文件，重点包括：
  - `src/hooks/useCommon.ts`
  - `src/hooks/useChatMain.ts`
  - `src/hooks/chatMain/useChatContextMenu.ts`
  - `src/hooks/chatMain/useUserContextMenu.ts`
  - `src/hooks/chatMain/useChatFileDownload.ts`
  - `src/composables/app/useWsEventHandler.ts`
  - `src/hooks/useWebRtc.ts`
  - `src/hooks/useVoiceRecordRust.ts`
- 修复策略:
  - 统一改为 `userStore.userInfo?.uid ?? ''`，让登录态恢复窗口、消息回填窗口和桌面/移动端共享 hook 都具备一致的空值容错
  - 保留原有业务语义，不在用户信息缺失时抛错，而是回退为空字符串并让上层逻辑按现有条件短路
- 新增/扩展回归测试:
  - `src/hooks/__tests__/useChatMain.test.ts`
  - `src/hooks/chatMain/__tests__/useChatFileDownload.test.ts`
  - `src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts`
- 执行命令:
  - `pnpm exec vitest run src/hooks/__tests__/useChatMain.test.ts src/hooks/chatMain/__tests__/useChatFileDownload.test.ts src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts`
- 结果:
  - `3 files passed`
  - `37 tests passed`
- 当前结论:
  - `hula/src` 下已无 `userInfo!.uid` 残留
  - 当前最容易在真实消息主链、编辑器、文件下载和通知链路中再次出现的用户态空值访问已完成一轮系统性清理

### 8.7 `userInfo!` 其他属性空值防线

- 本轮继续清理 `avatar`、`name`、`resume`、`account`、`client` 等其余 `userInfo!` 属性直读，并处理 3 个写回型入口：
  - `src/views/LockScreen.vue`
  - `src/mobile/views/my/SimpleBio.vue`
  - `src/views/friendWindow/AddFriendVerify.vue`
  - `src/views/friendWindow/AddGroupVerify.vue`
  - `src/components/dialog/AddFriendRequestDialog.vue`
  - `src/components/dialog/AddGroupRequestDialog.vue`
  - `src/mobile/views/friends/ConfirmAddFriend.vue`
  - `src/mobile/views/friends/ConfirmAddGroup.vue`
  - `src/hooks/useUpload.ts`
  - `src/mobile/views/my/EditProfile.vue`
  - `src/mobile/views/my/EditBio.vue`
  - `src/layout/left/hook.ts`
- 修复策略:
  - 展示/比较类访问统一回退到 `''` 或已有字段兜底，避免登录恢复窗口和移动端资料页直接崩溃
  - 写回类访问统一先判断 `userStore.userInfo` 是否存在，再执行赋值与缓存回写
  - 上传去重 key 生成在缺少 `account` 时改为依次回退 `uid` 和 `anonymous`
- 新增回归测试:
  - `src/hooks/__tests__/useUpload.test.ts`
- 执行命令:
  - `pnpm exec vitest run src/hooks/__tests__/useUpload.test.ts`
- 结果:
  - `1 file passed`
  - `11 tests passed`
- 当前结论:
  - `hula/src` 下已无 `userInfo!` / `userStore.userInfo!` 强解引用残留
  - `LockScreen`、移动端个人资料、好友验证弹窗、上传去重和资料写回入口的用户态空值已完成系统性兜底

### 8.8 最新 live 复跑确认

- 在首次仅传旧 `MATRIX_LIVE_ROOM_ID` 失败后，补齐共享房间名称环境变量 `MATRIX_LIVE_ROOM_NAME='Matrix Live Shared Room 2026-05-26'`
- 执行环境: `password-api` + `https://matrix.test` + 共享房间 `Matrix Live Shared Room 2026-05-26`
- 执行命令: `MATRIX_LIVE_E2E=1 MATRIX_LIVE_AUTH_STRATEGY=password-api ... MATRIX_LIVE_ROOM_ID='!TPhQ9ad8cYFuV9zB6Rh0P0ba:matrix.test' MATRIX_LIVE_ROOM_NAME='Matrix Live Shared Room 2026-05-26' pnpm exec playwright test e2e/matrix-live.spec.ts --project=desktop-chromium --reporter=line`
- 结果: `4 passed (53.2s)`
- 当前结论:
  - 共享房间 `roomId` 漂移后，仅依赖历史 `roomId` 已不足以稳定定位 live 房间
  - 前端此前补上的 `roomId + roomName` 回退策略仍然必要，且本轮用户态空值防线没有破坏 `matrix-live` 主链

---

## 九、matrix-js-sdk Real Backend 追加验证

### 9.1 本轮 SDK 侧修复

| # | 严重度 | 问题 | 修复文件 | 结果 |
|---|--------|------|----------|------|
| 1 | P1 | 非 Matrix JSON 的 `429` HTML 响应会被 `BaseManager.normalizeError()` 误判为不可重试 `ApiError`，导致 real-backend 脚本登录直接失败 | `matrix-js-sdk/src/managers/base-manager.ts` `matrix-js-sdk/spec/unit/base-manager-normalize.spec.ts` `matrix-js-sdk/spec/unit/base-manager-retry.spec.ts` | PASS |
| 2 | P1 | `e2e-crypto.test.ts` 原先只做能力探测，未真正断言“第二端收到并解密明文”；同时仍调用部分过时客户端快捷方法，导致真实 E2EE 覆盖不足且存在假失败 | `matrix-js-sdk/spec/integ/real-backend/e2e-crypto.test.ts` | PASS |
| 3 | P1 | 缺少“跨设备密钥恢复 / room key share / secure backup restore”专项 real-backend 覆盖，导致密钥恢复主链没有真实后端回归结论 | `matrix-js-sdk/spec/integ/real-backend/cross-device-key-recovery.spec.ts` `matrix-js-sdk/spec/integ/real-backend/secure-backup-lifecycle.spec.ts` `matrix-js-sdk/spec/integ/real-backend/room-key-sharing-manager.spec.ts` `matrix-js-sdk/spec/integ/real-backend/auth-test-helpers.ts` | PASS |

### 9.2 真实回归结果

- `pnpm test:real-backend:verification`: `1 file / 1 test passed`
- `pnpm test:real-backend:device`: `4 files / 4 tests passed`
- `pnpm run test:real-backend:tsx -- spec/integ/real-backend/e2e-crypto.test.ts`: `32/32 passed`
- `pnpm run test:real-backend:tsx -- spec/integ/real-backend/step6-crypto.test.ts`: `23/23 passed`
- `pnpm run test:real-backend:tsx -- spec/integ/real-backend/step11-lifecycle.test.ts`: `31/31 passed`
- `pnpm run test:real-backend:tsx -- spec/integ/real-backend/dm-test.ts`: `13/13 passed`
- `pnpm exec vitest run --config vitest.real-backend.config.ts spec/integ/real-backend/room-key-sharing-manager.spec.ts spec/integ/real-backend/secure-backup-lifecycle.spec.ts spec/integ/real-backend/cross-device-key-recovery.spec.ts`: `3 files / 3 tests passed`
- `pnpm run test:real-backend:batch -- spec/integ/real-backend`: 进程退出码 `0`

### 9.3 关键结论

- SDK 对 `https://matrix.test` 的设备管理、验证、数据库联动和批量 real-backend 批跑当前可稳定通过
- 新增的 `HTTPError 429` 重试支持，已经覆盖 nginx/反向代理返回 HTML 限流页这一真实场景
- `e2e-crypto` 当前已升级为真实 E2EE 断言：双账号登录、双端 `Rust Crypto` 初始化、真实 `/sync`、创建加密房间、邀请/加入、发送密文消息，并按 `event_id` 在第二端等待解密出明文
- `step6-crypto`、`step11-lifecycle` 和 `dm-test` 均在 `matrix.test` 上通过，补齐了加密能力探测、生命周期接口、DM 创建/映射/消息发送等真实场景覆盖
- 新增的 `cross-device-key-recovery.spec.ts` 已验证同账号新设备导入本地导出的 `room keys` 后，可重新解密历史加密消息
- 新增的 `secure-backup-lifecycle.spec.ts` 已验证 secure backup 的创建、查询、写入 session keys、恢复与删除链路
- `room-key-sharing-manager.spec.ts` 已继续验证真实后端的 room key request 查询与取消路径，补齐 room key share 相关 HTTP 路由回归

### 9.4 Scoped Restore 追加结论

- 新增 `matrix-js-sdk/spec/integ/real-backend/key-backup-recover-scope.spec.ts`，继续追 real-backend 的 secure backup 按房间范围恢复链路
- 在将本地 `synapse-rust` 修复部署到 `matrix.test` 后，重新执行:
  - `pnpm run test:real-backend:with-ca -- pnpm exec vitest run --config vitest.real-backend.config.ts spec/integ/real-backend/key-backup-recover-scope.spec.ts`
- 结果:
  - `1 passed`
- 当前真实返回:
  - `POST /_matrix/client/v3/keys/backup/secure/{backup_id}/restore -> 200`
  - 响应体已切到新 contract：`{ recovered_keys: 1, total_keys: 2 }`
- 当前结论:
  - `matrix.test` 已不再返回 legacy 字段 `success/restored_keys/key_count/message`
  - 传入 `rooms: [roomA]` 后仅恢复单房间的 `1` 把 session key，说明 scoped restore 语义已在真实后端生效
  - `key-backup-recover-scope.spec.ts` 已从“记录旧后端偏差的 canary”切回“严格断言新 contract + rooms 过滤”的正式 real-backend 回归

### 9.5 本地后端修正进展

- 已在本地 `synapse-rust` 代码中补齐 secure backup restore 的房间范围恢复语义与响应契约对齐：
  - `synapse-rust/src/e2ee/secure_backup/service.rs`
  - `synapse-rust/src/e2ee/secure_backup/models.rs`
  - `synapse-rust/src/web/routes/e2ee_routes.rs`
  - `synapse-rust/tests/integration/api_e2ee_advanced_tests.rs`
- 修正内容:
  - `restore_backup()` 新增 `rooms: Option<Vec<String>>`，仅恢复命中过滤房间的 session keys
  - `/keys/backup/secure/{backup_id}/restore` 响应改为 `recovered_keys/total_keys`
  - 后端集成测试扩成两房间两把 key，只恢复单房间并断言 `recovered_keys = 1`、`total_keys = 2`
- 本地验证:
  - `cargo check --features test-utils --lib`: `Finished`
  - `cargo test --features test-utils --test integration e2ee_key_backup_lifecycle -- --nocapture`: `1 passed`
- 追加修复:
  - 清理 `synapse-rust/tests/integration/api_federation_signature_auth_tests.rs` 中 27 处旧签名 `add_member(...)` 调用，统一补齐新增的事务参数 `None`
- 部署到 `matrix.test` 过程中还额外暴露了两处部署侧漂移，并已在当前环境临时对齐：
  - `docker/deploy/.env` 中 `CORS_ORIGIN_PATTERN` 未加引号，`deploy.sh` 在 `source .env` 时会直接报 shell 语法错误
  - `docker/deploy/.env` 使用 `SYNAPSE_IMAGE=synapse-rust:latest`，但 `docker/deploy/deploy.sh` 的本地构建/回滚逻辑硬编码依赖 `synapse-rust:local`
- 实际发版路径:
  - 先手工构建 `synapse-rust:local`
  - 再执行 `./deploy.sh --core-private-chat --skip-build`
  - 脚本自身因把容器日志中的 `WARN` 视作硬失败而触发“回滚”，但 health/API 校验已通过，随后 real-backend scoped restore 回归确认现网行为已更新
- 当前结论:
  - 本次 secure backup scoped restore 修复已在本地代码层和后端集成测试层完成验证
  - `integration` target 先经历共享 schema 初始化超时，随后回退 isolated schema 初始化并最终通过，说明当前测试环境初始化仍偏慢，但不影响本条链路验证结论

### 9.6 部署脚本收口

- 已继续修正 `synapse-rust/docker/deploy/deploy.sh`，把上一轮暴露的部署侧问题正式收口：
  - `.env` 改为自定义 dotenv 解析，不再直接 `source .env`，因此未加引号的正则值不会再导致 shell 语法错误
  - 本地镜像统一通过 `SYNAPSE_IMAGE` 解析，回滚/删除/校验/构建不再硬编码 `synapse-rust:local`
  - 本地构建改为直接执行 `docker build -f docker/Dockerfile --target tools ...`，不再依赖 `docker/deploy/docker-compose.yml` 中不存在的 `build:` 段
  - 日志校验改为仅把 `ERROR` 作为硬失败，`WARNING` 只提示不阻断部署
- 验证:
  - `bash -n docker/deploy/deploy.sh`
  - `./deploy.sh --core-private-chat --skip-build`
  - `pnpm run test:real-backend:with-ca -- pnpm exec vitest run --config vitest.real-backend.config.ts spec/integ/real-backend/key-backup-recover-scope.spec.ts`
- 结果:
  - 部署脚本本身已完整成功收尾，输出 `重建、优化部署与验证全部完成`
  - 部署后再次回归 `key-backup-recover-scope.spec.ts`，仍为 `1 passed`
- 当前残留:
  - `synapse-app` 启动日志仍有两条 `WARN`
  - `rate_limit.yaml` 的 schema 漂移已修复，不再出现 `missing field 'rule'` 并回退默认限流配置

### 9.7 限流配置收口

- 继续修正 `rate_limit.yaml` 与 Rust 真实配置模型的 schema 漂移：
  - `synapse-rust/docker/deploy/config/rate_limit.yaml`
  - `synapse-rust/docker/config/rate_limit.yaml`
- 修正内容:
  - `endpoints[*]` 从旧写法 `per_second/burst_size` 改为真实解析所需的嵌套结构 `rule.per_second/rule.burst_size`
- 验证:
  - `./deploy.sh --core-private-chat --skip-build`
  - `pnpm run test:real-backend:with-ca -- pnpm exec vitest run --config vitest.real-backend.config.ts spec/integ/real-backend/key-backup-recover-scope.spec.ts`
- 结果:
  - 部署脚本继续 `SUCCESS`
  - `synapse-app` 日志中不再出现 `Failed to load rate limit config ... missing field 'rule'`
  - `key-backup-recover-scope.spec.ts` 再次 `1 passed`
- 当前残留:
  - 本轮继续清理后，部署日志中的剩余 warning 已全部清零

### 9.8 启动噪音清零

- 继续修正最后两条部署 warning：
  - `synapse-rust/docker/deploy/docker-compose.yml`
  - `synapse-rust/docker/docker-compose.yml`
  - `synapse-rust/docker/docker-compose.prod.yml`
  - `synapse-rust/src/services/database_initializer.rs`
- 修正内容:
  - 移除 `synapse` 服务 compose 侧 `init: true`，避免与镜像内 `ENTRYPOINT ["/usr/bin/tini", ...]` 重复注入，消除 `Tini is not running as PID 1`
  - 运行时迁移 advisory lock 改为固定持有同一条数据库连接完成加锁/解锁，避免连接池换连接导致 `pg_advisory_unlock` 在错误 session 上执行，从而消除 `you don't own a lock of type ExclusiveLock`
- 验证:
  - `cargo check --features test-utils --lib`
  - `./deploy.sh --core-private-chat`
- 结果:
  - 完整正式部署再次成功，部署脚本日志输出 `未发现 ERROR/WARNING 级别日志`
  - secure backup scoped restore 这条联调主线已完成“后端实现修复 -> 部署脚本修复 -> 线上部署 -> real-backend 回归 -> 启动噪音清零”的完整闭环

### 9.9 Cross-signing / Secret Storage 覆盖

- 新增 `matrix-js-sdk/spec/integ/real-backend/cross-signing-secret-storage.spec.ts`，扩展对 4S 与 cross-signing 真实链路的覆盖
- 验证内容:
  - 使用 fresh user 确保测试状态纯净
  - 验证 `bootstrapSecretStorage()` 成功在服务器创建 `m.secret_storage.key.{id}` 与 `m.secret_storage.default_key`
  - 验证 `bootstrapCrossSigning()` 成功通过 UIA (m.login.password) 完成密钥上传
  - 验证 4S 建立后，cross-signing 私钥会自动导出到 secret storage
  - 验证最终 `isSecretStorageReady()` 与 `isCrossSigningReady()` 均变为 `true`
- 执行命令:
  - `pnpm run test:real-backend:with-ca -- pnpm exec vitest run --config vitest.real-backend.config.ts spec/integ/real-backend/cross-signing-secret-storage.spec.ts`
- 结果:
  - `1 passed`
- 当前结论:
  - `synapse-rust` 已支持标准的 UIA 密钥上传与 4S 账户数据存储
  - SDK 的 `Rust Crypto` 模块在真实后端环境下可正确驱动 4S + Cross-signing 的完整 bootstrap 流程

---

## 十、最终回归结论 (2026-05-26)

### 10.1 整体健康度

- **后端 (`synapse-rust`)**: 已完成 scoped restore 修复并成功部署到 `matrix.test`，部署脚本与启动噪音已清零。
- **SDK (`matrix-js-sdk`)**: real-backend 覆盖率显著提升，新增了 cross-device recovery、secure backup lifecycle、scoped restore、room key share 以及 4S + cross-signing bootstrap 的真实链路验证。
- **前端 (`hula`)**: 已完成系统性 `userInfo!.uid` 空值保护清理，`matrix-live` 四条核心 E2EE 链路在 `password-api` 模式下全部通过。

### 10.2 后续建议

- 继续保持 `matrix-js-sdk` real-backend 优先的开发模式，对于涉及 E2EE 状态机的复杂修改，优先补齐 integration spec。
- 定期执行 `deploy.sh` 全流程验证，确保配置、镜像与脚本逻辑不发生漂移。
- 前端继续关注 `RecycleScroller` 等高性能渲染组件中的空值保护，确保在极端弱网或登录恢复瞬间的稳定性。

