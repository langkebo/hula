# Tjg UI 优化方案 v2.4

> 基准文档：[UI界面需求文档.md](./UI界面需求文档.md)（v2.5；v2.5 相对 v2.4 校正了路由计数、能力位清单与 16 条不可用端点）
> 审计对象：`Tjg`（Tauri v2 + Vue 3 + Vite + Pinia，桌面 Naive UI / 移动 Vant）
> 契约基线：[ROUTE_CONTRACT.md](../../synapse-rust/docs/synapse-rust/ROUTE_CONTRACT.md)（2026-10-31；注册路由条目 **980** / 唯一路径 **780** / 逻辑端点 **761**）
> SDK 基线：`matrix-js-sdk` 40.2.0-langkebo.7（commit `a238dd67a`）
> 审计方式：契约条款 → 代码取证（Read/Grep/脚本实测）→ 覆盖结论；本轮为**第二轮全量复核**，上一轮（2026-10-19，基线「1041 条」）的结论已逐条复核
> 结论日期：2026-11-01
> 文档修订：2026-11-01（在结论复核基础上做了**结构重排与表述校准**：上一轮 4 项 P1 误判经复核为「3 项已修复 + 1 项部分修复」、响应式证据重取、问题总表按 ID 排序、术语与复核命令统一。**优化目标、技术方案与版本号未变**）
> 阶段回写：2026-11-02（阶段 B 落地 G-01 遥测页与 G-02 后台更新页，阶段 C 核验 UI-P2-01 已修复；状态同步至 §0、§1.3、§2、§4、§6.1、§7、§8、§9）

---

## 0. 修订摘要与阅读约定

### 0.1 本轮相对上一轮的变化

| 类别 | 数量 | 构成 |
|---|---|---|
| 上一轮已修复 | 2 | UI-P1-01（设置能力降级）、UI-P2-07（聊天入口能力门控） |
| **本轮复核确认已修复** | 6 | UI-P1-02（管理菜单探测与五态）、UI-P1-03（Presence 第二写入点已消除）、UI-P1-04（订阅失败解耦）、UI-P1-05（设置搜索定位）、UI-P1-06（连接横幅去重）、UI-P1-07（断点体系收敛）——上一轮记为「仍成立/部分修复」，本轮取证为**已落地**，详见 §5 |
| 阶段 B 修复（能力缺口） | 2 | G-01（遥测页）、G-02（后台更新页） |
| 阶段 C 修复（P2） | 1 | UI-P2-01（240px 信息面板、断点折叠与弹性主区） |
| 阶段 D 修复（P2） | 4 | UI-P2-09（设置侧栏骨架占位）、UI-P2-06（空间空态区分）、UI-P2-08（Mjolnir 能力收尾）、UI-P2-05（解密失败卡片与重试） |
| 阶段 E 修复（P2 + 能力缺口） | 5 | UI-P2-02（硬编码颜色 24 → 0）、UI-P2-10（后台状态点走 token）、UI-P2-11（私密图标线宽路径）、G-03（线程冻结/静音）、G-07（媒体配额三处接线） |
| 仍成立 | 2 | UI-P2-03、UI-P2-04 |
| 未取证 | 1 | A-01（Modal 焦点陷阱，需 Storybook 可达后跑 `check:a11y`） |
| 无障碍仍待补 | 2 | A-02、A-03 |
| 能力缺口 | 4 | G-04、G-05、G-06、G-08（G-01/G-02 阶段 B、G-03/G-07 阶段 E 已落地） |

> 计数口径说明：`上一轮已修复` 指上一轮登记时即已关闭；`本轮复核确认已修复` 指上一轮被误记为「仍成立」的项。两类分开列，便于追溯审计质量（上一轮 4 项 P1 误判均为「修复已落地或部分落地，但状态未回写」）。

### 0.2 结论摘要

| 级别 | 数量 | 构成 |
|---|---|---|
| P0 | 0 | 未发现阻断登录、消息收发或造成数据错误的缺陷 |
| P1（已修复，保留回归约束） | 7 | UI-P1-01/02/03/04/05/06/07 |
| P2（待做） | 2 | UI-P2-03、04 |
| P2（已修复） | 9 | UI-P2-01、02、05、06、07、08、09、10、11 |
| 无障碍（待补 / 未取证） | 3 | A-01（未取证）、A-02、A-03 |
| 能力缺口 | 4 | G-04、G-05、G-06、G-08（G-01/G-02 阶段 B、G-03/G-07 阶段 E 已落地，见 §1.3 / §7） |

> ⚠️ 上一版本表在 P1 处写「5」但列出了 6 项、§4 注又写「6 项」，三处口径不一致。本节改为「按级别 × 按状态」交叉计数（7 个 P1 编号、9+2=11 个 P2 编号），此后不得再出现裸数字。

总体判断：

1. **契约规模已重算，上一轮基线过期**：上一轮写的「1041 条注册路由」与实测 980 不符。本轮全部数字以 `synapse-rust/scripts/contract/route_metrics.py` 与 `scripts/check-integration-map-freshness.mjs --print` 为准。
2. **能力降级与探测基建已完成闭环**：`SettingsTab` 的 `requiredCapability` / `capabilityFallback`、壳层过滤、深链回退、组件级 `PermissionGuard`、管理后台 `useAdminNav` 五态均已接线（UI-P1-01/02 关闭）。
3. **P1 已清零**：① 设置搜索锚点定位（UI-P1-05）；② 断点单一来源与聊天主壳四档（UI-P1-07）；③ Presence 第二写入点消除（UI-P1-03）——三项均已在 HEAD 落地，回归约束见 §5.2 / §5.4 / §5.6。
4. **仍有一类是「后端/服务层已完备、UI 缺入口」**：线程冻结与静音、媒体配额、延迟事件、CAS、访客、vendor 房间扩展共 6 项在服务层或后端存在，界面无任何可达路径。G-01 遥测与 G-02 后台更新已在阶段 B 补上管理页（`/admin/telemetry`、`/admin/background-updates`），剩余 6 项待后续阶段。
5. **视觉规范仍在收敛中**：硬编码颜色实测 0 处（ratchet 基线 0）；`NModal` 实测 170 处 / 50 文件（上一轮 298 处 / 101 文件，设置模块第一批 197 → 170），方向正确但未完成；`src/**/*.vue` 已无超过 800 行的文件（最大 `AdminSecurity.vue` 763 行），组件体量红线达标。

### 0.3 阅读约定（编号 / 状态 / 取证）

**编号规则**

| 前缀 | 含义 | 示例 |
|---|---|---|
| `UI-P1-xx` | UI 缺陷，P1 | UI-P1-05 设置搜索无定位 |
| `UI-P2-xx` | UI 缺陷，P2 | UI-P2-03 弹窗未收敛 |
| `A-xx` | 无障碍专项 | A-02 拖拽把手无可访问名称 |
| `G-xx` | 能力缺口（后端有、前端无入口），**不是 UI 缺陷** | G-01 遥测无页面 |

> 三类编号不得混排在同一张表里。上一版 §3.1 曾把 `G-03 / G-07` 放进交互逻辑表，本轮已移出。

**状态定义（闭集，不得自创）**

| 状态 | 判定 |
|---|---|
| 已修复 | 本轮取证时问题现象已消失，且有对应测试或守卫 |
| 已落地（回归约束） | 修复已在 HEAD 生效；方案内容转为**不得回退的不变量** |
| 部分修复 | 现象在部分路径消失，仍有明确缺口 |
| 仍成立 | 现象可复现，证据行号/符号有效 |
| 新增 | 上一轮未登记 |
| 未取证 | 本轮未核对，**不得**按「已覆盖」计入完成率 |

**取证与复核约定**

- 每条结论必须给**可执行复核命令**或**唯一符号名**，不得只给行号——本仓库并行改动频繁，行号会在数分钟内失效（本轮已发生：`ChatHeaderToolbar.vue` 迁至 `ChatHeader/`、`AdminLayout.vue` 拆分出 `useAdminNav.ts`）。
- 计数类结论必须写明**命令与口径**（如 `grep -rEo "NModal|n-modal" src --include=*.vue --include=*.tsx`），否则不同人复现出的数字不可比。
- 本节所有实测值取证时间：**2026-11-01 10:50–11:05**。

---

## 1. 契约基线与实现对齐

### 1.1 契约规模（实测）

| 口径 | 数值 | 说明 |
|---|---|---|
| 注册路由条目 | **980** | 同一路径按方法/function_id 多次注册计多次 |
| 唯一路径 | **780** | 去重后的 path |
| 逻辑端点 | **761** | 去掉 method 差异后的语义端点 |
| `/_matrix/client` | 333 | 客户端 API |
| `/_synapse/admin` | 300 | 管理 API |
| 其他 | 347 | root 3 / well-known 5 / matrix 非 client 253 / synapse 非 admin 40 等 |
| 含路由注册模块 | 67 | ROUTE_CONTRACT 正文口径；`check-integration-map-freshness.mjs` 另报 `route_modules=75`（统计粒度不同，见附录 B） |
| 非默认 profile 门控 | 19 | worker 11、oidc 8；另有 2 条双档注册（`/.well-known/jwks.json`、`/.well-known/openid-configuration`） |
| by-design unsupported | 16 | 注册但恒返回错误，登记于 `scripts/contract/ledger_annotations.txt`，由 `check_unsupported_endpoints.py` 守护 |

复核命令：

```bash
python3 ../synapse-rust/scripts/contract/route_metrics.py --json
```

> 判读要点：980 不等于「前端应覆盖 980」。其中包含联邦 70、AppService 41、装配 89 等**非客户端可消费**路由，以及 16 条 by-design unsupported 与 19 条非默认 profile 门控路由。本报告一律按「模块族 × 客户端可消费性」判定，不做裸路径 diff。

### 1.2 前端侧规模（实测）

| 指标 | 数值 | 来源 |
|---|---|---|
| `src/services/matrix/**` 非测试文件 | 236 | `check-integration-map-freshness.mjs --print` |
| 服务层测试文件 | 246 | 同上 |
| 继承 `BaseMatrixService` 的子类 | 38 | 同上 |
| `AdminFacadeService` 暴露的 manager 访问器 | 112 | 同上 |
| `AdminFacadeService` 暴露的 toggle | 101 | 同上 |
| Tauri 命令模块 | 18 | 同上 |
| 私有路由总量 | 545 | 同上（`private_routes`；细分见附录 B） |

### 1.3 逐模块对齐结论

结论口径：**已覆盖**＝服务层封装 + 至少一处 UI 可达入口；**服务层已封 / UI 未接**＝有服务方法，全仓无非测试引用；**未覆盖**＝前端无路径常量、无服务方法；**部分覆盖**＝主链可用但存在明确缺口；**不适用**＝服务端装配类路由。

