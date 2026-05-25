# HuLa 前后端联调复测报告

> 执行日期：2026-05-24
> 执行人：GPT-5.4
> 基线报告：`docs/matrix-test-integration-report-20260524-112456.md`
> 覆盖对象：
> - 前端：`/Users/ljf/Desktop/hu_ts/hula`
> - SDK：`/Users/ljf/Desktop/hu_ts/matrix-js-sdk`

---

## 一、复测目标

基于原始联调报告中记录的 P0/P1 问题，验证本地代码侧修复是否已经落地，并区分以下三类结论：

- 已由本地代码修复的问题
- 仍需继续复测但已有明显收敛的问题
- 属于后端 / CORS / 运行环境的外部阻塞问题

---

## 二、原报告问题与当前状态

| 编号 | 原问题 | 当前状态 | 结论 |
| --- | --- | --- | --- |
| P0-01 | 房间创建后状态不一致 | 未在本轮本地代码内解决 | 仍为后端阻断 |
| P0-02 | SDK 登录 / 登出链缺失 `AccountManager` | 已有本地修复并补充回归测试 | 本地问题已收敛 |
| P0-03 | 前端 live E2E `restore-token` 在 Pinia 初始化前失败 | `restore-token` / `password-api` 可执行 live 场景均已复跑通过 | 本地恢复链问题已闭环，剩余为环境级未覆盖分支 |
| P1-01 | SDK 导出不一致导致 `lib` 侧探针异常 | 源码导出已修复，源码级验证通过 | 构建产物仍需完整构建校验 |
| P1-02 | Vitest teardown 异步导入污染结果 | 本轮未重现、也未完成针对性全量复测 | 待进一步验证 |
| P2-01 | 服务端登录 / 注册限流波动 | 现象仍存在 | 环境稳定性问题 |

---

## 三、本轮代码优化项

### 3.1 前端 `hula`

已完成并保留的关键修复：

- `src/utils/AppStateReady.ts`
  - 浏览器 Playwright 且无 Tauri runtime 时，直接放行 `ensureAppStateReady()`
  - 解决 browser-only 运行中等待原生 `app-state-ready` 的卡死问题

- `src/stores/domains/chat/matrix.ts`
  - 为 `login()` / `completeSSOLogin()` / `loginWithToken()` 增加登录后启动链预算
  - `startClient()` / `refreshCapabilities()` 超时后转为后台继续，避免 `restore-token` 无限阻塞

- `e2e/support/matrixLive.ts`
  - `restore-token` 恢复不再注入 `refreshToken`
  - 增加 `guide` 完成态、最小 Tauri runtime stub、homeserver 注入、恢复阶段标记
  - 补齐 Tauri v2 事件插件浏览器桩，消除 `unregisterListener` 运行时异常
  - 页面断言切换到当前真实 DOM：`.message-list-page`、`.message-session-toolbar`、`[role="listitem"]`

- `src/composables/workbench/useSessionListState.ts`
  - 会话列表派生改为直接订阅 `sessionStore`
  - 修复浏览器真后端恢复后 `sessionStore.sessionList` 已有数据但消息页仍停留在空态的问题

- `index.html`
  - 放开 `https://matrix.test`、`https://element.test` 与本地 HMR websocket 的 `connect-src`
  - 修复浏览器访问真后端时被页面 CSP 拦截的问题

- `e2e/matrix-live.spec.ts`
  - 清理残留的旧 `data-test` 断言，统一使用当前消息页真实选择器

- `scripts/debug-matrix-live-import.mjs`
  - 补齐最小 Tauri runtime stub
  - 新增运行态诊断输出：
    - `matrixStore.connectionState`
    - `matrixStore.syncState`
    - `roomStore.roomList.length`
    - `sessionStore.sessionList.length`
    - DOM 会话项数量

### 3.2 SDK `matrix-js-sdk`

已确认的本地修复点：

- `src/matrix.ts`
  - `createClient()` 构造时同步安装核心 manager 扩展
  - 避免 `client.login()` / `client.logout()` / `client.createRoom()` 在异步扩展尚未完成前直接失去 `AccountManager` / `RoomManager`

- `src/admin/index.ts`
  - `UserInfo` 类型导出已与 `AdminAccountDetails` 对齐

- `spec/unit/create-client-core-managers.spec.ts`
  - 新增核心 manager 同步注册回归测试
  - 覆盖账号、凭证、房间、profile 以及 `disableDynamicExtensions` 分支

