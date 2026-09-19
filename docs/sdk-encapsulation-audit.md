# Matrix SDK 封装与语义一致性审计报告

**审计时间**：2026-09-11  
**目标**：为后续收口工作提供可操作的、逐项核对的结论。  
**说明**：后端 voice.rs 为空，前端裸调是合理的；AI Connection（MCP，子系统 A）已确认后端的 `/vendor/v1/ai/*` 路由不存在并已决定删除，相关前端代码已于本轮同步移除（见 §2.5、§5）。

---

## 1. 已收口 ✅

### 1.1 `MatrixFriendService.getFriendStatusInfo`
- **前端路径**：`/vendor/v1/friends/{userId}/status`  
- **SDK 对应**：`client.getFriendManager()?.getFriendStatusInfo(userId)`  
- **结论**：路径匹配，SDK 返回 `{user_id, status, is_friend?, are_friends?}`，前端 `Record<string, unknown> | null` 兼容。  
- **动作**：已收口。

### 1.2 `fetchServerMessages` → `client.createMessagesRequest`
- **前端路径**：`/_matrix/client/v3/rooms/{roomId}/messages` (via authedRequestWithPath)  
- **SDK 对应**：`client.createMessagesRequest(roomId, fromToken, limit, dir, timelineFilter?)`  
- **返回体**：SDK 返回 `IMessagesResponse { start, end, chunk: IRoomEvent[], state? }`，结构与裸调一致。  
- **关键**：`dir` 参数需转换为 `Direction` 枚举。  
- **动作**：已收口。  
- **测试**：`messageQueryHelpers.test.ts`、`message.contract.test.ts` 38 条通过。

---

## 2. 保留裸调的原因

### 2.1 `MatrixAccountService.getCapabilities`
- **核实结论（2026-09-18）**：后端 `build_capabilities_response` 已返回顶层 `unstable_features`（行 553-556，`CapabilityGovernance::build_capabilities_response` 返回 `{capabilities, unstable_features}`）。**该问题已由后端实现收尾**。
- **SDK 问题**：`serverCapabilities.ts:154` `this.capabilities = resp["capabilities"]` 丢弃顶层 `unstable_features`；`Capabilities` 类型（62-92 行）缺字段声明。
- **结论**：SDK 侧仍需维持完整响应（`unstable_features` 为能力开关，前端可通过 `hasUnstableFeature()` 判定），或采纳后端结构直接收口；两者皆可作收口。

### 2.2 `MatrixAuthSaml.getSSOData` / `getSSOMetadata`
- **核实结论（2026-09-08）**：SDK 已提供 `SamlAuthManager.getIdpMetadata()`（`src/saml/index.ts:104-124`），对应 `/_matrix/client/r0/saml/metadata`【❌ 2026-09-19 订正：SDK 实为 `ClientPrefix.V3`，路径是 `/_matrix/client/v3/saml/metadata`，见文末「复核修订」】。前端裸调 `/login/saml/metadata` 在该后端**不存在**（必 404）。
- **结论**：**P2-1 已部分解决**，建议前端改用 SDK `SamlAuthManager`。若需支持 `/login/saml/metadata` 私有实现，属前端路径适配问题（非 SDK 缺失）。

### 2.3 `MatrixDeviceService.getUserDevices`
- **核实结论（2026-09-18）**：后端 **已更新** — `synapse-web/src/routes/device.rs:248-268` 新增 `GET /devices`（非 Admin，返回登录用户自己设备列表）；`GET /devices/{device_id}`（修改单台设备）等。
- **前端可收口**：SDK `device-keys/index.ts` 已有 `downloadKeysForUsers`（Admin），但前端需纯查询设备，**可直接调用** `GET /devices`（无需 `POST /keys/query`）。
- **结论**：**P1-1 已解** — 建议前端改用 `client.createRequest('GET', 'device')` 或 SDK 新增 `getMyDevices()` 快捷方法；后端不再需补接口。
- 【❌ 2026-09-19 订正：`GET /devices`（`device.rs:241,248-268`）**没有 `{user_id}` 路径段**，一律用 `auth_user.user_id` → 它**只能查自己**，无法支撑好友设备列表；查他人设备必须 `POST /keys/query`。本项最终落地为 SDK `MatrixClient.getUserDevices(userId)` 走 `POST /keys/query`，见文末「复核修订」。】

