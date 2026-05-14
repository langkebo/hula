# HuLa 前端 ↔ synapse-rust (`https://matrix.test`) 连接全面诊断与优化方案

- 编写日期：2026-05-06
- 适用代码库：`/Users/ljf/Desktop/hu_ts/hula`
- 后端：`https://matrix.test`（`langkebo/synapse-rust` Matrix Homeserver）
- 触发现象：登录账号 `hulatest`（displayname `test6`）后，HuLa 个人信息卡显示「离线」、`所在地 未知`、`暂无会话`，且不同位置出现 `test6 / hulatest / @hulatest:matrix.test` 三种用户名表达。
- 修复策略：以打通真实交互为目标，**后端 synapse-rust 暂不支持的功能在前端做改造或删除**，避免假数据继续误导用户。

---

## 0. 实施进度（2026-05-06 更新）

| 阶段 | 范围 | 状态 |
|---|---|---|
| **P0** | 截图直修 F1-F5：离线状态、用户名统一、`startPresencePipeline`、UI 假数据（LeftAvatar / InfoPopover）、等 sync PREPARED | 已完成 |
| **P1** | SlidingSync 首屏改 `[[0, 49]]`；`required_state` 加入 `m.room.create` / `m.room.power_levels`；to_device / account_data / typing / receipts / e2ee 扩展由 `SlidingSyncSdk` 自动注册（无需手动声明） | 已完成 |
| **P2 (F6/F7)** | F6 dev proxy 跟随 `VITE_HOMESERVER_URL`，https 时 `secure: false`；F7 `.test` 域自签名已由 `runtimeFetch.ts` 处理 | 已完成 |
| **P2 (F8)** | 诊断工具接入 UI：`ConnectionStatusBanner` 新增"运行自检"按钮，点击触发 `MatrixDiagnostics.runAll()`，结果以 Naive UI 对话框形式呈现 | 已完成 |
| **P3** | 新建 `MatrixWsBridge`：桥接 `TOKEN_EXPIRED` / `MSG_RECALL` / `ROOM_INFO_CHANGE`；附 6 条 vitest 单测 | 已完成 |
| **P4 (F9)** | `MatrixWorkerHost` 骨架 + 登录 / 登出生命周期接入 + 增量 SDK 迁移：`ping` / `getServerVersions` / `getLoginFlows` / `probeSlidingSyncEndpoints` / `probeCors`，`MatrixDiagnostics` 全部 4 项检查均已走 worker（带主线程兜底）；附 15 条 vitest 单测 | 已完成（首批迁移；继续按 `request<T>` 模式增量补） |
| **P4 (F10)** | `usePresenceHeartbeat` 维持心跳；`MatrixRuntimeSessionService` 注册 `beforeunload` → `setPresence('unavailable')`；登出时同步 stop | 已完成 |
| **P5** | `RoomDetailPane` / `HulaRoomSummaryPanel` 的 `canEdit` / `canInvite` 改用 `room.currentState.maySendStateEvent` / `room.canInvite()` 真值；删除永远空的公告区块；`renderMessage/index.vue` 删除徽章弹层（被硬编码 `roomId === '1'` 锁死）和 `senderLocPlace`（永远空） | 已完成 |
| **P6** | 全量清理 `itemIds` / `wearingItemId` / `onlineNum`：从 `MatrixRoomMember`、`UserInfoType` 等类型定义中彻底删除；重构 `BadgeService.ts` 摆脱对 `userInfo` 依赖；清理所有 UI 组件（桌面 + 移动端）中的残留引用 | 已完成 |

PR-6 尾巴复核（本轮追加收尾）：

- `ChatSidebar.vue` / `useFriends` / `useFriendSearch` / `layout/left/hook.ts` / `SearchFriend.vue` / `AddFriends.vue` / `PersonalInfo.vue` / `NoticeList.vue` / `ChatSetting.vue` / `EditProfile.vue` 等组件中残留的 `wearingItemId` / `itemIds` / `onlineNum` 已全量清理。
- `BadgeService.ts` 已重构，改为完全依赖 Matrix `account_data` (`io.hula.badge.preference`)，不再依赖已删除的 `userStore.userInfo` 字段。
- **类型层面已彻底摘除**：`MatrixRoomMember`、`MatrixGroupInfo`、`UserInfoType`、`CacheUserItem` 等核心接口已不再包含 these 废弃字段。
- `locPlace` 在 QR 登录流程（`MatrixQrLoginService.ts` / `ConfirmQRLogin.vue`）中仍有实际用途，暂予保留。
- `vue-tsc --noEmit` 验证通过，无类型残留。

`vue-tsc --noEmit` 全量在改动文件上 0 错；`MatrixWorkerHost.test.ts` 15/15、`MatrixWsBridge.test.ts` 6/6、`RoomDetailPane.test.ts` 6/6 通过。

### Worker SDK 迁移进度（P4 续）

`MatrixWorkerHost` 已登记的方法（均带 `isStarted` 守卫，调用方未启动时退回主线程实现）：

