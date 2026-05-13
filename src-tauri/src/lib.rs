// 桌面端依赖
#[cfg(desktop)]
mod desktops;
use crate::common::files_meta::get_files_meta;
use crate::common::init::CustomInit;
#[cfg(desktop)]
use common_cmd::audio;
#[cfg(desktop)]
use common_cmd::default_window_icon;
#[cfg(target_os = "windows")]
use common_cmd::get_windows_scale_info;
#[cfg(target_os = "macos")]
use common_cmd::hide_title_bar_buttons;
#[cfg(desktop)]
use common_cmd::screenshot;
#[cfg(desktop)]
use common_cmd::set_height;
#[cfg(target_os = "macos")]
use common_cmd::set_macos_traffic_lights_spacing;
#[cfg(target_os = "macos")]
use common_cmd::set_window_level_above_menubar;
#[cfg(target_os = "macos")]
use common_cmd::set_window_movable;
#[cfg(target_os = "macos")]
use common_cmd::show_title_bar_buttons;
#[cfg(target_os = "macos")]
use desktops::app_event;
#[cfg(desktop)]
use desktops::common_cmd;
#[cfg(desktop)]
use desktops::directory_scanner;
#[cfg(desktop)]
use desktops::init;
#[cfg(desktop)]
use desktops::tray;
#[cfg(desktop)]
use desktops::video_thumbnail::get_video_thumbnail;
#[cfg(desktop)]
use desktops::window_payload::get_window_payload;
#[cfg(desktop)]
use desktops::window_payload::push_window_payload;
#[cfg(desktop)]
use directory_scanner::cancel_directory_scan;
#[cfg(desktop)]
use directory_scanner::get_directory_usage_info_with_progress;
#[cfg(desktop)]
use init::DesktopCustomInit;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::time::Instant;
use tauri_plugin_fs::FsExt;
pub mod command;
pub mod common;
pub mod configuration;
pub mod error;
pub mod pojo;
pub mod repository;
pub mod timeout_config;
pub mod utils;
mod vo;
#[cfg(target_os = "ios")]
mod webview_helper;

use crate::command::app_state_command::is_app_state_ready;
use crate::command::config_command::get_config;
use crate::command::room_member_command::cursor_page_room_members;
use crate::command::room_member_command::update_my_room_info;
use crate::command::secure_storage::check_secure_storage_available;
use crate::command::secure_storage::delete_secret;
use crate::command::secure_storage::get_secret;
use crate::command::secure_storage::set_secret;
use crate::command::setting_command::get_settings;
use crate::command::setting_command::update_settings;
use crate::command::user_command::remove_tokens;
use crate::configuration::Settings;
use crate::configuration::get_configuration;
use crate::error::CommonError;
use sea_orm::DatabaseConnection;
use serde::Deserialize;
use serde::Serialize;

// 移动端依赖
#[cfg(mobile)]
mod mobiles;
#[cfg(target_os = "ios")]
use mobiles::ios::badge::request_ios_badge_authorization;
#[cfg(target_os = "ios")]
use mobiles::ios::badge::set_ios_badge;
#[cfg(target_os = "ios")]
use mobiles::ios::trigger_haptic_feedback;
#[cfg(mobile)]
use mobiles::splash;

#[derive(Debug)]
pub struct AppData {
    db_conn: Arc<RwLock<DatabaseConnection>>,
    user_info: Arc<Mutex<UserInfo>>,
    pub config: Arc<RwLock<Settings>>,
    frontend_task: Mutex<bool>,
    backend_task: Mutex<bool>,
    pub write_lock: Arc<Mutex<()>>,
    pub stream_tasks: Arc<Mutex<std::collections::HashMap<String, tokio::task::JoinHandle<()>>>>,
}

pub(crate) static APP_STATE_READY: AtomicBool = AtomicBool::new(false);

pub fn get_secure_storage_service_name() -> String {
    if let Ok(profile_dir) = std::env::var("HULA_PROFILE_DIR") {
        if !profile_dir.is_empty() {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            profile_dir.hash(&mut hasher);
            let hash = hasher.finish();
            return format!("hula-secure-storage-{:08x}", hash);
        }
    }
    "hula-secure-storage".to_string()
}

