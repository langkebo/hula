use crate::common::cmd_error::{cmd_error, cmd_error_with_detail};
use crate::common::path_guard::path_is_within;
use bytes::Bytes;
use futures_util::stream::try_unfold;
use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{collections::HashMap, path::PathBuf};
use tauri::{AppHandle, Manager, ipc::Channel, path::BaseDirectory};
use tokio::{fs::File, io::AsyncReadExt};
use url::Url;

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
    validate_upload_url(&url)?;
    let headers = headers.unwrap_or_default();
    for (key, value) in &headers {
        validate_upload_header(key, value)?;
    }
    upload_put(url, file_path, headers, on_progress).await
}

/// 上传命令允许读取的根目录：应用数据目录与应用缓存目录。
///
/// 目录不存在时尽力创建，保证后续 `path_is_within` 的 `canonicalize` 能正常比对。
fn allowed_upload_roots(app_handle: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(dir) = app_handle.path().app_data_dir() {
        let _ = std::fs::create_dir_all(&dir);
        roots.push(dir);
    }
    if let Ok(dir) = app_handle.path().app_cache_dir() {
        let _ = std::fs::create_dir_all(&dir);
        roots.push(dir);
    }
    roots
}

/// 解析上传源文件路径，并强制其落在应用作用域目录内。
///
/// 安全：绝对路径不再被直接放行，必须通过 `path_is_within`（含 `canonicalize`，
/// 可解析符号链接与 `..`）校验；相对路径统一以 `AppData` 为基准，避免依赖进程 CWD。
fn resolve_upload_path(
    app_handle: &AppHandle,
    path: &str,
    base_dir: Option<&str>,
) -> Result<PathBuf, String> {
    let resolved = match base_dir {
        Some(base_dir) => {
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
                .map_err(|e| format!("Failed to resolve file path: {e}"))?
        }
        None if PathBuf::from(path).is_absolute() => PathBuf::from(path),
        None => app_handle
            .path()
            .resolve(path, BaseDirectory::AppData)
            .map_err(|e| format!("Failed to resolve file path: {e}"))?,
    };

    if !resolved.is_file() {
        return Err(cmd_error_with_detail(
            "UPLOAD_SOURCE_MISSING",
            resolved.display(),
        ));
    }

    let roots = allowed_upload_roots(app_handle);
    if !roots.iter().any(|root| path_is_within(&resolved, root)) {
        return Err(cmd_error_with_detail("UPLOAD_PATH_OUTSIDE_APP_DATA", path));
    }

    Ok(resolved)
}

/// 上传目标地址白名单：仅允许 http(s)，且拒绝回环 / 私网 / 链路本地 / 云元数据地址。
///
/// 目的是阻断「本地文件 → 任意 URL」的数据外泄链路，以及 SSRF。
fn validate_upload_url(url: &str) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|e| cmd_error_with_detail("UPLOAD_URL_INVALID", e))?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(cmd_error_with_detail("UPLOAD_SCHEME_NOT_ALLOWED", url));
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(cmd_error_with_detail("UPLOAD_URL_HAS_CREDENTIALS", url));
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| cmd_error_with_detail("UPLOAD_URL_MISSING_HOST", url))?;
    if is_forbidden_upload_host(host) {
        return Err(cmd_error_with_detail("UPLOAD_HOST_FORBIDDEN", url));
    }

    Ok(())
}

fn is_forbidden_upload_host(host: &str) -> bool {
    let normalized = host.trim_end_matches('.').to_ascii_lowercase();
    // IPv6 字面量在 URL 里带方括号（`[::1]`），剥掉后才能交给 IpAddr::parse；
    // 否则 `http://[::1]/` 会被误判成域名而放行。
    let host = normalized
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(&normalized);
    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }
    match host.parse::<std::net::IpAddr>() {
        Ok(addr) => is_forbidden_upload_ip(addr),
        // 域名本身无法在此解析，交由 DNS 层；至少拦截字面量 IP 与 localhost。
        Err(_) => false,
    }
}

fn is_forbidden_upload_ip(addr: std::net::IpAddr) -> bool {
    use std::net::IpAddr;

    match addr {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.is_multicast()
        }
        IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                return is_forbidden_upload_ip(IpAddr::V4(v4));
            }
            let first_segment = v6.segments()[0];
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                // fc00::/7 唯一本地地址
                || (first_segment & 0xfe00) == 0xfc00
                // fe80::/10 链路本地地址
                || (first_segment & 0xffc0) == 0xfe80
        }
    }
}

