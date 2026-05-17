# 前端系统性优化规范

## Why

HuLa 前端项目在快速迭代过程中积累了大量技术债：死代码/未使用依赖增加约 2-3MB 产物体积、服务层反向依赖 Store 层破坏分层架构、三套错误转换机制并存导致行为不一致、大量硬编码中文和颜色值阻碍国际化与暗色模式、离线队列虽已实现但未被集成、Worker 内存检查机制形同虚设。这些问题共同导致首屏加载缓慢、可维护性下降、跨平台兼容性不足，亟需系统性优化。

## What Changes

### 短期修复（P0/P1）

- **移除死依赖**: 移除 `three`、`mermaid`、`stream-markdown`、`vue-demi`、`crypto-js`（统一使用 `digest-wasm`）等未使用依赖，减少 2-3MB 产物体积
- **删除死代码**: 删除 `services/api/` 整个目录、`services/errors.ts`、`TokenMigrationService.ts` + `SecureStorageService.ts`、`MediaCacheService.ts` 等无引用模块
- **修复平台检测**: 修复 `usePlatform.ts` 中 Tauri 移动端被误判为桌面端的问题，优先使用 `TAURI_ENV_PLATFORM` 环境变量
- **修复 Worker 内存检查**: 实现 `trimRoomTimelines()` 的实际裁剪逻辑，使 Worker 内存保护机制生效
- **修复 App.vue 性能问题**: 将 `watchEffect(async ...)` 改为显式 `watch`；将 12+ 个 Matrix 服务同步导入改为动态导入
- **修复 fingerprint.worker.ts**: 移除指纹计算中的 `timestamp` 字段，确保指纹持久性

### 中期优化（P2）

- **统一错误处理**: 合并三套错误转换机制（`matrixErrorTranslator`、`errors.ts`、`sdk-errors.ts`）为单一管道，以 `AppError` 为唯一标准
- **提取 BaseMatrixService**: 消除 39 处 `getClient()` 重复代码
- **统一 Admin 服务架构**: 合并旧版 `MatrixXxxService` 和新版 `AdminXxxService`，消除双重实现
- **修复 Store 层问题**: 移除 `useRoomStore` 中的消息缓存冗余（统一由 `useChatStore` 管理）；标记 `useMessageStore` 为 `@deprecated`
- **修复 MatrixRuntimeSessionService 分层违规**: 将 Store 编排逻辑从服务层移至会话编排器
- **延迟加载大型依赖**: 将 `hula-emojis`、`lamejs`、`fingerprintjs`、`tlbs-map-vue` 改为动态导入
- **修复暗色模式**: 将硬编码颜色值迁移为 CSS 变量；补充 Naive UI 暗色主题覆盖
- **修复国际化**: 将硬编码中文文本迁移至 i18n 翻译文件；修改语言回退策略为英文
- **修复移动端体验**: 移除全局 `user-select: none`，仅对交互元素禁用选择

### 长期优化（P3）

- **重构组件架构**: 拆分 `renderMessage/index.vue`（538 行脚本）为 composable + 子组件
- **组件与服务层解耦**: 消除组件直接导入 matrix 服务层的模式，统一通过 Store 或 composable 间接访问
- **统一 SDK 类型入口**: 以 `sdk-entry.ts` 为唯一 SDK 类型入口，清理 `augmentations.d.ts` 中的 `export *` 和重复导出
- **完善无障碍**: 为核心聊天界面添加 ARIA 属性、键盘导航、焦点管理
- **完善离线体验**: 将 `OfflineQueueService` 集成到消息发送流程，添加离线状态 UI 指示器
- **统一服务初始化模式**: 消除 `getInstance()` vs `export const` vs `initializeXxxService()` 的不一致
- **优化构建配置**: 桌面端移除 VantResolver、移动端移除 NaiveUiResolver；优化 `manualChunks` 匹配性能

## 当前实施状态（2026-05-14）

- **Phase 1**: 依赖清理、死代码删除与平台检测修复已完成阶段性成果，待补 `pnpm tauri:dev` 启动验收记录。
- **Phase 2**: 首屏懒加载、Worker 修复和大依赖动态导入已落地，待补首屏资源与性能实测数据。
- **Phase 3**: Admin 架构统一和 Session 分层修复已基本到位，错误处理统一、BaseMatrixService 覆盖和类型检查仍待收尾。
- **Phase 4**: 暗色模式和国际化已完成主路径迁移，但移动端与局部页面仍存在残余项，需要继续清理。
- **Phase 5**: 无障碍和离线体验已完成阶段性成果，组件重构、服务初始化一致性和全量测试仍待收尾。

## 文档口径说明

