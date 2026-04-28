// 原生应用菜单栏 (View/Window/Help, 以及 macOS 的 App / Edit 菜单)
//
// 与 element-desktop 对齐:
// - macOS App 菜单: About / Preferences / Hide / Quit
// - View: Reload / Force Reload / Toggle DevTools / Zoom / Fullscreen
// - Window: Minimize / Close
// - Help: Open Settings / About (非 macOS)

use std::sync::Mutex;
use tauri::menu::{AboutMetadata, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

static ZOOM: Mutex<f64> = Mutex::new(1.0);
const ZOOM_MIN: f64 = 0.5;
const ZOOM_MAX: f64 = 2.5;
const ZOOM_STEP: f64 = 0.1;

pub fn create_app_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let mut builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        let app_submenu = SubmenuBuilder::new(app, "HuLa")
            .item(&PredefinedMenuItem::about(
                app,
                Some("About HuLa"),
                Some(AboutMetadata::default()),
            )?)
            .separator()
            .item(
                &MenuItemBuilder::with_id("menu_preferences", "Preferences...")
                    .accelerator("CmdOrCtrl+,")
                    .build(app)?,
            )
            .separator()
            .item(&PredefinedMenuItem::services(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::hide(app, None)?)
            .item(&PredefinedMenuItem::hide_others(app, None)?)
            .item(&PredefinedMenuItem::show_all(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::quit(app, None)?)
            .build()?;
        builder = builder.item(&app_submenu);

        let edit_submenu = SubmenuBuilder::new(app, "Edit")
            .item(&PredefinedMenuItem::undo(app, None)?)
            .item(&PredefinedMenuItem::redo(app, None)?)
            .separator()
            .item(&PredefinedMenuItem::cut(app, None)?)
            .item(&PredefinedMenuItem::copy(app, None)?)
            .item(&PredefinedMenuItem::paste(app, None)?)
            .item(&PredefinedMenuItem::select_all(app, None)?)
            .build()?;
        builder = builder.item(&edit_submenu);
    }

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("menu_reload", "Reload")
                .accelerator("CmdOrCtrl+R")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("menu_force_reload", "Force Reload")
                .accelerator("CmdOrCtrl+Shift+R")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("menu_devtools", "Toggle Developer Tools")
                .accelerator(if cfg!(target_os = "macos") {
                    "Cmd+Alt+I"
                } else {
                    "Ctrl+Shift+I"
                })
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("menu_zoom_reset", "Actual Size")
                .accelerator("CmdOrCtrl+0")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("menu_zoom_in", "Zoom In")
                .accelerator("CmdOrCtrl+Plus")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("menu_zoom_out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("menu_fullscreen", "Toggle Full Screen")
                .accelerator(if cfg!(target_os = "macos") {
                    "Ctrl+Cmd+F"
                } else {
                    "F11"
                })
                .build(app)?,
        )
        .build()?;
    builder = builder.item(&view_submenu);

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;
    builder = builder.item(&window_submenu);

    #[cfg_attr(target_os = "macos", allow(unused_mut))]
    let mut help_builder = SubmenuBuilder::new(app, "Help").item(
        &MenuItemBuilder::with_id("menu_open_settings", "Settings...")
            .accelerator(if cfg!(target_os = "macos") {
                "Cmd+,"
            } else {
                "Ctrl+,"
            })
            .build(app)?,
    );
    #[cfg(not(target_os = "macos"))]
    {
        help_builder = help_builder.separator().item(&PredefinedMenuItem::about(
            app,
            Some("About HuLa"),
            Some(AboutMetadata::default()),
        )?);
    }
    let help_submenu = help_builder.build()?;
    builder = builder.item(&help_submenu);

    let menu = builder.build()?;
    app.set_menu(menu)?;

    let handler = app.clone();
    app.on_menu_event(move |app, event| {
        let id = event.id().0.as_str();
        match id {
            "menu_preferences" | "menu_open_settings" => {
                if let Err(e) = app.emit("menu:open-settings", ()) {
                    tracing::warn!("Failed to emit menu:open-settings: {}", e);
                }
            }
            "menu_reload" | "menu_force_reload" => {
                if let Some(w) = focused_main_window(app) {
                    let _ = w.eval("window.location.reload()");
                }
            }
            "menu_devtools" => {
                #[cfg(debug_assertions)]
                if let Some(w) = focused_main_window(app) {
                    if w.is_devtools_open() {
                        w.close_devtools();
                    } else {
                        w.open_devtools();
                    }
                }
            }
            "menu_zoom_in" => apply_zoom(app, ZOOM_STEP),
            "menu_zoom_out" => apply_zoom(app, -ZOOM_STEP),
            "menu_zoom_reset" => set_zoom(app, 1.0),
            "menu_fullscreen" => {
                if let Some(w) = focused_main_window(app) {
                    let next = !w.is_fullscreen().unwrap_or(false);
                    let _ = w.set_fullscreen(next);
                }
            }
            _ => {}
        }
        let _ = &handler;
    });

    Ok(())
}

fn focused_main_window<R: Runtime>(app: &AppHandle<R>) -> Option<tauri::WebviewWindow<R>> {
    let windows = app.webview_windows();
    if let Some((_, w)) = windows.iter().find(|(_, w)| w.is_focused().unwrap_or(false)) {
        return Some(w.clone());
    }
    windows
        .get("home")
        .or_else(|| windows.get("login"))
        .cloned()
}

fn apply_zoom<R: Runtime>(app: &AppHandle<R>, delta: f64) {
    let mut z = ZOOM.lock().unwrap();
    *z = (*z + delta).clamp(ZOOM_MIN, ZOOM_MAX);
    let value = *z;
    drop(z);
    set_all_webviews_zoom(app, value);
}

fn set_zoom<R: Runtime>(app: &AppHandle<R>, value: f64) {
    *ZOOM.lock().unwrap() = value;
    set_all_webviews_zoom(app, value);
}

fn set_all_webviews_zoom<R: Runtime>(app: &AppHandle<R>, value: f64) {
    for (_, w) in app.webview_windows() {
        let _ = w.with_webview(move |_| {});
        let _ = w.set_zoom(value);
    }
}
