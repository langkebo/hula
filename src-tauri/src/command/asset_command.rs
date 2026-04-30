use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

/// 动态允许资产协议访问特定路径
/// 用于支持用户从任意位置导入资源（如 3D 模型、本地图片等）
#[tauri::command]
pub fn allow_asset_path(app: AppHandle, path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    let canonical_path = path_buf
        .canonicalize()
        .map_err(|e| format!("Failed to canonicalize path: {e}"))?;

    // 仅允许单个真实文件，避免把目录直接加入 scope。
    if !canonical_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    // 获取资产协议范围并允许该文件
    // 注意：在 Tauri v2 中，使用 FsExt 扩展来管理范围
    let scope = app.fs_scope();
    scope
        .allow_file(&canonical_path)
        .map_err(|e| e.to_string())?;

    tracing::info!("Allowed asset path: {}", canonical_path.display());
    Ok(())
}
