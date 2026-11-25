use crate::utils::secure_store::{SecureStore, StorageBackend};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tracing::{debug, info, warn};

/// 上次已告警过的降级后端。
///
/// 前端 availability 探测带 60s TTL，每轮都会重新 invoke 本命令；后端探测结果
/// 不变时若每次都 `warn!`，终端会被同一条降级信息持续刷屏。仅在降级后端发生变化时
/// 再告警，其余降为 `debug`。
fn degraded_warned_backend() -> &'static Mutex<Option<String>> {
    static WARNED: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    WARNED.get_or_init(|| Mutex::new(None))
}

fn lock_degraded_warned() -> std::sync::MutexGuard<'static, Option<String>> {
    degraded_warned_backend()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 本次降级是否需要发出告警：同一后端仅首次为 `true`。
fn should_warn_degraded(backend: &str) -> bool {
    let mut warned = lock_degraded_warned();
    if warned.as_deref() == Some(backend) {
        return false;
    }
    *warned = Some(backend.to_string());
    true
}

/// 恢复原生后端后清空记录，便于再次降级时仍能告警。
fn clear_degraded_warned() {
    *lock_degraded_warned() = None;
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecureStorageCheckResponse {
    /// 至少一个后端可用（原生密钥库或加密文件 fallback）
    pub available: bool,
    /// **实际生效**的后端标识：原生密钥库名、`encrypted_file_fallback`、或 `unavailable`
    pub backend: String,
    /// 平台原生密钥库（Keychain / Credential Manager / Secret Service）实测是否可用
    pub native_available: bool,
    /// `available && !native_available`：secret 实际只受 master-key 加密的文件保护。
    /// 调用方据此**不得**宣称"已存入系统密钥库"。
    pub degraded: bool,
}

/// 允许通过 IPC 读写系统钥匙串的键名前缀（白名单）。
///
/// 渲染层被注入后可调用 `get_secret` / `set_secret` / `delete_secret`；
/// 若键名不受约束，攻击者能把任意字符串当作键名探测或覆盖钥匙串条目。
/// **新增 secret 必须先在 `src/services/secure/` 登记，并在此追加前缀**，
/// 否则前端调用会直接失败。
const ALLOWED_KEY_PREFIXES: &[&str] = &[
    // per 用户/设备的 Matrix crypto store 密钥（cryptoStorageKey.ts）
    "tjg-crypto-storage-password:",
    // TrendRadar API Key，可带 `::<scope>` 账号后缀（robotAiProviderStorage.ts）
    "tjg-chat-trendradar-api-key",
];

/// 校验键名，返回可安全写入日志的脱敏形式。
///
/// 键名后缀含 MXID / deviceId / 账号 scope 等用户标识，日志只保留已登记前缀；
/// 拒绝时也不回显键名，避免把待探测的键名写进日志。
fn authorize_key(key: &str) -> Result<String, String> {
    match ALLOWED_KEY_PREFIXES
        .iter()
        .find(|prefix| key.starts_with(**prefix))
    {
        Some(prefix) => Ok(format!("{prefix}***")),
        None => Err(format!(
            "unregistered secret key rejected (length {})",
            key.chars().count()
        )),
    }
}

#[tauri::command]
pub async fn get_secret(key: String) -> Result<Option<String>, String> {
    let log_key = authorize_key(&key)?;
    info!("Secure storage: get_secret for key '{}'", log_key);
    SecureStore::get(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_secret(key: String, value: String) -> Result<(), String> {
    let log_key = authorize_key(&key)?;
    info!("Secure storage: set_secret for key '{}'", log_key);
    SecureStore::set(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_secret(key: String) -> Result<(), String> {
    let log_key = authorize_key(&key)?;
    info!("Secure storage: delete_secret for key '{}'", log_key);
    SecureStore::delete(&key).map_err(|e| e.to_string())
}

/// 用系统钥匙串托管的主密钥加密会话级敏感值。
///
/// 历史缺陷（审计 H-3）：前端把 per-install 密钥明文写进 localStorage，
/// 任何能读 localStorage 的脚本都能解出 sessionStorage 里的密文。
/// 现改为前端不持有任何密钥，密文由 Rust 侧主密钥（钥匙串）加密。
#[tauri::command]
pub async fn session_secret_encrypt(plaintext: String) -> Result<String, String> {
    crate::utils::crypto::encrypt(&plaintext).map_err(|e| e.to_string())
}

/// 解密 {@link session_secret_encrypt} 产出的密文（兼容历史格式由 crypto 层处理）。
#[tauri::command]
pub async fn session_secret_decrypt(ciphertext: String) -> Result<String, String> {
    crate::utils::crypto::decrypt(&ciphertext).map_err(|e| e.to_string())
}

/// 上报 secure storage 的**实测**可用性。
///
/// 历史缺陷（2026-10-13 修复）：`backend` 按平台**硬编码**为 `macos_keychain`，
/// 而 `available` 是"keychain 或文件 fallback 任一可用"。于是 macOS dev 模式下
/// keychain 写失败、secret 落到明文-adjacent 的加密文件时，日志照旧打印
/// `available=true, backend=macos_keychain`，前端也无条件打印
/// "已从 keychain 获取 crypto storageKey" ⇒ **两层日志都在掩盖降级**。
/// 现改为按实测结果上报，并新增 `nativeAvailable` / `degraded`。
#[tauri::command]
pub async fn check_secure_storage_available() -> Result<SecureStorageCheckResponse, String> {
    let report = SecureStore::check_backends().report();

    debug_assert_eq!(
        report.degraded,
        report.available && !report.native_available,
        "degraded must be equivalent to available but non-native"
    );
    debug_assert!(
        !report.degraded || report.backend == StorageBackend::EncryptedFileFallback.id(),
        "backend must be the encrypted file fallback when degraded (must not report a native platform key store)"
    );

    if report.degraded {
        if should_warn_degraded(&report.backend) {
            warn!(
                "Secure storage DEGRADED: available=true, backend={} —— 系统密钥库不可用，\
                 secret 仅由 master-key 加密落盘（不等价于操作系统密钥库保护）",
                report.backend
            );
        } else {
            debug!(
                "Secure storage DEGRADED (already reported): backend={}",
                report.backend
            );
        }
    } else {
        clear_degraded_warned();
        info!(
            "Secure storage availability check: available={}, backend={}",
            report.available, report.backend
        );
    }

    Ok(SecureStorageCheckResponse {
        available: report.available,
        backend: report.backend,
        native_available: report.native_available,
        degraded: report.degraded,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::secure_store::{
        BackendAvailability, StorageBackend, platform_native_backend_id,
    };

    fn degraded_report() -> crate::utils::secure_store::BackendReport {
        BackendAvailability {
            native_keychain: false,
            encrypted_file_fallback: true,
        }
        .report()
    }

    /// 降级态（仅文件 fallback 可用）必须上报 `encrypted_file_fallback` 且 `degraded=true`。
    /// 这是本次修复的核心判据：历史实现会把它报成 `macos_keychain`。
    #[test]
    fn degraded_backend_reports_file_fallback() {
        let report = degraded_report();

        assert_eq!(report.backend, "encrypted_file_fallback");
        assert_eq!(report.backend, StorageBackend::EncryptedFileFallback.id());
        assert_ne!(
            report.backend,
            platform_native_backend_id(),
            "native platform key store name must not be reported when degraded"
        );
        assert!(report.available);
        assert!(report.degraded);
        assert!(!report.native_available);
    }

    /// 前端可依赖的字段契约：serde 必须输出 camelCase 的
    /// `available` / `backend` / `nativeAvailable` / `degraded`。
    /// （前端 `SecureStorageAvailabilityResponse` 正是按此命名解析。）
    #[test]
    fn ipc_response_serializes_camel_case_fields() {
        let report = degraded_report();
        let response = SecureStorageCheckResponse {
            available: report.available,
            backend: report.backend,
            native_available: report.native_available,
            degraded: report.degraded,
        };

        let value = serde_json::to_value(&response).expect("serialize response");
        let object = value.as_object().expect("object");

        assert_eq!(
            object.get("available"),
            Some(&serde_json::Value::Bool(true))
        );
        assert_eq!(
            object.get("backend"),
            Some(&serde_json::Value::String(
                "encrypted_file_fallback".to_string()
            ))
        );
        assert_eq!(
            object.get("nativeAvailable"),
            Some(&serde_json::Value::Bool(false))
        );
        assert_eq!(object.get("degraded"), Some(&serde_json::Value::Bool(true)));
        // 不得出现 snake_case 泄漏（前端解析会静默取到 undefined）
        assert!(object.get("native_available").is_none());
    }

    /// 降级告警按后端去重：前端每 60s 重探测一次，同一后端只应 warn 一次；
    /// 恢复原生后端（clear）后再次降级仍需重新告警。
    #[test]
    fn degraded_warning_is_deduplicated_per_backend() {
        clear_degraded_warned();
        assert!(should_warn_degraded("encrypted_file_fallback"));
        assert!(!should_warn_degraded("encrypted_file_fallback"));
        assert!(should_warn_degraded("unavailable"));

        clear_degraded_warned();
        assert!(
            should_warn_degraded("encrypted_file_fallback"),
            "recovery must reset dedupe so a fresh degrade still warns"
        );
        clear_degraded_warned();
    }

    /// 原生可用时不算降级。
    #[test]
    fn native_backend_is_not_degraded() {
        let report = BackendAvailability {
            native_keychain: true,
            encrypted_file_fallback: true,
        }
        .report();

        assert_eq!(report.backend, platform_native_backend_id());
        assert!(!report.degraded);
        assert!(report.native_available);
    }

    /// 两者都不可用 ⇒ `unavailable`，且**不**算降级。
    #[test]
    fn nothing_available_is_unavailable_not_degraded() {
        let report = BackendAvailability::default().report();

        assert!(!report.available);
        assert!(!report.degraded);
        assert_eq!(report.backend, "unavailable");
    }

    /// 键名白名单：已登记前缀放行，日志值只保留前缀，不含 MXID / deviceId。
    #[test]
    fn authorize_key_accepts_registered_prefixes_and_redacts_suffix() {
        assert_eq!(
            authorize_key("tjg-crypto-storage-password:@alice:example.com:DEVICE").unwrap(),
            "tjg-crypto-storage-password:***"
        );
        assert_eq!(
            authorize_key("tjg-chat-trendradar-api-key").unwrap(),
            "tjg-chat-trendradar-api-key***"
        );
        assert!(authorize_key("tjg-chat-trendradar-api-key::@alice:example.com").is_ok());
    }

    /// 未登记键名必须拒绝，且错误信息不得回显键名。
    #[test]
    fn authorize_key_rejects_unregistered_keys_without_echoing_them() {
        let err = authorize_key("ssh-passphrase").unwrap_err();

        assert!(err.contains("unregistered secret key"));
        assert!(!err.contains("ssh-passphrase"));
    }
}
