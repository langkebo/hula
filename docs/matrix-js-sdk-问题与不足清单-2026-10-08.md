# matrix-js-sdk（TJG 定制 fork）问题与不足清单

- 日期：2026-10-08
- 被检对象：`matrix-js-sdk/`（仓库 HEAD `18ad862e`，分支 `develop`，2026-10-08 07:38）
- **实际发布基线**：Tjg 锁定的 tarball `640cc444`（`40.2.0-langkebo.5`，pinned 2026-09-20）
- 方法：静态代码检索 + 量化统计；每条结论附文件行号或可复现计数

> 阅读提示：**仓库 HEAD 与 Tjg 实际构建的 tarball 已相差 149 个 commit**。
> 下文「已在新版修复」标注表示该问题在 HEAD 上已解决，但 Tjg 当前发布版本仍然带着它。

---

## 0. 结论速览

| #   | 问题                                                      | 严重度   | 现状                             |
| --- | --------------------------------------------------------- | -------- | -------------------------------- |
| 1   | 幻影类型声明：声明了但运行时不存在                        | **高**   | pinned 版 8/152；HEAD 已删 69 条 |
| 2   | exports 不暴露 `./src/*`，逼迫消费者深度导入 sibling 源码 | **高**   | 未修                             |
| 3   | 契约产物四套互不一致的计数（1159/49/46/39）               | **高**   | 未修                             |
| 4   | 私有语义污染标准前缀（约 150 条）                         | **中高** | 部分迁移                         |
| 5   | 文档与代码系统性漂移（manager 数 4 个值、过期 2.5 个月）  | **中高** | 恶化中                           |
| 6   | `client.ts` 上帝对象（4398 行 / 323 public 方法）         | **中**   | 未修                             |
| 7   | 152 条类型声明与 `extendMatrixClient()` 双写手工维护      | **中**   | 未修                             |
| 8   | 死模块与重复 manager 家族                                 | **中**   | 部分                             |
| 9   | 类型侵蚀：189 `as unknown as` / 97 `eslint-disable`       | **中**   | 未修                             |
| 10  | 弃用积压 95 处，58 处集中在 2 个文件                      | **中**   | 停滞                             |
| 11  | 能力探针 fallback 策略不一致 + 人工核对流程               | **中**   | 未修                             |
| 12  | 双 Token 刷新机制、withRetry 深度计数补丁                 | **低中** | 设计折中                         |

---

## 1. 幻影类型声明（最严重）

### 现象

`src/matrix-client-extensions.ts` 用 `export interface MatrixClientExtensionMethods` 手工声明
所有通过 `extendMatrixClient()` 挂到 `MatrixClient` 上的方法。**其中一部分只有声明，没有任何运行时实现。**

### 量化（针对 Tjg 实际安装的 pinned tarball `640cc444`）

```
MatrixClientExtensionMethods 声明总数 : 152
声明了但全包 src/ 无任何运行时实现    :   8
```

| 幻影方法                          | Tjg 是否在调用 | 调用点                          |
| --------------------------------- | -------------- | ------------------------------- |
| `setUserPowerLevel`               | ✅ **是**      | `room/RoomOperations.ts:497`    |
| `getRoomStateEvent`               | ✅ **是**      | `admin/RetentionService.ts:90`  |
| `oidcUserInfo`                    | ✅ **是**      | `auth/MatrixOidcService.ts:178` |
| `addPushRule`                     | 否             | —                               |
| `deleteMultipleDevices`           | 否             | —                               |
| `getMediaApiUrl`                  | 否             | —                               |
| `getVerificationRequestsToDevice` | 否             | —                               |
| `setDeviceName`                   | 否             | —                               |

### 影响

三个被真实调用的幻影方法中：

- **`setUserPowerLevel` 是活跃的用户可见缺陷。** Tjg 传入的是
  `(userId, roomId, powerLevel)`，而 SDK 声明的签名是 `(roomId, userId, powerLevel)`——
  **实参顺序也反了**。调用链：右键菜单 → `groupStore.addAdmin` → 该方法 →
  `TypeError: client.setUserPowerLevel is not a function`。
