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

## 本地 SDK 重新集成（`vendor/matrix-js-sdk.tgz`）
- 判据只看 **`sdk_lib_fingerprint`**：同版本号不同内容时，`tarball_sha256` + version 字符串都拦不住（`scripts/sdk-lib-fingerprint.mjs` 文档 §N-05）
- 采集本地 SDK 事实：`git -C ../matrix-js-sdk log -1`、`pnpm --version`（SDK 目录=10.29.3，Tjg 目录=12.4.1，corepack 按各自 `packageManager` 切换）
- **打包必须加 `npm_config_ignore_scripts=true`**：`pnpm pack` 会触发 SDK 的 `prepare` = `husky && pnpm build` → `rimraf lib` 被 WorkBuddy 安全删除 shim 拒（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，2496 文件 > 阈值 50）。lib 已新鲜时跳过正合适。命令：`npm_config_ignore_scripts=true node scripts/pack-sdk-tarball.mjs --apply --allow-commit-drift`（pin 陈旧时需 `--allow-commit-drift`）
- **⚠️ pnpm 对 `file:` tarball 有静默捷径**：lockfile 已有 resolution 时，换掉 `.tgz` 后 `pnpm install` **不重读本地文件、不更新 integrity**，静默装回旧内容（本次实测：install 报 `+ matrix-js-sdk` 成功，但指纹仍是旧的）。修法：定点改写 lockfile 里该条 `resolution.integrity`（新值 = `sha512-` + tarball 的 sha512 base64；`grep -c` 确认恰好 1 处）→ 删 `node_modules/.pnpm/@langkebo+matrix-js-sdk@*` 与软链 → `pnpm install`（会耗时数十秒，短于 3s 即说明没真解包）
- 收尾门禁：`TJG_SDK_DIR=<abs sdk path> pnpm verify:sdk-pin`（不带该变量会有 2 段 SKIP，不算 pass）+ `pnpm check:sdk-types` + `pnpm typecheck`
- 提交：`meta/sdk-pin.json` + `pnpm-lock.yaml` + `vendor/matrix-js-sdk.tgz` **三者必须一起提交**

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

## check:file-size 判据（易误解）
- 约束是「**不得超出基线**」，**不是**「一律 ≤400」：基线内文件只需回到基线，仅**新文件**才是 400 硬限
  （还有 800 红线 / 1000 临界，以及 `CRITICAL_EXEMPTIONS` 白名单）
- 因此为凑行数把文件切碎是错的；只在「职责内聚 + 能整块搬走」时才抽模块，否则压冗余注释即可
- **lint-staged 的 prettier/biome 会二次改行数**（实测 509→517、496→487）⇒ 门禁必须在**提交后**再复核一次
- 新模块直接 `import from 'matrix-js-sdk/<subpath>'` 会被 `check:sdk-boundary` 判**新增违规**
  ⇒ 先把类型补进 `src/services/matrix/sdk.ts` 桶，再从 `../sdk` 导入
- `scripts/contract-coverage-map.json` 重扫后是多行格式，biome 要求单行 ⇒ 必须 `biome check --write`，
  否则 `pnpm lint` 红但 `check:contract-coverage` 仍绿（易误判）

- **好友 DM 创建必须走 `createFriendDmRoom`（服务端 `POST /friends/dm/{uid}`）**：
  只有服务端会写 `m.room.encryption`（B-1）与 Megolm 轮换参数（B-6），客户端 `startDirectRoom` 用的是 SDK 默认值。
  ⚠️ `createPrivateDm` 的默认参数是 `isPrivate = true` ⇒ 普通「发消息」必须显式传 `false`，
  否则会被打成私密会话（多写 `com.hula.privacy` + `history_visibility=invited`）。

## 私密聊天 / 隐私域铁律（2026-10-17 审计后）- **后端 burn 永不 redact**（只登记 per-user 时间，物理删除归 retention）⇒ 前端「已焚毁」只能是本地遮罩，
  文案不得暗示服务端已删。依据：`burn_after_read_service.rs:110-119`、commit `57edb25b0`
- **「服务端不留存」只能靠 to-device 兑现**（`get_and_delete_messages` 读后即删 + Olm 双棘轮），
  房间事件永久存储且 Megolm 无 break-in recovery ⇒ 私密消息通道必须建在 to-device 上
- **`retention` 只在 `/_synapse/admin/v1`**，普通用户/房管无法设房间 TTL ⇒ 私密房间承诺「N 天后消失」
  必须先加 vendor 端点
- **设备信任的唯一事实源是本地 crypto store**（`getDeviceVerificationStatus`），`/keys/query` 响应没有信任字段
- **设备验证的唯一可比对内容是 SAS（emoji/decimal），不是设备指纹**：
  `getDeviceFingerprint` 只对本机设备有值、对他人恒 `null` ⇒ 用它做跨设备验证=假安全。
  ⚠️ **SAS 要等对端接受才产生**（`startSasVerification` 只发请求）⇒ 必须用
  `MatrixVerificationService.waitForSasView(txId, {shouldAbort})` 轮询等待，拿不到就失败、**不降级**。
  ⚠️ `useEncryption` 里**禁止** `xxx: matrixVerificationService.method` 这种解构（丢 `this`，
  那些方法内部都调 `this.getVerificationClient()`）⇒ 一律箭头包装。
- **消息信任缓存必须带账号维度**（`messageTrustCache.senderCacheKey` = `${accountUserId}:${senderId}`），
  登出调 `clearSenderDeviceCache()`；缓存模块**不得 import 任何矩阵服务**（否则 auth→composable→client→auth 循环）。
- **验证流程禁止降级**：取不到 SAS 时必须失败，不得回退到「设备指纹」（`getDeviceFingerprint` 只对本机返回值，
  对他人设备恒 null，用它做跨设备验证 = 假安全信号）