---

## 四、本轮执行记录

### 4.1 Hula 本地回归测试

执行命令：

```bash
pnpm vitest run \
  src/utils/__tests__/AppStateReady.test.ts \
  src/stores/domains/chat/__tests__/matrix.test.ts \
  src/services/matrix/auth/__tests__/MatrixRuntimeSessionService.test.ts \
  src/services/matrix/auth/__tests__/SessionOrchestrator.test.ts
```

执行结果：

- 测试文件：`4`
- 通过：`4`
- 测试项：`27`
- 通过：`27`

验证结论：

- 浏览器无 Tauri runtime 的 app-state 就绪问题已被单测覆盖
- 登录后启动链超时回退行为已被单测覆盖
- runtime session fallback / SessionOrchestrator 回退行为仍然通过

### 4.2 SDK 核心 manager 回归测试

执行命令：

```bash
pnpm vitest run spec/unit/create-client-core-managers.spec.ts
```

执行结果：

- 测试文件：`1`
- 通过：`1`
- 测试项：`3`
- 通过：`3`

验证结论：

- `createClient()` 现在能同步注册账号、凭证、房间、profile 相关 manager
- 原报告中的 `getAccountManager is not a function` 具备明确的本地修复证据

### 4.3 SDK 设备管理真后端复测

为恢复原报告中的 real-backend 设备管理链路，本轮补充做了以下处理：

- 修复 `src/manager-extensions/index.ts` 中批量引入 `safeDynamicImport(...)` 时缺失闭合括号的语法错误
- 使用本地临时反向代理恢复 `http://localhost:28008 -> https://matrix.test`
- 为 `DeviceManager.deleteDevice()` 始终发送 JSON body，修复 `DELETE /devices/{id}` 首次请求的 `415 Content-Type` 问题
- 修复 `src/device/index.ts` 的 UIA 错误提取逻辑，优先透传后端返回的 `session / flows / params`
- 新增 real-backend 设备测试共享 helper，吸收登录 `429` 限流、串行化登录窗口并统一安全登出
- 为批量删除用例放宽 hook / case 超时，适配真实后端的节流窗口

补充验证结果：

- `lib/admin/index.js` 入口 smoke test 通过
- `pnpm test:real-backend:device` 从“编译前失败”推进到真实接口执行阶段
- 设备管理子集最新结果：
  - 测试文件：`4`
  - 通过：`4`
  - 测试项：`4`
  - 通过：`4`

最终通过明细：

- `spec/integ/real-backend/device-manager.spec.ts`
  - 真实登录后可正常拉取设备列表

- `spec/integ/real-backend/device-step2.spec.ts`
  - 已越过原先的 `415 Expected request with Content-Type: application/json`
  - 单设备删除 UIA 二次提交可正确复用后端返回的 `session`

- `spec/integ/real-backend/device-delete-devices.spec.ts`
  - 批量删除链路在真实后端下通过
  - 登录限流已由测试 helper 的退避与串行化策略吸收

- `spec/integ/real-backend/device-list-updates.spec.ts`
  - 设备列表增量接口稳定返回 SDK 期望结构

### 4.4 前端 live E2E 当前状态

本轮已继续补跑首条真后端 Playwright 用例，并把浏览器模式从跨域直连切到同源代理，同时收敛了消息页空态根因：

- `playwright.config.ts`
  - 自动把 `MATRIX_LIVE_HOMESERVER_URL` 注入为 dev server 的 `VITE_HOMESERVER_URL`
  - 让 Vite `/_matrix` 代理直接指向真实 homeserver

- `e2e/support/matrixLive.ts`
  - 浏览器 Playwright 下若 `MATRIX_LIVE_HOMESERVER_URL` 与 `MATRIX_LIVE_APP_URL` 不同源，则自动把运行态 homeserver 改写为 `app origin`
  - 避免 `password-api` 模式走 `5210 -> 28008` 跨域直连并触发 `Failed to fetch`
  - 为失败快照补充路由查询、筛选值、过滤结果、运行时错误与 Tauri 事件桥诊断
  - `restore-token` 恢复前显式回填 session endpoint，同步等待稳定登录态
  - 房间定位统一回到真实 `session-item-*` 选择器，探针消息改走 `matrixEventService.sendTextMessage()`

