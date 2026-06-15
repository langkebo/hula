use keyring::Entry;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::OnceLock;
use tracing::{debug, warn};

static SERVICE_NAME: OnceLock<String> = OnceLock::new();

fn get_service_name() -> &'static str {
    SERVICE_NAME.get_or_init(|| {
        if let Ok(profile_dir) = std::env::var("HULA_PROFILE_DIR")
            && !profile_dir.is_empty()
        {
            let mut hasher = DefaultHasher::new();
            profile_dir.hash(&mut hasher);
            let hash = hasher.finish();
            return format!("hula-secure-storage-{:08x}", hash);
        }
        "hula-secure-storage".to_string()
    })
}

#[derive(Debug, thiserror::Error)]
pub enum SecureStoreError {
    #[error("Secure storage backend is not available on this platform")]
    BackendUnavailable,
    #[error("Access to secure storage was denied by the system")]
    AccessDenied,
    #[error("Key not found in secure storage: {0}")]
    NotFound(String),
    #[error("Secure storage error: {0}")]
    Other(String),
}

pub struct SecureStore;

impl SecureStore {
    pub fn get(key: &str) -> Result<Option<String>, SecureStoreError> {
        let entry = Entry::new(get_service_name(), key).map_err(|e| {
            warn!("Failed to create keyring entry for key '{}': {}", key, e);
            SecureStoreError::BackendUnavailable
        })?;

        match entry.get_password() {
            Ok(password) => {
                debug!("Successfully retrieved secret for key '{}'", key);
                Ok(Some(password))
            }
            Err(keyring::Error::NoEntry) => {
                debug!("No entry found for key '{}'", key);
                Ok(None)
            }
            Err(keyring::Error::Ambiguous(_)) => {
                warn!("Ambiguous entry for key '{}'", key);
                Err(SecureStoreError::Other("Ambiguous entry".to_string()))
            }
            Err(e) => {
                warn!("Failed to get password for key '{}': {}", key, e);
                Err(SecureStoreError::Other(e.to_string()))
            }
        }
    }

    pub fn set(key: &str, value: &str) -> Result<(), SecureStoreError> {
        let entry = Entry::new(get_service_name(), key).map_err(|e| {
            warn!("Failed to create keyring entry for key '{}': {}", key, e);
            SecureStoreError::BackendUnavailable
        })?;

        entry.set_password(value).map_err(|e| {
            warn!("Failed to set password for key '{}': {}", key, e);
            SecureStoreError::AccessDenied
        })?;

        debug!("Successfully stored secret for key '{}'", key);
        Ok(())
    }

    pub fn delete(key: &str) -> Result<(), SecureStoreError> {
        let entry = Entry::new(get_service_name(), key).map_err(|e| {
            warn!("Failed to create keyring entry for key '{}': {}", key, e);
            SecureStoreError::BackendUnavailable
        })?;

        match entry.delete_credential() {
            Ok(()) => {
                debug!("Successfully deleted secret for key '{}'", key);
                Ok(())
            }
            Err(keyring::Error::NoEntry) => {
                debug!("No entry to delete for key '{}'", key);
                Ok(())
            }
            Err(e) => {
                warn!("Failed to delete credential for key '{}': {}", key, e);
                Err(SecureStoreError::Other(e.to_string()))
            }
        }
    }

    pub fn is_available() -> bool {
        let test_entry = Entry::new(get_service_name(), "__hula_test_availability__");
        test_entry.is_ok()
    }
}