- 本规范保留原始目标要求，同时在各 Requirement 下补充 `当前状态`、`已完成工作`、`剩余工作` 和 `预计收尾时间`。
- 当原始目标与当前实现策略不完全一致时，以 `当前状态` 和 `剩余工作` 作为实际执行口径。
- 本次标注的目的是确保规范文档能真实反映“已完成阶段性成果 / 待收尾完善”的当前状态，而不是简单保留历史勾选结果。

## Impact

- **Affected specs**: 消息发送流程、登录流程、Admin 管理后台、暗色模式、国际化、离线功能
- **Affected code**:
  - `src/services/` -- 服务层重构（删除死代码、提取基类、统一架构）
  - `src/stores/domains/` -- Store 层状态冗余修复
  - `src/App.vue` -- 首屏加载优化、事件监听器清理
  - `src/workers/matrixSdk.worker.ts` -- 内存管理修复
  - `src/components/` -- 暗色模式、国际化、组件拆分
  - `src/composables/usePlatform.ts` -- 平台检测修复
  - `src/common/` -- 错误处理统一
  - `src/styles/` -- CSS 变量迁移
  - `build/config/` -- 构建配置优化
  - `package.json` -- 依赖清理

## ADDED Requirements

### Requirement: 死代码与死依赖清除

**当前状态**: 已完成阶段性成果  
**已完成工作**: 依赖和死代码清理主体已经落地，`services/api/` 等旧模块已删除。  
**剩余工作**: 补一次依赖清理后的桌面端启动验收记录。  
**预计收尾时间**: `2026-05-19`

系统 SHALL 不包含任何未被引用的服务模块、工具函数和 npm 依赖。所有已标记 `@deprecated` 且无关键引用的模块 SHALL 被移除或标记为 `@deprecated` 并制定迁移计划。

#### Scenario: 移除未使用依赖后构建成功
- **WHEN** 执行 `pnpm install && pnpm tauri:dev`
- **THEN** 应用正常启动，无运行时错误，产物体积较优化前减少至少 1.5MB（gzip）

#### Scenario: 删除死代码后功能完整
- **WHEN** 删除 `services/api/`、`services/errors.ts`、`TokenMigrationService.ts` 等无引用模块
- **THEN** 所有现有功能正常工作，TypeScript 编译无错误

### Requirement: 首屏加载性能优化

**当前状态**: 已完成阶段性成果  
**已完成工作**: `App.vue` 已改为显式 `watch` 并对 Matrix 服务及大型依赖启用延迟加载。  
**剩余工作**: 补首屏资源分析、登录前后加载行为与性能数据记录。  
**预计收尾时间**: `2026-05-19`

系统 SHALL 将登录页面的首屏加载资源限制在必要的最小集合内。Matrix 服务模块、大型 UI 库（hula-emojis、lamejs、tlbs-map-vue 等）SHALL 在用户登录成功后或功能首次使用时动态加载。

#### Scenario: 登录页首屏加载优化
- **WHEN** 用户打开应用进入登录页
- **THEN** 首屏加载的 JS 资源不包含 Matrix 服务模块、lamejs、fingerprintjs、tlbs-map-vue、hula-emojis
- **AND** 登录页在 3 秒内完成可交互状态（本地开发环境）

#### Scenario: 登录后按需加载
- **WHEN** 用户登录成功
- **THEN** Matrix 服务模块通过动态 import 加载
- **AND** 加载过程中显示适当的加载状态

### Requirement: 平台检测准确性

**当前状态**: 已完成阶段性成果  
**已完成工作**: `TAURI_ENV_PLATFORM` 已成为优先判断源，`android/ios` 已归类到 `mobile`。  
**剩余工作**: 补桌面端与移动端路由、组件加载联调记录。  
**预计收尾时间**: `2026-05-19`

系统 SHALL 正确识别 Tauri 移动端（Android/iOS）环境为 `mobile` 平台，而非错误地识别为 `desktop`。平台检测 SHALL 优先使用 `TAURI_ENV_PLATFORM` 环境变量。

#### Scenario: Android Tauri 应用被正确识别
- **WHEN** 应用运行在 Android Tauri 环境中
- **THEN** `usePlatform()` 返回 `platform: 'mobile'`
- **AND** 加载移动端路由和 Vant UI 组件

#### Scenario: iOS Tauri 应用被正确识别
- **WHEN** 应用运行在 iOS Tauri 环境中
- **THEN** `usePlatform()` 返回 `platform: 'mobile'`

### Requirement: Worker 内存保护生效

**当前状态**: 已完成阶段性成果  
**已完成工作**: `trimRoomTimelines()` 已具备实际裁剪逻辑，Worker 停止路径已补定时器清理。  
**剩余工作**: 补充阈值触发后的回收效果数据和稳定性回归结果。  
**预计收尾时间**: `2026-05-19`

`matrixSdk.worker.ts` 的内存检查机制 SHALL 在内存超限时实际释放内存，而非仅打印警告。`trimRoomTimelines()` SHALL 实现有效的 timeline 裁剪逻辑。

