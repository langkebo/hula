# HuLa 前端问题复核与优化方案

## 1. 目标与范围

本文基于当前 `hula` 前端代码仓库进行复核，目标是回答三件事：

1. 审查报告中的前端问题在当前代码中是否仍然存在。
2. 哪些问题已经被修复、但报告内容未更新。
3. 针对仍然存在的问题，给出可落地的优化、删减冗余和功能完善方案。

说明：

- 本次复核以 `hula` 前端仓库为准，没有直接修改 `synapse-rust`。
- 对跨项目问题，仅核查前端一侧是否仍存在明显不匹配。
- 本轮输出为治理方案，不直接执行大规模删除或架构重写，避免一次性引入回归。

## 2. 结论摘要

### 2.1 已确认存在，且应进入整改计划

- `A-1` 双 HTTP 请求层职责不清：成立。
- `A-2` 通过 `import * as Module + default in exports` 规避循环依赖：部分成立。重复散落的 hack 已集中收口到 `matrixClientAccessor.ts`，但循环依赖根因仍待继续治理。
- `A-6` `MatrixClientService` 直接动态导入 Tauri API：成立。
- `CQ-2 / P-2` `VoiceMessageEnhanced.vue` 中 `audio.addEventListener()` 未移除：成立。
- `CQ-3` 超大组件/服务文件：成立，且比报告估计更大。
- `CQ-4` 废弃代码仍在使用：成立。
- `CQ-5` 会话类 Mitt 事件订阅重复：成立。
- `CQ-6` Biome 对 `.vue` 关闭未使用检查：成立。
- `P-3` 朋友列表和会话列表缺少 `v-memo` 等细粒度更新优化：成立。
- `P-4` 内联样式较多：成立，但当前量级低于原报告描述。
- `S-2` AI API Key 明文存 `localStorage`：成立。
- `S-6` `contentEditable.innerHTML` 进入发送链路前未统一消毒：成立。
- `S-7` `v-safe-html` 允许 `style` 属性：成立。
- `U-1` 头像上传功能在房间相关界面仍未接入：成立。
- `M-3` 存在双 `Result` 实现，且 `utils/Result.ts` 为死代码：成立。
- `M-5` 存在静默吞错：成立。
- `M-8` TypeScript 严格性不足：成立。

### 2.2 报告已过期或仅部分成立

- `CQ-1 / P-1` Mitt 监听器泄漏：当前结论不成立。`useMitt.on()` 已内建 `onUnmounted` 自动清理。
- `A-3` `HttpClient.baseUrl` 仅构造时初始化：当前结论不成立。`HttpClient` 已改为按请求调用 `resolveMatrixRuntimeEndpointConfig()`。
- `M-1` 双全局错误处理器冲突：当前结论不成立。真正安装全局处理器的是 `ErrorTracker`，`GlobalErrorHandler` 更像未接入的包装层，问题是“冗余”而不是“冲突”。
- `M-2` `ErrorBoundary` 未挂载：当前结论不成立，`App.vue` 已在根部包裹。
- `F-1` `DEHYDRATED_DEVICE` 前端仍使用 `v1` 路径：当前结论不成立，`paths.ts` 已切到 `unstable/org.matrix.msc3814.v1`。
- `F-2` `FriendRequest` 字段名不匹配会直接读成 `undefined`：当前结论不成立，前端已做归一化兼容。

### 2.3 适合纳入“清除冗余/过度开发”的对象

- `src/utils/Result.ts` 已删除，当前统一保留 `src/common/result.ts`。
- `src/common/errorHandler.ts` 已删除，错误处理统一保留 `ErrorTracker + AppError` 体系。
- `src/services/mapApi.ts` 已迁移到 `src/services/location/LocationProxyService.ts` 并删除。
- `src/services/wsType.ts` 已迁移到 `src/services/legacy/wsEventTypes.ts` 与 `@/enums` 并删除。
- `src/services/matrix/sdk-errors.ts` 与 `src/common/matrixErrorTranslator.ts` 已删除，错误辅助统一收口到 `src/common/errors.ts`。
- 收敛 `HttpClient` 与 `MatrixRequestHelper` 的错误模型，避免继续扩散第三套返回语义。

