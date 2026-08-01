# ADR-005: Crypto Store 生命周期治理

## 状态

Accepted (2026-07-30)

## 背景

在 2026-07-30 的登录性能分析中，发现用户换设备登录时 `initRustCrypto` 报错 `the account in the store doesn't match the account in the constructor`，导致：

- crypto 重试循环耗时 ~22s
- `settlePostLoginStartup` 超时 15s × 2 次
- `waitSyncPrepared` 超时 5s × 2 次
- 总登录耗时 ~51s

根因是 `MatrixClientService.logout()` 调用 `client.logout()` + `stopClient()` 后未清理 IndexedDB crypto store。下次登录时 deviceId 变化，旧 crypto 账户与新设备不匹配。

`clearStaleCryptoStores()` 函数已存在于 `MatrixCryptoStateTracker.ts:286`，但仅在 `initRustCrypto` 失败后的重试逻辑中调用——属于事后补救。

## 决策

**采用方案 A：logout 时始终清理 crypto store。**

在 `MatrixClientService.logout()` 的 `finally` 块中调用 `clearStaleCryptoStores()`。

### 备选方案

| 方案 | 描述 | 优点 | 缺点 | 决策 |
|------|------|------|------|------|
| A: logout 始终清理 | 每次 logout 都调用 clearStaleCryptoStores | 逻辑简单；换设备永远不触发 W1；无状态判断 | 同设备重登需重建 crypto（~2s） | **采纳** |
| B: 条件清理 | 仅在 deviceId 变更时清理 | 同设备重登不重建 crypto | 需额外存储 lastDeviceId；逻辑复杂 | 否决 |
| C: 登录前预清理 | logout 不变，登录时检测用户变更 | 不改 logout 流程 | 仍有一次 initRustCrypto 失败开销 | 否决 |

### 理由

1. Crypto store 重建仅 ~2s，远小于 W1 导致的 22s 重试循环
2. `client.logout()` 已在服务端销毁 device，本地 crypto 数据已无价值
3. 逻辑最简单，无需状态判断和额外存储
4. 从源头消除 W1 警告及其所有连锁反应（W2/W3/W4/W5/W6/W7）

## 影响

- `MatrixClientService.logout()`: `finally` 块新增 `await clearStaleCryptoStores(userId)` 调用
- 同设备重新登录时，crypto store 需重建（~2s），但远小于不清理导致的 22s 重试
- 所有换设备/换账号场景不再触发 W1 连锁反应
