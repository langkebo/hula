# 剩余 client.http.authedRequest 调用分批清理计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 清理项目中剩余 98 处 `client.http.authedRequest` 直接调用，统一通过 SDK 高层方法或 `authedRequestWithPath` 封装层实现。

**Architecture:** SDK 高层方法已确认全部可用（presence/device/profile/auth/push/user-directory/voip/event 模块）。清理分两类：(1) SDK 有高层方法的调用，直接替换；(2) synapse-rust 特有端点或 admin 端点，统一到 `authedRequestWithPath`。

**Tech Stack:** TypeScript, Vue 3, matrix-js-sdk (local), Vitest

## Global Constraints

- `MatrixHttpClient.ts` 中的 `client.http.authedRequest` 是封装层本身，不清理
- 测试文件（`__tests__/*.test.ts`、`*.contract.test.ts`）中的引用不清理
- `matrixSdk.worker.ts` 中的 5 处均为注释（说明为何用 `fetch` 而非 `authedRequest`），不清理
- 保持所有方法的公共签名不变
- 每处替换后运行相关测试验证
- `authedRequestWithPath` 导入路径：`import { authedRequestWithPath } from '@/services/matrix/MatrixHttpClient'`
- `matrixHttpClient.request` 导入路径：`import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'`
- `MATRIX_PATHS` 导入路径：`import { MATRIX_PATHS } from '@/services/matrix/paths'`

## 调用分布汇总（2026-08-04 重新核实）

| 批次 | 类别 | 文件数 | 调用数 | 处理方式 |
|---|---|---|---|---|
| Batch 1 | SDK 高层方法 | 4 | 26 | 替换为 SDK 方法 |
| Batch 2 | SDK 高层方法 | 5 | 15 | 替换为 SDK 方法 |
| Batch 3 | synapse-rust 特有 | 8 | 45 | 统一到 `authedRequestWithPath` |
| Batch 4 | Admin 服务 | 7 | 10 | 统一到 `authedRequestWithPath` |
| Batch 5 | 其他 | 2 | 2 | 评估处理 |
| **合计** | | **26** | **98** | |

## SDK 高层方法对照表

| 功能域 | SDK 方法 | 签名 |
|---|---|---|
| Presence | `client.setPresence(status, statusMessage?)` | 设置用户状态 |
| Presence | `client.getPresence(userId)` | 获取用户状态 |
| Device | `client.getDevices()` | 获取设备列表 |
| Device | `client.getDevice(deviceId)` | 获取单个设备 |
| Device | `client.setDeviceDetails(deviceId, body)` | 更新设备信息 |
| Device | `client.deleteDevice(deviceId, auth)` | 删除单个设备 |
| Device | `client.deleteDevices(deviceIds, auth)` | 批量删除设备 |
| Profile | `client.getProfileInfo(userId)` | 获取用户资料 |
| Auth | `client.whoami()` | 获取当前用户 |
| Auth | `client.logout()` | 登出 |
| Auth | `client.getCapabilities()` | 获取服务器能力 |
| Push | `client.getPushers()` | 获取推送器 |
| Push | `client.setPusher(pusher)` | 设置推送器 |
| Push Rules | `client.addPushRule(scope, kind, ruleId, body)` | 添加推送规则 |
| Push Rules | `client.deletePushRule(scope, kind, ruleId)` | 删除推送规则 |
| Push Rules | `client.setPushRuleEnabled(scope, kind, ruleId, enabled)` | 启用/禁用规则 |
| Push Rules | `client.setPushRuleActions(scope, kind, ruleId, actions)` | 设置规则动作 |
| User Directory | `client.searchUserDirectory(term)` | 搜索用户 |
| VoIP | `client.getTurnServers()` | 获取 TURN 服务器 |
| Event | `client.fetchRoomEvent(roomId, eventId)` | 获取单个事件 |

---

## Batch 1: Presence + Device + Profile + Auth（26处）

### Task 1.1: MatrixPresenceService（5处）

**文件**: `src/services/matrix/user/MatrixPresenceService.ts`
**调用数**: 5处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L142 | `PUT /presence/{userId}/status` | `client.setPresence(userId, status)` 或 `client.getPresenceManager().setPresence(...)` |
| L190 | `GET /presence/{userId}/status` | `client.getPresence(userId)` |
| L257 | `GET /presence/{userId}/status` | `client.getPresence(userId)` |
| L288 | `POST /presence/list` (unsubscribe) | `client.getPresenceManager().unsubscribePresenceList(userIds)` |
| L317 | `POST /presence/list` (subscribe) | `client.getPresenceManager().subscribePresenceList(userIds)` |