## 3. 复核结果与证据

### 3.1 架构与依赖问题

#### A-1 双 HTTP 请求层职责不清：成立

现状：

- `src/utils/HttpClient.ts`
  - 使用原生 `fetch()`
  - `request()` 抛异常
  - `requestResult()` 返回 `{ ok, data, error }`
- `src/services/matrix/MatrixRequestHelper.ts`
  - 使用 `client.http.authedRequest()`
  - `safeGet/safePost/safePut()` 返回 `T | null`
  - `safeDelete()` 返回 `boolean`

影响：

- 错误语义至少有三套：抛异常、`Result`、`null/false`。
- 新接口接入时没有稳定选择标准，AI 扩展、自定义扩展、Matrix 原生接口之间边界不清。
- 后续日志、重试、鉴权、埋点无法统一。

结论：

- 报告成立，且当前比原描述更明显，因为 `HttpClient` 还内置了 AI 扩展开关和 access token 注入逻辑，已经不是“纯工具类”。

#### A-2 循环导入运行时属性检查：部分修复

现状：

- `src/services/matrix/BaseMatrixService.ts`
- `src/utils/HttpClient.ts`
- `src/services/matrix/user/MatrixPresenceService.ts`
- `src/services/matrix/SynapseRustExtensionsService.ts`

这些运行时兜底导入已统一收口到：

```ts
src/services/matrix/matrixClientAccessor.ts
```

影响：

- 这是明显的运行时兜底 hack，不是类型安全的依赖关系。
- 一旦模块导出形态变化，编译不一定报错，但运行时可能失效。
- 当前项目的 store/service 双向依赖网络会持续诱发这类代码。

结论：

- 原报告“多个业务文件重复内联 runtime hack”已不再成立。
- `MatrixClientService` 已在模块加载时显式注册 accessor 实现，运行时默认不再依赖 legacy fallback。
- 但循环依赖根因尚未消除，accessor 内部仍保留兼容 fallback，仍应继续列为架构整改项。

#### A-3 `HttpClient.baseUrl` 运行时不刷新：已修复

现状：

- `HttpClient` 已删除构造时缓存的 `baseUrl`。
- 当前每次 `request()` 都会重新调用 `resolveMatrixRuntimeEndpointConfig()`。
- 已补充 `src/utils/__tests__/HttpClient.test.ts`，验证切换 homeserver 后请求会命中新地址。

影响：

- 运行时切换 homeserver 后，扩展接口与代理接口会跟随最新地址发起请求。
- 该问题当前已从风险项降级为已完成整改项。

结论：

- 原报告结论已过期。

#### A-6 核心服务层紧耦合 Tauri：成立

现状：

- `src/services/matrix/MatrixClientService.ts` 存在 `await import('@tauri-apps/api/core')`。

影响：

- 浏览器纯前端运行、单元测试隔离、E2E 浏览器模式都需要额外兼容判断。
- 该问题不是“完全无法运行”，但说明平台抽象层没有完全下沉。

结论：

- 报告成立，但优先级可低于安全与数据一致性问题。

### 3.2 代码质量与性能问题

#### CQ-1 / P-1 Mitt 监听器泄漏：当前不成立

现状：

- `src/hooks/useMitt.ts` 的 `on()` 已返回取消函数，并在存在作用域时执行：

```ts
if (getCurrentScope()) {
  onUnmounted(off)
}
```

结论：

- 报告统计的 `on`/`off` 数量本身不再能证明泄漏。
- 当前更准确的结论是：项目已经有自动清理能力，但很多代码没有显式体现这一点，容易让后续审查继续误判。

建议：

- 不要新增 `useMittListener`，而是统一文档说明 `useMitt.on()` 已自动清理。
- 对少数在非组件作用域注册的调用点单独审计。

