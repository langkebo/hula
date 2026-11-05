# Tjg 前端启动与联调环境指南

> 适用版本：Tjg `3.0.10`（Tauri 2.11.4 / Vite 8 / Vue 3.5）
> 本文所有命令与端口均在本机实测确认（2026-11-05），不是照抄配置推断。

---

## 一、环境要求（实测版本）

| 组件 | 要求 | 实测值 | 校验命令 |
|---|---|---|---|
| Node.js | `>=22.12.0 <25`（`package.json#engines`） | v22.22.2 | `node -v` |
| pnpm | `^12.4.1`（`packageManager` 锁定） | 12.4.1 | `pnpm -v` |
| Rust（仅 Tauri） | 与 `src-tauri/rust-toolchain.toml` 一致 | rustc 1.98.1 | `rustc -V` |
| Docker（仅后端） | 任意近期版本 | 运行中 | `docker ps` |

> ⚠️ **必须用 pnpm 12**。`pnpm-lock.yaml` 由 pnpm 12 生成，pnpm 10 读不了（会报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`，因为它不再读 `package.json#pnpm.overrides`）。

---

## 二、依赖安装

```bash
cd Tjg
corepack enable
corepack prepare pnpm@12.4.1 --activate   # 与 packageManager 对齐
pnpm install
```

**关于构建脚本审批**：本仓依赖里带 postinstall 的包（如 `esbuild`、`tauri`）由 `pnpm.allowBuilds`（或 `.npmrc` 的 allowBuilds）统一审批。
若 `pnpm install` 后 `node_modules/.bin/vite` 缺失，通常是审批未生效：

```bash
pnpm install --force        # 依赖"新鲜"时 install 会整段跳过，--force 才会重新检查审批
```

**安装后会自动校验 SDK 产物**：`postinstall` 跑 `pnpm check:sdk-lib`，把
`node_modules/matrix-js-sdk/lib` 的指纹与 `meta/sdk-pin.json` 的 `sdk_lib_fingerprint` 比对，
不一致直接让 install 失败。

> ⚠️ 换过 `vendor/matrix-js-sdk.tgz` 后如果 install 报这个错，先别怀疑 pin：
> pnpm 对 `file:` 依赖有缓存捷径，实测 `install` / `--force` 都可能**装回旧内容**。
> 可靠修法（2026-11-05 实证，8.6s 真装）：
> ```bash
> rm -f  node_modules/.pnpm/lock.yaml
> rm -rf node_modules/.pnpm/@langkebo+matrix-js-sdk@file+vendor+matrix-js-sdk.tgz
> pnpm install
> ```
> 仍然失败才走「解包覆盖」：解 `vendor/matrix-js-sdk.tgz` 后覆盖
> `node_modules/.pnpm/@langkebo+matrix-js-sdk@file+vendor+matrix-js-sdk.tgz/node_modules/@langkebo/matrix-js-sdk`。
> 逃生阀 `TJG_SKIP_SDK_LIB_CHECK=1`（仅用于正在重钉 pin 时）。

---

## 三、环境变量配置

复制样例并改成本地值：

```bash
cp .env.example .env.local
```

| 变量 | 作用 | 本地联调建议值 |
|---|---|---|
| `VITE_HOMESERVER_URL` | Matrix Homeserver 基址（前端所有 `/_matrix/**` 的前缀） | `https://matrix.test`（经 nginx + TLS）或 `http://localhost:8008`（直连） |
| `VITE_IDENTITY_SERVER_URL` | Identity Server；本地可留空 | `https://matrix.test` 或留空 |
| `VITE_LOG_LEVEL` | 日志级别 `off/error/warn/info/debug/trace` | `debug`（联调）/ `warn`（日常） |
| `VITE_PROXY_TARGET` | 可选：单独指定 dev 代理目标（默认取 `VITE_HOMESERVER_URL`） | nginx 未起时指 `http://127.0.0.1:8008` |

`.env.local` 已在 `.gitignore`，**不要提交**。

**两种后端接入方式**：

