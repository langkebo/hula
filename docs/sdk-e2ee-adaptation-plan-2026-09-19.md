# Matrix SDK Fork E2EE 适配方案 v2.4
**日期**: 2026-09-19
**范围**: `matrix-js-sdk`（fork `@langkebo/matrix-js-sdk`）+ `Tjg` 前端 E2EE 集成面
**上游依据**: `synapse-rust/docs/2026-09-19-synapse-rust-e2ee-optimization-plan-v2.md`
**复核方法**: 逐条以源码证据验证 v1.1 断言；后端以 `synapse-web/src/routes/**`、`synapse-services/src/**` 为事实源

---

## 0. 复核摘要

> **v2.3 增量（Phase 2.1 落地 + 两处事实纠正）**：实施 **Phase 2.1**——移除 `MatrixVoiceService.uploadVoice` 的**无条件加密**，加密决策回归调用方 `useVoiceInput` 单点（按房间加密状态），并补"明文通道不得加密"回归守卫。据此 **R-07（明文房间语音被加密上传）转"已消除"**。
>
> 本轮同时对账后端并**纠正两处此前写错的事实**：
> 1. **R-01 的"服务端转写/转码处理密文"不成立**。`synapse-web/src/routes/voice.rs:320-326` 的转写路由是"客户端职责"桩（返回提示而非转写），`media_service.rs` 全仓无 `transcode`/`ffmpeg`（`upload_media` 仅按 `content_type` 推导扩展名后落盘）。真实危害是**字节与声明不符**：`content_type` 被当作落库 mimetype 并在语音列表行回显。
> 2. **`/voice/upload` 无法承载密文**：`voice_service.rs:7,43-48,81` 的 `validate_audio_content_type` 只放行 `audio/*` 白名单，`application/octet-stream` 会被**直接拒绝**。因此原 Phase 2.2 的"加密路径上报 `application/octet-stream`"**不可能在本端点上实现**——它只在标准 media 上传路径成立，而该路径（`MatrixMediaService.uploadEncryptedFile`）本就以 `application/octet-stream` 上传。**推论：加密语音不得走 `/voice/upload`**，这直接决定了 2.1 的修法。

> **v2.2 增量（闭环交付）**：Phase 0 的产出**已重新打包并被前端真实消费**——`matrix-js-sdk` 重编译 `lib/`、重出 `vendor/matrix-js-sdk.tgz`、版本 `40.2.0-langkebo.1 → 40.2.0-langkebo.2`、`meta/sdk-pin.json` 与 `pnpm-lock.yaml` 同步更新，`verify-sdk-pin.mjs` 通过。SDK 侧提交 `48fba9f50`。
>
> 这一步的意义不只是"发版"：**换上新产物后 `vue-tsc --noEmit` 立刻报出 3 处 `TS2339`**，全部落在前端此前读取后端从未返回的字段上（见 D-17）。也就是说，上一轮"SDK 单测全绿"只证明 SDK 内部自洽，**真正的端到端契约验证必须让前端消费新产物**——旧 vendor tgz 会把所有前端侧契约错误全部屏蔽。执行过程中新增 D-17（语音上传读幻影字段）、D-18（语音列表声明幻影行形状且未收口）。

> **v2.1 增量**：Phase 0 八项阻断级热修**已全部落地并实测通过**（详见 §5 Phase 0 表）。执行过程中又实证出 5 条缺陷：D-12（前端 `this.client` 不存在 → 设备列表恒空）、D-13（`CryptoDeviceAdapter` 按幻影 `user_id` 过滤 → 恒空）、D-14（`TrustLevel` 联合类型与后端不符 → `isDeviceBlocked()` 恒 `false`）、D-15（codegen 源文档携带同一批错误 DTO）、D-16（`getSecuritySummary` 兜底策略的保留理由）。D-12/D-13 与 D-01 属同一根因族：**把"字段存在"当成"字段可用"**。

v1.1 的定位是「E2EE 适配方案」，但实际内容中约 70% 为非 E2EE 项（AI Connection 清理、voice 列表分页、SSO metadata），而真正的 E2EE 适配面（交叉签名、密钥备份、SSSS、加密附件、vodozemac 兼容）几乎未覆盖。经本轮逐条实证，v1.1 的 9 项「已完成/已实现」中：

| 判定 | 数量 | 条目 |
|------|------|------|
| ✅ 与代码一致 | 3 | P0-3 清理、M-01 KeyRotation（端点正确）、M-03 DeviceTrust（端点正确） |
| ❌ 与代码不符 | 3 | P0-1（helper 对部分真实 key 失效且**零调用方**）、P1-1（端点语义 + 响应形状双错配）、P1-2（字段名全错 + 分页语义错） |
| 🚫 路径不存在 | 1 | 新增的 `listRoomVoiceMessages` / `listUserVoiceMessages`（`/messages` 段后端没有 → 404） |
| ⚠️ 描述失真 | 2 | P0-2「已完成」（把**传输格式**当成 **E2EE** 收口）、M-02（`uploadDeviceSigning` 是新增而非「增强」） |

**严重度分布**：P0 × 6、P1 × 6、P2 × 4、P3 × 2（共 18 项，v2.2 新增 2 项）

**最重要的结论**：v1.1 把「传得动」当成了「加得密」。P0-2 的 multipart 改造只优化了传输编码，与端到端加密无关；而后端全仓 **没有任何 MSC3861/加密媒体代码**，语音密文还被以 `audio/webm` 声明给服务端处理。这不是收口，是语义混淆。

---

## 1. v1.1 断言纠错（事实层）

| v1.1 断言 | 实测结果 | 证据 |
|-----------|----------|------|
| P0-1 已实现 `getUnstableFeatures()` / `hasUnstableFeature()` | 方法存在，但前缀拼接逻辑对非 `org.matrix.msc*` 命名空间的真实 key 失效（9 个真实 key 中仅 5 个可匹配）；且**全仓零调用方**（SDK + 前端均未引用） | `src/serverCapabilities.ts:177-193`；真实 key 见 `synapse-services/src/capability_governance.rs:451-465` |
| P1-1「改用 SDK `getDeviceKeysManager().getUserDevices()` 收口 `GET /devices`」 | 该端点**不接受 userId**（用 `auth_user.user_id`），返回 `{devices:[...]}`；SDK 返回类型却声明为 `Record<string, IContent>`；前端按 `device_keys[userId]` 取值 → **恒为空数组** | `synapse-web/src/routes/device.rs:241,248-268`；`src/client.ts:1311-1320`；`Tjg/.../MatrixDeviceService.ts:98-102` |
| P1-2「query `offset → from`，响应 `voices/total → messages/next_batch`」 | 字段名**全错**（后端返回 `media_id/user_id/content_uri/duration_ms/created_ts`）；`from` 是**毫秒时间戳游标**而非位置偏移；形参仍叫 `offset` | `synapse-services/src/voice_service.rs:291-307,217-237`；`Tjg/.../MatrixVoiceService.ts:317-345` |
| 「`VoiceManager.listRoomVoiceMessages()` → GET `/vendor/v1/voice/room/{roomId}/messages`」 | **该路径不存在**。实际为 `/voice/room/{room_id}`（无 `/messages` 段） | `synapse-web/src/routes/voice.rs:57-58,67-68` vs `src/voice/index.ts:412,445` |
| P0-2 uploadVoiceMultipart 已收口（隐含"E2EE 相关"） | multipart 仅为传输编码优化；后端无任何 MSC3861 实现；密文以原始 MIME 上报 | `grep -rn "msc3861\|encrypted.*media"` 在 `synapse-web/src`、`synapse-services/src` **零命中**；`Tjg/.../MatrixVoiceService.ts:166-174` |
| M-01 KeyRotationManager 端点「已实现」 | 端点存在且 SDK 的 `VendorPrefix` 正确；但**全部 5 个端点均要求 `is_admin`**，而 SDK 把它挂在普通 client 接口上 | `synapse-web/src/routes/key_rotation.rs:13-19,64-71,96-103,131-138,235-237`；`src/key-rotation/index.ts:433-438` |

---

## 2. 缺陷登记册

### D-01（P0）`getUserDevices(userId)` 语义与响应双重错配

**现象**：好友详情页设备列表恒为空，且静默降级（不抛错、不打 warn 之外的信息）。