### 2.4 `MatrixVoiceService.uploadVoice` / `getRoomVoiceList` / `getUserVoiceList`
- **核实结论（2026-09-18 更新）**：  
  | 问题 | 实际情况 | 建议方案 |
  |------|----------|----------|
  | **P0-2 uploadVoice 格式** | **已解决**！后端提交 `a80a0071` 已将 `upload_voice_message` 从 `Json<Value>` 切换为 `axum::extract::Multipart`，支持 FormData 上传。前端 `MatrixVoiceService.uploadVoice` 已使用 FormData + `uploadVoiceMessageMultipart`，**三端完全匹配**。 | ✅ 已收口 |
  | **P1-2 getRoomVoiceList** | 后端已实现 **完整消息列表路由**：`GET /v3/voice/room/{room_id}`（行 210-222）返回 `{messages, next_batch}`，`VoiceListQuery` 只收 `{limit, from}`。前端传 `offset` → **400**，字段错位。 | 前端修正 query（`offset` → `from`）+ 响应映射（`voices/total` → `messages/next_batch`）；SDK 可选封装 `listRoomVoiceMessages` |
- **结论**：**P0-2 已完成**（后端 + SDK + 前端三端同步），P1-2 仍需前端适配。

### 2.5 `MatrixAIConnectionService` ⛔ 已删除（2026-09-11）
- **决策依据**：后端 synapse-rust 全仓无 `ai/` 路由（`grep` 零命中），且后端已明确决定删除 AI 相关功能；SDK fork 的 `client.aiConnection.*` 语义与前端请求体不匹配（`createConnection(type, server_name)` vs `{name, type, config}`），前端无法自实现（MCP 代理必须在服务端）。
- **结论**：子系统 A（AI Connection / MCP）整体删除，不再等待路由落地收口。
- **删除范围**：`MatrixAIConnectionService.ts` + 2 个测试、`paths/ai.ts` + `paths/__tests__/ai.test.ts`、`AiConnectionSettings.vue`、`settingsSchema.ts` 的 `aiConnection` tab（17→16）、`tabComponentLoaders.ts` 注册、`MatrixCapabilityService.ts` 的 `ai-connection` capability 与 `canUseAiConnection`、`PermissionGuard.vue` 映射、`AccountDataService.ts` 的 5 个 AI 包装方法（无调用方）、`types/message.ts` 的 `ai_connection` 字段、`types/matrix-services.ts` 的 `AIConnectionInfo` re-export、zh-CN/en `setting.json` 的 3 处 i18n 键。
- **保留**：子系统 B（聊天机器人 / AI 扩展：`AIService.ts`、`ConversationService.ts`、`ApiKeyService.ts`、`ModelService.ts`、`ChatRoleService.ts` + `plugins/robot` + `MatrixHttpClient` 的 `VITE_AI_EXTENSION_ENABLED` 网关）——它走 Java 后端 assistant/conversation 端点，与 synapse-rust 的 `ai/` 路由无关，不在本次删除范围。

---

## 3. 核实结果（2026-09-18）

> 后端代码已更新：device.rs 新增 GET /devices；voice.rs 补全消息列表路由；capabilities_v3 snapshot 已收录 unstable_features。

| 问题 | 核实结果 | 责任方 |
|------|----------|--------|
| **voice.rs uploadVoice** | 后端 `upload_voice_message` 接收 `Json<{content: base64, duration_ms, content_type, waveform?}>`；前端 FormData → 签名不匹配【❌ 订正：后端提交 `a80a0071` 已切换为 `axum::extract::Multipart`，FormData 已匹配，见 §2.4】 | 前端（改 JSON） |
| **~~上述~~ 实为（2026-09-19）** | `upload_voice_message` 接收 **multipart/form-data**，`content_type` 须过 `audio/*` 白名单校验；SDK `uploadVoiceMessageMultipart` + 前端 FormData 三端匹配 | ✅ 已收口 |
| **/capabilities 返回 unstable_features** | 后端 `build_capabilities_response` 行 553-556 已返回 `{capabilities, unstable_features}`；SDK 丢弃 | SDK（收口） |
| **getUserDevices 侧写副作用** | 后端新增 `GET /devices`（self devices, non-admin）【❌ 订正：该端点**只能查自己**，查他人设备须 `POST /keys/query`，见「复核修订」】；`downloadKeysForUsers` 仍写 | SDK（走 `POST /keys/query`） |
| **getRoomVoiceList 返回错位** | 后端 `/v3/voice/room/{id}` 返回 `{messages, next_batch}`；`VoiceListQuery` 为 `deny_unknown_fields` 且仅 `{limit, from}` | 前端（修正 query） |

