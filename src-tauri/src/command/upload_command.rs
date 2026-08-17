use bytes::Bytes;
use futures_util::stream::try_unfold;
use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{collections::HashMap, path::PathBuf};
use tauri::{AppHandle, Manager, ipc::Channel, path::BaseDirectory};
use tokio::{fs::File, io::AsyncReadExt};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadProgressPayload {
    pub progress_total: u64,
    pub total: u64,
}

#[tauri::command]
pub async fn upload_file_put(
    app_handle: AppHandle,
    url: String,
    path: String,
    base_dir: Option<String>,
    headers: Option<HashMap<String, String>>,
    on_progress: Channel<UploadProgressPayload>,
) -> Result<(), String> {
    let file_path = resolve_upload_path(&app_handle, &path, base_dir.as_deref())?;
    upload_put(url, file_path, headers.unwrap_or_default(), on_progress).await
}

fn resolve_upload_path(
    app_handle: &AppHandle,
    path: &str,
    base_dir: Option<&str>,
) -> Result<PathBuf, String> {
    let path_buf = PathBuf::from(path);
    if path_buf.is_absolute() {
        return Ok(path_buf);
    }

    let Some(base_dir) = base_dir else {
        return Ok(path_buf);
    };

    let base_dir = match base_dir {
        "AppCache" | "appCache" | "app_cache" => BaseDirectory::AppCache,
        "AppData" | "appData" | "app_data" => BaseDirectory::AppData,
        _ => {
            return Err(format!(
                "Unsupported baseDir: {base_dir}, expected AppCache/AppData"
            ));
        }
    };

    app_handle
        .path()
        .resolve(path, base_dir)
        .map_err(|e| format!("Failed to resolve file path: {e}"))
}

/// 将拖拽/选择的文件复制到应用作用域目录（`$APPDATA/userData/dropped`），
/// 并返回复制后的目标绝对路径。
///
/// 该命令使用 `std::fs::copy`，不经过 `tauri-plugin-fs` 的能力 scope 检查，
/// 因此可以复制位于 `$HOME` 下（含 `$DESKTOP/$PICTURES/$DOCUMENTS/$DOWNLOADS`）
/// 的拖拽文件。复制后的文件位于 `$APPDATA/**` 内，前端随后用 plugin-fs 的
/// `readFile`/`stat` 以绝对路径读取即可通过 `fs:read-files` 收窄后的 scope。
///
/// 安全：仅接受用户主目录（`$HOME`）之下的源文件，拒绝 `/etc`、`/var`、
/// `~/.ssh` 等系统敏感路径，避免被可执行 JS 的前端误用为任意路径复制/读取。
#[tauri::command]
pub async fn copy_file_to_app_scope(
    app_handle: AppHandle,
    source_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.is_absolute() {
        return Err(format!("拖拽文件路径不是绝对路径: {source_path}"));
    }
    if !source.is_file() {
        return Err(format!("拖拽文件不存在: {source_path}"));
    }

    // 白名单：源文件必须位于用户主目录（$HOME）之内，否则拒绝。
    let home_dir = app_handle
        .path()
        .home_dir()
        .map_err(|e| format!("获取用户主目录失败: {e}"))?;
    if !path_is_within(&source, &home_dir) {
        return Err(format!("拒绝复制主目录之外的文件: {source_path}"));
    }

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {e}"))?;
    // 与前端 PathUtil 的 USER_DATA（"userData"）根目录保持一致，落在 $APPDATA/** 作用域内
    let dest_dir = app_data_dir.join("userData").join("dropped");
    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("创建目标目录失败: {e}"))?;

    // 尽力而为地清理过期文件，避免 dropped 目录无界增长
    cleanup_dropped_dir(&dest_dir);

    let dest_path = dest_dir.join(unique_file_name(&file_name));
    std::fs::copy(&source, &dest_path).map_err(|e| format!("复制文件失败: {e}"))?;

    Ok(dest_path.to_string_lossy().to_string())
}

/// 判断规范化后的 `source` 是否位于 `base` 目录之内（含 `base` 本身）。
///
/// 使用 `canonicalize` 解析符号链接与 `..`，防止 `~/../etc/passwd` 这类路径绕过白名单。
/// 任一侧无法规范化时返回 `false`（保守拒绝）。
fn path_is_within(source: &Path, base: &Path) -> bool {
    let Ok(source) = source.canonicalize() else {
        return false;
    };
    let Ok(base) = base.canonicalize() else {
        return false;
    };
    source.starts_with(&base)
}

/// dropped 目录文件数上限：超过后按修改时间删除最旧的文件（尽力而为）。
const MAX_DROPPED_FILES: usize = 100;

