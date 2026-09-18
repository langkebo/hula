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
- **核实结论（2026-09-08）**：后端 `build_capabilities_response` 实际返回**顶层 `unstable_features`**，测试第 791-797 行证实含 `org.matrix.msc*` 与 `io.hula.*`。此前的"后端只返回 capabilities 子树"判断**已过期**。
- **SDK 问题（需修）**：`serverCapabilities.ts:154` `this.capabilities = resp["capabilities"]` 丢弃顶层 `unstable_features`；`Capabilities` 类型（62-92 行）缺 `unstable_features` 字段（仅 `[key: string]: unknown` + 枚举的 `io.hula.*`/`ai_connection`/`openclaw`）。
- **结论**：修复责任在 **SDK 侧**——收口原生方法、补全类型即可消除裸调（见 §6 修复方案）。

### 2.2 `MatrixAuthSaml.getSSOData` / `getSSOMetadata`
- **核实结论（2026-09-08）**：SDK 已提供 `SamlAuthManager.getIdpMetadata()`（`src/saml/index.ts:104-124`），对应 `/_matrix/client/r0/saml/metadata`。前端裸调 `/login/saml/metadata` 路径与 SDK 标准不一致。
- **结论**：**P2-1 已部分解决**，建议前端改用 SDK `SamlAuthManager`。若需支持 `/login/saml/metadata` 私有实现，属前端路径适配问题（非 SDK 缺失）。

### 2.3 `MatrixDeviceService.getUserDevices`
- **核实结论（2026-09-08）**：`getUserDevices` 在 `matrix-client-extensions.ts:644` 仅为**类型声明**，运行时无实现。前端当前裸调 `POST /v3/keys/query` 组装 `device_map`，与 `client.downloadKeysForUsers` 语义冲突（后者写入 crypto store）。
- **后端现状**：`/users/{userId}/devices` 仅 AdminManager 可达（admin 权限），无非 Admin 纯查询接口。
- **结论**：**P1-1** 属功能缺失。建议方案（按优先级）： 
  1. SDK 新增 `queryDevicesOnly(...)` 选项避免 crypto 写； 
  2. 或后端提供 `GET /devices/{userId}` 非 Admin 纯查询（如基于 device list 可见性策略）。当前保留裸调。

### 2.4 `MatrixVoiceService.uploadVoice` / `getRoomVoiceList` / `getUserVoiceList`
- **核实结论（2026-09-08）**：  
  | 问题 | 实际情况 | 建议方案 |
  |------|----------|----------|
  | **P0-2 uploadVoice 格式** | 后端 `upload_voice_message` 接收 `Json<Value>` `{content, duration_ms, waveform, content_type}`，前端 FormData → **JSON body 签名不匹配** | 前端改为 JSON+base64，或后端补 multipart 支持 |
  | **P1-2 getRoomVoiceList** | 后端返回 `{messages, next_batch}`，前端期望 `{voices, total, offset}` → **字段错位 + 400（`deny_unknown_fields` 拒 absolute offset）** | 前端同步返回体映射；若需 `total`，需后端聚合计算 |
- **结论**：传输格式与语义不匹配，**暂保留裸调**，但 P0-2 为前端优先修复。