### Task 1.2: MatrixDeviceService（8处）

**文件**: `src/services/matrix/user/MatrixDeviceService.ts`
**调用数**: 8处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L96 | `GET /devices` | `client.getDevices()` |
| L124 | `GET /devices/{deviceId}` | `client.getDevice(deviceId)` |
| L174 | `PUT /devices/{deviceId}` | `client.setDeviceDetails(deviceId, body)` |
| L206 | `DELETE /devices/{deviceId}` | `client.deleteDevice(deviceId, auth)` |
| L237 | `POST /delete_devices` | `client.deleteDevices(deviceIds, auth)` |
| L273 | `POST /keys/device_list_updates` | `authedRequestWithPath`（SDK 无高层方法） |
| L317 | `GET /room_keys/request` | `authedRequestWithPath`（SDK 无高层方法） |
| L329 | `DELETE /room_keys/request/{id}` | `authedRequestWithPath`（SDK 无高层方法） |

注意：L96-L237 这 5 处都是 `if/else` 降级分支中的调用，主分支已使用 SDK 方法。清理时直接移除降级分支，统一用 SDK 方法。L273/L317/L329 是 SDK 无高层方法的端点，统一到 `authedRequestWithPath`。

### Task 1.3: MatrixProfileService（3处）

**文件**: `src/services/matrix/user/MatrixProfileService.ts`
**调用数**: 3处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L138 | `GET /profile/{userId}/ext_profile` | `authedRequestWithPath`（synapse-rust 扩展端点） |
| L162 | `PUT /profile/{userId}/ext_profile` | `authedRequestWithPath`（synapse-rust 扩展端点） |
| L182 | `DELETE /profile/{userId}/ext_profile/{key}` | `authedRequestWithPath`（synapse-rust 扩展端点） |

注意：`ext_profile` 是 synapse-rust 扩展端点，SDK 的 `getProfileInfo` 只获取标准 profile。这 3 处需用 `authedRequestWithPath`。建议归入 Batch 3 处理。

### Task 1.4: MatrixAuthService（10处）

**文件**: `src/services/matrix/auth/MatrixAuthService.ts`
**调用数**: 10处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L629 | `GET /register/captcha/status` | `authedRequestWithPath`（synapse-rust 扩展） |
| L648 | `GET /account/whoami` | `client.whoami()` |
| L666 | `DELETE /register/captcha/clean` | `authedRequestWithPath`（synapse-rust 扩展） |
| L785 | `POST /logout/all` | `client.logout()` 或 `client.logoutAll()` |
| L798 | `GET /capabilities` | `client.getCapabilities()` |
| L815 | `GET /login/saml/...` | `authedRequestWithPath`（SAML 扩展） |
| L846 | `POST /login/saml/logout` | `authedRequestWithPath`（SAML 扩展） |
| L860 | `GET /login/saml/metadata` | `authedRequestWithPath`（SAML 扩展） |
| L891 | `GET /versions` | `authedRequestWithPath`（版本检查） |
| L933 | `GET /register/available` | `authedRequestWithPath`（注册检查） |

---

## Batch 2: Push + UserDirectory + VoIP + Message + QrLogin（15处）

### Task 2.1: MatrixPushService（9处）

**文件**: `src/services/matrix/notifications/MatrixPushService.ts`
**调用数**: 9处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L21 | `GET /pushers` | `client.getPushers()` |
| L51 | `POST /pushers/set` | `client.setPusher(pusher)` |
| L70 | `PUT /pushrules/{scope}/{kind}/{ruleId}/enabled` | `client.setPushRuleEnabled(scope, kind, ruleId, enabled)` |
| L89 | `PUT /pushrules/{scope}/{kind}/{ruleId}/actions` | `client.setPushRuleActions(scope, kind, ruleId, actions)` |
| L101 | `PUT /pushrules/{scope}/{kind}/{ruleId}` | `client.addPushRule(scope, kind, ruleId, body)` |
| L116 | `DELETE /pushrules/{scope}/{kind}/{ruleId}` | `client.deletePushRule(scope, kind, ruleId)` |
| L164 | `POST /pushers/set` | `client.setPusher(pusher)` |
| L187 | `PUT /pushrules/{scope}/{kind}/{ruleId}` | `client.addPushRule(scope, kind, ruleId, body)` |
| L199 | `DELETE /pushrules/{scope}/{kind}/{ruleId}` | `client.deletePushRule(scope, kind, ruleId)` |

