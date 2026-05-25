# Matrix 联调优化总结

> 输出时间：2026-05-24 17:52:46
> 关联报告：`docs/matrix-test-integration-report-20260524-175246.md`

---

## 一、本次优化完成项

### 1. 前端侧

- 修复 `restore-token` 在浏览器 Playwright 中的恢复链卡死问题
- 修复无 Tauri runtime 时 `AppStateReady` 永久等待的问题
- 为登录后的 Matrix 启动链增加超时预算，避免 `restoreWithAccessToken()` 长时间不返回
- 为 live E2E 注入最小 Tauri runtime stub，消除页面初始化阶段的 `invoke` 缺失错误
- 为 live E2E 补齐 Tauri v2 事件插件浏览器桩，消除 `unregisterListener` 运行时异常
- 修复页面 CSP，允许真实联调访问 `https://matrix.test`
- 为 `matrix-live` 浏览器模式补充同源代理方案，避免 `password-api` 直连真实 homeserver 时出现 `Failed to fetch`
- 修复 `useSessionListState()` 的会话列表订阅链，直接跟随 `sessionStore` 更新消息页列表
- 为 `restore-token` 分支补齐 session endpoint 回填与登录态等待，恢复同源联调路径
- 为 `password-api` 双账号登录补齐串行化与 `429` 退避重试，收敛并发登录限流波动
- 为消息列表项补稳定 `data-test`，并将探针消息发送 helper 对齐到 `matrixEventService.sendTextMessage()`
- 更新 live E2E 选择器与诊断脚本，使其匹配当前消息页真实 DOM 和 store 状态
- 通过房间消息回读自动补齐 `MATRIX_LIVE_EXPECTED_TIMELINE_TEXT`，补跑解密时间线校验
- 为第二账号 `sdk_testuser2` 补齐 token 与房间 membership，打通双账号 `restore-token` 与 `password-api` live 场景

### 2. SDK 侧

- 修复 `createClient()` 对核心 manager 的同步安装时机
- 为 `AccountManager` / `CredentialsManager` / `RoomManager` / `ProfileManager` 增加核心回归测试
- 修复源码层 `UserInfo` 导出别名
- 修复 `manager-extensions` 动态扩展注册段的语法错误，恢复 real-backend 设备子集可执行性
- 修复 `DeviceManager.deleteDevice()` 未发送 JSON body 导致的 `415 Content-Type` 问题
- 修复 `UIAError` 提取逻辑，保留后端返回的 `session / flows / params`
- 为 real-backend 设备用例补充登录限流退避、登录串行化与安全登出能力

### 3. 测试与验证

- Hula 相关回归测试通过：`27 / 27`
- SDK 核心 manager 回归测试通过：`3 / 3`
- SDK `lib/admin/index.js` 入口 smoke test 通过
- live E2E 首要失败点已从 Pinia 初始化错误推进并修复到消息页会话渲染阶段
- live E2E 首条 `password-api` 真后端用例已通过，可稳定登录、进入消息页并渲染会话列表
- live E2E `restore-token` / `password-api` 可执行场景整套复跑通过：`2 passed / 2 skipped`
- live E2E `expectedTimelineText` 单场景通过
- live E2E 双账号 peer 场景已在 `restore-token` 与 `password-api` 模式下通过
- 在完整 `password-api` 环境变量补齐后，`matrix-live.spec.ts` 已整套通过：`4 passed`
- SDK real-backend 设备管理子集顺序复跑通过：`4 / 4`

---

## 二、本次优化解决的问题

已解决或显著收敛的问题：

- `getActivePinia() was called but there was no active Pinia`
- 浏览器模式下 `ensureAppStateReady()` 等待原生事件导致的潜在卡死
- 登录后 `startClient()` / `refreshCapabilities()` 同步等待导致的恢复链超时
- 浏览器模式访问 `https://matrix.test` 被前端 CSP 拦截
- 消息页初始化阶段因 Tauri runtime 缺失而出现的 `Cannot read properties of undefined (reading 'invoke')`
- 消息页初始化阶段因 Tauri 事件插件桩缺失而出现的 `Cannot read properties of undefined (reading 'unregisterListener')`
- `matrix-live` 在浏览器模式下对真实 homeserver 直连触发的跨域 `Failed to fetch`
- `sessionStore.sessionList` 已有数据但消息页仍停留在 `No sessions yet` 的前端订阅链问题
- 房间探针场景依赖的旧 `session-item-*` 选择器与错误消息发送入口
- SDK 核心 manager 未及时注册导致的本地装配缺陷
- SDK 设备删除链路中 UIA `session` 被错误规范化后丢失的问题

---

## 三、仍未解决的问题

### 1. 后端 / 环境阻塞

- 房间创建后的 membership / state / 发消息链路仍存在状态不一致
- `/_matrix/client/v3/pushrules` 对本地浏览器源缺少 CORS 允许头
- 本地 `28008 -> matrix.test` 反向代理仍是 SDK real-backend 的必需前置条件
- 后端登录限流仍会拉长双设备 / 多设备场景耗时，但当前测试已能通过退避策略吸收

### 2. 待继续验证

- SDK `lib` 产物导出与源码是否完全一致
- `identity-server` 相关 teardown 异步导入问题是否已彻底消除
- SDK `lib` 产物导出与源码在完整构建后的持续一致性

---

## 四、后续性能与稳定性监控建议

建议优先增加以下监控与观测项：

- 登录链路耗时：
  - `login` / `restore-token`
  - `startClient`
  - `refreshCapabilities`

- 消息工作台首屏指标：
  - 进入 `/message` 到首个 session 渲染耗时
  - `roomStore.roomList.length`
  - `sessionStore.sessionList.length`

- 后端房间链路健康度：
  - `createRoom -> joined_rooms -> room state -> first message send` 成功率

- 浏览器真后端兼容性：
  - `pushrules`、`notifications`、sliding sync 相关请求的 CORS 成功率
  - Tauri 浏览器桩相关运行时错误数量

- 自动化稳定性：
  - 测试账号登录 429 频率
-  SDK real-backend 代理 `/_matrix/client/versions` 探活成功率
  - 环境变量注入缺失率

---

## 五、建议的下一步执行顺序

1. 后端修复 `matrix.test` 的房间状态链路与 CORS 配置
2. 在补齐更多账号/房间素材后继续扩展前端真后端用例覆盖
3. 补做 `lib` 构建产物 smoke test
4. 基于上述结果输出最终验收版联调报告
