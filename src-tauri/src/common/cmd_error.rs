//! 前端可见错误的统一编码约定。
//!
//! Tauri 命令返回的错误统一使用 `CODE` 或 `CODE: detail` 形式：
//! - `CODE` 为 SCREAMING_SNAKE_CASE，对应前端 `error.cmd.<code>` 翻译键；
//! - `detail` 为路径、URL、底层错误等附加信息，前端以 `{detail}` 插值。
//!
//! 未登记的 CODE 前端会原样展示，因此新增 CODE 时必须同步补充
//! `locales/zh-CN/error.json` 与 `locales/en/error.json`。

/// 生成无附加信息的错误码。
pub fn cmd_error(code: &str) -> String {
    code.to_string()
}

/// 生成带附加信息的错误码，例如 `UPLOAD_SOURCE_MISSING: /tmp/a.txt`。
pub fn cmd_error_with_detail(code: &str, detail: impl std::fmt::Display) -> String {
    format!("{code}: {detail}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_code_has_no_detail() {
        assert_eq!(cmd_error("ADMIN_NOT_LOGGED_IN"), "ADMIN_NOT_LOGGED_IN");
    }

    #[test]
    fn detail_is_appended_after_separator() {
        assert_eq!(
            cmd_error_with_detail("UPLOAD_SOURCE_MISSING", "/tmp/a.txt"),
            "UPLOAD_SOURCE_MISSING: /tmp/a.txt"
        );
    }
}