#### Scenario: 内存超限时释放资源
- **WHEN** Worker 内存使用超过 400MB 阈值
- **THEN** `trimRoomTimelines()` 实际裁剪超过 `MAX_TIMELINE_SIZE` 的 timeline
- **AND** 内存使用量在裁剪后显著下降

#### Scenario: Worker setInterval 正确清理
- **WHEN** 调用 `handleStopClient`
- **THEN** 内存检查的 `setInterval` 被正确清除

### Requirement: 错误处理统一

**当前状态**: 待收尾完善  
**已完成工作**: `toAppError()` 已作为统一入口，`TranslatedError` 与 `normalizeSdkError` 已标记为 `@deprecated`。  
**剩余工作**: 仍需迁移服务层和 store 层中残留的旧错误处理 API，并恢复全量类型/测试验证。  
**预计收尾时间**: `2026-05-21`

系统 SHALL 使用唯一的 `AppError` 判别联合类型作为错误标准。`TranslatedError` 和 `normalizeSdkError` SHALL 被废弃，其 i18n key 逻辑合并到 `toAppError`。

#### Scenario: SDK 错误统一转换
- **WHEN** Matrix SDK 抛出 `M_FORBIDDEN` 错误
- **THEN** 通过 `toAppError()` 统一转换为 `{ kind: 'auth', ... }` 格式的 `AppError`
- **AND** 包含可翻译的 i18n key

#### Scenario: 错误消息对用户友好
- **WHEN** 错误被展示给用户
- **THEN** 显示翻译后的用户友好消息，而非原始 i18n key 或 SDK 错误码

### Requirement: 暗色模式完整性

**当前状态**: 待收尾完善  
**已完成工作**: 登录页、核心工作台组件和 Naive UI `Skeleton` 暗色覆盖已完成。  
**剩余工作**: 移动端组件与局部页面仍有暗色模式硬编码颜色和对比度问题待处理。  
**预计收尾时间**: `2026-05-23`

系统 SHALL 确保所有 UI 元素在暗色模式下正确显示。硬编码颜色值 SHALL 被迁移为 CSS 变量，Naive UI 暗色主题覆盖 SHALL 完整覆盖所有使用的组件。

#### Scenario: 暗色模式下无硬编码颜色
- **WHEN** 切换到暗色模式
- **THEN** 所有组件的文字、背景、边框颜色正确切换
- **AND** 无白色背景/黑色文字等对比度问题

#### Scenario: Naive UI Skeleton 暗色适配
- **WHEN** 在暗色模式下显示 Skeleton 加载状态
- **THEN** Skeleton 颜色使用暗色主题覆盖值

### Requirement: 国际化文本覆盖

**当前状态**: 待收尾完善  
**已完成工作**: 登录页、robot 插件和聊天核心区域的大量中文文案已迁移到 i18n，回退语言已改为英文。  
**剩余工作**: 移动端和非 robot 目录仍有中文残留，英文环境巡检尚未完成。  
**预计收尾时间**: `2026-05-26`

系统 SHALL 将所有用户可见的硬编码中文文本迁移至 i18n 翻译文件。语言回退策略 SHALL 优先回退到英文而非中文。

#### Scenario: 英文环境下无硬编码中文
- **WHEN** 用户选择英文语言
- **THEN** 所有 UI 文本显示为英文，无中文残留

#### Scenario: 非中英语言回退到英文
- **WHEN** 用户的浏览器语言为日语（ja）
- **THEN** UI 显示英文而非中文

### Requirement: 移动端文本可选择

**当前状态**: 已完成阶段性成果  
**已完成工作**: 全局 `user-select: none` 已收敛为交互元素范围，聊天文本已恢复可选择。  
**剩余工作**: 补移动端真机验证记录。  
**预计收尾时间**: `2026-05-23`

系统 SHALL 允许移动端用户选择和复制聊天消息文本。`user-select: none` SHALL 仅应用于按钮、图标等交互元素，而非全局应用。

#### Scenario: 移动端复制消息文本
- **WHEN** 用户在移动端长按聊天消息文本
- **THEN** 系统显示文本选择手柄，用户可选择和复制文本

### Requirement: 服务层 getClient() 去重

**当前状态**: 待收尾完善  
**已完成工作**: `BaseMatrixService` 已建立并覆盖了多数标准模式服务。  
**剩余工作**: 仍有部分服务保留重复 `getClient()`，且类型检查尚未恢复通过。  
**预计收尾时间**: `2026-05-21`

所有 Matrix 服务类 SHALL 继承 `BaseMatrixService` 基类，获取 `getClient()` 方法的统一实现，消除 39 处重复代码。

#### Scenario: 新服务使用基类
- **WHEN** 创建新的 Matrix 服务类
- **THEN** 继承 `BaseMatrixService`，无需自行实现 `getClient()`

