use bytes::Bytes;
use futures_util::stream::try_unfold;
use serde::Serialize;
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