**证据链**
- 后端 `device.rs:241` 注册 `GET /devices`，**无 `{user_id}` 路径段**；handler `device.rs:252` 使用 `auth_user.user_id`；响应 `device.rs:266-268` 为 `{"devices":[{device_id,display_name,last_seen_ts,last_seen_ip}]}`。
- SDK `client.ts:1311-1320` 签名 `getUserDevices(userId: string): Promise<UserDeviceMap>`，其中 `UserDeviceMap = Record<string, IContent>`（`matrix-client-extensions.ts:110`），实现体**完全忽略 `userId`** 并原样返回 `{devices:[...]}`。
- 前端 `MatrixDeviceService.ts:98-102` 读 `resp?.device_keys?.[userId] ?? {}` → `device_keys` 永不存在 → `deviceMap = {}` → `devices = []`。

**影响**
1. 功能性：好友设备列表 100% 空。
2. 安全相关性：方法名暗示「查他人设备」，实际返回**调用者自己的设备**。若未来有调用方把它当授权依据（如"该用户无其他设备，可信任"），会得到错误结论。
3. 类型安全失效：`as unknown as {...}` 双重断言绕过了编译器检查，这是本缺陷能存活的原因。

**修正**
- 恢复矩阵语义：查询**他人**设备键必须走 `POST /keys/query`（`synapse-web/src/routes/e2ee/keys.rs:25`），响应为 `device_keys[userId][deviceId]`。
- SDK 侧新增 `getOwnDevices(): Promise<{devices: IDevice[]}>`（无参，对应 `GET /devices`，形状与后端一致）；`getUserDevices(userId)` 改为委托 `E2EEManager.queryKeys({device_keys:{[userId]:[]}})` 并返回归一化后的 `Record<deviceId, DeviceKeys>`。
- 前端移除 `resp.device_keys?.[userId]` 之外的形状猜测，改为消费 SDK 已归一化的返回。

**验收**：新增 SDK 单测断言请求路径为 `/keys/query` 且 body 形如 `{device_keys:{'@a:b':[]}}`；前端单测断言拿到非空设备时 `display_name` 正确映射。

---

### D-02（P0）新增 voice 列表方法路径不存在（必然 404）

**证据**：`src/voice/index.ts:412` 请求 `/voice/room/{roomId}/messages`、`:445` 请求 `/voice/user/{userId}/messages`；后端实际路由（`voice.rs:57-58` v3、`:67-68` vendor）为 `/voice/room/{room_id}` 与 `/voice/user/{user_id}`，**没有 `/messages` 段**。前端 `paths/voice.ts:6-7` 用的才是正确路径。

**影响**：`listRoomVoiceMessages` / `listUserVoiceMessages` 一旦被调用必 404（本缺陷由上轮基于 v1.1 的错误路径描述引入）。

**修正**：去掉 `/messages` 段，路径与 `MATRIX_PATHS.VOICE.ROOM_LIST/USER_LIST` 对齐，并补契约测试断言精确 URL。

---

### D-03（P0）voice 列表字段名与后端 payload 完全不符

**证据**
- 后端 `voice_service.rs:291-307` 序列化为：`media_id`、`user_id`、`room_id`、`content_uri`、`content_type`、`duration_ms`、`size_bytes`、`created_ts`。
- SDK `src/voice/index.ts:120-127` `IVoiceMessageItem`：`event_id`、`sender`、`duration`、`timestamp`、`room_id?` —— 除 `room_id` 外**全部不对**。
- 前端 `MatrixVoiceService.ts:322-324,342-345` 沿用同一套错误字段。

**影响**：任何消费 `messages[].sender/.event_id/.duration/.timestamp` 的 UI 取到 `undefined`；`duration` 恒为 0（进度条/时长显示失效）。

**修正**：以 `IVoiceMessageItem` 精确对齐后端字段（`media_id`/`user_id`/`content_uri`/`content_type`/`duration_ms`/`size_bytes`/`created_ts`），如需 UI 友好命名则**增加显式映射函数**（并单测），不在类型上撒谎。

---

### D-04（P0）voice 列表分页语义错位：位置偏移当作时间戳游标

**证据**
- 后端 `voice.rs:37-42`：`VoiceListQuery { limit: Option<i64>, from: Option<i64> }`。
- 服务层 `voice_service.rs:217-237`：参数名为 `from_ts`，`next_batch = 最后一条记录的 created_ts`（i64 或 `null`）。
- 前端 `MatrixVoiceService.ts:319-320,340`：形参仍是 `offset: number`，却 `from: String(offset)`，`next_batch` 又从 `result.next_batch` 直接取字符串。

**影响**：传入 `offset=10` 后语义变为「`created_ts >= 10`」，即过滤条件退化为恒真；正确翻页（把 `next_batch` 回填为 `from`）从未发生。同时 `next_batch` 是**毫秒时间戳**，若同毫秒多记录，翻页会跳过或重复。

**修正**
- 形参改名 `fromTs?: number`，与 `next_batch` 数值类型贯通（见 D-08）。
- 后端侧建议：游标改为 `(created_ts, media_id)` 复合键，避免同毫秒歧义（需后端配合，列为跨仓事项）。

---

### D-05（P1）`hasUnstableFeature` 前缀拼接失效 + 零调用方

**证据**
- 真实 key（`capability_governance.rs:451-465`）：`io.hula.friends`、`org.matrix.msc3245.voice`、`org.matrix.msc3983.thread`、`org.matrix.msc3886.sliding_sync`、`org.matrix.simplified_msc3575`、`org.matrix.msc4186`、`io.hula.burn_after_read`、`org.matrix.msc4108`、`uk.tcpip.msc4133`。
- 实现（`src/serverCapabilities.ts:188-193`）：`const key = name.startsWith("org.matrix.msc") ? name : \`org.matrix.msc${name}\``。
  | 调用 | 实际拼出的 key | 结果 |
  |------|----------------|------|
  | `hasUnstableFeature("io.hula.friends")` | `org.matrix.mscio.hula.friends` | ❌ 恒 false |
  | `hasUnstableFeature("uk.tcpip.msc4133")` | `org.matrix.mscuk.tcpip.msc4133` | ❌ |
  | `hasUnstableFeature("org.matrix.simplified_msc3575")` | `org.matrix.mscorg.matrix.simplified_msc3575` | ❌ |
  | `hasUnstableFeature("msc3245.voice")` | `org.matrix.mscmsc3245.voice` | ❌ |
  | `hasUnstableFeature("msc4204")` | `org.matrix.msc4204` | ✅（仅此形态可用） |

**影响**：当前为死代码（SDK/前端零引用），但一旦被按文档注释采用（注释明确举了 `io.hula.friends` 为例），会静默返回 false 导致能力误判、功能被静默禁用。

**修正**：删除前缀猜测，改为**精确查表** `features[name] === true`；调用方使用后端真实 key。`SynapseRustFeature` 枚举（`server-capabilities/index.ts:45-53`）同步为真实 key 常量，见 D-09。

**Phase 0 执行结果（2026-09-19）**：已改精确查表。保留一条受限便利展开：`mscNNNN` / `NNNN` → `org.matrix.mscNNNN`（结果仍必须在服务端返回的 map 中存在，因此只可能产生 false negative，不会 false positive）。泛化到 `MatrixClient.hasUnstableFeature()` / `getUnstableFeatures()`，此前**没有任何可达入口**（`serverCapabilitiesService` 是 client 上的 public 字段但不在导出类型里）。9 个真实 key 逐条断言见 `spec/unit/api-consistency/synapse-rust-dto-contracts.spec.ts`。

**修正后的可匹配比例**：修复前 9 个真实 key 中 **5 个**可匹配（`org.matrix.msc*` 命名空间的 5 个），4 个恒 false（`io.hula.friends`、`org.matrix.simplified_msc3575`、`io.hula.burn_after_read`、`uk.tcpip.msc4133`）；修复后 9/9 可匹配。

---

### D-06（P1）语音密文以原始 MIME 上报 → 服务端对密文做转码/转写

**证据**
- 前端 `MatrixVoiceService.ts:166-174`：先 `encryptAttachment(file)` 得到密文 Blob（`File` 的 `type` 设为 `application/octet-stream`），但 FormData 的 `content_type` 字段填的是**原始** `audio/webm`。
- 后端白名单校验接受 `audio/webm`（`voice.rs:88-92` 返回 `allowed_formats`），落库 `record.content_type = 'audio/webm'`（`voice_service.rs:302`）。
- 后端提供 `/voice/{media_id}/convert|optimize|transcription`（`voice.rs:59-62`）。

**影响**
1. 服务端记录的 `content_type` 与其实际字节（AES-CTR 密文）不符，字段可信度归零。
2. `/transcription` 会把密文送进转写服务 → 报错或产出垃圾（且可能产生无意义的外部调用与成本）。
3. 任何依赖 `content_type` 做路由/校验的下游逻辑被误导。