---

## 4. 后续行动（2026-09-18 更新）

### P0 已基本收尾
1. **P0-1 getCapabilities**：后端已返回顶层 `unstable_features`（行 553-556），SDK 维持完整响应或收口 `getUnstableFeatures()` 方法；✅
2. **P0-2 uploadVoice**：✅ **已收口** — 后端提交 `a80a0071` 已实现 multipart/form-data 上传，SDK `uploadVoiceMessageMultipart` 已存，前端 `MatrixVoiceService.uploadVoice` 已改 FormData，三端匹配；
3. **P0-3 AI/MCP**：SDK 清理 `ai-connection/` 及 6 处引用。

### P1 已解 / 前端可自行
4. **P1-1 getUserDevices**：后端 `GET /devices` 已上线（non-admin 返回 self devices）【❌ 订正：它**只能查自己**；查好友设备改用 SDK `getUserDevices()` → `POST /keys/query`，见「复核修订」】；
5. **P1-2 getRoomVoiceList**：后端 `/v3/voice/room/{id}` 路由完备，前端改 query 用 `from` 游标 + 响应映射 `messages`；

### P2 已解决
6. **P2-1 SSO metadata**：SDK `SamlAuthManager.getIdpMetadata()` 已存在；
7. **P2-2 Capability 类型**：同 P0-1，补 `unstable_features` 字段即可。

---

## 5. 变更清单（本轮）

### 5.1 已收口（前期）
| 文件 | 变更 |
|------|------|
| `src/services/matrix/friends/MatrixFriendService.ts` | `getFriendStatusInfo` 收口至 SDK |
| `src/services/matrix/messaging/messageQueryHelpers.ts` | `fetchServerMessages` 收口至 `client.createMessagesRequest`； |
| `src/services/matrix/messaging/__tests__/messageQueryHelpers.test.ts` | 测试桩实现 `createMessagesRequest`； |
| `src/services/matrix/messaging/__tests__/message.contract.test.ts` | 采用 URL 参数顺序不敏感的断言方式； |

### 5.2 SDK 侧修复（2026-09-18）

#### P0-1 / P2-2 · `getCapabilities` 保留 `unstable_features`
| 文件 | 变更 |
|------|------|
| `matrix-js-sdk/src/serverCapabilities.ts` | 新增私有字段 `private unstableFeatures?: Record<string, boolean>`；`fetchCapabilities()` 缓存顶层 `resp["unstable_features"]`；`Capabilities` 接口补 `unstable_features?: Record<string, boolean>` 声明；新增 `getUnstableFeatures()` 和 `hasUnstableFeature(name: string)` 方法 |
| `matrix-js-sdk/src/server-capabilities/index.ts` | `getServerCapabilities()` 读取响应时同步合并 `unstable_features` 到 `cachedCapabilities` |
| `matrix-js-sdk/CHANGELOG.md` | 记录 [Unreleased] 下的 Added/Fixed 条目 |

> ✅ TypeScript 编译通过（`tsc --noEmit` 零错误）。

#### P0-3 · AI Connection 残留
| 状态 | 说明 |
|------|------|
| ✅ 已不存在 | 目录 `ai-connection/` 已不存在；`grep -rn "ai-connection\|AIConnection"` 零命中（SDK 已干净） |

