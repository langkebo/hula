# Tasks

## Phase 1: 紧急修复（P0）-- 死依赖与死代码清除

- [x] Task 1: 移除未使用的 npm 依赖
  - [x] SubTask 1.1: 从 package.json 移除 `mermaid`、`stream-markdown`、`vue-demi` 依赖（`three` 保留，有实际引用）
  - [x] SubTask 1.2: 统一 MD5 实现 -- 移除 `crypto-js`，统一使用 `digest-wasm`
  - [x] SubTask 1.3: 清理 `build/config/chunks.ts` 中 mermaid、crypto-js、stream-markdown 相关的分包配置
  - [x] SubTask 1.4: 运行 `pnpm install` 更新 lockfile
  - [ ] SubTask 1.5: 运行 `pnpm tauri:dev` 验证应用正常启动

- [x] Task 2: 删除无引用的死代码模块
  - [x] SubTask 2.1: 删除 `src/services/api/` 整个目录（旧版 HTTP API 层，18个文件+4个空目录）
  - [x] SubTask 2.2: 删除 `src/services/errors.ts`（无引用的 ServiceError）
  - [x] SubTask 2.3: 删除 `src/services/TokenMigrationService.ts` 和 `src/services/SecureStorageService.ts`
  - [x] SubTask 2.4: 删除 `src/services/cache/MediaCacheService.ts`（无引用）
  - [x] SubTask 2.5: 删除 `src/services/notificationActions.ts`（无引用）
  - [x] SubTask 2.6: 清理测试文件中对已删除模块的 vi.mock() 引用

- [x] Task 3: 修复平台检测逻辑
  - [x] SubTask 3.1: 修改 `src/composables/usePlatform.ts`，优先使用 `TAURI_ENV_PLATFORM` 环境变量判断平台
  - [x] SubTask 3.2: 修复 Tauri 移动端（Android/iOS）被误判为桌面端的问题
  - [x] SubTask 3.3: 验证桌面端和移动端分别加载正确的路由和 UI 组件

## Phase 2: 性能修复（P1）-- 首屏加载与运行时

- [x] Task 4: 优化 App.vue 首屏加载
  - [x] SubTask 4.1: 将 App.vue 中 12+ 个 Matrix 服务的同步 import 改为动态 import（createLazyLoader 模式）
  - [x] SubTask 4.2: 将 `watchEffect(async ...)` 改为显式 `watch`，指定明确的依赖项
  - [x] SubTask 4.3: 修复 `window.addEventListener('keydown', ...)` 匿名函数未清理问题，提取为命名函数并在 `onUnmounted` 中移除
  - [ ] SubTask 4.4: 验证登录页首屏加载不包含 Matrix 服务模块

- [x] Task 5: 修复 Worker 内存保护机制
  - [x] SubTask 5.1: 实现 `matrixSdk.worker.ts` 中 `trimRoomTimelines()` 的实际裁剪逻辑
  - [x] SubTask 5.2: 在 `handleStopClient` 中清除内存检查的 `setInterval`
  - [x] SubTask 5.3: 修复 `fingerprint.worker.ts` 中 `timestamp` 导致指纹不稳定的问题
  - [x] SubTask 5.4: 修复 `highlightTask.ts` 中 `preloadCommon()` 未 await 的问题

- [x] Task 6: 延迟加载大型依赖
  - [x] SubTask 6.1: 将 `hula-emojis` 改为动态 import（仅在表情面板打开时加载）
  - [x] SubTask 6.2: 将 `@breezystack/lamejs` 改为动态 import（仅在语音录制时加载）
  - [x] SubTask 6.3: 将 `@fingerprintjs/fingerprintjs` 改为动态 import
  - [x] SubTask 6.4: 将 `tlbs-map-vue` 改为 `defineAsyncComponent` 动态加载
  - [ ] SubTask 6.5: 验证各功能在延迟加载后正常工作

- [x] Task 7: 修复运行时性能问题
  - [x] SubTask 7.1: 移除 `callWindow/index.vue` 中 MediaStream 的 `deep: true` 监听
  - [x] SubTask 7.2: 优化 `App.vue` 中 `collectTrackedPresenceUserIds` 的 watch，使用 computed 缓存
  - [x] SubTask 7.3: 构建配置平台隔离 -- 桌面端移除 VantResolver（移动端保留 NaiveUiResolver，因移动端有89个文件使用Naive UI）

## Phase 3: 架构优化（P2）-- 分层修复与统一

