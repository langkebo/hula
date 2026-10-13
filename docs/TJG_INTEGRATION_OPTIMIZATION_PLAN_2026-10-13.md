# Tjg 集成面优化方案（2026-10-13）

来源：`docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md` §8/§8.5（2026-10-13 实测复核，commit `e7f48cbe`）。
本方案把其中的问题**逐条**转成可执行批次，每项都写清：方案、涉及文件、测试与门禁、变异自证方式、验收标准、风险。

---

## 0. 原则与约束（沿用本仓既有纪律）

1. **不改行为就不改代码**：能靠门禁/文档解决的（Batch 1）不碰业务逻辑；必须改的按批次小步提交。
2. **每项配测试 + 变异自证**：注入缺陷 → 测试/门禁必须红 → 逐字节还原（`sha256` 核对）。
3. **门禁防回潮**：新增守卫一律接入 `check:release`，并带**基数断言**（扫不到东西 ⇒ EXIT=2，不当作通过）。
4. **不抬棘轮**：`check:file-size` 只许缩。新增逻辑优先抽到新文件，受管文件净减或持平。
5. **不裸引 SDK**：`check:sdk-boundary` 禁止新文件直接 `import matrix-js-sdk`（含 `import type`），需要类型时用结构化最小接口。
6. **提交纪律**：显式 pathspec（`git commit -F msg -- <paths>`）+ 提交前后核对 `git show --name-only HEAD`；本仓并行写者活跃。

---

## 1. 问题 → 方案总表

优先级：**P0** = 会造成静默数据/E2EE 失效或功能不可用；**P1** = 明确的维护性与正确性债务；**P2** = 观测/文档/体积等长期项。
工作量：S（单文件级）/ M（跨 3–5 文件）/ L（跨模块或跨仓）。

| # | 问题（§8.5） | 方案要点 | 批次 | 优先级 | 工作量 |
|---|---|---|---|---|---|
| A1 | 系统唤醒重连杀 crypto | 已修（`releaseStoppedCryptoBinding` + 重启前 `ensureCrypto`） | ✅0 | — | S |
| A2 | 跨窗口假跳过死代码 | 已修（删机制 + `check:crypto-cross-window`） | ✅0 | — | S |
| A3 | `stopClient` 后 crypto 永久不可用（SDK 语义） | fork 侧：`stopClientLifecycleServices` 清空 `cryptoBackend`，或提供 `restartCrypto()`；Tjg 侧保持局部兜底 + 契约门禁 | 4 | P1 | L（跨仓） |
| A4 | 每窗口各自完整 init crypto | 降窗口数（B2/B3 统一策略顺带收窄）+ 保持"必须走 ensureCrypto"的约定与门禁 | 2 | P2 | S |
| A5 | crypto 失配只在日志可见 | 把 `releaseStoppedCryptoBinding` 拒绝解绑、crypto 未就绪接到既有告警面（`cryptoInitFailed` / 连接横幅） | 4 | P1 | M |
| A6 | IndexedDB 删除阻塞 | 维持现状（已有 300ms 重试 + 2s 超时降级），仅在日志加一次汇总 | 4 | P2 | S |
| B1 | 窗口名单与真实窗口集合无一致性校验 | 新增 `check:window-label-registry`：静态收集 `NEW_WINDOW_LABELS`（tauri.conf + 所有 `new WebviewWindow`）与 `NON_MATRIX_WINDOW_LABELS` 比对，未登记即红 | 1 | P1 | M |
| B2 | 设置窗口各页签对 client 来源假设不一致 | 窗口级统一：设置窗口入口（`SettingsPage.vue`）按需 `ensureClientReady()`；不需要 client 的页签显式空态；删除页签内零散 `waitForClientReady(10s)` | 2 | P0 | M |
| B3 | 独立聊天窗口无任何会话恢复 | `windowChat/index.vue` 走同一入口恢复会话 + 未登录/房间不存在空态；**需产品确认该功能是否在路线上** | 2 | P0 | M |
| B4 | 惰性恢复是隐式约定 | 抽 `useWindowSessionReady()`（一次性、幂等、可观测），替换设置页签 5 处手工调用 | 2 | P1 | S |
| C1 | Worker 有能力但不可达 | 先定论（1 次调研：搜索索引是否依赖 worker client）→ 二选一：① 主线程真正 `initialize/login`（能力已具备）② 判定废弃则删 UI 调用 + 死 handler | 3 | P1 | M |
| C2 | 同一能力多套并行实现 | 逐组收敛到 SDK 路径，契约测试从 `mock client=null` 改为真实路径断言；**每组独立提交** | 4 | P1 | L |
| C3 | 4 项静态残留 | ① `_unstable_getDelayedEvents` 无实现 ⇒ 走显式 `authedRequest` 或删功能 ② 直连 translate ⇒ 迁 gateway/受控出口 ③ `incrementUnread` 空存根 ⇒ 补实现或删 ④ 非标准 thread 事件 ⇒ 常量化并文档化 | 3 | P1 | M |
| C4 | 去重器/缓存管理器是死资产 | 二选一：删（推荐，先删 cache manager 的 dead API）或真接入（HTTP 层统一去重 + cache get/set） | 3 | P2 | M |
| C5 | XHR 旁路逃过守卫 | ① 先让守卫看得见（扩展 `check-no-raw-fetch` 覆盖 `XMLHttpRequest`）② 再把上传迁到 `MatrixHttpClient`（限流/重试/取消统一） | 1+3 | P1 | M |
| D1 | 文档数字/锚点会无声漂移 | 新增 `check:integration-map-freshness`：从 manifest/代码实测关键数字，与文档**结构化标记块**比对，不一致即红 | 1 | P1 | M |
| D2 | 并行写者会 sweep 你在盘的 `package.json` | 纪律落文档（CONTRIBUTING 片段）：编辑后尽快提交 + 核对 `git show --name-only HEAD` | 1 | P2 | S |
| D3 | `MatrixCryptoStateTracker.ts` 616 行 | 把 `clearStaleCryptoStores` / `deleteCryptoDbWithRetry` 抽到 `crypto/cryptoStoreCleanup.ts`（既有先例：`strictDevicePolicyReplay.ts`） | 4 | P2 | S |