### 2.5 `MatrixAIConnectionService` ⛔ 已删除（2026-09-11）
- **决策依据**：后端 synapse-rust 全仓无 `ai/` 路由（`grep` 零命中），且后端已明确决定删除 AI 相关功能；SDK fork 的 `client.aiConnection.*` 语义与前端请求体不匹配（`createConnection(type, server_name)` vs `{name, type, config}`），前端无法自实现（MCP 代理必须在服务端）。
- **结论**：子系统 A（AI Connection / MCP）整体删除，不再等待路由落地收口。
- **删除范围**：`MatrixAIConnectionService.ts` + 2 个测试、`paths/ai.ts` + `paths/__tests__/ai.test.ts`、`AiConnectionSettings.vue`、`settingsSchema.ts` 的 `aiConnection` tab（17→16）、`tabComponentLoaders.ts` 注册、`MatrixCapabilityService.ts` 的 `ai-connection` capability 与 `canUseAiConnection`、`PermissionGuard.vue` 映射、`AccountDataService.ts` 的 5 个 AI 包装方法（无调用方）、`types/message.ts` 的 `ai_connection` 字段、`types/matrix-services.ts` 的 `AIConnectionInfo` re-export、zh-CN/en `setting.json` 的 3 处 i18n 键。
- **保留**：子系统 B（聊天机器人 / AI 扩展：`AIService.ts`、`ConversationService.ts`、`ApiKeyService.ts`、`ModelService.ts`、`ChatRoleService.ts` + `plugins/robot` + `MatrixHttpClient` 的 `VITE_AI_EXTENSION_ENABLED` 网关）——它走 Java 后端 assistant/conversation 端点，与 synapse-rust 的 `ai/` 路由无关，不在本次删除范围。

---

## 3. 待验证的疑问 → 核实结果

| 问题 | 核实结果（2026-09-08） | 责任方 |
|------|----------------------|--------|
| voice.rs `upload_voice_message` 用 `Json(body)` vs 前端 FormData | 后端已实现 JSON body（`content` base64），前端仍 FormData → **前端需改** | 前端 / SDK |
| `/capabilities` 返回 `unstable_features` 字段位置 | 后端 `build_capabilities_response` 已返回顶层 `unstable_features`（测试已覆盖）。SDK `serverCapabilities.ts:154` 丢弃 → **SDK 需修** | SDK |
| `getUserDevices` 侧写副作用 | SDK `downloadKeysForUsers` 会写入 crypto store；后端无纯查询接口 | SDK+后端 |
| `getRoomVoiceList` 返回结构错位 | 后端返回 `messages+next_batch`；前端期望 `voices+total` 且传入 `offset` → 400 错误 | 前端+SDK |

---

## 4. 后续行动

### P0
1. **P0-1**（已解）：SDK `serverCapabilities.ts` 修复：保留 `unstable_features` 顶层字段；同步扩展 `Capabilities` 类型；
2. **P0-2**：前端 `MatrixVoiceService.uploadVoice` 改为 JSON+base64 或使用 SDK `uploadVoiceMessage`（若支持 FormData）；
3. **P0-3**（已解但需收尾）：SDK 删除 `ai-connection/` 目录 + client 上的 `aiConnection` 属性 + manager 注册（前端已删，SDK 滞后）。

### P1
4. **P1-1**（待决策）：SDK `downloadKeysForUsers` 增加 `queryOnly: boolean` 选项（不写 crypto store），或后端补非 Admin GET /devices/{userId}。
5. **P1-2**：前端 `getRoomVoiceList` 请求体改为 `{limit, from}`（对齐后端 `VoiceListQuery`），接收体改为 `{messages, next_batch}`；若需 `total`，后端另加聚合字段或单独统计接口。

### P2
6. **P2-1**（已部分解决）：前端改用 `SamlAuthManager.getIdpMetadata()`；若需 v3 路径，SDK 补 `getSsoMetadataV3`。
7. **P2-2**（同 P0-1）：`Capabilities` 类型补 `unstable_features` + `io.hula.*` 字段声明。

---

## 5. 变更清单（本轮）

### 5.1 已收口（前期）
| 文件 | 变更 |
|------|------|
| `src/services/matrix/friends/MatrixFriendService.ts` | `getFriendStatusInfo` 收口至 SDK |
| `src/services/matrix/messaging/messageQueryHelpers.ts` | `fetchServerMessages` 收口至 `client.createMessagesRequest`； |
| `src/services/matrix/messaging/__tests__/messageQueryHelpers.test.ts` | 测试桩实现 `createMessagesRequest`； |
| `src/services/matrix/messaging/__tests__/message.contract.test.ts` | 采用 URL 参数顺序不敏感的断言方式； |

