use crate::AppData;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseStreamEvent {
    pub event_type: String,
    pub data: Option<String>,
    pub error: Option<String>,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub use_context: Option<bool>,
    pub reasoning_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenClawStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub os_type: String,
}

/// 检测 OpenClaw 是否已安装
#[tauri::command]
pub async fn check_openclaw_installation() -> Result<OpenClawStatus, String> {
    let os_type = std::env::consts::OS.to_string();
    let binary_name = if cfg!(target_os = "windows") {
        "openclaw.exe"
    } else {
        "openclaw"
    };

    // 尝试 which/where 查找可执行文件
    let find_result = if cfg!(target_os = "windows") {
        tokio::process::Command::new("where")
            .arg(binary_name)
            .output()
            .await
    } else {
        tokio::process::Command::new("which")
            .arg(binary_name)
            .output()
            .await
    };

    match find_result {
        Ok(output) if output.status.success() => {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let path = path.lines().next().unwrap_or("").to_string();

            // 尝试获取版本号
            let version = get_openclaw_version(&path).await;

            info!("OpenClaw 已安装: path={}, version={:?}", path, version);
            Ok(OpenClawStatus {
                installed: true,
                path: Some(path),
                version,
                os_type,
            })
        }
        _ => {
            // 尝试常见安装路径
            if let Some(path) = check_common_paths().await {
                let version = get_openclaw_version(&path).await;
                info!(
                    "OpenClaw 在常见路径中找到: path={}, version={:?}",
                    path, version
                );
                Ok(OpenClawStatus {
                    installed: true,
                    path: Some(path),
                    version,
                    os_type,
                })
            } else {
                info!("OpenClaw 未安装");
                Ok(OpenClawStatus {
                    installed: false,
                    path: None,
                    version: None,
                    os_type,
                })
            }
        }
    }
}

async fn get_openclaw_version(path: &str) -> Option<String> {
    let output = tokio::process::Command::new(path)
        .arg("--version")
        .output()
        .await
        .ok()?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Some(version);
        }
    }
    None
}

async fn check_common_paths() -> Option<String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()?;

    let candidates: Vec<String> = if cfg!(target_os = "macos") {
        vec![
            format!("{}/Applications/OpenClaw.app/Contents/MacOS/openclaw", home),
            "/usr/local/bin/openclaw".to_string(),
            "/opt/homebrew/bin/openclaw".to_string(),
            format!("{}/.local/bin/openclaw", home),
        ]
    } else if cfg!(target_os = "windows") {
        let program_files =
            std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let local_app_data =
            std::env::var("LOCALAPPDATA").unwrap_or_else(|_| format!("{}\\AppData\\Local", home));
        vec![
            format!("{}\\OpenClaw\\openclaw.exe", program_files),
            format!("{}\\Programs\\OpenClaw\\openclaw.exe", local_app_data),
            format!("{}\\.local\\bin\\openclaw.exe", home),
        ]
    } else {
        vec![
            "/usr/local/bin/openclaw".to_string(),
            "/usr/bin/openclaw".to_string(),
            format!("{}/.local/bin/openclaw", home),
            format!("{}/.cargo/bin/openclaw", home),
        ]
    };

    for path in candidates {
        if tokio::fs::metadata(&path).await.is_ok() {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
pub async fn ai_message_cancel_stream(
    state: State<'_, AppData>,
    request_id: String,
) -> Result<(), String> {
    info!("尝试取消 AI 流式任务: {}", request_id);
    let mut tasks = state.stream_tasks.lock().await;
    if let Some(handle) = tasks.remove(&request_id) {
        handle.abort();
        info!("AI 流式任务已取消: {}", request_id);
        return Ok(());
    }
    Err(format!("未找到指定请求ID的任务: {}", request_id))
}