---

## 2. 分批执行计划（每批 = 一个可独立回滚的 commit）

### Batch 1 —— 门禁与纪律（零行为变更，先建"看得见"的能力）

| 步骤 | 内容 | 验收 |
|---|---|---|
| 1.1 | `scripts/check-no-raw-fetch.mjs` 扩展：正则覆盖 `XMLHttpRequest` / `new Worker(` 旁路；命中 `mediaUploadHelpers.ts` 时**先加白名单 + TODO**（否则必红），把当前 1 处记为已登记的债务 | 守卫能报出该文件；`check:release` 绿 |
| 1.2 | 新增 `scripts/check-window-label-registry.mjs`：静态收集窗口 label（`tauri.*.conf.json` 的 `windows[].label` + `new WebviewWindow('x'` 字面量）与 `NON_MATRIX_WINDOW_LABELS` 比对；未在任一集合出现的 label 判红（要求显式登记"是否 matrix 窗口"） | 变异自证：临时新增一个未登记 label ⇒ 红 |
| 1.3 | 新增 `scripts/check-integration-map-freshness.mjs`：读 `route-manifest.all.json` 的 `entry_count`/`synapse_rust_commit` 与 `meta/sdk-pin.json`，比对图谱 §5/§10 的标记块（`<!-- numbers:begin -->…<!-- numbers:end -->` 内的 `key=value`）；不一致列出期望值与文档值 | 变异自证：手改文档数字 ⇒ 红 |
| 1.4 | `docs/CONTRIBUTING-COMMIT.md`（或追加到既有贡献文档）：写明并行写者 sweep 索引的现象、显式 pathspec 提交法、`cannot lock ref 'HEAD'` 的重试处理、commitlint scope 白名单 | 文档存在且被图谱 §8.5 D2 引用 |

**Batch 1 交付物**：3 个门禁（含测试）+ 1 份纪律文档；**不改任何业务代码**。

### Batch 2 —— 窗口与会话（P0，用户可见）

> **状态：✅ 已完成（2026-10-13，commit 见 `fix(service): 窗口会话统一入口`）。**
> 交付：`src/composables/common/useWindowSessionReady.ts`（窗口级幂等入口，三态 + 并发复用 in-flight）
> + `SettingsPage.vue` 入口调用 + 5 处页签消费 + `windowChat/index.vue` 四态 UI
> + 门禁 `pnpm check:window-session-entry`（含 15 例单测）
> + `src/composables/common/__tests__/useWindowSessionReady.test.ts`（11 例）、
> `src/views/windowChat/__tests__/index.test.ts`（6 例）。
> 变异自证：M18（删掉入口调用，**首轮逃逸** → 判据改为只认「调用形态」后判红）、
> M19/M19b（页签重新裸调 `waitForClientReady`、跨行写法）均判红并逐字节还原。


