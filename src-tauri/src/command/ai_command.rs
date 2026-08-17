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
    for flag in ["--version", "-V"] {
        let output = match tokio::process::Command::new(path).arg(flag).output().await {
            Ok(output) => output,
            Err(_) => continue,
        };

        // 合并 stdout 与 stderr：部分 CLI 会把版本号写到 stderr，或以非零退出码返回
        // （例如 OpenClaw 的 ClawX 包装脚本在 Electron 二进制缺失时输出错误到 stderr 并 exit 1）。
        let mut raw = String::from_utf8_lossy(&output.stdout).into_owned();
        raw.push('\n');
        raw.push_str(&String::from_utf8_lossy(&output.stderr));

        if let Some(version) = parse_openclaw_version(&raw) {
            return Some(version);
        }
    }
    None
}

/// 从 `openclaw --version` 的输出中提取语义化版本号。
///
/// 容忍真实世界中的多种输出格式：
/// - ANSI 转义序列（颜色/控制字符）
/// - 前缀/标签文本（如 `openclaw v1.2.3`、`[Updater] Version: 1.0.0, ...`）
/// - 版本号夹杂在多行日志输出中
/// - 版本号写入 stderr 或以非零退出码返回的情况
fn parse_openclaw_version(raw: &str) -> Option<String> {
    let cleaned = strip_ansi(raw);
    for line in cleaned.lines() {
        if let Some(version) = extract_semver(line) {
            return Some(version);
        }
    }
    None
}

/// 移除 ANSI CSI 转义序列（如颜色码 `\x1b[32m` / `\x1b[0m`）。
fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for pc in chars.by_ref() {
                    if ('@'..='~').contains(&pc) {
                        break;
                    }
                }
            }
            continue;
        }
        out.push(c);
    }
    out
}

/// 从单行文本中提取第一个语义化版本号（`X.Y.Z`，可选 `-prerelease` / `+build`）。
///
/// 要求版本核心至少包含两段 `.数字`（`X.Y.Z`），以避开时间戳 `22:12:43.517` 这类
/// 只有一段小数的误匹配。返回的字符串不包含前导 `v`。
fn extract_semver(line: &str) -> Option<String> {
    let bytes = line.as_bytes();
    let n = bytes.len();
    let mut i = 0;
    while i < n {
        let b = bytes[i];
        // 起点：数字，或 `v` 后跟数字
        let version_start = if b.is_ascii_digit() {
            i
        } else if b == b'v' && i + 1 < n && bytes[i + 1].is_ascii_digit() {
            i + 1
        } else {
            i += 1;
            continue;
        };

        let mut j = version_start;
        while j < n && bytes[j].is_ascii_digit() {
            j += 1;
        }

        // 至少两段 `.数字`（X.Y.Z）
        let mut dot_sections = 0;
        while j + 1 < n && bytes[j] == b'.' && bytes[j + 1].is_ascii_digit() {
            dot_sections += 1;
            j += 1;
            while j < n && bytes[j].is_ascii_digit() {
                j += 1;
            }
        }
        if dot_sections < 2 {
            i = version_start + 1;
            continue;
        }

        // 可选预发布 `-xxx`
        if j < n && bytes[j] == b'-' {
            let saved = j;
            j += 1;
            while j < n
                && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'.' || bytes[j] == b'-')
            {
                j += 1;
            }
            if j == saved + 1 {
                j = saved;
            }
        }
        // 可选构建元数据 `+xxx`
        if j < n && bytes[j] == b'+' {
            let saved = j;
            j += 1;
            while j < n
                && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'.' || bytes[j] == b'-')
            {
                j += 1;
            }
            if j == saved + 1 {
                j = saved;
            }
        }

        return Some(line[version_start..j].to_string());
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

#[cfg(test)]
mod tests {
    use super::parse_openclaw_version;

    #[test]
    fn parses_plain_semver() {
        assert_eq!(parse_openclaw_version("1.2.3"), Some("1.2.3".to_string()));
    }

    #[test]
    fn parses_semver_with_v_prefix() {
        assert_eq!(
            parse_openclaw_version("openclaw v1.2.3"),
            Some("1.2.3".to_string())
        );
    }

    #[test]
    fn parses_semver_with_prerelease_and_build() {
        assert_eq!(
            parse_openclaw_version("1.2.3-beta.1+build.42"),
            Some("1.2.3-beta.1+build.42".to_string())
        );
    }

    #[test]
    fn strips_ansi_escape_codes() {
        assert_eq!(
            parse_openclaw_version("\u{1b}[32m1.2.3\u{1b}[0m"),
            Some("1.2.3".to_string())
        );
    }

    #[test]
    fn extracts_version_from_log_line() {
        // 观察到的 ClawX 真实输出格式：版本号夹在带时间戳/日志级别的行中
        assert_eq!(
            parse_openclaw_version(
                "[2026-08-17T22:12:43.517Z] [INFO ] [Updater] Version: 1.0.0, channel: latest"
            ),
            Some("1.0.0".to_string())
        );
    }

    #[test]
    fn ignores_timestamp_like_single_dot_fragments() {
        assert_eq!(parse_openclaw_version("22:12:43.517Z"), None);
    }

    #[test]
    fn returns_none_for_error_output() {
        assert_eq!(
            parse_openclaw_version(
                "Error: ClawX executable not found at /Applications/OpenClaw-Index.app/Contents/MacOS/ClawX\n\
                 Please reinstall ClawX or remove this script"
            ),
            None
        );
    }

    #[test]
    fn parses_date_style_version() {
        assert_eq!(
            parse_openclaw_version("2025.1.28"),
            Some("2025.1.28".to_string())
        );
    }
}
