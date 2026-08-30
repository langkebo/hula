# Android / iOS dev 模式排查手册

> 日期：2026-08-28
> 适用版本：Tjg 3.0.10（Vue 3 + Vite 8 + Tauri 2.x）
> 范围：`pnpm tauri android dev` / `pnpm tauri ios dev` 跑出来非移动端登录页的根因与修复

---

## 1. 背景

移动端登录页（`src/mobile/login.vue`）在 Android 模拟器跑出来后显示为 Vite / Wry 占位页（截图里类似 "Enter password / Login / Forget" 的简单输入框），与原型 `docs/TJG-prototype.html` 第 7231 行的 `mLoginView` 严重不一致。

**根因**：`tauri.conf.json` 的 `devUrl: "http://localhost:6130"` 指向 desktop Vite dev server，但 `vite.config.mobile.ts` 实际跑在 5210 端口；Android 模拟器的 `localhost` 指向自身，连不上 Vite → WebView 降级到 fallback 页。

---

## 2. 修复后的链路

| 组件 | 配置 | 说明 |
|---|---|---|
| `src-tauri/tauri.conf.json` | `devUrl: "http://localhost:5210"` | dev 模式加载 mobile Vite server |
| `src-tauri/tauri.conf.json` | CSP `connect-src` 追加 5210/10.0.2.2/127.0.0.1 主机白名单 | 放行 Vite HMR ws + 静态资源 |
| `build/config/vite.config.mobile.ts` | `server.strictPort: true` / `host: '0.0.0.0'` / `cors: true` | 端口稳定、监听全网卡、跨源放行 |
| `package.json` | `pnpm adev:reverse` | 自动 `adb reverse tcp:5210 tcp:5210` |

---

## 3. 启动步骤

### 3.1 Android 模拟器

```bash
# 1. 启动 Android 模拟器
emulator -avd <Your_AVD_Name>

# 2. 一键启动（推荐）—— 自动 adb reverse + 启动 tauri android dev
pnpm adev:reverse

# 3. 备选：手动反向代理
adb reverse tcp:5210 tcp:5210
pnpm adev
```

**真机调试**：

```bash
# 真机需要 Wi-Fi 局域网直连
# 1. 查宿主机 IP（macOS/Linux）
ifconfig | grep "inet " | grep -v 127.0.0.1

# 2. 临时改 tauri.conf.json devUrl 为 http://<宿主 IP>:5210
# 3. 真机需装 https://<宿主 IP>:5210 上的 dev cert
```

### 3.2 iOS 模拟器

```bash
# iOS 模拟器与宿主机共享 loopback，localhost:5210 直接可用
pnpm idev
```

**iOS 真机**：

```bash
# 改用 Wi-Fi IP
# 临时改 tauri.conf.json devUrl 为 http://<宿主 IP>:5210
pnpm idev:mac-host  # 提示信息
```

### 3.3 桌面端（不变）

```bash
pnpm tauri:dev   # 或 pnpm td
# 走 vite.config.desktop.ts（端口 6130）
```

---

## 4. 常见问题排查

### Q1: 跑出来还是 Vite / Wry 占位页（WebView 加载失败）

**症状**：Android 模拟器显示 "Enter password / Login / Forget" 或空白，Launcher 里看不到应用图标。

**排查**：
```bash
# 1. 确认 dev server 真在 5210
lsof -i :5210

# 2. 确认 adb reverse 生效
adb -s emulator-5554 reverse --list
# 期望输出：tcp:5210 tcp:5210

# 3. 确认应用是否被安装
adb -s emulator-5554 shell 'pm list packages | grep tjg'
# 期望：com.tjg.app

# 4. 看 logcat
adb -s emulator-5554 logcat | grep -iE "tauri|webview|chromium|lowmemory|OOM"

# 5. 确认 APK 有 launcher activity
adb -s emulator-5554 shell 'monkey -p com.tjg.app -c android.intent.category.LAUNCHER 1'
# 期望："Events injected: 1"  若"No activities found" → manifest 问题
```

**修复**：
- `pnpm adev:reverse` 重新建立桥接
- 重启模拟器：`adb -s emulator-5554 reboot`
- 改 `tauri.conf.json` 的 `devUrl` 为 `http://10.0.2.2:5210`（部分定制镜像不支持 adb reverse）

### Q2: 应用在模拟器中启动后立即被杀掉（OOM）

**症状**：`logcat` 中看到 `lowmemorykiller: Kill 'com.tjg.app' ... reason: low watermark is breached`；Launcher 里应用图标闪了一下就消失。

