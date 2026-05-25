# HuLa 前后端联调测试报告

> 执行日期：2026-05-24
> 执行人：GPT-5.4
> 测试目标：`https://matrix.test`
> 覆盖对象：
> - 前端：`/Users/ljf/Desktop/hu_ts/hula`
> - SDK：`/Users/ljf/Desktop/hu_ts/matrix-js-sdk`

---

## 执行摘要

已完成针对 `https://matrix.test` 的系统性前后端联调测试与真实环境探测，覆盖了基础连通性、认证、能力发现、SDK 真后端测试子集、前端 live homeserver E2E 登录入口，以及关键房间/消息链路验证。

本次测试确认：

1. 后端基础 API 可达，版本、能力、`whoami`、登录等基础接口可正常响应。
2. 真实联调的主要阻断点不在网络，而在：
   - 房间创建后的状态同步异常
   - 房间消息发送权限异常
   - SDK manager 装配链缺失
   - 前端 `restore-token` 测试注入时序错误
3. 因上述阻断问题，当前环境无法完成“所有功能模块”的完整端到端回归；但已经定位出影响全量联调的核心故障点，并形成可直接进入修复阶段的问题清单。

---

## 一、测试范围

### 1.1 前端范围

覆盖 `hula` 中与真实 Matrix 联调直接相关的关键能力：

- 登录与会话恢复
- homeserver 配置与运行时接入
- 消息工作台进入
- 会话列表加载
- 房间打开
- live Matrix Playwright 场景
- 前端与 SDK 的运行时衔接

### 1.2 SDK 范围

覆盖 `matrix-js-sdk` 中与真实后端交互最直接的模块与用例入口：

- 账号登录/登出
- 设备管理
- 后端对齐验证
- 阅后即焚
- 审计与扩展能力
- 基础 HTTP/能力发现

### 1.3 联调重点

本次重点验证以下维度：

- API 接口调用是否成功
- 数据格式是否符合预期
- 前后端状态是否一致
- 错误处理是否稳定可预期
- 真实环境中是否存在权限、限流、生命周期问题

---

## 二、测试环境

### 2.1 环境信息

- 操作系统：macOS
- 后端目标：`https://matrix.test`
- 解析结果：`matrix.test -> 127.0.0.1`
- 实际访问方式：HTTPS 直连
- SDK 真后端测试适配：使用本地临时代理将 `http://127.0.0.1:28008` 转发到 `https://matrix.test`

### 2.2 测试账号与方式

本次联调使用了以下方式：

- 固定测试账号密码登录：`sdk_testuser / Test@123`
- 历史有效 access token 恢复：用于前端 `restore-token` 场景
- 临时探针账号：用于 API 可达性与 `whoami` 验证

### 2.3 约束条件

- 服务端存在登录/注册限流，出现过 `429 Too Many Requests`
- 第二测试账号在部分阶段被限流，导致双账号场景无法稳定执行
- 部分前端 live 测试在页面状态初始化前即失败，未进入真实消息工作台验证阶段

---

## 三、执行记录

### 3.1 后端基础可达性探测

#### 接口 1：版本发现

```bash
GET https://matrix.test/_matrix/client/versions
```

- 结果：`200 OK`
- 响应时间：约 `156.7ms`
- 结果摘要：
  - 返回多组 Matrix 版本
  - 返回 `io.hula.burn_after_read`、`io.hula.friends`、`org.matrix.msc3886.sliding_sync` 等扩展能力标记

#### 接口 2：密码登录

```bash
POST https://matrix.test/_matrix/client/v3/login
```

- 用户：`sdk_testuser`
- 结果：`200 OK`
- 响应时间：约 `248.1ms`
- 返回字段：
  - `access_token`
  - `device_id`
  - `refresh_token`
  - `user_id`
  - `well_known`

#### 接口 3：错误登录

```bash
POST https://matrix.test/_matrix/client/v3/login
```

- 使用无效用户/密码
- 结果：`403`
- 响应结构：

```json
{
  "errcode": "M_FORBIDDEN",
  "error": "Invalid credentials"
}
```

- 结论：错误结构统一，认证失败路径可预期

### 3.2 SDK 探针验证

通过 SDK 运行时探针与真实后端交互，得到以下有效结果：

#### 成功项

- `GET /_matrix/client/v1/config/client`
  - 结果：`200`
  - 时延：约 `98ms`
  - 字段包含：`defaults`、`features`、`homeserver`、`identity_server`、`push`