- **`senderDeviceCache` 必须带账号维度并在登出清理**，否则换账号后绿锁残留
- **Matrix 协议不可达**（不得写进产品承诺）：无全局标识符、服务端不可见社交图、房间消息真删除、
  阻止截屏、跨服匿名
- 三端契约一致性坑：DM 判定 SDK 有「2 人房即 DM」启发式而后端只看 `m.direct`；
  `is_private` 参数前端发、SDK 不发、后端不读（死参数）
- **私密聊天密码门：已修复（2026-10-17 执行 P0-0），历史缺陷供回溯**
  历史三处断裂：① `passwordHash` 被 `persist.omit` 排除导致重启失效；② `/secretChat` 无路由守卫；
  ③ `secret-chat-unlocked` 是孤儿事件。**现均已修**：
  - 哈希持久化（PBKDF2 verifier，可落盘）；dbKey 仅内存
  - `router.beforeEach` 里做私密门禁：未配置→提示挡回；未解锁→记 `pendingPath` + 弹 `SecretChatUnlockDialog`
  - `unlockSecretChat()` 直接写内存态 `secretChatSession`，不再依赖事件
- **私密房间 = `privateRoomRegistry`（account data `com.hula.private_rooms`）**，不是 `session.hide`；
  `isPrivateRoom()` 同步读 localStorage 缓存（`registryVersion` ref 驱动 computed 重算）。
  普通列表（桌面 `useMessageSessionFilters` / 移动 `useMobileSessionList`）必须排除私密房。
- **解锁态刻意不用 pinia**（`secretChatSession.ts` 是模块级单例 + ref）：dbKey 不能进 devtools / 持久化快照
- **密码即密钥**：PBKDF2-SHA256 600k 派生 32B，前 16B `verifier` 落盘、后 16B `dbKey` 仅内存，锁定 `fill(0)`
- **门禁必须挂在「具体房间」路由上，不是只挂 `/secretChat`**（`router/secretChatGuard.ts`）：
  好友发消息 / 搜索 / 通知 / 独立窗口 / 手输 URL 全汇到 `/message/:roomId` 与 `/window/chat/:roomId`。
  ⚠️ 按 **route name 白名单**（`message`/`windowChat`）取 roomId —— `/room/:roomId` 是目录详情页，拦错。
  ⚠️ **`/chat/:roomId` 在本仓不存在**（`/chat` 是无参机器人路由），跳它会落 notFound；正确是 `{name:'message',params:{roomId}}`。
  ⚠️ 冷启动深链要先 `ensurePrivateRoomRegistryReady()`，否则 `getUserId()` 为 null 时读 anonymous 缓存 → 私密房被放行。
  ⚠️ **移动端另有一条独立门禁**：`/mobile/chatRoom/chatMain/:uid` 参数是**对端 uid**，桌面 `extractRoomId`
  只认 `message`/`windowChat` 的 `:roomId` ⇒ 整条路径绕过。改在布局层 `ChatRoomLayout` 调
  `useMobilePrivateRoomGate().assertAccess(uid)`；候选房间要 **currentSessionRoomId 与 uid 反查都看**
  （通知点击时前者可能还停在上一个普通房）。登记表加载失败时**不放行**。
- **私密标记只允许单聊**（`usePrivateRoomActions`）：群聊成员不可控，标私密=假承诺；写登记表后再同步  `session.hide` + Tauri `hide_contact_command` 作兼容镜像。私密会话**与好友 DM 共用房间**（取消标记内容回普通 DM）。
- **隐私能力文案只能写已实现行为**（P0-4/5 审计结论）：曾宣称「服务器不存储消息」「防截屏」，两者零实现。
  现状：私密模式清单 3 条（房间级 E2EE / 倒计时仅本机移除 / 截屏提示但**不能阻止**），
  文案统一走 i18n key（`privateModeFeatures` 返回 `textKey`，禁止在 composable 里硬编码中文）。
  焚毁文案同理：「已销毁」→「已在本机移除」（后端永不 redact）。
- **阅后即焚判定必须同时看两处**：房间级 state **或** `settingStore.burnDefaultEnabled`，
  逻辑在 `composables/chat/burnPolicy.ts`（纯函数，已单测）。历史上只读房间级 → 设置开关只写不读。

## 好友域结构（2026-10-17 起）
- `MatrixFriendService` 已瘦身为**查询门面**（16 个方法，FriendManager→REST 回退 + 错误归一 + 日志）
- 纯转发已删，改走三个单例（均从 `friends/MatrixFriendService.ts` 重导出，也可从 `services/matrix` 桶取）：
  - `matrixFriendSync` — `initialize`/`sync`/`stop`
  - `matrixFriendOperations` — 请求收发 / 解除关系 / 备注 / 显示名 / 状态
  - `matrixFriendGroups` — 分组增删改查
  - `on`/`off` 仍在门面，内部转发 `friendEventBus`
- `App.vue` 的 offlineQueue deps 键：`getFriendOperations`（原名 `getMatrixFriendService` 已改）
- ⚠️ **Batch D 删了门面纯转发方法后，凡 mock `matrixFriendService` 的测试都要复查**（已 3 例静默失败：
  FriendsSettings / MatrixContactService / FriendDetailsSections+SingleDetails）。组件改走 `matrixFriendGroups`
  后仍 mock 门面 → 真实单例被调用、断言不报错但目标函数从未被调用。
- 通知域：`MatrixNotificationService` 不再有 push rules/pushers 的 REST 封装，
  一律走 `MatrixPushService`（`getPushRules`/`deletePushRule`/`getPushers`/`addPushRule`）；
  仅 `setPusherByBody` 留在 Notification（含必填校验）