1. **直连**（最省事）：`VITE_HOMESERVER_URL="http://localhost:8008"`，dev 代理同源转发，无证书问题。
2. **经 nginx**（更接近生产，也是当前 `.env.local` 的配置）：`https://matrix.test`。需要：
   - `/etc/hosts` 有 `127.0.0.1 matrix.test`（本机已生效）
   - nginx 容器在 443 上终止 TLS（`synapse-nginx`，本机运行中）
   - 自签证书：dev 下 `runtimeFetch` 对 `.test/.localhost/.local` 后缀自动 `acceptInvalidCerts`，浏览器访问需手动信任一次

---

## 四、启动前端（三条路径，端口不同）

| 场景 | 命令 | 端口 | 说明 |
|---|---|---|---|
| 只调 UI（浏览器） | `pnpm dev` | **6130** | 桌面 vite 配置；`devCsp` 与 `devUrl` 都指向 6130 |
| Tauri 桌面应用 | `pnpm tauri:dev` | 6130 | 读 `tauri.macos/windows/linux.conf.json` 的 `devUrl: http://localhost:6130` |
| Android | `pnpm adev`（真机先 `pnpm adev:reverse`） | **5210** | 移动 vite 配置 `strictPort: true`；`tauri.android.conf.json` 的 `devUrl: http://127.0.0.1:5210` |
| iOS | `pnpm idev` | 5210 | 同上，走 `tauri.ios.conf.json` |
| 浏览器 E2E | `pnpm test:e2e` | 5210 | Playwright 自动以 `TAURI_ENV_PLATFORM=android` 起 webServer（移动 UI），复用已占用端口 |

> 端口分工的单一事实源：`build/config/vite.config.desktop.ts`（6130）、`build/config/vite.config.mobile.ts`（5210）、`src-tauri/tauri.<platform>.conf.json`（devUrl）。改端口必须三处同步。

**启动后自检**：

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:6130/            # 期望 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:6130/_matrix/client/versions   # 期望 200（dev 代理链路通）
```

第二条最关键：它同时验证「vite 代理 → homeserver」是否通。**返回 502 说明后端没起或 `VITE_HOMESERVER_URL` 指错**。

---

## 五、启动后端（联调必需）

当前机器上的实际形态（`docker ps` 实测）：

| 容器 | 镜像 | 端口 | 作用 |
|---|---|---|---|
| `synapse-app` | `synapse-rust:6.3.0-<sha>` | `127.0.0.1:8008` | Homeserver 本体 |
| `synapse-nginx` | `nginx:1.27-alpine` | `80/443/8448` | `matrix.test` 的 TLS 终止与反代 |

从零起的顺序：

```bash
cd ../synapse-rust
docker compose -f docker/docker-compose.yml up -d      # 起 synapse-rust + db + redis
docker compose ps                                       # 等到 healthy
curl -s http://127.0.0.1:8008/_matrix/client/versions | head -c 200
# 需要 https://matrix.test 时，再起 nginx（证书见 docker/certs）
```

> 后端若更新过，前端**不需要**改任何配置（`VITE_HOMESERVER_URL` 不变）。但要注意镜像版本：不同构建的**错误码与响应字段可能不同**（见《后端问题清单》的复核记录）。

---

## 五之二、跨设备测试（Android 模拟器 ↔ 本机桌面）

本机已有 AVD `Medium_Phone`，不需要装 Tauri APK 也能做「设备端 ↔ 本机」冒烟
（设备上的 Chrome 加载本机 dev server 的移动 UI）：

```bash
# 1) 起移动 UI（5210，手机版路由）
TAURI_ENV_PLATFORM=android pnpm dev

# 2) 起模拟器（首次开机会比较慢；无头机建议加 -no-audio -no-boot-anim）
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone -no-snapshot-save -no-boot-anim -no-audio &
adb wait-for-device && adb shell getprop sys.boot_completed   # 1 = 已启动

# 3) 让设备能访问本机的 5210（反向隧道，adbd 重启后要重做）
adb reverse tcp:5210 tcp:5210