- `src/composables/workbench/useSessionListState.ts`
  - 改为直接订阅 `sessionStore.sessionList`
  - 修复真实后端恢复后列表派生未及时响应，导致消息页误显示 `No sessions yet`

本轮实际复跑命令：

```bash
MATRIX_LIVE_E2E=1 \
MATRIX_LIVE_AUTH_STRATEGY=password-api \
MATRIX_LIVE_HOMESERVER_URL=https://matrix.test \
MATRIX_LIVE_USERNAME=sdk_testuser \
MATRIX_LIVE_PASSWORD=Test@123 \
pnpm playwright test e2e/matrix-live.spec.ts \
  --project=desktop-chromium \
  --grep "logs in against a live homeserver and opens the message workspace"
```

本轮最新复跑结果：

```text
1 passed (desktop-chromium)
```

以及：

```text
restore-token: 2 passed, 2 skipped
password-api: 2 passed, 2 skipped
```

定位过程中的关键结论：

```text
matrix.isLoggedIn = true
sessionStore.sessionList.length = 1
filteredSessions.count = 1
runtimeErrors: Cannot read properties of undefined (reading 'unregisterListener')
```

- 失败一度推进为：

```text
等待消息会话列表加载
Expected: > 0
Received: 0
```

- 根因最终收敛为两部分：
  - 浏览器 Playwright 的最小 Tauri runtime stub 缺少事件插件 `unregisterListener`，触发运行时异常
  - 消息页列表派生通过 `chatStore` 透传 getter 读取会话数组，在真实后端恢复场景下没有稳定驱动视图刷新

- 修复后首条真后端 `password-api` 用例已能稳定完成：
  - 登录真实 homeserver
  - 打开 `/message`
  - 渲染会话列表

此前失败阶段的页面快照为：

```text
Offline
No sessions yet.
```

浏览器调试阶段仍观察到环境级风险：

```text
Access to fetch at 'https://matrix.test/_matrix/client/v3/pushrules' from origin 'http://127.0.0.1:5210'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

因此当前结论更新为：

- 原始 P0-03 中“恢复时序错误”已不再阻断 `restore-token` 与 `password-api` live 验证
- `matrix-live` 的浏览器登录跨域问题已由同源代理方案收敛
- 消息页“列表为空”已被确认为本地前端订阅链与浏览器 Tauri 事件桩问题，并已修复
- 房间探针场景的旧选择器与错误发送入口问题已修复
- `expectedTimelineText` 时间线校验已通过
- 双账号 peer 场景已在 `restore-token` 与 `password-api` 下均通过
- 当前剩余重点转为：
  - `pushrules` CORS 与房间状态链路等环境级问题继续区分验证
  - 持续观察后端限流窗口波动，但当前已可由登录串行化与退避策略吸收

---

## 五、问题分级更新

### 5.1 P0 阻断级

#### P0-A 房间链路状态不一致

现象：

- 原始报告中的 `createRoom -> joined_rooms 空 -> send 403 -> room state 404` 仍未被本地代码修复覆盖

结论：

- 属于后端行为问题
- 继续阻断真实房间、时间线、消息发送、会话列表联调

#### P0-B 浏览器模式下 `pushrules` CORS 风险仍存在

现象：

- 浏览器直接访问 `https://matrix.test/_matrix/client/v3/pushrules` 时缺少允许 `http://127.0.0.1:5210` 的跨域头

影响：

- 仍可能影响浏览器模式下的部分能力探测与通知相关请求
- 但在本轮修复后，已不再阻断首条 `matrix-live` `password-api` 验收用例

结论：

- 属于后端 / 环境配置问题，不是当前前端本地业务代码单点缺陷

### 5.2 P1 高优先级

#### P1-A SDK `AccountManager` 装配链

状态：

- 已有本地修复
- 最小回归测试通过
- real-backend 设备管理子集 `4 / 4` 通过
- 当前不再是 `getAccountManager is not a function`
- `deleteDevice` 的 UIA 二次认证已验证通过
- 当前剩余风险主要为：
  - 本地 `28008 -> matrix.test` 代理必须保持存活
  - 后端登录限流窗口会拉长 real-backend 用例执行时间

#### P1-B 前端 `restore-token` 恢复链

状态：

- 已从“注入即失败”推进到“`restore-token` 可执行 live 场景通过”
- 当前属于已修复，剩余为更大覆盖面的继续验证

