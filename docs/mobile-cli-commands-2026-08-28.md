# Tjg 移动端启动 / 构建运行命令

> 适用版本：Tjg 3.0.10（Vue 3 + Vite 8 + Tauri 2.11.4）
> 平台：macOS（longjuanfengdeMac-mini，已验证）
> 路径：`/Users/ljf/Desktop/hu_ts/Tjg`

---

## 0. 前置依赖（一次性安装）

| 工具 | 用途 | 状态 |
|---|---|---|
| Node.js ≥22.12.0 | Vite/前端构建 | ✅ 已装 v22.22.2 |
| pnpm ≥10 | 包管理 | ✅ 已装 10.33.0 |
| Rust stable | Tauri Rust 后端 | ✅ 已装 1.94.0 |
| Android SDK | Android 编译/调试 | ✅ `/Users/ljf/Library/Android/sdk` |
| NDK 30.0.15729638 | Tauri 编译 aarch64 | ✅ |
| Android Studio Hedgehog+ | AVD 管理 | ✅ `/Applications/Android Studio.app` |
| Xcode（仅 iOS） | iOS 编译/模拟器 | macOS App Store 安装 |
| CocoaPods（仅 iOS） | iOS 依赖管理 | `sudo gem install cocoapods` |

> **关键**：Android 模拟器必须先在 `~/.android/avd/Medium_Phone.avd/config.ini` 中调高内存：
> ```ini
> hw.ramSize=4096
> vm.heapSize=512
> ```

---

## 1. 项目脚本（pnpm run …）

| 命令 | 平台 | 用途 |
|---|---|---|
| `pnpm dev` | 全平台 | 纯前端 Vite dev server（浏览器调试用） |
| `pnpm build` | 全平台 | 纯前端 build → `dist/` |
| `pnpm tauri:dev` / `pnpm td` | Desktop | **桌面** dev（Tauri + Vite 6130） |
| `pnpm tb` / `pnpm tauri:build` | Desktop | **桌面** production build |
| `pnpm adev` | Android | **Android** dev（模拟器/真机） |
| `pnpm idev` | iOS | **iOS** dev（macOS 模拟器） |
| `pnpm adev:reverse` | Android | **Android dev + adb reverse**（自动桥接端口） |
| `pnpm idev:mac-host` | iOS 真机 | iOS 真机提示（需手动配置 IP） |
| `pnpm adev:win` | Android | **Windows 调试用**，前端 dev 走 `TAURI_ENV_PLATFORM=android` |
| `pnpm idev:mac` | iOS | **macOS 调试用**，前端 dev 走 `TAURI_ENV_PLATFORM=ios` |

---

## 2. Android 启动 / 构建命令

### 2.1 dev 模式（推荐用于开发调试）

#### A. 模拟器（Android Emulator）

```bash
# 一次性：保证 AVD 内存 ≥ 4 GB
cat ~/.android/avd/Medium_Phone.avd/config.ini | grep hw.ramSize
# 若输出 hw.ramSize=2048 → 编辑为 4096

# 1. 启动模拟器（无窗口后台运行 + 冷启动数据）
/Users/ljf/Library/Android/sdk/emulator/emulator \
  -avd Medium_Phone \
  -no-window \
  -wipe-data \
  -no-snapshot-load \
  -no-audio \
  -no-boot-anim

# 2. 等待 adb 识别（约 30-45s）
/Users/ljf/Library/Android/sdk/platform-tools/adb wait-for-device
/Users/ljf/Library/Android/sdk/platform-tools/adb devices

# 3. 在项目根目录启动 Tauri dev（自动 adb reverse + 安装 APK + 启动 MainActivity）
cd /Users/ljf/Desktop/hu_ts/Tjg
pnpm adev:reverse
# 或: pnpm tauri android dev
# 或: pnpm adev
```

#### B. 真机（USB 调试）

```bash
# 1. USB 连接 Android 真机 + 开启 USB 调试
# 2. 确认设备已连接
adb devices
# 期望：xxxxxxxx device

# 3. 反向映射端口（让真机的 localhost:5210 → 宿主机 Vite）
adb -s <device-serial> reverse tcp:5210 tcp:5210

# 4. 启动 dev
cd /Users/ljf/Desktop/hu_ts/Tjg
pnpm tauri android dev --device <device-serial>
```

### 2.2 production build（发布包）

```bash
# 1. 前端 build
cd /Users/ljf/Desktop/hu_ts/Tjg
pnpm build

# 2. Tauri Android 打包（生成 .apk / .aab）
pnpm tauri android build

# 产物路径：
# - src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk
# - src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```

