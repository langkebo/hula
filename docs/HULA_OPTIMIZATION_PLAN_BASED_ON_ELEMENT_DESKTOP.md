# HuLa 项目全面优化方案

> 基于 `element-desktop` 的成熟实践，并结合当前 HuLa 仓库真实结构、配置与已有能力重新整理
>
> 修订日期：2026-04-30

---

## 0. 修订说明与执行原则

### 0.1 本次修订的核心变化

相较于原始版本，本次文档重点做了三类修正：

1. **把“推测”改成“基于代码现状的判断”**
   - 已核对 `vite.config.ts`、`build/config/chunks.ts`、`vitest.config.ts`、`playwright.config.ts`
   - 已核对 `src-tauri/Cargo.toml`、`src-tauri/src/lib.rs`、`src-tauri/tauri.conf.json`
   - 已核对 `.github/workflows/`、`commitlint.config.cjs`、`biome.json`

2. **把“从零建设”改成“增量治理”**
   - HuLa 并非缺少 CI、测试、性能监控、安全配置，而是**已有基础但存在过宽权限、重复配置、缺少分层和统一入口**
   - 因此路线应优先做“校准、收口、复用、量化”，而不是一次性重造体系

3. **把“长期愿景”拆成“近期可落地动作”**
   - 优先级以“高收益、低回归风险、可在 1-2 周内落地”为先
   - 架构级重构保持渐进式推进，避免与功能迭代冲突

### 0.2 执行原则

1. **先测量，后优化**：已经具备 `rollup-plugin-visualizer`、`metrics:bundle`、`WebVitalsObserver`、`PerformanceReporter`、`RoomPerformance`，应先跑基线，再定目标。
2. **先收口权限，再补能力**：Tauri `capabilities`、CSP、`assetProtocol.scope` 当前偏宽，安全加固应优先于新增系统能力。
3. **先统一入口，再做局部重构**：如外链打开、性能埋点、i18n、配置拆分，先做统一封装，再逐模块迁移。
4. **先减少重复，再扩大覆盖**：Vitest/Vite/CI 配置已有重复，先抽基础配置，再补 E2E 与类型检查。
5. **先兼容，后清理**：房间服务层、store、构建脚本重构均应保留兼容导出与过渡层。

---

## 第一部分：项目对比分析

### 1.1 核心异同点

| 维度 | element-desktop | HuLa 当前现状 | 对比分析 |
|------|----------------|--------------|---------|
| **桌面容器** | Electron | Tauri 2.x | Tauri 更轻量，但需用 Capabilities/CSP 主动补足安全边界 |
| **前端框架** | 主进程壳 + element-web | Vue 3 + Composition API + Pinia | HuLa 是完整前端应用，UI 与状态复杂度明显更高 |
| **构建工具** | tsc + electron-builder | Vite 7 + Tauri CLI | 工具链现代，但当前单一 `vite.config.ts` 承担桌面/移动双端逻辑，维护成本高 |
| **状态管理** | electron-store 为主 | Pinia + persistedstate | 已形成分域 store，但存在命名、职责边界、持久化范围可继续收口 |
| **安全模型** | Fuses + Sandbox + IPC 白名单 | Tauri CSP + Capabilities | HuLa 已接入能力模型，但权限范围偏大，离“最小权限”还有距离 |
| **测试体系** | Playwright Electron fixture | Vitest + Playwright + Storybook 测试 | 单测基础已不弱，E2E 仍以浏览器模拟为主，桌面容器级覆盖不足 |
| **CI/CD** | 分层可复用工作流 | 已有多工作流，但未分层复用 | HuLa 已有 `style-check`、`security-performance`、`sdk-check`、`release` 等工作流，但缺少 prepare/build/test 复用层 |
| **i18n** | 类型安全翻译键 | `vue-i18n` + 按语言分片动态加载 | 已不是“手动单 JSON”，但还没有编译期 key 校验 |
| **跨平台** | 仅桌面端 | 桌面端 + iOS + Android | HuLa 的平台跨度更大，因此更需要“按平台分层”的配置和测试策略 |

### 1.2 可直接借鉴的最佳实践

从 `element-desktop` 中提炼出的、且适合 HuLa 当前阶段的实践：

1. **最小权限边界**：把“所有窗口默认全权限”改为“按窗口/功能分组授权”
2. **构建变体分层**：桌面端与移动端共享基础配置，但分别维护平台差异
3. **可复用 CI 工作流**：把重复的 Node/Rust/缓存准备抽成复用工作流
4. **类型安全 i18n**：从默认语言文件推导 key 类型，补全和拼写错误在编译期暴露
5. **声明式模块注册**：服务、设置、能力、测试夹具都用清晰的注册入口组织
6. **安全默认值**：统一外链打开、协议校验、路径范围、CSP 例外名单
7. **分层质量门禁**：lint、typecheck、unit、e2e、bundle-metrics、security audit 分层执行

### 1.3 基于仓库现状的校准结论

以下结论应作为后续优化的前置共识：

| 主题 | 当前真实情况 | 优化含义 |
|------|-------------|---------|
| **CI** | 已有 8+ 个工作流，不是“只有基础 Actions” | 重点是减少重复、提高复用度、补最小权限和 SHA 锁定一致性 |
| **性能监控** | 已有 `PerformanceReporter`、`WebVitalsObserver`、`RoomPerformance` | 重点是补采集闭环和 CI 阈值，而不是重新造监控工具 |
| **Vitest** | 已有 `vitest.config.ts`、`vitest.unit.config.ts`，并含 Storybook/browser 配置 | 重点是抽基础配置、缩减重复和稳定运行环境 |
| **E2E** | 已有 5 个 `e2e/*.spec.ts`，含桌面/移动项目划分 | 重点是补 Tauri fixture、隔离环境、增加生产构建模式 |
| **Tauri 安全** | 已有 `capabilities/`，但 `windows: ["*"]`、`assetProtocol.scope: ["**"]`、CSP 含 `'unsafe-inline'`/`'unsafe-eval'` | 重点是从“已启用能力模型”走向“能力最小化” |
| **Rust 初始化** | `common_setup()` 里仍有 `tauri::async_runtime::block_on(...)` | 启动性能优化应优先落在 setup 链路 |
| **依赖与构建** | `postcss-pxtorem` 全平台生效、`chunkSizeWarningLimit = 1200`、仍保留空壳 alias | 说明 bundle 优化仍有明确抓手 |
| **i18n** | 语言包已按 `locales/<lang>/<part>.json` 动态聚合 | 重点从“结构化”升级为“类型安全 + 完整性校验” |

---

## 第二部分：性能优化方案

### 2.1 Bundle 体积优化

**目标**：
- 首屏关键 JS gzip 后 `< 500KB`
- 总产物体积 `< 3MB`
- 不再出现单个核心 chunk `> 500KB` 的默认告警盲区

**当前已确认的问题**：
- `chunkSizeWarningLimit` 当前为 `1200`
- `postcss-pxtorem` 在桌面端和移动端同时生效
- `matrix-js-sdk` 通过 `link:../matrix-js-sdk` 引入，tree-shaking 效果受限
- `mermaid`、`three`、`@vue-office/*` 均在当前构建策略中占据较大体积
- `naive-ui` 与 `vant` 同仓共存，单配置构建容易把双端成本叠加
- `stream-monaco` / `monaco-editor` 通过空壳 alias 回避，而不是从依赖链源头清理

**实施步骤**：

| 步骤 | 具体措施 | 责任人 | 时间节点 | 评估指标 |
|------|---------|--------|---------|---------|
| 2.1.1 | 拆分 `vite.config.base.ts`、`vite.config.desktop.ts`、`vite.config.mobile.ts`，保留共享插件与 alias | 前端架构 | 第1-2周 | 配置复杂度下降，双端构建职责清晰 |
| 2.1.2 | `postcss-pxtorem` 仅在移动端启用 | 前端开发 | 第1周 | 桌面端 CSS 不再无差别 rem 化 |
| 2.1.3 | 将 `chunkSizeWarningLimit` 从 `1200` 下调至 `500` | 前端开发 | 第1周 | 大 chunk 更早暴露 |
| 2.1.4 | 为 `mermaid`、`three`、`@vue-office/*` 增加动态导入边界 | 前端开发 | 第2-3周 | 首屏不再加载重型可选能力 |
| 2.1.5 | 把 `metrics:bundle` 与 `dist/stats.html` 纳入标准构建产物与 CI 附件 | DevOps | 第1周 | 每次构建都有体积快照 |
| 2.1.6 | 清理空壳 alias 的来源依赖，明确“保留兼容”还是“彻底移除” | 前端开发 | 第2周 | 减少隐式技术债 |
| 2.1.7 | 评估 `matrix-js-sdk` 在打包层的可裁剪边界，优先从导入路径与 worker 边界优化 | 架构师 | 第3-5周 | SDK 相关 chunk 进一步收缩 |

**补充建议**：
- 保留 `build/config/chunks.ts` 的思路，但把当前分包规则进一步“数据化 + 去重化”
- 不建议立即引入更多“微 chunk”，应先做“重量级依赖延迟加载 + 双端配置拆分”

### 2.2 运行时性能优化

**目标**：
- 主线程 longtask `< 50ms`
- Room 列表滚动 FPS `> 55`
- 房间列表初次渲染 `< 200ms`
- 冷启动进入可交互状态 `< 3s`

**当前基础**：
- 已接入 `WebVitalsObserver`
- 已有 `PerformanceReporter` 阈值告警逻辑
- 已有 `RoomPerformance` 工具用于房间列表性能采样
- Matrix SDK 已经通过 Worker 承载重计算路径的一部分

**实施步骤**：

| 步骤 | 具体措施 | 责任人 | 时间节点 | 评估指标 |
|------|---------|--------|---------|---------|
| 2.2.1 | 把 Rust `common_setup()` 中的 `block_on(initialize_app_data(...))` 改为真正异步初始化或延迟就绪信号 | Rust 开发 | 第1-2周 | 启动阻塞明显下降 |
| 2.2.2 | 补齐启动阶段基线日志：应用启动、数据库连接、迁移、首屏 ready | Rust 开发 | 第1周 | 启动瓶颈可量化 |
| 2.2.3 | 将加密、图片处理、预览解析等重计算继续向 Worker 边界迁移 | 前端开发 | 第3-4周 | 主线程峰值阻塞下降 |
| 2.2.4 | 为 `imageDownloader` 增加 LRU + 磁盘缓存命中统计 | 前端开发 | 第2-3周 | 重复图片网络请求显著降低 |
| 2.2.5 | 将 `AppData.config: Arc<Mutex<Settings>>` 改为更适合读多写少场景的结构，如 `arc-swap` | Rust 开发 | 第2周 | 配置读取锁竞争下降 |
| 2.2.6 | 清理生产构建中的 `debug-print` feature 与不必要日志噪音 | Rust 开发 | 第1周 | 生产日志和性能干扰减小 |