| 方法 | 等价 SDK 调用 | 路由 | 调用方 |
|---|---|---|---|
| `ping()` | — | `postMessage` heartbeat | 内部冒烟 |
| `getServerVersions(baseUrl, accessToken?)` | `MatrixClient.getVersions()` | `GET /_matrix/client/versions` | `MatrixDiagnostics.checkVersions`、`MatrixCapabilityService.fetchVersions`、`MatrixAuthService.getVersions` |
| `getLoginFlows(baseUrl)` | `MatrixClient.loginFlows()` | `GET /_matrix/client/v3/login` | `MatrixDiagnostics.checkLoginFlows`、`MatrixAuthService.getLoginFlows` |
| `probeSlidingSyncEndpoints(baseUrl, endpoints[])` | — | 并行 `POST` 三条候选端点 | `MatrixDiagnostics.checkSlidingSyncEndpoint` |
| `probeCors(baseUrl)` | — | `OPTIONS /_matrix/client/versions` | `MatrixDiagnostics.checkCORS` |
| `getCapabilities(baseUrl, accessToken)` | `MatrixClient.getCapabilities()` | `GET /_matrix/client/v3/capabilities` | `MatrixAccountService.getCapabilities` |

`MatrixCapabilityService.refreshCapabilities` 与 `MatrixAuthService.{getVersions,getLoginFlows}` 已合并到同一组 worker 原语：登录后所有这些调用都走 worker；预登录（worker 未 start）退回各自原本的实现（`getRuntimeAwareFetch` / `client.http.authedRequest` / `createTemporaryMatrixClient`）。

由于 `bootstrapPostLoginState` 与 `logoutCurrentSession` 现在会调用 `matrixWorkerHost.start()` / `terminate()` 与 `matrixWsBridge.start()` / `stop()` 等真实生命周期函数，`MatrixRuntimeSessionService.test.ts` 已补齐对应 mocks（`@/hooks/usePresenceHeartbeat`、`@/services/matrix/MatrixWsBridge`、`@/services/matrix/MatrixWorkerHost`、`@/services/matrix/user/MatrixPresenceService`、`@/services/matrix/MatrixClientService`、`@/stores/domains/chat/contacts`），8/8 通过。

P4 后续复核结论（按原顺序回看）：

1. **`MatrixSearchService` 全文检索 / 索引构建**：仍是当前唯一值得继续推进的 worker 大项，但前提不是把现有 HTTP 调用简单包一层 worker，而是把索引数据结构和增量构建流程一起从主线程搬进 worker。该项属于结构性改造，应单列一个重构 PR，先明确索引所有权、主线程与 worker 的查询协议、增量同步与销毁策略，再实施。
2. **`mxcUrlToHttp`**：benchmark 已补完。基于 `matrix-js-sdk/src/content-repo.ts#getHttpUriForMxc()` 的本地测量，10k / 100k / 1M 次分别约 **1.62 µs / 1.84 µs / 1.85 µs 每次**；Node `worker_threads` 最小 echo 往返约 **23.3-38.6 µs/次**。换言之，线程往返仍比内联转换慢约 **12x-24x**，结论维持为**不迁移**。
3. **`MatrixAccountService.getCapabilities` (`GET /capabilities`)**：经代码复核，已完成 worker 接入；当前实现已与 `versions` 同属登录后能力探测批次，并保留 access token 透传与主线程 fallback。

### 暂缓或待 benchmark 的迁移候选

- **`MatrixSearchService`**：不再视为“无收益，直接放弃”。真正有收益的不是把现有 `/_matrix/client/v3/search`、`/user_directory/search`、`/publicRooms` 请求机械搬去 worker，而是把未来要引入的客户端索引结构、分词/归一化、增量更新逻辑整体下沉。只有做到“索引在 worker 内部常驻”，这项迁移才成立。
- **`mxcUrlToHttp`**：benchmark 已完成，结论收敛为“继续留在主线程”。该函数单次转换约 1.8 µs，当前媒体渲染路径又是同步 `src` 绑定；现有数据不足以支撑为它引入 Promise 化和线程往返复杂度。

后续候选（保留以备后用）：若上述 3 项完成后仍需继续优化，再评估把 `matrix-js-sdk` 的同步引擎本身（`SlidingSync` + 状态管理）整体下沉到 worker，作为独立大重构 PR 推进。

### 直连 `https://matrix.test` 行为级冒烟

需在本地起栈跑：
1. 登录后自己头像出现在线点；
2. 进入有/无管理员权限的房间，邀请按钮按真实 power level 显隐；
3. 服务端撤销 token → 触发 `TOKEN_EXPIRED` 流程；
4. 在另一客户端撤回消息 → HuLa 同步显示已撤回；
5. 在另一客户端改房间名/头像 → HuLa 不刷新页面就能看到；
6. 触发连接错误 → `ConnectionStatusBanner` 显示「运行自检」按钮 → 弹窗里 4 项诊断结果可读。

---

## 1. TL;DR

