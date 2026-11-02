use std::collections::HashMap;
use std::sync::Mutex;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// OAuth `state` 参数的最小/最大长度。
const MIN_STATE_LEN: usize = 16;
const MAX_STATE_LEN: usize = 128;

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
        return Err(format!(
            "OAuth state 长度必须在 {MIN_STATE_LEN}-{MAX_STATE_LEN} 之间"
        ));
    }
    let allowed = state
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~'));
    if !allowed {
        return Err("OAuth state 只能包含 URL 安全字符（字母/数字/-/_/./~）".to_string());
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

const SUCCESS_BODY: &str = "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><h1>登录成功</h1><p>您可以关闭此窗口返回应用。</p></div><script>setTimeout(function(){window.close()}, 2000);</script>";
const INVALID_STATE_BODY: &str = "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><h1>授权校验失败</h1><p>state 参数缺失或不匹配，请重新发起登录。</p></div>";
const MISSING_CODE_BODY: &str = "<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'><h1>授权失败</h1><p>回调缺少授权码。</p></div>";

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
            TcpListener::bind("127.0.0.1:36677")
                .await
                .map_err(|e| format!("启动本地授权服务失败(端口 36677 被占用): {}", e))?
        }
    };

    let local_addr = listener.local_addr().map_err(|e| e.to_string())?;
    let port = local_addr.port();

    // 3. 启动新任务
    let handle = tauri::async_runtime::spawn(async move {
        // 一次性消费：首次成功回调后，任何后续请求（含重复 state）都被拒绝，
        // 防止同一授权码被重放。
        let mut consumed = false;
        while let Ok((mut stream, _)) = listener.accept().await {
            let mut buffer = [0; 1024];
            let Ok(n) = stream.read(&mut buffer).await else {
                continue;
            };
            let request = String::from_utf8_lossy(&buffer[..n]);
            let params = request_query_params(&request);

            let state_matches = !consumed
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