### 2.3 依赖瘦身

**目标**：移除 5 个以上冗余/低收益依赖，降低维护和打包成本。

| 依赖 | 当前情况 | 处置方案 | 时间 |
|------|---------|---------|------|
| `dayjs` + `date-fns` | 双日期库并存 | 统一为一个主日期库 | 第2周 |
| `vue-demi` | 项目已是 Vue 3 | 确认是否仍被上游包强依赖，否则移除 | 第1周 |
| `lodash-es` + `es-toolkit` | 功能重叠 | 统一工具库策略 | 第3周 |
| `crypto-js` + `digest-wasm` | 能力重叠 | 明确运行时和兼容性边界，保留一个主方案 | 第3周 |
| `jsdom` + `happy-dom` | 测试环境双栈共存 | 优先统一单测环境，浏览器测试单独保留 | 第1周 |
| `pinia-shared-state` | 已安装但当前 `enable: false` | 若无近期启用计划则移除 | 第1周 |
| `internal-ip` | `getLocalIP()` 已使用 `os.networkInterfaces()` 覆盖主体逻辑 | 重构后移除额外兜底依赖 | 第1周 |

---

## 第三部分：代码质量提升方案

### 3.1 Biome 规则强化

**当前现状**：
- `useImportType` 为 `off`
- `organizeImports` 为 `off`
- `noUnusedImports` / `noUnusedVariables` 为 `warn`
- Vue 文件对未使用导入、变量做了较宽松处理
- 已存在 `noRestrictedImports` 约束，禁止组件/store 直接依赖 `matrix-js-sdk`

**实施步骤**：

| 步骤 | 具体措施 | 责任人 | 时间节点 | 评估指标 |
|------|---------|--------|---------|---------|
| 3.1.1 | 开启 `useImportType` 并批量修复 | 前端开发 | 第1-2周 | 类型导入零运行时开销 |
| 3.1.2 | 开启 `organizeImports` | 前端开发 | 第1周 | 导入顺序统一 |
| 3.1.3 | 在非 Vue 文件先把 `noUnusedImports` 从 `warn` 提升为 `error` | 前端开发 | 第2周 | 无死导入 |
| 3.1.4 | 分阶段开启 `useOptionalChain` | 前端开发 | 第2周 | 防御性代码更简洁 |
| 3.1.5 | 对 UI 组件逐步启用 `useAltText`、`noSvgWithoutTitle` | 前端开发 | 第3-4周 | 基础 a11y 合规 |
| 3.1.6 | 后续再评估抽项目级 Biome 共享配置包 | 架构师 | 第5-6周 | 多项目规则复用 |

### 3.2 Commitlint 与提交流程修复

**当前现状**：
- `maxHeaderLength = Infinity`
- `maxSubjectLength = Infinity`
- `minSubjectLength = 0`
- scope 自动生成逻辑仅按 `src/` 顶层目录单数化，准确度有限
- Commitizen 开启 emoji 展示，但规则层并未对正文质量形成有效约束

**实施步骤**：

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 3.2.1 | 将 `maxHeaderLength` 设为 `100` | 前端开发 | 第1周 |
| 3.2.2 | 将 `maxSubjectLength` 设为 `72` | 前端开发 | 第1周 |
| 3.2.3 | 将 `minSubjectLength` 设为 `2` | 前端开发 | 第1周 |
| 3.2.4 | scope 来源改为显式白名单或按目录映射表维护 | 前端开发 | 第2周 |
| 3.2.5 | 在 CI 增加 commitlint 检查，而不仅依赖本地提交工具 | DevOps | 第2周 |

### 3.3 死代码与无效依赖检测

**建议路径**：`depcheck/现有脚本 -> Knip -> CI 门禁`

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 3.3.1 | 先用现有脚本与 `depcheck` 做首轮盘点 | 前端开发 | 第1周 |
| 3.3.2 | 引入 Knip 配置，覆盖 `src/`、`scripts/`、`e2e/` | 前端开发 | 第1-2周 |
| 3.3.3 | 清理未使用导出、未引用依赖、历史兼容别名 | 全体前端 | 第2-4周 |
| 3.3.4 | 将 Knip 纳入 CI 的非阻塞阶段，稳定后再升级为阻塞 | DevOps | 第4周 |

### 3.4 多层类型检查

**当前现状**：
- CI 中已有 `vue-tsc --noEmit`
- 但 `scripts/`、`e2e/`、`src-tauri` 与前端主体未形成更细粒度的类型检查分层

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 3.4.1 | 为 `scripts/` 增加独立 `tsconfig.scripts.json` | 前端开发 | 第1周 |
| 3.4.2 | 为 `e2e/` 评估独立 tsconfig 或纳入 Playwright 类型检查 | 前端开发 | 第1周 |
| 3.4.3 | 将 `lint:types` 拆分为前端主体、脚本、E2E 三层 | 前端开发 | 第2周 |
| 3.4.4 | CI 中按层执行并缓存结果 | DevOps | 第2周 |

---

## 第四部分：用户体验改进方案

### 4.1 交互设计优化

**当前已有能力**：
- 已有系统托盘创建逻辑 `tray::create_tray`
- 已有 macOS traffic light 相关命令
- 已有 `useDriver` 新手引导能力

**当前主要缺口**：
- 缺少稳定的窗口位置/大小持久化
- 新手引导缺少“跳过/稍后再看/重新播放”的完整状态机
- 外链与帮助入口仍存在多处 `window.open()` 分散调用

| 步骤 | 具体措施 | 责任人 | 时间节点 | 评估指标 |
|------|---------|--------|---------|---------|
| 4.1.1 | 引入窗口位置/尺寸持久化（桌面端） | 前端开发 | 第1-2周 | 重启后恢复窗口状态 |
| 4.1.2 | 新手引导增加跳过、重看、进度记忆 | 前端开发 | 第2周 | 引导中断可恢复 |
| 4.1.3 | 统一外链打开入口，禁止组件直接 `window.open()` | 前端开发 | 第1周 | 外链行为一致且可审计 |
| 4.1.4 | macOS 标题栏布局继续打磨，和当前命令能力结合 | 前端开发 | 第2-3周 | 原生感提升 |
| 4.1.5 | 网络状态全局提示与自动重连反馈统一到共享组件 | 前端开发 | 第2周 | 断网感知更明确 |

### 4.2 响应式与平台适配

| 步骤 | 具体措施 | 责任人 | 时间节点 | 评估指标 |
|------|---------|--------|---------|---------|
| 4.2.1 | 桌面端设置最小窗口尺寸和窄宽度提示 | 前端开发 | 第1周 | 防止布局失真 |
| 4.2.2 | 移动端安全区域与键盘顶起策略统一 | 移动端开发 | 第2周 | 异形屏无遮挡 |
| 4.2.3 | 横竖屏切换策略按页面分类，聊天主视图优先稳定竖屏体验 | 移动端开发 | 第2周 | 切换不闪烁 |
| 4.2.4 | 桌面端跟随系统缩放与高 DPI 适配检查 | 前端开发 | 第3周 | 125%-150% 缩放无明显溢出 |

### 4.3 i18n 类型安全增强

**当前现状**：
- 语言包已按 `locales/<locale>/<part>.json` 分片动态加载
- 已有 `availableLocales` 和语言归一化逻辑
- 但仍缺少编译期 key 检查与多语言完整性校验

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 4.3.1 | 以 `zh-CN` 为基准生成翻译 key 类型 | 前端开发 | 第2-3周 |
| 4.3.2 | 提供类型安全的 `t()` 包装层 | 前端开发 | 第2-3周 |
| 4.3.3 | 增加 locales 完整性校验脚本（缺失键/冗余键） | DevOps | 第3周 |
| 4.3.4 | 后续再评估接入 Crowdin/Localazy | 架构师 | 第4-5周 |

---

## 第五部分：架构优化方案

### 5.1 Matrix Room 服务层合并

**当前现状**：
- `src/services/matrix/room/` 下已经分出 `CreationService`、`LifecycleService`、`MembershipService`、`MetadataService`、`StateService`、`TagsService`、`PinsService`、`SummaryService`、`TimelineService`、`RealtimeService` 等较细颗粒模块
- 单元测试覆盖并不差，但跨服务调用边界仍较多

**目标**：
- 保留当前内部拆分的可测试性
- 对外导出合并为 6-8 个聚合服务或 facade，减少调用方认知负担

| 合并方向 | 目标服务 | 说明 |
|---------|---------|------|
| `Creation` + `Lifecycle` + `Membership` | `RoomLifecycleService` | 房间生命周期相关入口统一 |
| `Metadata` + `State` + `Tags` + `Pins` + `Translate` | `RoomStateService` | 房间状态/元数据集中管理 |
| `Summary` + `MatrixRoomSummaryService` | `RoomListService` | 列表、摘要、排序策略统一 |
| `Aliases` + `Moderation` | `RoomAdminService` | 管理类操作收敛 |
| `DirectMessage` + `MatrixDirectMessageService` + `MatrixSpaceService` + `MatrixGroupService` | `RoomNavigationService` | 导航、空间、群组、DM 聚合 |

**实施要求**：
- 先加 facade，再迁移调用方
- 旧导出保留至少一个迭代周期
- 每组合并后跑房间服务单测与关键聊天链路回归

### 5.2 Store 瘦身与命名修复

**当前现状**：
- `stores/index.ts` 当前导出约 37 个主 store，另有 `chat/chat/` 子模块拆分
- `pinia-shared-state` 已注册但关闭
- 存在 `useDownloadQuenuStore` 命名错误

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 5.2.1 | 修复 `useDownloadQuenuStore -> useDownloadQueueStore`，保留兼容别名过渡 | 前端开发 | 第1周 |
| 5.2.2 | 合并文件下载相关 store，减少重复状态源 | 前端开发 | 第2周 |
| 5.2.3 | 审查 `persist` 粒度，敏感信息不再默认持久化到前端存储 | 前端开发 | 第2-3周 |
| 5.2.4 | 若共享状态短期不启用，则移除 `pinia-shared-state` | 前端开发 | 第1周 |

### 5.3 组件与渲染策略优化

**当前现状**：
- 已有 `MessageStrategy` 与多种消息 `strategies/*`
- 说明消息渲染已经有抽象基础，不应从零重构

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 5.3.1 | 建立消息组件注册表，统一策略到组件的映射出口 | 前端开发 | 第3-4周 |
| 5.3.2 | 扁平化 `rightBox/chatBox/` 层级过深的问题 | 前端开发 | 第2周 |
| 5.3.3 | 合并职责重叠的截图/预览组件 | 前端开发 | 第2周 |