| 步骤 | 内容 | 验收 |
|---|---|---|
| 2.1 | 新增 `src/composables/common/useWindowSessionReady.ts`：`ensureSessionReady()`（幂等、一次性、返回 `'ready' \| 'no-session' \| 'error'`），内部 `sessionOrchestrator.ensureClientReady()` + `waitForClientReady`，并暴露失败原因供 UI 空态 | 单测覆盖三态 + 幂等（重复调用只跑一次） |
| 2.2 | `SettingsPage.vue`（设置窗口入口）在挂载时调用 `ensureSessionReady()`；5 个页签（Security/Session/Push/Friends/IgnoredUsers）改为消费其结果，删除各自的 `waitForClientReady(10s)` | 变异自证：去掉入口调用 ⇒ 页签单测红 |
| 2.3 | `windowChat/index.vue` 用同一入口恢复会话；`initializing` 期间显示 spinner，`no-session` 显示"未登录"，`roomId` 无效显示空态 | 组件测试覆盖三态；**待产品确认后合并** |
| 2.4 | A4 顺带收窄：确认设置窗口只在需要时恢复（页签级懒加载），并在图谱 §8.5 B4 更新为"已统一" | 文档同步 + 门禁 |

### Batch 3 —— 接入面收敛（逐子项独立提交）

> **3.3 状态：✅ 已完成（2026-10-13）。** 先取证后动手，结论与方案原文略有修正：
> - `MatrixCacheManager`（123 行）+ `createCachedFetcher`（17 行）+ 135 行测试 = **生产代码零调用**的假资产
>   （唯一引用是 `main.ts` 挂的 `window.__tjg_cache_stats` 调试读取器，读的统计永不写入）
>   ⇒ 选「整体删」而非「保留 getStats」：没有可保留的 `getStats` 消费者。删除含测试、main.ts import
>   与挂点、`global.d.ts` 声明、doc-coverage 基线条目（981 → 963）。
> - `MatrixRequestDeduper` 经核实**不是**死资产（3 处真实且语义正确的使用：房间能力 / 未读数 /
>   pusher 列表），故不删；改为订正其误导语义（`dedupWindowMs` → `STALE_IN_FLIGHT_MS` 安全阀）
>   并修掉一处真实缺陷（`finally` 无条件删条目会误删接替者）。
> - 「未接入路径」（写操作）经评估**维持不去重**：写操作去重会吞掉用户真实的重复发送。
> 测试：`MatrixRequestDeduper.test.ts` 新增 3 例语义边界（含安全阀与接替者两例）；变异自证 M25
> （改回无条件删除 ⇒ 判红）并逐字节还原。


> **3.2 状态：✅ 已完成（2026-10-13）。** 先调研后实施：取证报告
> `OPS_ARTIFACTS/TJG_worker_client_forensics_2026-10-13.md` 确认 worker 侧 client 面**整体不可达**
> 且搜索索引不依赖它 ⇒ 选定「删干净」（而非接通 —— 接通会让第二个 sync 挂同一份固定名 store）。
> 交付：删 `workerClientHandlers.ts` 整文件、`state.client/sdk/slidingSyncInstance`、`initSDK`、
> `extractClientConfig`、worker 内存看门狗（唯一动作是恒早退的 room timeline 裁剪）、
> `MatrixWorkerHost.clearStores/getStats`、`StorageSettings`/`MobileStorageSettings` 的假统计与
> 「清理缓存」按钮（含移动端的假成功 toast）、登出链路指向 no-op 的调用、3 个死类型；
> 新门禁 `pnpm check:worker-client-boundary`（含 15 例单测）。
> 变异自证：M23（worker 写回 client 死面）/ M24（主线程重新发 clearStores）/ M24b（分发表重新登记
> initialize）均判红并逐字节还原。


> **3.1 状态：✅ 已完成（2026-10-13）。** 交付：`MatrixHttpClient.uploadRaw`（薄委托）
> + 新通道 `MatrixRawUploadChannel.ts`（限流包装 fetch / dev 同源改写 / 统一错误归一化 / 超时取消）
> + 抽出 `MatrixHttpClientAiGate.ts` 腾出 400 行额度（AI 端点闸门行为不变）；
> `mediaUploadHelpers` 的 `uploadViaDirectFetch`(XHR) → `uploadViaGateway`；
> `check-no-raw-fetch` 的 `xhr-bypass` 白名单已清空。
> 测试：`MatrixRawUploadChannel.test.ts`（12 例）+ `mediaUploadHelpers.test.ts` 重写；
> 变异自证 M20（写回 XHR ⇒ 门禁红）/ M21（丢 Authorization ⇒ 红）/ M22（丢 dev 改写 ⇒ 红）。
> 附带修正：`uploadVideo/uploadAudio` 的「未初始化」失败顺序（原靠 `const client = getClient()` 提前抛出，
> 迁移后一度退化成 10s 元数据超时）⇒ 补显式 `assertClientReady()`。


