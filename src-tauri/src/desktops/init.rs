use crate::common::init::{CustomInit, init_common_plugins};
#[cfg(target_os = "macos")]
use crate::desktops::common_cmd::apply_macos_traffic_lights_spacing_default;
use tauri::{Emitter, Manager, Runtime, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

/// 解析深链参数中的房间 ID，支持三种写法（C-13）：
/// `tjg://room/!abc:server`、`tjg://room?id=!abc:server`、`tjg://room/!abc:server?foo=bar`。
fn parse_deep_link_room_id(args: &[String]) -> Option<String> {
    args.iter().find_map(|arg| {
        if !arg.get(..10)?.eq_ignore_ascii_case("tjg://room") {
            return None;
        }
        let rest = &arg[10..];
        let raw = if let Some(path) = rest.strip_prefix('/') {
            path.split(['?', '#']).next().unwrap_or_default()
        } else if let Some(query) = rest.strip_prefix('?') {
            query
                .split('&')
                .find_map(|pair| pair.strip_prefix("id="))?
                .split('#')
                .next()
                .unwrap_or_default()
        } else {
            return None;
        };
        // 部分终端/浏览器会把 `!` `:` 做百分号编码
        let room_id = raw
            .replace("%21", "!")
            .replace("%3A", ":")
            .replace("%3a", ":");
        (!room_id.is_empty()).then_some(room_id)
    })
}

pub trait DesktopCustomInit {
    fn init_webwindow_event(self) -> Self;

    fn init_window_event(self) -> Self;
}

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    // 初始化插件
    fn init_plugin(self) -> Self {
        let builder = init_common_plugins(self);

        // 桌面端特有的插件
        #[cfg(desktop)]
        let builder = builder
            .plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec!["--flag1", "--flag2"]),
            ))
            .plugin(tauri_plugin_single_instance::init(|app, args, _cmd| {
                // 二次实例携带的深链先下发定位房间，再聚焦主窗口（C-13）。
                // 未登录时没有 home 窗口，改投 login，由前端暂存到登录后再定位。
                if let Some(room_id) = parse_deep_link_room_id(&args) {
                    let target = if app.get_webview_window("home").is_some() {
                        "home"
                    } else {
                        "login"
                    };
                    if let Err(e) = app.emit_to(target, "deep-link-open-room", room_id) {
                        tracing::warn!("Failed to emit deep link room to {}: {}", target, e);
                    }
                }

                let windows = app.webview_windows();
                // 优先显示已存在的home窗口
                for (name, window) in windows {
                    if name == "home" {
                        if let Err(e) = window.show() {
                            tracing::warn!("Failed to show home window: {}", e);
                        }
                        if let Err(e) = window.unminimize() {
                            tracing::warn!("Failed to unminimize home window: {}", e);
                        }
                        if let Err(e) = window.set_focus() {
                            tracing::warn!("Failed to focus home window: {}", e);
                        }
                        break;
                    }
                }
            }))
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_window_state::Builder::default().build());

        // #[cfg(debug_assertions)]
        // let builder = builder.plugin(tauri_plugin_devtools::init());

        builder
    }
}

impl<R: Runtime> DesktopCustomInit for tauri::Builder<R> {
    // 初始化web窗口事件
    fn init_webwindow_event(self) -> Self {
        self.on_webview_event(|_, _event| ())
    }

    // 初始化系统窗口事件
    fn init_window_event(self) -> Self {
        self.on_window_event(|window, event: &WindowEvent| match event {
            WindowEvent::Focused(flag) => {
                #[cfg(target_os = "macos")]
                if *flag {
                    let app_handle = window.app_handle();
                    let _ = apply_macos_traffic_lights_spacing_default(window.label(), app_handle);
                }
                // 自定义系统托盘-实现托盘菜单失去焦点时隐藏
                #[cfg(not(target_os = "macos"))]
                if !window.label().eq("tray") && *flag {
                    if let Some(tray_window) = window.app_handle().get_webview_window("tray") {
                        let _ = tray_window.hide();
                    }
                }
                if window.label().eq("tray")
                    && !flag
                    && let Err(e) = window.hide()
                {
                    tracing::warn!("Failed to hide tray window: {}", e);
                }
                #[cfg(target_os = "windows")]
                if !window.label().eq("notify") && *flag {
                    if let Some(notify_window) = window.app_handle().get_webview_window("notify") {
                        let _ = notify_window.hide();
                    }
                }
                #[cfg(target_os = "windows")]
                if window.label().eq("notify") && !flag {
                    if let Err(e) = window.hide() {
                        tracing::warn!("Failed to hide notify window: {}", e);
                    }
                }
            }
            WindowEvent::CloseRequested { .. } => {
                let app_handle = window.app_handle();
                let windows = app_handle.webview_windows();
                let win_label = window.label();

                // 检查窗口是否是无效窗口(不重要的可退出的)
                let is_ignored_window =
                    |name: &str| matches!(name, "checkupdate" | "capture" | "update" | "tray");

                if win_label.eq("update") {
                    let state: tauri::State<'_, crate::AppData> = window.state();
                    let user_info = state.user_info.clone();

                    let has_other_active_windows =
                        windows.iter().any(|(name, _)| !is_ignored_window(name));

                    let app_handle = app_handle.clone();

                    tauri::async_runtime::spawn(async move {
                        let user_info = user_info.lock().await;
                        let not_logg_in = user_info.uid.trim().is_empty();

                        //  update 窗口关闭 + 未登录 + 没有其他有效窗口 => 退出程序
                        if not_logg_in && !has_other_active_windows {
                            app_handle.exit(0);
                        }
                    });
                }
                // 如果是login窗口被用户关闭，直接退出程序
                else if win_label.eq("login") {
                    // 检查是否有其他窗口存在，如果有home窗口，说明是登录成功后的正常关闭
                    let has_home_or_update = windows
                        .iter()
                        .any(|(name, _)| matches!(name.as_str(), "home" | "update"));

                    if !has_home_or_update {
                        // 没有home窗口，说明是用户直接关闭login窗口，退出程序
                        window.app_handle().exit(0);
                    }
                    // 如果有home窗口，说明是登录成功后的正常关闭，允许关闭
                }
            }
            WindowEvent::Resized(_ps) => {
                #[cfg(target_os = "macos")]
                {
                    let app_handle = window.app_handle();
                    let _ = apply_macos_traffic_lights_spacing_default(window.label(), app_handle);
                }
            }
            _ => (),
        })
    }
}