「缺口」列指向 §2 的详情，避免两处重复叙述同一件事。

| 模块族 | 规模 | 覆盖结论 | 缺口 | 取证（符号名） |
|---|---|---|---|---|
| 认证（含 CAS） | 12 | **未覆盖** | G-05 | `cas_login` / `login/cas` / `sso/cas` 全仓 0 命中（仅 i18n 空命名空间） |
| OIDC | 10 | 已覆盖 | — | `MatrixOidcService` |
| MSC4108 / Rendezvous | 4 | 已覆盖 | — | `MatrixRendezvousService`、`useRendezvous`、`RendezvousSessionManager` |
| SAML | 16 | 已覆盖 | — | `MatrixAuthSaml`、`AdminSaml.vue`、`useAdminSaml` |
| Worker | 26（11 条门控） | 未取证 | — | 本轮未逐条核对 worker 管理面 |
| 事件举报 | 18 | 已覆盖 | — | `ModerationEventReportTab.vue`、`AdminModerationService` |
| Relations / Reactions | 9 / 1 | 已覆盖 | — | `MatrixMessageRelationService`、`MatrixReactionService` |
| 线程 | 21 | **已覆盖** | ~~G-03~~（已落地） | `MatrixThreadApi` 三方法已接线：`ThreadPanel.vue` 头部冻结/静音入口 + footer 只读降级 |
| 外部服务 | 11 | 已覆盖 | — | `ExternalServiceService`、`ExternalServiceManager.vue` |
| 好友 | 28 | 已覆盖 | — | `src/services/matrix/friends/` |
| 媒体 | 60 | **部分覆盖** | ~~G-07~~（已落地） | 主链可用；客户端配额三接口 + admin 全局配额均已接线（`StorageSettings.vue`、`AdminMaintenance.vue`） |
| Key Backup | 33 | 已覆盖 | — | `MatrixKeyBackupService`（含 1 条走不通的 `verifyBackup`，见 §3.4 注） |
| 密钥轮转 | 9 | 已覆盖 | — | `KeyRotationDialog.vue` + `EncryptionSettings.vue` |
| Widget | 16 | 已覆盖 | — | `MatrixWidgetService`（`private_on_std_widgets=0`，全走私有路由） |
| AppService | 41 | 已覆盖 | — | `AdminAppServices.vue`、`ApplicationService` |
| 延迟事件（MSC4140） | 7 | **未覆盖** | G-04 | `msc4140` / `delayed_event` 全仓 0 命中，仅 i18n 空命名空间 `delayed_events` |
| 房间 | 114 | 已覆盖 | — | `src/services/matrix/room/`（21 个非测试文件） |
| 推送 | 25 | 已覆盖 | — | `MatrixPushService`、`MatrixRoomNotificationService` |
| 搜索 | 5 | 已覆盖 | — | `MatrixSearchService`、`ChatRoomSearch.vue` |
| 标签 | 4 | 已覆盖 | — | `TagsTab.vue` |
| 模块 | 23 | 已覆盖 | — | `AdminModules.vue`（状态筛选 + 详情事件） |
| 滑动同步 | 4 | 已覆盖 | — | `MatrixSlidingSyncService` |
| 特性开关 | 5 | 已覆盖 | — | `FeatureFlagManager.vue`（挂载于 `AdminMaintenance.vue`） |
| 私聊 | 5 | 已覆盖 | — | `src/services/matrix/privateChat/` |
| 空间 | 26 | 已覆盖 | — | `MatrixSpaceService`、`AdminSpaces.vue` |
| E2EE | 22 | 已覆盖 | — | `src/services/matrix/crypto/`（26 个非测试文件） |
| 第三方（3PID） | 6 | 未取证 | — | 本轮未逐条核对 |
| 管理 | 300 | **部分覆盖** | —（G-01/G-02 已落地：`AdminTelemetry.vue`、`AdminBackgroundUpdates.vue`；媒体子域 23 条仍无页面，见 §3.4 注） | 23 个 admin 服务、25 个 admin 视图；遥测与后台更新均已接线 |
| 联邦 | 70 | 已覆盖 | — | `FederationService`、`AdminFederation.vue`、`AdminFederationMonitor.vue` |
| 装配 | 89 | 不适用 | — | 服务端装配期路由 |
| 设备 | 13 | 已覆盖 | — | `MatrixDeviceService` |
| 访客 | 3 | **未覆盖** | G-06 | `register/guest`、`account/guest/upgrade` 全仓 0 命中；仅 admin 只读展示 `is_guest` |
| 语音 | 13 | 部分覆盖 | — | `paths/voice.ts` 已定义 config/upload/room/user/content；`convert`/`optimize`/`transcription` 属 by-design unsupported（见 §3.4 注） |
| 账户 | 15 | 已覆盖 | — | `MatrixAccountService` |
| 输入状态 | 5 | 已覆盖 | — | `MatrixTypingService` |
| 遥测 | 6 | 已覆盖 | — | `AdminTelemetry.vue` + `useAdminTelemetry`（路由 `/admin/telemetry`，导航 `admin.nav.telemetry`） |
| 阅后即焚 | 7 | 已覆盖 | — | `BurnAfterReadBar.vue` + `useBurnAfterRead` + 能力门控 |
| 验证码 | 5 | 已覆盖 | — | `MatrixAuthCaptcha`、`CaptchaVerify.vue`、`useRegisterCaptcha` |

> **管理族规模口径修正**：上一版写「管理 150」，那是**逐模块口径**（`ROUTE_CONTRACT.md` 的「管理 (Admin) 150 条」）。命名空间口径下 `/_synapse/admin` 实为 **300** 条（用户 76 / 服务器 62 / 房间 59 / 安全 58 / 媒体 23 / 联邦 22）。两个口径不可相加，本表统一用**逐模块口径**，与 §1.1 的 300 只是分类方式不同。
>
> 未取证的 3 个模块族（Worker 管理面、第三方 3PID、媒体部分子项）在验收前必须补齐取证，不得按「已覆盖」计入完成率。

---

## 2. 后端能力 vs 前端覆盖（能力缺口清单）

以下 6 项（G-03 ~ G-08）的共同特征：**后端路由存在，且多数已有服务层封装，但用户在界面上没有任何可达路径**。这与「UI 缺陷」不同，是功能覆盖缺口，单列成 G 编号；落地方式见 §7。G-01、G-02 已于阶段 B 落地，G-03、G-07 已于阶段 E 落地，保留在表中供回归核对。

| ID | 级别 | 能力 | 后端规模 | 前端现状 | 证据（符号名） |
|---|---|---|---|---|---|
| G-01 | P1 | 服务端遥测与告警 | 6 条 `/_synapse/admin/v1/telemetry/*` | **已落地**：路由 `/admin/telemetry`，导航与能力降级齐备 | `AdminTelemetry.vue`、`useAdminTelemetry`、`admin.nav.telemetry`；服务方法经 `AdminFacadeService.telemetry` |
| G-02 | P1 | 后台更新任务 | 19 条 `/_synapse/admin/v1/background_updates/*` | **已落地**：路由 `/admin/background-updates`，含可停轮询 | `AdminBackgroundUpdates.vue`、`useAdminBackgroundUpdates`、`admin.nav.backgroundUpdates` |
| G-03 | P2 | 线程冻结 / 解冻 / 静音 | thread 21 条中的 3 个动作 | **已落地**：`ThreadPanel.vue` 头部状态标签 + 冻结/静音操作，冻结时 footer 只读 | `MatrixThreadApi`：`freezeThreadViaApi` / `unfreezeThreadViaApi` / `muteThreadViaApi`；`getRoomThreadViaApi` 读状态 |
| G-04 | P2 | 延迟事件（MSC4140） | 7 条 `unstable/org.matrix.msc4140/delayed_events` 系列 | **零对接** | `msc4140` / `delayed_event` 全仓 0 命中；仅 `i18n.d.ts` 有空命名空间 `delayed_events: {}` |
| G-05 | P2 | CAS 单点登录 | 12 条 | **零对接** | `cas_login` / `login/cas` / `sso/cas` 0 命中 |
| G-06 | P2 | 访客注册与升级 | 3 条（`register/guest`、`account/guest`、`account/guest/upgrade`） | **零对接** | 仅 admin `UserService` 只读展示 `is_guest` |
| G-07 | P2 | 媒体配额（告警 / 检查 / 统计） | **4 条**：`GET /_matrix/media/v1/quota/{alerts,check,stats}` + `GET /_synapse/admin/v1/media/quota` | **已落地**：设置页三态配额卡片 + 上传前预检 + admin 服务端全局配额卡 | `MatrixMediaService` 三方法；`StorageSettings.vue`、`useMsgInputFileUpload.sendFilesDirect`、`useAdminMaintenance.loadServerQuota` |
| G-08 | P2 | vendor 房间扩展字段 | `event_perspective`、`external_ids` 各 1 条路由 | **零对接** | 两关键字在 `src/` 全仓 0 命中 |

> **G-07 修正**：上一版写「3 条 `/_matrix/media/v1/quota/*`」，实际是 **4 条**——除 client 侧三条外还有 admin 侧 `GET /_synapse/admin/v1/media/quota`。页面设计时应把「用户配额」与「管理员全局配额」分开呈现。

**处理原则**

1. G-01 / G-02 是「管理后台已有 300 条端点、但有两块功能没有页面」，管理员此前只能靠 API 直调；阶段 B 已补页面，回归约束见 §7 与 §8。
2. G-03 / G-07 是「有服务层无入口」，实现成本最低，已在阶段 E 与 P2 视觉收敛同批落地；回归约束见 §7。
3. G-04 / G-05 / G-06 涉及协议流程与新页面，必须先确认产品是否需要，再排期；未确认前不进开发队列。
4. G-08 需要先确认 synapse-rust 侧字段语义与展示规则，属于体验增强，放最后。

---

## 3. UI 专项审查

### 3.1 交互逻辑

