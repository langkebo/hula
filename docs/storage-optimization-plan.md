# 前端 storage 设置项优化方案

> 基于后端 synapse-rust 缓存机制分析 + 前端 Tjg storage 现状核验，制定前端 storage 设置项的完整优化方案。
> 生成日期：2026-08-13

---

## 一、问题分析

### 1.1 后端缓存机制（synapse-rust）

后端采用 **L1 内存 + L2 Redis 双层缓存**（`synapse-cache` crate，约 4530 行），实现清晰、统计完备：

| 维度 | 实现 |
|:---|:---|
| 缓存类型 | L1 `moka` 内存缓存（`max_capacity: 100_000`）+ L2 Redis（`deadpool-redis` 连接池） |
| TTL 策略 | **分级 TTL**（`CacheTtl`）：presence 60s → token 300s → room 900~1800s → profile 3600s |
| 淘汰策略 | moka `max_capacity` + `time_to_live` + `eviction_listener`；按数据类型分区（presence 高写入短 TTL 20K、sliding_sync 中 TTL、room_state 中 TTL） |
| 缓存形态 | 正向缓存 + **负缓存**（not_found 5min，防击穿）+ 批量缓存（batch key） |
| 失效机制 | `invalidation.rs`（417 行）事件驱动失效 |
| 降级保护 | `circuit_breaker.rs`（548 行）熔断器 + 降级度量 |

**统计指标**（后端已有，且粒度完整）：

```rust
// DegradationMetrics（lib.rs）
local_cache_hits / local_cache_misses     // L1 命中/未命中
redis_cache_hits / redis_cache_misses     // L2 命中/未命中
circuit_breaker_rejection / fallback / degraded_request
hit_rate()      // (local_hits + redis_hits) / total
degradation_rate()

// CacheStats（query_cache.rs）
hits / misses / evictions / total_entries / memory_usage_bytes / hit_rate
```

统计通过 **Prometheus `/metrics`** 端点暴露（`synapse_worker.rs:151`），并有 `/_synapse/admin/v1/telemetry/metrics` 管理端汇总。

### 1.2 前端 storage 现状

前端 storage 使用**广泛但零散、无统一管理**：

| 类型 | 使用规模 | 用途 | 管理现状 |
|:---|:---|:---|:---|
| localStorage | **60+ 键、47 个文件** | 设置偏好（`tjg-*` 40+ 键）、AI 数据（`ai_*`）、草稿、搜索历史、认证令牌 | 无命名规范、无容量管理、无过期清理 |
| sessionStorage | 少量 | OIDC state/code_verifier、AI provider 加密存储 | 合理（会话级） |
| IndexedDB | 9 个文件 | 搜索索引、crypto 状态、SDK 状态 | 无统一管理 |

**关键问题**：

1. **安全风险**：`REFRESH_TOKEN`（刷新令牌）明文存在 `localStorage`（`useLoginOrchestrator.ts`、`SessionLogoutService.ts`），可被 XSS 窃取，应迁入安全存储。
2. **无统一管理**：60+ 键分散在 47 文件，键名规范不统一（有 `tjg-` 前缀的、也有 `chat`/`group`/`ai_*` 无前缀的）。
3. **容量管理缺失**：除 `thumbnailCache.ts`（缩略图缓存，7 天 TTL + 500MB LRU）外，其余 storage **无容量预算、无过期清理**，长期累积易触达浏览器配额上限。
4. **无 storage 设置项**：`settingsSchema.ts` 的 `SETTINGS_TABS`（16 项）中**无「存储管理」**，用户无法查看/清理各类缓存占用。
5. **前后端指标未对齐**：后端有完整的命中率/淘汰/内存统计，前端缓存（缩略图、LRU、SDK 缓存）**无对应统计**，无法形成端到端的缓存观测。

---

## 二、优化策略

### 2.1 storage 类型分配策略（明确使用场景）