- `getRoomStateEvent`、`oidcUserInfo` 有 try/catch 兜底，分别表现为「房间保留策略读取失败」
  与「OIDC 用户信息恒为 null」。

### SDK 侧的修复现状

HEAD 上已有提交 `a1bd28464 fix(types): 删 69 条「声明了但运行时不存在」的残留声明 + 接线最后 2 个模块 + 修 11 处真雷`
——说明**这是 SDK 团队已知并已大规模处理的一类缺陷**，只是 Tjg 的 pin 早于该修复。
同类提交还有 `c7793ad5b`（移除 oidc 影子实现）、`06a68e423`（删 16 处假声明）、
`344d92784`（删 lifecycle 的 exit/terminate/reset/prepare）。

### 根因

`extendMatrixClient()` 通过 `MatrixClient.prototype.xxx = ...` 在运行时挂方法，
TypeScript 无法从原型赋值推断类型，因此必须**手工**在 `matrix-client-extensions.ts`
再声明一遍。两处之间没有任何自动校验，**类型系统无法发现漂移**，只能靠人。

---

## 2. exports 不暴露 `./src/*`，逼迫消费者深度导入

### 现象

SDK `package.json` 的 `exports` 有 50 个子路径入口，但**不包含**任何 `./src/*` 或
`__generated__` 子路径：

```
exports keys                            : 50
暴露 src/__generated__ 的子路径          : NONE
```

消费者（Tjg）需要用到生成的 route-table 常量，只能绕过 package exports，写**相对路径**：

```ts
// Tjg/src/services/matrix/paths/sdk-paths.ts:12-15
import { BURN_AFTER_READ_ROUTES } from '../../../../../matrix-js-sdk/src/burn-after-read/__generated__/route-table'
import { FRIEND_ROUTES } from '../../../../../matrix-js-sdk/src/friend/__generated__/route-table'
import { ROOM_ROUTES } from '../../../../../matrix-js-sdk/src/room/__generated__/route-table'
import { WIDGET_ROUTES } from '../../../../../matrix-js-sdk/src/widget/__generated__/route-table'
```

### 影响（两个，都很严重）

**影响 A：干净检出无法构建。**
该路径 `../../../../..` 从
`Tjg/src/services/matrix/paths/` 出发解析到 `/Users/ljf/Desktop/hu_ts/matrix-js-sdk/src/...`，
即**工作区里的 sibling 仓库**。而 Tjg 的 `package.json` 声明的是
`"matrix-js-sdk": "file:vendor/matrix-js-sdk.tgz"`，且 Vite/tsconfig 都没有对应的 alias
或 path mapping。因此**只检出 Tjg 一个仓库时这 4 行无法解析**——
与 `Tjg/CLAUDE.md`「Day-to-day frontend work only needs this repo plus a synapse-rust backend」直接矛盾。

**影响 B：同一次构建里混入了两个版本的 SDK。**

| 来源                                   | 解析目标                                    | commit     | 用途           |
| -------------------------------------- | ------------------------------------------- | ---------- | -------------- |
| `import ... from 'matrix-js-sdk'`      | `Tjg/node_modules/matrix-js-sdk`（tarball） | `640cc444` | 全部运行时行为 |
| `../../../../../matrix-js-sdk/src/...` | 工作区 sibling 仓库                         | `18ad862e` | 4 张契约路由表 |

两者已经不一致，实测同一张表条数都不同：

| 模块                               | sibling 仓库 | pinned tarball |
| ---------------------------------- | -----------: | -------------: |
| `room/__generated__/route-table`   |          100 |            103 |
| `friend/__generated__/route-table` |           66 |             66 |
| `widget/__generated__/route-table` |           19 |             19 |

即：Tjg 用 A 版本的路径常量去校验 B 版本的 HTTP 客户端行为。

### 建议

SDK 侧在 `exports` 增加 `"./src/*": "./src/*.ts"` 或专门的
`"./contract": "./src/contract/index.js"` 出口；或由 SDK 导出一个聚合的
`ROUTE_TABLES` 常量，消费者不再逐模块深度导入。

