use crate::common::cmd_error::cmd_error;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 日志脱敏：只保留文件名，不把用户的绝对路径写进日志。
fn redacted_path(path: &Path) -> String {
    match path.file_name().and_then(|name| name.to_str()) {
        Some(name) => format!("<file:{name}>"),
        None => "<unnamed>".to_string(),
    }
}

/// 校验资产协议访问请求
///
/// 仅接受已经被授权进入 asset 协议作用域的路径（如 dialog 选择文件后自动授权，
/// 或 `tauri.conf.json` 中静态配置的 `$APPDATA/$RESOURCE/$CACHE/$TEMP`），
/// 避免任意本地路径被动态加入作用域。
#[tauri::command]
pub fn allow_asset_path(app: AppHandle, path: String) -> Result<(), String> {
    let canonical_path = PathBuf::from(&path)
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {e}"))?;

    // 仅允许单个真实文件，避免把目录直接加入 scope。
    if !canonical_path.is_file() {
        return Err(format!("Path is not a file: {path}"));
    }

    if !app.asset_protocol_scope().is_allowed(&canonical_path) {
        tracing::warn!(
            "Rejected asset path outside scope: {}",
            redacted_path(&canonical_path)
        );
        return Err(cmd_error("ASSET_PATH_NOT_ALLOWED"));
    }

    tracing::info!("Allowed asset path: {}", redacted_path(&canonical_path));
    Ok(())
}
