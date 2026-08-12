use keyring::Entry;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::OnceLock;
use tracing::{debug, error, info, warn};

// 复用 crypto.rs 的 master-key 加密能力
use crate::utils::crypto;

static SERVICE_NAME: OnceLock<String> = OnceLock::new();

fn get_service_name() -> &'static str {
    SERVICE_NAME.get_or_init(|| {
        if let Ok(profile_dir) = std::env::var("TJG_PROFILE_DIR")
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

/// 获取 secure storage 文件 fallback 目录路径
///
/// 文件 fallback 用于 macOS dev 模式下 keychain 不可用时，
/// 将加密的 secret 存储到文件系统，确保跨会话稳定。
fn get_fallback_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".tjg").join("secure-storage"))
}

/// 根据 key 生成文件 fallback 路径
///
/// 使用 hash(key) 作为文件名，避免 key 中包含路径分隔符导致文件路径异常。
fn get_fallback_path(key: &str) -> Option<PathBuf> {
    let dir = get_fallback_dir()?;
    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    let hash = hasher.finish();
    Some(dir.join(format!("{:016x}.enc", hash)))
}

/// 从文件 fallback 读取加密的 secret
fn load_from_fallback(key: &str) -> Option<String> {
    let path = get_fallback_path(key)?;
    let encrypted = fs::read_to_string(&path).ok()?;
    let decrypted = crypto::decrypt(encrypted.trim()).ok()?;
    debug!("Loaded secret from file fallback for key '{}'", key);
    Some(decrypted)
}

/// 将 secret 加密后写入文件 fallback
///
/// 写后验证契约：写入成功后必须读回并比较，确保内容真正落盘且可解密。
/// 返回 true 仅当写后验证通过（读回值 == 写入值）。
/// 返回 false 表示任何阶段失败：路径不可计算、目录创建失败、加密失败、
/// 文件写入失败、或写后读回验证失败（内容不匹配 / 解密失败）。
fn save_to_fallback(key: &str, value: &str) -> bool {
    let Some(path) = get_fallback_path(key) else {
        warn!("Cannot determine fallback path for key '{}'", key);
        return false;
    };

    if let Some(parent) = path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            warn!("Failed to create fallback directory: {:?}", e);
            return false;
        }
    }

    let encrypted = match crypto::encrypt(value) {
        Ok(enc) => enc,
        Err(e) => {
            warn!("Failed to encrypt secret for fallback: {:?}", e);
            return false;
        }
    };

    if let Err(e) = fs::write(&path, &encrypted) {
        warn!("Failed to write fallback file for key '{}': {:?}", key, e);
        return false;
    }

    // 设置文件权限为 0600（仅所有者可读写）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = fs::set_permissions(&path, fs::Permissions::from_mode(0o600)) {
            warn!("Failed to set fallback file permissions: {:?}", e);
            // 权限设置失败不视为整体失败，文件已写入
        }
    }

    // 写后验证：读回并比较，确保内容真正落盘且加密-解密往返一致。
    // 这消除了"路径存在即成功"的伪判定——文件存在不代表内容正确。
    match load_from_fallback(key) {
        Some(loaded) if loaded == value => {
            debug!(
                "Fallback write verified (read-back matches) for key '{}'",
                key
            );
            true
        }
        Some(other) => {
            warn!(
                "Fallback read-back mismatch for key '{}': expected len {}, got len {}. \
                 File may be corrupted or encryption key changed.",
                key,
                value.len(),
                other.len()
            );
            // 清理损坏的文件，避免下次读取返回错误数据
            let _ = fs::remove_file(&path);
            false
        }
        None => {
            warn!(
                "Fallback read-back failed for key '{}': load returned None after write. \
                 File may not have been flushed to disk.",
                key
            );
            let _ = fs::remove_file(&path);
            false
        }
    }
}

/// 删除文件 fallback 中的 secret
fn delete_from_fallback(key: &str) {
    if let Some(path) = get_fallback_path(key) {
        match fs::remove_file(&path) {
            Ok(()) => debug!("Deleted fallback file for key '{}'", key),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                debug!("No fallback file to delete for key '{}'", key)
            }
            Err(e) => warn!("Failed to delete fallback file for key '{}': {:?}", key, e),
        }
    }
}