---

## 3. 契约产物四套互不一致的计数

同一个「后端 API 面」在 SDK 里有四种表达，数量各不相同：

| 产物             | 位置                                                  |                           数量 |
| ---------------- | ----------------------------------------------------- | -----------------------------: |
| 全量路由清单     | `docs/api-contract/generated/route-manifest.all.json` |                **1159** 条路由 |
| per-module 清单  | `docs/api-contract/generated/modules/*.json`          |                  **49** 个模块 |
| 生成目录         | `src/<module>/__generated__/`                         |                  **46** 个目录 |
| 实际 route-table | `src/<module>/__generated__/route-table.ts`           | **39** 个文件，合计 **853** 条 |

差异来源（已核实）：

- 7 个模块只有 `dto.ts`，没有 `route-table.ts`：
  `admin`、`app-service`、`dm`、`federation`、`feature-flags`、`key-rotation`、`reactions`。
- route-table 是「既有条目 ∪ ledger ∪ `ROUTE_CONTRACT.md`」去重后的结果，
  与 manifest 的口径不同（853 vs 1159）。

### 影响

四套计数意味着**没有任何一个数字可以当作真相**。开发者在排查「某端点 SDK 覆盖了吗」时，
需要同时查 4 个地方并且知道它们口径不同。文档里也因此在漂移
（`CONTRACT_INDEX.md` 写 ~950 / 48 文档，且 friend 57→65、room 132→99、admin 157→184、
voice 2→30、key-backup 99→66 全部对不上）。

---

## 4. 私有语义污染标准 Matrix 前缀

SDK 的 `CLAUDE.md:215` 自定规则 9：「私有端点必须走 `/_matrix/vendor/v1`，
不要污染 `/_matrix/client/{r0,v1,v3}`，由 `check-vendor-prefix-migration.mjs` 强制」。
但迁移远未完成。

### 量化

| 命名空间                             |  条数 | 性质                     |
| ------------------------------------ | ----: | ------------------------ |
| `/_matrix/vendor/v1`                 |    68 | ✅ 合规的私有前缀        |
| `/_synapse/admin/**`                 |   295 | Synapse 系私有（可接受） |
| 其他 `/_synapse/*`                   |    45 | 私有                     |
| **私有语义但挂在 `/_matrix/client/v1 | v3`** | **约 150**               | ❌ 违规 |

违规明细（挂在标准前缀上的私有路由）：

| 能力         | 条数 | 实际前缀                  |
| ------------ | ---: | ------------------------- |
| Space REST   |   48 | `/_matrix/client/v1       | v3/spaces/*`（标准只有 `m.space`state +`/hierarchy`）      |
| 好友         |   36 | `/_matrix/client/v1       | v3/friends/*`                                              |
| Thread REST  |   23 | `/_matrix/client/v1       | v3/.../threads/*`                                          |
| 语音         |   18 | `voice/*`                 |
| Widget REST  |   18 | `/_matrix/client/v1       | v3/widgets/*`（规范里只有 `m.widget` state + postMessage） |
| 房间摘要     |   17 | `rooms/{r}/summary*`      |
| 举报评分     |    7 | `rooms/{r}/report*`       |
| Sticky event |    3 | `rooms/{r}/sticky_events` |
| DM           |    2 | `rooms/{r}/dm`            |

### 影响

一个标准 Matrix 客户端如果按规范去猜这些路径，会命中 synapse-rust 的私有语义；
反之用这个 SDK 的客户端无法对接任何标准 homeserver。这是**双向的可移植性损失**。

---

## 5. 文档与代码的系统性漂移

### 5.1 同一个「manager 数量」有四个值

| 来源                                                                                          |                            值 |
| --------------------------------------------------------------------------------------------- | ----------------------------: |
| `src/manager-extensions/index.ts` `MANAGER_EXTENSION_MODULES`                                 |                        **98** |
| 同文件 `DEFAULT_CORE_EXTENSIONS`（全部 `: true`）                                             |                        **98** |
| `src/client-infra/manager-registry.ts` 的 `ManagerName` union（`CLAUDE.md:114` 自称「权威」） |                       **100** |
| `CLAUDE.md:114`                                                                               | 「101 keys as of 2026-10-05」 |
| `docs/api-contract/frontend-usage-matrix.md:5`                                                |   「114 registered managers」 |

