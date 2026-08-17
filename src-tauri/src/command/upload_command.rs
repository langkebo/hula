use bytes::Bytes;
use futures_util::stream::try_unfold;
use serde::Serialize;
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

/// 将任意绝对路径的文件复制到应用作用域目录（`$APPDATA/userData/dropped`），
/// 并返回复制后的目标绝对路径。
///
/// 该命令使用 `std::fs::copy`，不经过 `tauri-plugin-fs` 的能力 scope 检查，
/// 因此可以复制位于 `$HOME/$DESKTOP/$PICTURES/$DOCUMENTS` 下的拖拽文件。
/// 复制后的文件位于 `$APPDATA/**` 内，前端随后用 plugin-fs 的 `readFile`/`stat`
/// 以绝对路径读取即可通过 `fs:read-files` 收窄后的 scope。
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

    let dest_path = dest_dir.join(unique_file_name(&file_name));
    std::fs::copy(&source, &dest_path).map_err(|e| format!("复制文件失败: {e}"))?;

    Ok(dest_path.to_string_lossy().to_string())
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