### Task 2.2: MatrixUserDirectoryService（2处）

**文件**: `src/services/matrix/user/MatrixUserDirectoryService.ts`
**调用数**: 2处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L114 | `POST /user_directory/search` | `client.searchUserDirectory(term)` |
| L140 | `GET /users/{userId}/profile` | `client.getProfileInfo(userId)` |

### Task 2.3: MatrixVoIPService（2处）

**文件**: `src/services/matrix/media/MatrixVoIPService.ts`
**调用数**: 2处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L541 | `GET /voip/turnServer` | `client.getTurnServers()` 或 `client.getTurnServer()` |
| L577 | `GET /voip/turnServer` | `client.getTurnServers()` |

### Task 2.4: MatrixMessageService（1处）

**文件**: `src/services/matrix/messaging/MatrixMessageService.ts`
**调用数**: 1处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L674 | `GET /rooms/{roomId}/messages` | `client.fetchRoomEvents(roomId, opts)` 或 `authedRequestWithPath` |

### Task 2.5: MatrixQrLoginSdkService（1处）

**文件**: `src/services/matrix/auth/MatrixQrLoginSdkService.ts`
**调用数**: 1处

| 行号 | 原调用 | SDK 替代 |
|---|---|---|
| L530 | `POST /login/get_token` | `authedRequestWithPath`（synapse-rust QR 登录扩展） |

---

## Batch 3: synapse-rust 特有端点（45处）

### Task 3.1: AccountDataService（14处）

**文件**: `src/services/matrix/room/AccountDataService.ts`
**调用数**: 14处（L27, L40, L66, L82, L103, L115, L128, L140, L162, L173, L237, L250, L265, L279）

全部为 synapse-rust 特有端点（`/burn`, `/anti_screenshot`, `/summary_members`, `/summary_state`, `/sign`, `/verify`, `/message_queue` 等），统一到 `authedRequestWithPath`。

### Task 3.2: RoomOperations（7处）

**文件**: `src/services/matrix/room/RoomOperations.ts`
**调用数**: 7处（L208, L217, L225, L234, L318, L376, L389）

全部为 synapse-rust 特有端点（`/invite_blocklist`, `/invite_allowlist`, `/translate`, `/sticky_events`），统一到 `authedRequestWithPath`。

### Task 3.3: MatrixSpaceService（9处）

**文件**: `src/services/matrix/room/MatrixSpaceService.ts`
**调用数**: 9处（L653, L667, L857, L893, L911, L939, L960, L978, L997）

全部为 synapse-rust 空间扩展端点（`/spaces/...`），统一到 `authedRequestWithPath`。

### Task 3.4: TimelineService（4处）

**文件**: `src/services/matrix/room/TimelineService.ts`
**调用数**: 4处（L52, L70, L120, L146）

synapse-rust 扩展端点（`/unread_count`, `/call`），统一到 `authedRequestWithPath`。

### Task 3.5: MetadataService（3处）

**文件**: `src/services/matrix/room/MetadataService.ts`
**调用数**: 3处（L56, L74, L92）

synapse-rust 扩展端点（`/turn_server`, `/room_sync`, `/permissions`），统一到 `authedRequestWithPath`。

### Task 3.6: MembershipService（2处）

**文件**: `src/services/matrix/room/MembershipService.ts`
**调用数**: 2处（L139, L155）

`/knock` 端点，检查 SDK 是否有 `client.knockRoom()`。如果没有，统一到 `authedRequestWithPath`。

### Task 3.7: MatrixWidgetService（3处）

**文件**: `src/services/matrix/widget/MatrixWidgetService.ts`
**调用数**: 3处（L457, L491, L528）

Widget 相关端点，统一到 `authedRequestWithPath`。

### Task 3.8: SynapseRustExtensionsService（3处）

**文件**: `src/services/matrix/SynapseRustExtensionsService.ts`
**调用数**: 3处（L1023, L1038, L1054）

`/thirdparty/protocols` 和 `/thirdparty/user/` 端点。检查 SDK 是否有 `client.getThirdpartyProtocols()` 和 `client.getThirdpartyUser()`。如果有，替换为 SDK 方法；如果没有，统一到 `authedRequestWithPath`。