### 5.4 Rust 后端架构优化

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 5.4.1 | 继续推进 workspace 化，把 command/repository/common 能力抽离为 crate | Rust 开发 | 第3-5周 |
| 5.4.2 | 移除 `reqwest` 的 `blocking` feature，统一异步调用 | Rust 开发 | 第2周 |
| 5.4.3 | 用 `dotenvy` 替代 `dotenv` | Rust 开发 | 第1周 |
| 5.4.4 | 修复 `handle_logout_windows()` 可能的竞态与销毁时序问题 | Rust 开发 | 第2周 |
| 5.4.5 | 评估 `screenshots`、`sysinfo` 的体积与替代方案 | Rust 开发 | 第3周 |

---

## 第六部分：构建流程优化方案

### 6.1 Vite 配置重构

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 6.1.1 | 提取 `vite.config.base.ts` 共享 alias、插件、server 基础逻辑 | 前端架构 | 第1周 |
| 6.1.2 | 桌面端/移动端配置分离，保留共享 chunk 策略 | 前端架构 | 第1-2周 |
| 6.1.3 | 简化 `getLocalIP()` 与 `internal-ip` 双重方案，减少兜底复杂度 | 前端开发 | 第1周 |
| 6.1.4 | 修复 `preview.headers` 中过度禁用摄像头/麦克风的策略 | 前端开发 | 第1周 |
| 6.1.5 | `drop` 改为精细化配置，保留关键 `warn/error` 日志 | 前端开发 | 第2周 |

### 6.2 分包策略重构

**当前现状**：
- `build/config/chunks.ts` 已有较多经验性规则
- 但存在 `manualChunkConfig` 与函数体重复匹配、命名不统一、条件链过长问题

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 6.2.1 | 将显式 chunk 规则改为声明式配置表 | 前端开发 | 第2周 |
| 6.2.2 | 消除重复匹配逻辑与同类依赖的多处命名 | 前端开发 | 第2周 |
| 6.2.3 | 让 chunk 命名更反映业务边界，而非历史依赖名 | 前端开发 | 第2周 |
| 6.2.4 | 将 `stats.html` 和 `bundle-metrics.json` 一并上传到 CI | DevOps | 第2-3周 |

### 6.3 Vitest 配置合并

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 6.3.1 | 抽取 `vitest.config.base.ts` | 前端开发 | 第1周 |
| 6.3.2 | `vitest.config.ts` 负责多项目/storybook/browser，`vitest.unit.config.ts` 仅保留 unit 差异 | 前端开发 | 第1周 |
| 6.3.3 | 统一测试环境策略，明确 `happy-dom` 与 `browser-playwright` 的边界 | 前端开发 | 第1-2周 |

---

## 第七部分：CI/CD 优化方案

### 7.1 当前 CI 现状评估

HuLa 当前已经拥有以下工作流基础：

- `style-check.yml`
- `security-performance.yml`
- `sdk-check.yml`
- `performance.yml`
- `dependency-review.yml`
- `codeql.yml`
- `rust-clippy.yml`
- `release.yml`

**问题不在“没有 CI”，而在于：**
- workflow 间存在大量重复的 checkout / setup-node / pnpm install / cache 逻辑
- SHA 锁定不统一，有的工作流锁定，有的仍使用 `@v4`
- Node 版本不统一（18/22 并存）
- 缺少复用工作流层，维护成本高
- 类型检查、bundle 指标、E2E 结果没有统一汇总出口

### 7.2 目标工作流架构

```text
.github/workflows/
  ci.yml
  prepare.yml
  lint.yml
  typecheck.yml
  unit-test.yml
  e2e-web.yml
  build-desktop.yml
  build-mobile.yml
  bundle-metrics.yml
  security-audit.yml
  release.yml
```

### 7.3 实施步骤

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 7.3.1 | 抽取 `prepare.yml` 统一 Node/pnpm/Rust/缓存逻辑 | DevOps | 第1-2周 |
| 7.3.2 | 统一 Node 版本与缓存策略 | DevOps | 第1周 |
| 7.3.3 | 所有 workflow 补齐最小 `permissions` 与 `concurrency` | DevOps | 第1周 |
| 7.3.4 | SHA 锁定策略统一，不再混用 tag 与 SHA | DevOps | 第2周 |
| 7.3.5 | 将 lint/typecheck/unit/bundle/security 拆为可复用工作流 | DevOps | 第2-3周 |
| 7.3.6 | 为 E2E、bundle、coverage 输出统一 artifact 命名与 retention 策略 | DevOps | 第3周 |

### 7.4 安全审计补强

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 7.4.1 | 集成 `zizmor` 检查 GitHub Actions 风险模式 | DevOps | 第2周 |
| 7.4.2 | 保持 `dependency-review`、`codeql`，并补充 workflow 审计结果聚合 | DevOps | 第2周 |
| 7.4.3 | 对 release 相关第三方 action 做额外风险复核 | DevOps | 第2周 |

---

## 第八部分：安全加固方案

### 8.1 Tauri 安全配置

**当前已确认问题**：
- `tauri.conf.json` 中 CSP 仍含 `'unsafe-inline'` 与 `'unsafe-eval'`
- `assetProtocol.scope` 为 `"**"`
- `capabilities/default.json` 与 `desktop.json` 的窗口范围均为 `"*"`
- 移动端 capability 中 FS/HTTP 权限也较宽
- 部分平台专属配置文件将 `csp` 设为 `null`

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 8.1.1 | 先盘点哪些能力真正依赖 `unsafe-eval` / `unsafe-inline`，分类形成例外清单 | 架构师 | 第1周 |
| 8.1.2 | 将 `assetProtocol.scope` 从 `**` 收窄到资源目录白名单 | 架构师 | 第2周 |
| 8.1.3 | 按窗口职责拆分 capability，避免所有窗口默认拥有同等权限 | 架构师 | 第2-3周 |
| 8.1.4 | 清理移动端过宽的 FS/HTTP 允许范围 | 架构师 | 第2-3周 |
| 8.1.5 | 对平台配置中的 `csp: null` 做一致性复核，避免生产被意外放宽 | 架构师 | 第2周 |

**执行前置清单**：
1. 先输出一份 `CSP 例外来源表`，标记哪些页面、依赖或插件仍依赖 `'unsafe-inline'` / `'unsafe-eval'`。
2. 先输出一份 `capability 窗口分组表`，明确 `login`、`settings`、`main`、`tray`、`admin` 等窗口各自所需权限。
3. 先输出一份 `assetProtocol 实际访问路径清单`，避免收窄后误伤图片、文档、资源文件读取。
4. 每次安全收口都应附带一份最小回归清单：启动、登录、房间切换、附件预览、更新、托盘、设置页。
5. 必须保留回滚方案：CSP、capability、scope 改动都应按独立提交推进，便于快速回退。

### 8.2 外链、路径与协议安全

**当前风险点**：
- 项目中存在多处分散的 `window.open()`
- `useLinkSegments.ts` 当前主要按 `http(s)` 归一化处理，若直接收口不当，可能误伤 `mailto:`
- 组件层直接调用外链打开，缺少统一审计入口

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 8.2.1 | 封装统一 `openExternalUrl()`，仅允许 `http/https/mailto`，保留合法 scheme，拒绝未知 scheme | 前端开发 | 第1周 |
| 8.2.2 | 盘点并替换 `window.open()`、`plugin-shell.open()`、`plugin-opener.openUrl()` 等分散调用点 | 前端开发 | 第1周 |
| 8.2.3 | 对深度链接参数增加显式校验和错误提示 | 前端开发 | 第2周 |
| 8.2.4 | 将 URL 打开逻辑纳入单测与 E2E 冒烟用例 | 前端开发 | 第2周 |

**验收要求**：
1. `mailto:`、`http:`、`https:` 正常打开。
2. `javascript:`、`file:`、自定义未知 scheme 默认拒绝，并有日志或错误提示。
3. 组件层不再直接调用 `window.open()` 处理外链。
4. 链接打开逻辑至少覆盖单测和一个桌面端冒烟场景。

### 8.3 敏感数据保护

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 8.3.1 | 全量审查 Pinia `persist`，敏感 token 不再落前端持久化存储 | 前端开发 | 第2周 |
| 8.3.2 | 前端敏感数据迁往 Tauri/Rust 安全存储路径 | 前端开发 | 第3周 |
| 8.3.3 | 代码签名、自动更新、公证流程按平台分别梳理 | DevOps | 第4-5周 |

---

## 第九部分：测试体系完善方案

### 9.1 当前测试现状评估

**并非“测试极少”，而是“结构不均衡”**：
- Room 服务层已有较多单元测试
- Store、设置页、策略层、性能上报已有可观测试样本
- Playwright 已有 5 个 spec，覆盖桌面与移动浏览器项目
- 但**Tauri 容器级能力、系统权限、原生窗口、多窗口行为**仍缺少专门测试夹具

### 9.2 单元与组件测试增强

| 步骤 | 具体措施 | 责任人 | 时间 | 评估指标 |
|------|---------|--------|------|---------|
| 9.2.1 | 优先补 `ChatMain`、`MsgInput`、`RoomList` 等高频主路径组件测试 | 前端开发 | 第2-4周 | 核心主路径覆盖更均衡 |
| 9.2.2 | 继续完善消息渲染策略与策略注册表测试 | 前端开发 | 第3周 | 渲染策略回归风险下降 |
| 9.2.3 | 把统一外链、安全入口、引导状态机纳入单测 | 前端开发 | 第2周 | 横切逻辑更稳 |

### 9.3 E2E 测试扩展

**当前现状**：
- `playwright.config.ts` 已区分 `desktop-chromium`、`mobile-chromium`、`mobile-safari`
- `baseURL` 当前固定为 `http://127.0.0.1:5210`
- `webServer` 基于 `pnpm dev` 启动，仍是浏览器开发服务器模式
- 已有桌面关键流、移动入口、动态页、matrix live 等基础用例

| 步骤 | 具体措施 | 责任人 | 时间 | 评估指标 |
|------|---------|--------|------|---------|
| 9.3.1 | 建立 Tauri 专用 Playwright fixture，覆盖窗口、托盘、权限、更新等原生行为 | 前端开发 | 第2-3周 | 桌面专用测试基础设施成型 |
| 9.3.2 | 新增登录→聊天→发消息→退出的稳定主流程 | 前端开发 | 第3-4周 | 核心流程可回归 |
| 9.3.3 | 管理后台、设置页、引导流程纳入桌面关键流 | 前端开发 | 第4周 | 高价值路径可自动验证 |
| 9.3.4 | 增加生产构建模式 E2E，而不只依赖 `pnpm dev` | DevOps | 第2周 | 测试环境更接近生产 |
| 9.3.5 | 统一 blob/html 报告与附件上传 | DevOps | 第3周 | 调试效率提升 |

