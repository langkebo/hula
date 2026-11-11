use crate::common::cmd_error::cmd_error_with_detail;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// OAuth `state` 参数的最小/最大长度。
const MIN_STATE_LEN: usize = 16;
const MAX_STATE_LEN: usize = 128;

/// 回调监听的存活上限：用户放弃登录后，监听任务必须自行退出，不能永久占着端口 accept。
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(300);

/// 定义状态以管理 OAuth 服务器任务
pub struct OauthServerState {
    pub handle: Mutex<Option<JoinHandle<()>>>,
}

impl Default for OauthServerState {
    fn default() -> Self {
        Self {
            handle: Mutex::new(None),
        }
    }
}

/// 校验调用方生成的 `state`：长度受限 + 仅允许 URL 安全字符。
///
/// 回调监听器只接受与之一致的 `state`，用于阻断授权码注入 / 会话固定。
fn validate_expected_state(state: &str) -> Result<(), String> {
    if !(MIN_STATE_LEN..=MAX_STATE_LEN).contains(&state.len()) {
        return Err(cmd_error_with_detail(
            "OAUTH_STATE_INVALID",
            format!("length must be {MIN_STATE_LEN}-{MAX_STATE_LEN}"),
        ));
    }
    let allowed = state
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~'));
    if !allowed {
        return Err(cmd_error_with_detail(
            "OAUTH_STATE_INVALID_CHARS",
            "only URL-safe characters are allowed",
        ));
    }
    Ok(())
}

/// 从 HTTP 请求行中提取查询参数（`GET /callback?code=...&state=... HTTP/1.1`）。
///
/// 相比在整段请求里做子串查找，按 `&` 与首个 `=` 切分可避免 `xstate=` 之类的误匹配。
fn request_query_params(request: &str) -> HashMap<String, String> {
    let request_line = request.lines().next().unwrap_or("");
    let path = request_line.split_whitespace().nth(1).unwrap_or("");
    let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");
    query
        .split('&')
        .filter(|pair| !pair.is_empty())
        .filter_map(|pair| pair.split_once('='))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
}

const SUCCESS_BODY: &str = "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><h1>Login successful</h1><p>You can close this window and return to the app.</p></div><script>setTimeout(function(){window.close()}, 2000);</script>";
const INVALID_STATE_BODY: &str = "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><h1>Authorization check failed</h1><p>The state parameter is missing or does not match. Please start the login again.</p></div>";
const MISSING_CODE_BODY: &str = "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><h1>Authorization failed</h1><p>The callback is missing the authorization code.</p></div>";

/// 校验回调请求的 `Host` 头是否指向本机回环地址。
///
/// 固定端口 + 无 Host 校验时，攻击者可用 DNS rebinding 让自己的域名解析到 127.0.0.1，
/// 从而在其页面里读取授权码。只接受 localhost / 127.0.0.1 / [::1]（可带端口）。
fn host_header_is_loopback(request: &str) -> bool {
    request
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("host")
                .then(|| value.trim().to_ascii_lowercase())
        })
        .is_some_and(|host| {
            host == "localhost"
                || host.starts_with("localhost:")
                || host == "127.0.0.1"
                || host.starts_with("127.0.0.1:")
                || host.starts_with("[::1]")
        })
}