use crate::command::chat_history_command::query_chat_history;
use crate::command::contact_command::hide_contact_command;
use crate::command::contact_command::list_contacts_command;
use crate::command::database_command::switch_user_database;
use crate::command::file_manager_command::debug_message_stats;
use crate::command::file_manager_command::get_navigation_items;
use crate::command::file_manager_command::query_files;
use crate::command::message_command::delete_message;
use crate::command::message_command::delete_room_messages;
use crate::command::message_command::page_msg;
use crate::command::message_command::save_msg;
use crate::command::message_command::send_msg;
use crate::command::message_command::update_message_recall_status;
use crate::command::message_mark_command::save_message_mark;
use crate::command::oauth_command::OauthServerState;
use crate::command::oauth_command::start_oauth_server;

use tauri::AppHandle;
use tauri::Emitter;
#[cfg(desktop)]
use tauri::Listener;
use tauri::Manager;
use tokio::sync::Mutex;
use tokio::sync::RwLock;

pub fn run() {
    #[cfg(desktop)]
    {
        if let Err(e) = setup_desktop() {
            tracing::error!("Failed to setup desktop application: {}", e);
            std::process::exit(1);
        }
    }
    #[cfg(mobile)]
    {
        setup_mobile();
    }
}

#[cfg(desktop)]
fn setup_desktop() -> Result<(), CommonError> {
    // 创建一个缓存实例
    // let cache: Cache<String, String> = Cache::builder()
    //     // Time to idle (TTI):  30 minutes
    //     .time_to_idle(Duration::from_secs(30 * 60))
    //     // Create the cache.
    //     .build();
    tauri::Builder::default()
        .init_plugin()
        .init_webwindow_event()
        .init_window_event()
        .setup(move |app| {
            common_setup(app.handle().clone())?;
            Ok(())
        })
        .invoke_handler(get_invoke_handlers())
        .on_webview_event(move |webview_label, event| {
            tracing::debug!(
                "[LIFECYCLE] WebView event for {:?}: {:?}",
                webview_label,
                event
            );
        })
        .build(tauri::generate_context!())
        .map_err(|e| {
            CommonError::RequestError(format!("Failed to build tauri application: {}", e))
        })?
        .run(|app_handle, event| {
            match &event {
                tauri::RunEvent::WebviewEvent { label, event, .. } => {
                    tracing::debug!("[LIFECYCLE] WebView event for {}: {:?}", label, event);
                }
                tauri::RunEvent::Resumed => {
                    tracing::info!("[LIFECYCLE] System resumed from sleep, notifying frontend");
                    if let Err(e) = app_handle.emit("system-resumed", ()) {
                        tracing::warn!("Failed to emit system-resumed event: {}", e);
                    }
                }
                tauri::RunEvent::Exit => {
                    tracing::info!("[LIFECYCLE] Application exiting, cleaning up");
                }
                _ => {}
            }

            #[cfg(target_os = "macos")]
            app_event::handle_app_event(&app_handle, event);
        });
    Ok(())
}

// 异步初始化应用数据
async fn initialize_app_data(
    app_handle: tauri::AppHandle,
) -> Result<
    (
        Arc<RwLock<DatabaseConnection>>,
        Arc<Mutex<UserInfo>>,
        Arc<RwLock<Settings>>,
    ),
    CommonError,
