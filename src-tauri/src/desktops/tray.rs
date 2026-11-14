#[cfg(not(target_os = "macos"))]
use tauri::{
    Emitter, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl, WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[cfg(target_os = "macos")]
use tauri::{
    Emitter, Manager, Runtime,
    menu::{MenuBuilder, MenuId, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

/// 托盘窗口统一在运行时创建：`tauri.*.conf.json` 只显式声明首屏 `login` 窗口，
/// 其余窗口（tray 等）由 Rust/前端按需创建，避免三平台声明策略不一致（C-05）。
#[cfg(not(target_os = "macos"))]
fn ensure_tray_window<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> tauri::Result<tauri::WebviewWindow<R>> {
    if let Some(window) = app.get_webview_window("tray") {
        return Ok(window);
    }

    let builder = WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("/tray".into()))
        .resizable(false)
        .visible(false)
        .inner_size(130.0, 44.0)
        .always_on_top(true)
        .skip_taskbar(true)
        .decorations(false);

    // Windows 依赖透明窗口实现圆角；Linux 合成器对 transparent 支持不一致，保持不透明避免黑底。
    #[cfg(target_os = "windows")]
    let builder = builder.transparent(true);

    builder.build()
}

#[cfg(not(target_os = "macos"))]
fn show_tray_window<R: Runtime>(app: &tauri::AppHandle<R>, position: PhysicalPosition<f64>) {
    let tray_window = match ensure_tray_window(app) {
        Ok(window) => window,
        Err(error) => {
            tracing::warn!("Failed to ensure tray window: {}", error);
            return;
        }
    };

    let is_logged_in = app.get_webview_window("home").is_some();
    let height = if is_logged_in { 356 } else { 44 };

    // 托盘窗口创建后常驻复用，状态必须在每次弹出前重新下发，
    // 否则登录/退出后菜单仍停留在旧状态（C-09）。
    let _ = app.emit_to("tray", "tray_state_sync", is_logged_in);
    let _ = tray_window.set_size(PhysicalSize::new(130, height));
    let _ = tray_window.set_position(PhysicalPosition::new(
        position.x,
        position.y - height as f64,
    ));
    let _ = tray_window.set_always_on_top(true);
    let _ = tray_window.show();
    let _ = tray_window.set_focus();
}

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        // macOS 使用原生菜单，与 Windows 托盘对齐「在线状态 / 免打扰 / 打开主面板 / 退出」四项能力（C-08）。
        // 文案由前端 i18n 经 update_tray_menu_labels 下发；Rust 侧只保留英文默认值，
        // 避免在 Rust 源码里新增多语言字面量（zh_literal_rust 守卫）。
        let tray_menu = build_macos_menu(app, &TrayMenuLabels::default())?;

        let tray_handler = app.clone();
        let default_icon = match app.default_window_icon() {
            Some(icon) => icon.clone(),
            None => {
                tracing::error!("Default window icon not found");
                return Err(tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "default window icon not found",
                )));
            }
        };

        let _ = TrayIconBuilder::with_id("tray")
            .tooltip("HuLa")
            .icon(default_icon)
            .menu(&tray_menu) // 直接设置菜单，让系统处理右键显示
            .show_menu_on_left_click(false) // 禁用左键显示菜单
            .on_menu_event(move |app, event| {
                // 菜单会被前端重建以更新文案，事件匹配必须依赖稳定 id 而非闭包内的局部值
                match event.id().0.as_str() {
                    TRAY_MENU_ID_OPEN => focus_home_window(app),
                    // 在线状态需要登录后才能展示，交由 home 窗口打开状态面板
                    TRAY_MENU_ID_STATUS => emit_tray_action(app, "open-status-window"),
                    // 免打扰状态保存在前端 setting store，点击后由前端切换
                    TRAY_MENU_ID_MUTE => emit_tray_action(app, "toggle-mute"),
                    // 退出应用
                    TRAY_MENU_ID_EXIT => tray_handler.exit(0),
                    _ => {}
                }
            })
            .on_tray_icon_event(move |tray, event| {
                if let TrayIconEvent::Click {
                    id: _,
                    position: _,
                    rect: _,
                    button,
                    button_state,
                } = event
                {
                    match button {
                        MouseButton::Left if MouseButtonState::Up == button_state => {
                            // 左键点击直接打开主面板
                            focus_home_window(tray.app_handle());
                        }
                        _ => {}
                    }
                }
            })
            .build(app)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        // 为其他系统（非 macOS）创建托盘图标
        let default_icon = match app.default_window_icon() {
            Some(icon) => icon.clone(),
            None => {
                tracing::error!("Default window icon not found");
                return Err(tauri::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "default window icon not found",
                )));
            }
        };

        let _ = TrayIconBuilder::with_id("tray")
            .tooltip("HuLa")
            .icon(default_icon)
            .on_tray_icon_event(|tray, event| match event {
                TrayIconEvent::Click {
                    id: _,
                    position,
                    rect: _,
                    button,
                    button_state,
                } => match button {
                    MouseButton::Left => {
                        let windows = tray.app_handle().webview_windows();
                        for (name, window) in windows {
                            if name == "login" || name == "home" {
                                if let Err(e) = window.show() {
                                    tracing::warn!("Failed to show window {}: {}", name, e);
                                }
                                if let Err(e) = window.unminimize() {
                                    tracing::warn!("Failed to unminimize window {}: {}", name, e);
                                }
                                if let Err(e) = window.set_focus() {
                                    tracing::warn!("Failed to set focus on window {}: {}", name, e);
                                }
                                break;
                            }
                        }
                    }
                    MouseButton::Right if MouseButtonState::Down == button_state => {
                        // 状态栏图标按下右键时显示状态栏菜单
                        #[cfg(target_os = "windows")]
                        {
                            let app_handle = tray.app_handle().clone();
                            std::thread::spawn(move || {
                                show_tray_window(&app_handle, position);
                            });
                        }

                        #[cfg(not(target_os = "windows"))]
                        show_tray_window(tray.app_handle(), position);
                    }
                    _ => {}
                },
                #[cfg(target_os = "windows")]
                TrayIconEvent::Enter {
                    id: _,
                    position: _,
                    rect: _,
                } => {
                    if tray.app_handle().get_webview_window("notify").is_some() {
                        if let Ok(rect) = tray.rect() {
                            match tray.app_handle().emit_to("notify", "notify_enter", &rect) {
                                Ok(_) => {
                                    tracing::info!("notify_enter event sent successfully");
                                }
                                Err(e) => {
                                    tracing::warn!("Failed to emit notify_enter event: {}", e);
                                }
                            }
                        } else {
                            tracing::warn!("Failed to get tray rect");
                        }
                    }
                }
                #[cfg(target_os = "windows")]
                TrayIconEvent::Leave {
                    id: _,
                    position: _,
                    rect: _,
                } => {
                    if tray.app_handle().get_webview_window("notify").is_some() {
                        if let Err(e) = tray.app_handle().emit_to("notify", "notify_leave", ()) {
                            tracing::warn!("Failed to emit notify_leave event: {}", e);
                        }
                    }
                }
                _ => {}
            })
            .build(app);
    }
    Ok(())
}

