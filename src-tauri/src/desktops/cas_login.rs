use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const CAS_WINDOW_LABEL: &str = "cas-login";
pub const CAS_LOGIN_TOKEN_EVENT: &str = "cas-login-token";

/// 从 URL 查询参数中提取第一个非空的 loginToken/login_token 值。
///
/// 使用 `find_map` 而不是 `find` + `filter`，避免 `?loginToken=&loginToken=abc`
/// 这种首个值为空、后续值有效的情况被误判为「无 token」。
fn extract_login_token(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    parsed.query_pairs().find_map(|(key, value)| {
        if (key == "loginToken" || key == "login_token") && !value.is_empty() {
            Some(value.into_owned())
        } else {
            None
        }
    })
}

/// 校验 CAS 登录地址：仅允许 http/https，且必须与家服务器同源。
fn validate_cas_url(login_url: &str, homeserver_origin: &str) -> Result<Url, String> {
    let login = Url::parse(login_url).map_err(|e| e.to_string())?;
    if login.scheme() != "http" && login.scheme() != "https" {
        return Err("CAS 登录地址必须使用 http/https".to_string());
    }
    let homeserver = Url::parse(homeserver_origin).map_err(|e| e.to_string())?;
    if login.origin() != homeserver.origin() {
        return Err("CAS 登录地址必须与家服务器同源".to_string());
    }
    Ok(login)
}

#[tauri::command]
pub async fn open_cas_login_window(
    app: AppHandle,
    login_url: String,
    homeserver_origin: String,
) -> Result<(), String> {
    let login = validate_cas_url(&login_url, &homeserver_origin)?;
    let homeserver = Url::parse(&homeserver_origin).map_err(|e| e.to_string())?;
    let expected_origin = homeserver.origin();

    // 已存在同 label 窗口时不能先 close 再 build：close 只是投递异步关闭消息，
    // build 会同步检查 label，紧接着创建会大概率报 "window already exists"。
    if let Some(existing) = app.get_webview_window(CAS_WINDOW_LABEL) {
        existing.show().map_err(|e| e.to_string())?;
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let handle = app.clone();
    WebviewWindowBuilder::new(&app, CAS_WINDOW_LABEL, WebviewUrl::External(login))
        .title("CAS 登录")
        .inner_size(480.0, 640.0)
        .resizable(false)
        .on_navigation(move |url| {
            // 本架构是内置 CAS，整个流程都发生在与家服务器同源的页面上；
            // 任何离开该 origin 的导航都属于异常场景，直接阻止，避免任意页面注入 token。
            if url.origin() != expected_origin {
                return false;
            }
            if let Some(token) = extract_login_token(url.as_str()) {
                if let Err(err) = handle.emit(CAS_LOGIN_TOKEN_EVENT, token) {
                    tracing::warn!("Failed to emit {}: {}", CAS_LOGIN_TOKEN_EVENT, err);
                }
                if let Some(window) = handle.get_webview_window(CAS_WINDOW_LABEL) {
                    if let Err(err) = window.close() {
                        tracing::warn!("Failed to close {} window: {}", CAS_WINDOW_LABEL, err);
                    }
                }
                return false;
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_login_token_from_query() {
        assert_eq!(
            extract_login_token("http://localhost:8008/?loginToken=abc123"),
            Some("abc123".to_string())
        );
        assert_eq!(
            extract_login_token("http://localhost:8008/?login_token=abc123"),
            Some("abc123".to_string())
        );
    }

    #[test]
    fn ignores_urls_without_token() {
        assert_eq!(extract_login_token("http://localhost:8008/"), None);
        assert_eq!(extract_login_token("not a url"), None);
    }

    #[test]
    fn skips_empty_token_values() {
        assert_eq!(
            extract_login_token("http://localhost:8008/?loginToken=&loginToken=abc"),
            Some("abc".to_string())
        );
        assert_eq!(
            extract_login_token("http://localhost:8008/?loginToken=&login_token="),
            None
        );
    }

    #[test]
    fn rejects_non_http_scheme() {
        assert!(
            validate_cas_url(
                "ftp://localhost:8008/?loginToken=abc",
                "http://localhost:8008"
            )
            .is_err()
        );
    }

    #[test]
    fn rejects_cross_origin_url() {
        assert!(
            validate_cas_url("http://evil.com/?loginToken=abc", "http://localhost:8008").is_err()
        );
    }

    #[test]
    fn rejects_file_url() {
        assert!(
            validate_cas_url(
                "file:///tmp/cas.html?loginToken=abc",
                "http://localhost:8008"
            )
            .is_err()
        );
    }

    #[test]
    fn accepts_same_origin_http_url() {
        assert_eq!(
            validate_cas_url(
                "http://localhost:8008/cas?loginToken=abc",
                "http://localhost:8008"
            )
            .map(|url| url.host_str().map(str::to_string))
            .ok()
            .flatten(),
            Some("localhost".to_string())
        );
    }
}