#### CQ-2 / P-2 DOM 事件监听未清理：成立

现状：

- `src/components/voice/VoiceMessageEnhanced.vue`
- `initAudio()` 中对 `audioElement.value` 注册了 `timeupdate`、`ended`、`loadedmetadata`
- `onUnmounted()` 只做 `pause()` 和 `audioElement = null`，没有 `removeEventListener()`

影响：

- 旧 audio 对象和闭包可能延迟释放。
- 频繁切换消息或房间时会有累积风险。

结论：

- 报告成立。

额外观察：

- 项目已经有 `src/composables/useEventListener.ts`，说明这类问题完全可以用现有工具统一治理。

#### CQ-3 超大文件：成立，且量级更大

当前行数复核：

- `src/components/workbench/WorkbenchDetailPane.vue`: 1230 行
- `src/App.vue`: 1097 行
- `src/services/matrix/MatrixClientService.ts`: 1087 行
- `src/services/matrix/SynapseRustExtensionsService.ts`: 1084 行
- `src/components/friend/FriendListView.vue`: 590 行

结论：

- 报告成立，且超大文件问题比原报告更严重。

#### CQ-4 废弃代码未清理：成立

现状：

- `src/services/mapApi.ts` 已迁移到 `src/services/location/LocationProxyService.ts`，位置组件已切到新 service。
- `src/services/wsType.ts` 已迁移到 `src/services/legacy/wsEventTypes.ts` 与 `@/enums`，`App.vue`、`mobile/login.vue`、`callWindow`、`MatrixWsBridge.ts` 已切换引用。
- `src/services/matrix/sdk-errors.ts` 已完成删除，遗留兼容层已收口。
- `src/common/matrixErrorTranslator.ts` 的旧导出已并入 `src/common/errors.ts`。

结论：

- 报告已不再成立。
- 本轮已完成旧位置代理、旧 WebSocket 类型入口和旧错误翻译层的迁移删除。

#### CQ-5 重复 Mitt 事件监听模式：成立

现状：

- `src/views/homeWindow/SpaceList.vue`
- `src/views/homeWindow/message/index.vue`
- `src/views/homeWindow/RoomList.vue`

三处都订阅完全相同的：

- `MittEnum.UPDATE_SESSION_LAST_MSG`
- `MittEnum.DELETE_SESSION`
- `MittEnum.LOCATE_SESSION`

结论：

- 报告成立，适合抽为 `useSessionListEvents()` 或 `useSessionEvents()`。

#### CQ-6 Biome 对 `.vue` 放宽未使用检查：成立

现状：

- `biome.json` 中全局是 `warn`
- 但 `.vue` 覆盖项将 `noUnusedVariables`、`noUnusedImports` 关闭

影响：

- SFC 内死代码、无效导入、遗留 props/refs 更容易长期沉积。

结论：

- 报告成立。

#### P-3 长列表缺少细粒度更新优化：成立

现状：

- `FriendListView.vue` 未使用 `v-memo`
- `RoomList.vue` 未使用 `v-memo`
- 当前列表虽然部分场景有滚动容器，但没有针对单项重渲染做缓存控制

结论：

- 报告成立。

说明：

- 是否必须采用 `v-memo`，要结合实际渲染热点验证。
- 但至少“当前没有这类优化”是确定的。

#### P-4 内联样式偏多：成立，但需下调表述强度

现状：

- 当前 `src/**/*.vue` 中至少仍有 50 处 `style="..."`。
- 热区集中在移动端设置页、AI 助手页和部分工作台组件。

结论：

- “存在较多内联样式”成立。
- 原报告“100+ 处”在当前仓库状态下未复核到，不建议继续沿用该数字。

### 3.3 安全问题

#### S-2 API Key 明文存储 `localStorage`：成立

现状：

- `src/mobile/views/my/AiAssistant.vue`
- `saveApiKeySettings()` 直接写入 `localStorage.setItem('ai_api_settings', JSON.stringify(apiKeySettings.value))`

影响：