> {
    use migration::Migrator;
    use migration::MigratorTrait;
    use tracing::info;

    let init_started_at = Instant::now();

    // 加载配置
    let config_started_at = Instant::now();
    let configuration = Arc::new(RwLock::new(
        get_configuration(&app_handle)
            .map_err(|e| anyhow::anyhow!("Failed to load configuration: {}", e))?,
    ));
    info!(
        "Startup stage completed: configuration loaded in {} ms",
        config_started_at.elapsed().as_millis()
    );

    // 初始化数据库连接
    let db_started_at = Instant::now();
    let db: Arc<RwLock<DatabaseConnection>> = Arc::new(RwLock::new(
        configuration
            .read()
            .await
            .database
            .connection_string(&app_handle, None)
            .await?,
    ));
    info!(
        "Startup stage completed: database connected in {} ms",
        db_started_at.elapsed().as_millis()
    );

    // 数据库迁移
    let migration_started_at = Instant::now();
    match Migrator::up(&*db.read().await, None).await {
        Ok(_) => {
            info!(
                "Startup stage completed: database migration in {} ms",
                migration_started_at.elapsed().as_millis()
            );
        }
        Err(e) => {
            tracing::error!("Critical Error: Database migration failed: {}", e);
        }
    }

    let profile_name = std::env::var("HULA_PROFILE_DIR").unwrap_or_default();

    let user_info = UserInfo {
        token: Default::default(),
        refresh_token: Default::default(),
        uid: Default::default(),
        profile_name,
    };
    let user_info = Arc::new(Mutex::new(user_info));

    info!(
        "Startup stage completed: app data initialization finished in {} ms",
        init_started_at.elapsed().as_millis()
    );

    Ok((db, user_info, configuration))
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub token: String,
    pub refresh_token: String,
    pub uid: String,
    pub profile_name: String,
}

pub async fn build_request_client() -> Result<reqwest::Client, CommonError> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow::anyhow!("Reqwest client error: {}", e))?;
    Ok(client)
}

#[allow(dead_code)]

/// 处理退出登录时的窗口管理逻辑
///
/// 该函数会：
/// - 关闭除 login/tray 外的大部分窗口
/// - 隐藏但保留 capture/checkupdate 窗口
/// - 优雅地处理窗口关闭过程中的错误
#[cfg(desktop)]
pub async fn handle_logout_windows(app_handle: &tauri::AppHandle) {
    tracing::info!("[LOGOUT] Starting to close windows and preserve capture/checkupdate windows");

    let all_windows = app_handle.webview_windows();
    tracing::info!("[LOGOUT] Found {} windows", all_windows.len());

    // 收集需要关闭的窗口和需要隐藏的窗口
    let mut windows_to_close = Vec::new();
    let mut windows_to_hide = Vec::new();

    for (label, window) in all_windows {
        match label.as_str() {
            // 这些窗口完全不处理
            "login" | "tray" => {
                tracing::info!("[LOGOUT] Skipping window: {}", label);
            }
            // 这些窗口只隐藏，不销毁
            "capture" | "checkupdate" => {
                tracing::info!("[LOGOUT] Marking window for preservation: {}", label);
                windows_to_hide.push((label, window));
            }
            // 其他窗口需要关闭
            _ => {
                tracing::info!("[LOGOUT] Marking window for closure: {}", label);
                windows_to_close.push((label, window));
            }
        }
    }

    // 先隐藏需要保持的窗口
    for (label, window) in windows_to_hide {
        tracing::info!("[LOGOUT] Hiding window (preserving): {}", label);
        if let Err(e) = window.hide() {
            tracing::warn!("[LOGOUT] Failed to hide window {}: {}", label, e);
        }
    }

    // 逐个关闭窗口，添加小延迟以避免并发关闭导致的错误
    for (label, window) in windows_to_close {
        tracing::info!("[LOGOUT] Closing window: {}", label);

        // 先隐藏窗口，减少用户感知的延迟
        let _ = window.hide();

        // 添加小延迟，让窗口有时间处理正在进行的操作
        // tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        match window.destroy() {
            Ok(_) => {
                tracing::info!("[LOGOUT] Successfully closed window: {}", label);
            }
            Err(error) => {
                // 检查窗口是否还存在
                if app_handle.get_webview_window(&label).is_none() {
                    tracing::info!(
                        "[LOGOUT] Window {} no longer exists, skipping closure",
                        label
                    );
                } else {
                    tracing::warn!(
                        "[LOGOUT] Warning when closing window {}: {} (this is usually normal)",
                        label,
                        error
                    );
                }
            }
        }
    }

    tracing::info!(
        "[LOGOUT] Logout completed - windows closed and capture/checkupdate windows preserved"
    );
}

// 设置登出事件监听器
#[cfg(desktop)]
fn setup_logout_listener(app_handle: tauri::AppHandle) {
    let app_handle_clone = app_handle.clone();
    app_handle.listen("logout", move |_event| {
        let app_handle = app_handle_clone.clone();
        tauri::async_runtime::spawn(async move {
            handle_logout_windows(&app_handle).await;
        });
    });
}

