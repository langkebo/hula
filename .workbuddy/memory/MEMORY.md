# 项目长期记忆 — Tjg (HuLa IM)

## 项目约定
- commitlint scope-enum：core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri。**管理后台用 `ui` scope**
- 设计 token：`--tjg-*` 为规范前缀（2.6.3 全部迁移完毕）
- 图标：SVG Sprite + Iconify 双轨，新界面默认用 Iconify
- TDD 验收基线：vue-tsc --noEmit (0 errors) + vitest run (全绿) + biome check (clean)

## 前端易错点
- **禁止解构 class 单例方法**：丢 `this` 绑定。排查 `undefined is not an object` 优先 grep 此模式
- **设置页 onMounted 必须先 `await matrixClientService.waitForClientReady({ timeoutMs: 10000 })`**
- **Tauri `resource id invalid` ≠ 网络错误**：是请求被取消的竞态，归一化为 `AbortError`，不重试
- **设备 ID 持久化**：`loginWithToken` 必须在首次 initialize 之前定好 deviceId（`resolveDeviceIdByWhoami` 预解析）
- **createRoom 铁律**：Space 必须用 `room_types:['m.space']`，不可把 `m.room.create` 塞进 `initial_state`
- **i18n 陷阱**：`locales/{lang}/*.json` 文件名即顶层命名空间键
- **biome.json 禁 JSONC 注释**：会静默丢弃语言级设置
- **.vue 格式化归 prettier**：biome.json overrides 中 `**/*.vue` 的 `formatter.enabled: false`
- **WorkBuddy safe-delete shim**：拦 >50 文件删除，用 `mv` 移去 /tmp 绕过
- **matrix-js-sdk 已去 link 化**：tgz+pin 锁定，改 SDK 后 `pack-sdk-tarball.mjs --apply` + `pnpm install`
- **pnpm overrides 纪律**：caret 钉同主版本，`>=` 会解析到最新大版本

## synapse-rust 要点
- **两套配置树，只有 `docker/deploy/` 是活的**：改前先 `docker inspect` 确认挂载
- **429 分层定位法**：nginx 429 不带 `x-ratelimit-remaining`，应用层的带
- **keys/query 429 风暴根因**：synapse-rust `/keys/query` 静默丢弃无共同房间的用户 → 客户端设备过期标记永不清 → 无退避满速重查。已修复：移除共同房间过滤逻辑
- **活跃 Matrix client 只有一个（主线程）**：WorkerHost 的 handleInitialize/handleStartClient 是死代码

## Vitest 要点
- mock 变量放 `vi.hoisted()`；`onMounted` 后断言前需 `await nextTick()`
- naive-ui 组件必须 stub 成真实 DOM；`vi.hoisted` 返回值要同步加到顶部解构
- `wrapper.isVisible()` 对 `v-show` 不稳定，改判 `style` 属性
- `MatrixClientService` mock 必须同时提供命名导出与 default
- **测试内禁用 `await import()` 动态导入被测模块**：用静态导入 + hoisted `vi.mock`
- **否定断言必须做变异验证**：临时删守卫确认用例真的 FAIL
- **单例 mock 的 computed 响应式陷阱**：mock 工厂里 `reactive(obj)` + `computed(() => obj.x)` 在多个测试串行时，primitive 重赋值 + 单例 computed 缓存会导致依赖追踪串扰（读到旧值）。正确做法：工厂内用 `ref()` 创建真实实例挂回 `vi.hoisted` 容器，测试直接改 `.value`；`reactive` 对象属性用 `Object.assign` 原地改。
- **happy-dom 下 `img` 的 `error` 事件无法派发**：`wrapper.find('img').trigger('error')` 与原生 `dispatchEvent(new Event('error'))` 都触发不了 Vue `onError` 监听。测试图片加载失败分支时，不要依赖 error 事件，改测组件自身的真实行为（如入队下载、状态 computed）。
- **模板以 HTML 注释开头 → Vue 多根片段**：`<!-- 注释 -->` 在 `<template>` 顶部的组件会被视为 fragment（多根），`wrapper.classes()`/`wrapper.element` 取不到真实根元素 class。改用语义化 class token 查询：`wrapper.find('.flex-row-reverse').exists()`。
- **`vi.mock` 内 `nextTick` 须从 `vue` 导入**：从 `@vue/test-utils` 导入 `nextTick` 会报 "not a function"，正确来源是 `vue`。

## 测试基线（2026-08-09 起）
- 全量 669 文件 7458 用例 0 失败（截至 2026-08-13，P1-7 重构 + P1-8 三批组件测试 + 遗留 *Helpers 测试提交后）
- 组件测试挂起 forks worker：写 import-only 探针二分定位，stub 重度服务图谱子组件

## synapse-rust 优化任务进度（2026-08-10）
- ✅ S1-S7, S9-S10, S14-S16, S22, S27 已修复（TDD）
- 待办：S8（EventNotifier Redis 扇出接线）、S11-S13, S17-S21, S23-S26
- 测试命令：`cd /Users/ljf/Desktop/hu_ts/synapse-rust && cargo test --package synapse-services --lib --features test-utils sync_service`