| 编号 | 问题 | 状态 | 后果 | 证据（符号名） |
|---|---|---|---|---|
| UI-P1-02 | 管理后台菜单无探测过滤、无五态 | **已修复** | — | `useAdminNav.ts`：`navState`（loading/ready/forbidden/unauthorized/unsupported/unavailable）、`visibleNavGroups`、`showSkeleton`、`retryProbe`；`AdminSidebar.vue` 消费；`AdminLayout.vue:23` `v-if="navState === 'ready'"` |
| UI-P1-03 | Presence 双管线并行 | **部分修复** | 双 composable 已合并，但 store 写入点仍有 2 处 | `usePresenceSync` 文件已删除；`wsPresenceHandler.applyPresencePatch` 是主写入点；**但 `useWsEventHandler.applyUserPresence`（`:67-75`）仍直接写 `contactStore` / `groupStore`**，且只写 `activeStatus` + `lastOptTime`，比 `applyPresencePatch` 少写 `presence` 与 `statusMessage` |
| UI-P1-04 | 订阅失败阻断批量查询 | **已修复** | — | `wsPresenceHandler.applyPresenceToStores`：订阅包在 try/catch 内，失败仅 `logger.warn` 后继续 `getBatchPresence` |
| UI-P1-05 | 设置搜索只有 Tab 级 | 仍成立 | 搜索「主题」只切 Tab，不定位控件 | `composables/settings/settingsSearchIndex.ts` 的 `SettingsSearchEntry` 仅 `{ id, terms }`；全仓无 `data-settings-anchor`、无 `scrollIntoView` |
| UI-P1-06 | 连接状态双横幅 | **已修复** | — | `ChatMain.vue` 顶部改为 `ChatBanners`（只含网络提示 + E2EE/私密/水印/粘性事件）；`components/connection/SyncStatusBar.vue` 已无真实引用，仅存在于自动生成的 `typings/components*.d.ts` |
| UI-P2-09 | 能力未加载时先显示后消失 | **已修复** | — | `SettingsSidebar.vue` 新增 `capabilitiesLoaded` prop：未加载时渲染 `settings-sidebar-skeleton` 骨架并禁用搜索，不渲染真实 Tab；壳层 `matchesCapability` 保持「未加载返回 true」以避免空白 |

> **本轮重要订正**：上一版把 UI-P1-02/03/04/06 全部记为「仍成立」，共 4 项误判。经取证，其中 **3 项已落地**（`useAdminNav` 五态、try/catch + 同款注释、`SyncStatusBar` 退化为死组件），**UI-P1-03 只完成了一半**：`usePresenceSync` 已删除，但 `useWsEventHandler.applyUserPresence` 仍在直接写 store，且 `wsPresenceHandler` 里"在线状态唯一写入口"的注释与事实不符。**UI-P1-04 的代码注释与上一版方案文本几乎一字不差**，说明该方案当时已被采纳但未被回写状态——这是「审计结论不回写」造成的典型漂移，应对办法见 §0.3 的复核约定。

### 3.2 视觉一致性

| 编号 | 问题 | 实测（2026-11-01） | 证据 |
|---|---|---|---|
| UI-P2-02 | 硬编码颜色 | `hardcoded_color: 0`（baseline 0，已收敛） | `pnpm check:ratchet` |
| UI-P2-03 | 弹窗未收敛 | `NModal` / `n-modal` 合计 **170 处 / 50 文件**（上一轮 298 / 101；设置模块第一批 197 → 170） | `rg -e NModal -e n-modal src --glob "*.vue" --glob "*.tsx"` |
| UI-P2-10 | 组件内联样式上色 | 模块状态点用 `:style="{ backgroundColor: statusColor(...) }"` 上色，绕过令牌 | `AdminModules.vue:31` |
| UI-P2-11 | 图标规范不一致 | 私密模式图标用 `<svg><text>` 字形，非 1.5px 线宽路径图标 | `components/rightBox/chatBox/ChatHeader/ChatHeaderToolbar.vue:134` |

其余 ratchet 指标（本轮实测，均与基线相等）：`matrix_prefix_hardcoded 23`、`important_css 82`、`inline_style 5`（全部命中具名 allowlist）、`zh_literal_vue 149`、`is_mobile_branch 19`、`hardcoded_radius 0`、`ts_expect_error 3`、`as_unknown_as 0`（剩余命中 allowlist）。

组件体量：`src/**/*.vue` **无超过 800 行文件**，最大 `AdminSecurity.vue` 763 行、`AdminUsers.vue` 763 行，满足红线。

> **计数订正**：上一版写 192 处 / 56 文件，本轮实测 197 / 57。差异来自计数命令口径（是否含 `.tsx`、是否把 `n-modal` 与 `NModal` 合并计）。此后引用该数字必须附命令。

### 3.3 响应式适配

| 编号 | 问题 | 状态 | 证据（本轮重取） |
|---|---|---|---|
| UI-P1-07 | 断点体系分裂，聊天主壳未适配 | 仍成立 | ① `styles/scss/global/responsive.scss` 定义 md 768 / lg 992 / xl 1200，并导出 `respond-to`（min-width）与 `respond-to-max`（max-width）两个 mixin；② **`respond-to-max('md')` 已被 15 个文件采纳**（10 个 admin 视图 + 2 个 admin 组件 + 2 个设置页 + `layout/left/style.scss`；定义文件本身不计），但**只用 `md` 一档**，`lg` / `xl` 零采纳；③ TS 侧 `useResponsiveBreakpoint` 的断点是 **1440 / 1024**，与 SCSS 的 768/992/1200 不同源，且仅 `layout/center` 与 `layout/right` 两处消费；④ 聊天主壳（`layout/center`、`components/rightBox/chatBox/ChatMain.vue`）没有宽度适配，`ChatMain` 仅用 `useIsMobile()` 做布尔分支 |
| UI-P2-01 | 缺 240px 可折叠信息面板 | 部分修复 | `composables/layout/useRightPaneWidth.ts`：`VIEW_WIDTH_MAP.chat = 620`、`DEFAULT_MIN = 360`、`DEFAULT_MAX = 800`——最小宽度 360 与「240px 面板」目标冲突；`layout/right/index.vue` 已改 `flex: 1 1 auto`（上一轮的「非 flex-1」已消除） |

> **证据订正（重要）**：上一版写「`@include respond-to` **全仓采纳 0 次**」与「媒体查询只有 13 个文件」。本轮重取：`respond-to` 系列**已采纳 16 个文件**（主要是 `respond-to-max`），原生 `@media (max-width…)` 仅 **3 个文件**（其余 `@media` 是 `prefers-reduced-motion` 等无宽度断点）。结论方向不变（两套断点不同源、主壳未适配），但原证据是错的，必须替换，否则方案会被误判为「从零开始」。

### 3.4 用户体验

| 编号 | 问题 | 状态 | 证据（符号名） |
|---|---|---|---|
| UI-P2-05 | 解密失败无提示与重试 | **已修复** | `MatrixEventService` 写入 `isBadEncrypted`；`renderMessage/DecryptionFailureCard.vue`（重试 + 查看原始事件）；`MatrixMessageService.retryDecryptMessage` / `getRawMessageJson`；`sync.ts` 同事件 ID 原地替换 |
| UI-P2-06 | 空间空态不区分「空」与「搜不到」 | **已修复** | `SpaceRoomGrid.vue` 按 `searchQuery.trim()` 二选一；`EmptyState.vue` 新增 `no-rooms`（第 6 类插图） |
| UI-P2-08 | Mjolnir 设置无 Admin 能力判定 | **已修复** | `MjolnirSettings.vue` 根节点内包 `<PermissionGuard :require="'admin-api'">`，覆盖全部操作区与弹窗 |
| UI-P2-04 | 需求文档与实现缺少核对机制 | 仍成立 | 上一轮修了 3 处笔误后未建立机制；本轮已重算契约数字，仍需固定核对清单（§7 之外的单列项） |

> **两条与本方案相邻但不单列的已知问题**（来自基准文档 v2.5，属于契约层，不计入本文档的 UI 缺陷口径）：
> 1. `MatrixKeyBackupService.verifyBackup` 打的是 by-design 404 端点，**移动端 `MobileSecureBackupDialog` 仍可触发**——修法见 v2.5 §2.4.9，不属 UI 布局范畴。
> 2. Admin 媒体子域 23 条端点无页面——与 G-01/G-02 同源（管理面「有端点无页面」），若与 G-01 同批做，可把媒体页并入阶段 B。

### 3.5 无障碍

已达标项：`SkipLink`（`#center`、`#chat-main`）、`GlobalAriaLive`、`prefers-reduced-motion` 覆盖 **59 处 / 53 文件**（含全局入口 `design-tokens.css`）、图标按钮普遍带 `:aria-label`。

仍待补：

| 编号 | 问题 | 证据 |
|---|---|---|
| A-01 | `NModal` 170 处中未逐一确认焦点陷阱与 `aria-modal` | 需在 Storybook 启动后跑 `pnpm check:a11y`（脚本设计为 Storybook 不可达即 `exit 2`，**不得据此下结论**） |
| A-02 | 右侧栏拖拽把手无可访问名称与键盘替代 | `layout/right/index.vue` 把手为指针事件，无 `role`/`tabindex`/方向键处理 |
| A-03 | 管理后台移动端菜单按钮有 `aria-expanded`，但侧栏收起按钮无同等待遇 | `AdminLayout.vue` 头部 `aria-expanded` 已有；`sidebarCollapsed` 无对应控件 |

---

## 4. 问题总表

按 ID 排序（P1 → P2 → A → G），状态取 §3 结论，取证时间统一为 2026-11-01。