| 类型 | 使用场景 | 分配原则 | 典型数据 |
|:---|:---|:---|:---|
| **localStorage** | 同步读取的小型持久偏好 | 单键 < 5KB；总量 < 1MB | `tjg-*` 设置偏好、主题、语言 |
| **sessionStorage** | 会话级临时数据 | 关标签页即失效 | OIDC state、AI provider 会话密钥 |
| **IndexedDB** | 大容量、结构化、需索引的数据 | 单条可 > 10MB；总量 < 500MB | 搜索索引、加密数据、媒体/缩略图缓存 |
| **安全存储** | 敏感凭证 | 不进 localStorage | `REFRESH_TOKEN` → Tauri secure storage 或 IndexedDB + 加密 |

**迁移优先级**：
- **P0**：`REFRESH_TOKEN` 迁出 localStorage（安全，最高优先）
- **P1**：`ai_conversations`/`ai_characters`（可能是大对象）迁 IndexedDB
- **P1**：缩略图缓存元数据统一定义容量预算

### 2.2 数据采集方案（对齐后端指标）

设计一个**前端缓存统计模块**，指标与后端 `CacheStats`/`DegradationMetrics` 对齐：

```ts
interface FrontendCacheStats {
  hits: number          // 命中
  misses: number        // 未命中
  evictions: number     // 淘汰
  totalEntries: number  // 条目数
  memoryUsageBytes: number
  hitRate: number       // 命中率（对齐后端 hit_rate）
}
```

采集点：
1. **缩略图缓存**（`thumbnailCache`）：命中/未命中/淘汰/占用（复用现有 LRU + TTL 逻辑，补统计埋点）
2. **LRU 内存缓存**（`LRUCache`）：命中/未命中/容量
3. **SDK/搜索缓存**（IndexedDB）：条目数、占用字节

上报通道：复用现有 telemetry 管道（对齐后端 `/_synapse/admin/v1/telemetry/metrics`），在设置页「存储管理」可视化展示。

### 2.3 容量管理、过期清理、性能优化措施

1. **统一 storage 管理模块**：新建 `src/services/storage/StorageManager.ts`，收敛所有 storage 读写，强制命名规范（统一 `tjg.` 命名空间）、容量预算、TTL 元数据。
2. **「存储管理」设置项**：在 `settingsSchema.ts` 新增 `storage` Tab，展示：
   - 各类缓存占用（localStorage / IndexedDB / 缩略图缓存 / 搜索索引）
   - 命中率仪表（对齐后端指标）
   - 一键清理（按类别）+ 容量配置（缩略图缓存上限、搜索索引上限）
3. **统一过期清理**：抽离 `thumbnailCache` 已有的「TTL + LRU 淘汰」逻辑为通用 `ExpirableCache`，推广到搜索历史、AI 会话等易累积数据。
4. **性能优化**：大对象读写改 IndexedDB（避免同步阻塞主线程）；`localStorage` 读取做内存缓存（避免频繁同步 IO）。

### 2.4 matrix-js-sdk 集成可行性（本地 SDK 核验）

> 结论：**SDK 可贡献「清理」能力，是 storage 优化的重要一环；但不能提供容量统计与命中率统计，需前端自研。**

**SDK 已有的能力**（本地仓库 `matrix-js-sdk` 核验）：

| 能力 | 实现 | 文件 |
|:---|:---|:---|
| 多种 store | `IndexedDBStore`（持久化）/ `MemoryStore` / `StubStore`（默认） | `src/store/*` |
| crypto store | `IndexedDBCryptoStore` / `LocalStorageCryptoStore` / `MemoryCryptoStore` | `src/crypto/store/*` |
| 完整清理 | `clearClientStores(client, { cryptoDatabasePrefix })` —— `deleteDatabase` + `store.deleteAllData()` + rust-crypto store 删除 | `src/client-store-cleanup.ts` |

**前端现状（核验）**：