### 5.2 其他可量化的漂移

| 项                        | 文档说                                                                 | 实际                                                                                            |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| package exports 条目      | 52                                                                     | **50**                                                                                          |
| `ModuleManager` 是否存在  | `docs/api-contract/module.md:21`：「SDK 并没有单独的 `ModuleManager`」 | **存在**：`src/module/index.ts:444` `MatrixClient.prototype.getModuleManager = ...`             |
| Tjg 侧 augmentations 行数 | `frontend-usage-matrix.md:78`：1921 行                                 | Tjg 现状 1484 行                                                                                |
| Tjg 目录名                | `frontend-usage-matrix.md` 全篇写 `hula/src/`                          | 2026-08 已改名 `Tjg/`                                                                           |
| 该文档生成日期            | `Generated: 2026-07-21`                                                | 已过期 **2.5 个月**，且结论（`./manager-extensions`、`./voice`、`./friend` 零使用）现在全部为假 |

### 影响

`frontend-usage-matrix.md` 的用途正是「Tjg 用了 SDK 的哪些能力」——
这是最需要准确的一份文档，而它已经全面失效。任何按它做决策的人都会得出相反结论。

---

## 6. `client.ts` 仍是巨型上帝对象

SDK 的 `CLAUDE.md:103` 声称「MatrixClient decomposed into `src/client-*.ts` modules」。实测：

| 文件                             |     行数 |                  public 方法数 |
| -------------------------------- | -------: | -----------------------------: |
| `src/client.ts`                  | **4398** |                        **323** |
| `src/models/room.ts`             |     4234 |                              — |
| `src/web-rtc/call.ts`            |     3125 |                              — |
| `src/rust-crypto/rust-crypto.ts` |     2569 |                              — |
| `src/sync.ts`                    |     2076 |                              — |
| `src/room/RoomManager.ts`        |     1474 |                         **64** |
| `src/room-summary/index.ts`      |     1096 | 21（+8 个子 manager，合计 97） |
| `src/admin/index.ts`             |      869 |   门面（子 manager 合计 ~232） |
| `src/managers/base-manager.ts`   |      946 |                              — |

`src/` 非测试非生成代码合计 **132875 行 / 462 个文件**。

### 影响

- 分解只做到了「把实现挪走」（`src/client-*.ts` 49 个文件），但**接口面没有收敛**——
  `MatrixClient` 仍有 323 个 public 方法，仍是所有 manager 的分发中心。
- `room-summary` 与 `admin` 两个 manager 各自聚合了 8 个和 19 个子 manager，
  是「门面套门面」，调用方需要判断该用门面方法还是子 manager（Tjg 就在这一点上出了 RoomSummary 方法名漂移）。

---

## 7. 类型声明与实现的双写手工维护

见 §1 根因。量化：

| 项                                                  |               值 |
| --------------------------------------------------- | ---------------: |
| `matrix-client-extensions.ts` 手工声明的方法        | 152（pinned 版） |
| 分散在 ~98 个扩展模块的 `extendMatrixClient()` 实现 |           同量级 |
| 两者之间的自动一致性校验                            |           **无** |

SDK 的 `CLAUDE.md` 对该文件的说明是
「每个通过 extendMatrixClient 添加的方法都需要在这里声明」——
这是一个**纯人工的双写协议**，且已经证明会漂移（见 §1）。

---

## 8. 死模块与重复 manager 家族

### 8.1 死模块

`src/ai/index.ts`（`AIModule`，248 行，实现 MCP JSON-RPC over `http://127.0.0.1:3333/mcp`）
**未在 `manager-extensions` 注册、也未挂到 `MatrixClient`**。
`docs/api-contract/frontend-usage-matrix.md:7` 记录 `ai-connection` 已于 2026-09-13 随后端下线移除，
但代码仍在仓库里。

### 8.2 重复/重叠的 manager 家族

