# Tjg（天机阁）UI 界面需求文档

> 版本：2.6  
> 日期：2026-11-27  
> 项目：Tjg（天机阁）前端应用  
> 技术栈：Vue 3、Tauri 2、TypeScript、Vite、Pinia、UnoCSS  
> 文档状态：按实际截图与原型校准布局，并按后端真实路由与 SDK 能力面校准功能前提；v2.5 起所有端点计数以 `route_metrics.py` 实测为准，人工汇总值仅作定性参考  
> 代码基线：`Tjg/src`、`Tjg/locales`、`Tjg/src-tauri`  
> 能力基线：`synapse-rust/docs/synapse-rust/ROUTE_CONTRACT.md`（2026-10-31 生成，980 注册条目）、`synapse-rust/docs/synapse-rust/ROUTE_HANDLERS.json` + `synapse-rust/scripts/contract/route_metrics.py`（三口径唯一实现）、`synapse-rust/synapse-services/src/capability_governance.rs`（`/capabilities` 构造面）、`synapse-rust/docs/synapse-rust/MSC_SEMANTICS.md`（MSC 语义唯一真相源）、`matrix-js-sdk/src/server-capabilities/index.ts`、`Tjg/src/services/matrix/MatrixCapabilityService.ts`  
> 关联文档：`Tjg/docs/TJG-prototype.html`、`docs/adr/ADR-003-tjg-greenfield-rewrite.md`、`docs/glossary/tjg-glossary.md`、`docs/UI优化方案-v2.4.md`、`Tjg/docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md`

## 更新说明

### v2.6

| 调整项 | 更新内容 |
|---|---|
| 收敛项复核 | 逐条核对 v2.5 §11 的 19 项：**4 项已完成删除**（`--hula-*` 清零、空态覆盖 100%、`/home` 默认重定向、布局宽度令牌化），7 项标注实测状态，其余保留 |
| 新增第 12 章 | 「界面评审发现与优化方案」：按位置/问题/依据/严重度/改法五要素给出 7 条实测问题，全部附代码位置与量化依据 |
| 配色实测 | 首次给出关键配色的对比度实测值：发送气泡 5.26:1、接收气泡 7.56:1 均达 AA；**危险色作背景配白字仅 3.91:1**，只满足大字标准 |
| 弹窗收敛进度 | 实测 `n-modal` 38 个文件 vs `n-drawer` 35 个，「优先改抽屉」尚未产生净变化，改为可执行的分批方案 |
| 双端设置对齐 | 发现桌面与移动同名设置页（8 组）**内容不一致**，非纯冗余：移动有改密码/设备/停用账号，桌面有加密密钥/邀请权限 |

### v2.5

| 调整项 | 更新内容 |
|---|---|
| 路由计数口径 | 全量替换为 2026-10-31 机器实测：**980 注册条目 / 780 唯一路径 / 761 逻辑端点**（原 1041 为 2026-10-18 快照且口径混用）；引入 `route_metrics.py --json` 作为唯一取数命令，人工汇总数字不再作为依据 |
| 能力域计数 | 逐模块按 `ROUTE_CONTRACT.md` 重算：房间 114、管理模块 150、联邦 70、E2EE 22、密钥备份 33、设备 13、语音 13、搜索 5、审核 5；新增后台更新 19、事件举报 18、应用服务 41、账户 15、遥测 6、模块 23（逐模块口径与命名空间口径不可相加，见 2.4.1） |
| Admin 面 | Admin 注册条目由 146 校正为 **300**，子域重划为 服务器 62 / 用户管理 76 / 房间管理 59 / 安全 58 / 联邦 22 / 媒体 23；SDK 扩展模块 98→**97**、`ManagerName` 100→**98** |
| 私有端点 | `/_matrix/vendor/v1` 全族按一级段重算（合计 **201** 条），修正 friends 28、rooms 92（含 summary 16）、spaces 22、voice 13、widgets 12、keys 9、threads 4 等原估值 |
| 新增 2.4.7 | `/capabilities` 公开面与能力位清单：区分免认证可见位与认证后追加位，说明 `io.hula.*` 永不出现在 `/versions` |
| 新增 2.4.8 | 能力探测的加载语义与失败方向：三请求并发、`unstable_features` 双源合并、失败时以空对象兜底并置 `isLoaded`，禁止无限 spinner |
| 新增 2.4.9 | 有意不实现的端点（**16** 条）及其 UI 处置；其中语音 `convert/optimize/transcription`、密钥备份 `verify`、审核评分、房间密钥分发必须在 UI 层隐藏 |
| 2.4.6 订正 | MSC4140 定时状态事件已可 enforce（`state_key` 已补齐）、MSC4354 已补 expiry（上限 1h）、`M_APPSERVICE_LOGIN_UNSUPPORTED` 已落地、MSC3720 需 `experimental.msc3720_enabled`；新增账号注销 `erase:true`→501、第三方目录查询 404、`m.preview_url` 开关等边界 |
| 页面能力注记 | 认证页补 SSO 仅在认证后可见、登录限流与 401/403/429 三分；消息页补线程、粘性事件、延迟事件与 429 熔断；加密页补 `keys/backup/secure/{id}/verify` 与 `keys/distribution` 不可用；媒体页补 `max_upload_size` 默认 50 MB 与语音转写不可用 |
| 登录锁定订正 | 由"5 次/300s"校正为：默认 5 次失败锁定（IP 级 30 次）、时长取 `login_lockout_duration_seconds`（代码默认 **900s**）、已锁定后每次重试会指数推高 `retry_after_ms`；429 也可能来自密码哈希超时（1s），不得一律解释为"账号被锁" |
| 房间版本订正 | `m.room_versions.available` 并非只含 `"12"`：v1–v11 为 `stable_no_create`、v12 为 `stable`，`default = "12"`；判定可创建性看 disposition，不看条目数 |
| 新增 5.12 | 锁屏（本地密码）与房间级防截屏水印：明确"水印警示 ≠ 阻止截屏"的事实边界与读失败降级方向 |
| 路由表订正 | 桌面主路由实为 `/message`、`/friend`、`/room`、`/space`、`/search`、`/federation`（`/home` 子路由使用绝对路径），删除不存在的 `/openclaw`；公共路由补 `/splashscreen`、`/tray`、`/notify`、`/update`、`/checkupdate`、`/capture` 与 404 兜底 |
| 新增 7.7–7.10 | 限流与熔断（429 退避、连续 3 次/全局 10s 内 6 次熔断）、能力未就绪态、错误码到文案的映射、边界场景清单 |
| 设置页宽度 | 设置菜单栏由 260px 校正为 `--tjg-settings-sidebar-width: 240px` |
| 术语统一 | 统一"页签/Tab"、"会话/房间"、"能力位/能力探测"、"水印警示"等表述；移动端设置段名（camelCase）与桌面端（kebab-case）差异显式登记 |

### v2.4

| 调整项 | 更新内容 |
|---|---|
| 能力基线 | 新增 2.4「后端与 SDK 能力基线」：以 2026-10-18 的 1041 条注册路由、`/_matrix/vendor/v1` 私有端点族和 SDK Manager 能力面为依据，为每个页面补充能力前提 |
| 不可依赖项 | 新增 2.4.6 不可依赖项与降级规则，明确后端未实现或仅部分实现的能力不得在 UI 中作为卖点或默认入口 |
| 设置页校准 | 按 `Tjg/src/stores/domains/settings/settingsSchema.ts` 把设置 Tab 从 16 个校准为实际 14 个，并统一三栏布局与 `260px` 菜单宽度 |
| 在线状态 | 新增 7.6「在线状态判定」，明确后端 presence 语义与前端只认 `online` 的映射规则 |
| 页面能力注记 | 在认证、好友、房间、空间、管理后台、私密聊天、加密、媒体与通话各节补充能力依据与降级要求 |

### v2.3

| 调整项 | 更新内容 |
|---|---|
| 设置页面布局 | 从弹窗模式改为三栏路由页面（导航栏 64px + 设置菜单 260px + 内容区 flex-1），去除弹窗 |
| 设置 Tab 分组 | 16 个设置 Tab 按"通用/通讯/安全/高级/其他"5 组分类展示 |
| 设置页面入口 | 用户菜单点击设置项改为路由跳转 `/settings?tab=...`，不再使用弹窗覆盖主界面 |
| 独立窗口兼容 | 独立 Tauri 窗口模式下隐藏左侧导航栏，退化为两栏布局 |

### v2.2

| 调整项 | 更新内容 |
|---|---|
| 界面布局 | 明确每个桌面端界面使用不同布局：消息四栏、好友/机器人三栏、其他两栏 |
| 弹窗收敛 | 优先使用右侧抽屉展示详情和设置，仅对必须中断操作的场景使用弹窗 |
| 界面功能 | 根据实际截图补充每个界面的具体功能和按钮说明 |

### v2.1

| 调整项 | 更新内容 |
|---|---|
| 项目命名 | 文档统一使用 `Tjg` 与“天机阁”，不再把当前项目写成 HuLa 新增功能迭代 |
| 路径口径 | 以 `Tjg/` 为当前前端项目根目录，文档中的代码引用改为仓库相对路径 |
| 设计令牌 | 全面改为 `--tjg-*` 令牌，旧 `--hula-*` 仅作为历史兼容别名处理 |
| 页面架构 | 按 `Tjg/docs/TJG-prototype.html` 补充桌面端四栏、移动端单栏、公共窗口、管理后台与独立聊天窗口结构 |
| 当前实现 | 纳入 `ConnectionStatusBanner`、`EmptyState`、`v-ripple`、设置页、管理后台、私密聊天、阅后即焚、空间工作台等现有组件基线 |
| 交互约束 | 明确首屏、连接、离线、空状态、动效降级、可访问性与国际化规则 |

### 历史版本保留口径

v2.0 的“乐观渲染 + 后台同步”仍是核心方向，但本版本把该方向与当前代码实现重新对齐。旧文档中指向 HuLa 目录、`--hula-*` 主令牌、未落地或已改名组件的描述已合并、改写或删除。

## 目录