#[cfg(mobile)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn setup_mobile() {
    splash::show();
    // 创建一个缓存实例
    // let cache: Cache<String, String> = Cache::builder()
    //     // Time to idle (TTI):  30 minutes
    //     .time_to_idle(Duration::from_secs(30 * 60))
    //     // Create the cache.
    //     .build();

    if let Err(e) = tauri::Builder::default()
        .init_plugin()
        .setup(move |app| {
            let app_handle = app.handle().clone();
            #[cfg(target_os = "ios")]
            {
                if let Some(webview_window) = app_handle.get_webview_window("mobile-home") {
                    webview_helper::initialize_keyboard_adjustment(&webview_window);
                } else {
                    tracing::warn!("Mobile home webview window not found during setup");
                }
            }
            common_setup(app_handle)?;
            tracing::info!("Mobile application setup completed successfully");
            Ok(())
        })
        .invoke_handler(get_invoke_handlers())
        .run(tauri::generate_context!())
    {
        tracing::log::error!("Failed to run mobile application: {}", e);
        std::process::exit(1);
    }
}

// 公共的 setup 函数
fn common_setup(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let setup_started_at = Instant::now();
    APP_STATE_READY.store(false, Ordering::SeqCst);
    tracing::info!("Startup stage started: common setup");

    let scope = app_handle.fs_scope();
    if let Err(e) = scope.allow_directory("configuration", false) {
        tracing::warn!("Failed to allow configuration directory: {}", e);
    }

    #[cfg(desktop)]
    setup_logout_listener(app_handle.clone());

    let profile_dir = std::env::var("HULA_PROFILE_DIR").unwrap_or_default();
    if !profile_dir.is_empty() {
        tracing::info!("[PROFILE] Running with profile directory: {}", profile_dir);
    } else {
        tracing::info!("[PROFILE] Running with default profile");
    }

    // Start homeserver health check for desktop builds
    #[cfg(desktop)]
    {
        let app_handle_clone = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            start_homeserver_health_check(app_handle_clone).await;
        });
    }

    app_handle.manage(OauthServerState::default());

    #[cfg(desktop)]
    tray::create_tray(&app_handle)?;

    let init_handle = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        let async_started_at = Instant::now();
        tracing::info!("Startup stage started: async app data initialization");

        match initialize_app_data(init_handle.clone()).await {
            Ok((db, user_info, settings)) => {
                init_handle.manage(AppData {
                    db_conn: db,
                    user_info,
                    config: settings,
                    frontend_task: Mutex::new(false),
                    // 后端任务默认完成
                    backend_task: Mutex::new(true),
                    write_lock: Arc::new(Mutex::new(())),
                    stream_tasks: Arc::new(Mutex::new(std::collections::HashMap::new())),
                });
                APP_STATE_READY.store(true, Ordering::SeqCst);
                tracing::info!(
                    "Startup stage completed: app state ready in {} ms",
                    async_started_at.elapsed().as_millis()
                );

                if let Err(e) = init_handle.emit("app-state-ready", ()) {
                    tracing::warn!("Failed to emit app-state-ready event: {}", e);
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to initialize application data asynchronously: {}",
                    e
                );
                init_handle.exit(1);
            }
        }
    });

    tracing::info!(
        "Startup stage completed: common setup returned in {} ms",
        setup_started_at.elapsed().as_millis()
    );
    Ok(())
}