| 直接现象 | 第一根因 | 最小修复 |
|---|---|---|
| 永远「离线」 | `useOnlineStatus` 只看 `groupStore.getUserInfo(self)`，但自己永远不在任何 `membersMap` | 回退到 `userStore.userInfo` |
| `setPresence(online)` 没发 | `App.vue` 仅在旧 WS `LOGIN_SUCCESS` 事件下调用，Matrix 路径不发该事件 | 在 `bootstrapPostLoginState` 内显式调用 |
| 4 分钟后被服务端降级 unavailable | `startPresenceHeartbeat()` 全工程零调用 | 登录成功后启动、登出停止 |
| `test6 / hulatest / @hulatest:matrix.test` 三套 | `account` 字段三处赋值口径不同；`fetchUserProfile` 死代码 | 统一 localpart，登录后强制 `fetchUserProfile` |
| `所在地 / 9999+ / 动态 / 徽章` 全是假数据 | 字段在 SDK 同步路径里永远不被赋值 | 后端不支持时直接从 UI 删除或隐藏 |
| 暂无会话 | sliding sync 未 PREPARED 就 `loadRooms()` | 等 sync 进入 PREPARED 后再加载 |

修完上面 6 件，截图问题即可全部解决。其他系统性整改（worker、WS→Matrix 事件桥、CORS / 自签名）按 P1–P5 推进。

---

## 1. 问题 1：在线状态永远显示「离线」

### 1.1 直接断点

```@/Users/ljf/Desktop/hu_ts/hula/src/hooks/useOnlineStatus.ts:17-30
  const currentUser = uid
    ? computed(() => (uid.value ? groupStore.getUserInfo(uid.value) : undefined))
    : computed(() => {
        // 没有传入uid时，从groupStore获取当前用户信息以获得activeStatus
        const currentUid = userStore.userInfo?.uid
        return currentUid ? groupStore.getUserInfo(currentUid) : undefined
      })
  ...
  const activeStatus = computed(() => currentUser.value?.activeStatus ?? OnlineEnum.OFFLINE)
```

```@/Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/group.ts:164-169
  const getUserInfo = computed(() => (uid: string, roomId?: string) => {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return null
    const members = membersMap[targetRoomId] || []
    return members.find((m) => m.userId === uid || m.uid === uid) || null
  })
```

### 1.2 多重失效叠加

| # | 失效点 | 文件 | 后果 |
|---|---|---|---|
| 1 | 截图账号 0 房间 → `currentSessionRoomId === ''` → `getUserInfo` 永远返回 `null` | `group.ts:164-169` | `activeStatus` 走 `?? OFFLINE` |
| 2 | `loadRoomMembers` 硬编码 `activeStatus: OnlineEnum.ONLINE` | `group.ts:229` | 不读 presence，永远不准 |
| 3 | `applyPresenceToStores` 只回写 `groupStore` 成员；自己不在任何房间 → 永不被回写 | `App.vue:579-611` | self 永远 OFFLINE |
| 4 | `App.vue` 唯一调用 `setPresence('online')` 的地方挂在 WS `LOGIN_SUCCESS` 上 | `App.vue:179-232` | Matrix 登录路径不触发 |
| 5 | `usePresenceHeartbeat.startPresenceHeartbeat()` 全工程零调用 | `hooks/usePresenceHeartbeat.ts:57-78` | 5 分钟后被服务端降级为 `unavailable` |
| 6 | `SlidingSync.required_state` 不订阅 presence；`extensions` 没启 typing/receipts/account_data | `MatrixClientService.ts:233-269` | `User.presence` 事件不下推 |
| 7 | `MatrixPresenceService.attachPresenceListener` 仅在 `onPresenceChange` 调用后注册；正常路径不调用 | `MatrixPresenceService.ts:91-143` | 即便 SDK 收到 presence 也不会广播到 store |

### 1.3 前端兜底原则

- synapse-rust 已支持 `m.presence`（`PUT/GET /_matrix/client/v3/presence/{userId}/status`），无需删功能；只需把上面 7 个失效点串起来。
- 若后续 server 关闭 presence (`presence: false` in homeserver.yaml)：在 `MatrixPresenceService.setPresence` 内捕获 `M_FORBIDDEN` / 404 后**降级为本地 always-online**（仅显示自己 ONLINE，他人统一显示「未知」），并把好友列表里的小绿点全部隐藏，避免误导。

---

## 2. 问题 2：用户名 / 账号三处不一致

### 2.1 三个赋值源

```@/Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixRuntimeSessionService.ts:118-120
  private resolveDisplayName(uid: string, displayName?: string, account?: string): string {
    return displayName || account || uid.split(':')[0] || uid
  }
```

```@/Users/ljf/Desktop/hu_ts/hula/src/services/matrix/auth/MatrixRuntimeSessionService.ts:427-441
      const account = {
        uid,
        name: this.resolveDisplayName(uid, options.displayName, options.account),
        account: options.account || uid,
        ...
```

```@/Users/ljf/Desktop/hu_ts/hula/src/stores/domains/user/user.ts:128-142
    function initUserInfo(matrixUserId: string, displayName?: string) {
      userInfo.value = {
        uid: matrixUserId,
        name: displayName || matrixUserId.split(':')[0],
        account: matrixUserId,
        ...
```