#### P1-C SDK `lib` 产物导出一致性

状态：

- 源码导出已修正
- 仍建议补一次完整构建后 smoke test，确认 `lib/admin/index.js` 与源码一致

### 5.3 P2 中优先级

#### P2-A 测试环境限流与凭据注入稳定性

现象：

- 真后端自动化高度依赖 access token / 测试账号
- 本地 `28008 -> matrix.test` 代理中断时，SDK real-backend 用例会直接表现为 `502 / fetch failed`
- 后端登录接口存在明显 `429` 限流窗口，连续登录场景需要退避与串行化
- 当前 shell 未注入 live 环境变量，说明复测链仍依赖人工环境准备

建议：

- 统一 `.env.e2e.local` 或 CI secret 注入方案
- 对测试账号和来源 IP 配置限流白名单
- 为 SDK real-backend 用例保留代理探活与启动步骤，避免把环境故障误判为业务缺陷

---

## 六、复现步骤更新

### 6.1 复现当前 `matrix-live` 最新验证链路

1. 准备真实环境变量：
   - `MATRIX_LIVE_E2E=true`
   - `MATRIX_LIVE_AUTH_STRATEGY=restore-token`
   - `MATRIX_LIVE_HOMESERVER_URL=https://matrix.test`
   - `MATRIX_LIVE_USER_ID=@sdk_testuser:matrix.test`
   - `MATRIX_LIVE_ACCESS_TOKEN=<有效 token>`
2. 启动前端：

```bash
pnpm dev --host 127.0.0.1 --port 5210
```

3. 运行：

```bash
pnpm playwright test e2e/matrix-live.spec.ts --project=desktop-chromium
```

4. 如果需要查看运行态数据或失败快照，执行：

```bash
node scripts/debug-matrix-live-import.mjs
```

5. 观察：
   - 是否已进入 `/message`
   - 是否已渲染真实会话列表
   - `roomStore.roomList.length`
   - `sessionStore.sessionList.length`
   - 是否存在 `pushrules` 的 CORS 报错

---

## 七、修复建议更新

### 7.1 后端 / 环境

- 优先修复 `matrix.test` 针对 `http://127.0.0.1:5210` 的 CORS 白名单，至少覆盖：
  - `/_matrix/client/v3/pushrules`
  - 其他消息页首屏依赖接口
- 继续排查房间创建后的 membership / state / power levels 初始化
- 为测试账号和来源地址提供限流豁免

### 7.2 前端

- 保留现有 `restore-token`、CSP、AppStateReady、Tauri stub、session endpoint 回填与 `sessionStore` 直连订阅修复
- 已补跑 `expectedTimelineText` 与双账号 peer 分支；后续保留当前 live helper 的结构化失败快照继续监控环境波动

### 7.3 SDK

- 继续排查 `DELETE /devices/{deviceId}` 的 UIA 二次提交契约，重点核对：
  - 请求体字段
  - `session`
  - `identifier`
  - 后端对单设备删除与批量删除的 UIA 要求差异
- 为 real-backend 设备管理子集增加测试账号限流豁免，避免 `429` 干扰结果
- 在发布前增加一次构建产物 `lib` 入口 smoke test
- 若 teardown 异步导入仍偶发，需继续收口 `identity-server` 的异步初始化生命周期

---

## 八、总体结论

相较于原始报告，本轮优化已经明确推进了两个关键方向：

1. `matrix-js-sdk` 的核心 manager 装配链已有本地修复证据，原始 `AccountManager` 阻断正在收敛。
2. 前端 `matrix-live` 已越过最初的 Pinia 初始化失败与“消息页空态”阶段，`restore-token` / `password-api` / `expectedTimelineText` / 双账号 peer 的当前可执行真后端场景均已通过。

当前仍未彻底闭环的阻断项主要不是新增本地代码缺陷，而是：

- 后端房间状态链路异常
- 真后端 `pushrules` 的 CORS 配置风险仍在
- 真实联调凭据 / 限流环境不稳定

因此，下一轮联调应按如下顺序推进：

1. 修复 `matrix.test` 的房间状态链路与 CORS
2. 继续观察双账号 `password-api` 并发登录时的 `429` 限流波动，并在需要时补充退避策略
3. 补跑 SDK real-backend 设备管理子集
4. 基于新结果输出最终验收报告