1. `workerClientHandlers.ts` / `MatrixConnectionManager.ts` 的 `clientOpts` **未显式配置 store** → SDK 主 store 回落到 `StubStore`（`client.ts:814` 的 `opts.store || new StubStore()`），即 room/sync 数据**不持久化**，每次冷启动重新 `/sync`。
2. rust-crypto store 使用 `RUST_SDK_STORE_PREFIX` 的 IndexedDB（加密密钥、设备、会话数据**持久化**）。
3. **退出登录（`SessionLogoutService`）只清 localStorage 的 token（`user`/`TOKEN`/`REFRESH_TOKEN`），未调用 `clearClientStores`** → rust-crypto IndexedDB 数据残留，切换账号时有密钥/设备数据泄漏与膨胀风险。

**集成方案**：

1. **P0：退出登录/切换账号时调用 `clearClientStores`**——清理 rust-crypto IndexedDB store，消除残留（安全 + 容量双重收益）。当前 `SessionLogoutService.logoutCurrentSession` 已 `matrixWorkerHost.terminate('logout')`，可在 terminate 后按 `cryptoDatabasePrefix` 清理。
2. **「存储管理」设置项增加「清理 SDK 数据」按钮**——调用 `clearClientStores` + 前端自有缓存清理，形成统一的「一键清理」。
3. **可选：store 持久化模式切换**——提供 `IndexedDBStore`（持久化 room 数据，减少冷启动 sync 流量）vs `StubStore`（当前）的配置项，在「存储管理」中暴露。

**SDK 不能提供、需前端自研**：

| 需求 | 实现方式 |
|:---|:---|
| 容量统计 | 浏览器 `navigator.storage.estimate()`（usage/quota） |
| 命中率统计 | 前端埋点（`FrontendCacheStats`，对齐后端 `CacheStats`） |
| 自有缓存治理 | 通用 `ExpirableCache`（缩略图/搜索历史/AI 数据，非 SDK 范围） |

---

## 三、预期效果

| 目标 | 当前 | 优化后 | 度量方式 |
|:---|:---|:---|:---|
| 敏感凭证安全 | REFRESH_TOKEN 明文 localStorage | 迁入安全存储 | 审计脚本检查 |
| SDK 数据残留 | 退出登录不清理 rust-crypto IndexedDB | 调用 `clearClientStores` 清理 | 切换账号后 IndexedDB 为空 |
| storage 配额风险 | 无容量预算，长期累积 | 分级预算 + 自动淘汰 | 设置页占用可视化 |
| 缓存可观测性 | 前端无缓存统计 | 命中率/占用对齐后端指标 | 命中率仪表 |
| 用户可控 | 无 storage 设置项 | 「存储管理」Tab（查看+清理+配置） | UI 验收 |
| 命名规范 | `chat`/`group`/`ai_*` 混杂 | 统一 `tjg.` 命名空间 | lint 守卫 |

**实施节奏**：
- **阶段 1（安全）**：REFRESH_TOKEN 迁移 + 退出登录集成 `clearClientStores` + 命名规范
- **阶段 2（统计）**：缓存统计模块 + 埋点对齐后端指标
- **阶段 3（UI）**：「存储管理」设置项 + 清理/配置能力
- **阶段 4（治理）**：通用 ExpirableCache 推广 + 配额守卫

---

## 四、两步走深化方案：SDK 封装后端缓存体系 → 前端集成

### 4.1 SDK store 与后端缓存的现状缺口

| 能力 | 后端 synapse-rust | matrix-js-sdk 现状 | 缺口 |
|:---|:---|:---|:---|
| 分级 TTL | `CacheTtl`（60s~3600s 分级） | **无 TTL** | ❌ 需补 |
| 统计指标 | `CacheStats`（hits/misses/evictions/memory/hit_rate） | **无统计** | ❌ 需补 |
| 容量管理 | `max_capacity: 100_000` + 按类型分区 | 局部限制（OOB 50、pending 100） | ⚠️ 需统一 |
| 清理 | `clearClientStores`（deleteDatabase + deleteAllData） | 已具备 | ✅ |