```@/Users/ljf/Desktop/hu_ts/hula/src/stores/domains/chat/group.ts:217-232
        userId: m.userId,
        uid: m.userId,
        displayName: m.name || m.userId.split(':')[0],
        name: m.name || m.userId.split(':')[0],
        ...
        account: m.userId.split(':')[0]
```

### 2.2 不一致表

| 字段 | `userStore.userInfo` | `groupStore` 成员 | 截图实际 |
|---|---|---|---|
| `uid` | `@hulatest:matrix.test` | `@hulatest:matrix.test` | 顶部气泡内 |
| `name` | `test6`（来自登录表单 displayName） | `test6` 或 localpart | `test6` |
| `account` | `@hulatest:matrix.test` 或 username | localpart `hulatest` | `hulatest` |

### 2.3 死代码

`@/Users/ljf/Desktop/hu_ts/hula/src/stores/domains/user/user.ts:45-76` 定义了 `fetchUserProfile`，但 grep 全工程**零调用**（除测试），`/profile/{userId}` 永不命中，`matrixProfile` 永远为 null，`currentUserDisplayName` 也永远 fallback。

---

## 3. 与后端真实交互断点全清单（按域分组）

### A. Presence / 在线状态链

| 模块 | 路径 | 问题 |
|---|---|---|
| 在线心跳 | `src/hooks/usePresenceHeartbeat.ts:57-78` | `startPresenceHeartbeat()` 0 处调用 |
| 登录后置 presence | `src/services/matrix/auth/MatrixRuntimeSessionService.ts:403-457` | 不调 `setPresence`、不调 `fetchUserProfile`、不发 `LOGIN_SUCCESS` mitt |
| WS 事件桥 | `src/App.vue:179-232` | `LOGIN_SUCCESS` 仅旧 WS 触发，Matrix 路径不触发 |
| SlidingSync 订阅 | `src/services/matrix/MatrixClientService.ts:233-269` | extensions 缺 presence/typing/receipts/account_data |
| UserInfo 兜底 | `src/hooks/useOnlineStatus.ts:17-30` | self 不在 `membersMap` → 永 OFFLINE |
| loadRoomMembers 默认 status | `src/stores/domains/chat/group.ts:229` | 硬编码 ONLINE |
| presence 监听注册时机 | `src/services/matrix/user/MatrixPresenceService.ts:91-143` | 依赖外部先调用 `onPresenceChange` |

### B. Profile / 用户名链

| 模块 | 路径 | 问题 |
|---|---|---|
| `fetchUserProfile` 死代码 | `src/stores/domains/user/user.ts:45-76` | 0 处调用 |
| `account` 三处口径不一 | `user.ts:130-141` / `MatrixRuntimeSessionService.ts:427-441` / `group.ts:217-232` | localpart vs MXID vs displayname |
| in-room nickname | `group.ts:217-232` | 不区分 displayName 与 per-room nickname |
| avatar 取值 | `LeftAvatar.vue:117` 用 `userStore.userInfo?.avatar` | 登录表单不传 avatar，永远默认 H |

### C. 客户端启动 / 运行链

| 模块 | 路径 | 问题 |
|---|---|---|
| SDK Worker 未挂载 | `src/workers/matrixSdk.worker.ts:1-50` | 文件存在但 `new Worker(...)` 0 处 |
| SlidingSync rooms 集合 | `MatrixClientService.ts:238-249` | 只 `[[0,20]]`；0 房间时 PREPARED 后不再推 presence |
| `allowInsecureHttp` | `MatrixRuntimeSessionService.ts:216,273,350` | 仅 `http://` 时 true，自签 https 不降级 |
| dev 代理改写 | `src/services/backend/config.ts:107-142` | 只覆盖 `localhost:8008`，不覆盖 `https://matrix.test` |
| `fetchFn` 兜底 | `MatrixClientService.ts:198-206` | 非 Tauri 环境 fallback 后无 CORS / cookie 处理 |
| 诊断工具未串 UI | `src/utils/MatrixDiagnostics.ts:1-192` | 仅挂 `window.runMatrixDiagnostics` |

### D. 房间 / 会话链（"暂无会话"）

| 模块 | 路径 | 问题 |
|---|---|---|
| 会话列表加载时机 | `MatrixRuntimeSessionService.ts:425` | 不等 sync PREPARED 就 `loadRooms` |
| 房间成员预热 | `App.vue:230-231` | `refreshActiveGroupMembers` 依赖 `LOGIN_SUCCESS`（不会触发） |

### E. 离线消息 / WebSocket / 推送链（synapse-rust 不支持的 WS 事件）

