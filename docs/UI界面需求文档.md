# Tjg（天机阁）UI 界面需求文档

> 版本：2.5  
> 日期：2026-11-01  
> 项目：Tjg（天机阁）前端应用  
> 技术栈：Vue 3、Tauri 2、TypeScript、Vite、Pinia、UnoCSS  
> 文档状态：按实际截图与原型校准布局，并按后端真实路由与 SDK 能力面校准功能前提；v2.5 起所有端点计数以 `route_metrics.py` 实测为准，人工汇总值仅作定性参考  
> 代码基线：`Tjg/src`、`Tjg/locales`、`Tjg/src-tauri`  
> 能力基线：`synapse-rust/docs/synapse-rust/ROUTE_CONTRACT.md`（2026-10-31 生成，980 注册条目）、`synapse-rust/docs/synapse-rust/ROUTE_HANDLERS.json` + `synapse-rust/scripts/contract/route_metrics.py`（三口径唯一实现）、`synapse-rust/synapse-services/src/capability_governance.rs`（`/capabilities` 构造面）、`synapse-rust/docs/synapse-rust/MSC_SEMANTICS.md`（MSC 语义唯一真相源）、`matrix-js-sdk/src/server-capabilities/index.ts`、`Tjg/src/services/matrix/MatrixCapabilityService.ts`  
> 关联文档：`Tjg/docs/TJG-prototype.html`、`docs/adr/ADR-003-tjg-greenfield-rewrite.md`、`docs/glossary/tjg-glossary.md`、`docs/UI优化方案-v2.4.md`、`Tjg/docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md`

## 更新说明

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
| `/general`、`/loginSetting`、`/manageStore` | 重定向到 `/settings?tab=preferences` |
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
| `/chat-history`、`/multiMsg`、`/alone` | 聊天辅助窗口 |
| `/secretChat` | 私密会话列表（解锁后进入） |
| `/rtcCall`、`/sharedScreen` | 通话与屏幕共享 |
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

| 优先级 | 收敛项 | 说明 |
|---|---|---|
| 高 | 清理旧命名 | 文档、样式和注释中仍可继续清理 `hula` 历史称呼，新代码默认使用 `tjg` |
| 高 | 路由与页面文档同步 | 已按 `Tjg/src/router/routes/*.ts` 校正第 10 章（含 `/home` 子路由实际为绝对路径、删除不存在的 `/openclaw`）；后续新增或删除页面时继续同步 |
| 高 | 全局搜索页未落地 | `/search` 当前仍渲染 `FriendsList`（代码注释称"阶段 9 替换为独立 SearchView"）。在独立视图落地前，不得在导航中承诺"全局搜索"能力 |
| 高 | 能力三态落地 | 所有依赖 `TjgCapability` 的页面按 7.8 实现"加载中 / 可用 / 不可用"三态，消除"探测中显示不可用"与"无限 spinner"两类现状 |
| 高 | 设置页搜索体验 | 设置项较多，搜索结果需显示命中路径和跳转后定位 |
| 高 | 弹窗收敛 | 全面审查现有弹窗，优先改为右侧抽屉；仅保留必须中断操作的弹窗（确认删除、协议同意等） |
| 中 | 管理后台媒体子域 | Admin API 有 23 条媒体端点但无对应页面；补齐前不得在导航中承诺"媒体治理" |
| 中 | 移动设置清单双源 | 移动设置子页分散在 `settingsRoutes.ts` 与 `mobile.ts` 两处，且段名 camelCase 与桌面 kebab-case 不一致；需收敛为单一清单 + 统一段名规则 |
| 中 | `openclaw` 能力位 | 前端存在 `canUseOpenClaw()`，但后端不宣告该能力；如需部署开关，应改为本地配置并登记，避免"能力位永假"的死分支 |
| 中 | by-design 清单复审 | 2.4.9 的 16 条不可用端点在后端裁定变化时同步更新；同时检查 UI 是否仍残留对应入口 |
| 中 | 移动端管理能力 | 若要开放管理后台移动端入口，需要独立设计移动表格和详情栈 |
| 中 | 空状态覆盖率 | 所有列表页使用 `EmptyState` 变体替代纯文本"暂无数据" |
| 中 | 高风险操作统一 | 删除、封禁、退出登录、清空数据、注销账号等操作统一二次确认样式 |
| 中 | 能力基线与后端同步 | `ROUTE_CONTRACT.md` / `ROUTE_HANDLERS.json` 更新后，用 `python3 scripts/contract/route_metrics.py --json` 复核本文档 2.4 的端点计数、profile 门控与页面能力注记，避免 UI 需求悬空 |
| 中 | 不可依赖项复审 | 2.4.6 中的 MISSING / PARTIAL 项在后端补齐并接线后，及时从"不可依赖"移入正常能力，并解除对应 UI 降级 |
| 中 | 在线状态一致性 | 好友列表、群成员、房间成员统一走 7.6 的 presence 判定，禁止任何页面使用接口内嵌字段或本地缓存推断在线 |
| 低 | `/home` 空壳路由 | `/home` 本身无默认子路由，直接访问会渲染空主壳；应补默认重定向到 `/message` 或显式 404 |
| 低 | 设计令牌别名收敛 | 保留兼容别名，但新组件不再引入 `--hula-*` |
| 低 | 布局宽度令牌化 | 主壳 `64px / 300px / 240px` 目前散落在组件内，建议抽为 `--tjg-layout-*` 令牌，与 `--tjg-settings-sidebar-width` 一致 |