/// 上传 header 白名单校验：拒绝 hop-by-hop 头、凭据混淆头与 CRLF 注入。
fn validate_upload_header(key: &str, value: &str) -> Result<(), String> {
    let normalized = key.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(cmd_error("UPLOAD_HEADER_NAME_EMPTY"));
    }
    if !normalized
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'-')
    {
        return Err(cmd_error_with_detail("UPLOAD_HEADER_NAME_INVALID", key));
    }
    if value.contains('\r') || value.contains('\n') {
        return Err(cmd_error_with_detail("UPLOAD_HEADER_VALUE_INVALID", key));
    }

    const FORBIDDEN_HEADERS: &[&str] = &[
        "host",
        "cookie",
        "content-length",
        "transfer-encoding",
        "connection",
        "keep-alive",
        "upgrade",
        "proxy-authorization",
        "proxy-authenticate",
        "te",
        "trailer",
        "expect",
        "forwarded",
        "x-forwarded-for",
        "x-forwarded-host",
        "x-forwarded-proto",
        "x-real-ip",
    ];
    if FORBIDDEN_HEADERS.contains(&normalized.as_str()) {
        return Err(cmd_error_with_detail("UPLOAD_HEADER_FORBIDDEN", key));
    }

    Ok(())
}

/// 将拖拽/选择的文件复制到应用作用域目录（`$APPDATA/userData/dropped`），
/// 并返回复制后的目标绝对路径。
///
/// 该命令直接复制文件，不经过 `tauri-plugin-fs` 的能力 scope 检查，
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
        return Err(cmd_error_with_detail("DROP_PATH_NOT_ABSOLUTE", source_path));
    }
    if !source.is_file() {
        return Err(cmd_error_with_detail("DROP_FILE_MISSING", source_path));
    }

    // 白名单：源文件必须位于用户主目录（$HOME）之内，否则拒绝。
    let home_dir = app_handle
        .path()
        .home_dir()
        .map_err(|e| format!("failed to resolve home directory: {e}"))?;
    if !path_is_within(&source, &home_dir) {
        return Err(cmd_error_with_detail("DROP_OUTSIDE_HOME", source_path));
    }

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data directory: {e}"))?;
    // 与前端 PathUtil 的 USER_DATA（"userData"）根目录保持一致，落在 $APPDATA/** 作用域内
    let dest_dir = app_data_dir.join("userData").join("dropped");
    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| format!("failed to create destination directory: {e}"))?;

    // 尽力而为地清理过期文件，避免 dropped 目录无界增长。
    // 清理是同步目录遍历，放到阻塞线程池，避免大目录时占住 tokio worker。
    {
        let dir = dest_dir.clone();
        let _ = tokio::task::spawn_blocking(move || cleanup_dropped_dir(&dir)).await;
    }

    let dest_path = dest_dir.join(unique_file_name(&file_name));
    tokio::fs::copy(&source, &dest_path)
        .await
        .map_err(|e| format!("failed to copy file: {e}"))?;

    Ok(dest_path.to_string_lossy().to_string())
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

    // .test 自签名证书：仅 debug 构建 + 本机回环地址放宽 TLS 校验。
    // 同时禁用重定向：URL 已通过白名单校验，若允许跟随 3xx，服务端可将请求
    // 转发到内网地址从而绕过白名单（SSRF）。
    let client = crate::common::http_client::no_redirect_builder(&url)
        .build()
        .map_err(|e| format!("failed to build upload HTTP client: {e}"))?;
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
        let dir = std::env::temp_dir().join(format!("tjg-upload-cmd-{tag}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
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

    #[test]
    fn validate_upload_url_accepts_public_https() {
        assert!(validate_upload_url("https://matrix.example.com/_matrix/media/v3/upload").is_ok());
        assert!(validate_upload_url("http://example.com:8008/upload").is_ok());
    }

    #[test]
    fn validate_upload_url_rejects_non_http_schemes() {
        for url in [
            "file:///etc/passwd",
            "ftp://example.com/x",
            "data:text/plain,hello",
        ] {
            assert!(
                validate_upload_url(url).is_err(),
                "{url} should be rejected"
            );
        }
    }

    #[test]
    fn validate_upload_url_rejects_loopback_private_and_metadata_hosts() {
        for url in [
            "http://localhost:8008/upload",
            "http://api.localhost/upload",
            "http://127.0.0.1/upload",
            "http://[::1]/upload",
            "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.1/upload",
            "http://172.16.0.1/upload",
            "http://192.168.1.2/upload",
            "http://[::ffff:127.0.0.1]/upload",
        ] {
            assert!(
                validate_upload_url(url).is_err(),
                "{url} should be rejected"
            );
        }
    }

    #[test]
    fn validate_upload_url_rejects_embedded_credentials() {
        assert!(validate_upload_url("https://user:pass@example.com/upload").is_err());
    }

    #[test]
    fn validate_upload_header_allows_business_headers() {
        assert!(validate_upload_header("Authorization", "Bearer token").is_ok());
        assert!(validate_upload_header("Content-Type", "application/octet-stream").is_ok());
        assert!(validate_upload_header("X-Trace-Id", "abc-123").is_ok());
    }

    #[test]
    fn validate_upload_header_rejects_forbidden_and_injected_headers() {
        for key in [
            "Host",
            "Cookie",
            "Content-Length",
            "Transfer-Encoding",
            "Connection",
        ] {
            assert!(
                validate_upload_header(key, "value").is_err(),
                "{key} should be rejected"
            );
        }
        assert!(validate_upload_header("X-Trace", "a\r\nHost: evil").is_err());
        assert!(validate_upload_header("Bad Key", "value").is_err());
        assert!(validate_upload_header("", "value").is_err());
    }
}