| 旧 mitt 事件 | 文件 | synapse-rust 是否支持 | 处置 |
|---|---|---|---|
| `LOGIN_SUCCESS` | `App.vue:179-232` | 否（自研协议） | 改 Matrix 事件桥触发 |
| `MSG_RECALL` | `App.vue:234-236` | 否 | 用 `m.room.redaction` 替换 |
| `WS_MEMBER_CHANGE` | `App.vue:345-366` | 否 | 用 `RoomMember.membership` 替换 |
| `REQUEST_NEW_FRIEND` / `REQUEST_APPROVAL_FRIEND` | `App.vue:243-257,380-385` | 部分（synapse-rust 扩展） | 走 `MatrixFriendService` 自身事件 |
| `MY_ROOM_INFO_CHANGE` | `App.vue:238-241` | 否 | `RoomMember.name` 替换 |
| `ROOM_INFO_CHANGE` | `App.vue:387-396` | 否 | `RoomState m.room.name|m.room.avatar` 替换 |
| `MSG_MARK_ITEM` | `App.vue:368-378` | 否 | `Room.accountData` / 自定义 reaction 替换或删除 |
| `TOKEN_EXPIRED` | `App.vue:398-435` | 否 | 401 拦截 + `Session.logged_out` |
| `NOTIFY_EVENT` | `App.vue:259-262` | 否 | `MatrixNotificationService` |
| `VideoCallRequest` | `App.vue:163-177` | 否 | `MatrixCall` / `Call.incoming` |

### F. UI 假数据（**后端无对应字段，按方案删除或本地化**）

| UI 元素 | 文件 | 当前实现 | 后端是否提供 | 处置 |
|---|---|---|---|---|
| 「9999+」点赞 | `LeftAvatar.vue:62-64` / `InfoPopover.vue:122` | 硬编码 | 否 | **删除整段 thumbs-up 列** |
| 4 张「动态」 | `LeftAvatar.vue:75-83` / `InfoPopover.vue:178-188` | 硬编码外链图 | 否（无 moments 协议） | **删除整段「动态」区** |
| 「所在地」 | `InfoPopover.vue:138-143` 用 `locPlace` | 字段从未被赋值 | 否 | **整段删除**或仅在 `account_data m.location` 存在时显示 |
| 徽章 / wearingItemId / 开发者徽章 | `InfoPopover.vue:7,77-80,144-174` | 依赖 `itemIds`、`wearingItemId` | 否 | **删除徽章 / 称号区**，背景图固定中性图 |
| `linkedGitee` / `linkedGithub` | `InfoPopover.vue:120-132` | 依赖 `oauthProviders` | 否（synapse-rust OIDC 不回写） | **删除两个 tooltip 图标** |
| 群聊「人数 / 在线人数」 | `group.ts:271-272` 写 `memberCount` 同时填 `onlineNum = memberCount` | 错误数据 | 否（无 onlineNum API） | 改为 `room.getJoinedMembers().length` 仅显示总人数；不再展示「在线 X / Y」 |

---

## 4. 优化方案（按优先级 + 可落地步骤）

### P0 — 修截图直接现象

#### F1. `useOnlineStatus` 兜底到 `userStore.userInfo`

文件：`src/hooks/useOnlineStatus.ts`

```ts
const currentUser = computed(() => {
  const uidVal = uid?.value ?? userStore.userInfo?.uid
  if (!uidVal) return undefined
  return (
    groupStore.getUserInfo(uidVal) ||
    (uidVal === userStore.userInfo?.uid ? userStore.userInfo : undefined)
  )
})
```

#### F2. 登录后启动心跳 + setPresence + fetchUserProfile + 注册 presence 事件

文件：`src/services/matrix/auth/MatrixRuntimeSessionService.ts:403-457`，在 `userStore.userInfo = account` 之后追加：

```ts
import { startPresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { OnlineEnum } from '@/enums'
import { buildPresenceStorePatch } from '@/utils/presenceStatus'

const profile = await userStore.fetchUserProfile(uid).catch(() => null)
if (profile) {
  userStore.userInfo!.name = profile.displayName || userStore.userInfo!.name
  userStore.userInfo!.avatar = profile.avatarUrl || userStore.userInfo!.avatar
}

await matrixPresenceService.setPresence('online').catch(() => {})
userStore.userInfo!.activeStatus = OnlineEnum.ONLINE
userStore.userInfo!.lastOptTime = Date.now()
startPresenceHeartbeat()

matrixPresenceService.onPresenceChange((presence) => {
  const patch = buildPresenceStorePatch(presence)
  if (presence.user_id === uid && userStore.userInfo) {
    userStore.userInfo.activeStatus = patch.activeStatus
    userStore.userInfo.lastOptTime = patch.lastOptTime
  }
  groupStore.updateUserPresence(presence.user_id, patch)
  contactStore.updateContactPresence(presence.user_id, patch)
})
```

`logoutCurrentSession` 末尾追加：

```ts
import { stopPresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'
stopPresenceHeartbeat()
window.removeEventListener('beforeunload', onBeforeUnload)
```

并加 `beforeunload` 钩子：登出/关闭前 `await matrixPresenceService.setPresence('unavailable')`。

#### F3. 统一 `account / name / uid` 字段口径

新增 `src/utils/userIdentity.ts`：

