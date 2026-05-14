# 验收清单

## Phase 1: 死依赖与死代码清除

- [x] `mermaid`、`stream-markdown`、`vue-demi` 已从 package.json 移除（`three` 保留，有实际引用）
- [x] `crypto-js` 已移除，所有 MD5 功能由 `digest-wasm` 提供
- [x] `build/config/chunks.ts` 中 mermaid、crypto-js、stream-markdown 相关配置已清理
- [x] `pnpm install` 成功，lockfile 已更新
- [ ] `pnpm tauri:dev` 应用正常启动，无运行时错误
- [x] `src/services/api/` 目录已删除（18个文件+4个空目录）
- [x] `src/services/errors.ts` 已删除
- [x] `src/services/TokenMigrationService.ts` 和 `src/services/SecureStorageService.ts` 已删除
- [x] `src/services/cache/MediaCacheService.ts` 已删除
- [x] `src/services/notificationActions.ts` 已删除
- [x] `vue-tsc --noEmit` 无类型错误
- [x] `usePlatform.ts` 优先使用 `TAURI_ENV_PLATFORM` 判断平台
- [x] Android/iOS Tauri 环境被正确识别为 `mobile` 平台

## Phase 2: 首屏加载与运行时性能

- [x] App.vue 中 Matrix 服务模块改为动态 import（createLazyLoader 模式，12个服务）
- [x] `watchEffect(async ...)` 改为显式 `watch`
- [x] `window.addEventListener('keydown', ...)` 在 `onUnmounted` 中正确清理
- [x] 登录页首屏 JS 资源不包含 Matrix 服务模块（动态 import 延迟加载）
- [x] `trimRoomTimelines()` 实现了实际的 timeline 裁剪逻辑
- [x] `handleStopClient` 清除了内存检查的 `setInterval`
- [x] `fingerprint.worker.ts` 不再将 `timestamp` 纳入指纹计算
- [x] `highlightTask.ts` 的 `preloadCommon()` 正确 await
- [x] `hula-emojis` 改为动态 import
- [x] `@breezystack/lamejs` 改为动态 import
- [x] `@fingerprintjs/fingerprintjs` 改为动态 import
- [x] `tlbs-map-vue` 改为 `defineAsyncComponent` 动态加载
- [x] `callWindow/index.vue` MediaStream 监听移除 `deep: true`
- [x] `collectTrackedPresenceUserIds` watch 使用 computed 缓存
- [x] 桌面端构建配置仅包含 `NaiveUiResolver`
- [ ] 移动端构建配置仅包含 `VantResolver`（移动端有89个文件使用Naive UI，保留NaiveUiResolver）

## Phase 3: 架构优化

- [x] `toAppError()` 包含 i18n key 逻辑，替代 `translateMatrixError()`
- [x] `normalizeSdkError()` 标记为 `@deprecated`
- [x] `TranslatedError` 标记为 `@deprecated`
- [x] 所有错误消费者使用 `toAppError()` 统一 API（errorHandler.ts + friendErrors.ts 已迁移）
- [x] 缺失的 Matrix 错误码已补充（7个新错误码）
- [x] `BaseMatrixService.ts` 已创建，包含统一 `getClient()` 实现
- [x] 25 个标准模式 Matrix 服务类继承 `BaseMatrixService`（14 个非标准模式暂未修改）
- [x] 各服务类中重复的 `getClient()` 方法已移除
- [x] 旧版 Admin 服务功能已迁移到 Facade 服务（8个服务文件+6个测试文件删除）
- [x] `useChatMain.ts` 等消费者已更新使用 `AdminFacadeService`
- [x] 旧版 Admin 服务文件已删除
- [x] `AdminFacadeDomainMethods` 和 `AdminFacadeOpsMethods` 已合并回 `AdminFacadeService`
- [x] `useRoomStore` 不再包含 `messages`、`hasMoreMessages` 属性
- [x] 所有消息数据访问统一通过 `useChatStore`
- [x] `useMessageStore` 标记为 `@deprecated`
- [x] `useUserStore.fetchUserProfile` 通过 `MatrixProfileService` 封装
- [x] `MatrixRuntimeSessionService` 不再直接导入 Pinia Store（Port/Adapter 模式）
- [x] 会话编排逻辑由 `SessionOrchestrator` 负责