### 9.4 Rust 测试增强

| 步骤 | 具体措施 | 责任人 | 时间 |
|------|---------|--------|------|
| 9.4.1 | 为 command 层增加参数校验与错误路径测试 | Rust 开发 | 第2-3周 |
| 9.4.2 | 为 repository 层补内存 SQLite 集成测试 | Rust 开发 | 第3-4周 |
| 9.4.3 | 在 CI 中固定加入 `cargo test` | DevOps | 第2周 |

---

## 第十部分：实施路线图与时间节点

### 阶段一：低风险高收益修复（第1-2周）

| 任务 | 优先级 | 负责人 |
|------|--------|--------|
| Rust `block_on`、`debug-print`、`dotenv`、`reqwest blocking` 整改 | P0 | Rust 开发 |
| `postcss-pxtorem` 仅移动端生效 | P0 | 前端开发 |
| `chunkSizeWarningLimit` 下调 + 体积基线固化 | P0 | 前端开发 |
| 统一外链打开入口，替换直接 `window.open()` | P0 | 前端开发 |
| 收紧 `assetProtocol.scope`、盘点 CSP 例外 | P0 | 架构师 |
| 修复 commitlint 长度规则 | P1 | 前端开发 |
| 修复 `useDownloadQuenuStore` 命名问题 | P1 | 前端开发 |
| 统一 CI `permissions` / `concurrency` / Node 版本 | P1 | DevOps |

### 阶段二：配置与构建收敛（第3-5周）

| 任务 | 优先级 | 负责人 |
|------|--------|--------|
| Vite 双端配置拆分 | P0 | 前端架构 |
| Vitest 配置合并 | P1 | 前端开发 |
| 分包规则数据化重构 | P1 | 前端开发 |
| 依赖瘦身第一轮 | P1 | 前端开发 |
| Biome 第一批规则强化 | P1 | 前端开发 |
| Knip/死代码检测接入 | P1 | 前端开发 |
| Bundle 指标与 stats 工件接入 CI | P1 | DevOps |

### 阶段三：架构与测试增强（第5-8周）

| 任务 | 优先级 | 负责人 |
|------|--------|--------|
| Room 聚合服务 facade 重构 | P1 | 架构师 + 前端开发 |
| Store 瘦身与 persist 收口 | P1 | 前端开发 |
| Tauri Playwright fixture 落地 | P1 | 前端开发 |
| i18n 类型安全与完整性检查 | P1 | 前端开发 |
| Rust workspace 拆分 | P2 | Rust 开发 |
| 核心组件测试补强 | P2 | 前端开发 |

### 阶段四：CI/CD 与安全完善（第8-10周）

| 任务 | 优先级 | 负责人 |
|------|--------|--------|
| 复用工作流体系落地 | P1 | DevOps |
| zizmor 与 workflow 安全审计接入 | P1 | DevOps |
| 代码签名、公证、升级链路复核 | P2 | DevOps |
| 敏感数据迁移与能力最小化收尾 | P1 | 架构师 + 前端开发 |

---

### 10.5 首批两周任务拆解（可直接建卡）

以下任务适合作为第一批执行项，特点是收益明确、改动范围可控、回归面相对可管理。

| 任务编号 | 任务名称 | 主要文件 | 输出物 | 验收方式 |
|---------|---------|---------|-------|---------|
| P0-1 | 修复 Rust 启动阻塞 | `src-tauri/src/lib.rs` | 异步 setup 或延迟 ready 方案 | 启动日志中可观察到 init 阶段耗时，且首屏 ready 时间较基线有可见下降 |
| P0-2 | 关闭生产 `debug-print` | `src-tauri/Cargo.toml` | 精简后的 SeaORM feature | 生产构建无 SQL debug 输出 |
| P0-3 | 用 `dotenvy` 替代 `dotenv` | `src-tauri/Cargo.toml`、`src-tauri/src/main.rs` | 维护中的 dotenv 实现 | 本地启动与构建正常 |
| P0-3b | 移除 `reqwest blocking` feature | `src-tauri/Cargo.toml`、相关 Rust HTTP 调用点 | 统一异步 HTTP 依赖边界 | `Cargo.toml` 不再启用 `blocking`，主要链路构建与运行正常 |
| P0-4 | `postcss-pxtorem` 仅移动端启用 | `vite.config.ts` | 平台化 CSS 转换逻辑 | 桌面端样式无 rem 污染 |
| P0-5 | 下调 bundle 告警阈值并固化基线 | `vite.config.ts`、`scripts/report-bundle-metrics.mjs`、CI workflow | bundle 阈值和基线产物 | `pnpm build` 后稳定生成 `dist/stats.html` 与 `bundle-metrics.json`，CI 可上传工件 |
| P0-6 | 统一外链打开入口 | `src/hooks/useLinkSegments.ts` 及调用处 | `openExternalUrl()` 白名单逻辑 | `http/https/mailto` 可用，未知 scheme 被拒绝，UI 无直接 `window.open()` 处理外链 |
| P0-7 | 收紧 Tauri 资源访问范围 | `src-tauri/tauri.conf.json` | 收窄后的 `assetProtocol.scope` | 本地资源读取正常，范围不再为 `**`，并附带最小回归清单执行记录 |
| P1-1 | 修复 commitlint 长度规则 | `commitlint.config.cjs` | 有效 header/subject 限制 | 不规范提交在本地或 CI 被拦截 |
| P1-2 | 修复下载队列 store 命名 | `src/stores/index.ts`、`src/stores/domains/widget/downloadQuenu.ts` | 新命名与兼容导出 | 类型检查和现有调用正常 |
| P1-3 | 统一 CI Node 版本与权限 | `.github/workflows/*.yml` | 更一致的 workflow 基线 | workflow 无重复降级，权限更清晰 |

### 10.6 文件级改动落点速查表

| 优化主题 | 优先修改文件 | 说明 |
|---------|-------------|------|
| Vite 双端配置拆分 | `vite.config.ts`、`build/config/chunks.ts` | 先抽 base，再拆 desktop/mobile |
| Bundle 指标固化 | `scripts/report-bundle-metrics.mjs`、`.github/workflows/security-performance.yml` | 让体积指标进入 CI 工件 |
| Vitest 配置收敛 | `vitest.config.ts`、`vitest.unit.config.ts` | 提取共享基础配置 |
| Commitlint 修复 | `commitlint.config.cjs` | 当前长度规则实际未生效 |
| Biome 强化 | `biome.json` | 分批开启 import type、organize imports、optional chain |
| Room 服务 facade | `src/services/matrix/room/` | 保留现有内部拆分，只收敛对外入口 |
| Store 瘦身 | `src/stores/index.ts`、`src/stores/domains/widget/` | 先修命名，再合并职责 |
| i18n 类型安全 | `src/services/i18n.ts`、`locales/` | 以 `zh-CN` 为基准推导 key 类型 |
| 外链与协议安全 | `src/hooks/useLinkSegments.ts`、各处 `window.open()` 调用点 | 统一为单一入口并做协议白名单 |
| Tauri 权限收口 | `src-tauri/tauri.conf.json`、`src-tauri/capabilities/*.json` | 从“全局开放”转向“按窗口分组授权” |
| Rust 启动链优化 | `src-tauri/src/lib.rs`、`src-tauri/src/main.rs` | 先解决 `block_on` 和 dotenv 依赖 |
| Rust HTTP 异步化 | `src-tauri/Cargo.toml`、`src-tauri/src/**/*.rs` | 移除 `reqwest blocking` 并盘点调用链 |
| Playwright 桌面增强 | `playwright.config.ts`、`e2e/*.spec.ts` | 先补桌面 fixture，再扩大原生行为覆盖 |

### 10.7 不建议第一批就做的事项

以下事项价值存在，但不建议放在第 1-2 周第一批推进：

1. **大规模 Room 服务物理合并**：先加 facade，避免一开始就动太多 import 路径。
2. **一次性开启全部 Biome 严格规则**：容易制造大量噪音，打断正常开发。
3. **立即替换 `matrix-js-sdk` 接入方式**：这会影响到三仓协作链路，适合放在完成构建基线后再评估。
4. **过早引入过多 CI 工作流拆分**：先统一 Node、权限、缓存，再做 reusable workflow 抽离。
5. **先做 Tauri E2E 全量原生覆盖**：优先覆盖高价值路径，如窗口、托盘、设置、外链与登录流。

---

### 10.8 任务依赖关系表

| 任务 | 前置任务 | 说明 |
|------|---------|------|
| `Vite 双端配置拆分` | `postcss-pxtorem` 平台化、bundle 基线固化 | 先拿到基线，再拆配置，便于对比收益 |
| `深度 bundle 优化` | `chunkSizeWarningLimit` 下调、`stats.html`/`bundle-metrics.json` 固化 | 没有稳定基线时，不适合过早做大范围拆包重构 |
| `capability 分组收口` | `CSP 例外来源表`、`窗口分组表` | 先盘清权限需求，再收口，否则容易回归 |
| `Tauri 原生 E2E 增强` | `统一外链入口`、`窗口权限分组` | 先稳定关键行为，再补容器级测试 |
| `Room facade 重构` | `文件级导出策略`、回归测试清单 | 先统一出口，再做调用迁移 |
| `依赖瘦身` | `depcheck/Knip` 首轮盘点 | 先证明冗余，再移除，避免误删 |

### 10.9 建议补充的执行产物

为避免“文档有方案，但执行后无法复盘”，建议在第一阶段同步产出以下工件：

1. `bundle-baseline.md`：记录构建时间、总产物体积、关键 chunk 体积。
2. `tauri-security-audit.md`：记录 CSP 例外、capability 窗口分组、assetProtocol 实际访问路径。
3. `startup-baseline.md`：记录 Rust init、数据库迁移、前端 ready 的时序日志。
4. `external-url-audit.md`：记录所有外链打开调用点及最终归并结果。

---

## 第十一部分：关键评估指标