| ID | 级别 | 问题 | 状态 | 复核入口（符号名优先） |
|---|---|---|---|---|
| UI-P1-01 | P1 | 设置页未按服务端能力隐藏/只读 Tab | **已修复** | `settingsSchema.ts` 的 `requiredCapability` / `capabilityFallback`；`useSettingsShell.matchesCapability` / `isTabReadOnly` |
| UI-P1-02 | P1 | 管理后台菜单无探测过滤、无五态 | **已修复** | `views/admin/useAdminNav.ts`、`AdminSidebar.vue`、`AdminLayout.vue:23` |
| UI-P1-03 | P1 | Presence 双管线并行 | **已修复** | `wsPresenceHandler.writePresenceToStores`（唯一写入口）；auth 层订阅与端口写入已删除 |
| UI-P1-04 | P1 | 订阅失败阻断批量刷新 | **已修复** | `wsPresenceHandler.applyPresenceToStores`（try/catch + `logger.warn`） |
| UI-P1-05 | P1 | 设置搜索无命中路径与定位 | **已修复** | `composables/settings/settingsSearchIndex.ts`、`settingsAnchorNavigation.ts` |
| UI-P1-06 | P1 | 连接状态双横幅 | **已修复** | `ChatMain.vue` 顶部 `ChatBanners`；`SyncStatusBar.vue` 已无真实引用 |
| UI-P1-07 | P1 | 断点体系分裂、主壳未适配 | **已修复** | `useResponsiveBreakpoint.DEFAULT_BREAKPOINTS`（1200/992/768）与 `responsive.scss` 同源；`useChatSidebar` 四档 |
| UI-P2-01 | P2 | 缺 240px 可折叠信息面板 | **已修复** | `useChatSidebar.ts`（折叠/抽屉/隐藏）、`useRightPaneWidth.ts`（`DEFAULT_MIN = 240`）、`layout/right/index.vue`（弹性主区） |
| UI-P2-02 | P2 | 硬编码颜色 24 处 | **已修复** | `pnpm check:ratchet`：hardcoded_color 24 → 0（`simple.scss`、`code-block.scss` 改用 `color-mix` + `--tjg-*`） |
| UI-P2-03 | P2 | 弹窗 170 处 / 50 文件 | 仍成立（分批进行中：设置模块第一批已完成） | `rg -e NModal -e n-modal src` |
| UI-P2-04 | P2 | 文档-代码核对机制缺失 | 仍成立 | 本文档 §1 |
| UI-P2-05 | P2 | 解密失败无提示与重试 | **已修复** | `renderMessage/DecryptionFailureCard.vue`；`MatrixMessageService.retryDecryptMessage`（SDK `attemptDecryption(isRetry)`）；`sync.ts` 原地替换 |
| UI-P2-06 | P2 | 空间空态不区分场景 | **已修复** | `components/space/SpaceRoomGrid.vue`（`no-rooms` / `no-results`）；`EmptyState.vue` 6 类插图 |
| UI-P2-07 | P2 | 私密模式 / 阅后即焚 / 语音 / 通话入口未做能力门控 | **已修复** | `ChatHeader/ChatHeaderToolbar.vue`（voip / burn-after-read 区块）、`BurnAfterReadBar.vue` |
| UI-P2-08 | P2 | 脱水设备 fail-closed；Mjolnir 未按 Admin 能力隐藏 | **已修复** | `DehydratedDeviceSection.vue`；`MjolnirSettings.vue` 的 `PermissionGuard :require="'admin-api'"` |
| UI-P2-09 | P2 | 能力未加载时 Tab 闪烁 | **已修复** | `SettingsSidebar.vue` 的 `capabilitiesLoaded` 骨架 + 搜索禁用 |
| UI-P2-10 | P2 | 内联样式上色绕过令牌 | **已修复** | `AdminModules.vue` 状态点改 `status-dot--<status>` 类，映射 `--tjg-status-*` |
| UI-P2-11 | P2 | 私密模式图标非线宽路径图标 | **已修复** | `ChatHeader/ChatHeaderToolbar.vue` 锁形路径（`stroke-width: 1.5`，无字形文本） |
| A-01 | — | Modal 焦点陷阱未逐一确认 | 未取证 | `pnpm check:a11y`（需 Storybook） |
| A-02 | — | 拖拽把手无可访问名称 | 仍成立 | `layout/right/index.vue` |
| A-03 | — | 侧栏收起按钮缺 `aria-expanded` | 仍成立 | `AdminLayout.vue` 头部 |
| G-01 / G-02 | P1 | 遥测、后台更新无页面 | **已落地** | `AdminTelemetry.vue`、`AdminBackgroundUpdates.vue`（`useAdminNav` 已登记） |
| G-03 / G-07 | P1 | 线程冻结/静音、媒体配额无入口 | **已落地** | `ThreadPanel.vue`；`StorageSettings.vue` + `useMsgInputFileUpload.sendFilesDirect` + `AdminMaintenance.vue`（详见 §7） |
| G-04 ~ G-06 / G-08 | — | 后端能力前端无入口 | 仍成立 | 见 §2 |

> **计数（按编号 × 状态，不混算）**
>
> - P1 共 7 个编号：已修复 7（UI-P1-01/02/03/04/05/06/07），无遗留。
> - P2 共 11 个编号：已修复 9（UI-P2-01、02、05、06、07、08、09、10、11）、仍成立 2（UI-P2-03、04）。
> - 无障碍 3 个编号：未取证 1（A-01）、仍成立 2（A-02、A-03）。
> - 能力缺口 8 个编号（G-01 ~ G-08），不计入 UI 缺陷总数：已落地 4（G-01、G-02、G-03、G-07）、仍成立 4（G-04 ~ G-06、G-08）。

---

## 5. P1 详细方案

> 本节结构统一为：**现象 → 方案（或已落地实现）→ 回归约束 → 复核命令**。
> 已修复项保留原技术方案，但改写为「已落地实现 + 不得回退的不变量」，以便后续回归有据可依。

### 5.1 UI-P1-02 管理后台探测过滤与五态【已落地】

**现象（上一轮）**

`AdminLayout.vue` 的导航是静态 computed，7 组 20 项无条件渲染，包含 SAML、modules、moderation 等可选能力页面；探测结果只在 `admin.ts` 内部折算成 `isAdmin` 布尔，无法区分「无权限」「能力未启用」「请求失败」。

**已落地实现**（`views/admin/useAdminNav.ts`，298 行）

1. `NavItem` 具备 `requires?: 'admin-api'` 与 `optionalCapability?: AdminOptionalCapability`（当前取值 `saml` / `modules`），其余项统一注入 `requires: 'admin-api'`。
2. `navState` 为六态：`loading` / `ready` / `forbidden` / `unauthorized` / `unsupported` / `unavailable`，由 `filterAdminNavGroups(navGroups, navState, isOptionalCapabilityEnabled)` 产出 `visibleNavGroups`。
3. `showSkeleton` 在 `loading` 与 `unavailable` 为真；`AdminLayout.vue` 的 `router-view` 只在 `navState === 'ready'` 渲染，其余态显示 `admin-state-panel`（标题 + 描述 + 仅 `unavailable` 提供 `retryProbe` 重试）。
4. `stateTitle` / `stateDescription` 按五态（非 ready）分支取 i18n 键，`AdminLayout` 头部 `statusLabel` / `statusTagType` 同步。

**回归约束（不得回退）**

- 任何新增管理页必须在 `useAdminNav` 的 `rawNavGroups` 登记，并声明 `optionalCapability`（若依赖可选能力）；`config.tsx` / `ActionList.vue` 的管理入口必须与侧栏同源判定。
- `navState !== 'ready'` 时**不得**渲染业务 `router-view`（防止未探测就先发请求）。
- 五态文案不得复用同一句兜底文案（`forbidden` 与 `unsupported` 语义不同）。

**复核命令**

```bash
cd Tjg
grep -n "navState\|optionalCapability\|filterAdminNavGroups" src/views/admin/useAdminNav.ts
pnpm test:run src/views/admin
```

---

### 5.2 UI-P1-03 Presence 单管线合并【已落地】

**现象（上一轮）**

`usePresenceSync.ts` 与 `wsPresenceHandler.ts` 各自维护订阅集合、in-flight 状态与 store 写入；`App.vue` 同时启用两条链路，导致重复订阅与重复批量请求。

**已落地部分**

1. `usePresenceSync.ts` **已删除**（全仓无该文件）。
2. `wsPresenceHandler.applyPresencePatch` 成为批量/实时合并的主写入点，统一写 `activeStatus` + `lastOptTime` + `presence` + `statusMessage` 四个字段。
3. `App.vue` 只保留 `useWsEventHandler`，`wsPresenceHandler` 由其内部 `createPresenceHandler()` 装配。
4. `isPresenceSyncInFlight` + `hasPendingPresenceSync` 的单飞 + 尾随重跑集中在 `syncAvatarPresence`。

**已完成（本轮核对 + 收尾）**

- `useWsEventHandler.applyUserPresence` 已删除，WS 上下线统一经 `presenceHandler.applyPresenceStatus` 转发，不再直接写 store。
- `applyPresenceStatus` 以 `syncPresenceFields: false` 显式声明本次不覆盖 `presence` / `statusMessage`，不再静默少写。
- **auth 层第二写入路径已消除**：`SessionBootstrapService.startPresencePipeline` 不再订阅 `matrixPresenceService.onPresenceChange` 写 contact/group store，只保留首帧 online 上报与本地用户镜像；`SessionRuntimeState.presenceChangeCleanup` 及其登出清理一并删除。
- 实时变更订阅收敛为 app 层单一入口 `wsPresenceHandler.ensurePresenceListener`，由「app 挂载（`startPresenceWatch`）」与「`LOGIN_SUCCESS`（`handleLoginPresence`）」两处触发，重复调用保持单订阅。
- 端口 `SessionStorePort` 不再暴露 `group.updateUserPresence` / `contact.updateContactPresence`，服务层无法再绕过写入口。
- 唯一写入口 `writePresenceToStores` 已标注「见 UI 优化方案 §5.2」；`wsPresenceHandler.test.ts` 覆盖单订阅 / 单批量 / 唯一写入 / 失败保持原值，`presenceSingleWriter.test.ts` 同时守住 SDK 侧唯一写入与 store 侧唯一写入。

**修改方案（已实施）**

1. 删除 `useWsEventHandler.applyUserPresence`，改为转发唯一写入口。
2. 删除 auth 层 `onPresenceChange` 订阅与端口 presence 写入方法，保留服务层「首帧上报 + 本地镜像」职责。
3. 在 `writePresenceToStores` 上保留唯一写入点指针注释。
4. 不变量单测：同一用户在一次同步周期内只产生一次订阅 + 一次批量请求 + 一次 store 写入；全仓仅 `wsPresenceHandler` 写 contact/group presence。

**回归约束（不得回退）**

- 任何新代码**不得**直接调用 `contactStore.updateContactPresence` / `groupStore.updateUserPresence`，必须经 `applyPresencePatch`（结构守卫见 `presenceSingleWriter.test.ts`）。
- 单飞语义：in-flight 期间的新请求只置 `hasPendingPresenceSync`，`finally` 中补跑一次且仅一次。
- 四字段成组写入（至少显式声明「本次不更新 `presence` / `statusMessage`」），禁止静默少写。

**复核命令**

```bash
cd Tjg
grep -rn "updateContactPresence\|updateUserPresence" src --include=*.ts --include=*.vue \
  | grep -v __tests__ | grep -v "stores/domains"
# 期望：只剩 src/composables/app/wsPresenceHandler.ts 一处
```

---

### 5.3 UI-P1-04 订阅失败不得阻断批量刷新【已落地】

**现象（上一轮）**

`applyPresenceToStores` 先 `await subscribeToPresence(...)`，抛错即中断，后续 `getBatchPresence` 不执行，界面长期停留在陈旧在线状态。

**已落地实现**（`wsPresenceHandler.applyPresenceToStores`）

```ts
const nextSubscribedUserIds = trackedUserIds.filter((id) => !subscribedPresenceUserIds.has(id))
if (nextSubscribedUserIds.length) {
  try {
    await presenceService.subscribeToPresence(nextSubscribedUserIds)
    nextSubscribedUserIds.forEach((id) => subscribedPresenceUserIds.add(id))
  } catch (error) {
    // 订阅失败不得阻断批量查询：订阅集合只在成功后写入，失败用户下一轮自然重试
    logger.warn('presence 订阅失败，继续批量查询:', error)
  }
}
const presences = await presenceService.getBatchPresence(trackedUserIds)
```

**回归约束**

- 订阅集合**只在成功后写入**；失败用户下一轮自然重试（不得提前写入导致永不重试）。
- 批量查询失败时保留 store 原值，**不得**批量写 `OFFLINE`。

**复核命令**

