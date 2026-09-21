# 项目长期记忆 — Tjg (HuLa IM)

## 铁律
- **禁 `git add -A`/`.`**：常驻并行 WIP → 逐文件 `git add`，先 `git status --short`
- **工作区有并发会话时禁批量提交**（2026-09-21 实证）：同一 working tree 下另一会话在跑 `git add`/`commit`/**`reset`** 时——共享 `index` 会把我 `add` 的文件**吞进对方提交**；`.git/COMMIT_EDITMSG` 被对方覆盖会让我的提交**信息张冠李戴**（内容对、信息错）；对方的 `git reset` 会**回退掉我已提交的批次**。防护：①一律 `git commit -m "msg" -- <显式路径>`（pathspec 模式让钩子只见我的路径，不会吞对方暂存）；②提交后 `git merge-base --is-ancestor <sha> HEAD` 确认仍在祖先链；③大批量改动前 `cp` 一份工作区副本到仓外；④**最稳：先让对方会话停下再提交**
- **Bash `grep` 在本仓会假阴性**（亦不认 `\s`）→「找不到」必须用 Grep/ripgrep 复核。**已三次致误判**（`RoomCard.vue` 联邦徽章实际存在 / `RenderPollMessage.vue` 实际在用 `t('poll.*')` / FederationBadge testid 不一致）
- **同一文件多处 Edit 不可并发**（只落一处）→ 串行 + 读回确认
- **基线**：vue-tsc 0 错 + vitest 全绿 + biome clean + `check:ratchet` 不升（color 31 / matrix_prefix 68 / ts_expect_error 3 / radius 0 / **inline_style 5（全属 n-popover 具名 allowlist）** / important_css 85）+ `check:i18n-refs`（unresolved 379 / fallback 7）
- 归属取证法：`git worktree add --detach /tmp/head HEAD` + symlink node_modules
- 禁「纸面测试」；否定断言必须变异验证（守卫类改动改完要构造变异确认会 FAIL）。改完 `.vue` 跑 `prettier --write`
- **自洽桩**：桩照源码错键抄 map → 互证、语言表被架空。已检出三例，末例是**真实生产缺陷**（RenderPollMessage） → 同环境只换源码
- **注释里的字面量会误触棘轮计数**：`style="..."` → inline_style、`/_matrix` → matrix_prefix。写注释要避开这些形态

## 待办/决策遗留
- `biome check` 3 error 全部 HEAD 既有（MatrixEncryptionContextService.test.ts + matrix-extensions.d.ts + auth.contract 已修）
- `encryption.backup_restore_dialog.*` 32 键语言表已补齐（b10d6b5d）
- 未读数/同步状态条/设备面板双端取数/UserIdentity.vue/SSSS 文案/message.scss 共享 partial 泄漏/inline_style+important_css 专项下降/i18n.d.ts 随 WIP/requestUserVerification 删除
- `poll.json` 占位符已修（Handlebars `{{}}` → `{count}`）

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
7. **`.select-text` 桌面端不全局可达**：其 `!important` 定义仅在 `styles/scss/render-message.scss:252`，`@use` 点为 `renderMessage/index.vue`（**scoped**）+ `MobileChatMain.vue`（global，**仅移动端**）。跨组件复用**必须**在各组件 scoped 块内自行声明 `.select-text`。同类症状：模板 class 改名而 CSS 选择器没同步 → 保护静默失效
8. **内联样式迁移的两种「不该迁」**：①`n-popover/n-scrollbar/n-flex` 的 `style=` 是组件参数，UnoCSS `.p-0` 同特异性受注入顺序影响（慎迁）；②`display:none` 等可能被 JS 改写（先查 JS）。UnoCSS 任意值有先例：HEAD 801 处 `{w,h,max-w,max-h,text,p,border}-[...]`

## 联邦身份 / 设备验证
- 禁止组件自行解析 MXID → `utils/userIdentity.ts`（`toLocalpart`/`extractServerName`/`sameHomeserver`/`resolveFederationPeer`/`normalizeMatrixUserId`；无法判定按本地处理）
- `DeviceVerifyDialog` props `{show, userId?, deviceId?, deviceName?, inboundRequest?, initialMode?}`；`userId` 缺省=本机其它设备，指定=验证他人（经 `matrixDeviceService.getUserDevices` → `keys/query`；**不能用 `GET /devices`**）
- 跨用户时 **`targetDeviceId` 不得回退本机 deviceId**。单例挂载点 `ChatMain.vue`，经 `useDeviceVerifyLauncher`；**别挂 `renderMessage`**
- `useEncryption.requestUserVerification(userId)` → `startSasVerification(userId,'')`：**建议整体删除**（`useDeviceVerifyLauncher` 已是正确替代），属并行 WIP

## 设备查询契约（铁律）
- **统一到 keys/query**：所有设备查询必须通过 `DeviceKeysManager.getUserDevices(userId)`（SDK 层封装 → `POST /keys/query`）。这是**唯一能查他人设备的端点**。
- **禁止 GET /devices**：`GET /devices` 只能查当前用户自己（路径无 `{user_id}`），用它做第三方查询会让好友设备列表恒为空。已在 `CryptoDeviceAdapter` 与 `MatrixDeviceService` 中收口。
- **移动端设备不需要管理面板**：移动端用户自己的设备列表仅用于展示（如好友详情页），不开放「管理面板」UI（编辑 display_name、屏蔽等操作）。
- **管理面板仅限管理员**：如未来需要设备管理功能（屏蔽/注销等写操作），仅允许在「管理后台」或「管理员专属页面」中提供，普通客户端用户不可见。
- 信任等级来源：`GET /device_trust` 只返回 `{ device_id, trust_level }` 无 user_id，**只能按 device_id 建索引**，不能按 user_id 过滤。

## 液态玻璃 / 消息信任
- `-panel`/`-subtle` **自带** `low-perf` 降级；裸 `liquid-glass(...)` 须跟 `@include liquid-glass-fallback;`。降级类由 `utils/performanceTier.ts` 写 `html.low-perf`；`backdrop-filter` 仅面板级 ≤3
- 锁态映射**只允许**在 `useMessageTrust.ts`。已修复假安全信号：trustLevel 恒返回 verified → 接入 `matrixDeviceService.getUserDevices()` 查询真实设备验证状态 + effectScope 30s 自动刷新 + 'unverified' 安全默认值。`MessageLockBadge` 的 `&--interactive` **不得声明 color**

## 其他易错点
- 禁止解构 class 单例方法（丢 `this`）；全仓只有一个 `ChatMain.vue`（`rightBox/chatBox/`），移动端共用
- 设置页 `onMounted` 先 `await matrixClientService.waitForClientReady({timeoutMs:10000})`；Tauri `resource id invalid` = 请求取消竞态
- `loginWithToken` 须在首次 initialize 前定好 deviceId；createRoom 的 Space 必须 `room_types:['m.space']`
- pnpm overrides 用 caret 钉同主版本；matrix-js-sdk 已去 link 化（tgz+pin）
- **测试写法细节见 `vue-component-testing` skill**（`vi.hoisted` / naive-ui stub / `resolve(__dirname,'..','X.vue')` / 循环 `exec` 必须带 `g`）

## UI 优化进度（明细见 `UI-OPTIMIZATION-PLAN.md`）
- **inline_style 285→5 已收口**（2026-09-21，7 次提交：admin / 加密 / robot / mobile / 布局 / 其余组件+窗口 / 基线收紧）。剩余 **5 处全为 n-popover 组件参数**（`ChatSidebar.vue` / `renderMessage/index.vue` / `LeftAvatar.vue` / `definePlugins/Card.vue` / `definePlugins/List.vue`），已在 `scripts/check-ratchet.mjs` 的 `INLINE_STYLE_ALLOWLIST` 登记为**已裁定例外 + 漂移守卫**，**勿再尝试迁移**
- 本次迁移暴露并修好的 3 处静默回归（迁移把内联样式换成**没有定义的类名**）：`callWindow` 音频元素 `display:none`、`BotMessage` 气泡描边、`LockScreen` `<n-input>` 的 width/border/bg/color（naive-ui 的 `.n-input` 与 `:hover`/`--focus` 同特异性 → 用**双类名 `.lock-input.lock-input`** 提升特异性）。另修 `mobile/views/friends/index.vue` 重复 `<img` 开标签（模板语法损坏）
- P1 收敛：`border-radius` 硬编码 19→0、`!important` 116→91→**85**（20 处 reduced-motion 合规保留）、棘轮门禁 4 项入基线
- i18n：`unresolved` 503→414→**379**（修 111 处调用点 + 3 处 poll 键），`i18n.d.ts` 已重生成 + 新鲜度守护用例 + 桩键可达性门禁
- 历史完成：P0-3 锁徽章→设备验证接线（跨用户 targetUserId + 单例启动器 + 84 处 i18n 键修正）；P0 `useMessageTrust` 假安全信号修复（getUserDevices + 30s 刷新 + unverified 默认）；联邦标识 4/4 接入 FederationBadge（RoomCardItem / RoomCard / RoomPreviewDialog / ChatHeaderInfo）；AvatarCropper 圆角字面量归零；voice.ts 死常量 REGISTER_ENCRYPTED 清除
- 已证伪旧待办：「移动端 SyncStatusBar 复用」「SSSS 备份引导页」「useDeviceSessionPanel」「RoomCard 联邦徽章功能缺失」。待办：`encryption.backup_restore_dialog.*` 32 键内容缺口（需产品文案）、`biome check` 3 个**既有** error、important_css 85→60（7 个 settings-tabs reduced-motion 块提共享 partial + TjgSpaceTree 2 处）