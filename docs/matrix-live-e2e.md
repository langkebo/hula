# Matrix Live E2E

这套用例用于把桌面端 Playwright 接到真实 Matrix Homeserver，验证不依赖 `AppHarness` seed 的登录、会话加载和加密消息链路。

## 设计边界

- 保留 `hula:e2e:enabled=1`，继续复用浏览器里的 Tauri runtime mock。
- 显式关闭 `hula:e2e:mock-auth` 和 `hula:e2e:seed-workbench`，避免假登录态和假房间污染真实 E2EE。
- 真实 Matrix 模式与现有 `desktop-key-flows` 分离，单独跑 `e2e/matrix-live.spec.ts`。
- 不强绑本地 Docker，也不假设 Synapse 一定在本机启动；环境由外部注入。

## 环境变量

最小必填：

```bash
MATRIX_LIVE_E2E=1
MATRIX_LIVE_HOMESERVER_URL=http://127.0.0.1:28008
MATRIX_LIVE_USERNAME=alice
MATRIX_LIVE_PASSWORD=secret
```

可选：

```bash
MATRIX_LIVE_APP_URL=http://127.0.0.1:5210
# 可留空；仅在你的部署单独提供 identity server 时再设置
MATRIX_LIVE_IDENTITY_SERVER_URL=
MATRIX_LIVE_AUTH_STRATEGY=password-api
MATRIX_LIVE_DISPLAY_NAME=Alice
MATRIX_LIVE_ROOM_ID=!encryptedRoom:example.com
MATRIX_LIVE_ROOM_NAME=E2EE Probe Room
MATRIX_LIVE_EXPECTED_TIMELINE_TEXT=hello from bob
MATRIX_LIVE_MESSAGE_PREFIX=[pw-matrix-live]
```

`MATRIX_LIVE_AUTH_STRATEGY` 支持三种模式：

- `password-api`：直接调用前端现有 `loginWithPassword()`，默认推荐，最稳定。
- `ui`：通过登录页输入账号密码，再等待前端登录完成。
- `restore-token`：预注入 `access token` 恢复会话，需要额外提供：

```bash
MATRIX_LIVE_USER_ID=@alice:example.com
MATRIX_LIVE_ACCESS_TOKEN=...
MATRIX_LIVE_REFRESH_TOKEN=...
```

如果要启用双账号真实收发与解密校验，再额外提供第二套账号：

```bash
MATRIX_LIVE_PEER_USERNAME=bob
MATRIX_LIVE_PEER_PASSWORD=secret
MATRIX_LIVE_PEER_DISPLAY_NAME=Bob
```

双账号 `restore-token` 模式则改为：

```bash
MATRIX_LIVE_PEER_USER_ID=@bob:example.com
MATRIX_LIVE_PEER_ACCESS_TOKEN=...
MATRIX_LIVE_PEER_REFRESH_TOKEN=...
```

## 运行方式

```bash
pnpm test:e2e:matrix-live
```

## 当前覆盖

- 真实 homeserver 登录并进入桌面端消息页。
- 真实会话列表加载。
- 向已配置加密房间发送一条探针消息。
- 校验指定房间中预期的解密后文案已经进入时间线 store。
- 如果配置了第二账号，则额外验证跨账号同步与解密。

## 下一步

- 抽成正式 Playwright fixture，统一管理主账号、第二账号和共享房间上下文。
- 如果需要完全自动化建房，可在后续增加外部脚本或 `globalSetup` 负责测试账号、加密房间和初始消息引导。