- [x] Task 8: 统一错误处理机制
  - [x] SubTask 8.1: 将 `matrixErrorTranslator.ts` 的 i18n key 逻辑合并到 `errors.ts` 的 `toAppError()`
  - [x] SubTask 8.2: 将 `sdk-errors.ts` 的 `normalizeSdkError()` 逻辑合并到 `toAppError()`
  - [x] SubTask 8.3: 标记 `TranslatedError` 和 `normalizeSdkError` 为 `@deprecated`
  - [x] SubTask 8.4: 更新所有消费者使用 `toAppError()` 替代旧 API（errorHandler.ts + friendErrors.ts 已迁移）
  - [x] SubTask 8.5: 补充缺失的 Matrix 错误码（M_THREEPID_IN_USE、M_ROOM_IN_USE 等 7 个）

- [x] Task 9: 提取 BaseMatrixService 基类
  - [x] SubTask 9.1: 创建 `src/services/matrix/BaseMatrixService.ts`，包含统一的 `getClient()` 实现
  - [x] SubTask 9.2: 25 个标准模式服务类已继承 `BaseMatrixService`，移除各自的 `getClient()` 方法（14 个非标准模式服务暂未修改）
  - [ ] SubTask 9.3: 运行 `vue-tsc --noEmit` 验证无类型错误

- [x] Task 10: 统一 Admin 服务架构
  - [x] SubTask 10.1: 将旧版 Admin 服务功能迁移到新版 Facade 服务
  - [x] SubTask 10.2: 更新 `useChatMain.ts` 等消费者使用 `AdminFacadeService`
  - [x] SubTask 10.3: 删除旧版 Admin 服务文件（8个服务+6个测试）
  - [x] SubTask 10.4: 简化 Facade 三层拆分，合并回 `AdminFacadeService.ts`

- [x] Task 11: 修复 Store 层状态冗余
  - [x] SubTask 11.1: 从 `useRoomStore` 中移除 `messages`、`hasMoreMessages` 及相关方法，统一由 `useChatStore` 管理
  - [x] SubTask 11.2: 更新所有消费 `useRoomStore.messages` 的组件改为使用 `useChatStore`
  - [x] SubTask 11.3: 标记 `useMessageStore` 为 `@deprecated`，添加迁移注释
  - [x] SubTask 11.4: 修复 `useUserStore` 中 `fetchUserProfile` 直接操作 SDK 内部 API 的问题，改为通过 `MatrixProfileService` 封装

- [x] Task 12: 修复 MatrixRuntimeSessionService 分层违规
  - [x] SubTask 12.1: 创建 `SessionOrchestrator` + `SessionStorePort` 接口（Port/Adapter 模式）
  - [x] SubTask 12.2: 将 `MatrixRuntimeSessionService` 中对 10 个 Pinia Store 的直接操作移至 `SessionOrchestrator`
  - [x] SubTask 12.3: `MatrixRuntimeSessionService` 通过 Port 接口访问 Store，不再直接导入

## Phase 4: 用户体验优化（P2）-- 暗色模式、国际化、移动端

- [x] Task 13: 修复暗色模式硬编码颜色
  - [x] SubTask 13.1: 将 `Login.vue` 中的硬编码颜色迁移为 CSS 变量（消除 JS 三元判断）
  - [x] SubTask 13.2: 将 `ActionBar.vue`、`WorkbenchPaneTabs.vue` 等组件的硬编码颜色迁移为 CSS 变量
  - [x] SubTask 13.3: 补充 `NaiveProvider.vue` 暗色主题中缺失的 `Skeleton` 覆盖
  - [x] SubTask 13.4: 修复 `Login.vue` 暗色模式使用 JS 三元而非 CSS 变量的问题
  - [ ] SubTask 13.5: 验证暗色模式下所有页面显示正确

- [x] Task 14: 修复国际化硬编码文本
  - [x] SubTask 14.1: 将 `Login.vue` 中的硬编码中文迁移至 i18n 翻译文件（7处模板+7处脚本）
  - [x] SubTask 14.2: 将 `plugins/robot/` 目录下的硬编码中文迁移至 i18n 翻译文件（Left.vue + ModelManagement.vue + ApiKeyManagement.vue，约90处）
  - [x] SubTask 14.3: 将 `ChatFooter.vue`、`Bot.vue`、`renderMessage/index.vue` 中的硬编码中文迁移至 i18n
  - [ ] SubTask 14.4: 将移动端组件中的硬编码中文迁移至 i18n（延后处理）
  - [x] SubTask 14.5: 修改 `i18n.ts` 语言回退策略，从中文改为英文
  - [ ] SubTask 14.6: 验证英文环境下无硬编码中文残留