---

## Batch 4: Admin 服务（10处）

### Task 4.1: 移除通用封装方法（6处）

以下 5 个文件都有类似的 `request`/`requestAs` 通用封装方法，与 `authedRequestWithPath` 功能重复。清理策略：删除各自的 `request` 方法，将所有调用点直接改为 `authedRequestWithPath`。

| 文件 | 行号 | 当前调用 | 处理方式 |
|---|---|---|---|
| `admin/ExternalServiceService.ts` | L103 | `client.http.authedRequest(method, path, ...)` | 删除 `request` 方法，调用点改用 `authedRequestWithPath` |
| `admin/FederationService.ts` | L24 | `client.http.authedRequest(method, path, ...)` | 同上 |
| `admin/BackgroundUpdateService.ts` | L144 | `client.http.authedRequest(method, path, ...)` | 同上 |
| `admin/TelemetryService.ts` | L135 | `client.http.authedRequest(method, path, ...)` | 同上 |
| `admin/AdminFacadeService.ts` | L204 | `client.http.authedRequest(method, path, ...)` | 删除通用 `request` 方法 |
| `admin/ReportService.ts` | L39 | `client.http.authedRequest(method, path, ...)` | 同上 |

注意：删除通用封装方法时，需要更新该文件内所有调用 `this.request(...)` 的地方改为 `authedRequestWithPath(...)`。每个文件大约有 5-15 个调用点需同步修改。

### Task 4.2: 替换直接调用（4处）

| 文件 | 行号 | 原调用 | 处理方式 |
|---|---|---|---|
| `admin/AdminFacadeService.ts` | L137 | `GET /users/{userId}` | `authedRequestWithPath` |
| `admin/MediaService.ts` | L84 | `POST /purge_remote_media` | `authedRequestWithPath`（已用 `stripMatrixPrefix`） |
| `admin/ReportService.ts` | L84 | `POST /rooms/{roomId}/report` | `authedRequestWithPath` |
| `admin/ReportService.ts` | L119 | `PUT /rooms/{roomId}/report/{eventId}/score` | `authedRequestWithPath` |

---

## Batch 5: 其他（2处）

### Task 5.1: 其他服务清理

| 文件 | 行号 | 原调用 | 处理方式 |
|---|---|---|---|
| `media/MatrixVoiceService.ts` | L492 | 语音相关端点 | `authedRequestWithPath` |
| `auth/MatrixOidcService.ts` | L191 | `POST /oidc/logout` | `authedRequestWithPath` |

---

## 执行顺序建议

1. **Batch 1**（26处）→ 高优先级，SDK 有明确高层方法，风险低
2. **Batch 2**（15处）→ 中优先级，SDK 有高层方法，风险低
3. **Batch 3**（45处）→ 批量统一到 `authedRequestWithPath`，机械性强，可并行
4. **Batch 4**（10处）→ Admin 端点，注意通用封装方法的连带修改
5. **Batch 5**（2处）→ 零散调用

每个 Batch 完成后运行 `pnpm test:run` 验证全量测试通过。

## 验证检查清单

每个 Batch 完成后执行：

1. **静态检查**：`pnpm check`（Biome 只读检查）
2. **类型检查**：`vue-tsc --noEmit`
3. **单元测试**：`pnpm test:run`
4. **残留扫描**：`grep -rn "client\.http\.authedRequest" src/ --include="*.ts" --exclude-dir="__tests__" | grep -v "MatrixHttpClient.ts" | grep -v "matrixSdk.worker.ts"`
5. **特定测试**：每个 Task 完成后运行相关 service 的单元测试

## 风险与注意事项

1. **MatrixDeviceService 的降级分支**：L96-L237 的 `if/else` 降级分支需谨慎处理，确认 SDK 方法可用后才能移除降级逻辑
2. **Admin 通用封装方法**：删除 `request` 方法时需同步修改所有内部调用点，避免遗漏
3. **synapse-rust 扩展端点**：`ext_profile`、SAML、captcha 等端点 SDK 无高层方法，必须用 `authedRequestWithPath`
4. **类型保持**：替换后保持方法签名和返回类型不变，避免影响调用方
5. **测试更新**：部分单元测试 mock 了 `client.http.authedRequest`，替换后需更新 mock 为新的 SDK 方法或 `authedRequestWithPath`