| 维度 | 当前判断 | 目标值 | 测量方法 |
|------|---------|--------|---------|
| 首屏关键 JS gzip 体积 | 待基线确认 | `< 500KB` | `pnpm build` + `stats.html` |
| 总产物体积 | 待基线确认 | `< 3MB` | `metrics:bundle` |
| 冷启动至 ready | 待打点 | `< 3s` | Rust/前端启动日志 |
| 主线程 longtask | 已具备观察能力 | `< 50ms` | `WebVitalsObserver` |
| Room 列表渲染 | 已具备采样工具 | `< 200ms` | `RoomPerformance` |
| 核心主路径 E2E | 5 个 spec | `> 15` 个高价值场景 | Playwright 报告 |
| CI 复用度 | 低 | 重复 setup 明显减少 | workflow 结构检查 |
| 安全边界 | 能力已启用但偏宽 | 窗口/能力最小权限 | capability + CSP 审计 |
| 依赖数量 | 偏多 | `dependencies < 40` | `package.json` 统计 |

---

## 第十二部分：主要风险与应对措施

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| 双端配置拆分导致本地开发复杂度上升 | 中 | 中 | 共享基础配置，脚本统一入口 |
| CSP/Capabilities 收紧导致现有功能异常 | 高 | 中 | 先做能力盘点，再灰度收紧 |
| Room 服务聚合引入回归 | 高 | 中 | facade 先行、旧导出兼容、单测护航 |
| 依赖瘦身影响历史功能 | 中 | 中 | 先统计真实使用，再逐批移除 |
| Tauri fixture 建设成本高 | 中 | 中 | 先覆盖高价值原生行为，不追求一次到位 |
| Rust workspace 拆分影响编译链路 | 中 | 低 | 分阶段拆分并保持 cargo 命令兼容 |

---

## 附录：建议立即执行的 Top 10

1. 修复 Rust `block_on` 启动阻塞
2. 关闭生产 `debug-print`
3. 用 `dotenvy` 替代 `dotenv`
4. 收紧 `assetProtocol.scope`
5. 统一外链打开入口并清理 `window.open()`
6. `postcss-pxtorem` 仅移动端启用
7. 下调 `chunkSizeWarningLimit` 并固化 bundle 基线
8. 抽 `vite.config.base.ts` 和 `vitest.config.base.ts`
9. 修复 commitlint 长度规则与 scope 策略
10. 将现有 CI 工作流抽为复用 prepare/build/test 层

---

## 附录：当前仓库事实清单

为避免后续再次回到“凭印象制定方案”，这里记录本次修订依赖的关键仓库事实：

1. **构建配置**：当前仅有一个 `vite.config.ts`，同时承载桌面/移动两端逻辑。
2. **分包策略**：`build/config/chunks.ts` 已有较多经验规则，但存在重复匹配和命名历史包袱。
3. **Vitest**：`vitest.config.ts` 与 `vitest.unit.config.ts` 确有重复，可抽基础层。
4. **Playwright**：已有 `desktop-chromium`、`mobile-chromium`、`mobile-safari` 三个项目配置。
5. **CI**：已有多条 workflow，不是零基础，但存在 setup 重复、Node 版本不统一问题。
6. **Tauri 安全**：已启用 capabilities，但 `assetProtocol.scope` 仍为 `**`，且 capability 范围偏宽。
7. **Rust 启动链**：`common_setup()` 中仍使用 `tauri::async_runtime::block_on(...)`。
8. **性能埋点**：已有 `WebVitalsObserver`、`PerformanceReporter`、`RoomPerformance`，应优先复用。

---

## 附录：第一阶段执行检查清单

以下清单适合在第 1-2 周执行时逐项打勾，避免出现“任务做了，但验收遗漏”的情况。

### A. Rust 启动链检查清单

- [ ] `src-tauri/src/lib.rs` 中不再通过 `block_on` 阻塞初始化主链路
- [ ] 已补充启动阶段关键日志：应用启动、配置加载、数据库连接、迁移、前端 ready
- [ ] `src-tauri/Cargo.toml` 已移除 `debug-print`
- [ ] `src-tauri/Cargo.toml` 已移除 `reqwest` 的 `blocking` feature
- [ ] `src-tauri/src/main.rs` 已从 `dotenv` 迁移到 `dotenvy`
- [ ] 本地桌面端启动、登录、消息收发、设置页打开无明显回归

### B. 前端构建与体积检查清单

- [ ] `vite.config.ts` 已按平台控制 `postcss-pxtorem`
- [ ] `chunkSizeWarningLimit` 已收紧至目标值
- [ ] `pnpm build` 后可稳定产出 `dist/stats.html`
- [ ] `pnpm metrics:bundle` 后可稳定产出 `bundle-metrics.json`
- [ ] 已记录一次基线构建结果，包含总包体积与主要 chunk

### C. 外链与协议安全检查清单

- [ ] `openExternalUrl()` 已成为统一入口
- [ ] `http/https/mailto` 链接均已验证可正常打开
- [ ] `javascript:`、`file:`、未知 scheme 已验证被拒绝
- [ ] 主要 UI 外链调用点不再直接使用 `window.open()`
- [ ] 已补充对应单测或桌面端冒烟用例

### D. Tauri 安全收口检查清单

- [ ] 已输出 `CSP 例外来源表`
- [ ] 已输出 `capability 窗口分组表`
- [ ] 已输出 `assetProtocol 实际访问路径清单`
- [ ] `assetProtocol.scope` 不再为 `**`
- [ ] 完成最小回归清单：启动、登录、房间切换、附件预览、更新、托盘、设置页
- [ ] 所有安全收口改动均按独立提交推进，可单独回滚

### E. 规范与流程检查清单

- [ ] `commitlint.config.cjs` 已启用有效长度约束
- [ ] CI 已对 commitlint 或等价规范检查形成约束
- [ ] 下载队列 store 命名已修复并保留兼容导出
- [ ] `.github/workflows/` 中 Node 版本、权限策略、并发控制更加一致

---

## 附录：P0/P1 任务卡模板

以下模板适合直接复制到 GitHub/Gitee Issue，也可作为迭代卡片模板使用。

### 模板 1：P0 技术治理任务卡

```md
## 背景
- 当前问题：
- 影响范围：
- 对应优化方案章节：

## 目标
- 

## 修改范围
- 主要文件：
- 相关模块：

## 实施步骤
1.
2.
3.

## 验收标准
- [ ]
- [ ]
- [ ]

## 回归检查
- [ ] 启动
- [ ] 登录
- [ ] 主流程
- [ ] 设置页

## 风险与回滚
- 风险：
- 回滚方案：
```

### 模板 2：P1 配置/规范类任务卡

```md
## 背景
- 当前配置/规范问题：
- 现状文件：

## 目标
- 

## 修改文件
- 

## 具体改动
1.
2.

## 验收标准
- [ ] 配置项生效
- [ ] 本地校验通过
- [ ] CI 校验通过

## 备注
- 是否需要兼容过渡：
- 是否需要补文档：
```

### 可直接使用的任务卡示例

#### 示例 1：P0-1 修复 Rust 启动阻塞

```md
## 背景
- `common_setup()` 当前通过 `tauri::async_runtime::block_on(...)` 阻塞初始化链路
- 这会拉长应用启动时间，并且让后续性能优化缺少清晰边界
- 对应方案章节：`2.2`、`5.4`、`10.5`

## 目标
- 移除启动主链路中的同步阻塞点
- 为启动阶段补齐时序日志

## 修改范围
- `src-tauri/src/lib.rs`
- 可能涉及相关初始化调用链

## 实施步骤
1. 识别 `common_setup()` 当前阻塞初始化路径
2. 改为异步初始化或延迟 ready 机制
3. 为配置加载、数据库连接、迁移、ready 事件增加日志打点

## 验收标准
- [ ] `block_on` 不再阻塞主初始化链路
- [ ] 启动日志可观察 init 阶段耗时
- [ ] 首屏 ready 时间较当前基线有可见下降
- [ ] 登录、房间进入、设置页无明显回归

## 回归检查
- [ ] 桌面端启动
- [ ] 登录
- [ ] 房间列表加载
- [ ] 设置页打开

## 风险与回滚
- 风险：异步初始化顺序变化可能影响 ready 时机
- 回滚方案：按独立提交推进，必要时可快速回退到旧初始化链路
```

#### 示例 2：P0-6 统一外链打开入口

```md
## 背景
- 当前项目存在多处分散的 `window.open()`、`plugin-shell.open()`、`plugin-opener` 调用
- `mailto:` 与未知 scheme 的处理边界不统一
- 对应方案章节：`8.2`、`10.5`

## 目标
- 建立统一的 `openExternalUrl()` 外链打开入口
- 只允许 `http/https/mailto`

## 修改范围
- `src/hooks/useLinkSegments.ts`
- 全局外链调用点

## 实施步骤
1. 封装统一的协议白名单逻辑
2. 保留合法 scheme，拒绝未知 scheme
3. 替换主要外链调用点
4. 增加单测与桌面端冒烟校验

## 验收标准
- [ ] `http/https/mailto` 均可正常打开
- [ ] `javascript:`、`file:`、未知 scheme 被拒绝
- [ ] UI 不再直接用 `window.open()` 处理外链
- [ ] 至少有 1 个单测和 1 个桌面端冒烟场景覆盖

## 风险与回滚
- 风险：历史上依赖宽松 scheme 的入口可能失效
- 回滚方案：按模块逐批替换，保留调用点清单
```

#### 示例 3：P1-3 统一 CI Node 版本与权限

