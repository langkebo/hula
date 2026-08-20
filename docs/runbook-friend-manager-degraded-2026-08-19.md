# Runbook：friend_manager_degraded 事件排查

> 用途：当 telemetry 事件总线（`src/utils/telemetry.ts`）发射 `friend_manager_degraded`（kind=health, severity=warn）时，值班/研发按本手册排查与恢复。
> 关联代码：`src/services/matrix/MatrixConnectionManager.ts` 的 `assertCriticalExtensions()`（L432–470）、`src/utils/extensionHealth.ts`、`src/stores/domains/chat/capability.ts`。

---

## 1. 事件定义

| 字段 | 值 |
|---|---|
| 事件名 | `friend_manager_degraded` |
| kind | `health` |
| severity | `warn` |
| context.reason | `getFriendManager_unavailable` |
| context.fallback | `rest_api` |
| context.possibleCause | `initializeManagerExtensions_failed_or_sdk_incompatible` |

**语义**：Matrix SDK 客户端上未检测到 `FriendManager` 扩展（`getFriendManager` 访问器缺失或非函数），好友能力从增量扩展降级为 REST API 全量拉取。**不阻塞登录与基础聊天**，但好友列表/好友状态变更的实时性下降。

**发射时机**：每次 `setClient()` 后 `assertCriticalExtensions()` 运行时（客户端创建/重建后）。

---

## 2. 快速处置（TL;DR）

1. **确认影响面**：仅好友功能的实时性受影响，聊天/同步不中断，无需立即切流。
2. **查基线频率**：若上线前无此事件、上线后出现 → 大概率是 SDK 版本升级或扩展初始化时序变化（见 §4.2）。
3. **临时缓解**：请求前端同学在应用内重启客户端（触发 `setClient` → 重跑 `assertCriticalExtensions`）；若仍降级，回滚 SDK/fork 版本（见 §4.3）。

---

## 3. 诊断步骤

### 3.1 确认事件是否在预期生命周期内

- 事件只在客户端创建/重建时发射，**每次重建各 1 次是正常**。
- 若频繁重建（如每次 token 刷新都触发）→ 先排查连接配置是否把 `accessToken` 纳入了等价判定（应走 `setAccessToken` 原地更新，而非 rebuild）。

### 3.2 查看客户端侧日志

- 检索日志关键字：`[扩展健康断言] FriendManager 扩展未注册`（warn）。
- 同级应有一条 `[扩展健康断言] FriendManager 扩展已注册`（info）用于对照——若同一客户端先后出现未注册/已注册，说明初始化时序不稳定。

### 3.3 查看 capability store 状态

- 诊断面板（`src/components/settings/DiagnosticsPanel.vue`）读取 `hasDegradedExtension`。
- `extensionHealth['friend-manager']` 应为 `healthy` | `degraded`。

### 3.4 复现检查（本地）

```bash
# 1. 确认 SDK fork 版本与依赖自洽（package.json 中 matrix-js-sdk 指向 fork tarball）
# 2. 启动 dev，登录后打开诊断面板
# 3. 若 degraded，检查 console 是否有 initializeManagerExtensions 相关错误
```

---

## 4. 根因排查

### 4.1 扩展注册顺序问题

`initializeManagerExtensions()` 必须在 `setClient()` **之前**完成，否则 `getFriendManager` 尚未挂载。

- 检查调用链：`MatrixClientService.initialize` → `initializeManagerExtensions(client)` → 然后才 `connectionManager.setClient(client)`。

### 4.2 SDK 版本不兼容（最常见）

升级 matrix-js-sdk fork 后，`getFriendManager`/`friendManager.start` 的挂载位置或命名变化，导致鸭子类型检查失效。

- 验证手段：在 fork 源码中 grep `getFriendManager`、`addClientExtension`、`registerFriendManager`，确认挂载点未变。
- 检查 `src/types/matrix-js-sdk-augmentations.d.ts` 与 fork 实际导出是否一致。

### 4.3 回滚建议

- 回退到已知健康的 SDK fork 版本（上一稳定 tag），重新 `pnpm install --config.confirmModulesPurge=false`。
- 复跑 `node scripts/run-vitest.js run src/services/matrix/__tests__/MatrixClientService.spec.ts`（含 O7 降级遥测契约），确认 `friend-manager` 恢复 healthy。

---

## 5. 恢复验证

完成修复后：

1. 重建客户端（或重启应用），确认日志无 `未注册` warn、诊断面板 `extensionHealth['friend-manager'] = healthy`。
2. `track` 事件不再发射 `friend_manager_degraded`（或频率回落基线）。
3. 若期间降级到 REST API，验证好友列表可正常拉取（降级路径可用），再观察恢复。

---

## 6. 告警建议（监控侧）

- 指标：`friend_manager_degraded` 事件计数（telemetry health.warn）。
- 建议阈值：**任一客户端 30 分钟内 ≥ 3 次** 或 **上线发布窗口内首次出现** → 触发 P3 告警（不惊醒、记录）；若伴随「连接频繁重建」告警 → 升级 P2。
- 告警收敛：按 client 实例维度去重，避免重复发射刷屏。

---

## 7. 关联文档

- 扩展注册单一真相 `src/services/matrix/extensions/managerExtensions.ts`（`isFriendManagerRegistered`）。
- 降级 UI 暴露 `src/utils/extensionHealth.ts`（`reportExtensionDegradationToUi`）。
- 诊断导出 `src/utils/dumpDiagnostics.ts`。
- 事件总线 `src/utils/telemetry.ts`。