# 登录流程与头像上传优化报告（grill-with-docs 评审版）

> **评审方法**：基于终端日志（2026-07-30 14:28:22 ~ 14:31:13）和源代码深度探索，经 grill-with-docs 流程对初版报告进行 5 轮质询，修正 3 处错误假设，确认 2 处根因，形成本报告。
>
> **关联文档**：[ADR-005-Crypto-Store-Lifecycle](./adr/ADR-005-Crypto-Store-Lifecycle.md) | [Glossary](./adr/GLOSSARY.md)

---

## 第一部分：根因分析

### 1.1 登录耗时 51s — Crypto 账户不匹配连锁反应

**终端证据**：

| 时间 | 事件 | 耗时 |
|------|------|------|
| 14:28:22 | MatrixClient 初始化 | — |
| 14:28:23 | `initRustCrypto 失败: account in the store doesn't match` | <1s |
| 14:28:23 → 14:28:45 | crypto 重试循环（清理 IndexedDB → 等待 500ms → 重试 → 再失败） | ~22s |
| 14:28:22 → 14:28:37 | `settlePostLoginStartup` 超时 15s（被 crypto 阻塞） | 15s |
| 14:28:38 → 14:28:43 | `waitSyncPrepared` 超时 5s（sync 未启动） | 5s |
| 14:28:44 → 14:28:59 | 第二次 `settlePostLoginStartup` 超时 15s | 15s |
| 14:28:59 → 14:29:04 | 第二次 `waitSyncPrepared` 超时 5s | 5s |
| 14:29:04 → 14:29:13 | bootstrap 完成（房间/用户/presence） | ~9s |
| **合计** | | **~51s** |

**根因链**：

```
logout 未清理 crypto store（根因）
  ↓
下次登录 deviceId 变化 → IndexedDB 中旧 crypto 账户与新设备不匹配（W1）
  ↓
initRustCrypto 抛异常 → clearStaleCryptoStores 尝试清理
  ↓
IndexedDB deleteDatabase 被 onblocked（SDK 仍持有连接）（W4）
  ↓
清理失败 → 重试 initRustCrypto → 再失败
  ↓
startClient 被 crypto 阻塞 → settlePostLoginStartup 超时 15s（W2）
  ↓
sync 未启动 → waitSyncPrepared 超时 5s（W3）
  ↓
整个流程重复第二次（W5/W6）
```

**代码证据**：