| 步骤 | 内容 | 验收 |
|---|---|---|
| 3.1 | C5 第二步：`mediaUploadHelpers.ts` 的 upload 迁到 `MatrixHttpClient`（保留分片/进度语义），删 XHR；白名单条目移除 | 单测覆盖上传参数与错误映射；守卫不再白名单 |
| 3.2 | C1 定论 + 实施：先跑一次调研（worker client 是否被搜索索引依赖），出结论后二选一实施 | 若保留：`MatrixWorkerHost` 发 `initialize/login` 并断言 `state.client` 非空；若删除：UI 调用点与 handler 一并删，守卫防回潮 |
| 3.3 | C4：删除 `MatrixCacheManager` 的 dead API（保留 `getStats` 或整体删）与 deduper 的未接入路径；若决定接入则改为 HTTP 层统一 | 单测 + `check:guard-patterns`（不许再引入手写守卫） |
| 3.4 | C3 四项，每项一个 commit：`_unstable_getDelayedEvents` 改用显式端点或删；translate 迁受控出口；`incrementUnread` 补实现或删；thread 事件常量 + 文档 | 每项配单测；`check:bare-matrix-paths` / `quality:no-raw-fetch` 不回归 |

### Batch 4 —— 结构性 / 跨仓（高价值但要评估）

| 步骤 | 内容 | 验收 |
|---|---|---|
| 4.1 | A5：crypto 失配接 UI 告警面（复用 `encryptionStore.cryptoInitFailed` + 连接横幅） | 单测：解绑被拒/crypto 未就绪 ⇒ store 状态可见 |
| 4.2 | D3：抽 `crypto/cryptoStoreCleanup.ts`，`MatrixCryptoStateTracker.ts` 降到 <500 行（基线 758 只许缩） | `check:file-size` 绿且行数下降；清理逻辑单测保持绿 |
| 4.3 | C2：按组收敛并行实现（先 `SummaryService` 三胞胎 → 再 `RoomCapabilitiesService` → 再 sticky） | 每组：契约测试改真路径 + 剩余实现删除 |
| 4.4 | A3：**跨仓**改 fork —— `stopClientLifecycleServices` 停止后清空 `cryptoBackend`（或加 `restartCrypto()`），重新打 vendor tarball、更新 `meta/sdk-pin.json` 与契约门禁 | 需用户决策是否动 fork；契约门禁 `check:sdk-crypto-teardown` 同步更新断言 |

---

## 3. 验收与回归（每批都要跑）

1. `pnpm check:release`（22+ 段）—— 新增门禁必须已在链上；
2. 受影响单测：`src/services/matrix/**`、`tests/lint/**`；
3. **变异自证矩阵**（每批次至少 1 组）：注入缺陷 ⇒ 对应测试/门禁红 ⇒ 逐字节还原（`sha256`）；
4. 提交后核对：`git show --name-only HEAD` 恰为本批文件；工作区他方文件未被卷入。

**已知既有失败（不计入验收）**：`src/services/matrix/__tests__/MatrixCryptoStateTracker.test.ts` 的
H1 两条用例（30s 超时并污染下一条，已用 HEAD 版源码 A/B 复现）。

---

## 4. 风险与回滚

| 风险 | 影响 | 应对 |
|---|---|---|
| 并行写者与我同改一个文件（`package.json`、`src/services/matrix/**`） | 提交被 sweep 或 `HEAD` 锁冲突 | 显式 pathspec + 提交前后核对；冲突则重测数字后重提 |
| C2/C3 收敛改动面大 | 可能引入行为回归 | 逐子项独立 commit + 契约测试；必要时 `git revert` 单commit |
| B3 是"未完成功能"而非缺陷 | 改动方向可能与产品预期不符 | **先确认再实施**（本方案默认排在确认之后） |
| A3 动 fork | 需要重新打包 vendor tarball + 更新 pin，影响面跨仓 | 单列 4.4，等你决策；不动 fork 时 Tjg 侧兜底已足够 |
| 门禁自身假通过 | 守卫看起来绿但实际没扫到 | 每个守卫内置基数断言（EXIT=2）+ 变异自证 |

---

## 5. 需要你决策的点

1. **B3**：独立聊天窗口是"目标功能但漏了会话恢复"（→ 按 Batch 2.3 修），还是"尚未完成的实验功能"（→ 先标注/隐藏）？
2. **C1**：Worker 里的 SDK client 是保留（走 Batch 3.2 方案①）还是判定废弃（方案②，删调用与死 handler）？
3. **C4**：去重器/缓存管理器是删掉，还是真接入（HTTP 层统一去重 + cache 读写）？
4. **A3**：是否动 fork（跨仓、需要重新 pin）？不动则维持现状 + 契约门禁。
5. **起点**：从 Batch 1（零行为变更、先把守卫与纪律建起来）开始，还是先做 Batch 2（P0 用户可见）？