| 家族     | 成员                                                                                                           | 问题                               |
| -------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Widget   | `src/widget/`（`getWidgetManager`）与 `src/widgets/`（`getWidgetsManager`）                                    | 两套并存，后者自述为「历史兼容层」 |
| Thread   | `src/thread/`（`ThreadManager`）、`src/threading/`（`ThreadingManager`）、`src/timeline/`（`TimelineManager`） | 三者方法面重叠                     |
| 房间能力 | `RoomManager.getRoomCapabilities` 与 `RoomSummaryManager` 的多个 room 级方法                                   | 同一后端路由多入口                 |

### 影响

调用方无法从名字判断该用哪个。Tjg 就同时用了 `getWidgetManager` 和 `getWidgetsManager`
（在 `sdk-compat.ts` 中做类型派生）。

---

## 9. 类型侵蚀

| 指标               |    数量 |
| ------------------ | ------: |
| `as unknown as`    | **189** |
| `eslint-disable`   |  **97** |
| `as any`           |      14 |
| `@ts-expect-error` |       5 |
| `@ts-ignore`       |       3 |

`as unknown as` 是**完全关闭类型检查**的强转（比 `as any` 更彻底地绕过结构检查）。
189 处意味着有大量地方 TypeScript 已经无法验证。这与 §1、§7 的根因同源：
`extendMatrixClient()` 的原型挂载模式让类型系统失效，只能靠强转和手工声明补。

值得注意的是 `BaseManager` 里也有这种模式：

```ts
// src/state-send/index.ts:64
const clientInternals = this.internalClient as unknown as ClientInternals
```

---

## 10. 弃用积压

95 处 `@deprecated`，但分布极不均匀：

| 文件                         | `@deprecated` 数 |
| ---------------------------- | ---------------: |
| `src/space/index.ts`         |           **29** |
| `src/dm/index.ts`            |           **29** |
| `src/secure-backup/index.ts` |                5 |
| `src/voice/index.ts`         |                4 |
| 其余 22 处散布               |                — |

**58/95（61%）集中在 `space` 和 `dm` 两个文件**，且这两个文件同时又是 §4 里
「私有语义污染标准前缀」的重灾区。这更像是两次**半途而废的 API 迁移**：
新方法加上了，旧方法标了 `@deprecated` 但没有删除也没有迁移调用方。

对照：`TODO` / `FIXME` / `HACK` 标记均为 **0**——说明该仓库不使用这些标记追踪债务，
债务只存在于 `@deprecated` 与 commit message 里，缺乏统一的待办视图。

---

## 11. 能力探针的 fallback 策略不一致

`src/server-capabilities/index.ts:149` 的
`doesClientAdvertiseSynapseRustFeature(client, feature, fallback, onError)` 允许每个调用点
自己决定「后端没声明该能力时假设它可用还是一定不可用」。实测各调用点：

| 能力             | fallback        | 位置                                             |
| ---------------- | --------------- | ------------------------------------------------ |
| SlidingSync      | `true`（乐观）  | `room/RoomManager.ts:1441`                       |
| Friends          | `true`（乐观）  | `friend/sub-managers/friend-list-manager.ts:111` |
| Voice            | `false`（保守） | `voice/index.ts:290`                             |
| Widget           | `false`         | `widgets/index.ts:201`                           |
| DehydratedDevice | `false`         | `dehydrated-device/index.ts:68`                  |
| AccountStatus    | `false`         | `account-status/index.ts:92`                     |

### 影响

- **同一类判断有两种相反默认值**，取决于能力。乐观默认会在后端缺路由时打出 404；
  保守默认会让后端明明支持的功能不可用。
- `CLAUDE.md:216` 描述的正确性保证方式是「**verify the route exists in
  `synapse-rust/docs/synapse-rust/ROUTE_CONTRACT.md`** 」——即**人工翻文档**。
  既然契约链已经把路由清单机器可读化了（`route-manifest.all.json`），
  fallback 完全可以由生成物自动推导，而不是靠人核对。

---

## 12. 传输与重试的设计折中（影响较低，但值得记录）