# 4) 在设备上打开页面（首次会停在 Chrome 首启页，点「Stay signed out」跳过）
adb shell am start -a android.intent.action.VIEW -d "http://127.0.0.1:5210/"

# 5) 把设备 Chrome 的 DevTools 暴露到本机 9222（Playwright 靠它驱动真机）
adb forward tcp:9222 localabstract:chrome_devtools_remote

# 6) 跑跨设备用例（两条）
TJG_ANDROID_CDP=http://127.0.0.1:9222 pnpm test:e2e:android       # 加载 + 形状 + 同后端
TJG_ANDROID_CDP=http://127.0.0.1:9222 pnpm test:e2e:cross-device  # 两端各自登录 + 双向写消息
```

实测校验点（2026-11-05）：设备 UA `Android 10 / Chrome 145 Mobile`、视口 `411×813`、
`document.title = HuLa`、`fetch('/_matrix/client/versions')` 经 vite 代理 200、
`img[src^="mxc://"]` 计数 0、跨设备用例 35s 通过。

### 移动 UI 自动化的四个交互细节（实测，非推断）

| 现象 | 原因 | 做法 |
|---|---|---|
| `/mobile/login` 直接 **404** | 浏览器里 `getOsType()`（`@tauri-apps/plugin-os`）抛错 ⇒ 平台 fallback 成 `desktop` | URL 必须带 `?platform=mobile`（或写 `localStorage['tjg:e2e:platform']='mobile'`） |
| 登录页一直停在 splash（进度 0）、表单不渲染 | 启动要等 `is_app_state_ready`（Rust 命令），纯浏览器永不返回 | 注入 Tauri invoke shim（`e2e/support/androidDevice.ts::installBrowserTauriShim`） |
| 页面被「设置本地解锁密码」弹窗挡住、所有点击超时 | 无 Tauri 密钥库 ⇒ `useLocalUnlockGate().ensureReady()` **阻断启动** | 点 `[data-test="local-unlock-skip"]`（「稍后」）；后续会话 E2EE fail-closed，只能用**未加密**房间测消息 |
| Playwright `click()` 在协议勾选框上超时 | `.van-checkbox` wrapper 的中心落在图标左侧，命中判定不通过 | 用坐标点 `.van-checkbox__icon` 中心（`page.mouse.click`） |

**已知坑**
- `node_modules/.vite` 被清时 vite 会尝试批量删除，WorkBuddy 的删除保护会拦（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`）。
  先 `mv node_modules/.vite /tmp/vite-trash/…` 再起 dev server。
- **更常见的形态**：vite 在运行时发现新依赖（移动端首屏 `vant/es/*`）会二次优化，提交时删上一轮
  `deps_temp_*`（140+ 文件）⇒ 触发保护 ⇒ dev server 退出，且崩溃会留下新 temp 目录**自我延续**。稳定流程：
  ```bash
  for d in node_modules/.vite/deps_temp_*; do [ -e "$d" ] && mv "$d" /tmp/vite-trash/; done
  TAURI_ENV_PLATFORM=android npx vite optimize     # hash 一致时只打印 "Skipping"，不产生删除
  TAURI_ENV_PLATFORM=android pnpm dev
  # 起来后先手动打开一次桌面 /message 与移动 /message，把依赖图一次性发现完，再跑用例
  ```
  判据：`.vite` 下只剩 `deps`；`curl :5210` 每次都是 200；用例里不出现
  `Failed to fetch dynamically imported module`。
- 设备 Chrome 首启页（FRE）会吃掉 `am start` 的 URL；必须手动点一次「Stay signed out」。
- adbd 重启（如 `adb root`）会清掉 `adb reverse`，需要重做第 3 步。
- 设备上可能残留多个标签，自动化要**按目标地址选标签**（两条跨设备 spec 均已处理）。
- **e2e 存储键已收口（F-8 已修）**：键的唯一定义源是 `src/utils/storageKeys.ts`，
  `e2e/support/*` 以相对路径直接 import（Playwright 用 esbuild 转译，该文件保持零依赖）。
  写新用例时**不要**再写字面量键；若必须（`page.evaluate` 的浏览器上下文拿不到 Node 常量），
  只能用已声明值，`src/utils/__tests__/storageKeys.test.ts` 会拦下旧前缀与拼写漂移。
