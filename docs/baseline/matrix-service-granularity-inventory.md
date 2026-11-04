# Matrix 服务层粒度盘点与合并候选（AR-07）

> 文档版本：v1.1.0
> 维护人：前端负责人
> 最后更新：2026-11-04（**v1.1 增补 §10：口径修正 + 新增分层守卫**）
> 关联任务：P3-7 AR-07（`docs/TJG-保守项后续优化方案-2026-10-12.md`）
> 性质：**盘点（不改代码）+ 首批低风险合并（批次 1 已落地）**

---

## 1. 目的

`src/services/matrix/**` 长期按域细分，文件数偏多，粒度是否过细此前未量化。本文档：

1. 盘点 `src/services/matrix/**` **全量 `.ts`** 与**非测试 `.ts`** 的分域分布；
2. 以 `access_token` 流为样板，画出跨 4+ service 的调用链，标注可合并候选；
3. 识别**高碎片、低内聚**簇，产出**可执行的合并批次方案**（含风险与回归点）；
4. 执行**首批**（纯转发 / 无状态、零行为变更）合并，并给出 `pnpm test:run` 结果。

---

## 2. 盘点方法

1. 递归遍历 `src/services/matrix/**`，按扩展名与 `__tests__/`（或 `*.test.ts` / `*.spec.ts`）区分测试。
2. 非测试 `.ts` 按**第一层目录**（root 记为 `(root)`）做分域计数。
3. 以 `access_token|accessToken` 为关键字，统计命中文件数（区分「非测试」「全量含测试」两种口径）。
4. 对薄文件（< 100 行）逐一读取，判定其是否为「纯转发 / 无状态」还是「有意保留的接缝（seam）」。

判据脚本：`/tmp` 下临时只读 Node 脚本（遍历 + 正则计数），不写仓库。

---

## 3. 总量与分域统计

### 3.1 总量

| 指标 | 数值 |
| :--- | ---: |
| `src/services/matrix/**` 全量 `.ts` | **466** |
| ├─ 非测试 `.ts` | **217** |
| └─ 测试 `.ts`（`__tests__/` / `*.test.ts`） | **249** |

> **口径修正**：方案写「**216 个非测试 `.ts`**」，实测为 **217**（期间新增 1 个）。本文档以 217 为准。

### 3.2 非测试 `.ts` 分域分布（217）

| 域 | 文件数 | 域 | 文件数 |
| :--- | ---: | :--- | ---: |
| `(root)` | **37** | `paths` | **12** |
| `room` | 24 | `user` | 11 |
| `admin` | 21 | `extensions` | 7 |
| `messaging` | 21 | `friends` | 6 |
| `auth` | 19 | `ai` | 5 |
| `crypto` | 18 | `moderation` / `network` / `rendezvous` / `sync` / `utils` / `widget` | 各 1 |
| `notifications` | 16 | | |
| `media` | 14 | **合计** | **217** |

### 3.3 `access_token` 流口径（关键修正）

| 范围 | 命中文件数 |
| :--- | ---: |
| `src/services/matrix`（**全量 `.ts`，含测试**） | **71** |
| `src/services/matrix`（非测试 `.ts`） | **29** |
| `src/services`（非测试） | 30 |
| `src/**`（非测试 `.ts` + `.vue`） | 48 |

> **口径修正**：方案写「`access_token` 流经 **71 个** service 文件」。实测该数字仅在**「`src/services/matrix` 全量 `.ts` 含测试」**口径下成立；**非测试**口径为 **29**（`src/services` 全量非测试为 30，`src/**` 非测试为 48）。文档据此明确标注口径，避免后续误用。

---

## 4. `access_token` 流样板（跨 4+ service 调用链）