| 项                   | 位置                                                                                  | 问题                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 双 Token 刷新        | `src/http-api/fetch.ts:64` 的 SDK 内建 `TokenRefresher` + 宿主侧 `MatrixTokenManager` | 两套独立机制并存，职责边界不清                                                                                   |
| `withRetry` 深度计数 | `src/managers/base-manager.ts:197`                                                    | 用「深度计数」防止嵌套重试导致的双重计数——这是对「重试逻辑可重入」这一设计问题的补丁，而非修复                   |
| 429 重试豁免逻辑     | `base-manager.ts:553, 586`                                                            | 「同一闭包内已有写成功则拒绝限流重试」——正确但复杂，规则写在 `CLAUDE.md` 而非类型/测试约束里                     |
| 前缀自动拼接         | SDK 默认用 `ClientPrefix.V3` 拼接 path                                                | 消费者若传完整前缀会导致 URL 翻倍，SDK 未提供防御；Tjg 只能自建 `stripMatrixPrefix()`（11 项前缀表循环剥离）补丁 |

---

## 13. 值得肯定的部分（避免只列问题）

为避免清单失衡，以下是该 fork 相对上游**确实更好**的地方：

1. **契约驱动代码生成**：route ledger → codegen → literal-typed 路径，
   拼错即编译错误（`src/friend/paths.ts` 的 `PathAssert` 是最典型的例子）。
   20+ 个 `quality:*` 门禁在跑。
2. **存储有界化**：`store/ttl.ts`（逐 key TTL）、`store/capacity.ts`（LruMap 淘汰）、
   `store/pending-events-cipher.ts`（pending 队列 AES-GCM 加密）——上游都没有。
3. **Sliding Sync 定制**：`setInitialPos()`（重启增量 sync）与
   `isAbortLikeError()`（不再把 `fetch failed` 误判为 abort，避免断网忙循环）。
4. **入口安全**：`assertSecureBaseUrl()` 在 `createClient` 里强制 HTTPS。
5. **工程卫生**：`TODO`/`FIXME`/`HACK` 为 0，442 个 spec 文件（其中 39 个是生成的验收测试）。
6. **修复意愿强**：pin 之后 149 个 commit 里包含多个专门的「清幻影声明 / 修参数错位 /
   删死代码」提交——团队对自己的问题有清晰认知。

---

## 14. 优先级建议

| 优先级 | 动作                                                                                                    | 归属       |
| ------ | ------------------------------------------------------------------------------------------------------- | ---------- |
| **P0** | 清掉 pinned 版剩余 8 条幻影声明，或至少补 `setUserPowerLevel`/`getRoomStateEvent`/`oidcUserInfo` 的实现 | SDK        |
| **P0** | 在 `exports` 增加 `./src/*` 或聚合 `ROUTE_TABLES` 出口，消除消费者深度导入                              | SDK        |
| **P1** | 把能力探针 fallback 改为由 `route-manifest` 自动推导，取消人工核对                                      | SDK        |
| **P1** | 统一契约产物口径，让 1159/49/46/39 收敛为一个可解释的数字                                               | SDK        |
| **P1** | 给 `matrix-client-extensions.ts` 加自动校验：反射 `MatrixClient.prototype` 与声明比对                   | SDK        |
| **P2** | 删除 `src/ai` 死模块；收敛 `widget/widgets`、`thread/threading/timeline`                                | SDK        |
| **P2** | 重新生成 `frontend-usage-matrix.md`，修正 manager 数 / exports 数 / 目录名                              | SDK        |
| **P2** | 完成 `space`/`dm` 的 `@deprecated` 迁移收尾（58 处）                                                    | SDK        |
| **P3** | 推进 §4 的约 150 条标准前缀私有路由迁移                                                                 | SDK + 后端 |

---

## 15. 2026-10-08 修复记录与新增发现

### 15.1 本轮已修复（SDK 仓库，2 个 commit）

