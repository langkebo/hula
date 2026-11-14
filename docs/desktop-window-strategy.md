# 桌面窗口策略（声明 / 标题栏 / 拖拽 / 尺寸）

本文是桌面端（Windows / macOS / Linux）窗口行为的唯一约定，对应审计项 C-05、C-06。
新增窗口前先读本文，避免三平台配置各写一套。

## 1. 窗口声明策略（C-05）

统一为「**首屏显式声明，其余运行时创建**」：

| 窗口 | 创建方式 | 位置 |
| :--- | :--- | :--- |
| `login` | 配置文件显式声明（首屏引导，必须尽早可见） | `src-tauri/tauri.conf.json` 及 `tauri.windows.conf.json` / `tauri.macos.conf.json` / `tauri.linux.conf.json` |
| `home` | 运行时创建 | `src-tauri/src/desktops/` + `src/composables/common/useWindow.ts` |
| `tray` | 运行时创建 | `src-tauri/src/desktops/tray.rs`（Windows/Linux 自绘托盘，macOS 用原生菜单） |
| `message` / `settings` / `onlineStatus` / `rtcCall` / `capture` 等 | 运行时创建 | `src/composables/common/useWindow.ts`、`src/composables/common/windowRtc.ts` |

约束：

- 平台配置文件**只允许**出现 `login`，不得再声明 `tray`、`checkupdate` 等窗口（历史上 Linux 曾额外声明，已删除）。
- macOS 托盘使用原生 `TrayIcon` 菜单，不创建 `tray` 窗口；Windows/Linux 的 `tray` 窗口由 `ensure_tray_window` 懒创建并常驻复用。
- 托盘窗口常驻意味着状态会过期：每次弹出前必须由 Rust 重新 `emit_to("tray", "tray_state_sync", isLoggedIn)`，前端据此同步菜单。

## 2. 标题栏策略（C-06）

平台差异由 `src/composables/common/windowHelpers.ts` 的共享常量承载，禁止各窗口手写裸字段：

- `macTitleBarOptions`：仅 macOS 返回 `{ titleBarStyle: 'overlay', hiddenTitle: true }`，其他平台为空对象。
- `macAllWorkspacesOptions`：仅 macOS 返回 `{ visibleOnAllWorkspaces: true }`，用于截图等需要常驻可见的窗口。

使用方式：

```ts
new WebviewWindow(label, {
  // ...其他窗口配置
  ...macTitleBarOptions
})
```

`titleBarStyle: 'overlay'` 只在 macOS 生效；Windows/Linux 的标题栏完全由 `decorations` 控制，传入 overlay 不会报错但没有任何效果，属于易误读配置，因此统一收口。

macOS 红绿灯按钮位置由 `set_macos_traffic_lights_spacing` 统一设置，窗口获得焦点时会重新应用（见 `init.rs` 的 `WindowEvent::Focused`）。

## 3. 拖拽区域

- 使用 `data-tauri-drag-region` 标记可拖拽区域，不要覆盖标题栏整条区域：交互元素（按钮、输入框、标签页）必须排除在外，否则会吞掉点击。
- 自绘标题栏窗口（`decorations: false`）必须保证顶部存在一条连续的拖拽区域，高度与工具栏一致。
- macOS overlay 标题栏下，左侧需要为红绿灯预留间距（`MAC_TRAFFIC_LIGHTS_SPACING`），避免拖拽区压住按钮。

## 4. 统一尺寸

| 窗口 | 尺寸（逻辑像素） | 说明 |
| :--- | :--- | :--- |
| `tray` | 宽 130；未登录高 44 / 已登录高 356 | `tray.rs` 内统一，前端只监听 `resize-needed` |
| `onlineStatus` | 320 × 480 | 托盘「在线状态」入口 |
| `rtcCall` | 来电窗口不可缩放（`resizable: !isIncoming`） | label 固定，同一时间仅支持一路通话；已有窗口时提示并聚焦旧窗口 |
| `capture` | 运行时按屏幕物理尺寸铺满 | 需覆盖菜单栏（macOS 额外提升窗口层级） |

## 5. 相关守卫

```bash
pnpm vue-tsc --noEmit
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
pnpm check:file-size
```