### 5.2 子系统 A — AI Connection / MCP 全量删除（2026-09-11）
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

## 6. SDK 侧 / 后端侧修复方案（2026-09-08 核实后）

> 说明：本轮仅**核实并出方案**，未改动 SDK/后端源码。每项标注责任方与具体落点，供对应团队排期。

### 6.1 P0-1 / P2-2 · `getCapabilities` 丢弃 `unstable_features`（**SDK 侧，1 处改**）
- **事实修正**：审计原文「后端只返回 capabilities 子树」**已过期**。后端 `synapse-services/src/capability_governance.rs::build_capabilities_response` 第一行即返回顶层 `unstable_features`（含 `org.matrix.msc*` 与 `io.hula.*`，测试 `test_build_capabilities_response` 覆盖）。**修复无需后端改动**。
- **SDK 落点**：`matrix-js-sdk/src/serverCapabilities.ts`
  1. 第 94-96 行 `type CapabilitiesResponse` 补字段：`unstable_features?: Record<string, boolean>;`
  2. 第 152-156 行 `fetchCapabilities`：把 `resp.unstable_features` 缓存到私有字段 `this.unstableFeatures`，不再丢弃。
  3. 新增只读 API：`getUnstableFeatures(): Record<string, boolean> | undefined` 与便捷判定 `hasUnstableFeature(name: string): boolean`（自动补 `org.matrix.msc` 前缀）。
  4. 第 62-92 行 `Capabilities` 接口补 `unstable_features?: Record<string, boolean>;` 显式声明（消除 `P2-2` 类型不完整）。
- **收口收益**：前端 `MatrixAccountService.getCapabilities` 可切回 SDK 原生 `client.getCapabilities()` + `client.hasUnstableFeature('msc4204')`，**消除 §2.1 裸调**。
- **前端落点（收口后）**：`MatrixCapabilityService.ts` 用 `getUnstableFeatures()` 替换手写 `unstable_features` 解析。

### 6.2 P0-2 · `uploadVoice` 传输格式不匹配（**前后端二选一，推荐后端补 multipart**）
- **事实**：后端 `synapse-web/src/routes/voice.rs::upload_voice_message` 接收 `Json<Value>`，要求 `{content: base64, content_type, duration_ms, waveform}`；前端 `MatrixVoiceService.ts:158-162` 发 `FormData`（`file` + `roomId`）→ **视频/语音消息上传必然失败**。
- **方案 A（推荐，后端）**：后端 handler 改 `multipart/form-data`（axum `multipart::Multipart`），与语音原始字节上传天然契合，避免 base64 膨胀 ~33%。SDK `uploadVoiceMessage` 同步改 FormData 通道。
- **方案 B（前端）**：前端读文件 → base64 → 按 `{content, content_type, duration_ms}` JSON 提交；大文件有内存/体积代价。
- **决策点**：需后端确认 wire format 后再动 SDK `voice/index.ts`。二者不匹配期间**前端保留裸调合理**。

### 6.3 P0-3 · AI Connection / MCP 子系统（**SDK 侧残留待清**）
- **事实**：后端无 `ai/` 路由、前端已全删（§2.5）。SDK fork 侧仍有条件注册残留：
  - `src/manager-extensions/index.ts:94` `{ option: "includeAiConnection", module: "ai-connection" }`
  - `src/manager-extensions/index.ts:511` `safeDynamicImport(import("../ai-connection/index.js")...)`
  - `src/client-infra/manager-registry.ts:194` `aiConnection: import("../ai-connection/index").AIConnectionManager;`
  - `src/matrix-client-extensions.ts:377` `getAIConnectionManager(): ...`
  - `src/matrix-managers.ts:244/254` `export { AIConnectionManager, AIConnectionEvent } ...`
  - `src/serverCapabilities.ts:90` `ai_connection?: ICapability;`