- [x] Task 15: 修复移动端体验问题
  - [x] SubTask 15.1: 移除 `mobile.scss` 中的全局 `user-select: none !important`，改为仅对交互元素禁用选择
  - [x] SubTask 15.2: 修复 `mobile.scss` 中安全区域值被 `max()` 强制放大的问题
  - [ ] SubTask 15.3: 抽取桌面端/移动端消息处理逻辑为共享 composable（延后处理）
  - [x] SubTask 15.4: 修复 `App.vue` 中动态 import 样式文件缺少 `.catch()` 错误处理

## Phase 5: 长期优化（P3）-- 组件重构与完善

- [x] Task 16: 重构大型组件
  - [x] SubTask 16.1: 拆分 `renderMessage/index.vue`（538行→257行）-- 提取 `useMessageActions` 和 `useMessageContextMenu` composable
  - [ ] SubTask 16.2: 拆分 `Login.vue`（500+ 行）-- 按登录方式拆分子组件（延后处理）
  - [ ] SubTask 16.3: 消除组件直接导入 matrix 服务层的模式（渐进式迁移）

- [x] Task 17: 统一 SDK 类型入口
  - [x] SubTask 17.1: 移除 augmentations.d.ts 中的 `export * from 'matrix-js-sdk'`
  - [x] SubTask 17.2: 修复 `SlidingSync` 类型定义中 `unknown` 参数问题
  - [x] SubTask 17.3: 修复测试文件导入路径（从 augmentations 改为统一入口）
  - [x] SubTask 17.4: `vue-tsc --noEmit` 验证通过

- [x] Task 18: 完善无障碍支持
  - [x] SubTask 18.1: 为消息列表添加 `role="log"` 和 `aria-live="polite"`
  - [x] SubTask 18.2: 为会话列表添加 `role="list"` / `role="listitem"` 语义 + aria-label
  - [x] SubTask 18.3: 为右键菜单添加键盘导航支持（方向键、Enter、Escape）+ role="menu" 语义
  - [x] SubTask 18.4: 修复 `outline: none` 覆盖焦点样式的问题

- [x] Task 19: 完善离线体验
  - [x] SubTask 19.1: 将 `OfflineQueueService.enqueue()` 集成到消息发送流程（增强网络状态检测）
  - [x] SubTask 19.2: 添加全局网络状态 UI 指示器组件（NetworkStatusBar.vue）
  - [x] SubTask 19.3: 添加消息发送失败的错误标识和重试按钮（红色图标+重试文字+tooltip）
  - [x] SubTask 19.4: 为 `OfflineQueueService` 添加指数退避重试策略

- [x] Task 20: 统一服务初始化模式
  - [x] SubTask 20.1: 移除 5 个 `initializeXxxService()` 函数，改为延迟初始化
  - [x] SubTask 20.2: 清理 `matrix.ts` store 中的 `initializeSubServices()` 调用
  - [x] SubTask 20.3: 更新测试文件

# Task Dependencies

- [Task 2] depends on [Task 1] (先清理依赖再删代码，避免交叉引用)
- [Task 4] depends on [Task 1] (移除死依赖后再优化首屏加载)
- [Task 6] depends on [Task 1] (移除死依赖后再延迟加载)
- [Task 8] depends on [Task 9] (错误处理统一需要先有 BaseMatrixService)
- [Task 10] depends on [Task 9] (Admin 统一需要先有 BaseMatrixService)
- [Task 11] depends on [Task 12] (Store 冗余修复需要先修复分层违规)
- [Task 16] depends on [Task 8, Task 9, Task 11] (组件重构依赖架构优化完成)
- [Task 17] depends on [Task 9] (类型入口统一依赖服务层重构)
- [Task 19] depends on [Task 8] (离线体验依赖错误处理统一)

# Parallelizable Work

- Task 3 (平台检测) 可与 Task 1, Task 2 并行
- Task 5 (Worker 修复) 可与 Task 4, Task 6, Task 7 并行
- Task 13 (暗色模式) 可与 Task 14 (国际化) 并行
- Task 15 (移动端) 可与 Task 13, Task 14 并行
- Task 18 (无障碍) 可与 Task 19 (离线) 并行