### 5.3 子系统 A — AI Connection / MCP 全量删除（2026-09-11）
| 文件 | 变更 |
|------|------|
| `src/services/matrix/ai/MatrixAIConnectionService.ts` | 删除文件 |
| `src/services/matrix/ai/__tests__/MatrixAIConnectionService.test.ts` | 删除文件 |
| `src/services/matrix/ai/__tests__/aiConnection.contract.test.ts` | 删除文件 |
| `src/services/matrix/paths/ai.ts` | 删除文件 |
| `src/services/matrix/paths/__tests__/ai.test.ts` | 删除文件 |
| `src/services/matrix/paths/index.ts` | 移除 `ai` 导入、`MATRIX_PATHS.AI` 导出 |
| `src/services/matrix/MatrixCapabilityService.ts` | 移除 `ai-connection` capability、`canUseAiConnection`、`HULA_CAPABILITY_ALIASES` 条目 |
| `src/views/settingsWindow/tabs/AiConnectionSettings.vue` | 删除文件 |
| `src/stores/domains/settings/settingsSchema.ts` | 移除 `aiConnection` Tab（`SETTINGS_TABS` 17→16） |
| `src/views/settingsWindow/tabComponentLoaders.ts` | 移除 `aiConnection` 加载器注册 |
| `src/components/common/PermissionGuard.vue` | 移除 `ai-connection` 映射 |
| `src/services/matrix/room/AccountDataService.ts` | 移除 AI Connections 包装方法、类型别名与导入 |
| `src/types/message.ts` | 移除 `ai_connection` 字段 |
| `src/types/matrix-services.ts` | 移除 `AIConnectionInfo` re-export |
| `src/stores/domains/settings/__tests__/settingsSchema.test.ts` | 更新断言（17→16） |
| `src/stores/domains/settings/__tests__/settingsTab.test.ts` | 更新 tab 长度断言（17→16） |
| `src/composables/settings/__tests__/useSettingsShell.test.ts` | 移除 `aiConnection` 翻译映射、搜索关键词、长度断言（17→16） |
| `locales/zh-CN/setting.json` | 移除 `ai_connection` 3 处 i18n 键（tabs/search_terms/独立块） |
| `locales/en/setting.json` | 移除 `ai_connection` 3 处 i18n 键 |
| `src/typings/i18n.d.ts` | 重新生成类型快照（移除 `ai_connection`） |
| `scripts/sdk-boundary-baseline.json` | 重生成基线（删除文件的 violation 归零） |
| `scripts/doc-coverage-baseline.json` | 重生成基线（删除文件的 undocumented 归零） |

> 其余裸调点因语义/格式不匹配，暂保留。

---

## 6. 后端更新反馈（2026-09-18）

自审计书写（2026-09-11）至今，后端同步推进，**多项存根问题已由后端落地**：

### 已解决
| 编号 | 问题 | 后端变更 | 现状态 |
|------|------|----------|--------|
| P1-1 | getUserDevices 侧写 | `synapse-web/src/routes/device.rs` 新增 `GET /devices`、`GET /devices/{device_id}` 路由 | ✅ 已上线，前端可收口 |
| P1-2 | getRoomVoiceList 完整路由 | `voice.rs` 补 `get_room_voice_messages`（行 210-222） `/v3/voice/room/{id}` | ✅ 已上线，前端可改 query |
| P0-1 | unstable_features 落地 | `CapabilityGovernance::build_capabilities_response` 行 553-556 返回 `{capabilities, unstable_features}` | ✅ 已上线，SDK 需收口 |

### 需前端/SDK落实
| 编号 | 责任方 | 落实现象 | 备注 |
|------|--------|----------|------|
| P0-2 | 前端 | `MatrixVoiceService.uploadVoice` 改 JSON body | 52MB 限制、base64 编码 |
| P0-3 | SDK | 清理 `ai-connection` 残留 | 子系统 A 已否 |
| P2-1 | 前端 | `MatrixAuthSaml.getSSOMetadata` 用 SDK 方法 | 路径 `/login/saml/metadata`（后端无此路由）→ `/_matrix/client/v3/saml/metadata`【订正：是 v3 不是 r0】 |

---

## 7. SDK 侧 / 后端侧修复方案（2026-09-08 核实后）

> 说明：本轮仅**核实并出方案**，未改动 SDK/后端源码。每项标注责任方与具体落点，供对应团队排期。