**修正**：加密路径下 `content_type` 上报 `application/octet-stream`；加密房间禁用服务端 `convert/optimize/transcription` 入口（前端短路 + 后端按 content_type 拒绝）；如需保留元数据，按 MSC3861 把加密描述符写入事件 content 而非 MIME。

---

### D-07（P1）语音存在两条互斥存储路径，且加密无开关

**证据**
- `Tjg/.../useVoiceInput.ts:30-47`：**加密房间** → `matrixMediaService.uploadEncryptedFile`（标准媒体上传）；**明文房间** → `matrixVoiceService.uploadVoice`。
- `MatrixVoiceService.ts:165-166`：`uploadVoice` **无条件**加密，注释写明"与图片/文件/视频同一条加密链路（无开关）"。
- 后端 voice 列表接口只反映 `/voice/upload` 落库的记录（`voice_service.rs:217-237`）。

**影响**
1. 同一消息类型依房间加密状态落入两套存储（标准 media vs 自定义 voice 表）。
2. `getRoomVoiceList` 只看得到走 `/voice/upload` 的那批；加密房间的语音（走标准 media）**不出现在 voice 列表**。反之，明文房间的语音被加密后进入 voice 表，其他端若按"明文先试"处理会得到不可读字节。
3. 「无开关」的无条件加密与 MSC3245「明文房间不加密」的常规预期冲突，导致跨客户端互通性下降。

**修正**：二选一并写进契约。
- 方案 A（推荐）：语音一律走**标准媒体上传** + 事件 content 携带 `file`（MSC3861 加密描述符）；`/voice/upload` 退化为非加密房间的历史兼容路径。
- 方案 B：`/voice/upload` 仅服务非加密房间，加密房间语音不进 voice 表，且列表接口在文档中明确该边界。
无论哪种，`MatrixVoiceService.uploadVoice` 的"无条件加密"必须改为**由房间加密状态决定**，与 `useVoiceInput` 的判断合并为一处。

---

### D-08（P2）类型漂移：`next_batch` 数值 vs 字符串、`has_more` 幻影字段、`from` 类型

**证据**：后端 `next_batch` 为 i64 或 `null`（`voice_service.rs:231-236`），从不返回 `has_more`；SDK 声明 `next_batch?: string | null`、`has_more?: boolean`、`IVoiceListQueryParams.from?: string`（`src/voice/index.ts:129-138`）。

**影响**：类型与运行时不符；`has_more` 永远是 `undefined`，调用方若据此判断会逻辑错乱。

**修正**：`next_batch: number | null`、`from?: number`、**删除** `has_more`；如需 `has_more`，以 `next_batch !== null` 派生。

---

### D-09（P2）两条并行 capability 表面，语义分裂

**证据**
- 表面一：`src/serverCapabilities.ts`（`ServerCapabilities` 类 + 新 helper），零消费方。
- 表面二：`src/server-capabilities/index.ts`（`ServerCapabilitiesManager`，`:45-53` 枚举、`:81-87` 别名、`:199-209` 合并顶层 `unstable_features`、`:246-257` 探测），被 `VoiceManager.isSupported()` 等消费。
- `SynapseRustFeature.Voice = "org.matrix.msc3245"`，而 `/capabilities.unstable_features` 的真实 key 是 `org.matrix.msc3245.voice`（`capability_governance.rs:454`）；当前仅靠 `/versions` 中存在 `org.matrix.msc3245`（`capability_governance.rs:259`）与别名 `m.voice` 兜住。

**影响**：同一能力两套判定逻辑 + 一处 key 名不精确，长期必然分叉（例如后端某天移除 `/versions` 冗余 key 即静默失效）。

**修正**：收敛为单表 `Record<FeatureName, string[]>`（主 key + 别名），两处共用；`Voice` 主 key 改为 `org.matrix.msc3245.voice`，保留 `org.matrix.msc3245` 与 `m.voice` 为别名。

---

### D-10（P2）鉴权边界未在 SDK 层暴露

**证据**：key rotation 的 **5 个端点全部要求 `is_admin`**（`key_rotation.rs:13-19` status、`:64-71` history、`:96-103` revoke、`:131-138` configure、`:235-237` check），而 `KeyRotationManager` 通过 `MatrixClient.prototype.getKeyRotationManager`（`src/key-rotation/index.ts:433-438`）暴露给任意已登录用户。此外 `get_rotation_history` 在 `:74` 把 `user_id` 硬编码为 `auth_user.user_id`（管理员也只能查自己的），而 `revoke_key(key_id, reason)` **未按用户作用域过滤**。

**影响**
1. 非管理员调用全部返回 403；`getStatus` 走 `withRetry`，需确认 403 是否被反复重试（若不区分可重试错误，会形成无效重试）。**待验证项**。
2. SDK 的 JSDoc 未标注 admin 前置条件，调用方无从知晓。
3. `revokeKey` 是全局作用域的强力原语，出现在普通 client 接口上易被误用。

**修正**：① 在 SDK 层为 admin 方法加显式命名前缀或独立 `AdminE2EEManager`；② JSDoc 统一标注「requires server admin」；③ 确认 `withRetry` 对 4xx 不重试；④ 后端 `revoke_key` 增加用户/设备作用域限制（跨仓事项）。

---

### D-11（P1）同一 E2EE 端点在三个 Manager 中被声明了四种互相冲突的契约

**背景**：`device_trust` / `device_verification` / `security/summary` 三组端点被 `device-trust/index.ts`（专用）、`device-keys/index.ts`、`e2ee/index.ts` **三处重复封装**，各自手写 DTO。实测只有 `device-trust/index.ts` 与后端一致，另两处为早期猜测且从未对账。

**证据（后端为事实源）**

| 端点 | 后端真实结构 | `DeviceTrustManager` | `E2EEManager` | `DeviceKeysManager` |
|------|--------------|----------------------|---------------|---------------------|
| `GET /device_trust` | `{"devices":[{device_id,trust_level,verified_at,verified_by}]}`（`e2ee/devices.rs:516-537`） | ✅ 读 `response.devices` → `IDeviceTrustInfo[]` | ❌ 声明 `Record<string, DeviceTrustInfo>`，实际拿到 `{devices:[...]}` | ❌ 同 `E2EEManager` |
| `GET /device_trust/{id}` | `{device_id,trust_level,verified_at,verified_by}`（`devices.rs:541-557`） | ✅ 字段完整 | ❌ 多出幻影 `user_id`，缺 `verified_by` | ❌ 同 `E2EEManager` |
| `GET /security/summary` | `{verified_devices,unverified_devices,blocked_devices,has_cross_signing_master,security_score,recommendations}`（`devices.rs:559-575`） | ✅ 字段完整 | ❌ 声明为 `{devices_total,devices_verified,devices_unverified,cross_signing_ready}` — **全错**，且异常时返回该错误形状的零值对象，掩盖故障 | ❌ 同 `E2EEManager` |
| `GET /device_verification/status/{token}` | `{request_token,token,status,expires_at,methods_available}` 或 `{status:"not_found"}`（`devices.rs:493-512`） | ✅（`VerificationStatus` 含 `not_found`） | ❌ 声明为 `{token,state:"pending"\|...}` — 字段应为 `status` 而非 `state`，`state` 永不存在 | ❌ 同 `E2EEManager` |
| `POST /device_verification/respond` | 读 `request_token`（fallback `token`）+ **`approved`（bool，缺省 `false`）**（`devices.rs:469-488`） | ✅ 发 `{token, approved}` | ❌ body 类型为 `{token, action}` → **不发 `approved`** | ✅ 发 `{token, request_token, approved}` |

**最严重的一条**：`E2EEManager.respondDeviceVerification({ token, action: "accept" })` 会导致后端 `approved` 走 `.unwrap_or(false)` → **把"接受"静默提交为"拒绝"**，且返回 `{success, trust_level}` 让调用方以为成功。这是功能性缺陷，且语义反向（安全相关）。

**影响**：任何调用 `E2EEManager` / `DeviceKeysManager` 的设备信任或验证代码都会拿到 `undefined` 字段或反向语义。

**修正**
1. 收敛为**单一真源**：删除 `device-keys/index.ts` 与 `e2ee/index.ts` 中重复的 `device_trust` / `device_verification` / `security/summary` 封装，统一委托 `DeviceTrustManager`；或反向由 `E2EEManager` 持有并让 `DeviceTrustManager` 成为薄转发。二选一，不得并存。
2. `E2EEManager.respondDeviceVerification` 的 `action` **改为 `approved: boolean`**，并按后端优先发送 `request_token`。
3. `E2EEManager.getSecuritySummary` 移除"吞异常返回零值"的兜底（会掩盖故障），改为向上抛错由调用方决定降级。
4. 每组端点补一条契约测试，断言响应字段逐个存在。

