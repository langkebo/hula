//! 外部链接打开命令。
//!
//! `opener` 插件的 `open-url` 权限只能按 URL 通配表达（`https://*`），
//! 无法限制协议，恶意消息里的 `javascript:` / `file:` 等链接会被直接交给系统。
//! 因此这里改由 Rust 侧做协议白名单校验，前端不再申请 `opener:allow-open-url`。

use tauri_plugin_opener::OpenerExt;

use crate::common::cmd_error::{cmd_error, cmd_error_with_detail};

/// 允许交给系统浏览器/邮件客户端打开的协议。
const ALLOWED_SCHEMES: [&str; 3] = ["http", "https", "mailto"];
/// 系统设置深链：通知权限引导需要直接打开对应设置面板。
const ALLOWED_SETTINGS_SCHEMES: [&str; 2] = ["x-apple.systempreferences", "ms-settings"];
/// URL 长度上限，避免异常超长字符串进入系统调用。
const MAX_URL_LEN: usize = 2048;

/// 按 RFC 3986 提取 scheme，不合法时返回 `None`。
fn scheme_of(url: &str) -> Option<&str> {
    let separator = url.find(':')?;
    let scheme = &url[..separator];
    let mut chars = scheme.chars();
    let first = chars.next()?;
    if !first.is_ascii_alphabetic()
        || !chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
    {
        return None;
    }
    Some(scheme)
}

/// 打开外部链接。
///
/// 仅允许 `http` / `https` / `mailto` 以及系统设置深链；其余协议（`file`、`javascript`、
/// `data` 等）一律拒绝，避免消息内容诱导打开本地文件或执行脚本。
#[tauri::command]
pub fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let target = url.trim();
    if target.is_empty() || target.len() > MAX_URL_LEN || target.chars().any(char::is_control) {
        return Err(cmd_error("EXTERNAL_URL_INVALID"));
    }

    let scheme = scheme_of(target)
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| cmd_error("EXTERNAL_URL_INVALID"))?;
    let allowed = ALLOWED_SCHEMES.contains(&scheme.as_str())
        || ALLOWED_SETTINGS_SCHEMES.contains(&scheme.as_str());
    if !allowed {
        return Err(cmd_error_with_detail(
            "EXTERNAL_URL_SCHEME_NOT_ALLOWED",
            &scheme,
        ));
    }

    app.opener()
        .open_url(target, None::<&str>)
        .map_err(|error| cmd_error_with_detail("EXTERNAL_URL_OPEN_FAILED", error))
}

#[cfg(test)]
mod tests {
    use super::scheme_of;

    #[test]
    fn extracts_lowercase_capable_scheme() {
        assert_eq!(scheme_of("https://example.com/a"), Some("https"));
        assert_eq!(scheme_of("mailto:a@b.com"), Some("mailto"));
        assert_eq!(scheme_of("ms-settings:privacy"), Some("ms-settings"));
    }

    #[test]
    fn rejects_malformed_scheme() {
        assert_eq!(scheme_of("javascript:alert(1)"), Some("javascript"));
        assert_eq!(scheme_of("1http://example.com"), None);
        assert_eq!(scheme_of("://example.com"), None);
        assert_eq!(scheme_of("no-scheme"), None);
    }
}