### Requirement: Admin 服务架构统一

**当前状态**: 已完成阶段性成果  
**已完成工作**: Admin 功能主入口已统一到 `AdminFacadeService`，旧版独立 Admin 服务文件已删除。  
**剩余工作**: 补 facade 场景回归和迁移清单复核记录。  
**预计收尾时间**: `2026-05-19`

系统 SHALL 统一 Admin 模块为单一架构（新版 Facade 模式），移除旧版 `MatrixXxxService` 独立获取 client 的模式。

#### Scenario: Admin 功能通过 Facade 访问
- **WHEN** 组件或 Store 需要调用 Admin API
- **THEN** 通过 `AdminFacadeService` 统一访问
- **AND** 旧版 `MatrixAdminService`、`MatrixReportService` 等被移除

### Requirement: Store 层状态冗余消除

**当前状态**: 已完成阶段性成果  
**已完成工作**: `useRoomStore` 中消息冗余状态已移除，`useMessageStore` 已标记为 `@deprecated`。  
**剩余工作**: 补全量消费者复核，确认不存在遗漏的旧访问路径。  
**预计收尾时间**: `2026-05-19`

`useRoomStore` SHALL 不再持有消息缓存（`messages`、`hasMoreMessages`），消息状态统一由 `useChatStore` 管理。`useMessageStore` SHALL 标记为 `@deprecated`。

#### Scenario: 消息状态单一来源
- **WHEN** 组件需要访问消息数据
- **THEN** 统一通过 `useChatStore` 访问
- **AND** `useRoomStore` 不再包含消息相关属性

### Requirement: MatrixRuntimeSessionService 分层修复

**当前状态**: 已完成阶段性成果  
**已完成工作**: 会话编排已迁移到 `SessionOrchestrator`，服务层通过 `SessionStorePort` 间接访问状态。  
**剩余工作**: 补登录、登出和会话恢复链路联调记录。  
**预计收尾时间**: `2026-05-19`

`MatrixRuntimeSessionService` SHALL 不直接导入和操作 11 个 Pinia Store。登录后的状态编排逻辑 SHALL 移至专门的会话编排器或由 Store 层自行编排。

#### Scenario: 服务层不反向依赖 Store 层
- **WHEN** 审查 `MatrixRuntimeSessionService` 的导入
- **THEN** 不包含任何 Pinia Store 的直接导入
- **AND** 状态编排逻辑由 Store 层或编排器负责

## MODIFIED Requirements

### Requirement: App.vue 事件监听器管理

**当前状态**: 已完成阶段性成果  
**已完成工作**: 关键事件监听已改为命名函数并在 `onUnmounted` 中清理。  
**剩余工作**: 补应用生命周期回归记录。  
**预计收尾时间**: `2026-05-19`

App.vue 中的所有事件监听器（mitt、window.addEventListener）SHALL 在 `onUnmounted` 中统一清理。匿名函数 SHALL 被提取为命名函数以支持移除。

### Requirement: 构建配置平台隔离

**当前状态**: 待收尾完善  
**已完成工作**: 桌面端构建配置已仅保留 `NaiveUiResolver`。  
**剩余工作**: 移动端当前仍保留 `NaiveUiResolver + VantResolver`，需要基于现有 Naive UI 使用面评估继续收敛还是调整最终规范。  
**预计收尾时间**: `2026-05-23`

桌面端构建配置 SHALL 仅包含 `NaiveUiResolver`。移动端构建配置的最终目标仍为收敛 resolver 冗余，但在完成移动端 Naive UI 依赖迁移前，允许临时保留 `NaiveUiResolver + VantResolver` 的兼容方案。

## REMOVED Requirements

### Requirement: 旧版 HTTP API 层
**Reason**: `services/api/` 整个目录无任何外部引用，已被 Matrix SDK 服务层完全替代
**Migration**: 直接删除，无需迁移

### Requirement: 旧版服务发现层
**当前状态**: 待收尾完善  
**Reason**: 原始目标是移除 `services/discovery/` 并将 Static 配置内联到 `backend/config.ts`。  
**实际情况**: 当前代码仍保留 discovery 目录及其调用链，尚未完成该项收尾。  
**Migration**: 后续需在确认兼容性后再执行内联和删除工作。  
**预计收尾时间**: `2026-05-23`

### Requirement: 旧版错误类型（TranslatedError）
**当前状态**: 待收尾完善  
**Reason**: 与 `AppError` 功能重叠，三套错误转换机制并存导致行为不一致。  
**实际情况**: 废弃标记已完成，但消费者替换尚未全部结束。  
**Migration**: 将 i18n key 逻辑继续合并到 `toAppError()`，逐步清理 `TranslatedError` 的残留消费者。  
**预计收尾时间**: `2026-05-21`