- `GET /_matrix/client/v3/capabilities`
  - 结果：`200`
  - 时延：约 `4ms`
  - 字段包含：
    - `io.hula.burn_after_read`
    - `io.hula.friends`
    - `io.hula.sliding_sync`
    - `io.hula.voice_extended`
    - `io.hula.widget`

- `GET /_matrix/client/v3/account/whoami`
  - 结果：`200`
  - 时延：约 `4-5ms`

- `GET /_matrix/client/v3/joined_rooms`
  - 结果：`200`
  - 时延：约 `39ms`

#### 失败项

- 通过底层 `MatrixClient` 调 `createRoom`
  - 失败：`_this59.getRoomManager is not a function`

- 通过底层 `MatrixClient` 调 `getProfileInfo`
  - 失败：`this.getCredentialsManager is not a function`

- 通过底层 `MatrixClient` 调 `setPresence`
  - 失败：`client.setPresence is not a function`

- 结论：
  - SDK 当前部分能力依赖 manager 扩展动态装配
  - 当 manager 扩展未正确初始化时，底层 client 能访问基础 HTTP API，但无法完成高层业务能力调用

### 3.3 SDK 真后端测试子集执行

执行命令：

```bash
pnpm vitest run --config vitest.real-backend.config.ts \
  spec/integ/real-backend/backend-alignment.spec.ts \
  spec/integ/real-backend/device-manager.spec.ts \
  spec/integ/real-backend/device-list-updates.spec.ts \
  spec/integ/real-backend/device-step2.spec.ts \
  spec/integ/real-backend/device-delete-devices.spec.ts \
  spec/integ/real-backend/burn-after-read.spec.ts \
  spec/integ/real-backend/audit_alignment.spec.ts
```

执行结果：

- 测试文件：`7`
- 通过：`3`
- 失败：`4`
- 测试项：`45`
- 通过：`41`
- 跳过：`4`
- 额外错误：`5`

#### 通过范围

已通过的测试主要覆盖：

- 后端对齐部分只读接口
- 扩展能力发现
- 部分非登录依赖型验证

#### 失败范围

失败集中在以下测试文件：

- `spec/integ/real-backend/device-manager.spec.ts`
- `spec/integ/real-backend/device-list-updates.spec.ts`
- `spec/integ/real-backend/device-step2.spec.ts`
- `spec/integ/real-backend/device-delete-devices.spec.ts`

主要错误：

```text
TypeError: this.getAccountManager is not a function
```

触发位置：

- `client.login()` / `client.logout()`
- 见 `matrix-js-sdk/src/client.ts`

#### 附加错误

Vitest 运行中还出现了 teardown 阶段的异步导入错误：

```text
EnvironmentTeardownError:
Cannot load '/src/client-identity-lookup.ts' imported from src/identity-server/index.ts
after the environment was torn down.
```

结论：

- SDK 真后端测试并非纯后端失败
- 当前测试链本身存在 manager 扩展与生命周期处理问题

### 3.4 前端 live Playwright 联调执行

执行命令：

```bash
pnpm playwright test e2e/matrix-live.spec.ts --project=desktop-chromium
```

执行模式：

- `MATRIX_LIVE_E2E=true`
- `MATRIX_LIVE_AUTH_STRATEGY=restore-token`
- `MATRIX_LIVE_HOMESERVER_URL=https://matrix.test`
- `MATRIX_LIVE_USER_ID=@sdk_testuser:matrix.test`
- `MATRIX_LIVE_ACCESS_TOKEN=<有效 token>`

执行结果：

- 执行用例：`4`
- 首个用例失败：`1`
- 后续未执行：`3`

失败信息：

```text
[🍍]: "getActivePinia()" was called but there was no active Pinia.
```

失败阶段：

- 并未进入真实消息工作台验证
- 失败发生在 `restore-token` 的测试注入阶段

结论：

- 当前前端 live E2E 失败点优先级高于真实后端联调逻辑本身
- 测试脚本尚未具备稳定恢复真实会话的能力

### 3.5 房间与消息链路探测

#### 创建房间

```bash
POST https://matrix.test/_matrix/client/v3/createRoom
```

- 结果：`200`
- 响应时间：约 `88.7ms`
- 返回：`room_id`

实际创建成功的示例房间：

```text
!JInjfEwB8wWKVdT_X0Kod2yh:matrix.test
```

#### 查询已加入房间

```bash
GET https://matrix.test/_matrix/client/v3/joined_rooms
```

- 结果：`200`
- 响应时间：约 `11.5ms`
- 响应：

```json
{
  "joined_rooms": []
}
```

#### 房间发消息

```bash
PUT https://matrix.test/_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}
```

