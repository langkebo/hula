# HuLa 前端项目重构与优化全方位方案

> **日期**: 2026-03-22
> **目标**: 全面适配 `synapse-rust` 后端架构，解决当前前端历史技术债务，提升性能与稳定性。
> **范围**: HuLa 前端 (Vue 3 + Tauri) & 本地 Matrix SDK (`matrix-js-sdk`)

---

## 一、架构对齐与核心能力升级 (P0)

`synapse-rust` 后端提供了许多高性能和现代化的 Matrix 特性，前端需要重点进行以下架构级适配：

### 1. 引入 Sliding Sync (滑动同步 - MSC3886)
- **现状**: 当前 [MatrixSyncService.ts](../src/services/matrix/MatrixSyncService.ts) 仍在使用传统的 `/sync` v2/v3 接口。当房间数量增多时，首屏加载极慢且内存占用大。
- **优化方案**:
  - 在 SDK 中全面启用 `SlidingSync` 模块。
  - 在前端新建 `MatrixSlidingSyncService.ts`，利用后端的 `sliding_sync_service.rs`，实现按需加载（如仅同步当前可视区域的房间和最新消息）。
- **预期收益**: 客户端首屏启动速度提升 300% 以上，大幅降低内存 OOM 风险。

### 2. OIDC (OpenID Connect) 认证闭环
- **现状**: 仅支持传统的密码/Token 登录，缺乏现代 SSO 体验。后端已实现完整的 `oidc_service.rs`。
- **优化方案**:
  - 新建 `MatrixOidcService.ts` 封装 SDK 的 `OidcManager`。
  - 重构登录页面，支持跳转外部 OIDC Provider 授权，处理回调并静默完成矩阵用户的自动注册/绑定。
- **预期收益**: 提升企业级客户接入体验，符合现代安全合规要求。

### 3. SSSS 与 E2EE 状态机优化
- **现状**: 现有的端到端加密状态机处理较脆，交叉签名与密钥备份容易断链。
- **优化方案**:
  - 充分复用 SDK 提供的 `SecureBackup` 和 `Verification` 高级封装，移除项目中手动拼接加密事件的“野生”代码。
  - 完善从“新设备扫码验证”到“拉取历史密钥”的全链路 UI 交互。

---

## 二、清理技术债务与 TS 错误修复 (P1)

目前前端和 SDK 存在 140+ 个 TypeScript 编译错误和大量死代码。

### 1. 修复核心服务 TS 错误
- **集中区域**: `stores/room.ts`, `stores/chat.ts` 及 `MatrixClientService.ts`。
- **修复策略**:
  - **短期**: 对于版本不兼容导致的方法名冲突，采用 `(client as any).methodName` 进行断言绕过，确保项目能够通过严格的 CI/CD 构建。
  - **长期**: 同步更新本地 SDK 中的 `index.d.ts`，精准映射 `matrix-js-sdk v40+` 的类型。

### 2. 清理死代码与沉余模块
- **目标**: `ImRequestUtils.ts` (当前 1300+ 行) 存在大量废弃的请求封装。
- **重构方案**:
  - 全面废弃旧的 Axios 直接调用方式。
  - 所有标准请求必须经过 `MatrixClientService` 路由；非标扩展必须经过 `SynapseRustExtensionsService`。
  - 引入统一的 `Result<T, E>` 错误处理模型，统一拦截并处理后端的 `ApiResponse` 包装格式。

---

## 三、后端自定义扩展功能适配 (P2)

`synapse-rust` 提供了一系列非标 Matrix 的增强业务能力，前端需进行 1:1 对接。

### 1. 增强型社交关系
- **功能**: 后端已实现基于 `friend_room` 的增强好友系统。
- **前端动作**:
  - 在 `SynapseRustExtensionsService.ts` 中完善 `getFriendRequests`、`acceptFriendRequest` 等方法。
  - 确保 UI 层的通讯录列表实时响应后端的双向好友状态，而非仅依赖 Matrix 的原始 room invite 机制。

### 2. 阅后即焚与 Sticky Event
- **功能**: 后端支持 `burn_after_read` 及 `MSC4354 Sticky Event`。
- **前端动作**:
  - 在 `MatrixEventService.ts` 中增加对该自定义事件类型的解析。
  - 在 Vue 组件 (`render-message.scss` / 消息组件) 中添加倒计时销毁的动效与本地存储清理逻辑。

### 3. Widget 小组件机制
- **功能**: 房间内的微前端/小程序。
- **前端动作**: 新增 `MatrixWidgetService.ts`，处理与 Widget IFrame 的 postMessage 通信机制，丰富房间生态。

---

## 四、实施路线图与时间表

### 阶段一：基础维稳与止血 (Week 1)
- 修复 `contacts.ts` 等核心文件的 TS 报错。
- 清理 `ImRequestUtils.ts` 死代码，统一错误处理格式。
- **验收**: `npm run build` 和 `vue-tsc` 零报错通过。

### 阶段二：性能飞跃 (Week 2)
- 接入 Sliding Sync，重构消息列表与房间列表的虚拟滚动。
- 引入限流退避重试机制（处理后端的 `M_LIMIT_EXCEEDED`）。
- **验收**: 千人房间首屏加载时间 < 1秒。

### 阶段三：功能补齐 (Week 3)
- 完成 OIDC 全链路登录。
- 完成 Widget 与 Sticky Event 的 UI 适配。
- 完善 SSSS 跨设备验证的弹窗流。
- **验收**: 新功能端到端联调通过。

---

> **注意**: 在整个重构过程中，**严禁直接通过 npm 安装标准的 matrix-js-sdk**，必须全程使用并维护项目目录下的本地 SDK，以保证对 `synapse-rust` 自定义功能的兼容性。