```md
## 背景
- 当前 workflow 存在 Node 18/22 并存、权限声明不统一、并发控制不一致的问题
- 对应方案章节：`7.1`、`10.5`

## 目标
- 统一 Node 版本
- 统一最小权限和并发策略

## 修改范围
- `.github/workflows/*.yml`

## 实施步骤
1. 盘点现有 workflow 的 Node 版本
2. 统一到目标版本
3. 统一 `permissions` 与 `concurrency`
4. 跑一次主要 workflow 冒烟验证

## 验收标准
- [ ] workflow 不再混用多套 Node 主版本
- [ ] 主要 workflow 均声明最小权限
- [ ] 主要 workflow 均具备一致的并发策略
- [ ] 关键 workflow 执行通过
```

---

## 附录：第一阶段 P0/P1 Issue 清单（可直接复制）

以下内容面向 GitHub/Gitee issue 创建场景，标题和正文均可直接复制使用。

### Issue 1

**标题**：`perf(rust): 消除 common_setup 启动阻塞并补齐启动时序日志`

```md
## 背景
- `src-tauri/src/lib.rs` 中 `common_setup()` 当前通过 `tauri::async_runtime::block_on(...)` 阻塞初始化主链路。
- 这会拉长桌面端冷启动时间，也让启动阶段性能优化缺少稳定的观测基线。
- 对应优化方案章节：`2.2`、`5.4`、`10.5`

## 目标
- 移除启动主链路中的同步阻塞点
- 增加启动阶段关键时序日志

## 修改范围
- `src-tauri/src/lib.rs`
- 可能涉及相关初始化调用链

## 实施步骤
1. 识别 `common_setup()` 当前阻塞路径
2. 改为异步初始化或延迟 ready 信号
3. 为配置加载、数据库连接、迁移、前端 ready 增加日志打点

## 验收标准
- [ ] `block_on` 不再阻塞主初始化链路
- [ ] 启动日志可观察 init 阶段耗时
- [ ] 首屏 ready 时间较当前基线有可见下降
- [ ] 登录、房间进入、设置页无明显回归

## 回归检查
- [ ] 桌面端启动
- [ ] 登录
- [ ] 房间列表加载
- [ ] 设置页打开
```

### Issue 2

**标题**：`build(rust): 移除 SeaORM debug-print 并清理生产日志噪音`

```md
## 背景
- `src-tauri/Cargo.toml` 当前仍启用 SeaORM `debug-print` feature。
- 该 feature 不适合继续保留在生产构建路径中。
- 对应优化方案章节：`2.2`、`10.5`

## 目标
- 关闭生产构建中的 SQL debug 输出

## 修改范围
- `src-tauri/Cargo.toml`

## 验收标准
- [ ] SeaORM `debug-print` feature 已移除
- [ ] 生产构建不再输出多余 SQL debug 日志
- [ ] 本地构建与运行正常
```

### Issue 3

**标题**：`build(rust): 用 dotenvy 替代 dotenv 并统一环境加载`

```md
## 背景
- 当前 `src-tauri/src/main.rs` 仍使用 `dotenv`。
- `dotenv` 已不适合作为继续演进的默认方案。
- 对应优化方案章节：`2.2`、`5.4`、`10.5`

## 目标
- 用 `dotenvy` 替代 `dotenv`

## 修改范围
- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs`

## 验收标准
- [ ] `dotenv` 已移除
- [ ] `dotenvy` 已接入
- [ ] 本地开发启动正常
- [ ] 生产构建正常
```

### Issue 4

**标题**：`refactor(rust): 移除 reqwest blocking feature 并盘点同步 HTTP 调用链`

```md
## 背景
- `src-tauri/Cargo.toml` 中 `reqwest` 仍启用 `blocking` feature。
- 这与当前 Rust 侧的异步运行时方向不一致。
- 对应优化方案章节：`5.4`、`10.5`

## 目标
- 移除 `blocking` feature
- 识别并处理潜在的同步 HTTP 调用链

## 修改范围
- `src-tauri/Cargo.toml`
- `src-tauri/src/**/*.rs`

## 验收标准
- [ ] `reqwest` 不再启用 `blocking`
- [ ] 主要链路构建与运行正常
- [ ] 若存在同步 HTTP 调用，已改造或留下注释说明
```

### Issue 5

**标题**：`build(vite): 限制 postcss-pxtorem 仅在移动端生效`

```md
## 背景
- 当前 `vite.config.ts` 中 `postcss-pxtorem` 对桌面端与移动端同时生效。
- 这会给桌面端样式带来不必要的 rem 转换成本。
- 对应优化方案章节：`2.1`、`6.1`、`10.5`

## 目标
- 仅在移动端启用 `postcss-pxtorem`

## 修改范围
- `vite.config.ts`

## 验收标准
- [ ] 移动端仍正常 rem 转换
- [ ] 桌面端不再无差别 rem 化
- [ ] 桌面端主要页面样式无回归
```

### Issue 6

**标题**：`perf(build): 下调 chunk 告警阈值并固化 bundle 基线`

```md
## 背景
- 当前 `chunkSizeWarningLimit` 为 `1200`
- 当前已有 `stats.html` 和 `metrics:bundle`，但尚未形成稳定基线
- 对应优化方案章节：`2.1`、`6.2`、`10.5`

## 目标
- 将 chunk 告警阈值收紧到目标值
- 固化一次可追踪的 bundle 基线

## 修改范围
- `vite.config.ts`
- `scripts/report-bundle-metrics.mjs`
- CI workflow

## 验收标准
- [ ] `chunkSizeWarningLimit` 已下调
- [ ] `pnpm build` 可稳定生成 `dist/stats.html`
- [ ] `pnpm metrics:bundle` 可稳定生成 `bundle-metrics.json`
- [ ] 已记录一次 bundle baseline
```

### Issue 7

**标题**：`security(frontend): 统一外链打开入口并收紧协议白名单`

```md
## 背景
- 当前项目存在多处分散的 `window.open()`、`plugin-shell.open()`、`plugin-opener` 调用
- `mailto:` 与未知 scheme 的处理边界不统一
- 对应优化方案章节：`8.2`、`10.5`

## 目标
- 建立统一的 `openExternalUrl()` 外链打开入口
- 只允许 `http/https/mailto`

## 修改范围
- `src/hooks/useLinkSegments.ts`
- 主要外链调用点

## 实施步骤
1. 封装统一的协议白名单逻辑
2. 保留合法 scheme，拒绝未知 scheme
3. 替换主要外链调用点
4. 增加单测与桌面端冒烟校验

## 验收标准
- [ ] `http/https/mailto` 均可正常打开
- [ ] `javascript:`、`file:`、未知 scheme 被拒绝
- [ ] UI 不再直接用 `window.open()` 处理外链
- [ ] 至少有 1 个单测和 1 个桌面端冒烟场景覆盖
```

### Issue 8

**标题**：`security(tauri): 收紧 assetProtocol.scope 并补齐最小回归清单`

```md
## 背景
- `src-tauri/tauri.conf.json` 当前 `assetProtocol.scope` 仍为 `**`
- 这会让资源访问范围过宽
- 对应优化方案章节：`8.1`、`10.5`

## 前置产物
- `assetProtocol 实际访问路径清单`
- 最小回归清单

## 目标
- 将 `assetProtocol.scope` 收窄到资源白名单

## 修改范围
- `src-tauri/tauri.conf.json`

## 验收标准
- [ ] `assetProtocol.scope` 不再为 `**`
- [ ] 图片、文档、资源文件读取正常
- [ ] 已执行启动、登录、房间切换、附件预览、更新、托盘、设置页回归
- [ ] 改动可独立回滚
```

### Issue 9

**标题**：`chore(commitlint): 修复 header/subject 长度规则并收紧 scope 生成策略`

```md
## 背景
- 当前 `commitlint.config.cjs` 中长度规则基本处于失效状态
- scope 自动生成策略也不够准确
- 对应优化方案章节：`3.2`、`10.5`

## 目标
- 恢复有效的 commit header/subject 约束
- 优化 scope 来源策略

## 修改范围
- `commitlint.config.cjs`

## 验收标准
- [ ] `maxHeaderLength` 生效
- [ ] `maxSubjectLength` 生效
- [ ] `minSubjectLength` 生效
- [ ] scope 生成策略更准确或改为显式白名单
```

### Issue 10

**标题**：`refactor(store): 修复 downloadQuenu 命名并保留兼容导出`

```md
## 背景
- 当前 store 命名存在 `useDownloadQuenuStore` 拼写问题
- 命名问题会影响长期维护性和认知一致性
- 对应优化方案章节：`5.2`、`10.5`

## 目标
- 修复命名为 `useDownloadQueueStore`
- 保留兼容导出，避免一次性破坏调用方

## 修改范围
- `src/stores/index.ts`
- `src/stores/domains/widget/downloadQuenu.ts`

## 验收标准
- [ ] 新命名已生效
- [ ] 兼容导出仍可用
- [ ] 类型检查通过
- [ ] 现有调用不回归
```

### Issue 11

**标题**：`ci(workflows): 统一 Node 版本、permissions 与 concurrency 策略`