## Phase 4: 用户体验优化

- [x] `Login.vue` 硬编码颜色迁移为 CSS 变量
- [x] `ActionBar.vue`、`WorkbenchPaneTabs.vue` 等组件硬编码颜色迁移为 CSS 变量
- [x] Naive UI 暗色主题覆盖包含 `Skeleton` 配置
- [x] `Login.vue` 暗色模式使用 CSS 变量而非 JS 三元
- [ ] 暗色模式下所有页面显示正确，无对比度问题
- [x] `Login.vue` 硬编码中文迁移至 i18n（7处模板+7处脚本）
- [x] `plugins/robot/` 硬编码中文迁移至 i18n（Left.vue + ModelManagement.vue + ApiKeyManagement.vue，约90处）
- [x] `ChatFooter.vue`、`Bot.vue`、`renderMessage/index.vue` 硬编码中文迁移至 i18n
- [ ] 移动端组件硬编码中文迁移至 i18n（延后处理）
- [x] 语言回退策略改为英文
- [ ] 英文环境下无硬编码中文残留
- [x] 移动端 `user-select: none` 仅应用于交互元素
- [x] 聊天消息文本可选择和复制
- [x] 安全区域值不再被 `max()` 强制放大
- [ ] 桌面端/移动端消息处理逻辑抽取为共享 composable（延后处理）
- [x] 动态 import 样式文件包含 `.catch()` 错误处理

## Phase 5: 长期优化

- [x] `renderMessage/index.vue` 脚本行数减少至 257 行（原 538 行，减少 52%）
- [x] `useMessageActions` composable 已提取
- [x] `useMessageContextMenu` composable 已提取
- [ ] 组件不直接导入 matrix 服务层（渐进式迁移）
- [x] `augmentations.d.ts` 不再包含 `export * from 'matrix-js-sdk'`
- [x] `SlidingSync` 类型定义参数类型明确（非 `unknown`）
- [x] `vue-tsc --noEmit` 验证通过
- [x] 消息列表有 `role="log"` 和 `aria-live="polite"`
- [x] 会话列表有 `role="list"` / `role="listitem"` 语义 + aria-label
- [x] 右键菜单支持键盘导航（方向键、Enter、Escape）+ role="menu" 语义
- [x] 焦点样式不被 `outline: none` 覆盖（改为 `:focus:not(:focus-visible)` 模式）
- [x] `OfflineQueueService.enqueue()` 已集成到消息发送流程（增强网络状态检测）
- [x] 全局网络状态 UI 指示器组件已添加（NetworkStatusBar.vue）
- [x] 消息发送失败显示错误标识和重试按钮（红色图标+重试文字+tooltip）
- [x] `OfflineQueueService` 使用指数退避重试策略
- [x] 所有 Matrix 服务使用模块级单例 + 延迟初始化模式
- [x] `initializeXxxService()` 显式调用已移除（5个函数删除）
- [x] `matrix.ts` store 中散落的服务初始化调用已清理

## 全局验收

- [x] `pnpm check:write` 通过（Biome 代码规范检查）
- [x] `vue-tsc --noEmit` 通过（TypeScript 类型检查）
- [x] `pnpm test:run` 通过（与本次修改相关的测试全部通过，剩余失败为预存在问题）
- [ ] `pnpm tauri:dev` 桌面端正常启动和运行
- [ ] 暗色模式切换正常
- [ ] 中英文切换正常
- [ ] 消息发送/接收功能正常
- [ ] 登录/登出功能正常