- 只要发生 XSS，`baseUrl` 与 `apiKey` 可直接被读取。
- 当前实现也没有区分移动端/桌面端安全存储能力。

结论：

- 报告成立。

#### S-6 `contentEditable.innerHTML` 未统一消毒：成立

现状：

- `src/components/rightBox/MsgInput.vue` 多处读取 `messageInputDom.value.innerHTML`
- `src/hooks/msgInput/useMsgInputSend.ts` 在发送链路中继续使用 `innerHTML`
- 当前渲染侧已有 `v-safe-html` / `DOMPurify`，但输入侧没有统一 sanitize

影响：

- 粘贴富文本、外部拖入 HTML、浏览器注入内容都可能绕开输入期过滤。

结论：

- 报告成立。

#### S-7 `v-safe-html` 允许 `style` 属性：成立

现状：

- `src/directives/v-safe-html.ts` 的 `ALLOWED_ATTR` 包含 `style`

结论：

- 报告成立。
- 是否可以直接删掉 `style`，需要先评估 Matrix 富文本历史消息的兼容性。

### 3.4 功能完整性与 UI 问题

#### U-1 头像上传未集成：成立

现状：

- `src/components/room/RoomDetailPane.vue` 中 `handleAvatarClick()` 仍是 TODO
- `src/components/room/CreateRoomPane.vue` 中 `triggerAvatarUpload()` 仍是 TODO
- 项目内部已有现成 `useAvatarUpload()`，且已用于个人资料、机器人管理等页面

结论：

- 报告成立，且属于“已有能力但未接线”的典型欠完成项。

### 3.5 可维护性与冗余代码问题

#### M-1 双全局错误处理器冲突：不成立，但存在冗余层

现状：

- `src/utils/ErrorTracker.ts` 才真正安装 `window.onerror` / `window.onunhandledrejection`
- `src/common/errorHandler.ts` 原本只是包装 `errorTracker`
- 代码搜索显示该文件没有生产代码导入，只有测试引用，因此已在本轮清理中删除

结论：

- “冲突”不成立。
- `GlobalErrorHandler` 已完成下线，不再作为后续治理项保留。

#### M-2 ErrorBoundary 未挂载：不成立

现状：

- `src/App.vue` 根模板已经包裹 `<ErrorBoundary>`

结论：

- 报告已过期。

#### M-3 双 Result 类型实现：成立

现状：

- `src/common/result.ts`：对象字面量风格 Result
- `src/utils/Result.ts`：原为 `Ok/Err` 类风格 Result，且没有生产引用
- `src/utils/TauriInvokeHandler.ts` 使用的是 `src/common/result.ts`

结论：

- 报告成立，且该死代码已在本轮删除。

#### M-5 静默吞错：成立

已确认调用点：

- `src/stores/domains/chat/room.ts`
- `src/services/matrix/messaging/MatrixTypingService.ts`
- `src/services/matrix/auth/MatrixRuntimeSessionService.ts`

结论：

- 报告成立。

#### M-8 TypeScript 严格性不足：成立

现状：

- `tsconfig.json`
  - `noUnusedLocals: false`
  - `noUnusedParameters: false`

结论：

- 报告成立。

### 3.6 跨项目问题在前端侧的复核

#### F-1 `DEHYDRATED_DEVICE` 路径不匹配：前端主结论已过期

现状：

- `src/services/matrix/paths.ts` 已改为 `/_matrix/client/unstable/org.matrix.msc3814.v1/dehydrated_device`
- `src/services/matrix/crypto/MatrixDehydratedDeviceService.ts` 的过期注释已修正，不再引用旧 `/v1/dehydrated_device`

结论：

- 前端路径常量已修正，报告的“前端仍使用 v1”不成立。
- 代码注释层面的误导信息已修正；后续仍建议继续联调确认 `CLAIM` / `INITIAL_DEVICE` 的后端契约完整性。

#### F-2 `FriendRequest` 字段名不匹配：前端已做兼容

现状：

