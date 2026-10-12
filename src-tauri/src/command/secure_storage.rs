use crate::utils::secure_store::{SecureStore, StorageBackend};
use serde::{Deserialize, Serialize};
use tracing::{info, warn};

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

#[tauri::command]
pub async fn get_secret(key: String) -> Result<Option<String>, String> {
    info!("Secure storage: get_secret for key '{}'", key);
    SecureStore::get(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_secret(key: String, value: String) -> Result<(), String> {
    info!("Secure storage: set_secret for key '{}'", key);
    SecureStore::set(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_secret(key: String) -> Result<(), String> {
    info!("Secure storage: delete_secret for key '{}'", key);
    SecureStore::delete(&key).map_err(|e| e.to_string())
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
        "degraded 必须等价于「可用但非原生」"
    );
    debug_assert!(
        !report.degraded || report.backend == StorageBackend::EncryptedFileFallback.id(),
        "降级时 backend 必须是加密文件 fallback（不得报成平台原生密钥库）"
    );

    if report.degraded {
        warn!(
            "Secure storage DEGRADED: available=true, backend={} —— 系统密钥库不可用，\
             secret 仅由 master-key 加密落盘（不等价于操作系统密钥库保护）",
            report.backend
        );
    } else {
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
            "降级时不得上报平台原生密钥库名"
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
}