**根因**：模拟器内存不够。AVD `Medium_Phone` 的 `config.ini` 默认 `hw.ramSize=2048`（仅 2 GB）+ `vm.heapSize=228`。Android Emulator 36.5.x 在 Mac mini 上实际可用约 4.9 GB，被系统占用后 Tauri WebView（Chromium + V8，约 200–300 MB）触发 OOM killer。

**修复（按效果排序）**：
1. **直接改 config.ini**（最有效）：`vim ~/.android/avd/Medium_Phone.avd/config.ini` → `hw.ramSize=4096`、`vm.heapSize=512` → `emulator -avd Medium_Phone -wipe-data -no-window` 冷启动
2. **Android Studio AVD Manager**：编辑 Medium_Phone → Memory: RAM 调至 6144 MB → Wipe Data 后重启
3. **关闭 macOS 其他应用**：关闭 Chrome、IDE、邮件等
4. **创建轻量 AVD**：用 `Pixel 5 API 36`（GPU 开销更小）
5. **真机调试**：USB 连接 Android 真机（无内存限制）

### Q3: 端口 5210 已被占用

**症状**：`strictPort: true` 后 Vite 启动报错。

**修复**：
```bash
# 查占用
lsof -i :5210

# 杀掉旧进程
kill -9 <PID>

# 或临时换端口（同步改 tauri.conf.json devUrl 与 vite.config.mobile.ts serverPort）
```

### Q3: HMR 不工作（移动端改了组件没热更新）

**症状**：改了 `.vue` 后模拟器不刷新。

**修复**：
```bash
# 1. 确认 ws://10.0.2.2:5210 走通
# 2. 检查 CSP connect-src 是否包含 ws://10.0.2.2:5210
#    当前已包含（见 src-tauri/tauri.conf.json:50）
# 3. 强制刷新 WebView：在模拟器里杀掉应用重开
```

### Q4: 模拟器显示登录页但背景色不对

**症状**：能跑出 mobile/login.vue 但背景是白色而非深绿。

**排查**：
- 检查 Vant dark theme 是否生效：`MobileLayout.vue` 用了 `van-config-provider :theme="settingStore.themeContent === 'dark' ? 'dark' : 'light'"`
- 确认 `useSettingStore` 默认 `themeContent` 是 `'dark'`
- 检查 design-tokens.css 是否被 `main.ts` 引入

### Q5: 移动端登录后跳转失败

**症状**：登录成功但停留在 loading 态。

**排查**：
```bash
# 看 Tauri 事件流
adb -s emulator-5554 logcat | grep -iE "tauri|ipc|invoke"

# 确认 Matrix SDK worker 启动成功
# 搜索 'matrixSdk' 日志
```

---

## 5. 验证清单

启动后用以下命令快速验证：

```bash
# 1. 类型检查（不应新增错误）
pnpm typecheck

# 2. Lint 检查
pnpm check

# 3. 单元测试（不应回归）
pnpm test:run

# 4. 端到端验证
# - 启动模拟器 → pnpm adev:reverse
# - 截图比对 docs/TJG-prototype.html 第 7231 行 mLoginView
# - 确认能跳到 /mobile/home（登录后）
```

---

## 6. 与 i18n / 设计 token 的对齐

- 移动端登录文案走 `useI18n().t('login.mobile.*')`，i18n key 见 `locales/zh-CN/login.json`
- 颜色 token 必须用 `--tjg-*` 系列（见 `src/styles/css/design-tokens.css`），禁止用裸 `--bg-*` / `--text-*`
- 渐变按钮走 `class="gradient-button"`，样式见全局 SCSS

---

## 7. 相关文件索引

| 路径 | 说明 |
|---|---|
| `src-tauri/tauri.conf.json` | Tauri 主配置（devUrl / CSP） |
| `build/config/vite.config.mobile.ts` | 移动端 Vite 配置（server 块） |
| `build/config/vite.config.desktop.ts` | 桌面端 Vite 配置（未改） |
| `package.json` | scripts 段（adev / idev / adev:reverse） |
| `src/mobile/login.vue` | 移动端登录页（路由 /mobile/login） |
| `src/mobile/components/login/MobileLoginForm.vue` | 登录表单子组件 |
| `src/mobile/components/MobileLayout.vue` | 移动端布局壳（含 safe area） |
| `src/router/routes/mobile.ts:124-134` | 移动端路由根 redirect → `/mobile/login` |
| `src/router/authGuard.ts:54` | mobile 平台登录路径 `/mobile/login` |
| `docs/TJG-prototype.html:7231` | 原型 mLoginView 参考实现 |