- 结果：`403`
- 响应时间：约 `43.4ms`
- 错误：

```json
{
  "errcode": "M_FORBIDDEN",
  "error": "Insufficient permission to send this event"
}
```

#### 查询房间状态

```bash
GET https://matrix.test/_matrix/client/v3/rooms/{roomId}/state
```

- 结果：`404`
- 响应：

```json
{
  "errcode": "M_NOT_FOUND",
  "error": "Room '!SzPvalV9xKFx2wHwcZb0lsix:matrix.test' not found"
}
```

结论：

- 后端房间链路存在显著状态不一致
- `createRoom` 成功不代表后续可见、可用、可发消息
- 该问题会直接阻断：
  - 前端会话列表加载
  - 房间进入
  - 时间线同步
  - 消息发送
  - 状态同步

---

## 四、问题分级

### 4.1 P0 阻断级问题

#### P0-01 房间创建后状态不一致

**现象**：

- `createRoom` 返回成功
- `joined_rooms` 为空
- `room state` 查询可能返回不存在
- 向新建房间发送消息返回 `403`

**影响**：

- 房间功能不可用
- 会话列表不可依赖
- 消息主链路被阻断
- 前端几乎所有 IM 相关真实联调无法继续

**判定**：阻断级

#### P0-02 SDK 登录/登出链缺失 `AccountManager`

**现象**：

- 真后端测试中调用 `client.login()` / `client.logout()` 直接失败
- 报错：`this.getAccountManager is not a function`

**影响**：

- 设备管理用例无法执行
- 真实登录链路无法验证
- 依赖 manager 的大量高层 API 无法稳定联调

**判定**：阻断级

#### P0-03 前端 live E2E 的 `restore-token` 模式失效

**现象**：

- Playwright 在页面未完成 Pinia 初始化前就执行会话恢复
- 报错：`getActivePinia() was called but there was no active Pinia`

**影响**：

- 真实 homeserver 登录场景无法回归
- 浏览器视角联调无法进入消息工作台
- 当前 live E2E 不可作为稳定验收基线

**判定**：阻断级

### 4.2 P1 高优先级问题

#### P1-01 SDK 编译产物导出不一致

**现象**：

- `matrix-js-sdk/lib/admin/index.js` 导出：

```js
export { AdminAccountDetails as UserInfo } from "./types.js";
```

- 但目标模块未提供该导出，导致基于 `lib` 的探针无法加载

**影响**：

- 发布产物质量不稳定
- Node 侧联调脚本不可用
- 说明 `lib` 与源码导出一致性存在问题

#### P1-02 Vitest teardown 异步导入污染测试结果

**现象**：

- 测试结束后仍有 `identity-server` 相关异步模块导入
- 出现 `EnvironmentTeardownError`

**影响**：

- 测试结果可信度下降
- 容易掩盖真实失败原因
- 会放大联调过程中的噪声

### 4.3 P2 中优先级问题

#### P2-01 服务端登录/注册限流波动

**现象**：

- 执行中多次出现 `429 Too Many Requests`
- 双账号场景受影响尤为明显

**影响**：

- 自动化用例稳定性下降
- 双账号消息联调难以持续执行
- 结果复现成本提升

---

## 五、复现步骤

### 5.1 复现后端房间状态异常

1. 使用 `sdk_testuser / Test@123` 登录 `https://matrix.test`
2. 调用：

```bash
POST /_matrix/client/v3/createRoom
```

3. 记录返回的 `room_id`
4. 立即调用：

```bash
GET /_matrix/client/v3/joined_rooms
```

5. 观察该房间未出现在 `joined_rooms`
6. 再调用：

```bash
PUT /_matrix/client/v3/rooms/{roomId}/send/m.room.message/{txnId}
```

7. 观察返回：

```json
{
  "errcode": "M_FORBIDDEN",
  "error": "Insufficient permission to send this event"
}
```

### 5.2 复现 SDK 登录链路失败

1. 在 `matrix-js-sdk` 目录执行真实后端测试子集：

```bash
pnpm vitest run --config vitest.real-backend.config.ts spec/integ/real-backend/device-manager.spec.ts
```

2. 观察测试在 `client.login()` 处失败
3. 报错：

```text
TypeError: this.getAccountManager is not a function
```

### 5.3 复现前端 live E2E 会话恢复失败

1. 在 `hula` 目录设置：
   - `MATRIX_LIVE_E2E=true`
   - `MATRIX_LIVE_AUTH_STRATEGY=restore-token`
   - `MATRIX_LIVE_HOMESERVER_URL=https://matrix.test`
   - `MATRIX_LIVE_USER_ID=@sdk_testuser:matrix.test`
   - `MATRIX_LIVE_ACCESS_TOKEN=<有效 token>`