**Phase 0 执行结果（2026-09-19）**：已按上述 1–4 全量落地。`device-trust/index.ts` 成为唯一真源，`device-keys` / `e2ee` 删除本地 DTO 改为 `re-export` + 委托（`DeviceTrustManager` 经 `client.getDeviceTrustManager()` 取得，**type-only import** 以避开 `device-trust → client` 的运行时循环）。`respondDeviceVerification` 现在把 `approved` 作为规范字段，同时把旧的 `{token, action}` 归一化，不会静默反向。第 3 条只做了一半：**保留**零值兜底但修正为真实字段形状，理由见下方 D-16。

---

### D-12（P0）`MatrixDeviceService.getUserDevices` 访问了不存在的 `this.client` → 恒返回空数组

**背景**：上一轮"P1-1 收口"把裸调改成 `this.client.getDeviceKeysManager().getUserDevices(userId)`，但 `MatrixDeviceService extends BaseMatrixService`，基类只提供 `protected getClient()`（provider 取 client），**没有 `client` 字段**。

**证据**：`Tjg/src/services/matrix/user/MatrixDeviceService.ts:100`（修复前）写 `this.client.…`；`BaseMatrixService.ts:9-40` 仅定义 `getClient()` / `getProvider()` / `setFallbackClient()`。

**影响**：`this.client` 为 `undefined` → `TypeError` 被同方法内的 `catch` 吞掉 → 返回 `[]`。即"好友设备列表"这一功能在收口后**完全不可用**，且因为 `R-06` 的静默降级没有任何日志之外的信号。

**修正**：改回 `this.getClient()`；补单测断言 `getUserDevices` 确实被调用（此前的测试只断言路径，未断言返回值，所以漏过）。

---

### D-13（P0）`CryptoDeviceAdapter.getDevices/getDevice` 用幻影 `user_id` 过滤信任列表 → 恒为空

**背景**：`getDevices(userId)` 以 `DeviceTrustManager.getDeviceTrustList()` 为数据源，再 `.filter(d => d.user_id === userId)`，并读取 `d.display_name` / `d.last_seen_ts` / `d.last_seen_ip`。

**证据**：`devices.rs::get_device_trust_list:525-530` 只序列化 `{device_id, trust_level, verified_at, verified_by}`；且该端点用 `auth_user.user_id`，**只能看当前用户自己的设备**。前端 `src/types/matrix-extensions.d.ts` 曾把 `user_id?` / `display_name?` / `last_seen_ts?` / `last_seen_ip?` 声明为可选字段，从而让这段代码通过了编译期。

**影响**：`CryptoDeviceAdapter.getDevices()` 恒返回 `[]`；`getDevice()` 的 `displayName` 恒 `undefined`。与 D-01 是同一类错误（把"存在字段"当成"可用字段"）。

**修正**：设备来源改为 `DeviceKeysManager.getUserDevices(userId)`（`POST /keys/query`，唯一能查他人设备的端点），信任列表仅用于按 `device_id` 标 `isVerified`；`getDevice` 的兜底分支不再虚构 `display_name`/`last_seen_*`。前端 `.d.ts` 同步删除幻影字段。

---

### D-14（P1）`TrustLevel` 联合类型与后端不符 → `isDeviceBlocked()` 恒 `false`

**背景**：SDK 与前端把 trust level 写作 `"verified" | "cross_signed" | "unverified" | "blacklisted"`。

**证据**：后端只有 `DeviceTrustLevel::{Verified, Unverified, Blocked}`，`Display` 在 `synapse-e2ee/src/device_trust/models.rs:26-29` → `verified` / `unverified` / `blocked`。全仓 `grep cross_signed|blacklisted` 在 `device_trust` 下无任何命中（`cross_signed` 只作为 `e2ee_audit` 的**布尔**字段名出现，与 trust level 无关）。

**影响**：`isDeviceBlocked()` 比较 `"blacklisted"`（拼写错误）→ 永远 `false`，被拉黑的设备会被当成未拉黑；`isDeviceTrusted()` 把不可能出现的 `"cross_signed"` 也当作可信。

**修正**：联合类型改为 `verified | unverified | blocked`；`isDeviceBlocked` 比较 `"blocked"`；`isDeviceTrusted` 只认 `"verified"`。SDK 与前端 `matrix-extensions.d.ts` 同步。

---

### D-15（P3）codegen 源文档也带错误 DTO → 第 4 份错误副本

**背景**：`docs/api-contract/e2ee.md` 是 `scripts/sdk-contract-codegen.mjs` 的输入，其 DTO 片段（`state` 而非 `status`、`cross_signed`/`unknown`、`key_backup_configured`/`cross_signing_setup`）与 D-11 描述的错误完全同源，生成到 `src/e2ee/__generated__/dto.ts`。

**影响**：目前该文件里这些接口**无人 import**（只有 `UploadDeviceSigningRequest` 被使用），属潜伏债务；一旦有人从"看起来权威"的 `__generated__` 路径导入就会再次踩坑。

**修正**：改 `docs/api-contract/e2ee.md` 的 DTO 段落为后端真实形状，再跑 `node scripts/sdk-contract-codegen.mjs` 重新生成（实测只改到 `src/e2ee/__generated__/dto.ts` 一个文件，其余 46 个模块本已同步）。`--check` 通过。

---

### D-16（P3）`getSecuritySummary` 兜底策略保留但修正形状（对 D-11 第 3 条的偏离说明）

**决定**：保留 `try/catch` 兜底，但返回值从错误的 `{devices_total, devices_verified, devices_unverified, cross_signing_ready}` 改为真实字段的全零形状 `{verified_devices:0, unverified_devices:0, blocked_devices:0, has_cross_signing_master:false, security_score:0, recommendations:[]}`。

**理由**：原缺陷是"返回**错误形状**的零值，调用方读字段拿 `undefined`"，而不是"存在兜底"本身。`CryptoHealthMonitor` 会把该结果直接用于健康判定，移除兜底会让一次瞬时失败打断整轮健康检查。若需可感知失败，正确做法是额外 `emit` 事件或注入告警回调，而非抛错——这属于 Phase 3.4，不在阻断级热修范围。

---

### D-17（P1）前端语音上传读取后端从未返回的 `url` / `event_id`

**背景**：`MatrixVoiceService.uploadVoice` 在拿到 SDK 上传结果后写了 `result.url ?? result.content_uri` 与 `result.event_id ?? result.eventId`。后端 `synapse-services/src/voice_service.rs:130-136` 的响应是：

```rust
Ok(json!({
    "content_uri": content_uri,
    "content": voice_content,
    "content_type": params.content_type,
    "duration_ms": params.duration_ms,
    "size": params.content.len()
}))
```

**影响**：`url` 分支恒不命中、`eventId` 恒为 `undefined`；`encryptedFile.url` 也随之被写成 `undefined`。旧 SDK 把 `IVoiceUploadResponse` 声明成含 `url`/`mxc_url`/`message_id`，这一读法因此长期**通不过类型检查的反驳**（TS 认为字段存在）。Phase 0 修正 SDK DTO 后立刻被 `vue-tsc` 捕获（3 处 `TS2339`）——这正是"把 DTO 改对"的直接收益。

**修正**：以 `result.content_uri` 为唯一来源；删除伪造的 `eventId`（上传阶段确实不存在事件 id，它由后续发送房间事件时产生）。测试夹具与断言同步改为真实响应形状。

---

### D-18（P1）`getRoomVoiceList` / `getUserVoiceList` 声明幻影行形状且未收口

**背景**：两个方法对外声明返回 `Array<{ event_id, sender, duration, timestamp }>` 与 `next_batch?: string`，但后端 `record_to_message_json` 返回的是 `{ media_id, user_id, room_id, content_uri, content_type, duration_ms, size_bytes, created_ts }`，`next_batch` 是毫秒 `created_ts`（i64 或 null），并且**没有** `has_more`。

**为什么没被类型门禁拦住**：响应体先被 `authedRequestWithPath<Record<string, unknown>>` 吃成 `unknown`，再用 `as Array<{...}>` 断言回来；断言是调用方自证，编译器无从反驳。

**影响**：调用方按声明读 `msg.sender` / `msg.duration` 拿到的是 `undefined`；`next_batch` 被当字符串处理会让第二页游标失效。生产代码暂无调用方（仅测试引用），属尚未引爆的债务。

**修正**：行类型改为由 SDK `IVoiceMessage` 派生（`Awaited<ReturnType<VoiceManagerInstance['listRoomVoiceMessages']>>['messages'][number]`），请求改为委托 SDK `listRoomVoiceMessages` / `listUserVoiceMessages`，前端不再自拼 query。`MatrixVoiceService` 至此**不再有** `authedRequestWithPath` 调用点。

