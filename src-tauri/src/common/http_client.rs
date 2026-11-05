//! HTTP 客户端构建策略。
//!
//! 统一收敛两件事：
//! 1. TLS 校验：debug 构建曾对**所有**目标无条件 `danger_accept_invalid_certs(true)`，
//!    用 dev 构建连真实 homeserver 时会完全失去中间人防护。这里把放行范围收窄到
//!    本机回环地址（自签名 `.test` 环境），远程主机一律强制校验证书。
//! 2. 重定向：上传等「目标地址经白名单校验」的请求必须禁用跟随重定向，
//!    否则服务端可用 3xx 把请求转发到内网地址，绕过白名单形成 SSRF。

use reqwest::redirect::Policy;

/// 判断 URL 的主机是否为回环地址（`localhost` / `127.0.0.0/8` / `::1`）。
///
/// 解析失败一律返回 `false`（不放宽校验）。
pub fn is_loopback_url(url: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };

    let normalized = host.trim_end_matches('.').to_ascii_lowercase();
    // IPv6 字面量在 URL 里带方括号，剥掉后才能交给 IpAddr::parse。
    let host = normalized
        .strip_prefix('[')
        .and_then(|h| h.strip_suffix(']'))
        .unwrap_or(&normalized);

    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }

    host.parse::<std::net::IpAddr>()
        .map(|addr| addr.is_loopback())
        .unwrap_or(false)
}

/// 构建客户端：debug 构建下仅对本机回环地址放宽 TLS 校验。
pub fn builder_for(url: &str) -> reqwest::ClientBuilder {
    let builder = reqwest::Client::builder();
    if cfg!(debug_assertions) && is_loopback_url(url) {
        builder.danger_accept_invalid_certs(true)
    } else {
        builder
    }
}

/// 构建「禁止跟随重定向」的客户端，用于目标地址已做白名单校验的请求。
pub fn no_redirect_builder(url: &str) -> reqwest::ClientBuilder {
    builder_for(url).redirect(Policy::none())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_hosts_are_recognized() {
        assert!(is_loopback_url("http://localhost:8008"));
        assert!(is_loopback_url("https://app.localhost"));
        assert!(is_loopback_url("http://127.0.0.1:8008"));
        assert!(is_loopback_url("http://127.0.0.2:8008"));
        assert!(is_loopback_url("http://[::1]:8008"));
    }

    #[test]
    fn remote_hosts_are_not_loopback() {
        assert!(!is_loopback_url("https://matrix.example.com"));
        assert!(!is_loopback_url("https://10.0.0.1"));
        assert!(!is_loopback_url("not a url"));
        assert!(!is_loopback_url(""));
    }
}
