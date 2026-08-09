# MatrixClient 重复初始化收敛报告

> 2026-08-09 ｜ 触发来源：macOS `pnpm tauri:dev` 调试日志排查

## 一、日志中暴露的问题

从调试构建日志中甄别出 4 类现象，其中 3 类同源：

| # | 现象 | 性质 | 结论 |
|---|------|------|------|
| 1 | `IMKCFRunLoopWakeUpReliable` / `TSM AdjustCapsLockLED` | macOS 输入法系统消息 | **噪音**，非项目问题 |
| 2 | synapse `keys/query` 多次 **429** | E2EE 设备密钥查询被限流 | **真实缺陷**，重复 client 导致查询翻倍 |
| 3 | 阅读回执重复发送 | 同一事件被处理两次 | **真实缺陷**，两套事件监听器 |
| 4 | `MatrixConnection` 初始化日志**成对出现** | 一次登录建了两个 client | **根因**，问题 2/3 的共同来源 |

问题 2、3、4 是同一条因果链的不同表现。

## 二、根因分析

### 因果链

```
loginWithToken(token, userId)
  └─ config.deviceId 缺失
      └─ initialize({ deviceId: undefined })      ← 第 1 次建 client
          └─ 刚 createClient 的 getDeviceId() 返回空
              └─ whoami 回填拿到真实 deviceId
                  └─ initialize({ deviceId: 'XXX' })  ← 第 2 次建 client
                      └─ MatrixConnectionManager 无幂等保护
                          └─ this.client 被直接覆盖，旧 client 泄漏
```

### 泄漏的后果

旧 client 并未被停止或回收，于是：

- **两个 client 各自跑 E2EE 设备密钥查询** → `keys/query` 请求量翻倍 → 触发 synapse 限流返回 429
- **两套事件监听器同时在线** → 同一条消息被处理两次 → 阅读回执重复发送
- 连接状态机日志成对打印

核心症结在于 `MatrixConnectionManager.initialize()` 是**非幂等**的：无论当前是否已有可用 client，一律重新 `createClient` 并覆盖 `this.client`。

## 三、修复方案

### 修复 1：ConnectionManager 幂等守卫

`MatrixConnectionManager.initialize()` 开头新增三分支决策：

```ts
// 已有 client 且配置等价 → 直接复用
if (this.client && this.config && this.isConfigEquivalent(config)) {
  logger.info('MatrixClient 已初始化且配置一致，复用现有实例')
  return
}
// 配置变更 → 先释放旧实例，避免泄漏
if (this.client) {
  logger.info('MatrixClient 配置变更，释放旧实例后重建')
  this.resetState()
}
```

配置等价判据为六个字段全等：`homeserverUrl` / `userId` / `deviceId` / `accessToken` / `identityServerUrl` / `allowInsecureHttp`。

同时新增公开方法 `shouldReuse(config)`，供上层 facade 查询复用意图。

### 修复 2：facade 条件式 detach

`MatrixClientService.initialize()` 原本**无条件**执行监听器摘除、停止 sync、重置 crypto：

```ts
// 修改前：无条件 detach
const observed = this.eventRouter.getObservedClient()
if (observed) this.eventRouter.detach(observed, this.syncManager)
this.syncManager.stop()
this.cryptoTracker.resetState()
```

这在复用路径下是**致命的**——`eventRouter.setup(client)` 只在 `startClient()` 时调用，复用时不会重跑，一旦先 detach，监听器就永久丢失且无人重挂。故改为：

```ts
// 修改后：仅在确定不复用时才拆
if (!this.connectionManager.shouldReuse(config)) {
  const observed = this.eventRouter.getObservedClient()
  if (observed) this.eventRouter.detach(observed, this.syncManager)
  this.syncManager.stop()
  this.cryptoTracker.resetState()
}
```

### 修复 3：loginWithToken 前置解析 deviceId

把 deviceId 的确定时机从「建完 client 之后」提前到「首次 initialize 之前」，彻底消除"建了再扔"：

```ts
// 短路：已持久化 deviceId 时不发 whoami 请求，避免多余往返
const whoamiDeviceId = config.deviceId
  ? undefined
  : await this.resolveDeviceIdByWhoami(token, config.homeserverUrl)
const stableDeviceId = resolveStableDeviceId(config, whoamiDeviceId)

await this.initialize({ ...config, accessToken: token, userId, deviceId: stableDeviceId })
```