- `src/services/matrix/SynapseRustExtensionsService.ts` 中 `normalizeFriendRequest()` 已兼容：
  - `request_id ?? id`
  - `requester ?? sender_id`
  - `recipient ?? receiver_id`
  - `rejected -> declined`

结论：

- 当前前端已经主动适配，报告不再成立。

## 4. 优化目标

本次优化建议分为四个主目标：

1. 先消除安全、内存、配置失效等高风险问题。
2. 再删掉明确的冗余与废弃层，降低维护噪音。
3. 最后推进 HTTP/错误/平台适配等结构收敛。
4. 对已有能力未接线的功能做“低风险补齐”。

## 5. 详细整改方案

### 第一阶段：立即修复（1 周内）

#### 5.1 修复 `VoiceMessageEnhanced.vue` 事件泄漏

改造目标：

- 用稳定命名函数绑定 `timeupdate`、`ended`、`loadedmetadata`
- 在 `onUnmounted()` 中显式解绑
- 更推荐直接改为复用 `useEventListener()`

实施方式：

- 文件：`src/components/voice/VoiceMessageEnhanced.vue`
- 补充：
  - `let removeTimeupdate: (() => void) | null = null`
  - `let removeEnded: (() => void) | null = null`
  - `let removeLoadedMetadata: (() => void) | null = null`
- 在 `initAudio()` 重建 audio 前先清理旧监听
- 在组件卸载时执行清理

验收标准：

- 重复打开/关闭语音消息组件，监听数量不增长。
- 手动切换房间后不再保留旧 audio 回调。

#### 5.2 在消息发送链路对富文本输入做统一 sanitize

改造目标：

- 发送前把 `contentEditable.innerHTML` 先转为受控 HTML
- 明确允许的标签与属性集合
- 避免直接把原始 `innerHTML` 传给策略层

实施方式：

- 文件：
  - `src/components/rightBox/MsgInput.vue`
  - `src/hooks/msgInput/useMsgInputSend.ts`
  - 可新增 `src/hooks/msgInput/sanitizeInputHtml.ts`
- 建议做法：
  - 新增 `sanitizeMessageInputHtml(rawHtml: string): string`
  - DOMPurify 配置与渲染侧分离，输入侧白名单更严格
  - 如只需保留 `emoji/img/@mention/reply` 标识，优先最小白名单

验收标准：

- 粘贴脚本、内联事件、危险标签后发送，不会进入消息体。
- 正常 emoji、提及、回复卡片仍可发送。

#### 5.3 移除 AI API Key 明文 `localStorage`

改造目标：

- 桌面端优先走 Tauri secure storage 或自定义加密存储
- 浏览器/移动 H5 fallback 方案至少使用“明示不安全 + 用户确认”

实施方式：

- 文件：`src/mobile/views/my/AiAssistant.vue`
- 新增存储适配：
  - `src/services/secure/aiCredentialStorage.ts`
- 存储策略建议：
  - Desktop Tauri: 使用插件或 Rust 命令写入安全存储
  - 非 Tauri 环境：只缓存 `baseUrl`，`apiKey` 默认不落盘

验收标准：

- `localStorage` 中不再出现 `ai_api_settings` 明文密钥。
- 配置迁移时用户可感知，并可重新录入。

#### 5.4 清理静默吞错，补最低限度日志

改造目标：

- 禁止 `.catch(() => {})`
- 至少输出 `debug/warn`

实施方式：

- 文件：
  - `src/stores/domains/chat/room.ts`
  - `src/services/matrix/messaging/MatrixTypingService.ts`
  - `src/services/matrix/auth/MatrixRuntimeSessionService.ts`
- 统一写法：

```ts
.catch((error) => {
  logger.debug('xxx failed', error)
})
```

验收标准：

- 问题失败不再完全静默。
- 不引入新的用户弹窗干扰。

### 第二阶段：清除明确冗余（1 到 2 周）

#### 5.5 删除 `src/utils/Result.ts` [已完成]

原因：

- 无生产引用。
- 与 `src/common/result.ts` 重复。