- **方案**：后端已决定删除该功能 → SDK fork **同步删除** `src/ai-connection/` 目录 + 上述 6 处引用（保留 option flag 名会以 no-op 兼容，避免破坏既有调用方；若确认无外部消费方则连 option 一起删）。
- **优先级**：低（不影响运行时，属死代码/漂移风险），可与 fork rebase 治理一并处理。

### 6.4 P1-1 · `getUserDevices` 副作用（**SDK 侧或后端，需决策**）
- **事实**：SDK `getUserDevices` 仅类型声明无运行实现；`downloadKeysForUsers` 写 crypto store；后端无非 Admin `GET /devices/{userId}` 纯查询。
- **方案 A（推荐，SDK 侧，改动小）**：`device-keys/index.ts` 的 `downloadKeysForUsers` 增加 `{ saveToStore = true }` 选项；传 `false` 时走纯 `POST /keys/query` 不落库。前端 `getUserDevices` 裸调收口为 `downloadKeysForUsers(users, { saveToStore: false })`。
- **方案 B（后端）**：提供 `GET /_matrix/client/v3/devices/{userId}` 受 device-list 可见性约束的纯查询。成本高、语义需对齐 MSC。
- **结论**：优先方案 A。

### 6.5 P1-2 · `getRoomVoiceList` 返回结构错位（**前端为主，SDK 可选封装**）
- **事实**：后端 `/v3/voice/room/{id}` handler `get_room_voice_messages` 返回 `{messages, next_batch}`；`VoiceListQuery` 为 `#[serde(deny_unknown_fields)]` 仅收 `{limit, from}`。前端 `MatrixVoiceService.ts` 传 `offset` → **必然 400**；且读 `result.voices` / `result.total` → 字段全错，列表恒空。
- **前端落点**（立即可修，无需后端）：
  1. 请求 query 由 `{limit, offset}` 改为 `{limit, from}`（游标分页，非偏移分页）。
  2. 响应解析由 `{voices, total}` 改为 `{messages, next_batch}`；如需 `total`，用单独 `GET /v3/voice/room/{id}/stats`（后端已存在）。
- **SDK 落点（可选，收口）**：`voice/index.ts` 的 `getRoomVoice` 目前只包 stats → 补 `listRoomVoiceMessages(roomId, {limit, from})` 封装 messages 路由，前端即可收口裸调。

### 6.6 P2-1 · SSO / SAML metadata（**前端适配，SDK 已有能力**）
- **事实**：SDK `SamlAuthManager.getIdpMetadata()` 命中 `/_matrix/client/r0/saml/metadata`（后端 `saml.rs` 提供）；前端裸调 `/login/saml/metadata` 为另一私有路径。
- **方案**：前端 `MatrixAuthSaml.getSSOMetadata` 改用 `client.getSamlAuthManager()?.getIdpMetadata()`。若确需 `/login/saml/metadata`，属后端路径别名，非 SDK 缺口。

### 6.7 修复优先级与依赖矩阵

| 编号 | 责任方 | 改动量 | 是否阻塞前端收口 | 建议排期 |
|------|--------|--------|------------------|----------|
| P0-1 / P2-2 | SDK | 小（1 文件） | ✅ 收口 getCapabilities | Sprint 内 |
| P0-2 | 后端 or 前端 | 中 | ✅ 视频消息上传 | **需先定 wire format** |
| P1-2 | 前端 | 小 | ❌（前端可自修） | Sprint 内（400 bug） |
| P1-1 | SDK | 中 | ✅ 收口 getUserDevices | 次 Sprint |
| P2-1 | 前端 | 小 | ✅ 收口 getSSOMetadata | 随手改 |
| P0-3 | SDK | 小（删代码） | ❌（无调用方） | 随 rebase 治理 |

> ⚠️ **P1-2 是唯一在运行时直接导致功能损坏（400 + 列表恒空）的问题，建议不等 SDK/后端，前端先行修复。**