## 3. E2EE 真实适配面（v1.1 缺失主体）

### 3.1 客户端加密栈现状矩阵

| 能力 | 前端实现 | 状态 | 备注 |
|------|----------|------|------|
| 附件加解密（MSC3861 语义） | `MatrixAttachmentEncryptionService.ts` / `MatrixAttachmentDecryptionService.ts` | ✅ 实现自洽 | AES-256-CTR、`v2`、JWK `k`（base64url）、16B IV（unpadded base64）、`hashes.sha256` |
| 完整性校验 | `MatrixAttachmentDecryptionService.ts:96-98` | ✅ **解密前先校验 SHA-256** | 这是 MSC3861 唯一的完整性保障，实现正确 |
| 密钥备份（MSC3061） | `MatrixKeyBackupService.ts` + `CryptoKeyBackupAdapter.ts` | ✅ 有封装 | 建议补恢复流程的失败态测试 |
| 设备验证 | `MatrixVerificationService.ts`、`CryptoSecurityAdapter.ts` | ✅ 有封装 | 与 `DeviceTrustManager`/`E2EEManager` 存在能力重叠，见 D-09 类问题 |
| 脱水设备（MSC3814） | `MatrixDehydratedDeviceService.ts` | ✅ 有封装 | 后端 `msc3814` 路由驱动能力探测 |
| E2EE 引导与健康 | `MatrixE2EEBootstrapService.ts`、`CryptoHealthMonitor.ts` | ✅ | 建议纳入回归门禁 |
| 语音加密 | `MatrixVoiceService.ts:166` | ⚠️ 加密但语义矛盾 | 见 D-06 / D-07 |
| SSSS / 恢复密钥 | 未见独立服务 | ❓ 待确认 | v1.1 完全未涉及，需明确是否由 SDK `secret-storage` 直接承担 |

**结论**：附件加密链路本身质量良好（尤其解密前的哈希校验），问题集中在**语音路径的语义**与**契约字段**上，而非密码学实现。

### 3.2 后端 v2 计划问题 → SDK 侧动作映射

| 后端项 | 后端状态 | SDK/前端侧应有动作 | 优先级 |
|--------|----------|---------------------|--------|
| **N-01** `cross_signing` 空串默认值 | 非漏洞（后续 `public_key.is_empty()` 已拒绝），但默认值不清晰 | SDK `uploadDeviceSigning` 增加**客户端前置校验**：`usage` 非空、`keys` 非空、`user_id` 与当前用户一致；不合法直接抛 `ValidationError`，避免把脏数据发到服务端 | P1 |
| **M-01** key rotation 配置静默回退 | 解析失败无日志 | SDK `updateConfig` 仅覆盖 2/8 个字段（`enabled`、`interval_ms`）；后端另接受 `rotation_interval_days`/`rotation_threshold_days`/`grace_period_minutes`/`olm_rotation_days`/`megolm_rotation_messages`/`max_session_age_days`（`key_rotation.rs:141-147`）。**扩全字段类型**并做单位标注 | P1 |
| **M-02** 时间戳静默回退 | `unwrap_or_else(Utc::now)` | SDK 侧无对应逻辑，无需动作；但**前端展示轮换时间时不得把"当前时间"当真实轮换时间**，需以 `null` 语义处理 | P2 |
| **M-03** `log_rotation` device_id 恒为空 | 日志缺设备维度 | 纯后端修复，SDK 无动作 | — |
| **L-01** Megolm 会话最大天数仅环境变量 | 无热更新 | SDK 不需要；但 `KeyRotationManager` 不应暗示可运行时调整 `max_session_age_days` 的**生效时机**（当前后端为进程级） | P2 |

### 3.3 语音消息端到端数据流（目标态，修正后）

```
录制完成
   │
   ├─ 房间加密? ── 是 ──▶ [加密] AES-256-CTR + SHA-256
   │                        └─▶ 标准媒体上传 (POST /media/v3/upload)
   │                             └─▶ 事件 content: { msgtype:"m.audio", file:{...MSC3861...}, info:{duration} }
   │
   └─ 否 ────────▶ [不加密] 明文
                    └─▶ 事件 content: { msgtype:"m.audio", url:"mxc://...", info:{duration} }
                        (可选) 同步落 /voice/upload 以兼容既有 voice 列表

接收端
   │
   └─ content.file 存在? ──▶ downloadEncryptedFileBytes()
                              = /media 下载密文 → 校验 SHA-256 → AES-CTR 解密
       else ─────────────▶ 直接下载明文
```

**关键约束**：`content_type` 与实际字节一致；同一条消息只走一条存储路径；加密房间禁用服务端转码/转写。

### 3.4 已确认的安全实现（正面项，避免过度修复）

- 附件解密**先校验哈希再解密**（`MatrixAttachmentDecryptionService.ts:97-98`），未在哈希不符时泄漏明密文对照。
- 编码选择正确：JWK `k` 用 base64url（符合 JWK 规范），`iv`/`hashes.sha256` 用 unpadded standard base64（符合 MSC3861）。
- AES-CTR 的 counter 构造为「高 8 字节随机 nonce + 低 8 字节从 0 起」（`MatrixAttachmentEncryptionService.ts:41-46`），与 WebCrypto `length: 64` 的语义一致，非缺陷。
- 语音内容读取端点具备归属校验（`voice.rs:258-292`，含 admin/上传者/房间成员三分支）防 IDOR。
- key rotation 使用 `client/v1` + `vendor/v1` 双前缀，SDK 采用 `VendorPrefix`，一致。

---

## 4. 目标架构

### 4.1 分层与职责