```md
## 背景
- 当前 workflow 存在 Node 18/22 并存、权限声明不统一、并发控制不一致的问题
- 对应优化方案章节：`7.1`、`10.5`

## 目标
- 统一 Node 版本
- 统一最小权限和并发策略

## 修改范围
- `.github/workflows/*.yml`

## 验收标准
- [ ] workflow 不再混用多套 Node 主版本
- [ ] 主要 workflow 均声明最小权限
- [ ] 主要 workflow 均具备一致的并发策略
- [ ] 关键 workflow 执行通过
```

---

## 第十三部分：与 synapse-rust 后端深度适配

> 本部分基于对 `synapse-rust/` 当前路由、cargo feature、扩展 MSC、容错语义的深度审计补充。
> 目的：把"前端按通用 Matrix 规范开发"升级为"前端按本仓后端真实能力 + 私有扩展开发"，
> 同时为后端尚未实现或语义偏移的端点提供前端侧的统一降级与容错入口。

### 13.1 端点与 MSC 支持对照表

下表逐一对齐 `synapse-rust/src/web/routes/assembly.rs` 的实际路由与 hula 现有/缺失的客户端集成。

| 能力 | 后端路径 | 状态 | hula 现状 | 适配建议 |
|------|---------|------|----------|---------|
| 客户端版本协商 | `/_matrix/client/versions` | 稳定，含 `unstable_features` | `MatrixAuthService.getVersions()` 已返回 `unstableFeatures` | 抽 `useServerCapability(flag)` composable 统一 UI gate（见 13.2） |
| 客户端配置发现 | `/_matrix/client/v1/config/client` | 稳定 | 未消费 | 登录后读取 `homeserver.base_url` 与 `features.{e2ee,voip,threads,spaces}`，作为 UI 入口的真值源 |
| Auth metadata（MSC2965） | `/_matrix/client/unstable/org.matrix.msc2965/auth_metadata` | OIDC 未启用时回 `M_UNRECOGNIZED` | `MatrixOidcService` 仍走老 `/.well-known/openid-configuration` | 优先 MSC2965，回退 well-known，最后降级密码登录 |
| Dehydrated device（MSC3814） | `/_matrix/client/unstable/org.matrix.msc3814.v1/dehydrated_device` | 已持久化 | `MatrixDehydratedDeviceService` 写死 `/v1/dehydrated_device` | **必修**：换为 unstable 前缀，并在 404 时降级"暂不创建"而非反复重试 |
| RTC transports（MSC4143） | `/_matrix/client/unstable/org.matrix.msc4143/rtc/transports` | 当前总是返回 `{transports:[]}` | 未集成 | 仅当 `versions.unstable_features` 含 MSC4143 且 transports 非空时启用 SFU 通话入口 |
| Extended profile（MSC4133） | `/_matrix/client/unstable/uk.tcpip.msc4133/profile/{userId}/{key}` | stub（GET 字段返 404，PUT/DELETE 200） | 未集成 | 时区等字段写入失败时静默降级，**不再 toast 错误**；阅读侧字段缺失视为"未设置"而非异常 |
| `.well-known/matrix/client` | 已实现 | `MatrixAuthService.getWellKnown()` | 在 `0.0.0.0`/不可达 host 时不再向 UI 抛异常 |
| TURN | `/_matrix/client/{r0,v3}/voip/turnServer` | 已实现 | 未直接消费 | VoIP 启用前先拉一次；空响应时禁用 1:1 音视频按钮 |
| Capabilities | `/_matrix/client/{r0,v3}/capabilities` | 已实现 | 已读取 | `m.room_versions.default = "6"`、`m.set_avatar_url`、`m.3pid_changes` 等按真值开关 UI |
| Push 规则 | `/_matrix/client/v3/pushrules/` | 已实现 | 已使用 | — |
| 房间摘要/Threads/Spaces/Tags/Reactions | 已挂载 | 已使用 | — |
| 私有扩展：好友 | cargo `feature = "friends"` | 默认开 | `services/matrix/friends/*` 已对接 | UI 入口前置一次 capability 探活（见 13.3） |
| 私有扩展：阅后即焚 | cargo `feature = "burn-after-read"` | 默认开 | `BurnAfterReadSettings.vue`、`ChatFooter.vue` 已有 UI；`MatrixBurnAfterReadService` 已存在 | **关键**：发送前用 13.3 的 capability gate 判定，后端 feature 关闭时整段 UI 灰显而非发送报错 |
| 私有扩展：防截屏 | event type `com.hula.privacy.*`（前端约定） | 后端已感知 | 散落在 `ChatFooter.vue`、`renderMessage/index.vue` | 抽常量到 `src/services/matrix/privacy.ts`，0 处直接硬编码事件类型 |
| 私有扩展：受信私聊 | room preset `trusted_private_chat`（room_service.rs） | 默认开 | DM 创建流程未走该 preset | DM 创建时显式传 `preset`，与后端"管理员加密提示去除"语义对齐 |

> 当前用户感知中最大的噪音源是"端点 404 → toast 报错"。
> 13.2/13.3/13.4 的核心目标：把 404、`M_UNRECOGNIZED`、空响应、HTTP 401 全部前置到 capability 层，
> 让 UI 在加载入口时就决定是否渲染按钮，而不是点击后失败再回滚。

### 13.2 服务端能力探测层（`MatrixCapabilityService` + `useServerCapability`）

**新增文件建议**：`src/services/matrix/MatrixCapabilityService.ts`

职责：
1. 应用启动后**一次性**并发拉取 `versions` + `capabilities` + `client/v1/config/client`，结果存入 Pinia store。
2. 暴露同步 selector：`hasUnstable('org.matrix.msc4143')`、`hasFeature('voip')`、`roomVersionDefault()`、`setAvatarEnabled()`。
3. 失败回退到"乐观默认"（按规范默认开），但记录到 `PerformanceReporter` 以便观测。
4. **不轮询**；仅在登录、网络恢复、`/sync` 401 重新登录时刷新。
5. 与 `MatrixCacheManager` 集成，避免重复请求。

**调用方迁移**（按优先级）：

| 调用点 | 现状 | 改造目标 |
|--------|------|---------|
| `MatrixDehydratedDeviceService` | 直接 PUT，404 被 SDK 上抛 | 探测 `org.matrix.msc3814` 后再启用 |
| 视频会议入口（MatrixVoIPService 等） | 无 gate | 探测 `org.matrix.msc4143` + 非空 transports 后启用 |
| 时区等扩展资料字段 | 无 gate | 探测 `uk.tcpip.msc4133` 后启用，否则隐藏字段而非显示空 |
| QR 登录（`MatrixQrLoginService`） | 无 gate | 探测 `org.matrix.msc3882` 后启用（后端已 advertise `true`） |
| Burn-after-read | 无 gate | 用 13.3 私有 capability 探测 |

### 13.3 私有扩展能力探测（与后端 cargo feature 对齐）

`synapse-rust` 的 `friends/voice-extended/burn-after-read/widgets/beacons/external-services/openclaw-routes` 是**编译期 feature**，
不同部署可能裁剪不同模块。前端不能假设"代码里有 burn-after-read UI 就能用"。

**建议后端补一个轻量探测端点**（不在前端范围，但需在 plan 中显式列出，因为它直接决定前端 UI gate 的可行性）：

> `GET /_matrix/client/v1/com.hula/capabilities`
> 返回：`{burn_after_read, friends, anti_screenshot, trusted_private_chat, voice_extended, beacons, widgets}` 的布尔图
> 后端实现位置参考：`src/services/feature_flag_service.rs` 已有运行期 flag 表

**前端临时方案（在后端补端点前的过渡）**：

| 扩展 | 探测手段 | 失败处理 |
|------|---------|---------|
| burn-after-read | 首条阅后即焚发送 try/catch；记忆"本会话不可用" | 整段 UI 灰显，不再尝试 |
| 防截屏 | 监听 to-device `com.hula.privacy.*`；30s 内无回执视为不支持 | 仅本地视觉提示，不阻断发送 |
| 好友系统 | 首次拉取好友列表 404/501 → 关闭入口 | 进入侧边栏前判断 |
| 受信私聊 | `createRoom` 用 `preset: trusted_private_chat`，后端不识别会回 400 | 回退普通 DM preset |
| 语音消息 | `MatrixVoiceService` 首次发送失败 → 灰显录音按钮 | 阅读侧仍渲染（向前兼容） |

### 13.4 后端语义偏移的前端兜底

以下场景已在最近后端会话修复，但仍**值得在前端冗余兜底**，因为旧镜像或第三方部署可能并存：

1. **`m.direct` 引用已离开的房间**
   后端已在 `services/sync_service.rs::get_account_data_events` 过滤无效引用。
   前端 `services/matrix/room/DirectMessageService.ts` 仍应在写回前
   `.filter(roomId => client.getRoom(roomId))`，防止 matrix-rust-sdk-crypto-wasm `roomid_new` panic
   （`UserIdentityWarning: leading sigil missing`）。

2. **`homeserver.base_url` 拿到 `0.0.0.0`**
   后端已在 `common/config/mod.rs::get_public_baseurl` 回退 `localhost`。
   前端 `MatrixAuthService.getWellKnown()` 仍应做最后一道字符串校验：
   `host === '0.0.0.0' || host === '::' → 'localhost'`。

3. **新加入房间在增量 /sync 中缺 `m.room.create`**
   后端已在 `get_state_events_for_sync_batch` 检测"新可见房间"补全 state。
   前端 `MatrixEventService` 在收到房间但缺关键 state 时不应把房间塞入 RoomList，**等下一次完整 state** 再渲染，避免空房间闪烁。

4. **`/room_keys/version` 首次返回 404**
   规范允许的"尚无备份"语义。前端 `services/matrix/crypto/MatrixKeyBackupService` 在 secure backup 引导流程中应静默处理，
   不要当作"备份服务不可用"。复用 `src/common/matrixErrorTranslator.ts` 把 404 翻译为"未配置备份"而非"备份失败"。

5. **`.well-known/matrix/client` 在 `localhost:80` 不可达**
   开发环境固有现象。前端 `getWellKnown()` 失败应仅 debug 级日志（`@tauri-apps/plugin-log`），
   **不上报 sentry/posthog**。

### 13.5 配置与凭据流的端到端拉齐

| 关注点 | 后端事实 | hula 现状 | 改造建议 |
|--------|---------|----------|---------|
| 注册流 flows | 已实现 `m.login.dummy` + 邮件令牌 + reCAPTCHA（feature gated） | `MatrixAuthService.register` 已支持 UIA | 登录页对 `flows` 数组渲染按钮，而不是写死 `password+email` |
| 登录方式 | `password`、`m.login.token`、`sso`（OIDC/SAML/CAS feature） | 已支持 | SSO 入口与 `auth_metadata` 探测结果联动 |
| Refresh token | 已实现 `/refresh` | 已使用 | 把 `MatrixRequestHelper`/`MatrixRequestDeduper` 的 401 重试与 refresh 串联，避免双重刷新 |
| 设备 user_agent | 后端 `devices.user_agent` 字段已存在（本会话刚加） | 未传 | 登录时把 `${VITE_APP_NAME}/${appVersion} (Tauri ${platform})` 传过去，便于设备列表识别 |
| TURN 凭据 | 受 rate-limit 保护 | 未消费 | 拉取后缓存 `expires_in - 60s`，避免每次发起通话都打一次 |
| 设备 dehydration 凭据 | 后端持久化 | 已实现 | 与 13.1 路径修复联动，`MatrixCryptoService` 在登录后串接一次 |

### 13.6 与 synapse-rust 部署形态匹配的连接策略

后端默认 docker-compose 形态：

- 客户端 API：`8008/tcp`（HTTP，无 TLS）
- 联邦：`8448/tcp`
- Prometheus：`9090/tcp`
- 容器内 host 名 `synapse-rust`，对外暴露 `localhost:8008`
- hula CLAUDE.md 标注的开发默认 `VITE_HOMESERVER_URL=http://localhost:28008`，与本仓 `synapse-rust` docker 默认 `8008` 不一致

| 项目 | 建议默认值 |
|------|----------|
| `homeserverUrl` 默认值 | 与本仓 docker 对齐改为 `http://localhost:8008`，或在 hula `.env.example` 中显式注明二选一 |
| 登录页 hint | "首次开发联调请使用 localhost；不要直接填 `0.0.0.0`" |
| 健康检查 | 应用启动时 `GET /health`（200 = `{"status":"ok"}`），失败给可点击的"重试"提示而非崩溃页 |
| 联邦/CSRF | 后端 `csrf_middleware`/`shadow_ban_middleware` 已开启，前端不要在 dev 中用 `*` 跨域，按 `.env` 的 `ALLOWED_ORIGINS` 配置 vite proxy |
| Sliding Sync | 后端已挂载 `create_sliding_sync_router`，hula 通过 `MatrixSlidingSyncService` 已使用 | 重连策略沿用 `SlidingSyncReconnectManager`，无需改动 |

### 13.7 落地清单（直接建卡）

| 编号 | 任务 | 主要文件 | 验收 |
|------|------|---------|------|
| B0-1 | `MatrixDehydratedDeviceService` 切到 MSC3814 unstable 前缀，404 静默 | `src/services/matrix/crypto/MatrixDehydratedDeviceService.ts` | 后端关闭时不再产生重复错误日志 |
| B0-2 | 新建 `MatrixCapabilityService` 与 `useServerCapability` | `src/services/matrix/MatrixCapabilityService.ts`、`src/composables/useServerCapability.ts` | 启动 1 次拉取，后续 selector 同步可用 |
| B0-3 | `0.0.0.0` → `localhost` 字符串兜底 | `src/services/matrix/auth/MatrixAuthService.ts:766` | well-known 拿到 `0.0.0.0` 时被规范化 |
| B0-4 | `m.direct` 写回前过滤无房间引用 | `src/services/matrix/room/DirectMessageService.ts` | 离开/被踢房间不再出现在 DM 列表 |
| B0-5 | RTC transports gate 视频会议入口 | `src/services/matrix/media/MatrixVoIPService.ts`、`src/components/.../callButtons.*` | 后端无 SFU 时按钮不渲染 |
| B0-6 | MSC4133 时区字段静默降级 | `src/views/settingsWindow/tabs/`、`src/services/matrix/user/MatrixProfileService.ts` | 字段不可用时隐藏 |
| B0-7 | `.env.example` 默认 homeserver 与本仓后端一致 | `.env.example`、CLAUDE.md | 首次本地联调零配置 |
| B1-1 | 抽常量 `com.hula.privacy.*` 到 `src/services/matrix/privacy.ts` | `ChatFooter.vue`、`renderMessage/index.vue` | 0 处硬编码事件类型 |
| B1-2 | 登录传 `User-Agent` 给后端设备表 | `MatrixAuthService.login` | 后端 `devices.user_agent` 非空 |
| B1-3 | `/refresh` 与 `MatrixRequestHelper`/`MatrixRequestDeduper` 401 重试串联 | `services/matrix/MatrixRequestHelper.ts` | 401 触发一次刷新而非两次 |
| B1-4 | 后端补 `/_matrix/client/v1/com.hula/capabilities`（后端任务） | synapse-rust | 私有扩展全量探测可用 |
| B1-5 | TURN 凭据缓存与失效预热 | `MatrixVoIPService` | 通话发起延迟下降 |

---

## 第十四部分：UI 一致性与冗余清理

> 用户反复强调"界面风格统一、没有冗余"。下面列出的全部条目都对应 hula 当前的真实重复源，
> 不引入新设计语言，**只做收敛**。

### 14.1 双 UI 库（Naive UI + Vant）的边界硬化

**现状**（`package.json` + CLAUDE.md 已声明）：
- `naive-ui ^2.43.2` 服务桌面（`src/views/`）
- `vant ^4.9.22` 服务移动（`src/mobile/`）
- 两者目前**没有目录级强约束**，组件文件偶有混用，桌面打包会拖入 vant 的 CSS 子集，反之亦然

| 步骤 | 措施 | 落点 |
|------|------|------|
| 14.1.1 | Biome `noRestrictedImports` 增加：`src/views/**` 禁止 `vant`，`src/mobile/**` 禁止 `naive-ui` | `biome.json` |
| 14.1.2 | Vite 桌面/移动配置分别用 `optimizeDeps.exclude` 把对方库剔除（与 2.1 拆分配合） | `vite.config.desktop.ts` / `vite.config.mobile.ts` |
| 14.1.3 | 跨端共享组件统一到 `src/components/shared/`，**不允许直接 import 任一 UI 库**，只接 props 暴露 slot | `src/components/shared/` |
| 14.1.4 | 长期评估：若 `src/mobile/` 组件总量稳定低于阈值，考虑用 vant 单库覆盖两端，去除 naive-ui | 路线图 v2 |

### 14.2 设计 token 单一来源

**现状**：
- UnoCSS token 在 `uno.config.ts`
- naive-ui 主题覆盖在散落的 `themeOverrides`
- vant CSS 变量分布在 `:root --van-*` 自定义样式
- `src/styles/scss/global/variable.scss` 仍有部分手写变量（CLAUDE.md 已记录）

| 步骤 | 措施 | 落点 |
|------|------|------|
| 14.2.1 | 以 `uno.config.ts` 的 `theme.colors`/`spacing`/`borderRadius` 为唯一 source-of-truth | `uno.config.ts` |
| 14.2.2 | 由脚本自动生成 naive-ui `themeOverrides` 与 vant CSS variables | `scripts/build-design-tokens.mjs`（新增） |
| 14.2.3 | CI 增加 token 漂移检查：手改 `themeOverrides` 但未改 source 时报错 | `.github/workflows/style-check.yml` |
| 14.2.4 | `variable.scss` 仅保留**派生 token**（如渐变 `--bg-menu`），原子值由生成器写入 | 渐进 |

### 14.3 element-web/element-desktop 残留语义清理

hula 起源于 element-web fork，**仍残留**下列概念，建议以本仓后端为准重写：

| 残留 | 来源 | 处理 |
|------|------|------|
| `brand: "Element"`、Element Call URL 默认值 | 各类 config 示例与注释 | 用 hula 自身品牌；call URL 不再硬编码 element.io |
| `terms_and_conditions_links` 指向 element.io | 配置示例 | 替换为 hula 域或留空 |
| `bug_report_endpoint_url: element.io/bugreports` | 同上 | 切到 hula 自有上报或关闭 |
| `default_server_config.m.identity_server: vector.im` | 同上 | 留空（synapse-rust 不依赖 vector.im） |
| `feature_*` flag 名沿用 element-web | 各处 | 与 13.3 capability 对齐改名 |
| README/docs 中 element-web 链接 | 顶层 README | 仅在历史/致谢段保留，主流程引用替换为本仓后端 |

### 14.4 重复组件合并（命名优先）

下表是**已经在 docs 早先版本里隐式提到、但缺统一收敛动作**的清单：

| 现有组件 | 重复点 | 建议 |
|---------|-------|------|
| `Screenshot*.vue`、`PreviewScreenshot.vue`、截图弹窗多份 | 截图 → 预览 → 标注 → 发送链路 | 合并到 `src/components/shared/screenshot/`，对外只暴露 `useScreenshot()` |
| `MessageList.vue` 与 `RoomList.vue` 的虚拟列表 | 两套不同滚动恢复逻辑 | 抽 `useVirtualScroll`，两处都接 |
| 头像组件（桌面/移动各一） | 圆角、占位、加载态分歧 | 抽 `Avatar.shared.vue` |
| Toast/通知 | naive `useMessage` + vant `Toast` 同时存在 | shared composable `useToast()`，内部 dispatch |
| 链接/外链按钮 | 与 8.2 外链统一入口配合 | 一个组件 `<ExternalLink>`，禁止裸 `<a target="_blank">` |
| 加载态 | 不同页面有 3 种 spinner | 一个 `<AppSpinner size>` |
| 消息渲染入口 | `renderMessage/index.vue` 与策略层各持一份判定 | 全部走 `MessageStrategy`，组件只负责 props 渲染 |

### 14.5 多余依赖与杂物（在 2.3 之外的补充）

| 项 | 现状 | 处理 |
|----|------|------|
| `dayjs` + `date-fns` 并存 | 已在 2.3 列出 | 留 `dayjs`（更小且 hula 多数地方在用） |
| `crypto-js` + `digest-wasm` | 已在 2.3 | 加密哈希走 `digest-wasm`，删除 `crypto-js` |
| `jsdom` + `happy-dom` | 单测两栈 | 单测保 `happy-dom`（更快），仅 Storybook browser 测试用真浏览器 |
| `pinia-shared-state` | 已注册但 `enable: false` | 删除 |
| 仓库根 `tsc*.log`、`tmp-dynamic.png` | 临时产物未 ignore | `.gitignore` 加规则并清理 |
| `coverage/`、`storybook-static/`、`preview/` 是否纳入 git | 视情况 | 确认 ignore 一致性 |

### 14.6 路由/视图层冗余

| 现象 | 文件 | 措施 |
|------|------|------|
| `views/settingsWindow/tabs/` 与 `mobile/views/my/` 各有一份 BurnAfterReadSettings/PreferencesSettings | 7+ 份重复表单 | 抽 schema 到 `stores/domains/settings/settingsSchema.ts`（已存在），两端只渲染不同布局 |
| 多处直接读 `localStorage.getItem('hula:xxx')` | 设置/主题/语言 | 全部走 Pinia + `persistedstate` 单一通道 |
| 主题切换在 `data-theme` 与 store 两处维护 | `:root` 切换 + Pinia | 收敛到 store 单一 action |

### 14.7 落地清单（与 13.7 合并执行）

| 编号 | 任务 | 主要文件 | 验收 |
|------|------|---------|------|
| U0-1 | Biome 跨端 import 边界 | `biome.json` | `src/views/**` 出现 `from 'vant'` 时 lint 报错 |
| U0-2 | 删除 element-web 残留 brand/links 默认值 | `src/services/ConfigService.ts`、相关 README | 全仓 grep `element.io` 无结果（除 docs/changelog） |
| U0-3 | 删除根目录临时产物并补 `.gitignore` | `tsc*.log`、`tmp-dynamic.png`、`.gitignore` | `git status` 干净 |
| U0-4 | 删 `pinia-shared-state` / `crypto-js` / `date-fns` | `package.json` | 构建通过、单测通过 |
| U1-1 | Design token 自动生成脚本 | `scripts/build-design-tokens.mjs` | naive/vant 主题与 `uno.config.ts` 完全对齐 |
| U1-2 | 抽 `useToast`、`<ExternalLink>`、`<AppSpinner>` | `src/composables/`、`src/components/shared/` | 全仓替换完成 |
| U1-3 | 截图组件合并 | `src/components/shared/screenshot/` | 桌面/移动同一入口 |
| U1-4 | Settings schema → 双端共用渲染层 | `stores/domains/settings/settingsSchema.ts` 调用方 | 表单字段一处定义，两处展示 |

---

## 第十五部分：与现有计划的衔接说明

第十三、十四部分**不重复**前面章节，而是补充被忽略的两条主线：

- 第十三部分 = "前端 ↔ synapse-rust 后端"的契约层（capabilities / 私有扩展 / 容错语义）
- 第十四部分 = "界面统一 / 删除冗余" 的可执行清单（双 UI 库边界 / 设计 token / element-web 残留 / 重复组件）

执行优先级排序（与 第十部分 路线图合流）：

| 阶段 | 新增加入项 |
|------|----------|
| 阶段一（第1-2周） | B0-1 dehydrated MSC3814、B0-3 0.0.0.0 兜底、B0-4 m.direct 过滤、B0-7 .env 默认对齐、U0-2 element.io 残留清理、U0-3 临时文件清理 |
| 阶段二（第3-5周） | B0-2 capability service、B0-5 RTC gate、B0-6 MSC4133 静默降级、U0-1 Biome 跨端边界、U0-4 重复依赖删除 |
| 阶段三（第5-8周） | B1-1/2/3/5 私有扩展常量化 + 设备 UA + refresh 串联 + TURN 缓存、U1-* design token / 共享组件 / settings schema 合并 |
| 阶段四（第8-10周） | B1-4 等待后端 `/com.hula/capabilities` 端点，前端 UI gate 全量切换，element-web 残留终结 |