### 7.1 P0-1 / P2-2 · `getCapabilities` 丢弃 `unstable_features`（**SDK 侧，1 处改**）
- **事实修正**：审计原文「后端只返回 capabilities 子树」**已过期**。后端 `synapse-services/src/capability_governance.rs::build_capabilities_response` 第一行即返回顶层 `unstable_features`（含 `org.matrix.msc*` 与 `io.hula.*`，测试 `test_build_capabilities_response` 覆盖）。**修复无需后端改动**。
- **SDK 落点**：`matrix-js-sdk/src/serverCapabilities.ts`
  1. 第 94-96 行 `type CapabilitiesResponse` 补字段：`unstable_features?: Record<string, boolean>;`
  2. 第 152-156 行 `fetchCapabilities`：把 `resp.unstable_features` 缓存到私有字段 `this.unstableFeatures`，不再丢弃。
  3. 新增只读 API：`getUnstableFeatures(): Record<string, boolean> | undefined` 与便捷判定 `hasUnstableFeature(name: string): boolean`（自动补 `org.matrix.msc` 前缀）。
  4. 第 62-92 行 `Capabilities` 接口补 `unstable_features?: Record<string, boolean>;` 显式声明（消除 `P2-2` 类型不完整）。
- **收口收益**：前端 `MatrixAccountService.getCapabilities` 可切回 SDK 原生 `client.getCapabilities()` + `client.hasUnstableFeature('msc4204')`，**消除 §2.1 裸调**。
- **前端落点（收口后）**：`MatrixCapabilityService.ts` 用 `getUnstableFeatures()` 替换手写 `unstable_features` 解析。

### 7.2 P0-2 · `uploadVoice` 传输格式不匹配（**前后端二选一，推荐后端补 multipart**）

> 【✅ 2026-09-19 已闭环：后端采纳方案 A（`a80a0071` 切为 `multipart/form-data`），SDK `uploadVoiceMessageMultipart` + 前端 FormData 三端匹配。本节以下的"事实"是 2026-09-08 快照，已过期。】
- **事实**：后端 `synapse-web/src/routes/voice.rs::upload_voice_message` 接收 `Json<Value>`，要求 `{content: base64, content_type, duration_ms, waveform}`；前端 `MatrixVoiceService.ts:158-162` 发 `FormData`（`file` + `roomId`）→ **视频/语音消息上传必然失败**。
- **方案 A（推荐，后端）**：后端 handler 改 `multipart/form-data`（axum `multipart::Multipart`），与语音原始字节上传天然契合，避免 base64 膨胀 ~33%。SDK `uploadVoiceMessage` 同步改 FormData 通道。
- **方案 B（前端）**：前端读文件 → base64 → 按 `{content, content_type, duration_ms}` JSON 提交；大文件有内存/体积代价。
- **决策点**：需后端确认 wire format 后再动 SDK `voice/index.ts`。二者不匹配期间**前端保留裸调合理**。

### 7.3 P0-3 · AI Connection / MCP 子系统（**SDK 侧残留待清**）
- **事实**：后端无 `ai/` 路由、前端已全删（§2.5）。SDK fork 侧仍有条件注册残留：
  - `src/manager-extensions/index.ts:94` `{ option: "includeAiConnection", module: "ai-connection" }`
  - `src/manager-extensions/index.ts:511` `safeDynamicImport(import("../ai-connection/index.js")...)`
  - `src/client-infra/manager-registry.ts:194` `aiConnection: import("../ai-connection/index").AIConnectionManager;`
  - `src/matrix-client-extensions.ts:377` `getAIConnectionManager(): ...`
  - `src/matrix-managers.ts:244/254` `export { AIConnectionManager, AIConnectionEvent } ...`
  - `src/serverCapabilities.ts:90` `ai_connection?: ICapability;`
- **方案**：后端已决定删除该功能 → SDK fork **同步删除** `src/ai-connection/` 目录 + 上述 6 处引用（保留 option flag 名会以 no-op 兼容，避免破坏既有调用方；若确认无外部消费方则连 option 一起删）。
- **优先级**：低（不影响运行时，属死代码/漂移风险），可与 fork rebase 治理一并处理。

### 7.4 P1-1 · `getUserDevices` 副作用（**SDK 侧或后端，需决策**）
- **事实**：SDK `getUserDevices` 仅类型声明无运行实现；`downloadKeysForUsers` 写 crypto store；后端无非 Admin `GET /devices/{userId}` 纯查询。
- **方案 A（推荐，SDK 侧，改动小）**：`device-keys/index.ts` 的 `downloadKeysForUsers` 增加 `{ saveToStore = true }` 选项；传 `false` 时走纯 `POST /keys/query` 不落库。前端 `getUserDevices` 裸调收口为 `downloadKeysForUsers(users, { saveToStore: false })`。
- **方案 B（后端）**：提供 `GET /_matrix/client/v3/devices/{userId}` 受 device-list 可见性约束的纯查询。成本高、语义需对齐 MSC。
- **结论**：优先方案 A。
- 【✅ 2026-09-19 落地：SDK `MatrixClient.getUserDevices(userId)` 已直接改走 `POST /keys/query`（body `{device_keys: {[userId]: []}}`；第 5 参须传 `{ prefix: ClientPrefix.V3 }` 选项对象），未引入 `saveToStore` 开关——路径更窄、少一处语义分支。见「复核修订」。】