- **logout 不清理 crypto**：[MatrixClientService.ts:400-420](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/MatrixClientService.ts#L400-L420) — `logout()` 调用 `client.logout()` + `stopClient()`，无 IndexedDB 清理
- **clearStaleCryptoStores 仅在事后补救**：[MatrixCryptoStateTracker.ts:286](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/MatrixCryptoStateTracker.ts#L286) — 只在 `initRustCrypto` 失败后的重试逻辑中调用
- **超时常量**：[matrix.ts:13](file:///Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/matrix.ts#L13) — `POST_LOGIN_STARTUP_TIMEOUT_MS = 15_000`

### 1.2 MatrixClientService 双重实例化（待排查）

**终端证据**：日志中 `Matrix 客户端服务初始化` 出现两次（14:28:43 和 14:28:44），该日志来自 [MatrixClientService 构造函数](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/MatrixClientService.ts#L78-L79)。

**初版报告误判**：原报告声称"`settlePostLoginStartup` 和 `bootstrapPostLoginState` 各触发一次 startClient"——**已证伪**。`settlePostLoginStartup` 在 [matrix.ts:101/138/166](file:///Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/matrix.ts#L101) 中被三个互斥的登录方法分别调用（每次登录只走一条路径）；`bootstrapPostLoginState` 不调用 `startClient`。

**当前状态**：根因未确定，需排查 serviceRegistry 单例保证和 crypto 重试逻辑是否重建服务实例。

### 1.3 头像剪裁预览空白

**用户确认现象**：模态框打开，剪裁区域完全空白。

**初版报告误判**：原报告声称"CSP `img-src` 未包含 `asset:` 协议"——**已证伪**。[tauri.conf.json:50](file:///Users/ljf/Desktop/hu_ts/hula/src-tauri/tauri.conf.json#L50) 的 CSP 已包含 `asset:`。

**修正后的根因假设**：

| 假设 | 可能性 | 依据 |
|------|--------|------|
| `convertFileSrc()` 返回空或无效 URL | 中 | 某些 Tauri 版本/平台可能不支持 asset 协议 |
| `watch` 时序问题：`props.imageUrl` 和 `props.show` 未在同一 tick 中均为 truthy | 中 | [AvatarCropper.vue:187-216](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/AvatarCropper.vue#L187-L216) 的 watch 需要两者同时为 true |
| VueCropper 内部 `new Image()` 加载 asset URL 失败 | 低 | CSP 已允许，但 VueCropper 库可能有 URL 格式校验 |

**排查方向**：在 `openAvatarCropperViaTauri` 中打印 `convertFileSrc()` 返回值；在 AvatarCropper 的 `watch` 中打印 `show` 和 `imageUrl` 的变化时序。

### 1.4 预设头像"一直上传中"

**根因**：预设头像上传路径**缺少超时保护**。

**代码证据**：

- **本地图片路径有超时**：[AvatarCropper.vue:183](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/AvatarCropper.vue#L183) — `CROP_TIMEOUT_MS = 10000`，10s 超时保护
- **预设路径无超时**：[AccountSettings.vue:318-330](file:///Users/ljf/Desktop/hu_ts/hula/src/views/settingsWindow/tabs/AccountSettings.vue#L318-L330) — `handleSelectPreset` 中 `fetch()` + `handleCrop()` 均无超时包装
- 如果 `fetch(avatarUrl)` 或 `matrixMediaService.uploadImage()` hangs（不 resolve 也不 reject），则 try/catch 均不执行，`loading` 永远为 `true`

**初版报告误判**：原报告首要假设为"`fetch` 404 失败"——**可能性低**，因为 `public/avatar/*.webp` 文件确认存在，dev server 正常服务。

---

## 第二部分：修复方案

### 2.1 阶段 1：Crypto Store 生命周期治理（P0）

> **决策记录**：见 [ADR-005-Crypto-Store-Lifecycle](./adr/ADR-005-Crypto-Store-Lifecycle.md)

| 步骤 | 修复内容 | 涉及文件 | 决策 |
|------|---------|---------|------|
| 1.1 | **logout 时清理 crypto store**：在 `MatrixClientService.logout()` 的 `finally` 块中调用 `clearStaleCryptoStores()` | MatrixClientService.ts:415 | 方案 A（用户确认） |
| 1.2 | **排查双重实例化**：检查 serviceRegistry 单例保证；检查 crypto 重试是否重建 MatrixClientService | serviceRegistry.ts + MatrixCryptoStateTracker.ts | 待排查 |
| 1.3 | **crypto 异步化**（防御性）：将 `cryptoTracker.ensureCrypto()` 从 `startClient()` 移出，改为 `startClient()` 后异步执行 | MatrixClientService.ts:494 | 防御措施 |
| 1.4 | **IndexedDB 连接释放**（防御性）：`initRustCrypto` 失败后先 `client.stopClient()` 释放连接，再 `deleteDatabase` | MatrixCryptoStateTracker.ts:306 | 防御措施 |

**预期收益**：登录耗时 51s → <10s（消除 crypto 重试循环 + 超时等待）

### 2.2 阶段 2：登录流程优化（P1）

| 步骤 | 修复内容 | 涉及文件 |
|------|---------|---------|
| 2.1 | **waitSyncPrepared 超时改为 CATCHUP**：超时后设置 `connectionState = 'CATCHUP'`，UI 显示"同步中" | MatrixRuntimeSessionService.ts:555 |
| 2.2 | **bootstrap 任务并行化**：`refreshCapabilities` 与 `startClient` 并行执行 | matrix.ts:35-36 |
| 2.3 | **settlePostLoginStartup 超时降级**：超时后不静默继续，而是标记 `startupWarning = true`，UI 显示警告 | matrix.ts:47 |

**预期收益**：登录耗时 <10s → <5s

### 2.3 阶段 3：头像上传修复（P2）

| 步骤 | 修复内容 | 涉及文件 | 决策 |
|------|---------|---------|------|
| 3.1 | **排查剪裁预览空白**：添加 `convertFileSrc()` 返回值日志；添加 `watch` 时序日志 | AccountSettings.vue + AvatarCropper.vue | 待排查 |
| 3.2 | **预设头像超时保护**：在 `handleSelectPreset` 中用 `Promise.race()` 包装 30s 超时，超时后调用 `finishLoading()` + 错误提示 | AccountSettings.vue:318-330 | 用户确认 |
| 3.3 | **uploadImage 超时保护**：在 `handleCrop` 中为 `matrixMediaService.uploadImage()` 添加 30s 超时 | AccountSettings.vue:290 | 防御措施 |

**预期收益**：头像功能正确性恢复

---

## 第三部分：验证计划

### 3.1 测试用例设计

#### 3.1.1 Crypto 生命周期测试

| 用例 ID | 场景 | 前置条件 | 预期结果 | 验证指标 |
|---------|------|---------|---------|---------|
| CRYPTO-001 | 正常首次登录 | 清空 IndexedDB | initRustCrypto 成功，无 W1 警告 | 0 条 WARN |
| CRYPTO-002 | logout → 同设备重登 | 已登录设备 A | logout 清理 crypto，重登 initRustCrypto 成功 | 0 条 WARN |
| CRYPTO-003 | logout → 换设备登录 | 设备 A 已登录，设备 B 首次登录 | logout 清理 crypto，设备 B initRustCrypto 成功 | 0 条 WARN |
| CRYPTO-004 | crypto 初始化失败降级 | 模拟 initRustCrypto 异常 | startClient 不阻塞，sync 正常启动 | startClient < 2s |
| CRYPTO-005 | IndexedDB 不可用 | 隐私模式 | 跳过 crypto，非加密模式启动 | 0 条 ERROR |

#### 3.1.2 登录性能测试

| 用例 ID | 场景 | 预期耗时 | 测量方法 |
|---------|------|---------|---------|
| LOGIN-PERF-001 | 首次登录（无 crypto 残留） | P50 < 5s | `performance.mark('hula-login-bootstrap')` |
| LOGIN-PERF-002 | 换设备登录（旧 crypto 已清理） | P50 < 10s | 同上 |
| LOGIN-PERF-003 | 自动登录（token 恢复） | P50 < 3s | 同上 |
| LOGIN-PERF-004 | crypto 失败降级 | P50 < 8s | 同上 |

#### 3.1.3 头像上传测试

| 用例 ID | 场景 | 预期结果 |
|---------|------|---------|
| AVATAR-001 | Tauri 选图 → 剪裁预览 | 剪裁区域显示图片（非空白） |
| AVATAR-002 | 剪裁 → 上传 → 设置头像 | 上传成功，头像更新，loading 重置 |
| AVATAR-003 | 预设头像选择 → 上传 | 上传成功，头像更新，loading 重置 |
| AVATAR-004 | 预设头像 fetch 超时（模拟 > 30s） | 30s 后 loading 重置，显示超时提示 |
| AVATAR-005 | uploadImage 超时（模拟 > 30s） | 30s 后 loading 重置，显示超时提示 |
| AVATAR-006 | 大图压缩（> 5MB） | 压缩后上传成功 |

#### 3.1.4 警告回归测试

| 用例 ID | 场景 | 预期警告数 |
|---------|------|-----------|
| WARN-001 | 换设备登录 | ≤ 1 条 WARN（仅 W3 最多 1 次） |
| WARN-002 | crypto 初始化失败 | ≤ 2 条 WARN |
| WARN-003 | 正常登录 | 0 条 WARN |

### 3.2 测试环境与数据准备

| 项目 | 要求 |
|------|------|
| 后端 | synapse-rust Docker 容器 healthy，nginx 限流已放宽 |
| 前端 | `pnpm dev` 启动，Tauri dev 模式 |
| 测试账号 | 2 个用户（含 1 个 admin），已互为好友 |
| Crypto 数据 | 测试前清空 IndexedDB |
| 旧设备模拟 | 设备 A 登录 → logout → 设备 B 登录 |
| 头像测试数据 | JPEG 2MB、PNG 500KB、WebP 1MB、> 5MB 大图 |
| 超时模拟 | DevTools Network throttling → "Slow 3G" 或 Charles 代理延迟 |

### 3.3 优化效果评估标准

| 评估维度 | 评估方法 | 通过标准 |
|---------|---------|---------|
| 登录耗时 | `performance.mark` 测量 | P50 < 5s（正常）/ P50 < 10s（换设备） |
| 警告数量 | 终端日志 grep `WARN` | 换设备登录 ≤ 1 条 |
| Crypto 成功率 | 终端日志检查 `initRustCrypto` | 100% 首次成功 |
| 头像上传成功率 | 6 个测试用例 | 6/6 PASS |
| 用户感知 | 登录到房间列表可见 | < 8s |
| 回归测试 | vitest + vue-tsc | 0 错误，0 失败 |

---

## 附录 A：初版报告勘误表

| # | 初版报告内容 | 勘误 | 验证方法 |
|---|------------|------|---------|
| E1 | "CSP `img-src` 未包含 `asset:` 协议"（H3，高可能性） | **错误**：CSP 已包含 `asset:` | [tauri.conf.json:50](file:///Users/ljf/Desktop/hu_ts/hula/src-tauri/tauri.conf.json#L50) |
| E2 | "`settlePostLoginStartup` 和 `bootstrapPostLoginState` 各触发一次 startClient"（O3） | **错误**：三者互斥调用，bootstrap 不调 startClient | [matrix.ts:101/138/166](file:///Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/matrix.ts#L101) + [MatrixRuntimeSessionService.ts:671](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixRuntimeSessionService.ts#L671) |
| E3 | "预设头像首要假设为 fetch 404 失败"（H1，高可能性） | **修正**：首要根因为缺少超时保护 | [AccountSettings.vue:318-330](file:///Users/ljf/Desktop/hu_ts/hula/src/views/settingsWindow/tabs/AccountSettings.vue#L318-L330) 无 Promise.race |

## 附录 B：终端警告完整清单

| ID | 时间 | 警告 | 根因 | 影响 | 修复阶段 |
|----|------|------|------|------|---------|
| W1 | 14:28:23 | initRustCrypto 失败: account mismatch | logout 未清理 crypto store | E2EE 暂不可用 | 阶段 1.1 |
| W2 | 14:28:37 | 登录后 Matrix 启动收尾超过 15000ms | crypto 阻塞 startClient | UI 长时间无响应 | 阶段 1.3 |
| W3 | 14:28:43 | waitSyncPrepared 超时 5000ms | sync 因 crypto 未启动 | 房间列表可能为空 | 阶段 2.1 |
| W4 | 14:28:45 | clearStaleCryptoStores 被阻塞 | IndexedDB 连接未释放 | 旧 crypto 残留 | 阶段 1.4 |
| W5 | 14:28:59 | 第二次启动收尾超过 15000ms | crypto 重试后再阻塞 | 累计耗时 ~37s | 阶段 1.1+1.3 |
| W6 | 14:29:04 | 第二次 waitSyncPrepared 超时 | 同 W3 | 同 W3 | 阶段 2.1 |
| W7 | 14:30:40 | 房间缓存等待超时 | SlidingSync 不稳定 | 返回占位实例 | 阶段 1.1 间接修复 |