```bash
cd Tjg
pnpm test:run src/composables/app/__tests__/wsPresenceHandler.test.ts
```

---

### 5.4 UI-P1-05 设置搜索：命中路径 + 跳转定位【已落地】

**现象**

`composables/settings/settingsSearchIndex.ts` 的 `SettingsSearchEntry` 只有 `id` + `terms`；`SettingsPage.vue` 只切换到首个命中 Tab，不定位控件。

**修改方案**

1. 建两级索引：`SettingsSearchEntry` 增加 `anchorId` 与 `path`（如 `['外观', '主题']`）；各 Tab 用 `data-settings-anchor="<anchorId>"` 标注锚点。
2. 结果面板展示「设置 > 外观 > 主题」形式路径；选中后 `router.replace` → `nextTick` → `document.querySelector('[data-settings-anchor="…"]')?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion ? 'auto' : 'smooth' })`。
3. 目标控件 2s 高亮 ring，用 `--tjg-color-primary-500` 令牌并尊重 `prefers-reduced-motion`（reduce 时退化为静态描边）。
4. 索引未覆盖的 Tab 保留 Tab 标题命中降级；无结果继续用 `EmptyState illustration="no-results"`。

**异常与边界**

| 场景 | 期望 |
|---|---|
| `anchorId` 在 DOM 中不存在（Tab 内条件渲染未挂载） | 先切 Tab，等 `nextTick` 后再查；两次未命中则退化为仅切 Tab，并在控制台 warn，不抛错 |
| 目标 Tab 因能力不可用被隐藏 | 结果项标注「当前服务器不支持」，点击仅提示不跳转（与 §5.1 的五态语义一致） |
| 锚点在滚动容器内而非 `window` | `scrollIntoView` 对任意滚动祖先有效，无需额外处理；但需确保锚点有 `scroll-margin-top` 以避开吸顶头部 |
| 移动端 | 设置搜索为桌面端能力（`keyboard` Tab 已 `desktopOnly`），移动端子页仍按 Tab 列表导航，不新增搜索框 |

**验收标准**

- 搜索「主题」能看到路径并定位到主题控件，控件有可见高亮。
- 仅命中 Tab 标题时仍能进入该 Tab。
- `prefers-reduced-motion: reduce` 下无平滑滚动、高亮为静态描边。
- 目标 Tab 被能力隐藏时给出「不支持」而非空白页。

**复核命令**

```bash
cd Tjg
pnpm test:run src/views/settingsWindow
grep -rn "data-settings-anchor" src/views/settingsWindow | wc -l   # 期望 > 0
```

---

### 5.5 UI-P1-06 连接状态横幅去重【已落地】

**现象（上一轮）**

`ChatMain.vue` 挂 `SyncStatusBar`，`App.vue` 又挂全局 `ConnectionStatusBanner`，断网时聊天区出现两条语义重复的状态条。

**已落地实现**

1. `ChatMain.vue` 顶部改为 `ChatBanners`，其内容为：网络提示（`networkBannerText`）、公告、`E2EEBanner`、`PrivateModeBanner`、`ScreenshotWatermark`、`StickyEventBanner`——**不含**连接状态条。
2. 连接状态统一由 `App.vue` 的 `ConnectionStatusBanner` 承载。
3. `components/connection/SyncStatusBar.vue`（251 行）与 `__tests__/SyncStatusBar.test.ts` **已无任何真实引用**，仅在自动生成的 `typings/components*.d.ts` 中出现 ⇒ 已成为死组件 + 死测试。

**回归约束**

- 聊天区**不得**再引入第二个「连接/同步状态」组件；若需要同步历史进度，只能作为 `ChatBanners` 内部的一条**非状态类**进度提示，且全局横幅处于 `offline / reconnecting / error` 时不渲染。
- 删除 `SyncStatusBar.vue` 与其实测需同步清理 `typings/*`（生成物，`git checkout --` 还原）。

**复核命令**

```bash
cd Tjg
grep -rn "SyncStatusBar" src --include=*.vue --include=*.ts | grep -v "typings/"
# 期望：无输出（仅 typings 命中即为死组件）
```

---

### 5.6 UI-P1-07 响应式断点体系收敛【已落地】

**现象（本轮重取）**

1. `styles/scss/global/responsive.scss` 定义 `md 768 / lg 992 / xl 1200`，导出 `respond-to`（min-width）与 `respond-to-max`（max-width）两个 mixin。
2. `respond-to-max('md')` 已被 **15 个文件**采纳（10 个 admin 视图 + `AdminBulkActionBar` + `AdminStatCard` + `SettingsContent` + `SettingsSidebar` + `layout/left/style.scss`；`responsive.scss` 是定义文件不计），但**只用 `md` 一档**，`lg` / `xl` 无采纳。
3. TS 侧 `useResponsiveBreakpoint` 的断点是 **1440 / 1024**，与 SCSS 不同源；仅 `layout/center` 与 `layout/right` 消费。
4. 聊天主壳无宽度适配：`ChatMain.vue` 只有 `useIsMobile()` 布尔分支。

> 即：**不是"从零开始"，而是"两套断点 + 只用了一档"**。上一版「采纳 0 次 / 媒体查询 13 文件」的表述作废。

**修改方案**

1. **确定唯一断点源**：以需求文档 8.1 的 768 / 992 / 1200 为准，改写 `useResponsiveBreakpoint` 的 `DEFAULT_BREAKPOINTS`（`wide: 1200`、`normal: 992`、`shrink: 768`），并让 `CENTER_WIDTH_MAP` 与之对应。
2. `responsive.scss` 的 `$breakpoints` 与 TS 常量共用同一组数值，在 `design-baseline.test.ts` 中断言两者相等（读取 SCSS 源文件文本 + TS 常量对比），防止再次漂移。
3. 聊天主壳按统一断点驱动：`<768` 单栏、`768–991` 双栏 + 抽屉、`992–1199` 轻四栏、`>=1200` 四栏（与 §6.1 的 240px 面板方案共用同一套断点）。
4. 存量 `respond-to-max('md')` **不强制改写**（已是统一源），只补 `lg`/`xl` 缺失档；原生 `@media (max-width…)` 仅 3 个文件，逐文件替换为 mixin。

**异常与边界**

| 场景 | 期望 |
|---|---|
| 窗口宽度恰好等于断点值（768/992/1200） | `min-width` 用 `>=`、`max-width` 用 `<=` 会重叠 1px；统一采用「`>=` 命中上一档」的规则，并在 `design-baseline.test.ts` 钉死 768/769、992/993、1200/1201 六个点的期望值 |
| Tauri 窗口缩放 / 多显示器 DPI | 断点基于 CSS 像素，`devicePixelRatio` 变化不应改变断点判定；不使用 `window.innerWidth` 的物理像素换算 |
| 移动端产物 | 移动端走 `#/*` 独立路由与 `src/mobile/**`，**不受本方案影响**；但 `useResponsiveBreakpoint` 若被移动端意外引入，需确认不触发桌面布局分支 |
| 悬浮窗 / 独立聊天窗口（`/window/chat/:roomId`） | 该窗口宽度通常 < 768，应走单栏；需在实现时用同一 composable，不得写死 |

**验收标准**

- 断点常量在 SCSS 与 TS 两侧断言一致（`design-baseline.test.ts` 红/绿自证）。
- 1280 / 1024 / 900 / 768 / 480 五档手工检查通过，无横向滚动、无控件溢出。
- 聊天主壳在 4 档断点下分别呈现单栏/双栏+抽屉/轻四栏/四栏。
- `respond-to-max` 的采纳文件数只增不减，且新增必须带 `lg`/`xl` 用例。

**复核命令**

```bash
cd Tjg
grep -rn "respond-to" src --include=*.scss --include=*.vue | wc -l
grep -rn "isShrink\|isRightPaneFullscreen" src/layout
pnpm test:run tests/lint/design-baseline.test.ts
```

---

## 6. P2 详细方案

### 6.1 UI-P2-01 四栏布局：补齐 240px 可折叠信息面板【已修复】

**已落地实现（2026-11-02）**

1. 信息面板：`composables/chat/useChatSidebar.ts` 提供折叠/抽屉/隐藏三态与左缘拖拽；`ChatSidebar.vue` 面板默认 `240px`（由 `useRightPaneWidth` 的 `width` 覆盖），折叠为 `w-0`，`768–991px` 改为右侧固定抽屉 + 遮罩。
2. 弹性主区：`useRightPaneWidth.ts` 的 `DEFAULT_MIN = 240`，`VIEW_WIDTH_MAP` 移除 `chat`，`layout/right/index.vue` 对聊天视图使用 `flex: 1 1 auto; min-width: 0`，拖拽把手仅在非弹性视图渲染。
3. 持久化：折叠状态 `tjg.chatSidebar.collapsed`、宽度 `tjg.rightPaneWidth`（按视图 key 存 JSON 映射）分键保存；写盘前与磁盘现值合并，避免多处实例互相覆盖。此前不存在旧折叠键，因此无需迁移。
4. 把手显隐：面板折叠、抽屉、单栏模式下拖拽条 `v-if` 不渲染，避免"拖不动的把手"。

**回归约束**

- `DEFAULT_MIN` 不得回退到 360；`chat` 不得重新加入固定宽度表。
- 折叠、抽屉、单栏三种状态下不得渲染 `chat-sidebar-resize`。
- 断点行为不得脱离 `useResponsiveBreakpoint` 的 `wide/normal/shrink/single` 四档。

**验收标准**

- `>=1200px` 四栏完整、面板 240px；`992–1199px` 可折叠；`768–991px` 抽屉；`<768` 不渲染面板。
- 拖拽后刷新保留宽度，聊天主区随窗口伸缩。

---

### 6.2 UI-P2-02 硬编码颜色收敛【已落地 2026-11-02】

**现状**：`pnpm check:ratchet` ⇒ `hardcoded_color: 0`（baseline 0，已从 24 下调至 0）。

**已落地实现**

1. 逐处替换为 `design-tokens.css` 已有令牌（含暗色值）；透明叠色统一改用 `color-mix(in srgb, var(--tjg-*) N%, transparent)`。
2. ratchet 基线同步下调至 0，`pnpm check:ratchet` 与基线一致。

**回归约束**：新增代码不得再引入 `#xxx` / `rgb()` / `rgba()` 字面值；`hardcoded_color` 基线只能保持 0 或继续下降。

---

### 6.3 UI-P2-03 弹窗收敛为抽屉【进行中：设置模块第一批已落地】

**现状**：170 处 / 50 文件（上一轮 298 / 101，本批 197 → 170）。

**已完成批次（2026-11-02，设置模块第一批）**