### 7.5 P1-2 · `getRoomVoiceList` 返回结构错位（**前端为主，SDK 可选封装**）
- **事实**：后端 `/v3/voice/room/{id}` handler `get_room_voice_messages` 返回 `{messages, next_batch}`；`VoiceListQuery` 为 `#[serde(deny_unknown_fields)]` 仅收 `{limit, from}`。前端 `MatrixVoiceService.ts` 传 `offset` → **必然 400**；且读 `result.voices` / `result.total` → 字段全错，列表恒空。
- **前端落点**（立即可修，无需后端）：
  1. 请求 query 由 `{limit, offset}` 改为 `{limit, from}`（游标分页，非偏移分页）。
  2. 响应解析由 `{voices, total}` 改为 `{messages, next_batch}`；如需 `total`，用单独 `GET /v3/voice/room/{id}/stats`（后端已存在）。
- **SDK 落点（可选，收口）**：`voice/index.ts` 的 `getRoomVoice` 目前只包 stats → 补 `listRoomVoiceMessages(roomId, {limit, from})` 封装 messages 路由，前端即可收口裸调。

### 7.6 P2-1 · SSO / SAML metadata（**前端适配，SDK 已有能力**）
- **事实**：SDK `SamlAuthManager.getIdpMetadata()` 命中 `/_matrix/client/r0/saml/metadata`（后端 `saml.rs` 提供）；前端裸调 `/login/saml/metadata` 为另一私有路径。【❌ 订正：SDK 实为 `ClientPrefix.V3` → `/_matrix/client/v3/saml/metadata`，与 `saml.rs:499-507` 一致；`/login/saml/metadata` 在该后端**不存在**。见「复核修订」。】
- **方案**：前端 `MatrixAuthSaml.getSSOMetadata` 改用 `client.getSamlAuthManager()?.getIdpMetadata()`。若确需 `/login/saml/metadata`，属后端路径别名，非 SDK 缺口。

### 7.7 修复优先级与依赖矩阵

| 编号 | 责任方 | 改动量 | 是否阻塞前端收口 | 建议排期 |
|------|--------|--------|------------------|----------|
| P0-1 / P2-2 | SDK | 小（1 文件） | ✅ 收口 getCapabilities | Sprint 内 |
| P0-2 | 后端 or 前端 | 中 | ✅ 视频消息上传 | **需先定 wire format** |
| P1-2 | 前端 | 小 | ❌（前端可自修） | Sprint 内（400 bug） |
| P1-1 | SDK | 中 | ✅ 收口 getUserDevices | 次 Sprint |
| P2-1 | 前端 | 小 | ✅ 收口 getSSOMetadata | 随手改 |
| P0-3 | SDK | 小（删代码） | ❌（无调用方） | 随 rebase 治理 |

> ⚠️ **P1-2 是唯一在运行时直接导致功能损坏（400 + 列表恒空）的问题，建议不等 SDK/后端，前端先行修复。**

## 修复记录

### 2026-09-18: P1/P2 前端收口完成

> ⚠️ **本节结论已于 2026-09-19 按源码实测复核，其中两处结论有误（见下"复核修订"），勿再沿用本节对端点与字段的原始表述。**

**P1-1 getUserDevices 前端收口** ✅
- 修复内容：`MatrixDeviceService.getUserDevices` 改用 SDK `getDeviceKeysManager().getUserDevices` 收口
- 原实现：裸调 `authedRequestWithPath + POST /keys/query` 越层调用
- 新实现：使用 SDK `getDeviceKeysManager().getUserDevices(userId)` 收口【❌ 表述有误，更正为 `POST /keys/query`，见下】
- 位置：`Tjg/src/services/matrix/user/MatrixDeviceService.ts:100-136`

