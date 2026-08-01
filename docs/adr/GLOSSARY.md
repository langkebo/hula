# Glossary — 登录与头像优化术语表

## Crypto 相关

| 术语 | 定义 |
|------|------|
| **Crypto Store** | Matrix SDK 在 IndexedDB 中存储的 E2EE 加密账户数据，数据库名为 `matrix-js-sdk::matrix-sdk-crypto` 和 `matrix-js-sdk::matrix-sdk-crypto-meta` |
| **initRustCrypto** | Matrix SDK 初始化 Rust 端加密引擎（Olm/Megolm），需要 crypto store 中的账户与当前登录设备的 deviceId 匹配 |
| **clearStaleCryptoStores** | 删除 IndexedDB 中的旧 crypto 数据库的函数，位于 `MatrixCryptoStateTracker.ts:286`。当前仅在 `initRustCrypto` 失败后的事后补救逻辑中调用 |
| **账户不匹配 (Account Mismatch)** | crypto store 中的账户 deviceId（如 `M5OTXrQ3Xfw7wm6M`）与当前登录设备的 deviceId（如 `Y0qMwV4hirQUx2bo`）不一致，导致 `initRustCrypto` 抛异常 |
| **IndexedDB onblocked** | 当 `deleteDatabase()` 被调用时，如果仍有打开的数据库连接（如 SDK 未释放），删除操作会被阻塞，直到所有连接关闭 |

## 登录流程相关

| 术语 | 定义 |
|------|------|
| **settlePostLoginStartup** | 登录后启动 MatrixClient 的函数，调用 `startClient()` + `refreshCapabilities()`，超时 15s（`POST_LOGIN_STARTUP_TIMEOUT_MS`） |
| **bootstrapPostLoginState** | 登录后后置状态初始化，包括 sync 等待、房间加载、presence 设置，不调用 `startClient()` |
| **waitSyncPrepared** | 等待 SDK sync 事件达到 `PREPARED`/`SYNCING` 状态的函数，超时 5s |
| **startClient** | Matrix SDK 客户端启动方法，初始化 crypto、注册事件监听、启动 SlidingSync |
| **SlidingSync** | Matrix MSC4186 同步协议，通过长轮询获取房间和事件增量 |
| **ConnectionState** | 连接状态机：DISCONNECTED → CONNECTING → CONNECTED → CATCHUP → SYNCING |
| **CATCHUP 状态** | 表示客户端正在追赶历史同步数据，UI 应显示"同步中" |

## 头像上传相关

| 术语 | 定义 |
|------|------|
| **convertFileSrc** | Tauri API，将本地文件路径（如 `/Users/user/photo.jpg`）转换为 WebView 可访问的 asset URL（如 `asset://localhost/...`） |
| **AvatarCropper** | 头像剪裁模态框组件，使用 VueCropper 库实现图片裁剪，包含本地图片和预设头像两种模式 |
| **finishLoading** | AvatarCropper 组件暴露的方法，重置内部 `loading` 状态为 false，由父组件通过 ref 调用 |
| **CROP_TIMEOUT_MS** | 本地图片剪裁路径的超时常量（10s），位于 AvatarCropper.vue:183。预设头像路径缺少对应超时 |
| **预设头像** | 系统内置的 22 个 WebP 格式头像（001-022），存储在 `public/avatar/` 目录 |