SDK 的 IndexedDB 表（`users`/`rooms`/`sync`/`oob_membership_events`/`to_device_queue`）与后端缓存的数据分类（user_profile / room_info / room_members）**天然对应**，为「对齐」提供了数据基础。

### 4.2 第一步：SDK 封装后端缓存体系

在本地 `matrix-js-sdk` 增强 store 层，对齐后端缓存治理范式（分级 TTL + 统计 + 容量）：

1. **分级 TTL 模块**（新增 `src/store/ttl.ts`，对齐后端 `CacheTtl`）：
   - room 数据 900s（对齐 room_events/messages 15min）、room 成员 900s（对齐 room_members）、用户 profile 3600s（对齐 user_profile 1h）
   - sync token / to_device_queue **持久不 TTL**（对齐后端 token 5min 的短 TTL 需按需调整，客户端 sync token 不应过期）
   - `IndexedDBStore` 支持 per-type TTL（元数据表 + 过期清理），复用后端「per-key deadline 表」思路

2. **统计指标模块**（新增 `src/store/stats.ts`，对齐后端 `CacheStats`）：
   - `StoreStats { hits, misses, evictions, total_entries, memory_usage_bytes, hit_rate }`
   - 在 get/set/delete 路径埋点；用 `AtomicU64` 无锁计数（参考后端 `AtomicCacheStats`，避免读路径加锁）

3. **容量管理**（对齐后端 `max_capacity` + 分区容量）：
   - 把现有的局部 LRU（OOB 50）泛化为整体容量预算 + LRU 淘汰

**打包发布**：改 SDK → `pack-sdk-tarball.mjs --apply` → 前端 `pnpm install`（项目已建立此流程，改 SDK 需回归 SDK 单测）。

### 4.3 第二步：前端集成 SDK 完善 storage

1. 通过 SDK 的 `StoreStats` 查询 store 占用/命中率，与前端自有缓存统计合并为**统一仪表**（对齐后端指标维度）
2. 「存储管理」设置项展示：SDK store + 前端自有缓存（缩略图/搜索索引/AI 数据）的占用与命中率
3. 清理按钮：`clearClientStores`（SDK 数据）+ 前端 `ExpirableCache` 清理（自有数据）

### 4.4 两步走的收益与风险

- **收益**：SDK store 获得与后端对等的治理能力（分级 TTL + 统计 + 容量），前端 storage 治理从「零散」变为「端到端对齐」。
- **风险**：SDK 是第三方库（本地 tgz+pin），改动需重新打包 + 回归 SDK 单测；TTL 需谨慎设计，避免误删 sync token 等关键数据导致重复全量同步。

---

## 五、结论

后端 synapse-rust 的缓存体系（双层缓存 + 分级 TTL + 完整统计）已经非常成熟，是前端 storage 优化的**对齐基准**。前端当前的核心问题不是「缺缓存」，而是「缓存与存储无治理」：60+ 键零散、无容量预算、无统计、无设置项，且存在 REFRESH_TOKEN 明文存储、退出登录不清理 SDK rust-crypto 数据的隐患。

matrix-js-sdk 本地仓库的 `clearClientStores` 能力正是补齐「SDK 数据清理」这一环的关键——前端已集成 SDK 却未使用其清理能力，集成成本低、收益明确。

**两步走方案**（先 SDK 后前端）是更彻底的路径：先给 SDK store 补齐分级 TTL + 统计 + 容量管理（对齐后端缓存体系），再让前端通过 SDK 的统一 API 完成 storage 治理。短期可先落地「清理」能力（`clearClientStores`），中长期按两步走补齐 TTL 与统计，最终让前端 storage 拥有与后端对等的可观测性与可控性。