### 2.3 常用辅助命令

```bash
# 实时日志（WebView 控制台 + tauri）
adb -s emulator-5554 logcat | grep -iE "tauri|chromium|console"

# 截屏
adb -s emulator-5554 exec-out screencap -p > /tmp/screen.png

# 查看应用是否在前台
adb -s emulator-5554 shell 'dumpsys window | grep mCurrentFocus'

# 强制停止 + 重启
adb -s emulator-5554 shell am force-stop com.tjg.app
adb -s emulator-5554 shell am start -n com.tjg.app/.MainActivity

# 卸载
adb -s emulator-5554 uninstall com.tjg.app
```

---

## 3. iOS 启动 / 构建命令

> ⚠️ **必须 macOS + Xcode 已安装**

### 3.1 dev 模式

#### A. 模拟器（iOS Simulator）

```bash
# 1. 启动 iOS 模拟器（任选一机型）
open -a Simulator
# 或指定机型：
xcrun simctl boot "iPhone 15"
open -a Simulator

# 2. 在项目根目录启动 Tauri iOS dev
cd /Users/ljf/Desktop/hu_ts/Tjg
pnpm tauri ios dev
# 或: pnpm idev
```

iOS 模拟器与宿主机共享 loopback，`localhost:5210` 直接可用，无需端口反向映射。

#### B. 真机（iPhone / iPad）

```bash
# 1. USB 连接 + 在 Xcode 中配置开发者证书
# 2. 改 tauri.conf.json 的 devUrl 为 Wi-Fi IP（真机不能走 localhost）
# 编辑 src-tauri/tauri.conf.json:
#   "devUrl": "http://192.168.1.100:5210"  ← 替换为你的 Mac 实际 IP

# 3. 启动 dev
cd /Users/ljf/Desktop/hu_ts/Tjg
pnpm tauri ios dev --device <device-udid>
# 或: pnpm idev
```

### 3.2 production build

```bash
# 1. 前端 build
cd /Users/ljf/Desktop/hu_ts/Tjg
pnpm build

# 2. Tauri iOS 打包
pnpm tauri ios build
# 产物：src-tauri/gen/apple/build/...
```

### 3.3 常用辅助命令

```bash
# 查看可用模拟器
xcrun simctl list devices available

# 截屏
xcrun simctl io booted screenshot /tmp/ios.png

# 实时日志
xcrun simctl spawn booted log stream --predicate 'process == "Tjg"'
```

---

## 4. 桌面端（参考）

> 桌面端不依赖移动平台，仍是默认的 Vite 6130 + Tauri。

```bash
# 开发
pnpm tauri:dev   # 或 pnpm td

# 打包
pnpm tb          # 交互式选择 platform/target
# 或
pnpm tauri:build
```

---

## 5. 常见问题速查

| 错误 | 原因 | 解决 |
|---|---|---|
| `adb: device 'emulator-5554' not found` | adb server 重启过，缓存不一致 | 重启模拟器：`adb kill-server && adb start-server` |
| `lowmemorykiller: Kill 'com.tjg.app'` | 模拟器 RAM 不够 | 调高 `hw.ramSize` 到 4096 MB |
| Vite ready 但 WebView 空白 | 端口没反向映射 | 手动 `adb reverse tcp:5210 tcp:5210` |
| iOS 真机连不上 | `devUrl` 还是 localhost | 改 `devUrl` 为 Mac 实际 IP（同一 Wi-Fi） |
| iOS build 卡在 `pod install` | CocoaPods 缓存问题 | `cd src-tauri/gen/apple && pod install --repo-update` |

---

## 6. 启动流程图

```
┌─────────────────────────────────────────┐
│ 1. pnpm install（首次）                  │
│ 2. 启动模拟器 / 连接真机                 │
│ 3. adb reverse tcp:5210 tcp:5210（Android）│
│ 4. cd /Users/ljf/Desktop/hu_ts/Tjg      │
│ 5. pnpm tauri android dev（Android）     │
│    pnpm tauri ios dev（iOS）             │
│    pnpm tauri:dev（Desktop）             │
└─────────────────────────────────────────┘
         ↓
Tauri CLI 自动执行：
  - beforeDevCommand → pnpm dev（启动 Vite 5210/6130）
  - Cargo build（编译 Rust 后端）
  - Gradle build（Android）
  - pod install + xcodebuild（iOS）
  - adb install + am start（Android）
  - simctl install + launch（iOS）
```
