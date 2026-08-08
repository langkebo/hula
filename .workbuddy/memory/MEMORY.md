# 项目长期记忆 — Tjg (HuLa IM)

## 项目约定
- commitlint scope-enum 限定：core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri。**管理后台相关提交用 `ui` scope**（`admin` 不在允许列表）
- 设计 token 体系：`--tjg-*` 为规范前缀，`--color-*`/`--bg-*` 为旧别名（已于 2.6.3 全部迁移完毕，.vue 文件残留 0 条）
- 图标方案：SVG Sprite（`public/icon.js`，184 symbol，156 文件引用）+ Iconify（`@iconify/vue`，70 文件）双轨共存，不一刀切迁移；新界面默认用 Iconify，不再扩充 Sprite
- 内联 SVG 治理样板：`src/views/admin/icons/`（adminNavIcons.ts 路径表 + AdminNavIcon.vue 组件）
- TDD 验收基线：vue-tsc --noEmit (0 errors) + vitest run (全绿) + biome check (clean)

## 已知易错点（反复踩，2026-08-07 汇总）
- **禁止解构 class 单例方法**：`const { foo } = someService` 丢 `this` 绑定，方法内 `this.xxx` 变 undefined。必须 `someService.foo()`。排查 `undefined is not an object` 优先 grep 此模式。
- **设置页/加密对话框 onMounted 必须先 `await matrixClientService.waitForClientReady({ timeoutMs: 10000 })`**，catch 后降级本地缓存、不抛出。
- **Tauri `resource id invalid` / `Request cancelled` ≠ 网络错误**：是 plugin-http 的 rid 被 `fetch_cancel` 丢弃后的竞态表现，本质是请求被主动取消。处理原则：先查 `init.signal.aborted`，命中则归一化为 `AbortError`，**不回退浏览器 fetch、不重试**（否则会重放 SDK 已放弃的 `/sync` 长轮询，产生幽灵重复请求）。
- **设备 ID 持久化优先**：会话恢复走 `resolveStableDeviceId(config, clientGeneratedId)`（`MatrixClientService.ts` 模块级导出），否则 E2EE crypto store 失配。
- Vitest：mock 变量放 `vi.hoisted()`；`onMounted` 内改 ref 后、断言渲染前需 `await nextTick()`。
- **Vitest Vue 组件测试 4 易错点（2026-08-08 消息界面对齐实战）**：
  1. **naive-ui 组件必须 stub 成真实 DOM 才能保留点击/属性**：NButton 等用 `vi.mock('naive-ui', ...)` 整模块 stub 时，若返回空组件会丢 `@click`/`attrs`；NButton 应 stub 为 `<button><slot/></button>`（见 `ChatMsgMultiChoose.test.ts`）。
  2. **`vi.hoisted` 返回值里的 mock 变量必须同步加到顶部 `const { ... } = vi.hoisted(...)` 解构**，否则 `beforeEach` 引用即 `ReferenceError`（曾因只加到 return 对象、漏掉解构导致 7 个测试全挂）。
  3. **`@vue/test-utils` 的 `wrapper.isVisible()` 对 `v-show` 设的 `display:none` 判定不稳定**（实测返回 true）。改判 `wrapper.attributes('style')` 含 `'display: none'`，或直接断言 `element.style.display`。
  4. **`MatrixClientService` mock 必须同时提供命名导出 `matrixClientService` 与 `default`**：因 `MatrixSpecialFriendService.ts` 用 `import x from '../MatrixClientService'`（default import），且模块加载时实例化 `new MatrixSpecialFriendService()` 触发 `getClient()`；只给命名导出会报 "No default export is defined"。
- **i18n 注册陷阱**：`locales/{lang}/*.json` 文件名即 vue-i18n 顶层命名空间键（i18n.ts 第 237 行 `Object.fromEntries(modules)`）。故 `home.json` 内顶层键（如 `chat_sidebar`）在组件里要用 `t('home.chat_sidebar.x')` 而非 `t('chat_sidebar.x')`；直接读 JSON 文件的 `d['home']` 会得到 undefined（易误判 key 缺失）。

## 既有失败测试（非回归，勿误判）
`HomeserverDialog` / `RoomDetailPane` / `MatrixFriendService` / `MatrixDelayedEventsService` 共 15 例长期失败（截至 2026-08-07 全量 6796/6811 通过）。改动前后对比时请排除这 4 个套件。

## 技术栈要点
- 前端：Vue 3 Composition API + `<script setup lang="ts">` + Naive UI + UnoCSS + Pinia + vue-i18n
- 后端：Tauri v2 + Rust + SQLite (SeaORM) + Matrix 协议 (synapse-rust + matrix-js-sdk)
- Matrix SDK 运行在 Web Worker (`src/workers/matrixSdk.worker.ts`)，主线程 <50ms 约束
- 管理后台服务层：`adminService` facade 委托子服务，组件不直连 SDK

## 无障碍
- `prefers-contrast: more` 媒体查询已落地于 `src/styles/css/design-tokens.css`（浅色/暗色分别覆盖）
- a11y 测试：`e2e/a11y-baseline.spec.ts`（axe-core，grep `@a11y`）
- **已知对比度违规**（见 docs/原型对齐优化方案-2026-08-05.md Task 1/2，待修）：暗色 `--tjg-text-tertiary #707070` 3.65:1、`--tjg-text-quaternary #595959` 最低 1.8:1、发送气泡 `#13987f` 白字 ~2.6:1，均不达 AA 4.5:1

## 技能库（~/.workbuddy/skills/，2026-08-05 安装）
- 前缀约定：`sp-`=Superpowers（14）、`mp-`=MattPocock（37）、`gs-`=gstack（54），共 105 个
- gstack 的 setup 脚本不可运行（会写 ~/.codex 等其他工具目录）；其 /qa、/browse 技能依赖自带浏览器二进制，WorkBuddy 环境不可用
- 新装技能需重启会话才被 Skill 工具识别；急用可直接 Read 对应 SKILL.md 执行
- 关键计划文档：`docs/原型对齐优化方案-2026-08-05.md`（TJG-prototype.html 四维度对齐，12 Task，21T）