| commit      | 内容                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `6a9c0971f` | 新增 `matrix-js-sdk/contract` 聚合契约出口（39 模块 / 853 路由）+ `quality:contract-entrypoint` 双向门禁；新增 `quality:docs-counts` 文档数值门禁；新增 `docs/api-contract/contract-artifacts.md` 固定四个口径；删除死模块 `src/ai`；`ThreadingManager` 补 `@deprecated` 与方法级对照表 + 自动核对 spec；修正文档数值漂移（manager 101→100、exports 52→51、异步扩展 ~55→98）；`module.md` 事实纠正 |
| `e84016df8` | **修复主入口 ESM 运行时崩溃**（见 15.2）；`tsconfig` 开启 `isolatedModules` 作为该类缺陷的永久守卫                                                                                                                                                                                                                                                                                                 |

门禁状态：`quality:contracts` 全链 16 个门禁通过；`lint` 链除 §15.3 的既存 prettier 问题外全部通过；`tsc --noEmit --isolatedModules` 全绿。

### 15.2 新发现（P0）：SDK 主入口在 ESM 下完全无法加载 —— 已修复

`src/managers/cache-manager.ts` 曾这样再导出：

```ts
export { LRUCache, CacheConfig, CacheStats, CacheRegistry } from '../utils/lru-cache'
```

但 `CacheConfig` / `CacheStats` 是 `interface`（纯类型）。Babel 逐文件转换，**无法判断再导出的名字是不是类型**，
于是原样保留；编译产物 `lib/utils/lru-cache.js` 里没有这些绑定，任何 ESM 运行时加载到该模块即抛：

```
SyntaxError: The requested module '../utils/lru-cache.js'
does not provide an export named 'CacheConfig'
```

实测 `import('matrix-js-sdk')` 主入口直接复现，**365 个导出一个都拿不到** ——
即 develop 上的发布产物对任何 ESM 消费者都是坏的。

**时间线**：引入该行的是 `1c41a4bee`（2026-09-29）。Tjg 的 pin 停在 `640cc444`（2026-09-20），
**早于该 commit 9 天**，所以线上一直没暴露；只有在重新打包 tarball 时才会命中。
这正是 §15.4 所说「pin 落后 149 个 commit」的第一个具体代价。

修法：拆成 `export { LRUCache, CacheRegistry }` + `export type { CacheConfig, CacheStats }`，
并在 `tsconfig.json` 开启 `isolatedModules`。反向验证过：把原写法还原后 `tsc` 精确报
`TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'`。

> 注：同批扫描发现另外 72 处「疑似类型当值再导出」，逐一核对后确认**均为误报**
> —— 它们已经带了 `type` 修饰（如 `export { AuthManager, type RegisterFlow } from "./auth"`）。
> 真实缺陷只有 `cache-manager.ts` 一处。

### 15.3 新发现（中）：`pnpm lint` 在 HEAD 上本就失败

`lint:js` 的 prettier 检查在 HEAD 上就有 7 个文件不合规，其中仅 1 个是本轮改动引入（已修）：

```
artifacts/quality-gate-fingerprint-audit-2026-10-06.md
scripts/quality/check-coverage-critical-files.d.mts
scripts/quality/check-exports-docs.mjs
spec/unit/coverage-critical-files-gate.spec.ts
spec/unit/exports-docs-gate.spec.ts
spec/unit/large-file-changes-gate.spec.ts
spec/unit/msc-changes-gate.spec.ts
```

这 7 个文件在工作区中均**未被修改**，且 `git show HEAD:<file>` 的版本同样不合规 ——
即 `pnpm lint` 这条写在 CLAUDE.md 里的验收命令在 develop 上是红的。
修复只需 `prettier --write` 这 7 个文件；本轮刻意没有把无关重排混进契约改动的 diff。

### 15.4 新发现（重大）：Tjg 的 pin 落后 149 个 commit，且这 149 个 commit 含破坏性删除

Tjg pin 在 `640cc444`（2026-09-20），SDK `develop` HEAD 已是 `e84016df8`（2026-10-08）。

把 pin 刷到 HEAD 后，Tjg **立即出现 24 个 `vue-tsc` 类型错误**（已实测并随即回滚），
根因是这期间 SDK 删除了 Tjg 仍在用的公开面：