/// 尽力而为地清理 `dropped` 目录：当文件数超过 `MAX_DROPPED_FILES` 时，
/// 删除修改时间最旧的若干文件，避免无界磁盘增长。任何失败均被忽略。
fn cleanup_dropped_dir(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };

    let mut files: Vec<(SystemTime, PathBuf)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        let Ok(modified) = metadata.modified() else {
            continue;
        };
        files.push((modified, path));
    }

    if files.len() <= MAX_DROPPED_FILES {
        return;
    }
    files.sort_by_key(|(modified, _)| *modified);
    let to_remove = files.len() - MAX_DROPPED_FILES;
    for (_, path) in files.into_iter().take(to_remove) {
        let _ = std::fs::remove_file(path);
    }
}

/// 为目标文件名追加纳秒时间戳，避免同名拖拽文件相互覆盖。
fn unique_file_name(file_name: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    match file_name.rfind('.') {
        Some(idx) if idx > 0 => format!("{}_{}{}", &file_name[..idx], nanos, &file_name[idx..]),
        _ => format!("{file_name}_{nanos}"),
    }
}

async fn upload_put(
    url: String,
    file_path: PathBuf,
    headers: HashMap<String, String>,
    on_progress: Channel<UploadProgressPayload>,
) -> Result<(), String> {
    let file = File::open(&file_path)
        .await
        .map_err(|e| format!("Failed to open file: {e}"))?;
    let total = file
        .metadata()
        .await
        .map_err(|e| format!("Failed to read file metadata: {e}"))?
        .len();

    let chunk_size: usize = 4 * 1024 * 1024;
    let stream = try_unfold(
        (file, 0_u64, on_progress),
        move |(mut file, mut transferred, on_progress)| async move {
            let mut buf = vec![0u8; chunk_size];
            let read = file.read(&mut buf).await?;

            if read == 0 {
                return Ok::<_, std::io::Error>(None);
            }

            buf.truncate(read);
            transferred = transferred.saturating_add(read as u64);

            let _ = on_progress.send(UploadProgressPayload {
                progress_total: transferred,
                total,
            });

            Ok(Some((Bytes::from(buf), (file, transferred, on_progress))))
        },
    );

    // .test 自签名证书：debug 构建放宽 TLS 校验（与 start_homeserver_health_check 一致），
    // 生产构建仍强制校验证书。
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(cfg!(debug_assertions))
        .build()
        .map_err(|e| format!("创建上传 HTTP 客户端失败: {e}"))?;
    let mut request = client
        .put(url)
        .header(reqwest::header::CONTENT_LENGTH, total)
        .body(reqwest::Body::wrap_stream(stream));

    for (key, value) in headers {
        request = request.header(key, value);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Upload request failed: {e}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("Upload failed with status {status}: {body}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "tjg-upload-cmd-{tag}-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn path_is_within_accepts_home_dir_file() {
        let home = temp_home_dir("accept-home");
        let inside = home.join("dropped.txt");
        std::fs::write(&inside, b"x").unwrap();

        assert!(path_is_within(&inside, &home));

        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn path_is_within_rejects_file_outside_home() {
        let home = temp_home_dir("reject-home");
        let outside_base = temp_home_dir("reject-outside");
        let outside = outside_base.join("secret.txt");
        std::fs::write(&outside, b"x").unwrap();

        assert!(!path_is_within(&outside, &home));

        let _ = std::fs::remove_dir_all(&home);
        let _ = std::fs::remove_dir_all(&outside_base);
    }

    #[test]
    fn path_is_within_rejects_dotdot_traversal() {
        // `home/../<sibling>/secret.txt` 经 `..` 解析后位于 home 之外，必须被拒绝，
        // 防止 `~/../etc/passwd` 这类路径绕过白名单。
        let home = temp_home_dir("traversal-home");
        let sibling = temp_home_dir("traversal-sibling");
        let secret = sibling.join("secret.txt");
        std::fs::write(&secret, b"x").unwrap();

        let sibling_name = sibling.file_name().unwrap();
        let traversal = home.join("..").join(sibling_name).join("secret.txt");
        assert!(traversal.is_file());
        assert!(!path_is_within(&traversal, &home));

        let _ = std::fs::remove_dir_all(&home);
        let _ = std::fs::remove_dir_all(&sibling);
    }

    #[test]
    fn path_is_within_rejects_etc_passwd() {
        // 系统敏感路径（存在时）必须被拒绝，即使它确实是一个文件。
        let home = temp_home_dir("etc-home");
        let etc_passwd = Path::new("/etc/passwd");
        if etc_passwd.is_file() {
            assert!(!path_is_within(etc_passwd, &home));
        }

        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn cleanup_dropped_dir_removes_oldest_when_over_cap() {
        let dir = temp_home_dir("dropped");
        // 写入 MAX_DROPPED_FILES + 5 个文件
        for i in 0..(MAX_DROPPED_FILES + 5) {
            let path = dir.join(format!("file-{i:04}.bin"));
            std::fs::write(&path, vec![0u8; 4]).unwrap();
        }

        cleanup_dropped_dir(&dir);

        let remaining = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.path().is_file())
            .count();
        assert_eq!(remaining, MAX_DROPPED_FILES);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