#[cfg(target_os = "macos")]
const TRAY_MENU_ID_STATUS: &str = "open_status";
#[cfg(target_os = "macos")]
const TRAY_MENU_ID_OPEN: &str = "open_home";
#[cfg(target_os = "macos")]
const TRAY_MENU_ID_MUTE: &str = "toggle_mute";
#[cfg(target_os = "macos")]
const TRAY_MENU_ID_EXIT: &str = "exit_app";

/// 托盘原生菜单文案。文案的唯一来源是前端 i18n，
/// 前端通过 `update_tray_menu_labels` 下发（C-08）。
#[derive(Clone, serde::Deserialize)]
// 非 macOS 平台不构建原生菜单，字段不会被读取
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct TrayMenuLabels {
    pub status: String,
    pub open: String,
    pub mute: String,
    pub exit: String,
}

impl Default for TrayMenuLabels {
    fn default() -> Self {
        Self {
            status: String::from("Online Status..."),
            open: String::from("Open Main Panel"),
            mute: String::from("Toggle Notification Sounds"),
            exit: String::from("Quit"),
        }
    }
}

#[cfg(target_os = "macos")]
fn build_macos_menu<R: Runtime>(
    app: &tauri::AppHandle<R>,
    labels: &TrayMenuLabels,
) -> tauri::Result<tauri::menu::Menu<R>> {
    let status_menu_item = MenuItem::with_id(
        app,
        MenuId::new(TRAY_MENU_ID_STATUS),
        &labels.status,
        true,
        None::<&str>,
    )?;
    let open_menu_item = MenuItem::with_id(
        app,
        MenuId::new(TRAY_MENU_ID_OPEN),
        &labels.open,
        true,
        None::<&str>,
    )?;
    let mute_menu_item = MenuItem::with_id(
        app,
        MenuId::new(TRAY_MENU_ID_MUTE),
        &labels.mute,
        true,
        None::<&str>,
    )?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let exit_menu_item = MenuItem::with_id(
        app,
        MenuId::new(TRAY_MENU_ID_EXIT),
        &labels.exit,
        true,
        None::<&str>,
    )?;

    MenuBuilder::new(app)
        .items(&[
            &status_menu_item,
            &open_menu_item,
            &separator1,
            &mute_menu_item,
            &separator2,
            &exit_menu_item,
        ])
        .build()
}

/// 用前端下发的 i18n 文案重建托盘菜单（C-08）；非 macOS 平台为 no-op。
#[tauri::command]
pub fn update_tray_menu_labels<R: Runtime>(
    app: tauri::AppHandle<R>,
    labels: TrayMenuLabels,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let tray = app
            .tray_by_id("tray")
            .ok_or_else(|| String::from("tray not found"))?;
        let menu = build_macos_menu(&app, &labels).map_err(|error| error.to_string())?;
        tray.set_menu(Some(menu)).map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, labels);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn focus_home_window<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("home") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(target_os = "macos")]
fn emit_tray_action<R: Runtime>(app: &tauri::AppHandle<R>, action: &str) {
    if let Err(error) = app.emit_to("home", "tray_menu_action", action) {
        tracing::warn!("Failed to emit tray action {}: {}", action, error);
    }
}