实施方式：

- 删除文件
- 删除仍引用旧实现的遗留测试
- 搜索确认无生产代码隐式路径别名引用

验收标准：

- 旧路径不再被生产代码与测试引用。

#### 5.6 下线 `GlobalErrorHandler` 包装层 [已完成]

原因：

- 当前真正工作的全局错误入口是 `errorTracker.initialize()`
- `src/common/errorHandler.ts` 无生产代码使用

实施方式：

- 删除测试和文件，统一保留 `ErrorTracker + AppError` 体系

注意：

- 这项是“删冗余”，不是“修冲突”。

#### 5.7 迁移并删除废弃文件 [已完成]

优先顺序：

1. `src/services/mapApi.ts`
2. `src/services/wsType.ts`
3. `src/common/matrixErrorTranslator.ts` 的旧导出

建议迁移路径：

- `mapApi.ts`
  - 已整合进 `services/location/LocationProxyService.ts`
  - 统一复用新 HTTP 错误模型
- `wsType.ts`
  - 已拆成 `@/enums` 中的 `WsResponseMessageType` 与 `services/legacy/wsEventTypes.ts`
  - 现仅保留遗留载荷类型与通话状态码
- `matrixErrorTranslator.ts`
  - 已收口到 `src/common/errors.ts`

验收标准：

- 旧入口已无生产引用，并完成文件删除。

### 第三阶段：结构收敛（2 到 4 周）

#### 5.8 统一 HTTP 请求抽象

目标架构：

- `MatrixHttpClient`
  - 专管 `client.http.authedRequest`
  - 返回统一 `Result<T, AppError>`
- `ExtensionHttpClient`
  - 专管 fetch/custom endpoint
  - 同样返回统一 `Result<T, AppError>`
- 上层不要再出现 `null` / `false` / 抛异常 / 自定义 `{ ok, data }` 混用

建议落地步骤：

1. 已给 `MatrixRequestHelper` 增加 `requestResult<T>()`，作为统一错误模型的新入口
2. 已给 `HttpClient` 增加 `requestAppResult<T>()`，作为扩展接口侧的 `AppError` 结果入口
3. 已迁移首批真实调用点：
   - `RoomCapabilitiesService.fetch()` -> `MatrixRequestHelper.requestResult<T>()`
   - `MatrixRoomMetadataService.getRoomCapabilities/getRoomMetadata/getRoomTurnServer/getRoomSync()` -> `MatrixRequestHelper.requestResult<T>()`
   - `ModelService.page/update/delete()` -> `httpClient.requestAppResult<T>()`
   - `ChatRoleService.page/categoryList/create/update/delete()` -> `httpClient.requestAppResult<T>()`
   - `ApiKeyService.page/simpleList/create/update/delete/balance/platformList/addPlatformModel()` -> `httpClient.requestAppResult<T>()`
   - `ConversationService.page/create/update/delete/messageListByConversationId/messageDelete/messageDeleteByConversationId()` -> `httpClient.requestAppResult<T>()`
   - `AIService` 现有 HTTP 调用已全部迁移到 `httpClient.requestAppResult<T>()`，覆盖会话、消息、模型、图片、视频、音频、语音列表与聊天角色分页
4. 当前 `src/` 生产代码中的直接调用已完成清零：旧 `HttpClient.request()` 与 `safeGet/safePost/...` 仅剩测试覆盖保留
5. 旧入口已加 `@deprecated` 标注，后续进入“禁止新增直接使用 -> 最终删除兼容层”的阶段

约束：

- 不建议一次性大改全仓。
- 应以“新增统一接口 + 渐进迁移 + 最终删除旧接口”的方式推进。

#### 5.9 消除循环依赖 hack

短期方案：

- 已提取 `matrixClientAccessor.ts`
  - 当前统一暴露 `getClient()`、`getAccessToken()`、`getHomeserverUrl()`、`waitForClientReady()`
  - `HttpClient.ts`、`BaseMatrixService.ts`、`MatrixPresenceService.ts`、`SynapseRustExtensionsService.ts` 已改为复用该 accessor