| 文件 | 改动 | 保留 Modal 的部分 |
| :--- | :--- | :--- |
| `settingsWindow/tabs/MjolnirSettings.vue` | 3 个添加规则弹窗（房间/用户/服务器）→ 右栏抽屉 380 | 删除规则仍用 `dialog.warning` |
| `settingsWindow/tabs/FriendsSettings.vue` | 新建分组 / 编辑分组 → 抽屉 | 删除分组用 `dialog.warning` |
| `settingsWindow/tabs/KeyboardSettings.vue` | 快捷键编辑（只读展示）→ 抽屉 | — |
| `settingsWindow/tabs/SessionSettings.vue` | 重命名设备 → 抽屉 | 删除会话用 `dialog.warning` |
| `settingsWindow/tabs/sections/BlockedUsersSection.vue` | 添加屏蔽用户 → 抽屉 | 取消屏蔽直接执行 |
| `settingsWindow/tabs/sections/PrivateChatSection.vue` | 设置密码 → 抽屉 | — |
| `settingsWindow/tabs/AddPusherDialog.vue` | 整卡改抽屉，表单标签改 `top` 适配窄栏 | — |
| `settingsWindow/tabs/EncryptionSettings.vue` | 未改：设备密钥指纹为只读信息展示 | 保留 Modal |

**修改方案**

1. 分类：编辑类（设置、房间信息、好友资料）→ 右栏抽屉；确认类（删除、封禁、退出）→ 保留 Modal；一次性提示 → Toast/Dialog。
2. 按模块分批：设置 → 房间 → 好友 → 空间 → 管理后台，每批更新基线计数。
3. 统一写法：`<n-drawer placement="right" :width="380">` + `<n-drawer-content :title closable>`，底部按钮进 `#footer`（UnoCSS `flex justify-end gap-12px`，不新增内联样式）。
4. 语义保持：原 `preset="dialog"` 的 `@positive-click` 返回 `false` 不关闭 → 抽屉侧用 `submitX` 包装器判断 `=== false` 后显式关闭；handler 自身已关闭的不再重复包装。

**验收标准**：计数继续单调下降；关键编辑路径不再打开居中大弹窗。

---

### 6.4 UI-P2-04 文档-代码一致性维护【仍成立】

**剩余工作**

1. 需求文档 10.2 路由表与 `src/router/routes/*.ts` 全量逐条核对。**注意**：10.2 已按实测校正为 `/message`、`/friend`、`/room`、`/space`、`/federation`（子路由为绝对路径），核对时以文档 v2.5 为准，不要按旧的 `/home/*` 写法反推代码。
2. 10.3 管理后台路由与 `useAdminNav.rawNavGroups` 的 7 组核对（`/admin/guests`、`/admin/spaces` 分组归属）；`AdminLayout.vue` 已拆出 `AdminSidebar.vue`，核对对象是 `rawNavGroups` 而非模板。
3. 固定一份「文档-代码核对清单」，路由或设置项变更时同步更新；契约数字统一由 `check-integration-map-freshness.mjs` 的 `numbers` 块现场重算。

**验收标准**：10.2 / 10.3 与路由表零差异；5.7 / 5.8 的分组数量与代码一致。

---

### 6.5 UI-P2-05 解密失败提示与重试【已落地 2026-11-02】

**现象（补充取证）**：`stores/domains/chat/room/sync.ts` 里 `isBadEncrypted` 只用于把 `msgEnum` 归为 `MsgEnum.TEXT`，渲染层无任何"无法解密"分支 ⇒ 用户看到的是空文本气泡。

**修改方案**

1. `renderMessage/index.vue` 识别 `m.bad.encrypted` / UTD，渲染「无法解密 + 重试 + 查看原始事件」卡片。
2. 重试调用 SDK 已导出的解密入口（实现前先核对 vendored tarball 的 `decryptEventIfNeeded` / `attemptDecryption`），成功原地替换内容。
3. 失败保持卡片，不删消息、不清输入；设备未验证时复用 `DeviceVerifyDialog`。

**异常与边界**：重试需单飞（同一事件并发点击不重复解密）；重试成功必须以**同一事件 ID** 原地替换，不得追加新消息（避免破坏排序与已读回执）；`m.bad.encrypted` 事件可能没有 `body`，卡片文案不得依赖正文。

**验收标准**：UTD 有提示与重试；重试成功渲染正常、失败不产生重复消息；不影响排序与已读回执。

**落地实现（2026-11-02）**：

1. 数据层：`MessageType.message.isBadEncrypted`；`MatrixEventService` 的两个转换函数按 `content.msgtype === 'm.bad.encrypted'` 写入标记（不依赖正文）；`sync.ts` 增量时间线同样写入。
2. 服务层：`MatrixMessageService.retryDecryptMessage` 走 SDK `MatrixEvent.attemptDecryption(crypto, { isRetry: true })`（SDK 对 UTD 事件的 `shouldAttemptDecryption()` 已返回 false，必须显式重试）；`getRawMessageJson` 返回 `getEffectiveEvent()` 的线格式 JSON。`client.getCrypto()` 返回 `CryptoApi` 而 SDK 形参是内部 `CryptoBackend`，故在 augmentation 中追加 `CryptoApi` 形参重载，避免 `as any` / `as unknown as`。
3. 渲染层：新增 `DecryptionFailureCard.vue`，置于 `BurnMessage` 与 `MessageTrustGate` 之间（信任门禁只是视觉遮挡，放进内部会导致重试按钮不可点）；重试单飞由按钮 disabled 与 SDK `decryptionPromise` 双重保证。
4. 回写：SDK emit `Event.decrypted` → `MatrixEventRouter.eventDecrypted` → `sync.ts` 用同一事件 ID `updateMsg({ body, type, isBadEncrypted: false })` 原地替换，不追加新消息。
5. 测试：`DecryptionFailureCard.test.ts`（6 例）、`MatrixMessageService.test.ts` 新增 `retryDecryptMessage` 7 例与 `getRawMessageJson` 3 例。

---

### 6.6 UI-P2-06 空间房间空状态区分【已落地 2026-11-02】

1. 按 `searchQuery.trim()` 二选一：有搜索词 → `no-results`；无 → 新增 `no-rooms` 插图。
2. `EmptyState.vue` 扩展第 6 类插图，同步更新需求文档 6.1 的「五类」表述（**文档与代码必须同批改**，否则下一轮审计会再次判为不一致）。
3. 文案区分：「该空间还没有房间」/「没有匹配的房间」。

**落地实现（2026-11-02）**：`SpaceRoomGrid.vue` 新增可选 prop `searchQuery`，由 `hasSearchQuery` 计算 `emptyIllustration`（`no-results` / `no-rooms`）与 `emptyTitle`；`EmptyState.vue` 新增 `no-rooms` 第 6 类插图；`locales/{zh-CN,en}/space.json` 增加 `no_matching_rooms`；需求文档 §6.1 与附录 A 已同批改为「六类」。`SpaceRoomGrid.test.ts` 22 例覆盖两种空态。

---

### 6.7 UI-P2-08 Mjolnir Tab 能力判定（收尾）【已落地 2026-11-02】

**现状**：`DehydratedDeviceSection.vue` 已按 `isSupported()` fail-closed；`MjolnirSettings.vue` 内 `admin-api` / `capability` / `PermissionGuard` 0 命中。

**修改方案**

1. `mjolnir` Tab 在 `settingsSchema.ts` 已声明 `requiredCapability: 'admin-api'` + `capabilityFallback: 'hide'`，壳层已生效，但 Tab 内部仍可被深链或其他入口触达 → 在 Tab 内补 `PermissionGuard` 二次门控。
2. 补一条单测：`admin-api` 不可用时 `MjolnirSettings` 不渲染操作区。

**落地实现（2026-11-02）**：`MjolnirSettings.vue` 根节点内包裹 `<PermissionGuard :require="'admin-api'">`，覆盖设置区、按钮与三个 `n-modal`；`MjolnirSettings.test.ts` 新增「`admin-api` 不可用时只有壳层、无 `.settings-section` / button」用例（共 11 例）。

---

### 6.8 UI-P2-09 能力未加载时避免 Tab 闪烁【已落地 2026-11-02】

**现状**：`useSettingsShell.matchesCapability` 在 `isCapabilityLoaded === false` 时返回 `true`，Tab 先显示后隐藏。

**修改方案**

1. 未加载时仍返回 true（避免设置页空白），但侧栏渲染骨架（`SkeletonBase`）并禁用点击，加载完成后一次性切换可见集合。
2. 深链兜底保持 `SettingsPage.vue` 的现有实现，加载完成后再判定，避免误回退。

**异常与边界**：探测失败（`refreshCapabilities` 写入空对象并置 `isLoaded=true`）时必须视为"已加载但全不可用"，走严格过滤，**不得**停留在骨架态。

**验收标准**：慢网 3G 模拟下 Tab 列表无「出现-消失-再出现」；深链指向被隐藏 Tab 时一次性回退。

**落地实现（2026-11-02）**：`SettingsSidebar.vue` 新增 `capabilitiesLoaded` prop（默认 `true`），`SettingsPage.vue` 传入 `isCapabilityLoaded`；未加载时 `aside` 置 `aria-busy`、搜索框 `disabled`、分组区首个分支渲染 `settings-sidebar-skeleton`（4 条 `SkeletonBase`，按 settings/preferences/tools 分组占位）且不渲染真实 Tab；加载完成后一次性切换。探测失败（`isLoaded=true` 且能力为空）时 `capabilitiesLoaded=true`，走严格过滤，不停留骨架态。`SettingsSidebar.test.ts` 5 例覆盖骨架、禁用与切换。

---

### 6.9 UI-P2-10 移除内联样式上色【已落地 2026-11-02】

`AdminModules.vue` 的 `statusColor()` 内联 `backgroundColor` 已改为 `status-dot--{status}` 状态类 + `--tjg-status-*` 令牌，`statusTagType` 保持语义映射。

**回归约束**：`AdminModules.test.ts` 断言状态点无内联 `style`、只带状态类名，防止回退。

---

### 6.10 UI-P2-11 私密模式图标改为线宽路径图标【已落地 2026-11-02】

`ChatHeader/ChatHeaderToolbar.vue` 的 `<svg><text>S</text>` 已改为 24×24、`stroke-width="1.5"` 的锁形路径（`rect` 锁体 + `path` 锁梁），颜色随 `currentColor`，激活态由按钮自身 token 控制。

**回归约束**：`ChatHeaderToolbar.test.ts` 断言图标为路径绘制且不含 `<text>` 字形节点。

---

## 7. 能力缺口方案