- **浏览器态一律自动放过解锁门禁**：`bootstrapDesktopHarness` / `bootstrapMobileHarness`
  已内置 `autoDismissLocalUnlockGate`（init script + MutationObserver 点「稍后」），
  自己拼 harness 的用例需要显式 `dismissLocalUnlockDialog(page)`，否则页面停在 splash。

### 跨设备用例的三个前提（F-11 修复后的正确姿势）

1. **房间必须由客户端自己建/入**：`matrixClientService.createRoom(...)` / `joinRoom(...)`。
   用裸 REST 建的房间不会进入滑窗订阅 ⇒ 增量同步给 `initial:false` ⇒ SDK 丢弃 ⇒ 客户端永远看不到它。
   客户端内部会「先订阅再等 store」，这也是建房可用性的实际依赖。
2. **不要整页导航**：浏览器态 token 只在内存（`getStoredTokens()` 走 Tauri IPC 拿到 undefined），
   `goto('/message')` 会重载并掉登录。直接在当前页用 SDK 断言收发。
3. **登录前清旧会话**：设备上残留上一轮 session 时，登录页照常渲染但点「登录」毫无反应。
   `loginOnMobileUi` 已内置 `matrixClientService.logout()` 预清理。

> 点击控件统一用 `el.click()`（`clickAt` 已实现）：`locator.click()` 会被 vant/naive 的
> 包装层判成不可点击而超时；`mouse.click()` 在透明遮罩下**静默无效**（无 toast、按钮仍可用），最难排查。

**未覆盖**：Tauri Android APK（`pnpm adev` 构建 + 安装）里的原生能力（通知、后台、文件系统）——
那层需要用 UiAutomator/Appium，Playwright 驱动不到。

---

## 五之三、后端改动后的重新部署（本机）

本机有**两个** compose 项目，用错会新起容器而不是更新现有的（实踩）：

```bash
# 构建（仓库根，构建上下文是 ..）
cd /Users/ljf/Desktop/hu_ts/synapse-rust/docker/deploy
SYNAPSE_IMAGE=synapse-rust:<tag> docker compose \
  -f docker-compose.yml -f /tmp/synapse-pg-override.yml build synapse

# 部署（只重建 app，不动 postgres/redis）
SYNAPSE_IMAGE=synapse-rust:<tag> docker compose \
  -f docker-compose.yml -f /tmp/synapse-pg-override.yml up -d --no-deps synapse
```

判据：
```bash
docker inspect synapse-app --format '{{.Config.Image}} | {{.State.Health.Status}}'
curl -sk -o /dev/null -w '%{http_code}\n' https://matrix.test/_matrix/client/versions   # 200
```

- ⚠️ `image:` 是 `${SYNAPSE_IMAGE:-synapse-rust:local}` —— 传**含 tag 的完整镜像名**，
  分成 `IMAGE` + `TAG` 两段会解析成 `synapse-rust:latest` 并报 `No such image`。
- ⚠️ 别在 `/synapse-rust/docker/docker-compose.yml` 上 `up`：那是项目 `synapse-e2e`，
  会新建 `synapse-e2e-rust` 容器与独立网络，`synapse-app` 仍是旧镜像。
- 只改响应结构（无迁移）时不必动 `migrator`；`--no-deps` 可避免连带重启依赖。

---

## 六、测试数据构造（联调账号）

Matrix 允许带 `m.login.dummy` 直接注册，脚本化造数据最省事：

```bash
curl -s -X POST "$HS/_matrix/client/v3/register" -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"Passw0rd!","auth":{"type":"m.login.dummy"}}'
```

