//! 截屏检测后端命令。
//!
//! 平台支持：
//! - macOS: 监听 NSWindowDidChangeOcclusionStateNotification（占位实现）
//! - Windows: 通过 SetWindowDisplayAffinity 检测（占位实现）
//! - Linux: 无标准截屏检测 API，降级为空操作，依赖前端水印 + Toast
//!
//! 本模块仅编译于桌面端（`desktops` 模块整体受 `#[cfg(desktop)]` 门控）。

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

#[cfg(any(target_os = "macos", target_os = "windows"))]
use std::time::Duration;
#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::Emitter;

#[derive(Clone, Serialize)]
pub struct ScreenshotDetectedPayload {
    pub room_id: String,
    pub timestamp: f64,
    pub platform: String,
}

/// 全局监听标志：true 表示正在监听，stop 时置为 false。
static WATCHING: AtomicBool = AtomicBool::new(false);

/// 启动截屏检测监听。
///
/// macOS: 监听窗口 occlusion state 变化；Windows: 检测窗口捕获状态；
/// Linux: 无标准 API，降级为空操作。重复调用会被合并为单实例。
#[tauri::command]
pub async fn start_screenshot_watch(app: AppHandle, room_id: String) -> Result<(), String> {
    // 已在监听则直接返回，避免重复启动线程
    if WATCHING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: 监听窗口 occlusion state 变化
        // 使用 objc2_app_kit 监听 NSWindowDidChangeOcclusionStateNotification
        // 当窗口被截屏时 occlusion state 会变化
        let app_clone = app.clone();
        let room_id_clone = room_id.clone();
        std::thread::spawn(move || {
            macos_watch_screenshot(app_clone, room_id_clone);
        });
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: 使用 SetWindowDisplayAffinity 阻止截屏
        // 并通过定时检测 capture state 变化
        let app_clone = app.clone();
        let room_id_clone = room_id.clone();
        std::thread::spawn(move || {
            windows_watch_screenshot(app_clone, room_id_clone);
        });
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: 无标准截屏检测 API，降级为空操作
        // 依赖前端水印 + Toast
        let _ = (app, room_id);
    }

    Ok(())
}

/// 停止截屏检测监听。
#[tauri::command]
pub async fn stop_screenshot_watch() -> Result<(), String> {
    // 清理监听器：线程内部检测到 stop 标志后退出
    WATCHING.store(false, Ordering::SeqCst);
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_watch_screenshot(app: AppHandle, room_id: String) {
    // macOS: 监听窗口 occlusion state 变化
    // 完整实现应使用 objc2_app_kit 监听 NSWindowDidChangeOcclusionStateNotification
    // 当窗口被截屏时 occlusion state 会变化
    tracing::info!(
        "[screenshot-watch] macOS watch started for room {}",
        room_id
    );

    while WATCHING.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_secs(1));

        // 占位实现：实际检测逻辑待接入。
        // 检测到截屏时构造 payload 并 emit "screenshot-detected" 事件。
        if detect_macos_screenshot() {
            let payload = ScreenshotDetectedPayload {
                room_id: room_id.clone(),
                timestamp: chrono::Utc::now().timestamp_millis() as f64,
                platform: "macos".to_string(),
            };
            let _ = app.emit("screenshot-detected", payload);
        }
    }

    tracing::info!(
        "[screenshot-watch] macOS watch stopped for room {}",
        room_id
    );
}

#[cfg(target_os = "macos")]
fn detect_macos_screenshot() -> bool {
    // 占位实现：始终返回 false。
    // 完整实现应使用 objc2_app_kit 监听 NSWindowDidChangeOcclusionStateNotification，
    // 当窗口 occlusion state 变化时返回 true。
    false
}

#[cfg(target_os = "windows")]
fn windows_watch_screenshot(app: AppHandle, room_id: String) {
    // Windows: 使用 SetWindowDisplayAffinity 阻止截屏
    // 并通过定时检测 capture state 变化
    tracing::info!(
        "[screenshot-watch] Windows watch started for room {}",
        room_id
    );

    while WATCHING.load(Ordering::SeqCst) {
        std::thread::sleep(Duration::from_secs(1));

        // 占位实现：实际检测逻辑待接入。
        // 检测到截屏时构造 payload 并 emit "screenshot-detected" 事件。
        if detect_windows_screenshot() {
            let payload = ScreenshotDetectedPayload {
                room_id: room_id.clone(),
                timestamp: chrono::Utc::now().timestamp_millis() as f64,
                platform: "windows".to_string(),
            };
            let _ = app.emit("screenshot-detected", payload);
        }
    }

    tracing::info!(
        "[screenshot-watch] Windows watch stopped for room {}",
        room_id
    );
}

#[cfg(target_os = "windows")]
fn detect_windows_screenshot() -> bool {
    // 占位实现：始终返回 false。
    // 完整实现应通过 GetWindowDisplayAffinity 检测窗口捕获状态变化。
    false
}