- `MatrixClientService` 已显式注册 accessor 实现，当前运行时默认走注册路径
- 下一步再评估删除 accessor 内部兼容 fallback 的时机，并补足剩余依赖解耦

中期方案：

- 引入轻量 service registry，不直接互相 import 实例

不建议：

- 现在就引入完整 DI 容器，会增加学习和迁移成本。

#### 5.10 让 `HttpClient` 动态读取 baseUrl [已完成]

推荐实现：

- 删除 `private baseUrl`
- 每次 `request()` 时调用 `resolveMatrixRuntimeEndpointConfig()`

备选：

- 如果担心性能，增加 `refreshConfig()`，在切换 homeserver 时触发

结论：

- 已按“按请求解析”落地，并补了动态地址切换回归测试。

#### 5.11 隔离 Tauri 平台能力

改造目标：

- 把 `@tauri-apps/api/*` 访问下沉到平台适配层
- `MatrixClientService` 不直接知道 Tauri API 细节

建议目录：

- `src/platform/runtime/tauriAdapter.ts`
- `src/platform/runtime/browserAdapter.ts`

实施顺序：

1. 先包裹 `invoke`
2. 再包裹窗口能力/系统能力
3. 最后迁移 `MatrixClientService` 的动态导入

### 第四阶段：性能与可维护性治理（2 到 4 周）

#### 5.12 提取重复的会话事件订阅

新增 composable：

- `src/views/homeWindow/useSessionEvents.ts`

职责：

- 处理 `UPDATE_SESSION_LAST_MSG`
- 处理 `DELETE_SESSION`
- 处理 `LOCATE_SESSION`

收益：

- 三个列表组件共享一套逻辑
- 更容易统一优化缓存失效策略

#### 5.13 为热点列表引入 `v-memo` 或行级子组件

目标文件：

- `src/components/friend/FriendListView.vue`
- `src/views/homeWindow/RoomList.vue`
- 如有必要再扩展到 `SpaceList.vue`

实施建议：

- 先拆出 `FriendListItemRow.vue` / `RoomListItemRow.vue`
- 再在行组件上使用稳定 props
- 若仍有重渲染压力，再补 `v-memo`

说明：

- 先拆行组件，再上 `v-memo`，通常比直接在大模板中塞 memo 更可维护。

#### 5.14 拆分超大文件

优先级建议：

1. `App.vue`
2. `MatrixClientService.ts`
3. `SynapseRustExtensionsService.ts`
4. `WorkbenchDetailPane.vue`

建议拆分方式：

- `App.vue`
  - 启动/引导逻辑
  - 全局事件订阅
  - presence 同步
  - 网络重连处理
- `MatrixClientService.ts`
  - client 生命周期
  - sync
  - tauri/runtime integration
  - dehydrate/crypto capability
- `SynapseRustExtensionsService.ts`
  - friends
  - DM
  - invite blocklist
  - voice/extra extension

#### 5.15 统一清理 DOM 事件注册方式

建议：

- 统一优先使用 `src/composables/useEventListener.ts`
- 明确规范：
  - 组件内直接 `addEventListener()` 需要说明原因
  - 若使用原生监听，必须在同文件出现清理逻辑

### 第五阶段：功能补齐与规范化（2 周）

#### 5.16 接通房间头像上传

目标文件：

- `src/components/room/RoomDetailPane.vue`
- `src/components/room/CreateRoomPane.vue`

实施方式：

- 复用已有 `useAvatarUpload()`
- 明确两种场景：
  - 创建房间前本地预览
  - 房间已创建后的头像修改

验收标准：

- 用户能在创建房间时选择头像。
- 已有房间能在详情页更新头像。

#### 5.17 收紧 `v-safe-html` 白名单

实施步骤：

1. 先加审计开关，记录哪些消息真实依赖 `style`
2. 若依赖极少，直接从 `ALLOWED_ATTR` 删除 `style`
3. 若确实需要，改成有限样式映射，而不是完整透传

