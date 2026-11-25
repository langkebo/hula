//! HTTP 客户端构建策略。
//!
//! 统一收敛两件事：
//! 1. TLS 校验：debug 构建曾对**所有**目标无条件 `danger_accept_invalid_certs(true)`，
//!    用 dev 构建连真实 homeserver 时会完全失去中间人防护。这里把放行范围收窄到
//!    本机回环地址（自签名 `.test` 环境），远程主机一律强制校验证书。
//! 2. 重定向：上传等「目标地址经白名单校验」的请求必须禁用跟随重定向，
//!    否则服务端可用 3xx 把请求转发到内网地址，绕过白名单形成 SSRF。

use reqwest::redirect::Policy;

/// 提取归一化主机名（小写、去尾部点、去 IPv6 方括号）。
///
/// 解析失败返回 `None`（调用方据此**不放宽**校验）。
fn normalized_host(url: &str) -> Option<String> {
    let parsed = url::Url::parse(url).ok()?;
    let host = parsed.host_str()?;
    let normalized = host.trim_end_matches('.').to_ascii_lowercase();
    Some(
        normalized
            .strip_prefix('[')
            .and_then(|h| h.strip_suffix(']'))
            .unwrap_or(&normalized)
            .to_string(),
    )
}

/// debug 构建允许放宽 TLS 校验的目标。
///
/// 放行范围必须与前端
/// `src/services/matrix/network/runtimeFetch.ts` 的 `RELAXED_TLS_HOST_SUFFIXES`
/// 保持一致，否则会出现「应用内可正常连 homeserver，但 Rust 侧健康检查/
/// 管理接口一直因自签名证书失败」的割裂。
///
/// 两类目标：
/// 1. 本机回环地址（`localhost` / `127.0.0.0/8` / `::1`）；
/// 2. RFC 2606 / RFC 6762 保留的本地开发 TLD：`.test` / `.localhost` / `.local`
///    —— 它们不可能指向公网主机，放宽不会削弱对真实服务端的中间人防护。
pub fn relaxed_tls_target(url: &str) -> bool {
    let Some(host) = normalized_host(url) else {
        return false;
    };

    if host
        .parse::<std::net::IpAddr>()
        .map(|addr| addr.is_loopback())
        .unwrap_or(false)
    {
        return true;
    }

    const RESERVED_DEV_SUFFIXES: [&str; 3] = [".test", ".localhost", ".local"];
    host == "localhost"
        || RESERVED_DEV_SUFFIXES
            .iter()
            .any(|suffix| host.ends_with(suffix))
}

/// 构建客户端：debug 构建下仅对本地开发目标放宽 TLS 校验。
pub fn builder_for(url: &str) -> reqwest::ClientBuilder {
    let builder = reqwest::Client::builder();
    if cfg!(debug_assertions) && relaxed_tls_target(url) {
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
    fn loopback_hosts_are_relaxed() {
        assert!(relaxed_tls_target("http://localhost:8008"));
        assert!(relaxed_tls_target("https://app.localhost"));
        assert!(relaxed_tls_target("http://127.0.0.1:8008"));
        assert!(relaxed_tls_target("http://127.0.0.2:8008"));
        assert!(relaxed_tls_target("http://[::1]:8008"));
    }

    /// 与前端 `RELAXED_TLS_HOST_SUFFIXES`（`.test` / `.localhost` / `.local`）保持一致：
    /// 这几个 TLD 由 RFC 2606 / RFC 6762 保留给本地网络，永远不会是公网域名。
    #[test]
    fn reserved_dev_tlds_are_relaxed() {
        assert!(relaxed_tls_target("https://matrix.test"));
        assert!(relaxed_tls_target("https://hs.dev.test:8443"));
        assert!(relaxed_tls_target("https://matrix.local"));
        assert!(relaxed_tls_target("https://app.localhost"));
        assert!(relaxed_tls_target("http://localhost:8008"));
        assert!(relaxed_tls_target("http://127.0.0.1:8008"));
    }

    #[test]
    fn public_hosts_are_not_relaxed() {
        // 后缀必须是完整标签：`test.com` / `notlocal.local.example.com` 不解宽
        assert!(!relaxed_tls_target("https://test.com"));
        assert!(!relaxed_tls_target("https://notlocal.local.example.com"));
        assert!(!relaxed_tls_target("https://matrix.example.com"));
        assert!(!relaxed_tls_target("https://10.0.0.1"));
        assert!(!relaxed_tls_target("not a url"));
        assert!(!relaxed_tls_target(""));
    }
}