新增的 `resolveDeviceIdByWhoami()` 通过 `getRuntimeAwareFetch()` 直连 `/_matrix/client/v3/account/whoami`，带 Bearer token，**不依赖已初始化的 client**——这是能够前置的关键。

随之删除了旧的 `resolveTokenLoginDeviceId(userId)` 方法与 `WhoamiCapableClient` 类型。

## 四、自查中发现并修正的两处退步

改动过程中自查抓到两个我自己引入的问题，均已修正：

**1）孤儿导出** — 接入新逻辑后 `resolveStableDeviceId` 的生产调用点被删光，只剩测试引用。测试仍然全绿，但该函数已脱离生产路径，而项目约定它是「设备 ID 持久化优先」的单一真源。修法是把它接回 `loginWithToken` 的两处解析点。
> 经验：改动后应 grep 关键函数，确认其没有悄悄变成 test-only。

**2）await 参数求值破坏短路** — 一度写成 `resolveStableDeviceId(config, await this.resolveDeviceIdByWhoami(...))`。由于实参先求值，whoami 会**无条件发起**，即使 `config.deviceId` 已存在，反而多出一次网络往返，正好违背本次优化初衷。修法是先用三元表达式求出 `whoamiDeviceId` 再传入。
> 经验：把 `??` 短路改写成函数调用时，务必检查右操作数是否含 await 或副作用。

## 五、测试

### 新增用例

| 文件 | 用例 | 守护的行为 |
|------|------|-----------|
| `MatrixClientService.spec.ts` | 配置一致时重复 initialize 应复用现有 client | `createClient` 仅 1 次 |
| `MatrixClientService.spec.ts` | 配置变更（deviceId 不同）时应释放旧 client 后重建 | `createClient` 2 次 |
| `MatrixClientService.spec.ts` | `shouldReuse` 契约 | 等价→true，异 deviceId→false |
| `MatrixClientService.slidingsync.test.ts` | 缺 deviceId 时于首次 initialize 前 whoami 预解析 | 只 init 一次，whoami 带 Bearer token |
| `MatrixClientService.slidingsync.test.ts` | 已持久化 deviceId 时应短路 | 不发起任何 whoami 请求 |

### 变异验证

「不应发生 X」类断言极易永远为真。对新增的短路用例做了变异测试：临时删除短路逻辑重跑 → 该用例确实 FAIL → 恢复实现。确认断言真实有效，非假绿。

### 测试踩坑记录

- `beforeEach` 必须调用 `connectionManager.resetState()`。原先的 `setClient(null)` 不清 `config`，残留配置会让幂等守卫误判为可复用。
- 起初写了个 spy `eventRouter.detach` 的用例，但 spy 单例的 private 协作者拿不到真实实例，且纯 `initialize` 单测不走 `startClient`，`observedClient` 恒为 null，detach 分支根本不进。改为直接断言 `shouldReuse` 契约——这是 facade 是否 detach 的唯一判据，稳定可靠。

## 六、验收结果

| 项目 | 结果 |
|------|------|
| `vue-tsc --noEmit` | 0 错误 |
| `biome check src/services/matrix/` | 312 文件 clean |
| Matrix 域全量测试 | **152 文件 / 1964 用例全绿**（较改动前 +1） |

## 七、行为对比

| 场景 | 改动前 | 改动后 |
|------|--------|--------|
| token 登录（无持久化 deviceId） | 建 2 个 client，旧的泄漏 | whoami 预解析后建 1 个 |
| token 登录（有持久化 deviceId） | 建 2 个 client | 建 1 个，**且不发 whoami** |
| 重复 initialize（同配置） | 每次都新建并覆盖 | 直接复用，无副作用 |
| initialize（配置变更） | 直接覆盖，旧实例泄漏 | 先 `resetState()` 释放再重建 |
| `keys/query` 请求量 | 翻倍 → 429 | 单份 |
| 阅读回执 | 重复发送 | 单次 |

## 八、待验证

代码层面与测试层面均已闭环。建议实机跑一次 `pnpm tauri:dev` 完整登录流程，确认日志中：

- `MatrixConnection` 初始化日志不再成对出现
- `keys/query` 无 429
- 阅读回执不再重复