```ts
export const toLocalpart = (mxid: string) =>
  mxid.startsWith('@') ? mxid.slice(1).split(':')[0] : mxid.split(':')[0]
export const toServerName = (mxid: string) => mxid.split(':')[1] ?? ''
```

修改：

- `src/stores/domains/user/user.ts:128-142`：`account: toLocalpart(matrixUserId)`。
- `src/services/matrix/auth/MatrixRuntimeSessionService.ts:427-441`：`account: toLocalpart(options.account || uid)`。
- `src/stores/domains/chat/group.ts:217-232`：`account: toLocalpart(m.userId)`，并将 `displayName` 与 `myName` 解耦——`displayName = m.rawDisplayName || m.userId`，`myName` 仅写本房间内的 nickname。

#### F4. UI 假数据删除（后端无对应能力）

文件 `src/components/common/InfoPopover.vue`：

- 删 `<n-flex>` 内 9999+ thumbs-up（截图右上角列）：本组件未直接含此区块，主要在 `LeftAvatar.vue:61-64`，删除整个 `<n-flex :size="5" align="center" class="item-hover" vertical> ... </n-flex>`。
- 删「徽章」整段 `InfoPopover.vue:144-174`。
- 删「动态」整段 `InfoPopover.vue:175-189` 与 `LeftAvatar.vue:71-85`。
- 删「所在地」整段 `InfoPopover.vue:137-143` 与 `LeftAvatar.vue:66-70`，或保留并显示真实 account_data。
- 删 `linkedGitee` / `linkedGithub` `InfoPopover.vue:120-132`。
- 顶部封面图固定为中性图，删除 `wearingItemId === '6'` 的两个分支 `InfoPopover.vue:5-9, 76-80`。

文件 `src/stores/domains/chat/group.ts:271-272`：

```ts
memberNum: room.getJoinedMembers().length,
onlineNum: undefined,  // 不再展示假在线数
```

并在所有 UI 处用 `v-if="onlineNum != null"` 包住「在线 X」展示。

#### F5. 等 SlidingSync PREPARED 后再 loadRooms

文件 `src/services/matrix/auth/MatrixRuntimeSessionService.ts:417-425`：

```ts
await this.ensureClientReadyForBootstrap(options)
await this.waitSyncPrepared()
this.clearUserLocalStorage()
this.clearMessageCache()
roomStore.resetState()
await roomStore.setupEventListeners()
groupStore.groupDetails.length = 0
await roomStore.loadRooms()
```

新增私有方法：

```ts
private waitSyncPrepared(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    const off = (data: unknown) => {
      const state = (data as { state?: string })?.state
      if (state === 'PREPARED' || state === 'SYNCING') {
        matrixClientService.off('sync', off as never)
        resolve()
      }
    }
    matrixClientService.on('sync', off as never)
    setTimeout(() => {
      matrixClientService.off('sync', off as never)
      resolve()
    }, timeoutMs)
  })
}
```

### P1 — SlidingSync 真正下推 presence + sync rooms

文件 `src/services/matrix/MatrixClientService.ts:233-269`：

```ts
const slidingSync = new SlidingSync(
  this.config.homeserverUrl,
  lists,
  {
    timeline_limit: 10,
    required_state: [
      ['m.room.name', ''],
      ['m.room.avatar', ''],
      ['m.room.encryption', ''],
      ['m.room.member', '*'],
      ['m.room.topic', ''],
      ['m.room.power_levels', '']
    ],
    extensions: {
      to_device: { enabled: true },
      e2ee: { enabled: true },
      account_data: { enabled: true },
      receipts: { enabled: true, lists: ['default'] },
      typing: { enabled: true, lists: ['default'] }
    }
  },
  this.client,
  30000
)
```

`lists.default.ranges` 起步改为 `[[0, 49]]`，滚动时再扩展。

> 备注：synapse-rust 若暂未实现 sliding sync `extensions.presence`，则保留 `client.on('User.presence')` 路径（已在 `MatrixPresenceService.attachPresenceListener` 内）。

### P2 — 后端连通性

#### F6. dev 代理覆盖 `https://matrix.test`

文件 `vite.config.ts`：

```ts
export default defineConfig({
  // ...
  server: {
    port: 6130,
    proxy: {
      '/_matrix': {
        target: 'https://matrix.test',
        changeOrigin: true,
        secure: false,
        ws: true
      },
      '/_synapse': {
        target: 'https://matrix.test',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
```

文件 `src/services/backend/config.ts:107-142`：在 `shouldRewriteHomeserverToDevProxy` 增加分支：

```ts
function shouldRewriteHomeserverToDevProxy(homeserverUrl: string): boolean {
  if (!shouldUseMatrixDevProxy()) return false
  try {
    const target = new URL(homeserverUrl)
    return (
      (target.hostname === 'localhost' || target.hostname === '127.0.0.1' || target.hostname.endsWith('.test')) &&
      target.protocol === window.location.protocol
    )
  } catch {
    return false
  }
}
```

#### F7. 自签名 / 内部域名 fetchFn

