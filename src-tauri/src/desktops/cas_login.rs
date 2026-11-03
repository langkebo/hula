use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

const CAS_WINDOW_LABEL: &str = "cas-login";
pub const CAS_LOGIN_TOKEN_EVENT: &str = "cas-login-token";

fn extract_login_token(url: &str) -> Option<String> {
    let parsed = Url::parse(url).ok()?;
    parsed
        .query_pairs()
        .find(|(key, _)| key == "loginToken" || key == "login_token")
        .map(|(_, value)| value.into_owned())
        .filter(|value| !value.is_empty())
}

#[tauri::command]
pub async fn open_cas_login_window(
    app: AppHandle,
    login_url: String,
    homeserver_origin: String,
) -> Result<(), String> {
    let login = Url::parse(&login_url).map_err(|e| e.to_string())?;
    let homeserver = Url::parse(&homeserver_origin).map_err(|e| e.to_string())?;
    if login.scheme() != "http" && login.scheme() != "https" {
        return Err("CAS 登录地址必须使用 http/https".to_string());
    }
    if login.origin() != homeserver.origin() {
        return Err("CAS 登录地址必须与家服务器同源".to_string());
    }

    if let Some(existing) = app.get_webview_window(CAS_WINDOW_LABEL) {
        let _ = existing.close();
    }

    let handle = app.clone();
    WebviewWindowBuilder::new(&app, CAS_WINDOW_LABEL, WebviewUrl::External(login))
        .title("CAS 登录")
        .inner_size(480.0, 640.0)
        .resizable(false)
        .on_navigation(move |url| {
            if let Some(token) = extract_login_token(url.as_str()) {
                let _ = handle.emit(CAS_LOGIN_TOKEN_EVENT, token);
                if let Some(window) = handle.get_webview_window(CAS_WINDOW_LABEL) {
                    let _ = window.close();
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
}