#[tauri::command]
pub async fn start_oauth_server<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, OauthServerState>,
    expected_state: String,
) -> Result<u16, String> {
    validate_expected_state(&expected_state)?;

    // 1. 尝试终止旧任务
    {
        let mut handle_lock = state.handle.lock().map_err(|e| e.to_string())?;
        if let Some(handle) = handle_lock.take() {
            handle.abort(); // 终止旧任务
        }
    }

    // 2. 尝试绑定端口
    // 如果端口仍被占用（可能是操作系统还没释放），可以重试几次或直接报错
    // 这里简单处理：如果被占用，可能是上次任务虽然 abort 了但 socket 还没释放，或者被其他程序占用
    // 由于我们 abort 了任务，listener 应该被 drop，端口应该被释放。
    // 但 TcpListener drop 后端口释放可能不是立即的。

    let listener = match TcpListener::bind("127.0.0.1:36677").await {
        Ok(l) => l,
        Err(_) => {
            // 如果绑定失败，可能是端口还未释放，稍等一下再试
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            TcpListener::bind("127.0.0.1:36677").await.map_err(|e| {
                cmd_error_with_detail(
                    "OAUTH_LOCAL_SERVER_START_FAILED",
                    format!("port 36677 is unavailable: {e}"),
                )
            })?
        }
    };

    let local_addr = listener.local_addr().map_err(|e| e.to_string())?;
    let port = local_addr.port();

    // 3. 启动新任务
    let handle = tauri::async_runtime::spawn(async move {
        // 一次性消费：首次成功回调后立刻停止监听，防止同一授权码被重放，
        // 也避免用户放弃登录后监听任务永久占着端口。
        let mut consumed = false;
        let deadline = tokio::time::Instant::now() + CALLBACK_TIMEOUT;
        loop {
            let Ok(Ok((mut stream, _))) =
                tokio::time::timeout_at(deadline, listener.accept()).await
            else {
                break;
            };
            let mut buffer = [0; 1024];
            let Ok(n) = stream.read(&mut buffer).await else {
                continue;
            };
            let request = String::from_utf8_lossy(&buffer[..n]);
            let params = request_query_params(&request);

            // Host 不是回环地址时一律拒绝，阻断 DNS rebinding 读取授权码。
            let host_trusted = host_header_is_loopback(&request);
            let state_matches = host_trusted
                && !consumed
                && params
                    .get("state")
                    .is_some_and(|value| value == &expected_state);

            let (status_line, body, emitted) = if !state_matches {
                ("HTTP/1.1 400 Bad Request", INVALID_STATE_BODY, false)
            } else if let Some(token) = params.get("token") {
                let refresh = params.get("refreshToken").map(String::as_str).unwrap_or("");
                let uid = params.get("uid").map(String::as_str).unwrap_or("");
                let payload = format!("token={}&refreshToken={}&uid={}", token, refresh, uid);
                let _ = app.emit("oauth-token", payload);
                ("HTTP/1.1 200 OK", SUCCESS_BODY, true)
            } else if let Some(code) = params.get("code") {
                let _ = app.emit("gitee-auth-code", code.clone());
                ("HTTP/1.1 200 OK", SUCCESS_BODY, true)
            } else {
                ("HTTP/1.1 400 Bad Request", MISSING_CODE_BODY, false)
            };

            if emitted {
                consumed = true;
            }

            let response = format!(
                "{status_line}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes()).await;
            let _ = stream.flush().await;

            if consumed {
                break;
            }
        }
    });

    // 4. 保存新任务句柄
    {
        let mut handle_lock = state.handle.lock().map_err(|e| e.to_string())?;
        *handle_lock = Some(handle);
    }

    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_expected_state_accepts_url_safe_value() {
        assert!(validate_expected_state("abcdefghijklmnop-_.~123").is_ok());
        assert!(validate_expected_state(&"a".repeat(MIN_STATE_LEN)).is_ok());
        assert!(validate_expected_state(&"a".repeat(MAX_STATE_LEN)).is_ok());
    }

    #[test]
    fn validate_expected_state_rejects_too_short_long_or_unsafe() {
        assert!(validate_expected_state("short").is_err());
        assert!(validate_expected_state(&"a".repeat(MAX_STATE_LEN + 1)).is_err());
        assert!(validate_expected_state("abcdefghijklmnop&admin=true").is_err());
        assert!(validate_expected_state("abcdefghijklmnop state").is_err());
    }

    #[test]
    fn request_query_params_parses_first_line_only() {
        let request = "GET /callback?code=abc&state=xyz&xstate=evil HTTP/1.1\r\nHost: localhost\r\n\r\nstate=body";
        let params = request_query_params(request);

        assert_eq!(params.get("code").map(String::as_str), Some("abc"));
        assert_eq!(params.get("state").map(String::as_str), Some("xyz"));
        assert_eq!(params.get("xstate").map(String::as_str), Some("evil"));
        assert_eq!(params.len(), 3);
    }

    #[test]
    fn request_query_params_returns_empty_without_query() {
        assert!(request_query_params("GET / HTTP/1.1\r\n\r\n").is_empty());
        assert!(request_query_params("").is_empty());
    }
}