文件 `src/services/matrix/network/runtimeFetch.ts`：在 Tauri 运行时使用 `@tauri-apps/plugin-http` 的 `fetch`，并对 `*.test` / dev 模式设 `dangerousAcceptInvalidCerts: true`。

文件 `MatrixClientService.ts:198-206`：

```ts
const insecureHostnames = (() => {
  try {
    const u = new URL(config.homeserverUrl)
    return u.protocol === 'http:' || u.hostname.endsWith('.test') || u.hostname.endsWith('.local')
  } catch {
    return false
  }
})()
const clientOpts: ICreateClientOpts = {
  baseUrl: config.homeserverUrl,
  ...
  allowInsecureHttp: config.allowInsecureHttp ?? insecureHostnames,
  fetchFn: getRuntimeAwareFetchFn()
}
```

#### F8. 诊断工具接入 UI

`src/App.vue` `bootstrapState === 'error'` 或 `connectionState === 'error'` 时调用：

```ts
import { runMatrixDiagnostics } from '@/utils/MatrixDiagnostics'
const results = await new MatrixDiagnostics(matrixStore.homeserverUrl ?? '').runAll()
useMatrixHealthStore().setDiagnosis(results)
```

并在 `ConnectionStatusBanner.vue` 新增"运行自检"按钮 + 详情列表。

### P3 — 用 Matrix 事件桥替换全部旧 WS mitt

新增 `src/services/matrix/MatrixEventBridge.ts`：

```ts
class MatrixEventBridge {
  start() {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on('Event.decrypted', this.onEventDecrypted)
    client.on('Room.redaction', this.onRedaction)
    client.on('RoomMember.membership', this.onMembership)
    client.on('RoomMember.name', this.onMemberName)
    client.on('RoomState.events', this.onRoomState)
    client.on('Room.accountData', this.onRoomAccountData)
    client.on('Session.logged_out', this.onSessionLoggedOut)
    client.on('Call.incoming', this.onIncomingCall)
  }

  stop() { /* 反注册 */ }
}
```

并把 `App.vue:163-435` 全部 `useMitt.on(WsResponseMessageType.*, ...)`：

- 保留 mitt key 不变，但把"事件源"换成 `matrixEventBridge` 在收到 SDK 事件后内部 `useMitt.emit(...)`。
- 已经无对应映射的（`MSG_MARK_ITEM`）改为 noop 并标 TODO 删除。
- `LOGIN_SUCCESS` 由 `bootstrapPostLoginState` 内部直接 emit，不再依赖事件桥。

### P4 — Worker 与性能

#### F9. 真正使用 `matrixSdk.worker.ts`

新增 `src/services/matrix/MatrixWorkerHost.ts`：

```ts
const worker = new Worker(new URL('@/workers/matrixSdk.worker.ts', import.meta.url), { type: 'module' })
```

封装 `init/login/startClient/getProfile/setPresence/getRooms` 6 个 message。仅 desktop 启用（`isDesktop()`），mobile / Safari 走主线程 fallback。`MatrixClientService` 内部根据 host 切换实现。

`F9` 后续增量迁移复核后，状态调整为：

1. `MatrixSearchService` 全文检索 / 索引构建：**已完成 Worker 常驻索引的 MVP (最小可行产品)**。包括 Worker 端内存索引、IndexedDB 持久化、登录后批量灌入、增量更新和 `hybrid` 搜索模式。下一步可按需扩展索引范围和高级特性。
2. `mxcUrlToHttp`：benchmark 已完成，维持不迁移结论。
3. `MatrixAccountService.getCapabilities`：已完成，与 `getServerVersions` 复用同一并发批次和请求封装。

#### F10. 心跳 + 关闭通知

`usePresenceHeartbeat.startPresenceHeartbeat` 内部已实现 visibility / activity；只需补全：

- `beforeunload` → `setPresence('unavailable')`（非 await，使用 `navigator.sendBeacon` 兜底）。
- 后台标签页 5 分钟未交互时降级 `unavailable`。

### P5 — UI 假数据收敛（后端不支持，直接删除）

> 设计原则：后端 `langkebo/synapse-rust` 没有 thumbs-up / moments / location / badges / wearingItemId / linkedGitee / linkedGithub 等扩展协议时，**前端不显示**这些字段，避免误导。

按 F4 列表删除。删除后视觉效果：

- `LeftAvatar.vue` 弹窗只剩：头像、`displayname`、`@account`、在线状态、编辑按钮。
- `InfoPopover.vue` 弹窗只剩：背景中性图、头像、`displayname`、`@account`、在线状态、编辑/发消息/添加好友按钮。
- 群信息弹窗：群名 + 总人数 + topic，删除「在线 X」。

后续若 synapse-rust 通过 manager extensions 提供以上能力，再按需以 feature flag 渐进恢复。

---

## 5. 验证 checklist

> 修复 P0 + F4 后，截图问题必须全部消失。

1. DevTools Network 命中：
   - `GET  /_matrix/client/v3/profile/{mxid}` → 200，`displayname=test6`
   - `PUT  /_matrix/client/v3/presence/{mxid}/status` body `{"presence":"online"}` → 200
   - `POST /_matrix/client/unstable/org.matrix.msc3575/sync` 带 `extensions.typing/receipts/account_data`