2. 执行：

```bash
pnpm playwright test e2e/matrix-live.spec.ts --project=desktop-chromium
```

3. 观察首个用例在页面内 `restoreWithAccessToken` 阶段失败
4. 报错：

```text
getActivePinia() was called but there was no active Pinia
```

---

## 六、修复建议

### 6.1 后端修复建议

#### 建议 1：优先排查房间创建后的成员写入与权限初始化

重点检查：

- `createRoom` 后是否完成创建者自动加入
- `m.room.power_levels` 默认值是否异常
- 加密房间创建后发送 `m.room.message` 的权限是否被错误限制
- 房间是否写入正确的 membership/state

建议先补一组后端侧断言：

- 创建房间后立即查询 membership
- 创建房间后立即查询 room state
- 创建房间后立即以创建者发送首条消息

#### 建议 2：增加限流豁免或测试环境白名单

针对自动化测试环境：

- 对 `sdk_testuser`、`sdk_testuser2` 或测试来源 IP 放宽限流
- 或提供专用测试租户/测试用户池

### 6.2 SDK 修复建议

#### 建议 3：修复 `AccountManager` 装配链

优先检查：

- `createClient()` 自动初始化路径
- `manager-extensions` 初始化顺序
- `client.ts` 中 `getAccountManager()` 依赖是否总能注入
- 测试环境下 manager 扩展是否被异步初始化但未等待完成

建议增加：

- 针对 `client.login()` / `client.logout()` 的最小集成测试
- 对 manager 注入完整性的启动断言

#### 建议 4：修复 `lib/admin/index.js` 的错误导出

建议：

- 检查源码 `types.ts` 与生成产物是否一致
- 在构建后增加 `exports smoke test`
- 将 `lib` 入口加载纳入发布前校验

#### 建议 5：修复 teardown 异步导入问题

建议：

- 避免在测试结束后延迟触发 `identity-server` 动态导入
- 对 manager 初始化增加显式等待
- 对测试销毁阶段增加未完成任务收口

### 6.3 前端修复建议

#### 建议 6：调整 live E2E 的 `restore-token` 调用时机

当前问题点：

- `page.evaluate()` 中直接调用 `sessionOrchestrator.restoreWithAccessToken()`
- 但此时 Pinia 尚未完成激活

建议方案：

1. 等待应用完成 `app.use(pinia)` 再执行恢复
2. 或改为通过页面公开的 ready 标识后再调用
3. 或在测试注入中先显式导入并激活应用状态容器

#### 建议 7：为 live E2E 增加环境健康检查

在执行真实用例前先做：

- token 有效性检查
- homeserver 可达性检查
- room 是否存在检查
- 当前账号是否可发送消息检查

这样可以把“环境问题”和“前端逻辑问题”分层显示

---

## 七、未完成覆盖与原因说明

本次未能完成以下完整覆盖：

- 双账号收发联调
- 完整房间时间线同步
- 前端真实消息工作台全链路
- SDK 全量真后端功能模块
- 所有管理员、好友、搜索、加密、通知、媒体等高级模块的完整回归

未完成原因如下：

1. 后端房间链路已在核心路径上阻断
2. 服务端限流影响多账号/多次登录
3. SDK 登录链在 manager 层先失败
4. 前端 live E2E 在应用初始化阶段先失败

因此，本次报告重点不是“所有功能全部通过/失败统计”，而是准确识别导致全量联调无法展开的关键阻断点。

---

## 八、总体结论

当前 `https://matrix.test` 环境已经具备基础 Matrix API 服务能力，但尚不具备稳定支撑 HuLa 前端与本地 `matrix-js-sdk` 做完整真实联调回归的条件。

本次测试最关键的结论有三点：

1. **后端房间状态链路异常** 是当前最大的真实业务阻断点。
2. **SDK manager 装配链不完整** 使得多个真实测试在登录前就失败。
3. **前端 live E2E 会话恢复时序错误** 使真实浏览器联调无法稳定进入业务页面。

建议按以下顺序推进修复：

1. 先修后端房间创建/加入/发消息链路
2. 再修 SDK `AccountManager` 与发布产物导出问题
3. 最后修前端 `restore-token` live E2E 注入时序

待上述三项修复后，再重新执行：

- SDK 真后端测试全量回归
- 前端 `matrix-live.spec.ts`
- 双账号消息收发
- 房间时间线与状态同步校验

届时才能真正完成“所有功能模块”的系统性前后端联调验收。