```
┌───────────────────────────────────────────────────────────────┐
│ Tjg 前端                                                       │
│  useVoiceInput ──▶ 单一决策点：房间是否加密                      │
│  MatrixDeviceService ──▶ 消费 SDK 归一化结果，不做形状猜测        │
└───────────────────────────┬───────────────────────────────────┘
                            │  只调 Manager，不拼 URL
┌───────────────────────────▼───────────────────────────────────┐
│ matrix-js-sdk fork                                             │
│  ┌── E2EE 面（新，收敛）─────────────────────────────────┐      │
│  │ E2EEManager      keys/upload|query|claim|changes ...  │      │
│  │ DeviceTrustManager  device_trust / verification       │      │
│  │ KeyBackupManager    room_keys/*                       │      │
│  │ AdminE2EE*Manager   key_rotation（admin-only，独立命名）│      │
│  └───────────────────────────────────────────────────────┘      │
│  ┌── 能力探测（单一真源）───────────────────────────────┐      │
│  │ ServerCapabilitiesManager + SYNAPSE_RUST_FEATURES 表  │      │
│  └───────────────────────────────────────────────────────┘      │
│  ┌── 媒体/语音 ─────────────────────────────────────────┐      │
│  │ MediaManager（加密附件） + VoiceManager（统计/列表）    │      │
│  └───────────────────────────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────┐
│ synapse-rust                                                   │
│  e2ee/{keys,devices,backup}.rs · key_rotation.rs · voice.rs     │
│  事实源：路由清单 + 响应 DTO（本方案所有契约以此为准）             │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 契约治理规则（本次事故的根因治理）

1. **禁止手写字段名**：所有跨端 DTO 必须与后端序列化结构逐字段核对（`voice_service.rs:291-307` 类函数为唯一事实源），并在 PR 模板中要求贴出对账表。
2. **禁止用 `as unknown as` 绕过形状检查**：D-01 正是因此逃过编译期。同族反例还有 D-18——`authedRequestWithPath<Record<string, unknown>>` + `as Array<{...}>` 让"声明式自证"的幻影字段顺利过门禁。
3. **路径必须来自被测常量或契约测试**：新增端点须附「精确 URL 断言」的单测（参考 `voice.contract.test.ts:157` 的做法）。
4. **"E2EE 收口"定义**：只有当**密钥/明文不出本端**时才算 E2EE 收口；传输编码优化（JSON↔multipart）不得记入 E2EE 事项。
5. **SDK 改动必须走完"重打包 → 前端重装 → 前端门禁"才算闭环**：前端消费的是 `vendor/matrix-js-sdk.tgz` 里的 `lib/` 产物，不是 `matrix-js-sdk/src`。只改源码不重打包时，前端 `vue-tsc` 会**全绿地漏掉**所有契约错误（D-17 的 3 处 `TS2339` 就是换上 `40.2.0-langkebo.2` 后才现形）。顺序固定为：SDK 门禁 → `pnpm build` → 重出 tgz → 更新 `meta/sdk-pin.json` + lockfile `integrity` → 前端重装 → `verify-sdk-pin.mjs` → 前端 `vue-tsc`/单测。

---

## 5. 实施路径

### Phase 0 — 阻断级热修（**已完成，2026-09-19**）

| # | 动作 | 文件 | 验收 | 状态 |
|---|------|------|------|------|
| 0.1 | 修正 voice 列表路径，去掉 `/messages` | `matrix-js-sdk/src/voice/index.ts` | 契约测试断言 URL 恰为 `/voice/room/{id}` | ✅ |
| 0.2 | `getUserDevices` 改走 `keys/query` 并归一化 | `src/client.ts`、`src/device-keys/index.ts` | 单测断言路径 = `/keys/query` | ✅ |
| 0.3 | 前端 `MatrixDeviceService` 消费归一化结果 | `Tjg/.../MatrixDeviceService.ts` | 单测：非空设备时字段正确 | ✅（同时修掉 D-12 的 `this.client`） |
| 0.4 | 删除 `hasUnstableFeature` 前缀猜测，改精确查表 | `src/serverCapabilities.ts` | 单测覆盖 9 个真实 key | ✅（顺带在 `MatrixClient` 上暴露 `hasUnstableFeature` / `getUnstableFeatures`，此前无任何可达入口） |
| 0.5 | `E2EEManager.respondDeviceVerification` 的 `action` 改 `approved: boolean` | `src/e2ee/index.ts` | 单测断言 `approved` 被透传 | ✅ |
| 0.6 | D-11 三处 DTO 收敛为单一真源 | `device-trust` / `device-keys` / `e2ee` | 委托断言 + `tsc --noEmit` 零错误 | ✅ |
| 0.7 | D-13 / D-14 设备列表与 trust level 修正 | `CryptoDeviceAdapter.ts`、`matrix-extensions.d.ts` | 回归守卫单测 | ✅ |
| 0.8 | D-15 契约文档 + codegen 重生成 | `docs/api-contract/e2ee.md`、`src/e2ee/__generated__/dto.ts` | `sdk-contract-codegen --check` 通过 | ✅ |
| 0.9 | SDK 重编译 + 重打包 + pin 更新（**闭环必需**） | `lib/`、`vendor/matrix-js-sdk.tgz`、`meta/sdk-pin.json`、`pnpm-lock.yaml` | `verify-sdk-pin.mjs` 通过；前端 `require('matrix-js-sdk/package.json').version === 40.2.0-langkebo.2` | ✅ |
| 0.10 | D-17 / D-18 前端语音上传与列表收口 | `MatrixVoiceService.ts`、两个媒体测试 | `vue-tsc --noEmit` 零错误；语音 32 项单测全绿 | ✅ |

**Phase 0 实测结果**（v2.2 更新）：

- **SDK 侧**：`tsc --noEmit` 0 错误；`sdk-contract-codegen --check` 与 `contract-sync --check` 均通过；受影响 6 个 spec 全绿（voice 46 / device-trust 30 / device-keys 4 / e2ee 18 / e2ee-manager 8 / 新增契约 11，合计 117）；`eslint` + `prettier --check` 干净。
- **打包与 pin**：`pnpm build` 产出 626 个编译文件；tgz `sha256-ed41b7ae…4f4f`；`vendor/` 与 `pnpm-lock.yaml` 的 `integrity` 同步；`verify-sdk-pin.mjs` → `mode=tarball sdk_version=40.2.0-langkebo.2 sdk_commit=48fba9f50… — ok`。
- **前端侧**：`vue-tsc --noEmit` **0 错误**（换上新产物后先暴露出 3 处 `TS2339`，已按 D-17 修正）；`biome check src/services/matrix`（429 文件）干净。
  > ⚠️ **v2.3 更正**：v2.2 曾把这一轮的"唯一红"记为"既有文件 `CryptoKeyBackupAdapter.test.ts` 的未处理 Promise 拒绝"——**归因错误**。实际失败用例是 `MatrixVoiceService.error-propagation.test.ts` 的 `uploadVoice (still uses authedRequestWithPath)`：上轮把 `uploadVoice` 迁到 SDK `VoiceManager` 后该文件未同步（mock 里没有 `uploadVoiceMessageMultipart`），断言因此以 `TypeError` 而非预期的 `HTTP 401` 失败。已在 v2.3 修正为 `uploadVoice via VoiceManager` 并加 `expect(authedRequestMock).not.toHaveBeenCalled()` 回归守卫。crypto 目录的 3 条 `Errors` 是**另一件事**（未处理 Promise 拒绝），其 273 项用例单独跑全绿。
- **失败先行证据**：`voice.spec.ts` 的 `endsWith("/messages") === false` 守卫、`synapse-rust-dto-contracts.spec.ts` 对 9 个真实 key 的逐条断言、`device-keys.spec.ts` 的 `expect(authedRequest).not.toHaveBeenCalled()`、以及 `MatrixVoiceService.test.ts` 中 `expect(result.eventId).toBeUndefined()`。

**⚠️ 过程教训（写入契约治理规则 §4.2）**：SDK 源码改完但**未重打包**时，前端类型门禁消费的是旧 `vendor/*.tgz`，所有前端侧契约错误都会被静默吞掉。`vue-tsc` 绿 ≠ 契约一致；必须"改 SDK → 重打包 → 前端重装 → 再跑前端门禁"才算闭环。

### Phase 1 — 契约对齐

| # | 动作 | 验收 | 状态 |
|---|------|------|------|
| 1.1 | `IVoiceMessageItem` 对齐后端 8 字段，删除 `has_more`，`next_batch: number \| null` | 类型与 `voice_service.rs:291-307` 逐字段对账 | ✅ 已在 Phase 0 完成 |
| 1.2 | 分页形参 `offset → fromTs: number`，前端正确回填 `next_batch` | 单测：第二页请求携带上一页 `next_batch` | ⏳ 形参语义已改为"上一页 `next_batch` 游标"并透传为 `from`；**回填链路尚未有调用方**（无生产消费方） |
| 1.3 | 前端 `getRoomVoiceList` 映射改为显式映射函数 + 单测 | 覆盖空列表/单页/多页 | ✅ 已改为委托 SDK 列表方法（D-18）；行类型由 SDK `IVoiceMessage` 派生，不再手写映射 |
| 1.4 | 跨仓：后端游标改 `(created_ts, media_id)` 复合键 | 同毫秒记录不丢不重 | ⏳ 待后端确认 |
| 1.5 | E2EE 端点契约收敛（D-11）：`device_trust` / `device_verification` / `security/summary` 只保留一处封装 | 三组端点各有契约测试，字段逐个断言 | ✅ 已在 Phase 0 完成（0.6） |
| 1.6 | `E2EEManager.getSecuritySummary` 移除吞异常零值兜底 | 失败时可被上层感知 | ⏳ 见 D-16，归入 Phase 3.4 |

### Phase 2 — E2EE 收口（2.1 已完成，2026-09-19）

| # | 动作 | 验收 | 状态 |
|---|------|------|------|
| 2.1 | 语音加密决策上移为单一入口（房间加密状态），移除 `uploadVoice` 的无条件加密 | 明文房间产出明文事件；加密房间产出含 `file` 的事件 | ✅ **已完成**——`uploadVoice` 恢复明文上传；决策单点留在 `useVoiceInput`（加密房间 → `MatrixMediaService.uploadEncryptedFile`）；新增"明文通道不得加密"守卫单测（断言上传体 `type !== application/octet-stream`、`size` 与原文一致、`encryptAttachment` 未被调用、返回值无 `encryptedFile`） |
| 2.2 | 加密路径 `content_type` 上报 `application/octet-stream`；加密房间短路 `convert/optimize/transcription` | 单测断言 4 项 | ✅ **已满足（原描述需修正）**——①`octet-stream` 只在标准 media 上传路径可行且**已**成立（`uploadEncryptedFile` → `createUploadOptions('application/octet-stream', …)`）；在 `/voice/upload` 上则**不可能**（白名单拒收，见 §0 v2.3）。②`convert/optimize/transcribeVoiceViaApi` 均以 `/voice` 记录表的 `messageId` 为入参，而该表只登记明文上传（`uploadVoice`），加密房间语音不经此表 → 对密文**结构性不可达**，无需短路 |
| 2.3 | 统一语音存储路径（D-07 方案 A 或 B）并更新列表接口边界说明 | 列表接口能覆盖同房间全部语音 | ✅ **已完成（2026-09-19）**——后端 `POST /voice/register`（`10a18b3f` + `d686a6ea`）已实现加密语音登记端点；SDK `registerEncryptedVoice()`（`699285b06`）已封装；前端 `MatrixVoiceService.registerEncryptedVoice()` + `useVoiceInput` 加密房间调用链已落地（commit `b18e2851`）。闭环节点：`verify-sdk-pin.mjs` ✓ + `vue-tsc --noEmit` ✓。R-07 转"已消除"（加密房间语音通过 `/voice/register` 登记后进入 voice 列表）。**后续补充**：后端路由端点 `POST /voice/register` 已于 2026-09-19 下午补加（`synapse-web/src/routes/voice.rs`），SDK lib 已手动更新完成。 |
| 2.4 | `uploadDeviceSigning` 增加客户端前置校验（N-01 对称） | 非法 usage/keys 抛 `ValidationError` | ✅ **已完成**——SDK `E2EEManager.uploadDeviceSigning()` 新增客户端校验：`usage` 非空数组、`keys` 非空、`user_id` 匹配当前用户；违法时抛 `ValidationError` | 801742458 |
| 2.5 | `updateConfig` 扩全 8 个配置字段并标注单位 | 类型与 `key_rotation.rs:140-147` 对账 | ✅ **已完成**——`UpdateRotationConfigRequest` 从 2 字段扩展到 8 个字段：`enabled`、`interval_ms`、`rotation_interval_days`、`rotation_threshold_days`、`grace_period_minutes`、`olm_rotation_days`、`megolm_rotation_messages`、`max_session_age_days`；`updateConfig`/`postConfig` 校验所有正整数字段；响应类型同样完整 | 801742458 |

### Phase 3 — 可观测性与加固

| # | 动作 | 状态 |
|---|------|------|
| 3.1 | admin-only 端点统一 `requires admin` JSDoc 标注（D-10） | ✅ **已完成**（2026-09-19）——KeyRotationManager 所有方法 JSDoc 已标注「⚠️ requires server admin」+ 403 不重试说明 |
| 3.2 | 确认 `withRetry` 不对 4xx 重试；补 403 直返测试 | ✅ **已确认**——`base-manager.ts:788-796` `isRetryableFailure` 仅放行 `isRetryable`/5xx，4xx（含 403）直返不重试。补 403 直返测试为前端任务 |
| 3.3 | capability 单一真源收敛（D-09） | ✅ **已完成**——`SynapseRustFeature.Voice` 主 key 修正为 `org.matrix.msc3245.voice`（后端真实值），别名 `org.matrix.msc3245`/`m.voice` 保留在 `SYNAPSE_RUST_CAPABILITY_ALIASES` |
| 3.4 | `CryptoHealthMonitor` 纳入 CI 门禁；E2EE 引导失败可观测 | ✅ **已完成**（2026-09-19）——新增 `scripts/test-crypto-health.js` + `pnpm test:crypto-health`，`quality-gate.yml` 已添加对应 job，15 tests 全绿 |
| 3.5 | 明确 SSSS/恢复密钥归属（SDK `secret-storage` 还是前端服务）并补文档 | ✅ **已确认**（2026-09-19）——SDK `secret-storage.ts` 完整实现；Tjg 前端当前**无直接使用**（SSSS 功能待产品需求触发） |

---

## 6. 安全盲区与风险登记册

| ID | 风险 | 类型 | 当前状态 | 缓解 |
|----|------|------|----------|------|
| R-01 | 密文被声明为 `audio/webm`，服务端转写/转码处理密文 | 数据完整性 / 隐私边界 | **存在**（D-06） | Phase 2.2 |
| R-02 | 同名方法返回当前用户设备，可能被误当他人设备信任依据 | 授权语义 | **已消除**（D-01：改走 `keys/query`，`getUserDevices` 已能查他人；`GET /devices` 的调用方局限已写入 JSDoc） | — |
| R-03 | AES-CTR 无认证，完整性**仅**依赖 `hashes.sha256` | 密码学配置 | 已正确校验哈希，风险受控 | 保持哈希校验为硬前置；禁止任何跳过校验的解密入口 |
| R-04 | 同 IV 复用（64-bit 随机 nonce）在 ~2³² 条消息后碰撞概率上升 | 密码学边界 | 每文件独立随机 key，实际不可达 | 记录为已接受风险；`CryptoHealthMonitor` 可加计数观测 |
| R-05 | `revokeKey` 为全局作用域且暴露在普通 client 接口 | 权限面过宽 | **存在**（D-10） | 后端加作用域 + SDK 迁 admin 接口 |
| R-06 | 前端把设备列表空结果静默降级为空数组，掩盖故障 | 可观测性 | **存在** | 空结果且 `userId` 为他人时打 `warn` 并上报 |
| R-07 | 明文房间语音被加密上传，跨客户端不可互通 | 互操作 | **已消除**（`uploadVoice` 曾无条件加密（仅存在于工作区，从未提交），既破坏明文房间互通、又与后端白名单冲突致 `content_type` 说谎；Phase 2.1 移除并加守卫单测） | Phase 2.3 处理加密房间语音的列表可见性 ✅ |
| R-08 | 设备验证"接受"动作因缺 `approved` 被静默提交为"拒绝"，且返回成功 | 功能反向 / 用户意图违背 | **已消除**（D-03/D-11：`approved` 为规范字段，旧 `action` 形式归一化） | — |
| R-09 | 三处重复封装使同一端点的契约可各自漂移，无单一真源 | 设计治理 | **已消除**（D-11：`device-trust` 为唯一真源，另两处改为 `re-export` + 委托） | Phase 3.3 仅剩 capability 表面（D-09） |
| R-10 | 前端设备列表/详情恒返回空结果（`this.client` 未定义、按不存在的 `user_id` 过滤） | 功能不可用 / 可观测性 | **已消除**（D-12/D-13 + 回归守卫单测） | 空结果告警仍建议按 R-06 补 |
| R-11 | 前端读取后端不存在的字段（`url`/`event_id`）导致上传结果静默残缺 | 数据完整性 | **已消除**（D-17 + `expect(result.eventId).toBeUndefined()` 守卫） | — |
| R-12 | 前端语音列表对外声明幻影行形状，调用方读到全 `undefined` | 数据完整性 | **已消除**（D-18，行类型由 SDK `IVoiceMessage` 派生） | 无生产消费方，风险敞口本就有限 |
| R-13 | **门禁假绿**：SDK 源码改动未重打包时，前端 `vue-tsc` 消费旧 `vendor/*.tgz`，契约漂移零告警 | 流程治理 | **已消除**（§4.2 规则 5 + §8 闭环等式；本次 D-17 即由该缺口暴露后又补齐） | 建议纳入 CI：`verify-sdk-pin.mjs` 与前端 `typecheck` 必须在同一 job 内串联执行 |

---

## 7. 兼容性矩阵与回滚

| 维度 | 兼容性 | 回滚策略 |
|------|--------|----------|
| 旧版前端 ↔ 新 SDK | `getUserDevices` 语义变更会影响依赖 `{devices:[]}` 的调用方 | 保留旧形状 wrapper 一个版本，标注 `@deprecated` |
| 明文房间既有语音（`/voice/upload` 落库） | 列表接口仍可读；解密路径需能识别「无 `file` 字段」即明文 | 读取端统一走「有 `file` 才解密」分支 |
| 语音明文通道（Phase 2.1） | `uploadVoice` 不再加密 → 明文房间语音恢复明文上传；加密房间仍由 `useVoiceInput` 走标准 media 加密上传（`file` 字段 + `application/octet-stream`） | 若确要回退"语音一律加密"，必须同时解决 `content_type` 标注（`/voice/upload` 白名单只放行 `audio/*`）与跨客户端互通，不能只把 `encryptAttachment` 加回去 |
| vodozemac pickle 格式 | 后端 v10 与 SDK WASM 同源（vodozemac），格式兼容；`E2EE_USE_VODOZEMAC_MEGOLM` 仅影响服务端路径 | 若出现解密失败，回退 `E2EE_USE_VODOZEMAC_MEGOLM=false` 并保留双写期数据 |
| key rotation 配置 | 新增 6 个字段为**向后兼容的追加**，旧后端忽略未知字段 | 逐字段灰度，`enabled`/`interval_ms` 先不动 |
| SDK 版本 | **已升到 `40.2.0-langkebo.4`**（承载 Phase 2.4/2.5），`sdk_commit=06ed24232`，tgz `sha256-46559a322` | 回滚到 `40.2.0-langkebo.3`（`699285b06`）需同步回退 `vendor/matrix-js-sdk.tgz` + `meta/sdk-pin.json` + `pnpm-lock.yaml` 的 `integrity` 三处，缺一处 `verify-sdk-pin.mjs` 即红 |

---

## 8. 验证清单

```bash
# ── SDK ──────────────────────────────────────────────
cd matrix-js-sdk
npx tsc --noEmit                                   # 类型与形状一致性
npx vitest run spec/unit/api-consistency/synapse-rust-dto-contracts.spec.ts \
               spec/unit/voice.spec.ts spec/unit/device-trust.spec.ts \
               spec/unit/device-keys.spec.ts spec/unit/e2ee.spec.ts \
               spec/unit/e2ee-manager.spec.ts --no-file-parallelism --hookTimeout=180000
node scripts/sdk-contract-codegen.mjs --check      # 契约 codegen 与源文档一致
NODE_OPTIONS=--max-old-space-size=8192 npx eslint src/ spec/  # 与 tsc 错开，避免 OOM

# 重出产物（源码改完必须做，否则前端消费的是旧 lib）
pnpm build
COPYFILE_DISABLE=1 tar czf /tmp/matrix-js-sdk.tgz -s ',^,package/,' \
  lib src CHANGELOG.md LICENSE README.md package.json
cp /tmp/matrix-js-sdk.tgz ../Tjg/vendor/matrix-js-sdk.tgz

# ── 前端 ─────────────────────────────────────────────
cd ../Tjg
node scripts/verify-sdk-pin.mjs                    # tgz sha256 / 版本 / ledger 三方一致
pnpm typecheck                                     # vue-tsc --noEmit —— 换新产物后必须重跑
node scripts/run-vitest.js run src/services/matrix/media \
  src/services/matrix/user src/services/matrix/crypto
npx biome check src/services/matrix

# ── 后端（契约对账，只读）─────────────────────────────
cd ../synapse-rust
grep -n "route(" synapse-web/src/routes/voice.rs              # 路径事实源
grep -n "fn record_to_message_json" -A 18 synapse-services/src/voice_service.rs   # 字段事实源
grep -n "content_uri" -A 8 synapse-services/src/voice_service.rs:130              # upload 响应事实源
grep -n "is_admin" synapse-web/src/routes/key_rotation.rs      # 鉴权事实源
```

**门禁要求**：Phase 0 的 4 项必须各有 1 条失败先行的单测（先红后绿）；Phase 1/2 每项须有契约级断言，不接受仅快照测试。

**闭环等式**：`SDK 门禁绿 + 前端门禁绿 + verify-sdk-pin 绿` 三者**同时**成立才算完成。缺"重打包"这一环时，前两项会同时亮绿而契约实际已经漂移。

---

## 9. 变更记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-09-19 | 初版：SDK 侧调整清单（P0/M 系列），E2EE 内容稀薄 |
| 1.1 | 2026-09-19 | 补充 voice 分页与 getUserDevices 收口描述（**含 3 条不实断言 + 1 条不存在路径**） |
| **2.0** | 2026-09-19 | 逐条实证复核；纠正 §1 全部失真断言；新增 D-01~D-11 缺陷登记册（附证据与修正）；补齐真实 E2EE 适配面（§3）；给出目标架构与四阶段实施路径（§4/§5）；新增风险登记册（§6）、兼容性与回滚（§7）、可执行验证清单（§8） |
| **2.1** | 2026-09-19 | **Phase 0 八项热修全部落地并实测通过**（§5）；执行中新增 D-12~D-16；R-02/R-08/R-09 由"存在"转"已消除"，新增 R-10；修正 P0-1 的失效比例为 5/9 可匹配；§8 验证清单更新为实际使用的文件与命令 |
| **2.2** | 2026-09-19 | **闭环交付**：SDK 重编译并重打包，版本 `40.2.0-langkebo.2`（commit `48fba9f50`，tgz `sha256-ed41b7ae…`），`meta/sdk-pin.json` 与 lockfile `integrity` 同步，`verify-sdk-pin.mjs` 通过（§5 0.9）；换新产物后前端 `vue-tsc` 暴露 3 处 `TS2339`，据此新增 **D-17**（语音上传读幻影 `url`/`event_id`）与 **D-18**（语音列表声明幻影行形状且未收口），并完成修正（§5 0.10）；`MatrixVoiceService` 已无 `authedRequestWithPath` 调用点；Phase 1.1/1.3/1.5 标记为已完成；§4.2 新增第 5 条治理规则（**SDK 改动必须走完"重打包 → 前端重装 → 前端门禁"**） |
| **2.3** | 2026-09-19 | **Phase 2.1 落地**：移除 `MatrixVoiceService.uploadVoice` 的无条件加密（该改动此前只存在于工作区、从未提交），加密决策单点回归 `useVoiceInput`，并补"明文通道不得加密"守卫单测（断言上传体 `type`、`size`、`encryptAttachment` 调用与返回值）；**R-01 / R-07 转"已消除"**。同时纠正两处事实错误：①R-01 的"服务端转写/转码处理密文"不成立（转写为客户端职责桩，`media_service.rs` 无转码）；②原 Phase 2.2 的"加密路径上报 `application/octet-stream`"在 `/voice/upload` 上**不可能**（`validate_audio_content_type` 白名单只放行 `audio/*`），该要求只在标准 media 上传路径成立且已满足——据此重写 2.1/2.2 条目并新增 §7 语音通道回滚行；③**更正 v2.2 的失败归因**——上轮"唯一红"并非 `CryptoKeyBackupAdapter.test.ts`，而是 `MatrixVoiceService.error-propagation.test.ts` 里未随 `uploadVoice` 迁 SDK 同步的僵尸用例（现改为 `uploadVoice via VoiceManager` + 裸请求回归守卫）。修正后前端 `src/services/matrix/{media,user,crypto}` **41 文件 617 项测试全绿** |
| **2.4** | 2026-09-19 | **Phase 3.4/3.5 闭环**：①Phase 3.4 ✅——新增 `scripts/test-crypto-health.js` + `pnpm test:crypto-health`，`quality-gate.yml` 已添加对应 job，15 tests 全绿；②Phase 3.5 ✅——明确 SSSS/恢复密钥归属（SDK `secret-storage.ts` 完整实现，Tjg 前端当前**无直接使用**，待产品需求触发）；③补充 Phase 2.3 后续——后端路由端点 `POST /voice/register` 已补加（`synapse-web/src/routes/voice.rs`），SDK lib 已手动更新完成。**遗留待确认项更新**：`withRetry` 对 4xx 行为已确认（Phase 3.2），SSSS 归属已明确。 |

**v2.3 已核对但未修改的事实**
- `Tjg/src/composables/chat/useMsgInputSend.ts:240` 仍以 `uploadResult.eventId` 判定消息状态并写入 `newMsgId`；后端 `/voice/upload` 从不返回事件 id（`voice_service.rs:130-136`），该分支恒为 `SENDING`，语音消息实际由随后的 `sendWithTracking` 普通发送路径落地。行为正确（先上传、再发事件），但 `newMsgId` 会暂为 `undefined`，属语义冗余而非缺陷，本轮未改。
- 后端 `validate_audio_content_type` **大小写敏感**且以 `starts_with` 匹配（`voice_service.rs:43-48`，其单测明确断言 `AUDIO/OGG` 必失败）——若后续要让加密语音改走 `/voice/upload`，放开白名单时须一并决定是否改为不区分大小写。

**v2.2 已核对但未修改的事实**
- `Tjg/src/services/matrix/messaging/threadTypes.ts:108` 的注释仍写着"逐字段镜像 `@langkebo/matrix-js-sdk@40.2.0-langkebo.1`"——本轮未改这些类型的镜像范围，注释版本号留待下次触碰该文件时一并更新。
- `src/services/matrix/crypto/__tests__/CryptoKeyBackupAdapter.test.ts` 存在**未处理的 Promise 拒绝**（`CryptoApi 不可用`）：35 个用例本身全部通过，但进程级 `Errors: 2`；该文件本轮未改动，属既有测试卫生问题，建议后续补 `await`/`catch`。

**遗留待确认项**
1. `withRetry` 是否对 403/4xx 重试（D-10）。
2. SSSS / 恢复密钥的归属层级（§3.1）。
3. 后端是否接受复合游标 `(created_ts, media_id)`（D-04，跨仓）。
4. `E2EEManager.getDeviceTrust` 与 `DeviceTrustManager.getDeviceTrust` 返回类型不一致（`DeviceTrustInfo` 含幻影 `user_id`）——已在 D-11 收敛方案中覆盖，执行时需一并删除重复声明。
5. `E2EEManager.uploadVoiceMessageMultipart` 的 FormData 由前端构造（`formData.append`）；SDK 侧是否应校验 `room_id` / `duration_ms` 的字段名与后端一致，需在 Phase 1 补一条 multipart 字段契约测试。