2. `LeftAvatar` 头像左下小圆点变绿，hover tooltip 为「在线」。
3. `userStore.userInfo` 三字段：`uid=@hulatest:matrix.test`、`name=test6`、`account=hulatest`。
4. 4 分钟后再次抓到 `PUT presence`；切换 tab 隐藏后再回前台立即出现一次。
5. 登出 / 关闭窗口时抓到 `presence=unavailable`；下次登录立即恢复 `online`。
6. `runMatrixDiagnostics()` 全 4 项 success；`ConnectionStatusBanner` 不再 reconnecting。
7. 创建 / 加入一个房间后，`InfoPopover` 顶部 `name`、`account`、`displayname` 与 `LeftAvatar` 完全对齐。
8. 「9999+」「动态」「所在地」「徽章」「Gitee/GitHub 标识」等假数据 UI 已消失（或只在后端真有数据时显示）。

---

## 6. 改动文件总览（按 PR 拆分）

| PR | 修复点 | 主要文件 |
|---|---|---|
| PR-1 | 截图直修：F1 / F2 / F3 / F4 / F5 | `src/hooks/useOnlineStatus.ts`、`src/services/matrix/auth/MatrixRuntimeSessionService.ts`、`src/stores/domains/user/user.ts`、`src/stores/domains/chat/group.ts`、`src/utils/userIdentity.ts`(新增)、`src/components/common/InfoPopover.vue`、`src/layout/left/components/LeftAvatar.vue` |
| PR-2 | SlidingSync extensions | `src/services/matrix/MatrixClientService.ts`、`src/types/matrix-js-sdk-augmentations.d.ts` |
| PR-3 | dev proxy + 自签名 fetch | `vite.config.ts`、`src/services/backend/config.ts`、`src/services/matrix/network/runtimeFetch.ts` |
| PR-4 | Matrix 事件桥替换 mitt | `src/services/matrix/MatrixEventBridge.ts`(新增)、`src/App.vue`、`src/hooks/useLoginFlow.ts` |
| PR-5 | 真正接入 worker | `src/services/matrix/MatrixWorkerHost.ts`(新增)、`src/workers/matrixSdk.worker.ts`(完善)、`src/services/matrix/MatrixClientService.ts` |
| PR-6 | UI 假数据持续删除 / 替换 | `InfoPopover.vue`、`LeftAvatar.vue`、`HulaRoomSummaryPanel.vue`、`FriendListItem.vue` 等所有引用 `locPlace / itemIds / wearingItemId / linkedGitee / linkedGithub / onlineNum` 的组件 |

PR-1 落地后即可修复截图直接现象；PR-2~6 是把整个"前端 ↔ `https://matrix.test`"系统性打通。

---

## 7. 风险与兼容

- **删除 UI 字段**会让产品形态简化，需与产品/UX 对齐：以 synapse-rust 为后端时不再展示自研协议字段。
- **统一 account 字段为 localpart** 会破坏依赖完整 MXID 的旧逻辑，需要 grep `userInfo.account` / `member.account` 全部确认（约 30+ 处，集中在 `LeftAvatar.vue` `InfoPopover.vue` `LoginHistory` `EditUserInfo` `搜索面板` 等）。
- **dev proxy / 自签名** 仅 dev 与内网开启；prod 必须使用合法 TLS。
- **SlidingSync extensions** 需 synapse-rust 已实现对应 extension；若返回 400，需在 `MatrixClientService` 捕获并降级到 v2 sync（`/_matrix/client/v3/sync`）。
- **Worker 接入** 改动面较大，先在 desktop 灰度；mobile（iOS WebView）保持主线程实现。

---

## 附录 A — 关键文件速查

- 截图组件：`src/layout/left/components/LeftAvatar.vue`、`src/components/common/InfoPopover.vue`
- 在线状态钩子：`src/hooks/useOnlineStatus.ts`、`src/hooks/usePresenceHeartbeat.ts`
- presence 工具：`src/utils/presenceStatus.ts`、`src/services/matrix/user/MatrixPresenceService.ts`、`src/services/matrix/user/MatrixAccountService.ts`
- 用户/群 Store：`src/stores/domains/user/user.ts`、`src/stores/domains/user/userStatus.ts`、`src/stores/domains/chat/group.ts`、`src/stores/domains/chat/matrix.ts`
- 客户端服务：`src/services/matrix/MatrixClientService.ts`、`src/services/matrix/auth/MatrixRuntimeSessionService.ts`
- 后端配置：`src/services/backend/config.ts`、`src/services/backend/discovery.ts`
- 启动 / WS 桥：`src/App.vue`、`src/composables/useBootstrap.ts`、`src/composables/useConnectionStatus.ts`
- 诊断：`src/utils/MatrixDiagnostics.ts`
- Worker：`src/workers/matrixSdk.worker.ts`、`src/workers/matrixWorkerTypes.ts`