| SDK 侧变更                                                                                                                                                   | Tjg 受影响处                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 整模块删除 `matrix-js-sdk/key-verification`（commit `f91d71b8d` / `e095f4428`：删掉后端已拆除的服务端验证中继面）                                            | `sdk.ts:62`、`crypto/MatrixVerificationService.ts:4`  |
| 删除 `IScanQrCodeRequest` 导出                                                                                                                               | `crypto/MatrixVerificationService.ts:1`               |
| 把 `ReportHistoryResponse` 改名/移除                                                                                                                         | `moderation/MatrixEventReportService.ts:9`            |
| 移除 `EventReportManager.getReportHistory`                                                                                                                   | `moderation/MatrixEventReportService.ts:245`          |
| 移除 `oidcUserInfo`（幻影声明清理）                                                                                                                          | `auth/MatrixOidcService.ts:178`                       |
| 管理端 DTO 变更（`ServerStats` / `ServerStatus` / `UserRoomsResponse` / `BatchCreateUsersResponse` / `BatchDeactivateUsersRequest` / `AdminAccountDetails`） | `admin/ServerService.ts`、`admin/UserService.ts` 多处 |

结论：**刷新 pin 不是 drop-in 操作**，而是一次需要独立排期的 SDK 版本迁移。

### 15.5 处理方式：把契约出口回移到 pin 基线，Tjg 已激活且保持绿色

直接刷 pin 会连带给 Tjg 引入 24 个类型错误，因此改为**只回移契约出口这一项**：

| 步骤                                                                           | 结果                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 从 `640cc444` 开分支 `release/contract-entrypoint`                             | commit `901a80738`                                                                   |
| 该基线上重新生成聚合出口                                                       | 38 张表 / **835** 条路由（该基线含 `verification`、无 `moderation`）                 |
| 同批带上 `check-manager-codegen-coverage` 的聚合出口排除补丁                   | `manager-codegen` 保持基线的 37 covered / 12 waived，未洗白 `push_notification` 豁免 |
| 在该分支上构建打包                                                             | `sdk 40.2.0-langkebo.5 @ 901a80738`，sha256 `720dd891…`                              |
| Tjg 改走 `matrix-js-sdk/contract`（经唯一咽喉点 `@/services/matrix/sdk` 转发） | 4 处深度导入全部消除                                                                 |

Tjg 侧验收（全部通过）：

| 检查                                                | 结果                                                    |
| --------------------------------------------------- | ------------------------------------------------------- |
| `node scripts/verify-sdk-pin.mjs`                   | ok（pin = `901a80738`）                                 |
| `node scripts/check-sdk-boundary.mjs`               | OK，无新增越界                                          |
| `npx vue-tsc --noEmit`                              | **0 错误**（对比直刷 HEAD 的 24 个错误）                |
| `vitest run src/services/matrix/paths/__tests__/ …` | 28 文件 / 151 用例通过                                  |
| `vitest run src/services/matrix/`                   | 253 文件 / 3589 用例通过，与改动前同一签名              |
| 残留 `matrix-js-sdk/src/` 深度导入                  | 仅剩 `manualChunks.test.ts` 里的字符串字面量，非 import |

**149-commit 版本迁移仍是待办**（见 15.4 表格），但已与本次交付解耦：
等排期时把 pin 从 `901a80738` 移到 `develop` 并适配那 24 处即可。

### 15.6 附：回移基线自身的既存失败（与本轮改动无关）

在 `640cc444` 上未做任何改动时实测：

| 门禁                               | 结果                                                     |
| ---------------------------------- | -------------------------------------------------------- |
| `contract:check`                   | 失败（`generated/index.json` 与磁盘 drift）              |
| `quality:generated-dto-strictness` | 失败（`src/e2ee/__generated__/dto.ts` 的 baseline 漂移） |
| `quality:manager-codegen`          | 通过（37/12）                                            |

即该 pin 基线本身就有两个契约门禁是红的 —— 说明「pin 住的版本 = 绿的版本」这一假设不成立。
回移分支继承了这两个失败，未做处理（不属本轮范围，且改动它们会让回移分支偏离基线）。