| ID | 落地方式 | 关键实现点 | 异常/降级 | 验收标准 |
|---|---|---|---|---|
| G-01 | 新增 `/admin/telemetry` 页 | 复用 `AdminFacadeService.telemetry` 的 6 方法：状态卡（`getStatus` + `getHealth`）、指标摘要（`getMetricsSummary`）、告警列表（`listAlerts` + `acknowledgeAlert`）、资源属性（`getResourceAttributes`） | `unsupported` 时显示"未启用"而非报错；告警确认需二次确认与失败回滚 | 页面可查看状态/指标/告警，告警可确认；空态与错误态齐备 |
| G-02 | 新增 `/admin/background-updates` 页 | 复用 `backgroundUpdates`：任务列表、进度、触发与中止 | 中止为不可逆操作，需二次确认；进度轮询需可停 | 列表可见进度与状态；操作有结果回执 |
| G-03 | 线程详情增加「冻结 / 解冻 / 静音」 | `freezeThreadViaApi` / `unfreezeThreadViaApi` / `muteThreadViaApi`；状态回写线程头 | 冻结后输入框必须禁用并给出原因；静音沿用房间静音的可发现性模式 | 冻结后线程只读并可解冻；静音状态持久化且线程列表有标识 |
| G-04 | 消息定时发送 | 需先确认产品需求；确认后按 MSC4140 7 条端点接 `send/delay/cancel/update/restart` 语义 | 离线时不得假装成功；取消失败要保留原任务并提示 | 定时消息可取消、可改期；失败有明确错误 |
| G-05 | CAS 登录按钮 | 仅在 `login/cas` 探测可用时渲染，与现有第三方登录同区 | 未配置时不出现入口（不是置灰）；回跳参数缺失要有兜底 | 未配置 CAS 时不出现入口；跳转与回跳参数正确 |
| G-06 | 访客模式入口与升级 | `register/guest`、`account/guest`、`account/guest/upgrade` | 升级失败需可重试且不丢会话；访客受限能力要显式标注 | 访客可受限使用；升级后会话与数据保持 |
| G-07 | 存储设置增加配额卡片 | `getQuotaAlerts` / `checkQuota` / `getQuotaStats`；admin 侧 `GET /_synapse/admin/v1/media/quota` 单独做全局视图 | 超限提示必须在上传前触发；配额接口失败不得阻断上传主链 | 展示已用/上限/告警；超限时上传前提示 |
| G-08 | 房间扩展字段展示 | `event_perspective`、`external_ids`；先确认字段语义 | 字段缺失时整块不渲染（不留空占位） | 字段存在时展示，缺失时无痕迹 |

**共同约束**：全部新增入口必须具备能力探测与 `unsupported` 降级，禁止「渲染一个必然失败的按钮」。降级语义与需求文档 7.8 的三态一致（加载中 / 可用 / 不可用），不得自创第四种。

**落地状态（2026-11-02）**

- G-01 已落地：`views/admin/AdminTelemetry.vue` + `composables/admin/useAdminTelemetry.ts`，路由 `adminTelemetry`（`/admin/telemetry`），导航项 `admin.nav.telemetry`；`status` 与 `metrics` 同时为空时降级为「能力未启用」，告警确认走二次确认对话框并 `refresh=false` 重拉。
- G-02 已落地：`views/admin/AdminBackgroundUpdates.vue` + `composables/admin/useAdminBackgroundUpdates.ts`，路由 `adminBackgroundUpdates`（`/admin/background-updates`），导航项 `admin.nav.backgroundUpdates`；启动/中止/重试/清锁均二次确认，自动刷新为显式开关（`AUTO_REFRESH_INTERVAL_MS = 15_000`），卸载时 `stopAutoRefresh` 停表。
- G-03 已落地：`components/thread/ThreadPanel.vue` 头部新增冻结/静音状态标签与操作按钮（图标用 Iconify，非字形），状态经 `getRoomThreadViaApi` 读取 `detail.summary.is_frozen` / `detail.user_subscription.is_muted`；冻结时 footer 输入区降级为只读并给出原因，发送入口双重守卫；操作失败保留原状态并回执错误。测试：`ThreadPanel.test.ts`（10 例）。
- G-07 已落地：三处接线——① `views/settingsWindow/tabs/StorageSettings.vue` 新增服务端媒体配额三态卡片（loading / available / unavailable），展示已用/上限/剩余/媒体数量与告警列表；② `composables/chat/useMsgInputFileUpload.sendFilesDirect` 在上传前批量预检 `checkQuota()`，仅当 `limit > 0 && remaining < 总大小` 时提示并中止（不建队列、不插占位消息）；③ `views/admin/AdminMaintenance.vue` 新增服务端全局配额卡（`getServerQuota()`）。配额接口失败时 `checkQuota` 返回 `null` 直接放行，`getQuotaStats` / `getQuotaAlerts` 各自降级，不阻断上传主链。测试：`StorageSettings.test.ts`（8 例）、`useMsgInputFileUpload.test.ts`（4 例）、`useAdminMaintenance.test.ts`（9 例）。
- 回归约束：G-03 不得移除冻结只读降级与发送守卫；G-07 不得把配额预检改成抛错阻断，也不得在 7 个 `upload*` 方法内逐个加检查（会造成每次上传额外请求）。
- 回归约束：两页不得删除 `unsupported` 降级与二次确认；后台更新轮询不得改为不可停的默认轮询。
- 测试：`useAdminTelemetry.test.ts`、`useAdminBackgroundUpdates.test.ts`、`AdminTelemetry.test.ts`、`AdminBackgroundUpdates.test.ts`。

---

## 8. 优先级与排期

> 全部为前端改动；不改后端路由、不改 SDK 契约，`meta/sdk-pin.json` 无需更新。每阶段结束跑完整回归，阶段之间不夹带重构。

**阶段 0：清理已关闭项的残留（新增，半天量级）**

1. 删除 `components/connection/SyncStatusBar.vue` 与 `__tests__/SyncStatusBar.test.ts`（UI-P1-06 的死组件 + 死测试），同时 `git checkout -- src/typings/` 还原生成物。
2. 回写状态：把 UI-P1-02/03/04/06 标为已修复，并把 §5 的对应小节转为回归约束（本文件已完成）。

**阶段 A：正确性收敛（P1 剩余）**

3. UI-P1-03 收尾（删除 `useWsEventHandler.applyUserPresence` 第二写入点 + 注释纠偏）——改动最小、与已落地部分同源。
4. UI-P1-05（设置搜索两级索引 + 锚点定位）。
5. UI-P1-07（断点统一）——先统一常量并加两端断言，再改主壳。

**阶段 B：管理后台与能力入口（P1）**

6. 【已完成 2026-11-02】G-01、G-02（遥测页、后台更新页）——与 `useAdminNav` 的能力探测基建共用。
7. （可选，若与 G-01 同批）Admin 媒体子域页面 —— 见 §3.4 注 2。

**阶段 C：布局（P2）**

8. 【已完成 2026-11-02】UI-P2-01（240px 信息面板，分两次提交）——依赖阶段 A 的断点常量。

**阶段 D：体验细节（P1 + P2）**

9. 【已完成 2026-11-02】UI-P2-09（Tab 闪烁）、UI-P2-06（空态）、UI-P2-05（解密重试）、UI-P2-08（Mjolnir 收尾）。

**阶段 E：视觉与低风险能力（P2）**

10. 【已完成 2026-11-02】UI-P2-02（令牌替换，`hardcoded_color` 基线 24 → 0）、UI-P2-10、UI-P2-11。
11. 【G-03 / G-07 已完成 2026-11-02】线程冻结/静音、媒体配额三处接线；UI-P2-03（弹窗分批）仍待做。
12. G-04 / G-05 / G-06 / G-08——需产品确认，确认后单独排期。

**阶段 F：文档与守卫**

13. UI-P2-04（文档核对清单 + `numbers` 块机制）。

**状态对照（便于跟踪）**

| 阶段 | 覆盖项 | 前置依赖 |
|---|---|---|
| 0 | SyncStatusBar 残留清理 | 无 |
| A | UI-P1-03 收尾、UI-P1-05、UI-P1-07（已完成 2026-11-02） | 无 |
| B | G-01、G-02（已完成 2026-11-02） | `useAdminNav` 基础（已具备） |
| C | UI-P2-01（已完成 2026-11-02） | 阶段 A 的断点常量 |
| D | UI-P2-05/06/08/09（已完成 2026-11-02） | 无 |
| E | UI-P2-02/10/11、G-03/G-07（已完成 2026-11-02）；UI-P2-03 待做 | 无 |
| F | UI-P2-04 | 其余阶段完成后统一核对 |

---

## 9. 验收矩阵与完成定义

| 需求章节（基准 v2.5） | 验收点 | 自动化 |
|---|---|---|
| 5.2 消息主界面 | 解密失败有提示与重试；240px 面板可折叠 | `DecryptionFailureCard.test.ts`、`MatrixMessageService.test.ts`（`retryDecryptMessage` / `getRawMessageJson`）、`useChatSidebar.test.ts`、`ChatSidebar.test.ts`、`useRightPaneWidth.test.ts`、`rightPane.test.ts` |
| 5.7 设置页 | 14 Tab 分组不变；能力 Tab 按探测隐藏/只读；Mjolnir 二次门控；慢网不闪烁 | `useSettingsShell` 能力组合测试、`MjolnirSettings.test.ts`、`SettingsSidebar.test.ts`（骨架/禁用/切换）、`SpaceRoomGrid.test.ts`（空态区分） |
| 5.8 管理后台 | 六态下菜单与空态正确；两个入口判定一致 | `useAdminNav` 测试、`admin.test.ts` |
| 5.9 / 5.11 | 能力 false 时入口 DOM 不存在 | `ChatMain.test.ts`、`BurnAfterReadSettings.test.ts` |
| 5.10 加密与设备 | 脱水设备 fail-closed；encryption 只读 | `EncryptionSettings.test.ts` |
| 7.1 连接状态 | 单一连接横幅 + 诊断 | `ConnectionStatusBanner.test.ts`、`ChatMain.test.ts` |
| 7.6 在线状态判定 | 单管线、订阅失败不阻断批量、保持上次状态 | `wsPresenceHandler.test.ts`、`presenceSingleWriter.test.ts` |
| 7.8 能力未就绪态 | 三态渲染一致，无无限 spinner | 能力组合测试 + 慢网快照 |
| 8.1 断点 | 四档行为；240px 面板；断点常量两端一致 | `design-baseline.test.ts`、`useResponsiveBreakpoint.test.ts` + 1280/1024/900/768/480 手工检查 |
| 11 后续收敛项 | 搜索命中路径 + 定位；弹窗计数下降；硬编码颜色下降 | `settingsSearchIndex.test.ts`、`settingsAnchorNavigation.test.ts`、ratchet 基线 |
| 本文档 §2 | G-01/G-02 已有可达入口与 `unsupported` 降级；G-03 ~ G-08 按 §7 排期 | 两页测试 + 能力不可用快照 |

**统一回归命令**

