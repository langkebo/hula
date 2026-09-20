# 项目长期记忆 — Tjg (HuLa IM)

## 铁律
- **禁 `git add -A`/`.`**：常驻并行 E2EE WIP → 逐文件 add，先 `git status --short`
- **Bash `grep` 在本仓会假阴性**（亦不认 `\s`）→「找不到」必须用 ripgrep 复核。**已两次致误判**：`RoomCard.vue` 被判「功能缺失」（实为 testid 不一致）、`RenderPollMessage.vue` 被判「不调用 `t('poll.*')`」（实为在用，背后是真实生产缺陷）
- **同一文件多处 Edit 不可并发**（只落一处）→ 串行 + 读回确认
- **基线**：vue-tsc 0 错 + vitest 全绿 + biome clean + `check:ratchet` 不升（color 31 / matrix_prefix 68 / ts_expect_error 3 / radius 0 / inline_style 285 / important_css 85）+ `check:i18n-refs`（unresolved 379 / fallback 7）
- **禁「纸面测试」**；**否定断言必须变异验证**。改完 `.vue` 跑 `prettier --write`
- **归属取证法**：`git worktree add --detach /tmp/head HEAD` + symlink node_modules → 同环境只换源码

## 项目约定
- commitlint scope: core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri；**管理后台用 `ui`**。设计 token `--tjg-*` 唯一前缀；新图标 Iconify
- i18n：文件名即命名空间，**首段要剥掉**（`setting.encryption.x` → `setting.json` 的 `{encryption:{x}}`）。占位符 **`{name}`**；写成 `{{name}}` 会渲染成 `{值}`（全仓仅 `poll.json` 曾中招）
- **组件测试的 `vue-i18n` 桩必须读真实语言表**：用 `createI18nMock()`（`tests/i18n-messages.ts`），**禁止手写 key→文案 map**（= 自洽 stub，会掩盖错键）。内容缺口用 `createI18nMock({ provisional })` 并同步 `sourceRefs.test.ts` 白名单
- i18n.d.ts 由 `scripts/generate-i18n-types.mjs` 生成；含并行 WIP 新增键时随代码一并提交

## 静默失效陷阱（共同点：不报错、测试照常绿）
1. **SFC 默认导出严禁 `import type`** → 运行时 `undefined` → 降级为 HTMLUnknownElement。信号：tagName 小写 + `HTMLUnknownElement` + `classes()/attributes()` 全空
2. **共享 partial 裸全局类名经 `@use` 泄漏**（emit 成全局规则）。修法：规则移进真正需要它的组件 scoped 块
3. **BEM 复合 = 死选择器**（`.block__icon.block--verified`）：配色失效而测试照常绿
4. **模板不得以 HTML 注释开头** → 变多根片段，`wrapper.element`/`classes()` 落空
5. **模板重复静态属性** → `SyntaxError: Duplicate attribute`，vue-tsc 完全失明。守门：`design-baseline.test.ts`「模板属性卫生」
6. **自洽 stub**：桩照源码错键抄 map → 互证、语言表被架空。已检出三例，末例是**真实生产缺陷**

## 联邦身份 / 设备验证
- 禁止组件自行解析 MXID → `utils/userIdentity.ts`（`toLocalpart`/`extractServerName`/`sameHomeserver`/`resolveFederationPeer`/`normalizeMatrixUserId`；无法判定按本地处理）
- `DeviceVerifyDialog` props `{show, userId?, deviceId?, deviceName?, inboundRequest?, initialMode?}`；`userId` 缺省=本机其它设备，指定=验证他人（经 `matrixDeviceService.getUserDevices` → `keys/query`；**不能用 `GET /devices`**）
- 跨用户时 **`targetDeviceId` 不得回退本机 deviceId**。单例挂载点 `ChatMain.vue`，经 `useDeviceVerifyLauncher`；**别挂 `renderMessage`**
- `useEncryption.requestUserVerification(userId)` → `startSasVerification(userId,'')`：**建议整体删除**（`useDeviceVerifyLauncher` 已是正确替代），属并行 WIP

## 液态玻璃 / 消息信任
- `-panel`/`-subtle` **自带** `low-perf` 降级；裸 `liquid-glass(...)` 须跟 `@include liquid-glass-fallback;`。降级类由 `utils/performanceTier.ts` 写 `html.low-perf`；`backdrop-filter` 仅面板级 ≤3
- 锁态映射**只允许**在 `useMessageTrust.ts`。`trustLevel` 对已加密消息**恒返回 `verified`** → `unverified`/`risk` **不可达**。`MessageLockBadge` 的 `&--interactive` **不得声明 color**

## 其他易错点
- 禁止解构 class 单例方法（丢 `this`）；全仓只有一个 `ChatMain.vue`（`rightBox/chatBox/`），移动端共用
- 设置页 `onMounted` 先 `await matrixClientService.waitForClientReady({timeoutMs:10000})`；Tauri `resource id invalid` = 请求取消竞态
- `loginWithToken` 须在首次 initialize 前定好 deviceId；createRoom 的 Space 必须 `room_types:['m.space']`
- pnpm overrides 用 caret 钉同主版本；matrix-js-sdk 已去 link 化（tgz+pin）
- **测试写法细节见 `vue-component-testing` skill**（`vi.hoisted` / naive-ui stub / `resolve(__dirname,'..','X.vue')` / 循环 `exec` 必须带 `g`）

## UI 优化进度（明细见 `UI-OPTIMIZATION-PLAN.md`）
- P1 收敛：`border-radius` 硬编码 19→0、核心视图内联 style 清零、`!important` 116→91→**85**（20 处 reduced-motion 合规保留）、棘轮门禁 4 项入基线
- i18n：`unresolved` 503→414→**379**（修 111 处调用点 + 3 处 poll 键），`i18n.d.ts` 已重生成 + 新鲜度守护用例 + 桩键可达性门禁
- 已证伪旧待办：「移动端 SyncStatusBar 复用」「SSSS 备份引导页」「useDeviceSessionPanel」「RoomCard 联邦徽章功能缺失」。待办：`encryption.backup_restore_dialog.*` 32 键内容缺口（需产品文案）、`biome check` 3 个**既有** error、!important 剩余 65 处需浏览器回归