**P1-2 getRoomVoiceList 前端收口** ✅
- 修复内容：`MatrixVoiceService.getRoomVoiceList` 与 `getUserVoiceList` 参数和响应结构对齐
- 原实现：query 参数使用 `offset`，响应字段 `voices/total`
- 新实现：query 参数改用 `from`，响应字段改为 `messages/next_batch`（keyset 分页）
- 位置：`Tjg/src/services/matrix/media/MatrixVoiceService.ts:311-379`

**P2-1 SSO metadata 前端收口** ✅
- 修复内容：`MatrixAuthSaml.getSamlMetadata` 改用 SDK 收口
- 原实现：裸调 `authedRequestWithPath` 访问 `/login/saml/metadata`
- 新实现：使用 SDK `getSamlAuthManager().getIdpMetadata()` 收口后端 `/r0/saml/metadata` 端点【❌ 后端是 v3 不是 r0，见下】
- 位置：`Tjg/src/services/matrix/auth/MatrixAuthSaml.ts:33-48`

### 2026-09-19 复核修订（逐条回后端对账）

**P1-1 getUserDevices —— 端点是 `POST /keys/query`，不是 `GET /devices`** ✅
- 事实源：`synapse-web/src/routes/device.rs:241,248-268` 的 `GET /devices` **没有 `{user_id}` 路径段**，一律用 `auth_user.user_id` → 该端点**只能查自己**，无法用于好友设备列表。
- 正确收口：SDK `MatrixClient.getUserDevices(userId)` 已改走 `POST /keys/query`（body `{device_keys: {[userId]: []}}`；注意 `authedRequest` 第 5 参是 `IRequestOpts`，须传 `{ prefix: ClientPrefix.V3 }` 选项对象，传裸 prefix 会被丢弃）。SDK 侧提交 `48fba9f50`。
- 连带缺陷 **D-12**：`MatrixDeviceService.getUserDevices` 曾引用不存在的 `this.client` 字段（基类只有 `getClient()`）→ `TypeError` 被 `catch` 吞掉、**恒返回空数组**；已改为 `this.getClient()` 并补回归守卫单测。

**P1-2 getRoomVoiceList / getUserVoiceList —— 已进一步收口进 SDK** ✅
- 真实路径为 `/voice/{room|user}/{id}`（**无** `/messages` 段；SDK 早前多出的该段必 404，见 `synapse-web/src/routes/voice.rs:52-74` 的路由清单，其中列表路由为 `voice/room/{room_id}` 与 `voice/user/{user_id}`）。
- 行形状为 `{media_id, user_id, room_id, content_uri, content_type, duration_ms, size_bytes, created_ts}`（`voice_service.rs:291-307`）；`from` / `next_batch` 是**毫秒 `created_ts` 游标**（i64，可为 `null`），既不是 offset 也没有 `has_more`。
- 现实现：两方法委托 SDK `VoiceManager.listRoomVoiceMessages` / `listUserVoiceMessages`，行类型由 SDK `IVoiceMessage` 派生（D-18），前端不再手拼 query、不再用 `as Array<{...}>` 自证幻影字段。

**P2-1 SSO / SAML metadata —— 后端只有 v3 路径，原前端路径确实 404** ✅
- 后端公开路由仅注册 `GET /_matrix/client/v3/saml/metadata`（`synapse-web/src/routes/saml.rs:499-507`；同 router 内**没有** `/login/saml/metadata`）。
- SDK `SamlAuthManager.getIdpMetadata()` = `cp("/saml/metadata")` + `prefix: ClientPrefix.V3`（`matrix-js-sdk/src/saml/index.ts:173-181`），与后端一致 → 该收口是**真实修复**（此前只推断"SDK 有能力"，未对账）。
- `MatrixAuthSaml.ts` 中原有注释"SDK 使用 `/_matrix/client/r0/saml/metadata`，与现有路径不一致"是**过期信息**（SDK route-table 已是 v3），已随本次改动替换。

**状态**：P0/P1/P2 前端收口全部完成。Phase 0 由换用新 SDK 产物暴露出的契约缺陷（D-17 语音上传读幻影字段、D-18 语音列表幻影行形状）已修正并重打包闭环，详见 `docs/sdk-e2ee-adaptation-plan-2026-09-19.md` v2.3。
