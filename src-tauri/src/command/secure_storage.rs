use crate::utils::secure_store::SecureStore;
use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SecureStorageCheckResponse {
    pub available: bool,
    pub backend: String,
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

#[tauri::command]
pub async fn check_secure_storage_available() -> Result<SecureStorageCheckResponse, String> {
    let available = SecureStore::is_available();
    let backend = if available {
        #[cfg(target_os = "macos")]
        {
            "macos_keychain".to_string()
        }
        #[cfg(target_os = "windows")]
        {
            "windows_credential_manager".to_string()
        }
        #[cfg(all(target_os = "linux", not(target_os = "android")))]
        {
            "linux_secret_service".to_string()
        }
        #[cfg(not(any(
            target_os = "macos",
            target_os = "windows",
            all(target_os = "linux", not(target_os = "android"))
        )))]
        {
            "unknown".to_string()
        }
    } else {
        "unavailable".to_string()
    };

    info!(
        "Secure storage availability check: available={}, backend={}",
        available, backend
    );
    Ok(SecureStorageCheckResponse { available, backend })
}