/// 探测文件 fallback 是否真正可写（写-读-删往返验证）。
///
/// 用于 `is_available()`：不能仅凭路径可计算判定可用，
/// 必须实际尝试一次写入+读回+删除来验证目录可创建、文件可写入、加密可往返。
fn test_fallback_writable() -> bool {
    let probe_key = "__hula_probe_writable__";
    let probe_value = "probe";
    let ok = save_to_fallback(probe_key, probe_value);
    if ok {
        delete_from_fallback(probe_key);
    }
    ok
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
    /// 读取 secret：优先 keychain，失败后从文件 fallback 加载
    ///
    /// macOS dev 模式下 keychain 可能写入成功但读取失败（binary 签名变化），
    /// 文件 fallback 确保跨会话稳定，且 secret 被 master-key 加密保护。
    pub fn get(key: &str) -> Result<Option<String>, SecureStoreError> {
        // 1. 尝试从 keychain 读取
        match Entry::new(get_service_name(), key) {
            Ok(entry) => match entry.get_password() {
                Ok(password) => {
                    debug!(
                        "Successfully retrieved secret from keychain for key '{}'",
                        key
                    );
                    return Ok(Some(password));
                }
                Err(keyring::Error::NoEntry) => {
                    debug!("No keychain entry found for key '{}'", key);
                }
                Err(keyring::Error::Ambiguous(_)) => {
                    warn!("Ambiguous keychain entry for key '{}'", key);
                    // 继续尝试文件 fallback
                }
                Err(e) => {
                    // macOS dev 模式下常见错误：errSecAuthFailed（签名变化）
                    debug!(
                        "Keychain read failed for key '{}' (likely macOS dev mode): {:?}",
                        key, e
                    );
                    // 继续尝试文件 fallback
                }
            },
            Err(e) => {
                warn!("Failed to create keyring entry for key '{}': {}", key, e);
                // 继续尝试文件 fallback
            }
        }

        // 2. keychain 读取失败或无条目，尝试从文件 fallback 加载
        if let Some(value) = load_from_fallback(key) {
            info!(
                "Retrieved secret from file fallback (keychain unavailable): key='{}'",
                key
            );
            return Ok(Some(value));
        }

        // 3. 两处都无记录
        Ok(None)
    }

    /// 写入 secret：同时写入 keychain 和文件 fallback
    ///
    /// 双写策略确保：
    /// - 生产环境：keychain 工作正常，文件 fallback 作为备份
    /// - dev 模式：keychain 可能读取失败，文件 fallback 保证跨会话稳定
    ///
    /// 只有当 keychain 或 fallback 至少一处实际写入成功（可读验证）时才返回 Ok，
    /// 避免返回虚假的 Ok 导致上层认为已持久化但实际丢失。
    pub fn set(key: &str, value: &str) -> Result<(), SecureStoreError> {
        let mut keychain_ok = false;

        // 1. 写入 keychain
        match Entry::new(get_service_name(), key) {
            Ok(entry) => match entry.set_password(value) {
                Ok(()) => {
                    // 写后读验证：macOS dev 模式下 set_password 可能返回 Ok
                    // 但实际不可读（ACL 不匹配）。注意必须用 NEW Entry 实例验证，
                    // 因为写入的 Entry 实例自身有访问权限，但新实例可能没有（ACL 问题）。
                    // 这模拟了 SecureStore::get 的真实读取路径。
                    let verify_entry = Entry::new(get_service_name(), key);
                    match verify_entry {
                        Ok(v_entry) => match v_entry.get_password() {
                            Ok(retrieved) if retrieved == value => {
                                debug!(
                                    "Keychain write verified (read-back via new Entry matches) for key '{}'",
                                    key
                                );
                                keychain_ok = true;
                            }
                            Ok(other) => {
                                warn!(
                                    "Keychain read-back mismatch for key '{}': expected len {}, got len {}. \
                                     Treating keychain write as failed.",
                                    key,
                                    value.len(),
                                    other.len()
                                );
                            }
                            Err(keyring::Error::NoEntry) => {
                                warn!(
                                    "Keychain bug detected for key '{}': set_password returned Ok \
                                     but get_password (new Entry) returned NoEntry \
                                     (macOS dev mode ACL issue). Falling back to file storage.",
                                    key
                                );
                            }
                            Err(e) => {
                                warn!(
                                    "Keychain read-back failed for key '{}': {:?}. \
                                     Treating keychain write as unverified.",
                                    key, e
                                );
                            }
                        },
                        Err(e) => {
                            warn!(
                                "Failed to create verify Entry for key '{}': {:?}. \
                                 Treating keychain write as unverified.",
                                key, e
                            );
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to set keychain password for key '{}': {:?}", key, e);
                    // 继续写入文件 fallback
                }
            },
            Err(e) => {
                warn!("Failed to create keyring entry for key '{}': {}", key, e);
                // 继续写入文件 fallback
            }
        }

        // 2. 同时写入文件 fallback（加密存储）
        // save_to_fallback 返回实际写入结果，而非路径可计算性
        let fallback_ok = save_to_fallback(key, value);

        if keychain_ok {
            if !fallback_ok {
                warn!(
                    "Keychain write verified but fallback write failed for key '{}'. \
                     Secret stored to keychain only.",
                    key
                );
            }
            Ok(())
        } else if fallback_ok {
            // keychain 失败但文件 fallback 实际写入成功
            info!(
                "Secret stored to file fallback only (keychain unavailable): key='{}'",
                key
            );
            Ok(())
        } else {
            // 两处都失败：返回错误，不返回虚假的 Ok
            error!(
                "Both keychain and fallback failed to store secret for key '{}'",
                key
            );
            Err(SecureStoreError::AccessDenied)
        }
    }

    /// 删除 secret：同时删除 keychain 和文件 fallback 中的记录
    pub fn delete(key: &str) -> Result<(), SecureStoreError> {
        let mut had_error = false;

        // 1. 删除 keychain 条目
        match Entry::new(get_service_name(), key) {
            Ok(entry) => match entry.delete_credential() {
                Ok(()) => {
                    debug!("Successfully deleted keychain secret for key '{}'", key);
                }
                Err(keyring::Error::NoEntry) => {
                    debug!("No keychain entry to delete for key '{}'", key);
                }
                Err(e) => {
                    warn!(
                        "Failed to delete keychain credential for key '{}': {:?}",
                        key, e
                    );
                    had_error = true;
                }
            },
            Err(e) => {
                warn!("Failed to create keyring entry for deletion: {}", e);
                had_error = true;
            }
        }

        // 2. 删除文件 fallback
        delete_from_fallback(key);

        if had_error {
            // 文件 fallback 已删除，keychain 错误不阻断
            debug!("Deletion completed with keychain errors for key '{}'", key);
        }

        Ok(())
    }

    pub fn is_available() -> bool {
        // keychain 可用性检查：Entry 可创建即认为可用
        let keychain_available =
            Entry::new(get_service_name(), "__hula_test_availability__").is_ok();

        // 文件 fallback 可用性检查：不能仅检查路径可计算（HOME 存在不代表可写），
        // 必须实际尝试一次写-读-删往返来验证。
        let fallback_available = get_fallback_dir().is_some() && test_fallback_writable();

        keychain_available || fallback_available
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // 所有修改 HOME 的测试必须获取此锁，防止并行执行时环境变量冲突
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    /// 测试环境守卫：设置临时 HOME，Drop 时恢复原始值并清理临时目录
    struct TestEnv {
        temp_dir: PathBuf,
        original_home: Option<String>,
    }

    impl TestEnv {
        fn new(suffix: &str) -> Self {
            let temp_dir = std::env::temp_dir().join(format!("tjg-secure-store-test-{suffix}"));
            let _ = fs::remove_dir_all(&temp_dir);
            let original_home = std::env::var("HOME").ok();
            // SAFETY: TEST_LOCK 确保不会并行执行
            unsafe { std::env::set_var("HOME", &temp_dir) };
            Self {
                temp_dir,
                original_home,
            }
        }
    }

    impl Drop for TestEnv {
        fn drop(&mut self) {
            // SAFETY: TEST_LOCK 确保不会并行执行
            if let Some(home) = &self.original_home {
                unsafe { std::env::set_var("HOME", home) };
            } else {
                unsafe { std::env::remove_var("HOME") };
            }
            let _ = fs::remove_dir_all(&self.temp_dir);
        }
    }

    /// 验证文件 fallback 的写入和读取往返
    #[test]
    fn test_fallback_save_and_load() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("save-load");

        let key = "test-key-roundtrip";
        let value = "test-secret-value-12345";

        let saved = save_to_fallback(key, value);
        assert!(
            saved,
            "save_to_fallback should return true on successful write"
        );
        let loaded = load_from_fallback(key);

        assert!(loaded.is_some(), "Should load value from fallback");
        assert_eq!(
            loaded.unwrap(),
            value,
            "Loaded value should match saved value"
        );
    }

    /// 验证文件 fallback 不存在时返回 None
    #[test]
    fn test_fallback_load_not_found() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("not-found");

        let loaded = load_from_fallback("nonexistent-key");
        assert!(
            loaded.is_none(),
            "Should return None when fallback file doesn't exist"
        );
    }

    /// 验证文件 fallback 删除
    #[test]
    fn test_fallback_delete() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("delete");

        let key = "test-key-delete";
        assert!(
            save_to_fallback(key, "value"),
            "save_to_fallback should succeed"
        );

        let path = get_fallback_path(key).unwrap();
        assert!(path.exists(), "Fallback file should exist before deletion");

        delete_from_fallback(key);

        assert!(!path.exists(), "Fallback file should be deleted");
    }

    /// 验证删除不存在的文件 fallback 不报错
    #[test]
    fn test_fallback_delete_nonexistent() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("delete-nonexistent");

        // 应该不报错
        delete_from_fallback("nonexistent-key-for-delete");
    }

    /// 验证文件 fallback 权限为 0600
    #[test]
    fn test_fallback_file_permissions() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("permissions");

        let key = "test-key-perms";
        assert!(
            save_to_fallback(key, "secret"),
            "save_to_fallback should succeed"
        );

        let path = get_fallback_path(key).expect("Fallback path should exist");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(
                mode & 0o777,
                0o600,
                "Fallback file should have 0600 permissions, got {:o}",
                mode & 0o777
            );
        }
    }

    /// 验证跨"重启"后 fallback 密钥一致（dev 模式核心场景）
    #[test]
    fn test_fallback_persistence_across_restarts() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("persistence");

        let key = "test-key-persistence";
        let value = "persistent-secret-value";

        // 第一次"运行"：写入
        assert!(
            save_to_fallback(key, value),
            "save_to_fallback should succeed"
        );

        // 模拟重启：重新加载
        let loaded = load_from_fallback(key).expect("Should load value after restart");
        assert_eq!(
            loaded, value,
            "Value should persist across simulated restart"
        );
    }

    /// 验证不同 key 生成不同文件路径
    #[test]
    fn test_fallback_different_keys_different_paths() {
        let path1 = get_fallback_path("key-one").unwrap();
        let path2 = get_fallback_path("key-two").unwrap();
        assert_ne!(path1, path2, "Different keys should have different paths");
    }

    /// 验证 SecureStore::set 和 SecureStore::get 的集成（跳过 keychain，仅测试 fallback）
    #[test]
    fn test_secure_store_set_get_fallback_integration() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("integration");

        let key = "integration-test-key";
        let value = "integration-test-value-非常机密";

        // set 会同时写 keychain 和 fallback
        // 在测试环境中 keychain 可能可用也可能不可用，但 fallback 一定会写入
        let result = SecureStore::set(key, value);
        assert!(result.is_ok(), "SecureStore::set should succeed");

        // get 会先尝试 keychain，失败后从 fallback 加载
        let loaded = SecureStore::get(key).unwrap();
        assert!(loaded.is_some(), "Should load value from SecureStore");
        assert_eq!(loaded.unwrap(), value, "Loaded value should match");

        // 清理
        SecureStore::delete(key).unwrap();
    }

    /// 验证 HOME 环境变量未设置时 fallback 路径返回 None
    #[test]
    fn test_fallback_no_home_env() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let original_home = std::env::var("HOME").ok();
        // SAFETY: TEST_LOCK 确保不会并行执行
        unsafe { std::env::remove_var("HOME") };

        let path = get_fallback_path("some-key");
        assert!(
            path.is_none(),
            "Fallback path should be None when HOME is not set"
        );

        // 恢复
        if let Some(home) = original_home {
            unsafe { std::env::set_var("HOME", home) };
        }
    }

    /// 验证 Bug 3 修复：当 keychain 和 fallback 都失败时，set 必须返回 Err
    ///
    /// 此测试通过将 fallback 目录设为只读来强制 save_to_fallback 失败，
    /// 验证 set 不再返回虚假的 Ok。
    /// 注意：keychain 在测试环境中可能可用也可能不可用，
    /// 此测试主要验证 fallback 失败时的行为。
    #[test]
    fn test_set_returns_err_when_both_keychain_and_fallback_fail() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("both-fail");

        // 将 fallback 目录设为只读，使 save_to_fallback 无法写入
        let fallback_dir = _env.temp_dir.join(".tjg").join("secure-storage");
        fs::create_dir_all(&fallback_dir).unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&fallback_dir, fs::Permissions::from_mode(0o444)).unwrap();
        }

        let key = "both-fail-test-key";
        let value = "both-fail-test-value";

        // 调用 set：keychain 可能成功也可能失败，fallback 一定失败
        let result = SecureStore::set(key, value);

        // 立即恢复目录权限（在任何断言之前，避免 panic 导致权限未恢复）
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&fallback_dir, fs::Permissions::from_mode(0o755));
        }

        // 如果 keychain 可用，set 返回 Ok（keychain 成功）
        // 如果 keychain 不可用，set 必须返回 Err（fallback 也失败）
        // 不应出现 set 返回 Ok 但实际未持久化的情况
        match &result {
            Ok(()) => {
                // keychain 成功，验证值确实可读
                let loaded = SecureStore::get(key).unwrap();
                assert!(
                    loaded.is_some(),
                    "set 返回 Ok 但 get 返回 None，说明 set 返回了虚假的 Ok"
                );
                println!("[INFO] keychain 可用，set 通过 keychain 成功");
            }
            Err(e) => {
                println!(
                    "[INFO] keychain 不可用且 fallback 失败，set 正确返回 Err: {:?}",
                    e
                );
            }
        }

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证 save_to_fallback 返回值与实际文件写入一致
    #[test]
    fn test_save_to_fallback_return_value_matches_actual_write() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("return-value");

        let key = "return-value-test-key";
        let value = "return-value-test-value";

        // 正常写入应返回 true
        let result = save_to_fallback(key, value);
        assert!(result, "save_to_fallback should return true on success");

        // 文件应实际存在
        let path = get_fallback_path(key).unwrap();
        assert!(
            path.exists(),
            "Fallback file should exist when save returns true"
        );

        // 读取应返回相同值
        let loaded = load_from_fallback(key);
        assert_eq!(loaded.as_deref(), Some(value), "Loaded value should match");

        // 清理
        let _ = fs::remove_file(path);
    }

    /// 验证写后验证契约：save_to_fallback 写入后必须能读回相同值
    ///
    /// 此测试确保写后验证逻辑正常工作：写入成功后读回比较通过才返回 true。
    /// 如果写后验证被移除或绕过，此测试仍会通过（因为它验证的是正常路径），
    /// 但它作为契约存在，确保未来修改不会破坏写后验证的正常行为。
    #[test]
    fn test_save_to_fallback_write_then_verify_contract() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("write-verify");

        let key = "write-verify-test-key";
        let value = "write-verify-test-value-含中文加密内容";

        // 正常写入应返回 true（写后验证通过）
        let result = save_to_fallback(key, value);
        assert!(
            result,
            "save_to_fallback should return true when write-then-verify passes"
        );

        // 读回应返回相同值（验证加密-解密往返一致）
        let loaded = load_from_fallback(key);
        assert_eq!(
            loaded.as_deref(),
            Some(value),
            "Read-back should match written value (encrypt-decrypt roundtrip)"
        );

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证写后验证清理：当文件被外部损坏后，再次 save 应覆盖并验证成功
    #[test]
    fn test_save_to_fallback_overwrites_corrupted_file() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("corrupt-overwrite");

        let key = "corrupt-overwrite-test-key";

        // 先写入有效数据
        assert!(
            save_to_fallback(key, "original-value"),
            "Initial save should succeed"
        );

        // 模拟文件损坏：覆写为无法解密的垃圾数据
        let path = get_fallback_path(key).unwrap();
        fs::write(&path, "corrupted-garbage-data-not-valid-encrypted-content").unwrap();

        // 再次 save 应覆盖损坏文件并验证新内容
        let result = save_to_fallback(key, "new-value-after-corruption");
        assert!(
            result,
            "save_to_fallback should succeed overwriting corrupted file"
        );

        // 读回应返回新值
        let loaded = load_from_fallback(key);
        assert_eq!(
            loaded.as_deref(),
            Some("new-value-after-corruption"),
            "Should read back the new value after overwrite"
        );

        // 清理
        let _ = fs::remove_file(path);
    }

    /// 验证空字符串值的处理：save_to_fallback 和 SecureStore::set/get
    #[test]
    fn test_empty_value_handling() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("empty-value");

        let key = "empty-value-key";
        let value = "";

        // save_to_fallback 应正确处理空字符串
        let saved = save_to_fallback(key, value);
        assert!(saved, "save_to_fallback should handle empty string value");

        let loaded = load_from_fallback(key);
        assert_eq!(
            loaded.as_deref(),
            Some(value),
            "Loaded empty value should match"
        );

        // 清理 fallback 文件
        delete_from_fallback(key);

        // SecureStore::set/get 也应正确处理空字符串
        let result = SecureStore::set(key, value);
        assert!(
            result.is_ok(),
            "SecureStore::set should handle empty string"
        );

        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value),
            "SecureStore::get should return empty string"
        );

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证超长值（10KB）的处理
    #[test]
    fn test_large_value_10kb() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("large-value");

        let key = "large-value-key";
        // 10KB 大小的值（10240 字节）
        let value = "a".repeat(10240);

        // save_to_fallback 应正确处理超长值
        let saved = save_to_fallback(key, &value);
        assert!(saved, "save_to_fallback should handle 10KB value");

        let loaded = load_from_fallback(key);
        assert_eq!(
            loaded.as_deref(),
            Some(value.as_str()),
            "Loaded 10KB value should match"
        );

        // 清理 fallback 文件
        delete_from_fallback(key);

        // SecureStore::set/get 也应正确处理超长值
        let result = SecureStore::set(key, &value);
        assert!(result.is_ok(), "SecureStore::set should handle 10KB value");

        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value.as_str()),
            "SecureStore::get should return 10KB value"
        );

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证特殊字符值：Unicode、emoji、换行符、路径分隔符
    #[test]
    fn test_special_characters_value() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("special-chars");

        let key = "special-chars-key";
        // 包含中文、emoji、换行符、路径分隔符、制表符等
        let value = "中文测试-🔐-newline\n\ttab/slash\\back-emoji🎉-üñîçødé";

        // save_to_fallback 应正确处理特殊字符
        let saved = save_to_fallback(key, value);
        assert!(saved, "save_to_fallback should handle special characters");

        let loaded = load_from_fallback(key);
        assert_eq!(
            loaded.as_deref(),
            Some(value),
            "Loaded value with special characters should match"
        );

        // 清理 fallback 文件
        delete_from_fallback(key);

        // SecureStore::set/get 也应正确处理特殊字符
        let result = SecureStore::set(key, value);
        assert!(
            result.is_ok(),
            "SecureStore::set should handle special characters"
        );

        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value),
            "SecureStore::get should return value with special characters"
        );

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证特殊 key 格式：包含 @、:、空格、中文
    #[test]
    fn test_special_key_formats() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("special-keys");

        // 包含 @、:、空格、中文等多种特殊字符的 key
        let special_keys = vec![
            "user@example.com",
            "namespace:key",
            "key with spaces",
            "中文密钥",
            "mixed@中文:with spaces",
        ];

        for key in &special_keys {
            let value = format!("value-for-{}", key);

            // save_to_fallback 应正确处理特殊 key
            let saved = save_to_fallback(key, &value);
            assert!(
                saved,
                "save_to_fallback should handle special key: {:?}",
                key
            );

            let loaded = load_from_fallback(key);
            assert_eq!(
                loaded.as_deref(),
                Some(value.as_str()),
                "Loaded value for special key {:?} should match",
                key
            );

            // 清理 fallback 文件
            delete_from_fallback(key);
        }
    }

    /// 验证覆盖写入：同一 key 两次 set 不同 value，get 返回最新值
    #[test]
    fn test_overwrite_with_different_value() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("overwrite");

        let key = "overwrite-test-key";
        let value1 = "first-value";
        let value2 = "second-value-completely-different";

        // 第一次写入
        let result = SecureStore::set(key, value1);
        assert!(result.is_ok(), "First set should succeed");

        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value1),
            "After first set, get should return first value"
        );

        // 第二次写入（覆盖）
        let result = SecureStore::set(key, value2);
        assert!(result.is_ok(), "Second set (overwrite) should succeed");

        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value2),
            "After overwrite, get should return the latest value"
        );

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证删除后再写入：delete 后 set 再 get，值正确
    #[test]
    fn test_delete_then_set_again() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("delete-re-set");

        let key = "delete-re-set-key";
        let value1 = "first-value-before-delete";
        let value2 = "second-value-after-delete";

        // 第一次写入并验证
        let result = SecureStore::set(key, value1);
        assert!(result.is_ok(), "First set should succeed");

        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value1),
            "First value should be loaded"
        );

        // 删除
        let result = SecureStore::delete(key);
        assert!(result.is_ok(), "Delete should succeed");

        // 验证已删除
        let loaded = SecureStore::get(key).unwrap();
        assert!(loaded.is_none(), "After delete, get should return None");

        // 再次写入新值
        let result = SecureStore::set(key, value2);
        assert!(result.is_ok(), "Second set after delete should succeed");

        // 验证新值正确
        let loaded = SecureStore::get(key).unwrap();
        assert_eq!(
            loaded.as_deref(),
            Some(value2),
            "After delete and re-set, get should return the new value"
        );

        // 清理
        let _ = SecureStore::delete(key);
    }

    /// 验证 get 不存在的 key 返回 None 不报错
    #[test]
    fn test_get_nonexistent_key_returns_none() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("get-nonexistent");

        let key = "this-key-does-not-exist-anywhere";

        // get 不存在的 key 应返回 Ok(None)，不报错
        let result = SecureStore::get(key);
        assert!(result.is_ok(), "get should not error on nonexistent key");
        assert!(
            result.unwrap().is_none(),
            "get should return None for nonexistent key"
        );
    }

    /// 验证 delete 不存在的 key 不报错
    #[test]
    fn test_delete_nonexistent_key_no_error() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("delete-nonexistent");

        let key = "nonexistent-key-for-delete-test";

        // delete 不存在的 key 应返回 Ok，不报错
        let result = SecureStore::delete(key);
        assert!(result.is_ok(), "delete should not error on nonexistent key");
    }

    /// 验证重复 delete 同一 key 不报错
    #[test]
    fn test_repeated_delete_no_error() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("repeated-delete");

        let key = "repeated-delete-test-key";
        let value = "some-value";

        // 先写入
        let result = SecureStore::set(key, value);
        assert!(result.is_ok(), "set should succeed");

        // 第一次删除
        let result1 = SecureStore::delete(key);
        assert!(result1.is_ok(), "First delete should succeed");

        // 第二次删除（key 已不存在）
        let result2 = SecureStore::delete(key);
        assert!(
            result2.is_ok(),
            "Second delete (on nonexistent key) should not error"
        );

        // 第三次删除（继续验证幂等性）
        let result3 = SecureStore::delete(key);
        assert!(
            result3.is_ok(),
            "Third delete (on nonexistent key) should not error"
        );
    }

    /// 验证 is_available 在正常环境下返回 true
    #[test]
    fn test_is_available_returns_true_in_normal_env() {
        let _lock = TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _env = TestEnv::new("is-available");

        // 在设置了有效 HOME 的正常环境下，is_available 应返回 true
        // （keychain 或 fallback 至少一个可用）
        let available = SecureStore::is_available();
        assert!(
            available,
            "is_available should return true in normal environment with valid HOME"
        );
    }
}