```bash
cd Tjg
pnpm test:run                     # 内部走 scripts/run-vitest.js，统一 pool 配置
pnpm typecheck                    # 含 check-generated-typings + vue-tsc --noEmit
pnpm check:ratchet
node scripts/check-file-size.mjs
node scripts/check-integration-map-freshness.mjs
pnpm verify:sdk-pin
```

> **命令口径修正**：上一版用 `pnpm vitest run <path>`，会绕过 `scripts/run-vitest.js` 的池配置，在并行负载下易被饿死；单文件调试请用 `pnpm test:run <path>` 或 `node scripts/run-vitest.js run --no-file-parallelism <path>`。另注意 `pnpm check` 会先跑 `gen:i18n`（有写盘副作用），**不要**在需要干净工作区的验收步骤中使用。

**完成定义（Definition of Done）**

1. P1 清零：UI-P1-05、UI-P1-07 关闭 + UI-P1-03 的第二写入点消除，且各项有对应单测/断言（UI-P1-01/02/04/06 已关闭，只需回归守住）。
2. P2 收敛：`hardcoded_color` 已降到 0 并锁定基线；`NModal` 计数继续单调下降（当前 170，设置模块第一批 197 → 170），每批完成后同步下调记录基线。
3. 能力缺口：G-01、G-02、G-03、G-07 已落地并有测试；G-05、G-06 待补入口；G-04 / G-08 待产品结论。
4. 残留清理：`SyncStatusBar.vue` 与其实测已删除，`typings/` 无该符号。
5. 未取证项清零：Worker 管理面、第三方 3PID、媒体子项三项补齐取证后再更新 §1.3；A-01 在 Storybook 可达后单独补测。
6. 门禁全绿：`test:run`、`typecheck`、`check:ratchet`、`check-file-size`、`check-integration-map-freshness`、`verify:sdk-pin` 无失败。

---

## 10. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| 能力过滤导致入口「消失」引发困惑 | 中 | 深链命中被隐藏 Tab 时一次性回退 + 说明；设置页提供「能力诊断」入口 |
| Presence 管线合并引入回归 | 高（**主体已落地，收尾未完成**） | 已删除 `usePresenceSync`；剩余 `useWsEventHandler.applyUserPresence` 第二写入点需并入 `applyPresencePatch`，并以不变量单测守住「写入点唯一」 |
| 断点统一改动面大 | 高 | 先统一常量并加两端一致性断言，再逐壳替换；每壳独立提交 |
| 四栏改造影响拖拽持久化 | 中 | 先加面板、后改弹性宽度；旧宽度配置读取时做一次迁移 |
| 硬编码颜色替换导致暗色偏差 | 中 | 先补令牌再替换；逐文件亮/暗双检；基线随替换同步下调 |
| 弹窗批量改造范围过大 | 中 | 按模块分批，每批独立评审；确认类弹窗不动 |
| 新增管理页面对 300 条端点理解偏差 | 中 | 以 `ROUTE_CONTRACT.md` 的请求/响应结构为准，先写契约测试再接 UI |
| 审计结论再次漂移（本轮已发生 4 次） | 高 | 每项必须带复核命令与取证日期；状态变更必须回写 §4 与 §0.2 两处 |

**回滚策略**：每项按 ID 独立提交，回滚按阶段 F → 0 逆序 revert；不涉及数据迁移与契约变更，回滚后仅需重跑统一回归命令。已落地项（UI-P1-02/03/04/06）如需回滚，注意 UI-P1-06 已产生死组件清理，回滚时要一并恢复 `SyncStatusBar.vue`。

---

## 附录 A：本次复核确认「已符合」的条款（避免重复投入）

- **能力降级基础设施已达标**：`SettingsTab` 具备 `desktopOnly` / `requiredCapability` / `capabilityFallback`；能力 Tab 已声明依赖（`voiceVideo→voip`、`encryption→e2ee`（readonly）、`mjolnir→admin-api`、`friends→friend-list`、`burnAfterRead→burn-after-read`）；壳层过滤、`isTabReadOnly`、深链回退均已接线。
- **管理后台探测与五态已达标**：`useAdminNav` 提供六态 `navState`、`visibleNavGroups`、`showSkeleton`、`retryProbe`；`AdminSidebar` 消费；`AdminLayout` 仅在 `ready` 渲染业务路由。
- **Presence 单管线已基本达标（差收尾）**：`usePresenceSync` 已删除、订阅失败不阻断批量查询已修；仍存 `useWsEventHandler.applyUserPresence` 第二写入点，见 §5.2。
- **连接状态单横幅已达标**：`ChatBanners` 不含连接状态，全局 `ConnectionStatusBanner` 唯一。
- **组件级能力门控已达标**：`ChatHeader/ChatHeaderToolbar.vue` 的 voip 区块与 burn-after-read 区块、`BurnAfterReadBar.vue` 均使用 `PermissionGuard`（默认 hide）。
- **脱水设备 fail-closed 已达标**：`DehydratedDeviceSection.vue` 以 `isSupported()` 决定是否渲染按钮与管理器。
- **组件体量红线已达标**：`src/**/*.vue` 无超过 800 行文件（最大 763 行）。
- 14 个设置 Tab 的数量、顺序与分组与 5.7 一致；`keyboard` 的 `desktopOnly` 正确；`SETTINGS_CANONICAL_ROUTE_SEGMENTS` 无 `sidebar` 残留。
- `EmptyState` 具备 6 类插图（含本轮新增 `no-rooms`），`SpaceListPane` 已正确区分 `no-spaces` / `no-results`，`SpaceRoomGrid` 已区分 `no-rooms` / `no-results`。
- 设计令牌齐备（`--tjg-*`、状态色、动效时长、`--admin-*`），暗色模式有独立值。
- `prefers-reduced-motion` 覆盖 59 处 / 53 文件，含全局入口。
- `SkipLink`（`#center`、`#chat-main`）与 `GlobalAriaLive` 已接线；图标按钮普遍带 `aria-label`；`AdminLayout` 头部移动端菜单按钮带 `aria-expanded`。
- `authGuard` 对 `requiresAdmin` 失败给出提示并返回安全位置，符合 10.5。
- `TjgMessageMeta` 已实现发送中状态与失败重试。
- 登录页无 LiveKit `ws_url` 读取/展示，无「动态缩略图」开关，符合 5.11。
- `AdminApiProbeService` 具备 `available / forbidden / unauthorized / unsupported / unavailable` 五态分类，`useAdminNav` 直接复用，无需新增探测能力。
- 房间 vendor 能力中 anti-screenshot 已覆盖（`AntiScreenshotSetting.vue`、`useRoomAntiScreenshot.ts`、`ScreenshotWatermark.vue`）。

---

## 附录 B：取证命令与原始输出

```bash
# 契约三口径
python3 ../synapse-rust/scripts/contract/route_metrics.py --json

# 项目侧计数（numbers 块由该脚本现场重算）
node scripts/check-integration-map-freshness.mjs --print

# UI 守卫
node scripts/check-ratchet.mjs
node scripts/verify-sdk-pin.mjs
node scripts/check-file-size.mjs

# 本轮新增/复核用的取证
rg -e NModal -e n-modal src --glob "*.vue" --glob "*.tsx" --count-matches | wc -l     # 170
grep -rEl "respond-to-max" src | wc -l                                      # 16
grep -rn "SyncStatusBar" src --include=*.vue --include=*.ts | grep -v typings/   # 空
grep -rn "updateContactPresence\|updateUserPresence" src | grep -v __tests__     # 仅 wsPresenceHandler
```

`check-integration-map-freshness.mjs --print` 本轮输出要点（原样摘录，未加工）：

```text
backend_routes=980
private_routes=545
route_modules=75
ledger_schema=4
state_profile=all
private_on_std_friends=0
private_on_std_spaces=4
private_on_std_threads=7
private_on_std_summary=1
private_on_std_widgets=0
private_on_std_report=3
private_on_std_voice=0
private_on_std_sticky=3
sdk_version=40.2.0-langkebo.7
sdk_commit=a238dd67a
matrix_service_files=236
matrix_service_tests=246
base_matrix_service_subclasses=38
tauri_command_modules=18
sdk_manager_accessors=112
sdk_manager_toggles=101
__unavailable=
```

`check-ratchet.mjs` 本轮输出（全部等于基线，无新增债务）：

```text
matrix_prefix_hardcoded: 23 (baseline 23)
ts_expect_error: 3 (baseline 3)
hardcoded_color: 24 (baseline 24)
hardcoded_radius: 0 (baseline 0)
inline_style: 5 (baseline 5) —— 全部命中具名 allowlist
important_css: 82 (baseline 82)
zh_literal_vue: 149 (baseline 149)
is_mobile_branch: 19 (baseline 19)
as_unknown_as: 0 (baseline 0) —— 剩余双重断言全部命中具名 allowlist
```

**口径差异说明**

1. `route_modules=75` 与 ROUTE_CONTRACT 正文的「67 个含路由注册模块」统计粒度不同（前者按注册元数据聚合，后者按源码模块去重）。本文件 §1.1 同时列出，不做合并。
2. `private_routes=545` 与 `private_on_std_*` 是 Tjg 侧私有扩展路由的口径，不能与 980 直接相加或相减。
3. `scripts/contract-coverage-map.json` 的 `uncoveredPathCount` **不得**作为「前端未覆盖数」使用：该文件上次生成于 2026-10-19（ledger 1027 / commit `8072be84c`），已与当前契约不一致，且 801 条未覆盖中包含联邦、AppService、装配等非客户端可消费路由。本报告的能力覆盖结论一律来自 §1.3 的逐族取证。
4. 未取证项（Worker 管理面、第三方 3PID、媒体部分子项、`check:a11y` 结果）在补齐前不计入「已覆盖」与「已完成」。

---

## 附录 C：术语与编号对照

| 术语 | 本文档含义 | 不要混用 |
|---|---|---|
| 能力探测 | 从 `/versions` + `/capabilities` + `/client/config` 三源合并出能力位的过程（`MatrixCapabilityService`） | 「能力判定」（指使用探测结果做门控） |
| 三态 | 加载中 / 可用 / 不可用（UI 渲染口径，对应需求文档 7.8） | 管理后台的「六态」（`loading/ready/forbidden/unauthorized/unsupported/unavailable`） |
| 五态 / 六态 | `AdminApiAvailability` 的探测分类：`available` + 四种非 available 结果 | 三态 |
| 已落地 | 修复已在 HEAD 生效，方案转为回归约束 | 「已修复」（现象消失但未沉淀约束） |
| 逐模块口径 | `ROUTE_CONTRACT.md`「模块级路由清单」按模块统计（如管理 150） | 命名空间口径（`/_synapse/admin` 300） |
| 死组件 | 文件存在但无任何真实引用，仅出现在自动生成的 `typings/*` | 孤儿组件（本项目实测为 0） |