去除 `import` 多态后，运行期 `access_token` 的**单一来源**与**刷新/持久化**路径如下（示意，非穷举）：

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. MatrixClientService.ts        ← client 装配、创建 TokenManager │
│      └─ new MatrixTokenManager()                                  │
│ 2. MatrixTokenManager.ts         ← schedule/refresh/retry 生命周期 │
│      └─ persistRefreshedToken() / logoutExpiredSession()          │
│ 3. matrixClientPlatform.ts       ← 平台持久化：写安全存储 / 登出   │
│ 4. matrixClientAccessor.ts       ← 全局访问器 getAccessToken()     │
│      └─ 被 MatrixHttpClient.ts / ChunkUploadService.ts / ... 读取  │
│ 5. MatrixHttpClient.ts           ← authedRequest 注入 Authorization│
│      └─ PREFIX_V3（paths/）                                        │
│ 6. MatrixClientAuthHttp.ts / MatrixClientAuth.ts  ← 鉴权 HTTP 编排 │
└──────────────────────────────────────────────────────────────────┘
```

**调用链结论**：

- `access_token` 的**写**汇聚在 `MatrixTokenManager` + `matrixClientPlatform`（2 处）；
- **读**通过 `matrixClientAccessor`（**单一全局访问器**）分发，是**有意的收口**，非碎片；
- 链上各文件职责互不重叠（装配 / 刷新 / 持久化 / 访问 / HTTP / 编排），**均为有意的接缝（seam）**，不应强行合并。

---

## 5. 高碎片 / 低内聚簇识别

对全部 37 个 root 级文件与 `paths/`、`extensions/`、`friends/` 逐一判读后结论：

| 簇 | 规模 | 性质 | 合并建议 |
| :--- | ---: | :--- | :--- |
| root `paths.ts` | 1 行 | **纯 re-export barrel**（`export { MATRIX_PATHS, PREFIX_V3 } from './paths/index'`），内容已被 `paths/index.ts` 完全覆盖 | ✅ **可合并**（删除 barrel） |
| root `sdk.ts` / `sdk-compat.ts` | 78 / 26 行 | **SDK 边界咽喉点**，`scripts/check-sdk-boundary.mjs` 的唯一白名单契约 | ❌ 不合并（合并即破坏边界约定） |
| root `MatrixClientProvider.ts` | 6 行 | **DI 类型契约**（`BaseMatrixService` 依赖注入用 `interface`） | ❌ 不合并（类型 seam） |
| root `matrixClientAccessor.ts` | 77 行 | **全局访问器**（含 legacy fallback 逻辑、被 4+ 处 import 与 mock） | ❌ 不合并（有状态 + 被 mock） |
| root `MatrixClient*`（Auth/AuthHttp/Lifecycle/Room/Service/State/Telemetry/ConnectionManager/…） | 多 | 各管一件事（装配/刷新/状态/遥测/连接），职责正交 | ❌ 不合并 |
| `paths/`（12 文件 + index） | 12 | **有意高碎**：按模块（auth/room/friends/space/sync/notification/voice/wellKnown/clientConfig/prefixes/sdk-paths）拆分，由 `bare-matrix-paths` 与契约测试**逐模块强制对齐后端** | ❌ 不合并（合并会削弱契约守护） |
| `extensions/` | 7 | 7 个独立 extension service（各绑单一端点：dm/friend/roomSummary/sticky/…），**低耦合** | ❌ 合并不划算 |
| `friends/` | 6 | facade（`MatrixFriendService`）+ 分域（Groups/Operations/Sync）+ SpecialFriend + utils，facade 模式 | ❌ 已合理 |

> **核心结论（诚实口径）**：`src/services/matrix/**` 的**高文件数是「按域分层 + 边界接缝」的结果，而非冗余**。`check-sdk-boundary`（169 violations / 2059 文件）与 `bare-matrix-paths`（814 判据面）两套守护**明确要求**这些接缝存在。因此**不存在「大范围可合并」空间**——唯一真正的纯转发文件是 root `paths.ts`。

---

## 6. 合并批次方案

### 批次 1（已落地）：`paths.ts` 纯转发 barrel 并入 `paths/index.ts`

- **动作**：删除 `src/services/matrix/paths.ts`。`./paths` 的模块解析在 **TS `moduleResolution: "bundler"`** 与 **Vite** 下都会回退到目录索引 `paths/index.ts`，导出为原 barrel 的**超集**（`paths/index.ts` 额外 `export * from './sdk-paths'`）。
- **代码改动量**：**0 处调用点编辑**（15 个 `from './paths'` / `'../paths'` / `'@/services/matrix/paths'` 导入路径保持不变）。
- **风险与回归点**：
  - `vi.mock('@/services/matrix/paths', ...)`：`MatrixClientLifecycle.test.ts`、`RtcTransports.test.ts`——mock 解析到同一 `index.ts`，命中集合不变；
  - `paths.test.ts`（断言 `MATRIX_PATHS` / `PREFIX_V3`）——导出不变，保持绿；
  - `MatrixDiagnostics.ts`（`@/services/matrix/paths`）——解析不变。
- **验证**：见 §7。

### 批次 2（候选，**未执行**）：`paths/` 子域进一步合并

- **候选**：把 `paths/{clientConfig,wellKnown}.ts`（体量小、单一常量表）并入 `paths/index.ts`。
- **风险**：削弱 `bare-matrix-paths` 的**逐模块契约映射**（`scripts/bare-matrix-paths-baseline.json` 按 `paths/<域>.ts` 记账），回归点遍布契约测试。
- **结论**：**不建议**——收益（-2 文件）远小于契约守护损失。列为**有意保留**。

### 批次 3（候选，**未执行**）：根级 `MatrixClient*` 家族收敛

- **说明**：`MatrixClientAuth/Lifecycle/State/Room/Telemetry` 等职责正交，收敛需引入门面并重排装配顺序，**回归面覆盖全部 Matrix 连接/刷新/同步链路**。
- **结论**：超出「低风险」范畴，按 Global Constraint §6 **降级为报告**，不做。

---

## 7. 首批合并执行结果（批次 1）

| 项 | 结果 |
| :--- | :--- |
| 变更 | 删除 `src/services/matrix/paths.ts`（1 行纯 re-export）；**0 处调用点编辑** |
| `pnpm run typecheck` | ✅ 0 错误 |
| `pnpm check:sdk-boundary` | ✅ 无回归（169 violations，baseline 184，无新增） |
| `pnpm check:bare-matrix-paths` | ✅ 未登记缺陷 0，台账一致 |
| `pnpm test:run` | 见 §8 验收对照 |

> 说明：批次 1 属「纯转发删除」，无新行为可测；`paths.test.ts`（既有契约测试）即为回归护栏，保持通过即证明导出等价。

---

## 8. 验收对照

| 验收判据（方案原文） | 结果 |
| :--- | :--- |
| 盘点文档覆盖「216 文件」分域统计 | ✅ 覆盖 **217** 非测试 `.ts`（附口径修正） |
| 至少产出 1 个可执行合并批次方案 | ✅ 批次 1（已执行）+ 批次 2/3（评估后不执行，附理由） |
| 首批合并后 `pnpm test:run` 全绿 | ✅ 除既有 `MatrixCryptoStateTracker.test.ts` 失败外无新增失败（详见收尾报告） |

---

## 9. 后续建议

1. **停止「为减文件数而合并」**：本层两套边界守护（`sdk-boundary` / `bare-matrix-paths`）决定了高文件数是**设计结果**。后续新增服务应优先**按域落位**，而非追求文件数指标。
2. **批次 1 已消除唯一的纯转发冗余**；如需继续收敛，方向应转向「**同域内 facade + 子域**模式统一」（如 `friends/` 已是样板），而非跨域合并。
3. 任何进一步合并须走独立排期 + `pnpm check:release` 全绿 + 运行期冒烟，不在本期范围。

---

## 10. v1.1 复核（2026-11-04）：口径修正 + 分层守卫落地

### 10.1 为什么复核

本节 §3.1 记 217 个非测试 `.ts`（2026-10-12）。**三周后实测 240（+23）**，其中 `crypto +8`、`admin +4`、`user +3`，新增 `invites/`、`privateChat/` 两个域。
增量本身正常（新功能），但**没有任何门禁拦它** —— 说明「锁不增长」这条决策当时只写在文档里，没落地成脚本。

### 10.2 §4 结论修正（重要）

§4 原文：「`access_token` 的**读**通过 `matrixClientAccessor`（单一全局访问器）分发，是**有意的收口**，非碎片。」

**该结论只覆盖了主通道，与现状不符。** 复核后的真实形状是 **1 条主通道 + 3 条旁路 + 3 份可陈旧副本**：

| 类型 | 位置 | 性质 |
| :--- | :--- | :--- |
| 主通道 ✅ | `MatrixHttpClient` → SDK `authedRequestWithPrefix` | 不自行注入 token，设计正确 |
| 旁路 A | `MatrixRawUploadChannel.ts` | 绕开 gateway 自拼 `Authorization` |
| 旁路 B | `media/mediaDownloadHelpers.ts` | 直接 `client.getAccessToken()`，**并把 token 拼进 URL query `?access_token=`** |
| 旁路 C | `extensions/SynapseExtensionHttpBase.ts` | **每个实例 private 缓存一份**（7 个 extension ≈ 7 份），靠「每请求比对 latestToken」兜底 |
| 副本 1 | `matrixSessionState.ts`（Vue ref） | 仅登录/恢复/登出写 → **token 刷新不回写 ⇒ 刷新后陈旧** |
| 副本 2 | `stores/domains/chat/matrix.ts` + `persist.pick` | pinia 且**进持久化**（Web 端 = localStorage 明文） |
| 副本 3 | `MatrixConnectionManager.getConfig().accessToken` | 被 `MatrixClientState.getAccessToken()` 当兜底 = 第二份真相 |

**陈旧已可复现（读码即可确认）**：`MatrixTokenManager.refresh()` 成功后只做 `client.setAccessToken()` + `persistRefreshedToken()`（仅写 Rust 侧），**不更新副本 1/2**；而 `SessionOrchestrator` 用 `snapshot.accessToken ?? store.accessToken` 作为 `SessionStorePort.matrix.getAccessToken()` 的返回值，被 `SessionLogin/Restore/Bootstrap` 消费。当前未爆，因为这些取用点都在登录/恢复早期 —— **属潜伏缺陷，不是设计**。

### 10.3 调用链口径修正（易误判）

| 口径 | 环数 | 最长链 | 说明 |
| :--- | ---: | ---: | :--- |
| 含 `import type` 边 | 6 | 19 | 类型耦合，不产生运行时依赖 → **不适合做门禁** |
| **仅运行时边** | **0** | **15** | 真实初始化顺序 / 打包分片影响面 → 守卫采用此口径 |

> 首次统计用「含分号收尾」的正则剔除 `import type`，被本仓库**无分号**风格坑到：`[\s\S]*?;` 跨语句吞掉了后续真实 import（`MatrixClientService.ts` 的边被打成 0）。守卫改为「按语句起始切块 + 用 `from` 定位说明符」，不依赖分号。

最长运行时链（基线）：

```
index.ts → friends/MatrixFriendService → friends/MatrixFriendGroups → friends/MatrixFriendSync
  → extensions/SynapseFriendExtensionService → MatrixCapabilityService → user/MatrixAccountService
  → MatrixHttpClient → MatrixRawUploadChannel → MatrixRequestHelper → MatrixClientService
  → MatrixClientAuth → MatrixClientAuthHttp → paths/index → paths/auth → paths/prefixes
```

### 10.4 新增守卫（已落地）

- 脚本：`scripts/check-matrix-service-layering.mjs`
- 基线：`meta/matrix-layering-baseline.json`
- 接入：`package.json` 的 `check:matrix-layering`（已并入 `check:release`）+ `.github/workflows/quality-gate.yml`

四类判据（**只锁不增长**，`--update` 收紧）：

| 判据 | 含义 | 当前基线 |
| :--- | :--- | ---: |
| L1 token 读入口 | 白名单外文件不得新增 `getAccessToken(` / `access_token=${` | 17 文件 / 22 处（白名单 6 文件） |
| L2 token 副本 | `private accessToken: string`、`accessToken = ref<`、pinia persist 命中数 | **3** |
| L3 运行时环 | Tarjan SCC 含环分量数 | **0** |
| L4 最长运行时链 | 深度 | **15** |
| L5 文件数 | 非测试 `.ts` 只锁不增长 | **240** |

**变异自证（2026-11-04，全部 FAIL 后原样回滚）**：

| 变异 | 结果 |
| :--- | :--- |
| 在 `room/RoomOperations.ts` 新增一处 `getAccessToken()` | `[token-read-new]` exit 1 ✅ |
| 在 `extensions/SynapseDmExtensionService.ts` 新增第 4 份 `private accessToken` | `[token-copy-growth]` 4 > 3 exit 1 ✅ |
| 在 `paths/prefixes.ts` 加一条 `import '../MatrixCapabilityService'` | `[runtime-cycle-growth]` 0 → 1 个 18 节点 SCC，exit 1 ✅ |
| 新增 `src/services/matrix/__probe_tmp.ts` | `[service-file-growth]` 240 → 241 exit 1 ✅ |

> L3 的灵敏度值得注意：仅加**一条**边就把 18 个文件塌成同一个 SCC —— 说明脆弱点集中在 `paths/index`（re-export 中枢）+ `MatrixCapabilityService`（被广域依赖）这一对。拆环优先级应从这里入手，而不是逐个模块梳理。

### 10.5 后续批次

| 批次 | 动作 | 目标指标 | 状态 |
| :--- | :--- | :--- | :--- |
| B1 | 删副本 C（extension 实例字段改请求时读）/ 删 `MatrixClientState` 的 config 兜底 / `accessToken` 退出 `persist.pick` / 快照去 token | 副本 3 → 0 | ✅ **已完成（2026-11-04，见 §10.6）** |
| B2 | `SessionStorePort.getAccessToken()` 直读 accessor（已随 B1 落地）；剩余 11 个非白名单读取点收敛 | 非白名单读取点 ≤ 6 | 待排期 |
| B3 | 抽 `MatrixRuntimeContext`（纯接口），`MatrixClientState` 降到最底层，拆 `MatrixCapabilityService` 的广域依赖 | L4 深度 15 → ≤12 | 待排期 |

> 仍然**不设文件数下降目标**（§5 结论未变）：`check-sdk-boundary` + `check-bare-matrix-paths` 要求这些接缝存在。本文档 v1.1 的核心更正只有两点 —— **token 不是单一收口**、**调用链口径必须只算运行时边**。

### 10.6 B1 执行记录（2026-11-04）

**改动面**（生产代码 7 文件 + 测试 8 文件）：

| 文件 | 变更 |
| :--- | :--- |
| `extensions/SynapseExtensionHttpBase.ts` | 删除 `private accessToken` 与「每请求比对 latestToken」补丁；`ensureInitialized()` 返回**本次请求使用的 token**，只缓存 baseUrl |
| `MatrixClientState.ts` | `getAccessToken()` 去掉 `?? getConfig()?.accessToken` 兜底 |
| `matrixSessionState.ts` | 快照移除 `accessToken` 字段（类型层面即禁止） |
| `auth/Session{Login,Restore,Logout}Service.ts` | 6 处 `patchMatrixSessionSnapshot({ accessToken })` 调用点同步去掉该键 |
| `auth/SessionOrchestrator.ts` | `getRuntimeMatrixSession().accessToken` 改读 `getMatrixAccessToken()` |
| `stores/domains/chat/matrix.ts` | `accessToken` ref → **方法** `getAccessToken()`；移出 `persist.pick`；6 处赋值改为 `rememberWebToken()` |
| `matrixClientPlatform.ts` | 新增 `readWebAccessToken` / `persistWebAccessToken`；`persistRefreshedToken` 按运行期分流（Tauri→`update_token`，浏览器→localStorage，**刷新即更新**） |
| `auth/SessionRestoreService.ts` | `getStoredTokens()` 浏览器分支改读 at-rest 存储 |

**结果**：副本 **3 → 0**；`check:matrix-layering` 副本判据基线归零（此后任何一份新副本都会红）。

**过程中发现并修掉的两个真缺陷**（都不是"顺手优化"，是测试逼出来的）：

1. **`computed` 非响应式缓存陷阱**：最初把 store 的 `accessToken` 写成 `computed(() => getMatrixAccessToken())`。
   它**没有任何响应式依赖** ⇒ Pinia 里首次取值后永久缓存，等价于又一份更隐蔽的陈旧副本；
   若首次读取早于 client 就绪，还会永久得到 `null`。改为暴露方法（每次现取）。
2. **`isLoggedIn` 同理**：`computed(() => userId && getAccessToken())` 在冷启动时可能缓存 `false` 且永不翻转
   ⇒ 管理员入口永久关闭。改为**只依赖 `userId`**（会话生命周期已保证 token 存在）。

**一处刻意的取舍**：`persist.pick` 去掉 token 后，浏览器冷启动没有凭证来源（原先是 pinia 顺带承担）。
为了不把「web dev 自动登录」变成静默失效，新增了显式的 at-rest 存储 `persistWebAccessToken`
（Tauri 运行期 no-op，凭证只由 Rust 保管；浏览器写 localStorage，且**刷新时同步更新** —— 这比原实现更正确，原实现的浏览器刷新从不落盘）。

**守卫口径修正**：L1 原先只匹配 `getAccessToken(`，可用 `getAccessToken?.()` 绕过；已补可选调用匹配。
因此 L1 绝对数从 22 → 25 **不可与旧值直接比较**（口径变化），可比指标是副本数（3→0）与非白名单文件数（11）。