#### 5.18 恢复 `.vue` 未使用检查与 TS 严格选项

建议顺序：

1. 先开启 Biome 对 `.vue` 的 `warn`
2. 清一次死代码
3. 再逐步启用 `tsconfig` 的 `noUnusedLocals`、`noUnusedParameters`

注意：

- 不建议一次性切成 error。
- 推荐每阶段只处理新增告警或限定目录。

## 6. 建议的删减清单

适合作为“清除冗余和过度开发”的首批对象：

- 已删除：`src/utils/Result.ts`
- 已删除：`src/common/errorHandler.ts` 及其测试
- 已删除：`src/services/mapApi.ts`
- 已删除：`src/services/wsType.ts`
- 已删除：`src/services/matrix/sdk-errors.ts`
- 已删除：`src/common/matrixErrorTranslator.ts`

适合“先冻结新增，再逐步回收”的对象：

- `HttpClient.request()` / `requestResult()` 双轨
- `MatrixRequestHelper.safeGet/safePost/safePut/safeDelete()` 的 `null/boolean` 语义
- `MatrixClientService` 的运行时导出兜底逻辑

## 7. 优先级路线图

### P0：本周必须完成

- 修复 `VoiceMessageEnhanced.vue` 监听器清理
- 给消息输入发送链路加 sanitize
- 去掉 AI API Key 明文 `localStorage`
- 补全静默吞错日志
- 更新文档和注释，纠正 `useMitt` 自动清理、`dehydrated_device` 注释过期等误导信息
  - 当前进度：`dehydrated_device` 过期注释已修正；`useMitt` 自动清理说明仍建议在后续文档同步中补充。

### P1：两周内完成

- 提取 `useSessionEvents()`
- 接入房间头像上传
- 统一 `HttpClient` / `MatrixRequestHelper` 错误模型的迁移入口

### P2：一个月内完成

- 统一 HTTP 错误模型
- 消除循环依赖 hack
- 拆分 `App.vue` / `MatrixClientService.ts` / `SynapseRustExtensionsService.ts`
- 收紧 DOMPurify 白名单
- 开启 `.vue` 未使用检查和更严格 TS 选项

## 8. 风险与执行原则

- 不要一次性大改 HTTP 层和错误层，必须渐进迁移。
- 删除废弃文件前，先建立兼容替代入口并补回归测试。
- `style` 白名单收紧前，要先抽样验证消息富文本显示。
- 任何“跨项目契约”修改都应补一份前后端联调清单，尤其是：
  - dehydrated device
  - friend request
  - DM 扩展
  - voice 扩展

## 9. 建议补充的验证项

建议在执行整改时增加以下检查：

- 单测：
  - `VoiceMessageEnhanced.vue` 监听清理
  - 输入 sanitize
  - `HttpClient` 动态 baseUrl
  - `useSessionEvents()` 共享逻辑
- 类型检查：
  - `vue-tsc --noEmit`
- 代码检查：
  - `pnpm check`
- 手工验证：
  - 切换 homeserver 后 AI/扩展请求是否命中新地址
  - 房间切换多次后语音消息播放是否残留旧回调
  - 富文本粘贴是否被正确净化
  - 头像上传在创建房间与房间详情页是否都可用

## 10. 最终建议

如果只做一轮低风险高收益治理，建议按下面顺序执行：

1. 安全与泄漏修复：`VoiceMessageEnhanced`、输入 sanitize、AI Key 存储。
2. 清冗余：`utils/Result.ts`、`GlobalErrorHandler`、`mapApi.ts`、`wsType.ts`、`matrixErrorTranslator.ts` 已完成清理。
3. 收敛接口：统一 HTTP/错误模型，动态读取 homeserver。
4. 完善功能：接通房间头像上传，抽离会话事件逻辑，逐步拆大文件。

以上顺序能在不大规模震荡业务代码的前提下，先解决真正影响稳定性、安全性和维护成本的问题。