1. [项目定位](#1-项目定位)  
2. [产品信息架构](#2-产品信息架构)（含 [2.4 后端与 SDK 能力基线](#24-后端与-sdk-能力基线)、[2.4.7 能力位清单](#247-capabilities-公开面与能力位清单)、[2.4.8 能力探测加载语义](#248-能力探测的加载语义与失败方向)、[2.4.9 有意不实现的端点](#249-有意不实现的端点与-ui-处置)）  
3. [全局界面架构](#3-全局界面架构)  
4. [设计系统](#4-设计系统)  
5. [核心页面需求](#5-核心页面需求)  
6. [通用组件需求](#6-通用组件需求)  
7. [交互与状态](#7-交互与状态)（含 [7.6 在线状态判定](#76-在线状态判定)、[7.7 限流与熔断](#77-限流退避与熔断)、[7.8 能力未就绪态](#78-能力未就绪态)、[7.9 错误码与文案映射](#79-错误码与文案映射)、[7.10 边界场景](#710-边界场景清单)）  
8. [响应式与平台适配](#8-响应式与平台适配)  
9. [可访问性与国际化](#9-可访问性与国际化)  
10. [路由与权限](#10-路由与权限)  
11. [后续收敛项](#11-后续收敛项)

## 1. 项目定位

Tjg 是基于 Matrix 能力的跨平台通讯客户端，面向桌面端与移动端，核心体验由消息、好友、房间、空间、设置、管理后台和扩展能力组成。产品 UI 的主目标是让用户在网络波动、首次同步、权限差异和跨端切换时仍能理解当前状态，并能继续完成消息查看、发送、管理与设置操作。

### 1.1 产品目标

| 目标 | UI 要求 |
|---|---|
| 通讯主流程稳定 | 登录、会话列表、聊天主界面、消息输入、文件上传、语音消息必须保持清晰、可恢复、可反馈 |
| 首屏不白屏 | 有缓存数据时优先渲染主界面；无缓存数据时给出明确登录或加载状态 |
| 多端一致 | 桌面端各模块布局独立设计与移动端栈式导航使用同一业务语义，不出现功能命名割裂 |
| 高级能力可发现 | 管理后台、空间、阅后即焚、加密、私密聊天、AI 助手、文件管理等能力在导航和设置中有明确入口 |
| 设计令牌统一 | 颜色、字号、间距、圆角、阴影、动效使用 `--tjg-*` 令牌，减少硬编码样式 |

### 1.2 用户角色

| 角色 | 主要入口 | 关键任务 |
|---|---|---|
| 普通用户 | 登录页、消息页、好友页、房间页、移动端底部导航 | 登录、收发消息、管理好友、加入房间、查看文件、调整个人设置 |
| 群组或房间管理员 | 房间详情、成员管理、公告、审核入口 | 管理成员、公告、邀请、消息保留、房间安全设置 |
| 系统管理员 | 左侧更多菜单中的管理后台入口、`/admin` 路由 | 用户、房间、联邦、审计、通知、保留策略、模块、服务配置管理 |
| 访客 | 访客模式提示、公开房间或空间入口 | 浏览允许访问的公开内容，理解受限操作原因 |

### 1.3 当前实现依据

| 领域 | 代码位置 |
|---|---|
| 全局路由 | `Tjg/src/router/index.ts`、`Tjg/src/router/routes/*.ts` |
| 桌面主布局 | `Tjg/src/layout/index.vue`、`Tjg/src/layout/left`、`Tjg/src/layout/center`、`Tjg/src/layout/right` |
| 移动端主布局 | `Tjg/src/mobile/layout`、`Tjg/src/mobile/views` |
| 设计令牌 | `Tjg/src/styles/css/design-tokens.css` |
| 设置页 | `Tjg/src/views/settingsWindow`、`Tjg/src/components/settings`、`Tjg/src/stores/domains/settings/settingsSchema.ts`（Tab 清单唯一来源） |
| 管理后台 | `Tjg/src/views/admin`、`Tjg/src/components/admin`、`Tjg/src/stores/domains/admin` |
| 消息与会话 | `Tjg/src/views/homeWindow/message`、`Tjg/src/components/rightBox`、`Tjg/src/components/workbench` |
| 连接状态 | `Tjg/src/components/common/ConnectionStatusBanner.vue`、`Tjg/src/composables/useConnectionStatus.ts` |
| 服务端能力探测 | `Tjg/src/services/matrix/MatrixCapabilityService.ts`、`Tjg/src/stores/domains/chat/capability.ts` |
| 限流与熔断 | `Tjg/src/services/matrix/MatrixRateLimitInterceptor.ts`、`Tjg/src/utils/backoff.ts` |
| 锁屏与本地隐私 | `Tjg/src/App.vue`（`LockExclusion` 白名单）、`Tjg/src/layout/left/model.tsx`（本机密码设置）、`Tjg/src/composables/chat/useRoomAntiScreenshot.ts` |
| 空状态与骨架屏 | `Tjg/src/components/common/EmptyState.vue`、`Tjg/src/components/common/Skeleton*.vue` |
| 可访问性语义 | `Tjg/src/components/common/GlobalAriaLive.vue`、`Tjg/src/components/common/SkipLink.vue`、`Tjg/src/components/common/PermissionGuard.vue` |
| 国际化 | `Tjg/locales/zh-CN`、`Tjg/locales/en` |

## 2. 产品信息架构

Tjg 的信息架构按"主通讯区 + 辅助窗口 + 管理后台 + 移动端独立体验"组织。桌面端严格遵循 `Tjg/docs/TJG-prototype.html` 的布局规范，消息界面使用四栏、好友和机器人界面使用三栏、其他界面使用两栏；移动端遵循 375 × 812 原型中的底部 Tab 与栈式详情页。

### 2.1 一级功能

| 功能域 | 桌面入口 | 移动入口 | 说明 |
|---|---|---|---|
| 消息 | `/message/:roomId?` | `/mobile/message`、`/mobile/chatRoom/chatMain/:uid?` | 会话列表、聊天时间线、输入框、线程、文件和语音能力 |
| 好友 | `/friend` 及其子路径 | `/mobile/friends` | 好友列表、申请、搜索、好友详情、发起私聊 |
| 房间 | `/room` 及其子路径 | `/mobile/rooms` | 房间列表、创建、加入、成员、设置、保留策略 |
| 空间 | `/space` 及其子路径 | `/mobile/space` | 空间列表、层级、成员、房间归属 |
| 联邦 | `/federation` | 移动端暂不提供独立入口 | 联邦对端状态与服务器视图（只读为主） |
| 设置 | `/settings?tab=...` | `/mobile/mobileMy/...` | 账号、会话、外观、通知、加密、设备、审核、帮助等 14 个 Tab |
| 文件 | `/fileManager`、`/previewFile` | `/mobile/mobileMy/...`（`Files` 页） | 文件列表、预览、下载和媒体查看 |
| 管理后台 | `/admin/*` | 移动端暂不作为主入口 | 系统级管理页面，需管理员权限 |
| 扩展功能 | `/robot`、`/chat`、`/trendradar`、`/dynamic`、`/mail` | `/mobile/dynamic` 等 | AI 助手、动态、邮件、趋势雷达等 |

> 路由口径：`/home` 的子路由在 `Tjg/src/router/routes/desktop.ts` 中使用**绝对路径**（`/friend`、`/room`、`/space`、`/message`、`/search`、`/federation`），因此浏览器地址为 `/message/:roomId?` 而非 `/home/message/:roomId?`。v2.4 及更早版本写作 `/home/*` 的描述一律以本节为准。

### 2.2 导航原则

桌面端的主导航位于左侧栏，承担模块切换、窗口打开、用户菜单和全局设置入口。移动端的主导航位于底部 Tab，详情页使用顶部返回与标题区，避免把桌面端的多栏信息强行压缩到手机屏幕。

### 2.3 命名原则

| 对象 | 文档命名 | 代码命名建议 |
|---|---|---|
| 项目品牌 | Tjg（天机阁） | `Tjg`、`tjg` |
| 旧项目前端 | HuLa | 仅在历史说明和兼容别名中出现 |
| 设计令牌 | TJG Design Tokens | `--tjg-*` |
| Matrix 能力包装 | 服务层 | `services/matrix`、Manager 包装 |
| URL 常量 | 路径常量层 | `paths` 仅表达端点，不承载请求逻辑 |

### 2.4 后端与 SDK 能力基线

UI 需求不得假设后端存在未实现的能力。本节以 synapse-rust 的路由契约和 matrix-js-sdk 的能力探测为准，作为第 5 章各页面的能力前提：后端缺位的能力必须隐藏入口或显式降级，不得只靠“点了报错”兜底。

#### 2.4.1 权威来源与统计口径

| 来源 | 路径 | 当前口径 | 用途 |
|---|---|---|---|
| 机器路由清单 | `synapse-rust/docs/synapse-rust/ROUTE_CONTRACT.md` | 2026-10-31 生成，**980** 条注册条目 | 判断某端点是否真实存在 |
| 路由三口径唯一实现 | `synapse-rust/scripts/contract/route_metrics.py`（数据源 `ROUTE_HANDLERS.json`） | `--json` 输出三口径 + Client/Admin 分类 + 其他命名空间拆解 | 引用任何路由数量前的唯一取数命令 |
| 覆盖率报告 | `synapse-rust/docs/synapse-rust/API_COVERAGE_REPORT.md` | 人工汇总，含规范对齐与 MSC 语义判定（**数字部分已改为生成块**） | 判断能力完整度与缺口 |
| MSC 语义 | `synapse-rust/docs/synapse-rust/MSC_SEMANTICS.md` | MSC 编号语义唯一真相源 | 识别"借用编号"，避免按编号推断功能 |
| 能力位构造面 | `synapse-rust/synapse-services/src/capability_governance.rs` | `build_capabilities_response()` 是 `/capabilities` 的唯一实现 | 判断某个能力位是否真的会下发 |
| SDK 能力探测 | `matrix-js-sdk/src/server-capabilities/index.ts` | `SynapseRustFeature` **8** 项 + `doesClientAdvertiseSynapseRustFeature` | 运行时决定入口是否可用 |
| 前端能力聚合 | `Tjg/src/services/matrix/MatrixCapabilityService.ts` | `TjgCapability` **7** 项 + `/versions`、`/capabilities`、`/client/v1/config/client` 三源合并 | 判断能力是否已在客户端接线 |

统计口径不可混用：

- **注册条目**：带 method 的唯一 `(method, path)` 对，当前 **980** 条。命名空间分布：`/_matrix/client` **333** · `/_synapse/admin` **300** · 其他 **347**（其中根级 3、`.well-known` 5、`matrix` 非 client 295、`synapse` 非 admin 44）。
- **唯一路径**：去掉 method 后的路径数，当前 **780** 条（`246` / `233` / `301`）。`API_COVERAGE_REPORT.md` §1.1 里 v1.15–v1.19 的 `1053/832/761`、`1052/831/760`、`1047/828/757`、`1036`、`1027/814/747` 均为**历史快照且互相矛盾**，已被取消"逐版手工递增"的做法，引用时必须标注日期且不得与本节混用。
- **逻辑端点**：再折叠版本前缀（`v1` / `v3` / `r0` / `unstable/<seg>` → `vX`）后的端点数，当前 **761** 条（`229` / `231` / `301`）。

路由清单同时记录：含路由注册的模块文件 **67** 个、`registered_by` 标签 **76** 个、**19 条受运行时 profile 门控**的路由（worker 11 条 + oidc 8 条）、**2 条 worker/oidc 双档注册**、**16 条有意不实现的端点**（见 2.4.9）。根级非命名空间端点仅 `GET /`、`GET /health`、`GET /_health` 三条，客户端不得依赖其他根级路径做健康检查。

#### 2.4.2 运行时 profile 门控（决定入口是否显示）

派生表按 `always` ⊂ `worker` ⊂ `oidc` 单调分档；默认构建只注册 `always` 档。下表路由在默认构建中返回 **404 而非 405**，UI 若照常渲染入口，用户会得到“接口不存在”的错误。

| profile | 路由范围 | UI 影响 |
|---|---|---|
| `worker` | `/_synapse/worker/v1/*`（11 条：commands / events / replication / tasks / workers） | 无用户可见入口，仅内部拓扑 |
| `oidc` | `/_matrix/client/v3/login/sso/redirect`、`login/sso/userinfo`、`/_matrix/client/v3/oidc/{authorize,callback,login,logout,token,userinfo}`（8 条） | 登录页 SSO/OIDC 按钮；未启用 OIDC 时必须隐藏 |
| 双档 | `/.well-known/jwks.json`、`/.well-known/openid-configuration` | 登录前置发现可用，不构成独立入口 |

补充规则：

- 登录方式一律以 `GET /_matrix/client/v3/login` 返回的 `flows` 为准，不在前端硬编码“支持密码 / SSO / SAML / CAS”。
- SAML 路由虽然在默认构建中注册，但 `saml_enabled` 默认 `false`；管理后台 `/admin/saml` 与登录页 SAML 入口必须按服务端配置展示。
- 能力清单以 `GET /_matrix/client/v3/capabilities` 与 `GET /_matrix/client/versions` 为运行时来源。

#### 2.4.3 Client API 能力域与 UI 落点

| 能力域 | 后端覆盖（逐模块口径） | UI 落点 | 约束与备注 |
|---|---|---|---|
| 认证 | 密码登录、刷新令牌、登出、SSO/OIDC、SAML、CAS、MSC4108 rendezvous、UIA、验证码 | 5.1 认证页 | 验证码 5 条；CAS 12 条、SAML 16 条、OIDC 10 条、Rendezvous 6 条、MSC4108 4 条；`m.sso` 能力位**仅在认证后**下发 |
| 同步 | `/sync`、Sliding Sync（MSC3575/3886）、`/notifications`、to-device、push rules、pushers、后台更新 | 5.2 消息主界面、7.1 连接状态 | 同步 3 条、Sliding Sync 4 条、推送 25 条、后台更新 19 条；MSC4222 `state_after` 需 `?use_state_after=true` 显式 opt-in |
| 房间 | create/join/knock/leave/forget、state、tags、relations、threads、summary、aliases、hierarchy | 5.2、5.4、5.5 | 房间模块 **114** 条、标签 4 条、关联 9 条；仅 v12 可创建；`m.forget_forced_upon_leave` 恒为 true |
| 消息 | send/edit/redact、`/messages`、receipts、typing、read markers、sendToDevice、delayed events | 5.2 时间线、6.4 输入区 | 反应 1 条、输入状态 5 条、延迟事件 7 条（含状态事件）；级联撤回仅单层不递归 |
| 线程 | 房间级 threads 读面（MSC3856）+ 私有 threads 面（创建/删除/搜索/未读/冻结/静音/已读/统计） | 5.2 线程视图、移动端线程页 | 共 **21** 条；规格面在 `/_matrix/client/v1`，私有面在 `/_matrix/vendor/v1`；入口以 `canUseThreads()` 为准 |
| 媒体 | `/_matrix/media/*`、`/_matrix/client/v1/media/*`、`/upload`、thumbnail、preview_url、config | 5.11 媒体、文件与通话 | 客户端媒体 **60** 条；Admin 媒体管理另计 **23** 条；`animated` 缩略图未实现；`m.preview_url` 受 `experimental.msc4452_enabled` 门控 |
| 用户 | profile、自定义字段、presence、user_directory、thirdparty、capabilities、account_data | 5.3 好友、5.7 设置、7.6 在线状态 | Presence **9** 条；第三方网络查询 6 条中 4 条为 by-design 404（见 2.4.9）；访客 3 条 |
| 搜索 | `/search`、房内搜索、用户目录搜索、vendor 搜索扩展 | 5.2 房内搜索、`/search` | 搜索模块 **5** 条；好友搜索与目录搜索是两条链路 |
| 设备与密钥 | `/devices`、`/keys/*`、`/room_keys/*`、cross-signing、dehydrated device、key backup | 5.10 加密与设备安全 | 设备 **13** 条、E2EE **22** 条、密钥备份 **33** 条、密钥轮转 **9** 条；`keys/backup/secure/{id}/verify` 不可用 |
| 空间 | `/spaces`、hierarchy、children、parents、summary、statistics | 5.5 空间 | 空间模块 **26** 条（规格 hierarchy 4 条 + 私有面其余）；进入聊天必须落到具体房间 |
| 举报与审核 | 事件举报、Content Scanner、房间事件扫描器评分 | 5.8 审核工作台 | 事件举报 **18** 条、审核 **5** 条；评分端点为 by-design 不可用（见 2.4.9） |
| 应用服务 | AS 注册、命名空间、事件推送、MSC4512 代理 | 5.8 应用服务 | **41** 条；MSC4512 仅 C-S 侧代理，联邦侧代理请求未做 |
| 管理 | 房间 59、用户 76、服务器 62、安全 58、联邦 22、媒体 23 | 5.8 管理后台 | 合计 **300** 条，必须与子域对齐分页；管理端级联撤回可用 |
| 联邦 | `/federation/*`、`/_synapse/federation/*` | 5.8 联邦管理、`/federation` | 联邦模块 **70** 条；联邦 legacy 设备密钥交换 5 条为 by-design unsupported |
| 扩展与实验 | MSC4108、MSC4512、MSC4222 `state_after`、MSC3912 级联撤回、MSC4155 邀请策略、MSC4262/4429 profile 更新 | 按需 | MSC3912 级联仅单层；MSC4155 字段与官方最终文本不一致（见 5.3） |

#### 2.4.4 `/_matrix/vendor/v1` 私有能力

非规范端点统一走 `/_matrix/vendor/v1`，前端只允许通过 `Tjg/src/services/matrix/paths/prefixes.ts` 的 `PREFIX_VENDOR_V1` 拼接，不得散落字面量。下表为 2026-10-31 实测的**一级段注册条目**（按绝对路径前缀统计，合计 **201** 条）：

| 端点族 | 注册条目 | 主要能力 | UI 落点 |
|---|---:|---|---|
| `rooms/*`（房间私有扩展） | 92 | 置顶、成员、权限、通知、时间线、未读数、搜索、翻译、保留策略、粘性事件、阅后即焚、密钥、报告评分等 | 5.2、5.4、5.9、5.10 |
| `rooms/{room_id}/summary*` | 16（含在 92 内） | 房间摘要、成员摘要、状态、统计、heroes、未读清理 | 5.2 会话列表、5.4 房间详情 |
| `friends/*` | 28 | 好友列表、申请、分组、搜索、备注、状态、DM 解析、邀请白/黑名单 | 5.3 好友与联系人 |
| `spaces/*` | 22 | 空间树、成员、房间归属、加入/退出、公开目录、统计 | 5.5 空间 |
| `voice/*` | 13 | 语音消息注册、上传、配置、房间/用户统计（**转换/优化/转写不可用**） | 5.11 语音消息 |
| `widgets/*` | 12 | Widget 配置、权限、会话、房间挂载、Jitsi 配置 | 5.2 右侧小部件（能力可用时） |
| `keys/rotation/*` | 9 | 密钥轮转状态、历史、配置、吊销 | 5.10 加密与设备安全 |
| `user/*` | 5 | 个人阅后即焚配置与统计、用户级线程列表 | 5.7、5.9 |
| `push/*` | 4 | 推送设备、推送发送 | 5.7 设置页「通知」Tab |
| `threads/*` | 4 | 全局线程列表、创建、已订阅、未读 | 5.2 线程视图 |
| `external_services/*` | 3 | 外部服务注册、健康检查、Webhook | 5.8 应用服务 |
| `direct/*`、`create_dm` | 3 | DM 房间解析、创建 | 5.3 好友详情、会话列表 |
| `invites/*` | 2 | 一次性邀请、邀请策略 | 5.3、5.8 |
| 其他 | 4 | `my_rooms`、`search_rooms`、`search_recipients`、`translate` | 5.2、5.4、5.8 |

> `threads` 另有 10 条挂在 `rooms/{room_id}/threads/*` 下（已计入 `rooms/*` 的 92 条），线程族总计 **21** 条。上表各段之和（201）与本条说明不可相加替换，引用时须写明"vendor 一级段"口径。

#### 2.4.5 Admin API 与 SDK Manager 映射

后端管理端点共 **300** 条（全部位于 `/_synapse/admin/*`；另有 `POST /_matrix/client/v3/admin/room/{room_id}/redact` 一条挂在 client 命名空间，属房间子域），按子域分布：用户管理 **76**、服务器 **62**、房间管理 **59**、安全 **58**、媒体 **23**、联邦 **22**。管理后台的页面划分必须与这些子域对齐；**媒体子域 23 条当前没有任何管理页面承接**（见 11 章收敛项）。

SDK 侧能力面：

| 层级 | 数量 | 说明 |
|---|---:|---|
| `matrix-js-sdk/src/manager-extensions/index.ts` | **97** | `include*` 扩展开关，`DEFAULT_CORE_EXTENSIONS` 默认全开 |
| `matrix-js-sdk/src/client-infra/manager-registry.ts` | **98** | `ManagerName` camelCase 联合类型，与扩展模块是两套命名空间 |
| `Tjg/src/services/matrix/` 能力域 | 16 + 基础设施 | `admin`、`auth`、`crypto`、`extensions`、`friends`、`invites`、`media`、`messaging`、`room`、`user`、`sync`、`widget`、`moderation`、`notifications`、`privateChat`、`rendezvous`、`ai`；`network`/`paths`/`aliases` 为基础设施目录不在此列 |
| Tjg 运行时能力探测 | 7 | `MatrixCapabilityService.ts` 的 `TjgCapability`：`sliding-sync`、`e2ee`、`voip`、`friend-list`、`admin-api`、`burn-after-read`、`openclaw` |

约束：

- `createClient()` 同步返回，扩展异步注册；Tjg 必须在 worker 引导阶段 `await client.whenManagerExtensionsReady()` 后再通过 `get<Name>Manager()` 取 manager。
- 组件不得直接调用 SDK 或 manager，一律经 `Tjg/src/services/matrix/**` 封装。
- Admin 页面能力以 `Tjg/src/services/matrix/admin/AdminApiProbeService.ts` 与 `adminApiAvailability.ts` 的探测结果为准，探测失败时隐藏对应页面入口而不是展示空表格。
- 运行时能力判定统一走 `MatrixCapabilityService.hasCapability()`：能力 store 未注册或探测未完成时返回 `false`（fail-closed），UI 必须按"不可用"渲染；`canUseE2EE()` 是唯一例外，仅在服务端显式返回 `m.room.encryption.enabled === false` 时判为不可用（store 缺失时仍返回 `false`）。
- `GET /_matrix/client/v1/config/client` 返回的 `features`（`e2ee` / `voip` / `threads` / `spaces`）是**服务端硬编码常量**，不随配置变化，**不得**用作能力门控；门控只看 `/capabilities` 与 `/versions`。
- 线程入口以 `canUseThreads()` 为准（`org.matrix.msc3983` / `.thread` / `msc3026` 或 `m.thread` 能力位任一命中）。

#### 2.4.6 不可依赖项与降级规则

以下能力**不得**在 UI 中作为默认入口或宣传点；除非运行时探测明确返回可用。

| 项 | 后端现状 | UI 规则 |
|---|---|---|
| `animated` 缩略图 | **MISSING**（媒体路由与 service 均无实现） | 不提供"动图缩略图"开关；缩略图统一按静态图处理 |
| MSC4335 媒体超限额 | **PARTIAL**：错误码已定义，媒体上传路径未使用 | 上传失败按通用错误提示，不根据 `M_USER_LIMIT_EXCEEDED` 做专门引导 |
| MSC4502 `is_joined` | **未实现**，编号被本仓借用给 `/members` 的 `at`/`dir`/`limit`/`membership` 分页 | 不调用 `GET /rooms/{roomId}/is_joined`，成员关系以房间状态与 `/members` 为准 |
| MSC4429 legacy `/sync` 顶层 `users` | **PARTIAL**：仅滑动同步侧实现 `profile_updates`，legacy `/sync` 不输出顶层 `users`、无 `profile_fields` filter | 资料变更不依赖 legacy sync 的 `users` 字段，走 profile 查询或滑动同步扩展字段 |
| MSC4242 | **PARTIAL**：仅存储层，受房间版本与 `experimental_features` 限制 | 不暴露相关用户入口 |
| MSC4140 延迟事件 | **已实现（2026-10-04 订正）**：单事件查询 + 联邦 EDU + `/state` 三写端点按路径/computed `state_key` 透传 | 可提供"发送定时消息"，但不提供"定时状态事件"类高级 UI；定时任务的结果需可查询、可取消 |
| MSC4354 sticky soft-fail | 本仓**无** soft-fail 维度（同名 `events.soft_failed` 是事务去重，语义不同）；**已补 expiry**（`sticky_duration_ms` / `expires_at`，请求时长上限 `1h`） | 可展示粘性消息与到期时间（`sticky_expiry_ts`），**不得**展示"软失败/取消软失败"类状态 |
| `org.matrix.msc3873` 能力位 | **恒为 true 但全仓无实现落点**（仅 `capability_governance.rs` 硬编码下发） | 不得据此启用任何功能；如需该能力必须先在服务端落地并补台账 |
| `M_APPSERVICE_LOGIN_UNSUPPORTED` | **已落地稳定错误码（2026-10-24 订正）**，AS 登录可返回该码；仍欠 pushers/设备管理 | 按该错误码展示"应用服务登录不支持当前操作"，不再归入通用错误 |
| LiveKit 通话 | `LivekitConfig.ws_url` 无读取点（死配置），`rtc/transports` 只返回 ICE | 视频/群通话入口按 Voice 能力探测 fail-closed；不承诺 LiveKit 房间能力 |
| Voice / DehydratedDevice / AccountStatus | SDK 调用 `doesClientAdvertiseSynapseRustFeature(..., false)`（fail-closed）；AccountStatus 还需后端 `experimental.msc3720_enabled`，关闭时端点 **403** | 探测不可用或抛错时隐藏入口；403 时按"未启用"而不是"无权限"提示 |
| Widget | `SynapseRustFeature.Widget` 已定义，但 SDK 内无 manager 调用点 | 视为不可用，小部件入口默认隐藏，除非后续补齐探测接线 |
| BurnAfterRead | SDK 以 `config.enabled` 作为探测失败时的回退值 | 回退为 `false` 时隐藏阅后即焚入口与设置 Tab |
| Sliding Sync / Friends | SDK 调用时 fallback 为 `true`（fail-open） | 仅这两项允许在探测失败时继续按可用处理 |
| Tjg 能力探测 | `MatrixCapabilityService.hasCapability()` 在 store 未注册或未加载时返回 `false`；`refreshCapabilities()` 失败时写入空对象并置 `isLoaded=true` | 页面按"不可用"渲染；能力加载完成后需重新求值（见 7.8） |
| 房间版本 | 仅 v12 可创建（`default = "12"`，`available` 中 v1–v11 为 `stable_no_create`）；v1–v11 可加入/解析但不可创建；v13 已移除 | 创建房间不提供版本选择器；升级提示只引导到 v12；不得用 `available` 的条目数推断可创建性 |
| 账号注销内容擦除 | `POST /account/deactivate` 的 `{"erase": true}` 显式返回 **501 `M_UNKNOWN`**，且在任何副作用之前拒绝 | 注销对话框的"同时删除内容"选项**不得**作为可选项展示；若提供，必须说明"服务端不支持，注销未发生"并保持原状态 |
| URL 预览 | `m.preview_url` 受 `experimental.msc4452_enabled` 门控；关闭时 `preview_url` 端点 403 | 消息链接预览开关只在能力位为 true 时展示；否则按纯文本链接渲染 |
| 第三方目录查询 | `/_matrix/client/v3/thirdparty/{location,user}[/{protocol}]` 4 条为 by-design 404 | 不提供"第三方位置/用户搜索"入口；联系人搜索只走 `user_directory/search` 与 `friends/search` |
| 房间密钥分发 | `GET /rooms/{room_id}/keys/distribution` 恒 403（服务端内部簿记） | 不调用、不展示"查看房间密钥分发"类入口 |
| 错误响应 | 部分路由错误体缺 `errcode`（裸 `Json`） | 错误提示以 HTTP 状态 + 兜底文案为主，不假设一定有 `errcode`（见 7.9） |
| 房间摘要投影 | `room_summary_members` 投影在 join/leave/kick/ban 时未维护，且查询使用 `INNER JOIN` | 成员摘要缺失时回退到 `/members` 查询，不把空摘要当作"无成员" |
| 创建房间参数校验 | 非法类型（如 `name: 123`）与未知字段被静默接受 | 前端必须做类型与必填校验，不能依赖后端报错 |

补充（登录失败锁定，2026-11-01 按 `synapse-web/src/utils/login_lockout.rs` 订正）：

- 阈值与时长：默认 **5** 次失败锁定（`login_failure_lockout_threshold`），IP 级阈值 **30** 次（`login_lockout_max_ip_attempts`），锁定时长取 `login_lockout_duration_seconds`（代码默认 **900s**，不是 300s）。
- 已锁定状态下**每次重试都会推高退避档位**，`retry_after_ms` 指数增长；UI 必须按响应里的 `retry_after_ms` 显示剩余时间，不得硬编码"5 分钟"。
- `security.login_lockout_enabled=false` 时该锁定完全关闭；`login_lockout_ip_allowlist` 中的 IP **既不计数也不拒绝**（也可能永远不返回 429）。
- 429 不只来自锁定：密码哈希超时也会返回 429（`retry_after_ms: 1000`）。UI 不能把任何 429 都解释成"账号被锁定"。
- 登录失败当前返回 401（规范应为 403）；UI 需同时处理 401/403/429，并对 429 展示可重试提示。

#### 2.4.7 `/capabilities` 公开面与能力位清单

`/capabilities` 的响应由 `capability_governance.rs::build_capabilities_response(authenticated)` 单一构造，分**免认证可见位**与**认证后追加位**两层。UI 的入口显隐必须以本表为准，不得凭后端路由是否存在推断。

免认证即可见：

| 能力位 | 下发条件 | UI 用途 |
|---|---|---|
| `m.room_versions` | 恒下发：`default = "12"`，`available` 含 `"1"`–`"11"`（`stable_no_create`）与 `"12"`（`stable`） | 创建房间只用 `default`，不提供版本选择器；判定"能否创建"看 disposition 是否 `stable`，**不得**假设 `available` 只有 `"12"` |
| `m.change_password` / `m.set_displayname` / `m.set_avatar_url` / `m.3pid_changes` | 对应路由在册 | 账号页控件的可编辑性 |
| `m.room.summary` / `m.room.suggested` | 对应路由在册 | 会话摘要与推荐房间入口 |
| `m.voice` | Voice 路由面可用 | 语音消息入口 |
| `m.thread` | 线程路由面可用 | 线程入口（配合 2.4.5 的 `canUseThreads()`） |
| `m.profile_fields` | 稳定 `/{key_name}` 路由在册（MSC4133） | 账号页"关于我/性别/地区/生日"等自定义字段 |
| `m.forget_forced_upon_leave` | **恒为 true**（MSC4267 原子 leave+forget） | 退出房间对话框可提供"同时遗忘（不再出现在列表中）"选项 |
| `m.preview_url`、`io.element.msc4452.preview_url` | `experimental.msc4452_enabled` | 链接预览开关与预览卡片 |
| `org.matrix.msc3720.account_status` | 路由 ∧ `experimental.msc3720_enabled` | 批量账号状态（封禁/停用标识）；关闭时端点 403 |

`unstable_features`（同时在 `/capabilities` 与 `/versions` 下发的项）：

| 键 | 说明 |
|---|---|
| `org.matrix.msc3886.sliding_sync`、`org.matrix.simplified_msc3575` | 滑动同步入口 |
| `org.matrix.msc3245.voice` | 语音扩展（另有别名 `org.matrix.msc3245`、`m.voice`、`io.hula.voice_extended`） |
| `org.matrix.msc3983.thread` | 线程扩展 |
| `org.matrix.msc4108` | 恒为 true：二维码登录（rendezvous 端点恒在册） |
| `org.matrix.msc4155` | 恒为 true：邀请策略（语义见 5.3，字段与官方最终文本不一致） |
| `org.matrix.msc3873` | 恒为 true 但**全仓无实现落点**：仅作为能力位硬编码下发，**不得**据此启用任何 UI 功能 |
| `uk.tcpip.msc4133` | 扩展资料不稳定拼写 |
| `org.matrix.msc4186` | 路由门控 |
| `io.hula.friends`、`io.hula.burn_after_read` | 私有扩展，见下方规则 |

认证后追加：

| 能力位 | 说明 |
|---|---|
| `m.sso`（`{enabled, providers}`） | **仅认证后**下发；登录页不得依赖它判断 SSO |
| `io.hula.friends` | 好友能力（好友 Tab、好友设置页） |
| `io.hula.burn_after_read` | 阅后即焚（房间设置与个人配置） |
| `io.hula.voice_extended` | 语音扩展能力 |
| `external_services` | 应用服务/外部服务管理入口 |

硬规则：

- **`io.hula.*` 私有能力永不出现在 `/versions.unstable_features`**（`capability_governance.rs` 的测试钉死该不变量）。因此登录前无法从 `/versions` 判断好友/阅后即焚是否可用，**必须在登录成功后重新探测**，不得沿用登录前缓存。
- 登录页的 SSO/SAML/CAS 按钮一律以 `GET /_matrix/client/v3/login` 返回的 `flows` 与 `m.sso.providers`（认证后）为来源，不在前端硬编码"支持密码 / SSO / SAML / CAS"。
- `/capabilities` 在未认证时也可能返回 200，**不能**用它替代 `/login` 判断登录方式。

#### 2.4.8 能力探测的加载语义与失败方向

`MatrixCapabilityService.fetchCapabilities()` 是能力状态的唯一生产点，UI 必须按它的语义设计三态，不允许"探测中"与"不可用"混为一谈。

| 环节 | 行为 | UI 设计要求 |
|---|---|---|
| 数据来源 | `/versions`、`/capabilities`、`/client/v1/config/client` **三请求并发**（`Promise.allSettled`），单源失败不阻塞其他 | 不得因为一次 `/versions` 失败就整页降级 |
| 合并规则 | `unstable_features` 取 `/capabilities.unstable_features` 与 `/versions.unstable_features` 的**逻辑或** | 两个来源任一为 true 即视为可用 |
| 失败兜底 | `refreshCapabilities()` 在结果为空时写入空对象并置 `isLoaded=true` | **禁止无限 spinner**；必须落到"能力不可用"态并可重试 |
| 并发去重 | `SingleFlight` 合并并发调用，一次登录只发一轮三请求 | 多处叠加调用不应额外放大请求 |
| 判定方向 | `hasCapability()` fail-closed；`canUseE2EE()` 仅在 `m.room.encryption.enabled === false` 时判否 | 两者不可互替：E2EE 缺位不代表其他能力可用 |
| 刷新时机 | 登录后启动流程与 `startClient` 各触发一次；切换 homeserver 后必须重跑 | 切换服务器后立即重算入口，不保留旧能力态 |

三态定义（每个依赖能力的入口都必须实现）：

1. **加载中**：`isLoaded === false` ⇒ 展示骨架或中性占位，不显示"不可用"文案，不禁用整个页面。
2. **可用**：能力位为 true ⇒ 正常渲染入口。
3. **不可用**：`isLoaded === true` 且能力位为 false ⇒ 隐藏入口（`capabilityFallback: 'hide'`）或降级为只读（`capabilityFallback: 'readonly'`，当前仅 `encryption` Tab 使用），并提供一句可理解的原因说明。

#### 2.4.9 有意不实现的端点与 UI 处置

下列 **16** 条端点**已注册、鉴权正常、但恒定返回错误**。这是契约声明而非缺陷：客户端必须能区分"协议合法但不支持"与"服务端故障"。错误语义约定：`not_implemented`/`unrecognized` → **404 `M_UNRECOGNIZED`**；`not_supported` → **501 `M_UNKNOWN`**；`forbidden` → **403**；`gone` → **410**。

| 端点 | UI 处置 |
|---|---|
| `GET /rooms/{room_id}/keys/distribution` | 不提供"房间密钥分发"入口（403） |
| `GET /_matrix/vendor/v1/rooms/{room_id}/keys/{event_id}` | 不提供"查看单事件密钥"入口（404） |
| `POST /_matrix/vendor/v1/voice/{media_id}/convert`、`/optimize`、`/transcription` | **语音转码/优化/转写三项不可用**：录音页不得提供"转写文字"按钮，语音气泡不得显示"转写中"（404） |
| `PUT /_matrix/vendor/v1/rooms/{room_id}/report/{event_id}/score` | 审核工作台**不得**提供"调整评分"操作（404） |
| `POST /_matrix/client/v3/keys/backup/secure/{backup_id}/verify` | 密钥备份页**不得**提供"验证备份"按钮；可恢复性以恢复流程实测为准 |
| `GET /_matrix/client/v3/thirdparty/location[/{protocol}]`、`/thirdparty/user[/{protocol}]`（4 条） | 不提供第三方位置/用户目录查询（404） |
| `GET /_synapse/federation/v1/query/auth`、`POST /_synapse/federation/v1/keys/{upload,claim,query}`、`POST /_matrix/federation/v1/user/keys/upload`（5 条） | 联邦设备密钥交换不可用；联邦监控页只展示状态，不提供"触发密钥交换"（404） |

规则：

- 上述端点**一律不得**在 UI 中以按钮、菜单项、开关的形式出现；也不得用"点了报错"来发现不可用。
- 若历史版本已存在入口，按"隐藏"而不是"置灰"处理，避免用户反复尝试。
- 服务端新增或移除 by-design unsupported 项时，`ROUTE_CONTRACT.md` 的清单会同步变化，本文档 11 章的复审项要求随之更新。


## 3. 全局界面架构

### 3.1 桌面端多界面布局

桌面端不同功能模块使用不同布局结构，每个界面独立设计。

#### 消息界面（四栏布局）

```text
┌──────────────┬────────────────────┬────────────────────────────────────┬──────────────────┐
│ 左侧导航栏     │ 消息列表栏            │ 聊天主区域                              │ 右侧信息面板        │
│ 64px         │ 300px              │ flex-1                             │ 240px            │
│              │                    │                                    │ 可折叠为 0px       │
│ 头像与模块入口   │ 空间快捷入口、会话过滤   │ 连接横幅、加密横幅、Header、Timeline、Composer │ 成员、操作、小部件    │
│ 设置/管理后台    │ 会话列表              │ 房间详情抽屉、房间设置抽屉、弹窗与浮层             │ 通知、置顶、静音等动作 │
└──────────────┴────────────────────┴────────────────────────────────────┴──────────────────┘
```

#### 好友界面（三栏布局）

```text
┌──────────────┬────────────────────┬────────────────────────────────────┐
│ 左侧导航栏     │ 联系人列表栏          │ 好友详情区域                              │
│ 64px         │ 300px              │ flex-1                             │
│              │                    │                                    │
│ 头像与模块入口   │ 好友通知、群组验证     │ 头像、Matrix ID、操作按钮、详细信息         │
│ 设置/管理后台    │ 搜索、过滤 Tab、好友列表 │                                    │
└──────────────┴────────────────────┴────────────────────────────────────┘
```

#### 设置界面（三栏布局）

```text
┌──────────────┬────────────────────┬──────────────────────────────────────────┐
│ 左侧导航栏     │ 设置菜单栏            │ 设置内容区域                                  │
│ 64px         │ 240px              │ flex-1                                      │
│              │                    │                                             │
│ 头像与模块入口   │ 搜索框               │ 标题栏（当前 Tab 名称 + dirty 状态 + 关闭按钮）       │
│ 设置/管理后台    │ ────────────────   │ ──────────────────────────────────────────  │
│              │ 通用（6）            │                                             │
│              │  账号、会话、外观       │ 当前 Tab 的具体设置内容                          │
│              │  通知、偏好、键盘       │                                             │
│              │ 通讯（3）            │                                             │
│              │  语音视频、好友        │                                             │
│              │  阅后即焚            │                                             │
│              │ 安全（2）            │                                             │
│              │  安全与隐私、加密      │                                             │
│              │ 高级（2）            │                                             │
│              │  审核、存储           │                                             │
│              │ 其他（1）            │                                             │
│              │  帮助与关于           │                                             │
└──────────────┴────────────────────┴──────────────────────────────────────────┘
```

设置页面独立路由 `/settings?tab=...`，不再使用弹窗覆盖主界面。独立 Tauri 窗口模式下隐藏左侧导航栏，退化为两栏。

#### 房间/空间/机器人/联邦/管理后台界面（两栏布局）

```text
┌──────────────┬─────────────────────────────────────────────────────────┐
│ 左侧导航栏     │ 内容区域                                                  │
│ 64px         │ flex-1                                                  │
│              │                                                         │
│ 头像与模块入口   │ 各模块专属内容（房间卡片、空间列表、AI 聊天、管理仪表盘等）        │
│ 设置/管理后台    │                                                         │
└──────────────┴─────────────────────────────────────────────────────────┘
```

| 区域 | 职责 | 关键规则 |
|---|---|---|
| 左侧导航栏 | 承载用户头像、消息、好友、房间、空间、联邦、设置、管理后台入口 | 最小宽度 `64px`（macOS 26 下取 `68px`）；入口图标须有悬停、选中、焦点态；选中态左侧显示品牌色竖条；管理员入口仅在能力与权限满足时展示；用户菜单另含服务器设置、检查更新、锁屏、关于、退出登录 |
| 消息列表栏 | 展示空间快捷入口、会话过滤、房间列表和列表级操作 | 原型宽度为 `300px`（拖拽可调，`PanelResizeHandle`）；包含列表标题、创建/搜索按钮、横向空间快捷入口、树形空间导航、全部/未读/提及过滤 Tab；拖拽排序、选中态、未读数和提及提示要可见 |
| 联系人列表栏 | 展示好友通知、群组验证、搜索、过滤 Tab 和好友列表 | 原型宽度为 `300px`；包含好友通知入口、群组验证入口、搜索框、全部/在线/收藏/自定义过滤 Tab |
| 聊天主区域 | 展示连接状态、加密状态、聊天头部、消息时间线、输入区、房间详情或设置抽屉 | 自适应剩余宽度；连接横幅位于四栏容器顶部；加密横幅位于聊天头部上方；Header 左侧包含成员面板开关，右侧包含语音、视频、群通话、房内搜索、线程、私密模式、弹出窗口、更多操作 |
| 好友详情区域 | 展示好友头像、Matrix ID、操作按钮（发消息/语音/视频）、详细信息 | 自适应剩余宽度；显示 Matrix ID、所在服务器、加入时间、备注、设备数等信息 |
| 设置菜单栏 | 展示搜索框和 14 个设置 Tab 的分组列表 | 宽度取 `--tjg-settings-sidebar-width`（实值 `240px`；v2.4 中的 `260px` 为误记）；Tab 按"通用(6)/通讯(3)/安全(2)/高级(2)/其他(1)"5 组分类；搜索过滤 Tab 列表；选中态高亮；键盘导航支持 |
| 设置内容区域 | 展示当前选中 Tab 的设置表单和操作 | 自适应剩余宽度；标题栏显示当前 Tab 名称和未保存状态提示；dirty 状态确认使用路由守卫；独立窗口模式下显示关闭按钮 |
| 右侧信息面板 | 展示成员、房间操作、小部件和房间级快捷动作 | 原型宽度为 `240px`，可折叠为 `0px`；面板内容包括成员分组、在线状态、管理员/版主标记、通知设置、置顶会话、静音、查看历史、房间设置、邀请屏蔽、退出房间、添加小部件 |
| 全局浮层 | 图片/视频预览、文件拖拽遮罩 | 浮层必须有明确层级和关闭路径，不阻塞非相关主流程；优先使用抽屉而非弹窗，仅对必须中断操作的场景使用弹窗 |

### 3.2 首屏与加载策略

当前布局通过异步组件加载导航栏、列表栏、聊天主区域和右侧信息面板，并结合初始化状态判断是否阻塞首屏。已有会话缓存时不应让用户等待完整同步；首次登录或无缓存时可显示加载覆盖层。

| 场景 | UI 表现 | 规则 |
|---|---|---|
| 无登录会话 | 跳转登录页 | 公共路由不拦截，业务路由经认证守卫跳登录 |
| 有会话且有缓存列表 | 立即渲染主界面 | 后台初始化与同步，必要时显示连接状态横幅 |
| 有会话但无缓存列表 | 显示主加载态 | 加载文案分阶段显示左栏、数据、右栏准备状态 |
| 本地解锁门禁未通过 | 模态解锁弹窗覆盖全屏 | 见 5.12.1；crypto 初始化必须排在其后 |
| 能力探测进行中 | 依赖能力的入口保持可见但不可交互 | 见 7.8；不得先渲染"不可用"再切成"可用" |
| 能力探测失败 | 依赖能力的入口按不可用渲染，并提供重试 | 不得无限 spinner，也不得整页报错 |
| 初始化异常 | 保持可见 UI 或回登录页 | 不允许无说明白屏；错误需进入横幅、Toast 或错误页 |

### 3.3 桌面窗口与辅助窗口

桌面端允许把部分能力作为独立窗口呈现，例如设置、文件管理、图片/视频预览、独立聊天窗口、通话窗口和更新窗口。独立窗口的 UI 应弱化主导航，突出当前任务，并保持标题、关闭、返回或完成按钮可见。

### 3.4 移动端结构

移动端以 `/mobile/home` 为主壳，原型基准尺寸为 `375 × 812`，页面容器为单栏栈式结构。底部 Tab 承载消息、好友、房间、动态、我的等入口；聊天详情、群成员、公告、媒体查看、线程、设置子页使用顶部返回与标题区，页面切换遵循“列表 → 详情 → 编辑”的单向推进。消息列表项支持左滑露出置顶、删除等操作，但不得影响垂直滚动和点击进入聊天。

### 3.5 原型一致性规则

`Tjg/docs/TJG-prototype.html` 是界面布局的验收基准。实现文档、组件拆分和后续 UI 开发可以调整数据接入方式，但不得改变以下结构关系。

| 原型结构 | 文档约束 |
|---|---|
| `pc-body` 四栏 | 桌面消息界面必须保留导航栏、列表栏、聊天区、信息面板四个层级；右侧信息面板可折叠，但不能并入聊天 Header |
| `conn-banner` | 连接状态横幅位于桌面主壳顶部，使用 `role="status"` 和 `aria-live="polite"` 等可访问性语义 |
| `e2ee-banner` | 加密状态作为聊天区内横幅，不和全局连接状态混用 |
| `room-settings-drawer` | 房间设置使用从右侧滑出的多 Tab 抽屉，宽度 `520px`、最大 `90vw` |
| `room-detail-drawer` | 房间详情使用从右侧滑出的详情抽屉，宽度 `480px`、最大 `90vw` |
| `mobile` 容器 | 移动端按 375 × 812 单栏原型设计，状态栏、页面头部、内容区、输入栏和底部导航各自独立 |
| `admin-view` | 管理后台使用独立侧边栏 + 内容区，不复用聊天四栏中的房间列表栏 |
| 抽屉优先 | 桌面端优先使用右侧抽屉展示详情和设置，避免使用居中弹窗；仅对必须中断操作的场景（如确认删除、协议同意）使用弹窗 |

## 4. 设计系统

### 4.1 令牌命名

所有新增样式默认使用 `--tjg-*`。旧 `--hula-*` 只允许作为兼容别名存在，不应作为新组件的主依赖。

| 类型 | 令牌示例 | 用途 |
|---|---|---|
| 品牌色 | `--tjg-brand`、`--tjg-color-primary-500`、`--tjg-color-primary-600` | 主按钮、发送气泡、重点状态 |
| 文本色 | `--tjg-text-primary`、`--tjg-text-secondary`、`--tjg-text-tertiary`、`--tjg-text-inverse` | 正文、说明、占位、反色文本 |
| 表面色 | `--tjg-surface-app`、`--tjg-surface-panel`、`--tjg-surface-sidebar`、`--tjg-surface-search` | 页面背景、面板、侧栏、搜索框 |
| 边框色 | `--tjg-border-default`、`--tjg-border-muted`、`--tjg-border-strong` | 分割线、输入框、卡片边框 |
| 状态色 | `--tjg-status-online`、`--tjg-status-offline`、`--tjg-status-busy`、`--tjg-status-away` | 在线状态、用户状态点 |
| 动效 | `--tjg-motion-duration-*`、`--tjg-motion-ease-*`、`--tjg-motion-scale-active` | 悬停、按下、展开、浮层 |

### 4.2 色彩规范

| 场景 | 令牌 | 说明 |
|---|---|---|
| 品牌主交互 | `--tjg-color-primary-500` | 常规品牌色，用于强调控件和选中态 |
| 发送消息气泡 | `--tjg-bubble-sent-bg` | 使用更深的 `#0f7a66`，保证白字正文对比度 |
| 接收消息气泡 | `--tjg-bubble-received-bg` | 默认使用提升表面色，避免与背景融合 |
| 会话选中态 | `--tjg-surface-session-active` | 品牌色渐变，选中态文字需切换为反色或高对比色 |
| 管理后台 | `--tjg-admin-*` | 管理后台独立视觉区域，不直接复用聊天主界面的背景层级 |
| 危险操作 | `--tjg-color-danger-500` 或 `--tjg-color-danger-600` | 删除、封禁、退出等动作必须配二次确认或明确提示 |

### 4.3 字体与排版

| 层级 | 建议令牌 | 使用场景 |
|---|---|---|
| `10px` | `--tjg-font-size-xs` | 小徽标、极短状态标签 |
| `11px` | `--tjg-font-size-2xs` | 辅助角标、列表次级信息 |
| `12px` | `--tjg-font-size-sm` | 时间、说明文字、按钮辅助文字 |
| `13px` | `--tjg-font-size-md` | 消息气泡正文、紧凑表格正文 |
| `14px` | `--tjg-font-size-base` | 标准正文、表单文本 |
| `15px` | `--tjg-font-size-2lg` | 会话标题、联系人标题 |
| `16px+` | `--tjg-font-size-lg` 及以上 | 页面标题、模块标题 |

### 4.4 间距、圆角与阴影

界面使用 4px 栅格。列表项、按钮、输入框、卡片的空间关系应优先使用 `--tjg-space-*`、`--tjg-radius-*` 和 `--tjg-shadow-*`。会话卡片和浮层的视觉层级通过背景、阴影、边框三者组合表达，避免仅依赖颜色区分。

### 4.5 动效

动效用于表达操作反馈，不用于拖慢任务。普通悬停与按下反馈使用 `120ms - 180ms`，浮层与遮罩使用 `240ms - 280ms`，历史保留的长动效必须标注原因。`v-ripple` 已在 `prefers-reduced-motion: reduce` 下自动禁用，新交互动效也必须遵守该偏好。

## 5. 核心页面需求

### 5.1 认证页

| 页面 | 路由 | 需求 |
|---|---|---|
| 登录 | `/login`、`/mobile/login` | 支持账号密码、自动登录、服务器配置、第三方登录、错误反馈和加载态 |
| 注册 | `/register` | 支持基础注册表单、可用性校验、协议链接、验证码或 UIA 承接 |
| 找回密码 | `/forgetPassword`、`/mobile/MobileForgetPassword` | 清晰区分账号输入、验证、重置结果 |
| 二维码登录 | `/qrCode`、`/mobile/ConfirmQRLogin` | 显示扫码状态、过期状态、确认登录结果 |
| OIDC 回调 | `/oidc/callback` | 中间态需说明正在完成登录，失败时给出重试或返回登录入口 |

登录页不应暴露过多技术信息。服务器配置入口可以放在高级设置或底部辅助区域，保存后需立即影响后续登录请求。

能力依据与降级：

| 能力 | 后端前提 | 规则 |
|---|---|---|
| 密码登录 | 始终可用（57 条认证类注册条目中的稳定子集） | 表单校验在前端完成；失败响应可能是 **401**（当前实现）或 **403**（规范），两者都要按"凭据错误"处理 |
| SSO / OIDC | `oidc` profile 开启（8 条 `/_matrix/client/v3/oidc/*` 与 `login/sso/*` 路由） | 未开启时路由 **404**（不是 405）；`m.sso` 能力位**只在认证后**下发，登录页必须以 `GET /_matrix/client/v3/login` 的 `flows` 为唯一来源；回调页只在 `/oidc/callback` 命中时展示 |
| SAML / CAS | 服务端配置 + 可选模块（SAML 16 条、CAS 12 条路由始终注册，但未启用时不可用） | 同样以 `flows` 为准；不要因为路由存在就渲染按钮 |
| 二维码登录 | MSC4108 rendezvous 4 条 + `/_matrix/client/v1/rendezvous/*` 6 条 | 展示扫码态、过期态与失败重试；轮询需有上限，超时后回到"刷新二维码" |
| 验证码 | 5 条验证码路由 | 仅在服务端返回对应 UIA 流程时展示；`verified` 是 wire 字段名（不是 `is_verified`） |
| 注册 | 注册令牌 9 条管理路由 + `registration` 子域 | 是否需要令牌、是否需要验证码，均由 `/register` 返回的 `flows` 决定，不硬编码 |

页面状态：

| 状态 | 表现 | 边界 |
|---|---|---|
| 加载中 | 提交按钮进入 loading，输入区禁用 | 禁止重复提交；按钮宽度不跳动 |
| 凭据错误 | 字段级错误，聚焦密码框 | 401/403 均归此类；不清空已填账号 |
| 被限流 | 横幅或 Toast 显示"尝试过于频繁，请 N 秒后重试"，可重试时间以 `retry_after_ms` 为准 | 429 不得显示"用户名或密码错误" |
| 服务不可用 | 错误页或横幅，提供"重试 / 修改服务器" | 5xx 与网络错误归此类 |
| 能力未启用 | 不渲染对应按钮 | SSO/SAML/CAS 未启用时**隐藏**而非置灰 |

登录失败锁定：默认 5 次失败后锁定（IP 级 30 次），锁定时长由服务端配置给出（代码默认 900s），`retry_after_ms` 会随重试次数指数增长。错误提示需区分"凭据错误""被锁定/限流""服务不可用"三类，并说明剩余可重试时间（详见 2.4.6 补充与 7.7）。

### 5.2 消息主界面

消息主界面是最高频页面，使用四栏布局：左侧导航栏（64px）+ 消息列表栏（300px）+ 聊天主区域（flex-1）+ 右侧信息面板（240px）。任何加载、错误、空状态都必须有稳定呈现，并保持与 `Tjg/docs/TJG-prototype.html` 的四栏主壳一致。

| 区域 | 内容 | 规则 |
|---|---|---|
| 消息列表栏 | 页面标题"消息"、创建按钮、更多按钮、空间快捷入口（TJG 生态、开发者空间）、会话过滤 Tab（全部/未读/群聊/单人）、房间列表 | 宽度 `300px`；空间快捷入口使用图标按钮；会话过滤 Tab 显示未读数徽标；房间项显示头像、名称、最后消息、时间、未读数、加密/置顶标识 |
| 连接与加密横幅 | `offline`、`connecting`、`syncing`、`error`、端到端加密状态 | 连接横幅属于主壳顶部状态；加密横幅属于聊天区局部状态，两者不得合并 |
| 聊天头部 | 成员面板开关、头像、名称、在线人数、服务器信息、语音、视频、群通话、房内搜索、线程、私密模式、弹出窗口、更多操作 | 单聊与群聊头部信息不同；窄屏隐藏非关键操作；私密模式按钮需有按下态和语义标签；线程入口在 `canUseThreads()` 为 false 时隐藏 |
| 时间线 | 文本、图片、文件、语音、回复、反应、置顶、粘性消息、撤回、系统消息、日期分割、加载更多、解密失败提示 | 消息气泡需区分发送和接收；失败消息必须可重试或删除；发送中状态不得让用户误以为已送达；解密失败显示重试按钮；粘性消息展示到期时间（`sticky_expiry_ts`），不展示"软失败" |
| 输入区 | 表情、附件、图片、语音、文件、截图、富文本输入、@ 成员选择浮层、发送按钮 | 空输入禁用发送；上传和发送过程显示进度或状态；@ 浮层靠近输入区并支持键盘选择 |
| 右侧信息面板 | 成员分组（在线/离线）、成员列表、角色标记（管理员/版主）、房间操作（通知设置、置顶会话、静音、查看历史、房间设置、邀请屏蔽、退出房间） | 保持 `240px` 右栏结构，可折叠；成员显示头像、名称、在线状态点；不应破坏主聊天滚动位置 |

能力依据与降级：

| 能力 | 后端端点 | UI 规则 |
|---|---|---|
| 滑动同步 | `org.matrix.msc3886.sliding_sync`（4 条） | 探测可用时启用增量同步；不可用时回落 `/sync`，UI 不体现差异 |
| 线程 | 房间级 threads 读面（MSC3856）+ 私有面（创建/删除/搜索/未读/冻结/静音/已读/统计），合计 21 条 | 入口以 `canUseThreads()` 为准；线程内消息不得与主时间线重复计数未读 |
| 粘性消息 | `/_matrix/client/unstable/org.matrix.msc4354/rooms/{room_id}/sticky_events`（GET/POST/DELETE，3 条） | 可展示与设置粘性消息；请求时长上限 1h，超出由前端拦截；**不提供** soft-fail 相关操作 |
| 延迟事件 | 延迟事件 7 条（含状态事件写端点） | 可提供"定时发送"；已发送的定时任务需可查询、可取消；不提供"定时状态事件"高级 UI |
| 已读与输入状态 | receipts + `/_matrix/client/v3/rooms/{room_id}/typing/{user_id}`（输入状态 5 条） | 已读回执与输入提示失败时静默降级，不打扰用户；不要用 `org.matrix.msc3873` 能力位做判据（无实现） |
| 房内搜索 | `/_matrix/vendor/v1/rooms/{room_id}/search` 等 | 搜索无结果用 `no-results`，与"房间无消息"区分 |
| 限流 | 服务端 429 + 客户端熔断 | 见 7.7；发送失败必须保留输入内容 |

### 5.3 好友与联系人

好友页在桌面端通过 `/friend` 系列路由进入（`/friend`、`/friend/add`、`/friend/requests`、`/friend/:userId`），移动端通过 `/mobile/friends` 进入。桌面端使用三栏布局：左侧导航栏 + 联系人列表栏（300px）+ 好友详情区域（flex-1）。列表、申请、搜索和详情需保持同一术语：好友、申请、分组、备注、状态。

| 区域 | 内容 | 规则 |
|---|---|---|
| 联系人列表栏 | 好友通知入口、群组验证入口、搜索框、过滤 Tab（全部/在线/收藏/自定义）、好友列表 | 宽度 `300px`；好友通知和群组验证显示未读数徽标；好友列表按在线/离线分组；支持在线状态点、备注名、Matrix 好友标识 |
| 好友详情区域 | 头像、昵称、Matrix ID、操作按钮（发消息/语音/视频）、详细信息表格 | 自适应剩余宽度；操作按钮使用图标 + 文字；详细信息包含 Matrix ID、所在服务器、加入时间、备注、设备数 |
| 好友申请 | 申请卡片展示头像、来源、附言、同意、拒绝；批量操作需避免误触 | 好友通知入口点击后展开申请列表 |
| 好友搜索 | 输入后即时展示结果；匹配文字高亮；无结果使用 `no-results` 空状态 | 搜索框支持好友/群聊/Matrix ID 混合搜索 |

能力依据与降级：

- 好友关系、申请、分组、备注、好友状态全部来自 `/_matrix/vendor/v1/friends/*`（28 条），不假设存在规范等价端点。
- 在线状态必须来自 presence 查询或 presence 批量列表，不得使用好友接口内嵌的静态字段推断（详见 7.6）。
- 好友搜索与用户目录搜索是两条链路：好友搜索走 `friends/search`，陌生人搜索走 `user_directory/search`，结果分组展示，不混为一个列表。
- **邀请策略**（MSC4155）走账号数据 `m.invite_permission_config`，实现的是 `default_action` + `user_exceptions` / `server_exceptions` 旧方案，而 MSC 最终文本用 `allowed_users` / `blocked_users` 等字段。UI 只暴露"默认允许/默认拒绝 + 例外名单"这一组语义，**不得**在文案中承诺与 Element / Synapse 的邀请策略互操作。
- **第三方目录查询不可用**：`/thirdparty/{location,user}` 4 条为 by-design 404，联系人搜索不得提供"从第三方网络查找"入口。
- 好友能力位在认证后才下发（`io.hula.friends`），首次进入好友页必须先等待能力加载完成，避免"闪一下空列表再出现"（见 7.8）。

### 5.4 房间

房间页在桌面端通过 `/room` 系列路由进入（`/room`、`/room/create`、`/room/join`、`/room/:roomId`）。桌面端使用两栏布局：左侧导航栏 + 内容区域（flex-1）。内容区域使用房间卡片网格展示，顶部提供过滤 Tab 和搜索、过滤条件。房间详情与房间设置必须按原型使用右侧抽屉，不使用全屏弹窗替代桌面端抽屉。

| 区域 | 内容 | 规则 |
|---|---|---|
| 内容区域 | 过滤 Tab（全部/我加入的/我创建的）、搜索框、过滤条件（类型/加密/成员）、房间卡片网格 | 自适应剩余宽度；卡片网格响应式布局；每个卡片显示房间头像、名称、在线人数、描述、成员数、联邦/加密标识、操作按钮 |
| 房间卡片 | 房间头像、名称、在线人数、描述、成员数、联邦/加密标识、操作按钮（聊天/信息/设置/置顶） | 卡片使用圆角矩形；操作按钮使用图标；联邦房间显示联邦标识；加密房间显示加密标识 |
| 创建房间 | 至少包含房间名称、公开性、加密、成员邀请；高级项折叠 | 创建入口位于右上角 `+` 按钮 |
| 加入房间 | 支持公开目录、房间 ID 或链接输入、加入理由 | 通过搜索框输入房间 ID 或链接 |
| 房间详情 | 使用 `480px` 右侧详情抽屉，展示成员、公告、文件、标签、权限、保留策略、加密状态 | 从房间卡片信息按钮触发 |
| 房间设置 | 使用 `520px` 多 Tab 右侧设置抽屉，Tab 包含基本信息、成员、权限、加密、通知、别名、历史、保留、标签、粘性事件、高级 | 从房间卡片设置按钮触发 |

能力依据与降级：

- 创建房间只使用 v12（`m.room_versions.default = "12"`；`available` 中 v1–v11 的 disposition 为 `stable_no_create`）；UI 不展示房间版本选择器，历史房间仍可正常加入、解析和联邦。
- 房间卡片与详情摘要来自 `rooms/{room_id}/summary*`（`/_matrix/vendor/v1` 下 16 条），规范形态另有 `GET /_matrix/client/v1/rooms/{room_id}/summary`。摘要成员缺失时回退到 `/members`，不能把空摘要渲染为"无成员"。
- 置顶、权限、通知、时间线、未读数、房内搜索、粘性事件、阅后即焚等房间级扩展走 `/_matrix/vendor/v1/rooms/*`（92 条，含 16 条摘要与 10 条线程），路径统一由 `services/matrix/paths/room.ts` 生成。
- 退出房间可勾选"同时遗忘"：后端 `m.forget_forced_upon_leave` 恒为 true，leave 与 forget 在同一事务内完成，UI 不需要再发一次 `/forget`。
- 房间设置抽屉中的"粘性事件"Tab 只暴露设置与到期时间；请求时长上限 `1h`，超出必须在前端拦截并提示，不下发请求。
- 房间创建参数由前端做类型与必填校验：后端对 `name: 123` 这类非法类型与未知字段会静默接受，事后报错代价更高。
- 级联撤回（MSC3912）只做单层，不递归；撤回确认文案不得声称"撤回该消息及其全部引用链"。

### 5.5 空间

空间功能在桌面端通过 `/space` 系列路由进入（`/space`、`/space/create`、`/space/:spaceId`），移动端为 `/mobile/space`。桌面端使用两栏布局：左侧导航栏 + 内容区域（flex-1）。内容区域展示空间列表和子房间列表，顶部提供空间选择器和搜索。空间 UI 应把"空间"和"房间"关系表达清楚，避免用户误以为空间本身就是聊天房间。

| 区域 | 内容 | 规则 |
|---|---|---|
| 内容区域 | 空间选择器、搜索、创建入口、我的空间列表、子房间列表 | 自适应剩余宽度；空间按"我的空间"分组；每个空间可展开显示子房间 |
| 空间卡片 | 空间头像、名称、子房间数、成员数、描述 | 空间卡片使用圆角矩形；支持展开/折叠子房间列表 |
| 子房间列表 | 房间头像、名称、成员数、在线人数、聊天入口 | 子房间缩进显示；点击房间名称进入聊天；右侧显示聊天入口图标 |
| 空间详情 | 显示简介、成员、子空间、关联房间、加入或退出入口 | 从空间卡片触发 |
| 探索公开空间 | 底部提供"探索公开空间"入口 | 点击后进入公开空间目录 |

能力依据与降级：

- 空间树、子房间、成员、加入/退出、公开目录、统计由规范 hierarchy（`GET /_matrix/client/{v1,v3}/rooms/{room_id}/hierarchy` 4 条）与 `/_matrix/vendor/v1/spaces/*`（22 条）共同提供，空间模块合计 26 条。UI 不区分端点来源，只依赖服务层返回结构。
- 空间与房间是两级关系：空间节点只承载层级与成员语义，进入聊天必须落到具体房间。
- 空间目录为空时使用 `no-spaces` 空状态，并区分"没有空间"和"搜索无结果"。
- 管理侧空间治理走 `/_synapse/admin/v1/spaces/*`（管理员空间列表、房间、成员、统计），与客户端空间能力是两条链路，前端不得复用同一 store。

### 5.6 机器人与 AI 助手

机器人界面在桌面端通过 `/robot` 与子路由 `/chat` 进入（v2.4 中的 `/openclaw` 不存在，已删除）。桌面端使用三栏布局：左侧导航栏 + AI 聊天列表栏（300px）+ 功能展示区域（flex-1）。AI 助手提供 AI 搜索、PDF 阅读、图像生成等功能。

| 区域 | 内容 | 规则 |
|---|---|---|
| AI 聊天列表栏 | TJG-ChatBot 标题、用户信息、聊天列表、设置/刷新/新建聊天/全部删除按钮 | 宽度 `300px`；聊天列表显示主题、对话数、时间；底部提供设置、刷新、新建聊天、全部删除操作 |
| 功能展示区域 | TJG-ChatBot 标题、副标题、功能卡片（AI 搜索、PDF 阅读、图像生成） | 自适应剩余宽度；功能卡片使用图标 + 标题 + 描述；点击功能卡片进入对应功能 |
| AI 搜索 | 搜索框、对话历史、示例问题 | 支持自然语言提问；显示对话轮数 |
| PDF 阅读 | PDF 上传、文档摘要、问答交互 | 支持上传 PDF 文件；提取文档摘要；支持基于文档的问答 |
| 图像生成 | 描述输入、风格选择、生成结果 | 支持文本描述生成图像；支持多种风格和尺寸 |

能力依据与降级：

- **`openclaw` 能力位后端不宣告**：synapse-rust 全仓无 `openclaw` 标识（`/capabilities` 与 `/versions` 均不下发），因此 `MatrixCapabilityService.canUseOpenClaw()` 在当前后端上恒为 `false`。机器人页入口**不得**以该能力位为门控，否则入口永远不可见；如需按部署开关控制，应由本地配置或 `plugins/robot` 自身的可用性判断，并登记到 2.4.6 的"不可依赖项"。
- AI 搜索、PDF 阅读、图像生成依赖第三方服务，与 Matrix 能力面无关；失败一律走局部 `ErrorState`，不得降级成"能力不可用"。
- AI 请求需经 `MatrixHttpClientAiGate` 统一出网，不得在组件内直接 `fetch`。

### 5.7 设置页

桌面端设置页通过 `/settings?tab=...` 访问，历史路径应重定向到对应 Tab。移动端设置子页位于 `/mobile/mobileMy/...`。桌面端使用三栏布局：左侧导航栏（`64px`）+ 设置菜单栏（`240px`）+ 设置内容区（flex-1），与 3.1 主壳结构一致。设置页应支持搜索、分组、未保存提示和跨端一致命名。

| 区域 | 内容 | 规则 |
|---|---|---|
| 设置菜单栏 | 设置标题、搜索框、14 个设置 Tab 的分组列表、提供方信息 | 宽度取 `--tjg-settings-sidebar-width`（`240px`）；分组固定为通用(6)/通讯(3)/安全(2)/高级(2)/其他(1)；菜单项使用图标 + 文字；选中态使用品牌色背景 |
| 设置内容区 | 页面标题、设置项分组、输入框、开关、按钮 | 自适应剩余宽度；设置项使用标签 + 输入/开关布局；分组标题使用大字号；dirty 状态由路由守卫确认 |

Tab 清单以 `src/stores/domains/settings/settingsSchema.ts` 的 `SETTINGS_TABS` 为唯一来源，共 14 项。`requiredCapability` 为空表示无能力依赖；`capabilityFallback` 缺省为 `hide`：

| Tab id | 分组 | 内容 | 能力依赖与降级 |
|---|---|---|---|
| `account` | 通用 | 头像、昵称、Matrix ID、ThreePID、个人简介、扩展资料字段 | 无能力依赖；字段可编辑性以 `m.set_displayname` / `m.set_avatar_url` / `m.3pid_changes` / `m.profile_fields` 为准 |
| `sessions` | 通用 | 登录历史、当前设备、注销会话 | 无能力依赖；设备 13 条 |
| `appearance` | 通用 | 主题、字体、密度、预览 | 无能力依赖 |
| `notifications` | 通用 | 推送规则、免打扰、桌面通知、移动通知 | 规范路由段 `notifications`；推送 25 条 |
| `preferences` | 通用 | 语言与区域、代理、Homeserver、基础行为 | 无能力依赖；切换 Homeserver 后必须重跑能力探测 |
| `keyboard` | 通用 | 全局快捷键、发送快捷键、搜索和跳转快捷键 | `desktopOnly`，移动端不展示 |
| `voiceVideo` | 通讯 | 摄像头、麦克风、扬声器、通话偏好 | `requiredCapability: 'voip'`（缺省隐藏）；通话信令不依赖 `rtc/transports` 的 `ws_url` |
| `friends` | 通讯 | 好友申请策略、好友分组、备注与通知 | `requiredCapability: 'friend-list'`；邀请策略语义见 5.3 |
| `burnAfterRead` | 通讯 | 阅后即焚默认时长、待销毁列表、销毁提示 | `requiredCapability: 'burn-after-read'`；探测 false 时整 Tab 隐藏 |
| `securityPrivacy` | 安全 | 设备信任、会话安全、私密聊天入口、屏蔽列表、注销账号 | 规范路由段 `security-privacy`；注销的"删除内容"选项不可用（501，见 2.4.6） |
| `encryption` | 安全 | 加密开关、密钥备份、密钥轮换、交叉签名 | `requiredCapability: 'e2ee'` + `capabilityFallback: 'readonly'`（无能力时保留 Tab 但只读）；备份页不得提供"验证备份"按钮 |
| `mjolnir` | 高级 | 审核策略、举报队列入口、封禁列表 | `requiredCapability: 'admin-api'`（缺省隐藏）；评分端点为 by-design 404 |
| `storage` | 高级 | 缓存、媒体、下载、清理策略 | 无能力依赖 |
| `helpAbout` | 其他 | 版本、更新、协议、反馈、诊断 | 规范路由段 `help-about` |

移动端设置子页挂在 `/mobile/mobileMy/` 下，清单有**两个来源、必须同时维护**：

- `src/mobile/views/my/settingsRoutes.ts` 的 `MOBILE_SETTINGS_RELATIVE_PATHS`：`securityPrivacy`、`password`、`ignoredUsers`、`simpleBio`、`securityKey`、`storage`、`pushSettings`、`invitePermission`、`devices`、`deactivateAccount`、`helpAbout`、`labs`、`labs/integrations`。
- `src/router/routes/mobile.ts` 中的内联字面量子路由（6 项）：`notifications`、`voiceVideo`、`homeserver`、`files`、`burnAfterRead`、`preferences`；此前登记的 `mjolnir` 已随移动端 admin 能力裁剪移除。

> ⚠️ **跨端与同端不一致（已登记为收敛项）**：① 桌面端用 kebab-case（`security-privacy`、`help-about`），移动端复用 `SETTINGS_CANONICAL_ROUTE_SEGMENTS` 得到 camelCase 段名；② 移动端子路由分散在两个文件里，新增页面容易只改一处。新增设置子页时必须同时更新这两处，并在本表登记。

原先文档中的"实验室""AI 连接""通用设置""账号管理""偏好设置""通知提醒""存储管理""外观主题"不是独立 Tab，已按上表收敛；桌面端 Labs 入口已移除，移动端 Labs 路由（`labs` 与 `labs/integrations`）作为历史兼容保留。

### 5.8 管理后台

管理后台通过 `/admin` 进入，路由要求 `requiresAdmin`。左侧更多菜单仅在后端能力存在且当前用户具备权限时展示管理后台入口。管理后台按原型使用独立 `admin-view`：左侧导航栏 + 管理侧边栏 + 内容区，顶部提供页面标题、副标题和工具按钮。

| 区域 | 内容 | 规则 |
|---|---|---|
| 管理侧边栏 | TJG 管理后台标题、返回按钮、管理导航菜单、当前角色信息 | 宽度 `220px`（`AdminLayout.vue`），`769–1024px` 折叠为 `64px` 图标栏；导航按 7 组组织：总览、用户管理、房间管理、联邦、消息、安全、系统 |
| 内容区域 | 页面标题、API 路径、工具按钮、统计卡片、图表、表格 | 自适应剩余宽度；仪表盘显示注册用户、日活、房间数、存储使用、用户增长趋势、系统健康、消息量统计、活跃时段热力图和系统资源详情 |
| 统计卡片 | 图标、标签、数值、变化百分比、进度条 | 卡片使用圆角矩形；数值使用大字号；变化百分比按国内习惯着色：**上涨红色、下跌绿色**，并同时用箭头与正负号表达方向，不单靠颜色 |
| 图表 | 折线图、环形图、柱状图、热力图 | 图表使用品牌色；支持刷新按钮 |

| 页面 | 路由 | 说明 |
|---|---|---|
| 仪表盘 | `/admin/dashboard` | 总览注册用户、日活、房间数、存储使用、用户增长趋势、系统健康、消息量统计、活跃时段热力图和系统资源详情 |
| 用户管理 | `/admin/users` | 搜索、禁用、重置、查看用户信息 |
| 房间管理 | `/admin/rooms` | 搜索、状态、成员、封禁、删除或归档 |
| 联邦 | `/admin/federation`、`/admin/federation-monitor` | 服务器互联状态、失败原因、监控 |
| 审计与日志 | `/admin/audit`、`/admin/server-logs` | 操作记录、系统日志、过滤、导出 |
| 安全 | `/admin/security` | 安全策略、风险项、访问控制 |
| 注册令牌 | `/admin/registration-tokens` | 创建、复制、启停、过期状态 |
| 保留策略 | `/admin/retention` | 全局或房间级消息保留配置 |
| 通知 | `/admin/notices`、`/admin/notifications` | 服务通知和通知策略管理 |
| 模块 | `/admin/modules` | 功能模块状态、开关、详情 |
| 审核 | `/admin/moderation` | 举报队列、事件预览、处理动作 |
| SAML | `/admin/saml` | SAML 身份提供方配置与元数据查看；`saml_enabled=false` 时显示禁用说明而不是报错 |
| 应用服务与维护 | `/admin/app-services`、`/admin/maintenance`、`/admin/server-config` | 应用服务、服务器配置和维护工具 |
| 访客与空间 | `/admin/guests`、`/admin/spaces` | 访客账号与空间治理 |
| 遥测与后台更新 | `/admin/telemetry`、`/admin/background-updates` | 服务端遥测状态/告警与后台更新任务进度 |

能力依据与降级：

- 管理后台共依赖 Admin API **300** 条：用户管理 **76**、服务器 **62**、房间管理 **59**、安全 **58**、媒体 **23**、联邦 **22**。
- **媒体子域 23 条当前没有任何管理页面承接**（`Admin*` 视图无媒体页）。在补齐页面前，不得在导航中承诺"媒体治理"能力；如需临时处置，只能通过房间级媒体隔离端点操作并逐条确认。
- 上游的实验性备份管理 API（`/_synapse/admin/v1/backups`）**本仓不注册**，管理后台不得提供"备份管理"入口。
- 入口可见性以 `AdminApiProbeService.ts` 与 `adminApiAvailability.ts` 的探测结果为准：探测失败或权限不足时隐藏对应菜单项，不渲染空页面。
- SAML、OIDC、Worker 等可选能力在默认构建下路由可能返回 404；管理页必须区分"无权限""能力未启用""请求失败"三种状态。
- 危险操作（封禁、删除房间、清理媒体、级联撤回）必须二次确认，并在响应缺少标准 `errcode` 时按"未知错误"处理而不是静默成功。
- 管理列表分页语义与客户端列表不同：多数列表使用 `from` / `next_token` / `total` 三件套，空 `next_token` 表示到底，不得用"返回条数小于 limit"推断结束。

管理后台视觉使用 `--tjg-admin-*` 令牌。统计卡片、趋势图、环形健康图、柱状图、热力图、表格、筛选、批量操作和危险操作需要清晰层级；移动端若开放管理入口，应采用全屏列表和详情栈，而不是压缩桌面表格。

### 5.9 私密聊天与阅后即焚

私密聊天入口包括 `/secretChat`、`/privateChat` 重定向到设置安全隐私 Tab，以及登录页中的私密聊天弹窗。阅后即焚能力分为房间级配置、消息标记、销毁提示和待销毁列表。

| 能力 | UI 要求 |
|---|---|
| 私密聊天模式 | 入口清晰，开启后显示 `PrivateModeBanner` 或等价提示，不遮挡输入区 |
| 阅后即焚开关 | 使用明确文案说明销毁时机和影响范围 |
| 焚毁消息 | 消息上显示剩余时间或已销毁状态，避免用户误以为发送失败 |
| 防截屏提示 | 仅在房间开启了 `com.hula.privacy` 的 `block_screenshot` 时展示水印；文案只承诺"水印提醒"，不承诺阻止截屏（详见 5.9.1） |

能力依据与降级：

| 能力 | 后端端点 | UI 规则 |
|---|---|---|
| 房间级策略读取 | `GET /_matrix/vendor/v1/rooms/{room_id}/burn` | 打开设置或消息菜单时读取，不依赖本地缓存推断 |
| 房间级策略写入 | `PUT /_matrix/vendor/v1/rooms/{room_id}/burn` | 仅管理员可见；失败时保留原值并提示 |
| 待销毁列表 | `GET /_matrix/vendor/v1/rooms/{room_id}/burn/pending` | 显示剩余时间与发起人；空列表不显示占位骨架 |
| 标记焚毁 | `POST /_matrix/vendor/v1/rooms/{room_id}/burn/{event_id}` | 成功后消息进入“已标记”状态 |
| 取消焚毁 | `DELETE /_matrix/vendor/v1/rooms/{room_id}/burn/{event_id}` | 仅在销毁前可用；过期后按钮置灰 |
| 个人统计 | `GET /_matrix/vendor/v1/user/burn/stats` | 设置页展示累计销毁数量，不作为安全承诺 |
| 个人默认配置 | `PUT /_matrix/vendor/v1/user/burn/config` | 仅影响新建会话的默认值 |

- 能力开关 `io.hula.burn_after_read` 只在**认证后**出现在 `/capabilities`，`/versions` 的 `unstable_features` 不暴露**任何** `io.hula.*` 私有能力（这是后端契约测试钉死的不变量）；因此 UI 必须在登录后重新探测，不能沿用登录前的缓存。
- 探测为 `false` 时隐藏阅后即焚入口与设置 Tab，不显示禁用按钮。
- 焚毁消息在时间线上的状态必须由服务端返回的销毁时间驱动，本地计时只用于倒计时展示。
- 待销毁列表为空时不显示骨架占位；列表项需显示剩余时间与发起人，且剩余时间到达后自动移除并刷新。

#### 5.9.1 房间级防截屏（水印警示）

房间级"防截屏"由 `Tjg/src/composables/chat/useRoomAntiScreenshot.ts` 承载，读取房间账号数据 `com.hula.privacy` 的 `action: block_screenshot` 标记。

| 维度 | 事实 | UI 要求 |
|---|---|---|
| 能力边界 | 该标记只让客户端**打水印警示**，**不能阻止**任何截屏/录屏工具 | 文案必须写"已开启水印提醒"，禁止写"已禁止截屏""截屏将被拦截" |
| 服务端语义 | 服务端只存一个房间状态事件，无法验证客户端是否真的执行 | 不得在房间列表/详情宣称"本房间受截屏保护" |
| 读失败方向 | 读失败时 `enabled=false` 并置 `error` | 宁可不显示水印，也不谎称"正在保护"；诊断日志记录失败原因 |
| 写失败方向 | 写失败时回滚乐观更新并把错误抛回调用方 | UI 必须提示失败并恢复原开关状态，不得静默成功 |
| 加载态 | `loading` 为 true 时开关只读 | 避免用户在未读到当前值时反复切换 |

### 5.10 加密与设备安全

加密相关页面与组件包括设备信任、设备验证、交叉签名、密钥备份、密钥轮换、安全密钥设置等。用户需要理解当前房间是否加密、当前设备是否可信、备份是否可恢复。

| 场景 | UI 要求 |
|---|---|
| 加密房间 | 头部或详情中显示加密状态，异常状态提供说明 |
| 设备验证 | 步骤式引导，明确当前设备、对方设备和验证结果 |
| 密钥备份 | 区分未开启、开启中、可恢复、失败状态 |
| 安全密钥 | 设置过程需要防止误丢密钥，关键步骤须二次确认 |

能力依据与降级：

| 能力 | 后端端点 | UI 规则 |
|---|---|---|
| 设备与密钥 | E2EE **22** 条、设备 **13** 条 | 设备列表、验证、交叉签名状态均以服务端返回为准；`/keys/query` 的 device_keys **不含 `verified`**，设备信任纯本地判定，权威入口是 `CryptoApi.getDeviceVerificationStatus()` |
| 密钥备份 | 密钥备份模块 **33** 条（`/room_keys/*` 相关路径条目 37 条，因 `v1`/`v3` 双前缀并存） | 必须区分"未开启 / 开启中 / 可恢复 / 备份损坏"四态 |
| 密钥轮转 | `/_matrix/vendor/v1/keys/rotation/*` 共 **9** 条 | 提供状态、检查、历史、配置、轮转、吊销；轮转为危险操作 |
| 脱水设备 | `/_matrix/client/unstable/org.matrix.msc3814.v1/dehydrated_device*` 共 **6** 条 | 见下方降级规则 |

- 脱水设备（MSC3814）在 SDK 中的能力探测 `SynapseRustFeature.DehydratedDevice` 采用 **fail-closed**：探测失败时视为不支持，UI 隐藏"启用脱水设备"入口，只保留说明文案。
- `/dehydrated_device/{device_id}/events` 同时支持 `GET` 与 `POST` 两种形态（`POST` 为规范形态、游标在 body；`GET` 为上游兼容别名、游标在 query）；UI 不直接拼路径，统一走 `services/matrix/crypto` 的能力封装。
- **`POST /keys/backup/secure/{backup_id}/verify` 不可用**（by-design 404）：备份页不得提供"验证备份"按钮，"是否可恢复"只能通过实际恢复流程验证。
- **`GET /rooms/{room_id}/keys/distribution` 恒 403**、**`GET /_matrix/vendor/v1/rooms/{room_id}/keys/{event_id}` 恒 404**：不提供任何"查看房间密钥"入口。
- 密钥备份恢复失败时不得显示"恢复成功"；上传未完成时必须保留本地密钥副本并提示用户。
- 设备验证、密钥轮转、备份恢复属于不可逆或高风险动作，必须提供明确的取消路径和失败回滚说明。
- 未验证设备的发送策略保持 `globalBlacklistUnverifiedDevices = false`，改由"权威计数 + 用户显式决定"驱动；UI 只展示未验证设备数量与一键验证入口，不自动阻断发送。

### 5.11 媒体、文件与通话

文件上传、拖拽、预览、语音消息、音视频通话均应提供进度、失败、重试和权限提示。桌面端文件拖拽时已有全局遮罩，遮罩文案需提示“松开以上传”而不是只展示装饰效果。

能力依据与降级：

| 能力 | 后端端点 | UI 规则 |
|---|---|---|
| 媒体上传与下载 | 媒体端点共 **60** 条（含缩略图、下载、预览、上传、分片上传） | 上传必须展示进度；下载失败保留原消息并允许重试；大小上限从 `GET /_matrix/media/v3/config` 的 `m.upload.size` 读取（服务端默认 `max_upload_size` = **50 MB**），不在前端硬编码 |
| 缩略图 | `/thumbnail/*` | 服务端 **不生成 `animated` 缩略图**（`animated` 为 MISSING）；GIF/WebP 动图只能回退到原图或静态首帧，不展示"动态缩略图"开关 |
| 语音消息 | `/_matrix/vendor/v1/voice/*` 共 **13** 条（`config`、`register`、`upload`、房间/用户统计等） | 录制与上传是两条链路，任一步失败不能阻塞发送；**服务端不提供编码/转码/优化/转写**（`convert`/`optimize`/`transcription` 为 by-design 404），录音页不得出现"转写为文字"按钮 |
| 通话 | `/_matrix/client/v3/rtc/transports`、`/_matrix/client/v3/voip/config` 等 | 当前实现只返回 ICE 服务器信息，不返回可用的 `ws_url`；通话信令不得依赖该字段 |
| LiveKit | `LivekitConfig.ws_url` | 该配置项在服务端**无读取点**，属于死配置；UI 不读取、不展示、不据此判断可用性 |
| URL 预览 | `GET /_matrix/media/v3/preview_url` | 受 `experimental.msc4452_enabled` 与 `m.preview_url` 能力位门控；关闭时按纯文本链接渲染，不显示破图占位 |

- 语音能力 `SynapseRustFeature.Voice` 采用 **fail-closed**：探测失败即视为不支持，隐藏语音消息与通话入口。
- MSC4335（媒体超限错误码）仍为 PARTIAL 且未接线到 UI，不得作为功能前提。
- 文件大小、类型、时长限制以服务端错误响应为准；前端预校验只用于减少无效上传，不能替代服务端校验。
- 分片上传的 `total_size` 为**必填**且有硬上界（服务端返回 400），前端必须在开始分片前校验并给出明确提示。
- 拖拽遮罩、上传队列与进度组件复用同一状态机：`queued → uploading → failed/succeeded`，失败项必须可单条重试，不得整批回滚。

### 5.12 本地解锁与锁屏

这是两个**不同**的能力，容易混为一谈，必须分开设计：

| 能力 | 触发时机 | 目的 | 代码位置 |
|---|---|---|---|
| 本地解锁门禁 | 每次冷启动、**crypto 初始化之前** | 让"安全存储不可用"的用户仍能以密码保护本地密钥 | `Tjg/src/composables/secure/useLocalUnlockGate.ts`、`Tjg/src/components/secure/LocalUnlockDialog.vue` |
| 锁屏 | 用户主动点击"锁屏"（Tauri 事件广播到所有窗口） | 临时遮挡界面，防止旁人查看 | `Tjg/src/App.vue`、`Tjg/src/layout/left/model.tsx` |

#### 5.12.1 本地解锁门禁

启动流程在 crypto 初始化前调用 `runLocalUnlockPreflight()`：

| 场景 | 判定 | UI 行为 |
|---|---|---|
| 安全存储可用（系统钥匙串或加密文件后端） | `getSecureStorageBackendInfo().available === true` | **不弹窗、不打扰**，直接进入主界面 |
| 安全存储不可用且从未配置 | `isLocalUnlockConfigured() === false` | 弹 `setup` 模式：要求设置本地解锁密码 |
| 安全存储不可用且已配置 | `isLocalUnlockConfigured() === true` | 弹 `unlock` 模式：校验密码后才能继续启动 |
| 用户选择"稍后" | 返回 `false` | 继续启动，但 **E2EE fail-closed**（本次会话加密不可用）；不得把私钥以明文写盘 |

规则：

- 本地解锁密码最小长度 **6**，与私密聊天保持同一规则，不允许两套校验。
- 弹窗必须是**模态且不可跳过**的唯一路径（除"稍后"按钮 `local_unlock_later`），关闭按钮不得等于"稍后"的静默版本。
- 文案**不得**承诺"内容已保护"：这是本机密钥保管方式，不是消息加密开关；已有注释与文案都按此约束，新增文案须沿用。
- 门禁状态放在模块级单例：`App.vue` 负责触发、对话框负责渲染，禁止各自维护一份 `visible`，否则会出现"对话框没弹但启动流程在等"的挂死。
- 校验失败只提示"密码不正确"，不透露长度/字符集细节；连续失败需要退避（避免离线暴力尝试）。
- 进入 `unlock` 模式时必须显式说明"跳过将导致本次会话无法解密历史消息"，不能只写"取消"。

#### 5.12.2 锁屏

用户菜单点击"锁屏"后，桌面端要求输入**本次锁屏密码**，确认后通过 `EventEnum.LOCK_SCREEN` 广播到所有窗口，各窗口按同一份设置渲染锁定层。

| 元素 | 要求 |
|---|---|
| 锁定层 | 覆盖主界面内容，保留用户头像与昵称，输入框自动聚焦，回车提交 |
| 生效范围 | 除白名单外全部路由；白名单为 `/login`、`/tray`、`/qrCode`、`/about`、`/onlineStatus`、`/capture`（`LockExclusion`），新增路由若需免锁必须显式加入白名单并说明理由 |
| 解锁失败 | 提示"密码不正确"，保留输入框焦点，不清空已输入内容以外的状态 |
| 退出路径 | 锁定层不提供"退出登录"直达按钮；如需，必须先解锁 |
| 多窗口 | 主窗口锁定后，独立聊天窗口、文件管理窗口等也必须同时锁定；任一窗口解锁后其余窗口同步解除 |
| 忘记密码 | 当前实现不提供自助找回；已有文案 `setting.security.local_unlock_forgot_hint` 明确"忘记密码将无法恢复本机历史消息，不影响服务端密钥备份（若已启用）"。若后续提供重置，必须同时定义"清除本地数据并重新登录"的确认流程，并明确不可逆 |

## 6. 通用组件需求

### 6.1 反馈组件

| 组件 | 当前基线 | 需求 |
|---|---|---|
| `ConnectionStatusBanner` | 支持 `offline`、`connecting`、`reconnecting`、`syncing`、`error`，错误态有重试与诊断 | 横幅固定顶部，不遮挡关键操作；诊断结果需使用可读列表展示 |
| `EmptyState` | 支持 `no-conversations`、`no-friends`、`no-spaces`、`no-rooms`、`no-results`、`server-unavailable` 六类插图 | 空状态需包含标题、说明和可选操作，不只显示“暂无数据” |
| `SkeletonBase` 系列 | 已有列表、好友、空间、设置等骨架屏组件 | 骨架屏仅用于真实等待，不替代错误状态 |
| `LoadingSpinner` | 支持进度与文案 | 用于首次登录、异步面板加载和明确长任务 |
| `ErrorState`、`ErrorBoundary` | 用于局部错误兜底 | 错误页需给出重试、返回或诊断路径 |
| `PermissionGuard` | 按 `TjgCapability` 判定是否渲染子内容 | 加载中不渲染"不可用"；能力缺失时按 `hide` 或 `readonly` 降级，不在子组件内部自行判断能力 |
| `PrivateModeBanner` | 私密会话模式横幅 | 不遮挡输入区；退出私密模式必须有明确出口 |
| `GlobalAriaLive`、`SkipLink` | 状态播报与首屏跳转 | 状态变化必须播报一次且不重复；跳转目标为会话列表与聊天主区域 |

### 6.2 输入与操作组件

| 组件 | 需求 |
|---|---|
| 按钮 | 明确默认、悬停、按下、禁用、加载态；危险按钮使用危险色并配文案说明 |
| 输入框 | 必填、错误、禁用、帮助文案位置一致；密码输入支持显隐切换 |
| 搜索框 | 支持清空、聚焦、快捷键、加载态、无结果提示 |
| 头像 | 支持在线状态点、默认头像、群头像、空间头像和加载失败兜底 |
| 菜单 | 键盘可访问；危险操作与普通操作视觉区分 |
| 抽屉 | 可关闭、可返回、宽度与断点适配；不应截断关键按钮 |

### 6.3 列表与虚拟滚动

会话、好友、房间、空间、成员、文件、审核队列等列表可使用虚拟滚动。虚拟滚动列表必须保证键盘焦点、滚动恢复、选中态和空状态可用。

### 6.4 富文本与消息输入

消息输入框需要支持文本、表情、提及、粘贴、文件、语音、回复和发送快捷键。发送失败不应清空用户输入；上传中、压缩中、发送中和失败状态要在输入区或消息气泡附近直接展示。

## 7. 交互与状态

### 7.1 连接状态

| 状态 | 展示 | 用户动作 |
|---|---|---|
| `idle` 或 `online` | 不显示横幅 | 无 |
| `offline` | 顶部警告横幅 | 可继续查看缓存内容 |
| `connecting` | 顶部信息横幅与 spinner | 等待连接 |
| `reconnecting` | 展示重连次数 | 可等待或手动重试 |
| `syncing` | 显示正在同步 | 允许继续浏览已加载内容 |
| `error` | 危险色横幅 | 提供重试和诊断 |

### 7.2 空状态

| 场景 | 插图 | 主操作 |
|---|---|---|
| 无会话 | `no-conversations` | 发起聊天、加入房间或添加好友 |
| 无好友 | `no-friends` | 添加好友 |
| 无空间 | `no-spaces` | 创建或探索空间 |
| 搜索无结果 | `no-results` | 清空搜索或调整关键词 |
| 服务不可用 | `server-unavailable` | 重试或打开诊断 |

### 7.3 错误提示

错误提示分为三层：字段级错误、局部区域错误、全局连接或权限错误。字段级错误紧贴字段，局部错误使用 `ErrorState`，连接或鉴权问题使用横幅、Toast 或跳转到 `/403`。

### 7.4 动效与触觉反馈

`v-ripple` 可用于主要按钮和列表点击项，但不得用于密集滚动列表中会造成视觉噪声的区域。所有动效必须响应 `prefers-reduced-motion`，减少动效时保留状态变化但取消大位移、闪烁和涟漪。

### 7.5 文件拖拽

桌面端拖拽文件进入主窗口时显示全屏遮罩，遮罩不接管指针事件，松开后进入上传队列。上传队列需展示文件名、大小、进度、失败原因和重试入口。

### 7.6 在线状态判定

在线状态必须反映用户设备的真实连接状态，不得由好友接口内嵌字段、房间成员缓存或“最近有消息”推断。判定链路如下。

| 环节 | 依据 | 规则 |
|---|---|---|
| 后端 presence | `GET /_matrix/client/v1/presence/{user_id}/status`、`GET` 与 `POST /_matrix/client/v3/presence/list` | 从未登录、从未设置 presence 的用户返回 `offline`，不返回 `online` |
| 状态取值 | `online`、`offline`、`unavailable` | 只有 `online` 映射为在线；其余一律离线 |
| 前端映射 | `src/utils/presenceStatus.ts` 的 `mapPresenceToOnlineStatus` | `presence === 'online' ? OnlineEnum.ONLINE : OnlineEnum.OFFLINE` |
| 批量刷新 | `usePresenceSync` → `getBatchPresence` | 以批量接口结果为唯一来源，失败时保持上一次已知状态而不是猜测在线 |
| 实时更新 | `presence` 事件 / `User.presence` | 只更新对应用户，不做“全列表置为在线”的兜底 |
| 权限不足 | 403 `M_FORBIDDEN` | 降级为离线，并在诊断日志中记录，不在 UI 报错 |
| 用户不存在 | 404 `M_NOT_FOUND` | 降级为离线并标记 `notFound`，联系人列表据此过滤幽灵账号 |

- 好友接口 `/_matrix/vendor/v1/friends/*` 返回的 `online` / `presence` 字段可能滞后或缺失，UI **不得**据此显示绿点。
- 群成员列表与好友列表使用同一套 presence 判定，不允许一处在线、另一处离线。
- 断线、重连、同步中期间保留最后一次已知状态，但连接横幅必须明确当前不是实时状态；重连完成后强制重新拉取。
- 用户可在设置中关闭在线状态上报（`showOnlineStatusEnabled`），关闭后自己对外表现为 `offline`，同时 UI 需说明“他人看不到你的在线状态”。

### 7.7 限流、退避与熔断

429 不是"偶发错误"，而是本项目的常态路径之一（登录失败锁定、`/sync` 令牌桶、nginx 全局限流）。前端由 `Tjg/src/services/matrix/MatrixRateLimitInterceptor.ts` 统一消化，UI 只负责把状态讲清楚。

| 机制 | 实测参数 | 说明 |
|---|---|---|
| 单请求重试 | 最多 3 次；基础退避 1000ms，指数增长 + 10% 抖动，上限 30000ms | 服务端给出 `retry_after_ms` 时优先采用（同样受 30s 上限约束） |
| 端点熔断 | 同一端点连续 429 达 **3** 次 → 开路，冷却 5s 起翻倍增长，上限 120s | 命中后该端点直接返回合成 429，不再打服务端 |
| 全局熔断 | 滑动窗口 **10s** 内 429 总数达 **6** 次 → 开路，冷却 10s 起翻倍增长，上限 120s | 用于识别 nginx 跨端点全局限流风暴，单端点阈值在此时形同虚设 |
| 直接放行 | `/sync` 系列（`v3/sync`、`r0/sync`、simplified sliding sync） | SDK 自带 429 退避，客户端再重试会造成双重限流 |
| 幂等 POST 白名单 | `keys/query`、`keys/changes` | 只读语义的 POST，429 重试无副作用；在此消化可打断"每 3–6 秒一次"的重试风暴 |

UI 规则：

- 429 提示必须带**可重试时间**（取 `retry_after_ms`），文案为"请求过于频繁，N 秒后重试"，不得显示"用户名或密码错误""发送失败"这类误导性结论。
- 熔断期间请求返回的是**合成 429**（`error: 'Client circuit breaker open (server keeps returning 429)'`），不是服务端真实响应。文案应表达"请求过于频繁，正在自动恢复"，不得断言"服务器故障"。
- 重试中的请求需要可见的"正在重试（n/3）"状态，尤其是发送消息与上传文件；用户可主动取消。
- 发送类操作在 429 后必须保留输入内容与上传队列，不得清空。
- 熔断期间禁止用户手动"狂点重试"：按钮进入禁用 + 倒计时，倒计时结束后自动恢复。

### 7.8 能力未就绪态

依赖 `TjgCapability` 的页面/入口必须实现三态，禁止把"还在探测"和"确认不可用"渲染成同一个样子（详见 2.4.8）。

| 状态 | 判定 | 渲染 | 禁止 |
|---|---|---|---|
| 加载中 | `isLoaded === false` | 骨架屏或中性占位；入口保持可见但不可交互 | 显示"当前服务器不支持"；整页 spinner 遮住已加载数据 |
| 可用 | 能力位为 true | 正常渲染 | — |
| 不可用 | `isLoaded === true` 且能力位 false | 隐藏入口（默认）或降级只读（`encryption` Tab），并给一句可理解的原因 | 置灰后不解释；点击才报错 |

补充要求：

- 能力探测失败（三请求全失败）时也必须进入"不可用"态并可重试，**不得无限 spinner**；这一条对应 `refreshCapabilities()` 的空对象兜底。
- 切换 Homeserver 后必须重新探测并重算入口，旧能力态立即失效。
- 依赖能力的空状态要区分"没有数据"和"能力不可用"：例如好友页在 `friend-list` 缺失时应显示"当前服务器未启用好友功能"，而不是 `no-friends`。

### 7.9 错误码与文案映射

错误提示三层（字段级 / 局部 / 全局）的划分见 7.3，本节规定**码到文案**的映射。后端部分路由的错误体是裸 `Json`、没有 `errcode`，因此映射必须允许"只有 HTTP 状态"的分支。

| HTTP | `errcode` | 文案基调 | 处置 |
|---|---|---|---|
| 400 | `M_INVALID_PARAM`、`M_BAD_JSON`、`M_MISSING_PARAM` | "输入内容有误" | 字段级，指出具体字段 |
| 401 | `M_UNKNOWN_TOKEN`、`M_MISSING_TOKEN` | "登录已过期" | 尝试静默刷新一次；失败跳登录页，不回显原始报文 |
| 403 | `M_FORBIDDEN` | "没有权限执行该操作" | 局部错误；权限类动作隐藏而非反复提示 |
| 404 | `M_NOT_FOUND` | "内容不存在或已被删除" | 局部错误，提供返回/刷新 |
| 404 | `M_UNRECOGNIZED`（by-design unsupported） | "当前服务端不支持该功能" | 该入口本就应隐藏（见 2.4.9），若出现说明是前端漏判，需登记缺陷 |
| 410 | `M_GONE` | "内容已被永久移除" | 局部错误，不提供重试 |
| 429 | `M_LIMIT_EXCEEDED` 或合成 429 | "请求过于频繁" | 按 7.7 展示倒计时 |
| 501 | `M_UNKNOWN`（如 `erase: true`） | "服务端不支持该操作，未执行任何变更" | 全局提示，明确"未发生副作用" |
| 5xx | 任意 | "服务暂时不可用" | 横幅 + 重试；连续失败触发连接状态 `error` |
| 无 `errcode` | — | 按 HTTP 状态取兜底文案 | 禁止把原始 JSON 或堆栈展示给用户 |

规则：

- 文案一律走 i18n 键，不在组件内拼接中文；`errcode` 只作分支判据，不作为展示内容。
- 同一错误在多处出现时复用同一文案键，避免"发送失败/消息未送达/发送错误"三种说法。
- 诊断信息（含 `errcode`、状态码、端点）只进日志与诊断面板，不进用户主提示。

### 7.10 边界场景清单

| 场景 | 期望行为 | 禁止 |
|---|---|---|
| 文件超过 `m.upload.size`（默认 50 MB） | 选中文件时即提示超限与上限值，不进入上传队列 | 先上传再失败 |
| 分片上传缺少 `total_size` 或超过硬上界 | 前端补齐并在开始前校验，超界直接拒绝 | 依赖服务端 400 兜底 |
| 消息体过大（超服务端限制） | 发送前拦截并提示拆分 | 发送后显示"未知错误" |
| 房间名 / 昵称 / 群公告超长 | 输入框限制 + 列表内截断 + 悬浮显示完整值 | 溢出撑破布局 |
| 被禁言 / 只读房间 | 输入区替换为说明条，说明原因与解除方式 | 保留可输入的输入框再报 403 |
| 被踢出 / 房间已解散 | 时间线置为只读并提示，提供返回列表入口 | 留在页面继续发送 |
| 会话令牌过期 | 静默刷新一次；失败跳登录并保留草稿 | 循环重试造成 429 |
| 时钟偏差导致倒计时异常 | 用服务端时间与本地时间的差值校正 | 直接信任本地时钟渲染"已过期" |
| 断网期间发送消息 | 进入待发队列，恢复后自动重试并标记状态 | 直接标记失败且不可恢复 |
| 切换 Homeserver | 清空能力缓存、房间缓存与 presence 状态后重新探测 | 沿用旧服务器的能力与列表 |
| 解密失败 | 显示"无法解密"+ 重试 / 请求密钥两个动作 | 显示乱码正文或空气泡 |
| 引用的事件已被撤回 | 引用块显示"消息已撤回"，不影响正文 | 渲染为空白 |
| 成员数 > 1 万的房间 | 成员列表虚拟滚动 + 搜索，分组懒加载 | 一次性渲染全部成员 |
| 多窗口同时改同一设置 | 后写覆盖前写时给出提示并保留最后一次值 | 静默丢弃其中一次修改 |

## 8. 响应式与平台适配

### 8.1 断点

| 范围 | 布局 |
|---|---|
| `< 576px` | 移动端单栏，底部 Tab，详情页栈式进入 |
| `576px - 767px` | 移动端横屏可使用列表 + 详情的轻双栏，但需保留返回路径 |
| `768px - 991px` | 平板或小桌面，左侧导航保留，列表栏压缩，右侧信息面板改抽屉 |
| `992px - 1199px` | 桌面轻四栏，右侧信息面板默认可折叠，列表栏不低于可读宽度 |
| `>= 1200px` | 完整四栏，展示 `64px + 300px + flex + 240px` 原型结构 |

### 8.2 桌面端

桌面端主窗口最小宽度不应低于 `310px`。完整桌面布局以 `Tjg/docs/TJG-prototype.html` 的四栏为准：左侧导航栏固定 `64px`，房间/空间列表栏基准 `300px`，聊天主区域自适应，右侧信息面板基准 `240px` 且可折叠。全局快捷键、文件拖拽、系统托盘、独立窗口、截图和通话窗口只在平台能力可用时展示。

### 8.3 移动端

移动端禁止直接复用桌面四栏。聊天页保留输入区在底部，键盘弹出时内容区可滚动且最新消息不被遮挡。设置、好友详情、群成员、公告、媒体查看等页面使用顶部导航与返回按钮。

### 8.4 Tauri 与 Web 差异

Tauri 能力包括文件系统、窗口、托盘、截图、系统通知、深链等。浏览器或测试环境中缺失平台能力时，UI 需隐藏不可用入口或显示能力不可用说明，不应抛出用户可见异常。

## 9. 可访问性与国际化

### 9.1 键盘导航

主导航、列表、菜单、对话框、抽屉、输入框和管理后台表格必须可通过键盘访问。焦点态不能仅依赖浏览器默认样式；跳转链接如 `SkipLink` 应允许用户直接进入会话列表或聊天主区域。

### 9.2 屏幕阅读器

状态变化应通过 `GlobalAriaLive` 或等价机制通知。空状态、错误状态、连接状态和上传进度要有可读文本，不能只依赖图标、颜色或动画。

### 9.3 对比度

正文文本需满足 WCAG AA 对比度。品牌主色 `#13987f` 搭配白字只适合大字号或短标签，消息发送气泡正文使用更深的 `--tjg-bubble-sent-bg`。

### 9.4 国际化

用户可见文案来自 `Tjg/locales/zh-CN` 和 `Tjg/locales/en`。新增页面、按钮、错误、空状态、设置项、管理后台字段均需补充中英文键值，不允许在组件中长期保留硬编码中文或英文。

## 10. 路由与权限

### 10.1 公共路由

来源：`Tjg/src/router/routes/common.ts`（不经过认证守卫）。

| 路由 | 页面 |
|---|---|
| `/login` | 桌面登录 |
| `/splashscreen` | 桌面启动页 |
| `/register` | 注册 |
| `/forgetPassword` | 找回密码 |
| `/qrCode` | 二维码登录 |
| `/network` | 网络设置 |
| `/tray` | 托盘面板（不入锁屏白名单以外的主流程） |
| `/notify` | 系统通知承接窗口 |
| `/update`、`/checkupdate` | 更新提示与检查更新窗口 |
| `/capture` | 截图窗口 |
| `/imageViewer`、`/videoViewer` | 图片与视频预览（公共窗口，供聊天与文件管理器复用） |
| `/modal-serviceAgreement`、`/modal-privacyAgreement` | 桌面协议弹窗 |
| `/modal-secretChat` | 私密聊天说明弹窗 |
| `/oidc/callback` | OIDC 回调 |
| `/:pathMatch(.*)*` | 404 兜底页 |
| `/403` | 无权限页（在 desktop 路由表中定义，随 admin 一起裁剪，不进移动端产物） |
| `/mobile/login`、`/mobile/MobileForgetPassword` | 移动登录与找回密码 |
| `/mobile/splashscreen` | 移动启动页 |
| `/mobile/serviceAgreement`、`/mobile/privacyAgreement` | 移动协议页 |

### 10.2 桌面主路由

来源：`Tjg/src/router/routes/desktop.ts`。`/home` 的子路由使用**绝对路径**，因此实际地址不带 `/home` 前缀。

| 路由 | 页面 |
|---|---|
| `/message/:roomId?` | 消息主界面 |
| `/friend`、`/friend/add`、`/friend/requests`、`/friend/:userId` | 好友模块 |
| `/room`、`/room/create`、`/room/join`、`/room/:roomId` | 房间模块 |
| `/space`、`/space/create`、`/space/:spaceId` | 空间模块 |
| `/federation` | 联邦主视图 |
| `/search` | 全局搜索承接页 |
| `/friendsList`、`/roomList`、`/spaceList` | 旧路径重定向到 `/friend`、`/room`、`/space` |
| `/settings?tab=...` | 设置页 |
| `/general`、`/loginSetting` | 重定向到 `/settings?tab=preferences` |
| `/notification` | 重定向到 `/settings?tab=notifications` |
| `/shortcut` | 重定向到 `/settings?tab=keyboard` |
| `/account`、`/threepid` | 重定向到 `/settings?tab=account` |
| `/sessions` | 重定向到 `/settings?tab=sessions` |
| `/sidebar`、`/appearance` | 重定向到 `/settings?tab=appearance` |
| `/voiceVideo` | 重定向到 `/settings?tab=voiceVideo` |
| `/security-privacy`、`/privateChat` | 重定向到 `/settings?tab=securityPrivacy` |
| `/encryption` | 重定向到 `/settings?tab=encryption` |
| `/help-about` | 重定向到 `/settings?tab=helpAbout` |
| `/fileManager`、`/previewFile` | 文件管理与文件预览 |
| `/chat-history`、`/multiMsg` | 聊天辅助窗口 |
| `/secretChat` | 私密会话列表（解锁后进入） |
| `/rtcCall` | 通话窗口（屏幕共享走同一窗口，不再单独设 `/sharedScreen`） |
| `/robot`、`/chat` | AI 助手与 AI 对话页（`/chat` 为 `/robot` 的子路由） |
| `/dynamic`、`/dynamic/:id`、`/dynamicDetail` | 动态与动态详情 |
| `/trendradar`、`/mail`、`/onlineStatus`、`/about` | 扩展功能与辅助窗口 |
| `/window/chat/:roomId` | 独立聊天窗口 |
| `/addGroupVerify` | 群组验证 |
| `/admin/*`、`/403` | 见 10.3 |

### 10.3 管理后台路由

| 路由 | 页面 |
|---|---|
| `/admin/dashboard` | 管理后台仪表盘 |
| `/admin/users` | 用户管理 |
| `/admin/rooms` | 房间管理 |
| `/admin/federation`、`/admin/federation-monitor` | 联邦管理与监控 |
| `/admin/notices`、`/admin/notifications` | 服务通知与通知管理 |
| `/admin/registration-tokens` | 注册令牌 |
| `/admin/security` | 安全设置 |
| `/admin/audit`、`/admin/server-logs` | 审计与服务日志 |
| `/admin/retention` | 消息保留策略 |
| `/admin/saml` | SAML 配置 |
| `/admin/maintenance` | 维护工具 |
| `/admin/server-config` | 服务配置 |
| `/admin/guests` | 访客管理 |
| `/admin/spaces` | 空间管理 |
| `/admin/app-services` | 应用服务 |
| `/admin/moderation` | 审核工作台 |
| `/admin/modules` | 功能模块管理 |
| `/admin/telemetry` | 服务端遥测与告警 |
| `/admin/background-updates` | 后台更新任务 |

### 10.4 移动主路由

| 路由 | 页面 |
|---|---|
| `/mobile/home` | 移动主壳 |
| `/mobile/message` | 消息 Tab |
| `/mobile/friends` | 好友 Tab |
| `/mobile/rooms` | 房间 Tab |
| `/mobile/my` | 我的 Tab |
| `/mobile/space` | 空间页 |
| `/mobile/chatRoom/chatMain/:uid?` | 移动聊天页 |
| `/mobile/chatRoom/setting`、`/mobile/chatRoom/searchContent`、`/mobile/chatRoom/mediaViewer` | 移动聊天设置、搜索与媒体查看 |
| `/mobile/chatRoom/groupChatMember`、`/mobile/chatRoom/inviteGroupMember`、`/mobile/chatRoom/manageGroupMember` | 移动群成员管理 |
| `/mobile/chatRoom/notice`、`/mobile/chatRoom/notice/add`、`/mobile/chatRoom/notice/edit/:id`、`/mobile/chatRoom/notice/detail/:id` | 移动公告列表、新增、编辑与详情 |
| `/mobile/chatRoom/thread/:roomId/:threadRootId` | 线程页 |
| `/mobile/mobileMy/...` | 移动设置子页（清单见 5.7，两个来源） |
| `/mobile/mobileMy/editProfile`、`/mobile/mobileMy/myMessages`、`/mobile/mobileMy/editBio`、`/mobile/mobileMy/editBirthday` | 移动个人资料相关页面 |
| `/mobile/mobileMy/status`、`/mobile/mobileMy/settings`、`/mobile/mobileMy/scanQRCode`、`/mobile/mobileMy/share`、`/mobile/mobileMy/SimpleBio`、`/mobile/mobileMy/myAlbum` | 移动状态、设置、扫码、分享、简介与相册 |
| `/mobile/mobileFriends/addFriends`、`/mobile/mobileFriends/startGroupChat`、`/mobile/mobileFriends/groups` | 移动添加好友、发起群聊与好友分组 |
| `/mobile/mobileFriends/confirmAddFriend`、`/mobile/mobileFriends/confirmAddGroup`、`/mobile/mobileFriends/friendInfo/:uid` | 移动好友确认与详情 |
| `/mobile/confirmQRLogin`、`/mobile/mobileMy/myQRCode` | 二维码登录确认与我的二维码 |
| `/mobile/rtcCall`、`/mobile/encryption` | 移动通话与加密设置（仅桌面端设置页的对应 Tab 不受影响） |

> 已删除项：`/mobile/dynamic`、`/mobile/dynamic/:id`（动态模块整体移除）、`/mobile/syncData`（与 `/mobile/confirmQRLogin` 重复）、`/mobile/addGroupQRCode`（与 `/mobile/mobileMy/myQRCode` 重复）、`/mobile/mobileMy/aiAssistant`（v2.4 列出但路由不存在），AI 助手在移动端无独立入口。

### 10.5 权限守卫

认证守卫对非公共路由检查会话，桌面端未登录跳 `/login`，移动端未登录跳 `/mobile/login`。带 `requiresAdmin` 的路由必须通过管理员权限校验，失败时给出无权限提示并返回安全位置。

| 守卫 | 判定 | 失败表现 |
|---|---|---|
| 会话守卫 | 本地是否存在有效会话 | 跳对应登录页；不闪主界面 |
| 管理员守卫（`requiresAdmin`） | `canUseAdminApi()` + 当前用户是否为管理员 | 渲染 `/403`；左侧菜单不渲染管理入口 |
| 能力守卫（`PermissionGuard`） | `hasCapability(...)` | 按 7.8 三态渲染；加载中不判失败 |
| 锁屏守卫（`LockExclusion`） | 路由是否在白名单内 | 白名单外一律先解锁（见 5.12.2） |

补充：

- `requiresAdmin` 在 `/admin` 父级与每个子路由上**都**声明；新增管理页时必须同时加上 `meta: { requiresAdmin: true }`，否则会出现"父级拦住了但直接输入 URL 可绕过"的空档。
- `/403` 与 `/admin/*` 同属管理端产物，构建时一并裁剪，不进入移动端包。
- 管理页的"无权限"与"能力未启用"必须区分：前者跳 `/403`，后者在页面内显示"该功能未在服务端启用"。

## 11. 后续收敛项

> 2026-11-27 复核：已完成的 4 项已从本表移除；剩余项标注实测状态与依据。
> 判定标准是代码事实，不是计划。

### 11.1 仍未解决（按严重度）

| 优先级 | 收敛项 | 实测状态（2026-11-27） | 依据 / 影响 |
|---|---|---|---|
| 高 | **全局搜索页未落地** | `src/router/routes/desktop.ts:42` 仍为 `component: FriendsList` | 导航承诺"全局搜索"，实际打开是好友列表，功能与入口不符 |
| 高 | **能力三态落地** | 仅 3 个文件引用 `TjgCapability`/`useCapability` | 多数依赖能力的页面未区分"探测中/不可用"，存在探测期误判 |
| 高 | **双端设置页内容对齐** | 8 组同名设置页内容不一致（见 12.3） | 用户在两端找不到同一个设置项，属信息架构不一致 |
| 中 | **弹窗收敛** | `n-modal` 38 个文件 / `n-drawer` 35 个 / `BaseRightDrawer` 12 个 | 抽屉未成为主流，弹窗仍占多数；分批方案见 12.4 |
| 中 | **移动设置清单双源** | `mobile.ts` 与 `mobileMySettingsRoutes.ts` 并存 | 新增设置页需改两处，易漏 |
| 中 | **设置页搜索体验** | 搜索结果未显示命中路径 | 设置项多，用户需知道"在哪个 Tab 下" |
| 中 | **管理后台媒体子域** | Admin API 有 23 条媒体端点，页面覆盖不全 | 补齐前不得在导航承诺"媒体治理" |
| 中 | **by-design 清单复审** | 2.4.9 的 16 条不可用端点 | 后端裁定变化时需同步，否则 UI 空等 |
| 中 | **高风险操作统一** | 删除/封禁/退出等二次确认样式各写一套 | 确认弹窗文案与按钮层级不一致 |
| 中 | **能力基线与后端同步** | 依赖 `route_metrics.py --json` 复核 2.4 | 端点计数过期会导致能力注记悬空 |
| 低 | `openclaw` 能力位 | 全仓残留 1 处引用 | 后端不宣告该能力，属死分支 |

### 11.2 已完成的（2026-11-27 复核，从原表移除）

保留记录以便追溯，不再作为待办：

| 原收敛项 | 实测结论 |
|---|---|
| 清理旧命名 `hula` | ✅ `--hula-*` 全仓 **0 处** |
| 空状态覆盖率 | ✅ 列表页空态覆盖 **100%**，唯一的"暂无数据"字样是代码注释 |
| `/home` 空壳路由 | ✅ 已加默认重定向注释，根路径落消息列表 |
| 布局宽度令牌化 | ✅ `--tjg-layout-left-min` / `-center-wide` 等已存在 |

### 11.3 需要产品/后端先定，开发无法单方面关闭

| 项 | 卡点 |
|---|---|
| 移动端管理能力 | 需独立设计移动表格与详情栈，属产品决策 |
| `openclaw` 能力位 | 需确认是否保留部署开关 |
| 媒体治理页面 | 需先定 23 条端点的页面归属 |

---

## 12. 界面评审发现与优化方案（2026-11-27）

> 评审口径：代码级实测。每条含位置、问题、依据、严重度、改法。
> 依据标注来源；平台数值（pt/dp/对比度）请以官方当前版本为准。
> **未做真机截图与设计稿比对，视觉重心/留白/字重不在此列**——不编造结论。

### 12.1 严重度汇总

| 级别 | 数量 | 主题 |
|---|---:|---|
| P0 | 0 | 未发现"点不到/看不清/流程阻断"的确证问题 |
| P1 | 1 | 双端设置不对齐（搜索页已修复见 12.4；危险色已修复、窗口尺寸原本正确，见 12.2 / 12.13） |
| P2 | 2 | 弹窗未收敛、移动设置双源（硬编码色值经复核为 0，见 12.7） |
| P3 | 1 | `openclaw` 死分支 |

---

### 12.2 危险色作实心背景时白字不达 AA（P1）—— **已修复（2026-11-27）**

> 初版这条用了 `#e5484d`（3.91:1），那是笔误。项目实际值是亮色 `#ff4d4f`、暗色 `#ff7875`。以下为本轮实测。

**位置**：所有「危险色实心底 + 白字」的组件。

**问题**：`--tjg-color-danger-500/600` 是为「**暗底上的彩色文字**」调的色相——
暗色主题把红色**提亮**成 `#ff7875` 才看得清。但同一 token 又被当作**背景**用，
此时白字全部不达标，暗色下尤其严重。

**实测（本轮计算，非估算）**：

| 场景 | 底色 | 白字对比度 | 判定 |
|---|---|---:|---|
| 亮色 danger-500 | `#ff4d4f` | **3.27:1** | 仅大字 |
| 亮色 danger-600 | `#cf1322` | 5.57:1 | ✅ 达 AA |
| **暗色 danger-500** | `#ff7875` | **2.56:1** | ❌ 不达标 |
| **暗色 danger-600** | `#ff9c99` | **2.01:1** | ❌ 严重不足 |
| 参考：发送气泡 | `#0f7a66` | 5.26:1 | ✅ 达 AA |
| 参考：接收气泡（暗） | `#355b55` | 7.56:1 | ✅ 达 AA |

**影响面**（实际用到「红底白字」的 6 处）：

| 位置 | 用途 | 字号 |
|---|---|---|
| `render-message.scss:307` | **私密模式发送气泡正文** | 13px 正文 |
| `RoomCardItem.vue:97` | 房间未读徽章 | 11px |
| `MobileSessionList.vue:149` | 滑动删除按钮 | 14px |
| `mobile/views/friends/index.vue:76` | 好友页角标 | 12px |
| `views/Notify.vue:40` | 通知角标 | **10px** |
| `CallIncomingBanner.vue:41` | 挂断按钮（白色图标） | 图标 |

**依据**：WCAG 2.1 成功准则 1.4.3 —— 正文 4.5:1，大字（≥18.66px 或 ≥14px 粗体）3:1。
上述场景**全部是正文级小字**，因此需要 4.5:1。

**为什么不能简单调深 danger-500**：暗色主题下 `danger-500` 同时被用作**文字色**
（错误提示、危险文字），调深会让暗底上的红字读不清。**同一 token 不能同时满足
「暗底上作前景」与「承载白字作背景」两个相反需求。**

**方案：新增专用 token `--tjg-danger-solid-bg`**

```css
/* 亮色与暗色同值：#c62f34 */
--tjg-danger-solid-bg: #c62f34;
```

**选值依据**：

| 候选 | 白字 on 它 | vs 暗底 `#1a1a1a` | 结论 |
|---|---:|---:|---|
| `#cf1322` | 5.57 | 3.12 | 可，但偏亮 |
| **`#c62f34`** | **5.44** | **3.20** | **采用：两项均衡** |
| `#b81f24` | 6.44 | 2.70 | 白字更好，但暗底上偏糊 |
| `#a8071a` | 7.75 | 2.25 | 暗底上过暗 |

**亮暗同值的原因**：该 token 的唯一职责是**承载白字**（5.44:1 达 AA 正文），
与主题无关；且对亮底 `#fff`（5.44:1）与暗底 `#1a1a1a`（3.20:1）都有足够可分辨度。
不需要像 `danger-500` 那样随主题调亮。

**已实施**（`7591a5f98` 之后的提交）：

1. `design-tokens.css` 亮/暗两块各加 `--tjg-danger-solid-bg: #c62f34`
2. 上述 6 处「红底白字」全部改用新 token
3. 淡底场景（`danger-50/100` 作底 + 彩色文字）**保持不动** —— 这类对比度本就充足

**验证**：

```
design-baseline / layout-tokens / naiveTokenSource   28/28
RoomCardItem / MobileSessionList / token 相关        25/25
pnpm check:ratchet  ->  hardcoded_color: 0 (baseline 0)
```

**仍未处理、需真机确认的**：暗色下 `#c62f34` 在**玻璃/半透明背景**上的观感
（本 token 用于实心元素，一般不叠玻璃底，但私密气泡若在玻璃面板上需目视确认）。

### 12.3 双端设置页内容不一致（P1）

**位置**：8 组同名设置页（桌面 `src/views/settingsWindow/tabs/` ↔ 移动 `src/mobile/views/my/`）：

`SecuritySettings`、`EncryptionSettings`、`NotificationSettings`、`PreferencesSettings`、`VoiceVideoSettings`、`BurnAfterReadSettings`、`SecretChatPage`、`ThreadIndicator`。

**问题**：**同名的不是同一批设置项**。实测对比：

| 端 | `SecuritySettings` 的实际内容 |
|---|---|
| 移动 | 修改密码、交叉签名、设备管理、停用账号 |
| 桌面 | 加密密钥导出、备份设置、邀请权限 |

用户在桌面找不到"交叉签名"，在移动找不到"邀请权限"——**同一功能名，两端能看到的东西不同**。

**依据**：信息架构一致性。同一功能域在不同平台可以有**呈现差异**（抽屉 vs 页签），但**内容集合**应一致；缺项要么是能力门控，要么是遗漏，两者都需显式登记。

**严重度**：P1（跨端用户会认为"功能缺失"）

**改法**：

1. **先出对照表**：把 8 组设置项的 key 列表导出，逐项标注"两端都有 / 仅桌面 / 仅移动"。
2. **仅单端项分类**：
   - 平台限制导致的（如桌面才有密钥导出）→ **在文档注册为 by-design 差异**，另一端可显示"请在桌面端操作"。
   - 遗漏 → **补齐**。
3. **不要求代码合并**：两端 UI 框架不同（Vant / Naive UI），强行共用组件成本高于收益。**共享的是"设置项清单"这一个数据结构**，不是视图。

**验收**：对照表逐行有归属，无"未分类"项。

---

### 12.4 全局搜索页中间栏错位（P1）—— **已修复（2026-11-27，`1cf9ac116`）**

**位置**：`src/router/routes/desktop.ts:42`

**原判断**：「搜索页渲染好友列表，属功能错位」。**这个描述不够准确**——搜索功能本身是完整的。

**真相**：全局搜索在**右侧栏**，不在独立页面。

| 环节 | 实现 |
|---|---|
| 快捷键 `Ctrl+Shift+F` | `useSearchShortcut.ts:25` → `router.push('/search')` |
| 右栏切换 | `useRightView.ts:57` → `if (path === '/search') return 'search'` |
| 搜索本体 | `components/search/SearchPane.vue`（好友/房间/消息/空间，含空态/错误态/结果计数） |

`/search` 只是一个**触发器**：它让右栏切到 SearchPane。**但它的 `component` 是 `FriendsList`**，
于是按快捷键后中间栏渲染完整好友列表、右栏才是搜索框 —— 用户看到
「左边好友列表 + 右边搜索框」，会以为搜到了好友页。

`desktop.ts` 原注释写「复用 FriendsList 的搜索态」，但 `FriendsList.vue` 里
既没有 `search` 也没有 `route` 引用 —— **注释描述的是不存在的逻辑**，属历史残留。

**已实施**：

1. 新增 `src/views/search/SearchLanding.vue`：中间栏给一句引导，
   复用现成文案 `search.title` + `search.empty_hint`（**零新增 i18n**）
2. 路由改为懒加载该组件
3. `FriendsList` 保留（仍被 `/friend` 系列 4 个路由使用）

**没选的方案**：

| 方案 | 为什么没选 |
|---|---|
| 导航改名「好友」 | 不准确——搜索是有的，只是位置在右栏 |
| 让 `/search` 不跳路由、直接切右栏 | 要改 `useRightView` 的判定逻辑，风险大于收益 |
| 把 SearchPane 搬进中间栏当独立页 | 右栏搜索的交互（中间栏列表 + 右栏结果）是既有设计，改动面大 |

**验收**：`Ctrl+Shift+F` 后中间栏显示「全局搜索 / 输入关键词开始搜索」，右栏出现搜索框。

### 12.5 弹窗与抽屉比例未收敛（P2）

**位置**：全仓

**实测**：

| 容器 | 文件数 |
|---|---:|
| `n-modal` | 38 |
| `n-drawer` | 35 |
| `BaseRightDrawer`（自研抽屉壳） | 12 |

**问题**：§11 要求"优先改抽屉，仅保留必须中断操作的弹窗"，但抽屉未成为主流。**更根本的问题是缺少判断标准**——哪些该改，没有依据，所以一直没动。

**依据**：抽屉不遮挡上下文，适合"查看/编辑某对象"；弹窗中断操作，适合"必须立即决策"（删除确认、协议同意）。

**改法**：给出可执行的判据，而不是"全面审查"。

| 场景 | 应选 | 判据 |
|---|---|---|
| 查看/编辑某个对象的详情 | **抽屉** | 用户需要参考背后的列表 |
| 表单录入（多字段） | **抽屉** | 弹窗内滚动体验差 |
| 删除/封禁确认 | 弹窗 | 必须中断，防止误判上下文 |
| 协议/隐私同意 | 弹窗 | 法律要求显式确认 |
| 一次性选择（选颜色、选表情） | 弹窗或 Popover | 无需参考上下文 |

**执行顺序**：
1. 先按上表给 38 个 `n-modal` 打标（预计 60% 应改抽屉）
2. 只改"表单录入"和"对象详情"两类——这两类收益最明确
3. 确认类弹窗**保持不动**

**不要一次全改**：38 个文件同时动，回归成本高于收益。

---

### 12.6 移动设置清单双源（P2）

**位置**：`src/router/routes/mobile.ts` 与 `src/router/routes/mobileMySettingsRoutes.ts`

**问题**：移动设置子页分散在两个文件，新增一项要改两处，且段名风格不一致（camelCase vs kebab-case）。

**依据**：单一数据源原则。双源结构下，遗漏是时间问题而非概率问题。

**改法**：合并为一个 `mobileSettingsRoutes.ts`，导出数组供两处引用。段名统一为 kebab-case（与桌面一致）。

**风险**：路由路径变化会影响深链与已保存的书签。**合并时保持 path 不变，只合并定义位置**。

---

### ~~12.7 组件内硬编码色值~~ —— **复核后为 0 处（原判 12 处是误报）**

**这条必须记录成反面教材。**

初版用 `grep '#[0-9a-fA-F]{6}'` 数出 12 处，我据此写了"是新增漏网"。**逐条核对后全部不成立**：

| 实际情况 | 数量 | 说明 |
|---|---:|---|
| CSS 注释里的说明文字 | 8 | 如 `--tjg-status-online → green (#52c41a)`，是文档不是样式 |
| `var(--tjg-x, #fallback)` 的兜底值 | 3 | `FederationView.vue:180,184`、`ManualLoginForm.vue:365` —— **正当写法**，token 未定义时才生效 |
| 行内注释 | 1 | `RoomCardItem.vue:352` |
| **真实硬编码样式值** | **0** | — |

项目还有 `HARDCODED_COLOR_ALLOWLIST`（`check-ratchet.mjs:211`），
对 `naiveTokenSource.ts` / `Logger.ts` / `Console.ts` 三处**已裁定例外**——
Naive UI 在 JS 侧做 rgba 运算读不到 CSS 变量，console `%c` 也不解析变量。
这是有意的架构决定，不是债务。

**结论**：配色纪律这一项**无需修改**。`--tjg-*` token 体系执行到位。

**教训（第三次同类错误）**：本文档的评审中，用单一 `grep` 计数得出的"缺陷数"已经错了三次：

| 项 | grep 结果 | 真实值 | 错因 |
|---|---:|---:|---|
| `outline: none` | 31 | 2 | 没排除装饰性 svg 与已有 `focus-visible` 替代 |
| 纯图标按钮缺 `aria-label` | 10 | 0 | `{{ t(...) }}` 被当成无文字 |
| 硬编码色值 | 12 | 0 | 没排除注释与 `var()` fallback |

**判据必须双条件**：命中外还要确认「是否真的构成问题」，否则数字会系统性虚高。

---

### 12.8 `openclaw` 死分支（P3）

**位置**：全仓残留 1 处引用。

**问题**：前端有 `canUseOpenClaw()`，后端不宣告该能力，判定恒为 false。

**依据**：死分支增加阅读成本，且容易被误认为"功能待上线"。

**改法**：若确无部署计划则删除；若需保留开关，改为本地配置项并在文档登记。

---

### 12.9 冗余核查结论（用户重点关注）

对"冗余"做了一轮实测，结论如下：

| 对象 | 判定 | 依据 |
|---|---|---|
| 8 组同名设置页 | **非冗余**，是**内容不一致** | 见 12.3，两端框架不同，需要的是清单对齐而非合并文件 |
| 桌面/移动同名组件（如 `ThreadIndicator`） | **非冗余** | 平台差异（Naive UI vs Vant），符合架构分层 |
| `--hula-*` 旧 token | **已清零** | 全仓 0 处 |
| 孤儿组件 | **0 个** | 无零引用组件 |
| 硬编码色值 | **0 处真实** | 12 处 grep 命中全为注释与 token fallback（见 12.7） |

**结论**：当前项目**不存在需要"合并删除"的大块冗余**。真正的问题是**同一功能的两套实现内容不对齐**，处置方向是"对齐清单"，不是"删掉一份"。

> 这一条与常见预期相反。冗余清理如果没有实测支撑，很容易把"平台差异"当成"重复代码"删错。

---

### 12.9.1 其余扫描项的核查结论（避免下次重复排查）

本轮对「美化」相关的几项也做了 grep，**均不构成问题**，记录以便后续跳过：

| 扫描项 | grep 结果 | 核查结论 |
|---|---|---|
| 圆角魔法数字 | 8px×121 / 6px×56 / 4px×40 / 12px×26 / 10px×21 / 999px×15 | **非问题**。token 档位为 4/8/10/12/16/20/24，上述值全部落在档位内；6px、3px、2px 属半步距，Naive UI 与 Vant 的默认体系本身就用半步 |
| 间距非 4px 倍数 | 2px×102 / 6px×124 / 10px×94 | **非问题**。同上，半步距是这两个组件库的既有体系，强行改成 4 倍数反而与库默认不一致 |
| 布局宽度直写 | 11 处 `64/240/300px` | **仅 3 处是真布局栏宽**（`SpaceListPane:300`、`AdminSidebar:240/64`）；其余是插画尺寸（`EmptyState`/`ErrorState` 的 64px）与下拉菜单宽度，不该套 `--tjg-layout-*` |
| 语义色对比度 | warning-500 白字 1.90:1、success-500 白字 2.27:1 | **未实际使用**。全仓无「warning/success 实心背景 + 白字」的用法，5 处作背景的地方都配深字或彩字。仅危险色被误用（已修，见 12.2） |
| 响应式前缀 | 全仓仅 1 处 | **非问题**。项目不用 UnoCSS 前缀，走 `useResponsiveBreakpoint` + SCSS mixin，且有 minWidth=1024 兜底，见 12.13 |

**方法论**：这五项里只有最后一项成立。前四项都是「命令有输出、但不构成缺陷」。
**判据必须叠加实际用法**——例如「warning-500 白字 1.90:1」这个数字本身没错，
但项目从没把 warning 当白字背景用，所以它不是问题。

---

### 12.10 分批实施建议

| 批次 | 内容 | 改动量 | 风险 |
|---|---|---|---|
| ~~批 1~~ | ~~12.2 危险色对比度~~ **已完成**（新增 `--tjg-danger-solid-bg`，改 6 处） | 8 文件 | 低 |
| ~~批 2b~~ | ~~12.13 窗口最小尺寸~~ **无需改动**（已存在 minW=1024） | 0 | — |
| ~~批 2~~ | ~~12.4 搜索页中间栏错位~~ **已完成**（新增 SearchLanding 引导页） | 2 文件 | 低 |
| **批 3** | 12.3 双端设置对照表（**只出表，不改代码**） | 0 | 无 |
| **批 4** | 12.5 弹窗打标 + 只改两类 | 预计 15–20 个文件 | 中 |
| **批 5** | 12.6 移动设置合并 | 3 个文件 | 中（路由深链） |
| 待定 | 12.8 openclaw | 1 处 | 需产品确认 |

**批 1–4 可并行**：互不依赖，且都是低风险。批 5、6 建议单独排期。

---

### 12.11 验收清单

```bash
# 对比度（改色后必跑）
node -e "…见 12.2 计算脚本…"

# 令牌纪律
pnpm check:ratchet

# 类型与单测
pnpm vue-tsc --noEmit
node scripts/run-vitest.js run --no-file-parallelism src/mobile src/components/common
```

手动验收：
- [ ] 危险确认按钮在**暗色模式**下也清晰（不只测亮色）
- [ ] 断网/加载/空态在改过的设置页仍正常
- [ ] 搜索入口改名后，导航高亮与面包屑同步

---

### ~~12.13 布局：桌面窗口无最小尺寸限制~~ —— **误判，实际已正确实现**

**这条是本轮最严重的一次误判，必须完整记录。**

**我最初的结论**：桌面端无最小窗口尺寸、几乎无响应式，三栏布局在窗口缩小时会崩，建议加 `minWidth`。

**实际核查后**：

```ts
// src/services/matrix/auth/DesktopSessionTransition.ts:60
// Step 2.3：窗口最小宽度 1024px，配合响应式断点（wide≥1440 / normal 1024-1439 / shrink<1024）
await createWebviewWindow('Tjg', 'home', 1280, 800, 'login', true, 1024, 600, undefined, false)
```

参数签名（`useWindow.ts:27`）：

```ts
createWebviewWindow(title, label, width, height, wantCloseWindow, resizable, minW, minH, ...)
//                                                                  ↑1024    ↑600
```

**主窗口 `minW = 1024`、`minH = 600`**，且 `useWindow.ts:68` 还有一层保护：

```ts
// minWidth/minHeight 严格取调用方配置值，不得被创建尺寸放大；
// 但也不能大于创建尺寸，否则 Tauri 会在窗口创建后立即把窗口压缩到 min 值。
const effectiveMinWidth = Math.min(minW, clampedSize.width)
```

**响应式也不是"没有"，而是走另一套实现**：

| 机制 | 位置 | 用量 |
|---|---|---|
| `useResponsiveBreakpoint` composable（shrink/normal/wide 三态） | `src/composables/layout/` | 4 个文件 |
| SCSS `up()` / `down()` mixin | `src/styles/scss/global/responsive.scss` | 2 处 |
| UnoCSS 响应式前缀 | `uno.config.ts` | 1 处（项目主要不用这套） |

且 `design-baseline.test.ts` 守护 SCSS 断点与 composable 常量的一致性——**这是有意设计，不是遗漏**。

**为什么我会判错**：

我只查了三处——`tauri.conf.json` 的 `app.windows`（空）、Rust 侧 `min_inner_size`（无）、全局 CSS `min-width`（无）。
**漏查了前端动态创建窗口这条路径**（Tauri 的窗口完全可以由 JS 通过 `new WebviewWindow` 创建，此时最小尺寸写在调用参数里）。

`tauri.conf.json` 的 `app.windows` 为空本身就是线索——窗口不可能凭空出现，必然在别处创建。我看到了空数组却没继续追。

**如果按原建议执行会怎样**：

在 `app.windows` 加一条会让 Tauri **额外创建一个窗口**（与 JS 动态创建的 `home` 并存）；
改 `useWindow.ts` 的默认值 `minW = 330` 则会影响所有辅助窗口
（`update` / `notify` / rtc 通话窗），它们本就该允许小尺寸。

**结论**：布局这一项**无需改动**。主窗口 1024 最小宽度足以支撑 `604px 固定栏 + 420px 内容区`。

**教训（第四次同类错误，也是最严重的一次）**：

前三次是「grep 计数虚高」，这次是**「只查了几个地方就下结论」**。共同点都是**证据不完整就断言**。
新增纪律：判断「某能力不存在」之前，必须确认**所有可能的实现路径**都已排除——
Tauri 窗口至少有三种来源（conf / Rust builder / JS 动态创建），只查两种不能下结论。

---

### 12.12 待补素材（影响结论强度）

本轮为代码级评审，以下维度**无法判定**，需真机截图后再补：

1. 实际对比度（除已算的 4 组 token）
2. 视觉重心对齐、留白节奏、字重层级
3. 骨架屏与实体内容形状是否匹配
4. 深色模式下图表/插画的可读性
5. 小屏（≤375pt）下的布局挤压情况

**设备建议**：小屏 + 刘海机型各一，iOS/Android 分别提供。

---

