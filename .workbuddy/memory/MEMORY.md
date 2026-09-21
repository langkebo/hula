# 项目长期记忆 — Tjg (HuLa IM)

## 铁律
- **禁 `git add -A`/`.`**（常驻并行 WIP）：一律 `git commit -m "msg" -- <显式路径>`；提交后 `git merge-base --is-ancestor <sha> HEAD` 复核
- **Bash `grep` 在本仓会假阴性**（不认 `\s`）→「找不到」必须用 Grep/ripgrep 复核。已 4 次致误判，末例：查 lockfile 顶层块写成 `^  overrides:`（多两空格）而漏
- 归属取证：`git worktree add --detach /tmp/head HEAD` + symlink node_modules
- **禁纸面测试**：守卫/否定断言改动必须构造变异确认会 FAIL。改 `.vue` 后 `prettier --write`
- 同一文件多处 Edit 不可并发 → 串行 + 读回
- **基线**：vue-tsc 0 错 · biome 0 error/2 info · ratchet(31/68/3/0/5/85，inline_style 5 全属 n-popover allowlist) · i18n-refs unresolved 273（基线 280）/fallback 7

## pnpm（版本漂移；详见 skill `pnpm-allowbuilds-version-drift`）
- 版本漂移已消除：本机与 CI 同钉 **pnpm@12.4.1**（packageManager 字段），alternating install 不再重写 lockfile
- `allowBuilds` 是构建审批唯一事实源（v10.26 引入，v11 取代 `onlyBuiltDependencies` 等）；`set this to true or false` 是 pnpm 自动写的占位符
- **依赖新鲜时 install 整段跳过**（含审批检查）→ 验证必须 `--force`（`--dry-run` 也不查）
- **禁用旧版 pnpm 对高版本 lockfile 跑 `--force`**：先删后链，失败留残骸（`typescript`/`.bin/vue-tsc` 消失 → npx 抓错版本）
- 后果：CI `--frozen-lockfile` 报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`（pnpm12 抹掉 lockfile 顶层 `overrides:` 块，pnpm10 仍读 package.json）→ 建议 `packageManager` 钉版本

## 项目约定
- commitlint scope: core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri；**管理后台用 `ui`**。token 前缀 `--tjg-*`
- i18n：文件名即命名空间，**首段要剥掉**；占位符 **`{name}`**（`{{name}}` 会渲染成 `{值}`）
- **组件测试的 vue-i18n 桩必须用 `createI18nMock()` 读真实语言表**，禁手写 key→文案 map（=自洽桩）；内容缺口走 `createI18nMock({provisional})` + `sourceRefs` 白名单
- `i18n.d.ts` 由 `scripts/generate-i18n-types.mjs` 生成；并行 WIP 在场时只提交「HEAD 语言表+自己的键」
- 测试写法见 skill `vue-component-testing`

## 静默失效陷阱（不报错、测试照常绿）
1 SFC 默认导出禁 `import type`（→HTMLUnknownElement） 2 共享 partial 裸全局类名经 `@use` 泄漏 3 BEM 复合=死选择器 4 模板首行禁 HTML 注释 5 模板重复静态属性（vue-tsc 失明） 6 **自洽桩**（桩抄源码错键→互证；已 4 例） 7 `.select-text` 桌面端不全局可达，跨组件复用须各自 scoped 声明
- **守卫阈值不可设在反模式存量上**（带刺棘轮）；夹具写在守卫文件内会被收集器当真实桩键扫走 → 排除本文件
- 注释里的字面量会误触棘轮计数（`style="..."` / `_matrix`）

## 设备查询契约（铁律）
- 统一走 `DeviceKeysManager.getUserDevices(userId)` → `POST /keys/query`（**唯一**能查他人设备的端点）。**禁 `GET /devices`**（只查自己）
- 移动端不开放设备管理面板；写操作仅限管理后台
- `GET /device_trust` 只返回 `{device_id, trust_level}` 无 user_id → 只能按 device_id 索引

## 联邦身份 / 消息信任
- 禁组件自解析 MXID → `utils/userIdentity.ts`（`toLocalpart`/`extractServerName`/`sameHomeserver`/`resolveFederationPeer`）；无法判定按本地
- `DeviceVerifyDialog`：`userId` 缺省=本机其它设备；单例挂 `ChatMain.vue` 经 `useDeviceVerifyLauncher`，**别挂 `renderMessage`**；跨用户 `targetDeviceId` 不得回退本机
- 锁态映射**只允许**在 `useMessageTrust.ts`（已修假安全信号）；`MessageLockBadge` 的 `&--interactive` 不得声明 color
- 裸 `liquid-glass(...)` 须跟 `@include liquid-glass-fallback`

## 其他
- 禁解构 class 单例方法（丢 `this`）；全仓只有一个 `ChatMain.vue`，移动端共用
- 设置页 `onMounted` 先 `await matrixClientService.waitForClientReady({timeoutMs:10000})`
- `loginWithToken` 须在首次 initialize 前定好 deviceId；createRoom 的 Space 需 `room_types:['m.space']`
- **未完成任务与 UI 优化进度明细见 `UI-OPTIMIZATION-PLAN.md`**