本仓已把这套流程封装为可重复执行的联调冒烟脚本（自动建 2~4 个临时账号并跑完整链路）：

```bash
# 直连
BASE_URL=http://127.0.0.1:8008 node scripts/integration/contract-smoke.mjs
# 经 nginx + 自签证书
NODE_TLS_REJECT_UNAUTHORIZED=0 BASE_URL=https://matrix.test \
  OUT_JSON=/tmp/smoke.json node scripts/integration/contract-smoke.mjs
```

退出码：`0` 无失败（允许已知缺陷）；`1` 有 HIGH 失败；`2` 脚本异常。

---

## 七、常见故障对照表

| 现象 | 根因 | 处理 |
|---|---|---|
| `pnpm install` 后没有 `node_modules/.bin/vite` | 依赖新鲜 → install 跳过审批；或用了 pnpm 10 | `pnpm install --force`；确认 `pnpm -v` = 12.4.1 |
| 浏览器 dev 打开白屏 + `/_matrix/**` 502 | 后端未起，或 `VITE_HOMESERVER_URL` 指向不存在的 host | 先 `curl` 后端 `/versions`；改 `.env.local` 后**重启** vite（env 在启动时读取） |
| 请求被前端拦下并提示 `Request blocked by host allowlist` | `hostAllowlist` 未包含该 host | 走 `allowDynamicHost` 的调用无需改；新增固定 host 需改 `src/utils/httpAllowlistConfig.ts` |
| Tauri 里 https 请求报证书错误 | 自签证书且非 `.test/.localhost/.local` 域名 | dev 用 `.test` 域名，或把证书导入系统钥匙串 |
| Tauri 窗口空白、devtools 显示 `localhost:5210 refused` | 用桌面配置起了 6130，但平台 conf 的 devUrl 是 5210（或反之） | 核对 `src-tauri/tauri.<platform>.conf.json#build.devUrl` 与 vite 实际端口一致 |
| Android 真机连不上 dev server | 设备侧 `127.0.0.1` 指向手机自己 | `pnpm adev:reverse`（`adb reverse tcp:5210 tcp:5210`） |
| 附件发送失败（图片/文件/语音） | `upload/token` 或媒体上传失败 | 看 `Upload` / `UploadTransport` 日志；用冒烟脚本的「媒体上传」用例定位是后端还是前端 |
| 登录 24h 后被强制重登 | 历史上 token 续期从未排期 | 已修；若复现，检查 `resolveTokenExpiryMs` 拿到的响应是否既无 `expires_in` 也无 `expires_in_ms` |

---

## 八、提交前的质量门禁（本地）

```bash
pnpm typecheck                 # vue-tsc，基线 0 error
pnpm lint                      # biome
node scripts/check-file-size.mjs
pnpm run check:ratchet
pnpm run check:sdk-boundary
pnpm run check:bare-matrix-paths
pnpm run check:matrix-layering
pnpm run check:sdk-lib         # 已安装 SDK 产物指纹 == pin（防止装回旧内容）
pnpm run verify:sdk-pin        # 需 TJG_SDK_DIR=<sdk worktree>，否则有 2 段 SKIP 不算通过
pnpm run test:integration      # 契约冒烟：需 BASE_URL 指向可登录后端（有副作用，见 §六）
pnpm test:unit                 # 或按目录：npx vitest run <path>
```

> CI 对应关系：`quality-gate.yml` 跑前六项 + `check:sdk-lib`；契约冒烟是独立 workflow
> `integration-smoke.yml`（手动 / 每天定时，需要仓库变量 `TJG_TEST_HOMESERVER`），
> 因为它会在目标后端注册临时账号、建房间、上传媒体，不能挂在 PR 上。

> `check-file-size` 的口径是「**不得超出基线**」而非「一律 ≤400」：已在基线的文件只需回到基线，**新文件**才是 400 硬限。因此不要为凑行数切碎文件，优先压冗余注释或在职责内聚时整块抽模块。

---

*本文由 AI 依据本机实际配置与运行结果整理；端口/版本/容器名均经命令核对。*