// 公共的命令处理器函数
fn get_invoke_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    use crate::command::admin_command::check_admin_status;
    use crate::command::ai_command::ai_message_cancel_stream;
    use crate::command::asset_command::allow_asset_path;
    use crate::command::markdown_command::get_readme_html;
    use crate::command::markdown_command::parse_markdown;
    #[cfg(mobile)]
    use crate::command::set_complete;
    use crate::command::upload_command::upload_file_put;
    use crate::command::user_command::get_user_tokens;
    use crate::command::user_command::save_user_info;
    use crate::command::user_command::update_token;
    use crate::command::user_command::update_user_last_opt_time;
    #[cfg(target_os = "ios")]
    use crate::mobiles::keyboard::set_webview_keyboard_adjustment;
    #[cfg(mobile)]
    use crate::mobiles::splash::hide_splash_screen;

    tauri::generate_handler![
        // 桌面端特定命令
        #[cfg(desktop)]
        default_window_icon,
        #[cfg(desktop)]
        screenshot,
        #[cfg(desktop)]
        audio,
        #[cfg(desktop)]
        set_height,
        #[cfg(desktop)]
        get_video_thumbnail,
        #[cfg(target_os = "macos")]
        hide_title_bar_buttons,
        #[cfg(target_os = "macos")]
        show_title_bar_buttons,
        #[cfg(target_os = "macos")]
        set_macos_traffic_lights_spacing,
        #[cfg(target_os = "macos")]
        set_window_level_above_menubar,
        #[cfg(target_os = "macos")]
        set_window_movable,
        #[cfg(desktop)]
        push_window_payload,
        #[cfg(desktop)]
        get_window_payload,
        get_files_meta,
        #[cfg(desktop)]
        get_directory_usage_info_with_progress,
        #[cfg(desktop)]
        cancel_directory_scan,
        #[cfg(target_os = "windows")]
        get_windows_scale_info,
        // 通用命令（桌面端和移动端都支持）
        save_user_info,
        get_user_tokens,
        update_token,
        remove_tokens,
        update_user_last_opt_time,
        update_my_room_info,
        cursor_page_room_members,
        list_contacts_command,
        hide_contact_command,
        page_msg,
        send_msg,
        save_msg,
        delete_message,
        delete_room_messages,
        update_message_recall_status,
        save_message_mark,
        // 聊天历史相关命令
        query_chat_history,
        // 文件管理相关命令
        query_files,
        get_navigation_items,
        debug_message_stats,
        get_settings,
        update_settings,
        // AI 相关命令
        ai_message_cancel_stream,
        // OAuth
        start_oauth_server,
        // Markdown 相关命令
        parse_markdown,
        get_readme_html,
        upload_file_put,
        #[cfg(mobile)]
        set_complete,
        #[cfg(mobile)]
        hide_splash_screen,
        #[cfg(target_os = "ios")]
        set_ios_badge,
        #[cfg(target_os = "ios")]
        trigger_haptic_feedback,
        #[cfg(target_os = "ios")]
        request_ios_badge_authorization,
        #[cfg(target_os = "ios")]
        set_webview_keyboard_adjustment,
        is_app_state_ready,
        switch_user_database,
        check_admin_status,
        allow_asset_path,
        get_config,
        get_secret,
        set_secret,
        delete_secret,
        check_secure_storage_available,
    ]
}

#[cfg(desktop)]
async fn start_homeserver_health_check(app_handle: AppHandle) {
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::time::Duration;

    static FAILURE_COUNT: AtomicU32 = AtomicU32::new(0);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .danger_accept_invalid_certs(cfg!(debug_assertions))
        .build();

    match client {
        Ok(client) => loop {
            tokio::time::sleep(Duration::from_secs(60)).await;

            let hs_url = {
                if let Some(state) = app_handle.try_state::<crate::AppData>() {
                    let config = state.config.read().await;
                    config.backend.base_url.clone()
                } else {
                    continue;
                }
            };

            let health_url = format!("{}/_matrix/client/versions", hs_url.trim_end_matches('/'));

            match client.get(&health_url).send().await {
                Ok(response) if response.status().is_success() => {
                    let prev_failures = FAILURE_COUNT.swap(0, Ordering::SeqCst);
                    if prev_failures > 0 {
                        tracing::info!(
                            "[HEALTH] Homeserver recovered after {} consecutive failures",
                            prev_failures
                        );
                    }
                }
                Ok(response) => {
                    let count = FAILURE_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
                    tracing::warn!(
                        "[HEALTH] Homeserver returned status {} (failure #{})",
                        response.status(),
                        count
                    );
                }
                Err(e) => {
                    let count = FAILURE_COUNT.fetch_add(1, Ordering::SeqCst) + 1;
                    tracing::warn!(
                        "[HEALTH] Homeserver health check failed (failure #{}): {}",
                        count,
                        e
                    );
                }
            }
        },
        Err(e) => {
            tracing::error!("[HEALTH] Failed to create health check HTTP client: {}", e);
        }
    }
}
