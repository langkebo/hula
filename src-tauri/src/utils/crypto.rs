use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use keyring::Entry;
use pbkdf2::pbkdf2_hmac;
use rand::{Rng, distributions::Alphanumeric};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tracing::{error, info, warn};

const SERVICE_NAME: &str = "hula-messenger";
const KEY_NAME: &str = "token-encryption-key";
const SALT: &[u8] = b"hula-secure-salt-2026"; // 静态盐值，用于派生主密钥

static MASTER_KEY: OnceLock<[u8; 32]> = OnceLock::new();

/// 获取密钥文件路径（keyring 不可用时的文件 fallback）
fn get_key_file_path() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".tjg").join("master-key"))
}

/// 从文件加载密钥（dev 模式 keyring 失效时的 fallback）
fn load_key_from_file() -> Option<[u8; 32]> {
    let path = get_key_file_path()?;
    let content = fs::read_to_string(&path).ok()?;
    let key_bytes = STANDARD.decode(content.trim()).ok()?;
    if key_bytes.len() != 32 {
        return None;
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);
    Some(key)
}

/// 保存密钥到文件（确保 dev 模式重建后仍可恢复）
fn save_key_to_file(key: &[u8; 32]) {
    let Some(path) = get_key_file_path() else {
        error!("HOME 环境变量未设置，无法保存密钥文件");
        return;
    };

    // 创建父目录
    if let Some(parent) = path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            error!("Failed to create key file directory: {:?}", e);
            return;
        }
    }

    let key_base64 = STANDARD.encode(key);
    if let Err(e) = fs::write(&path, key_base64) {
        error!("Failed to save encryption key to file: {:?}", e);
        return;
    }

    // 设置文件权限为 0600（仅所有者可读写）
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) = fs::set_permissions(&path, fs::Permissions::from_mode(0o600)) {
            error!("Failed to set key file permissions: {:?}", e);
        }
    }

    info!("Saved encryption key to file fallback: {:?}", path);
}

/// 获取或生成主加密密钥
///
/// 优先级：系统 Keyring > 文件 fallback > 生成新密钥
/// macOS dev 模式下每次重建 binary 签名变化，Keychain 会拒绝访问旧条目，
/// 因此文件 fallback 确保密钥在重建后仍可恢复。
fn get_master_key() -> &'static [u8; 32] {
    MASTER_KEY.get_or_init(|| {
        // 1. 尝试从系统 Keyring 获取
        match Entry::new(SERVICE_NAME, KEY_NAME) {
            Ok(entry) => match entry.get_password() {
                Ok(key_base64) => {
                    if let Ok(key_bytes) = STANDARD.decode(&key_base64)
                        && let Ok(key) = key_bytes.try_into()
                    {
                        info!("Successfully retrieved encryption key from system keyring");
                        return key;
                    }
                    warn!("Keyring key exists but format invalid, trying file fallback");
                }
                Err(e) => {
                    // NoEntry 是正常情况（首次运行或 macOS dev mode 签名变化），
                    // 后续会回退到文件加载，不需要 WARN 级别日志
                    if matches!(e, keyring::Error::NoEntry) {
                        tracing::debug!(
                            "Keyring entry not found (first run or macOS dev mode), will try file fallback"
                        );
                    } else {
                        // 其他错误（如 errSecAuthFailed）需要关注
                        warn!(
                            "Keyring get_password failed (likely macOS dev mode signature change): {:?}",
                            e
                        );
                    }
                }
            },
            Err(e) => {
                warn!("Failed to create keyring entry: {:?}", e);
            }
        }

        // 2. Keyring 不可用，尝试从文件加载（dev 模式 fallback）
        if let Some(key) = load_key_from_file() {
            info!("Successfully retrieved encryption key from file fallback");
            return key;
        }

        // 3. 都不可用，生成新密钥
        warn!("No encryption key found in keyring or file, generating new key");
        let mut rng = rand::thread_rng();
        let random_str: String = (0..32).map(|_| rng.sample(Alphanumeric) as char).collect();

        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(random_str.as_bytes(), SALT, 100_000, &mut key);

        // 4. 尝试保存到 Keyring（生产环境优先）
        match Entry::new(SERVICE_NAME, KEY_NAME) {
            Ok(entry) => {
                let key_base64 = STANDARD.encode(key);
                match entry.set_password(&key_base64) {
                    Ok(()) => info!("Saved new encryption key to system keyring"),
                    Err(e) => {
                        warn!(
                            "Failed to save encryption key to keyring (file fallback will be used): {:?}",
                            e
                        );
                    }
                }
            }
            Err(e) => {
                warn!("Failed to create keyring entry for saving: {:?}", e);
            }
        }

        // 5. 同时保存到文件（确保 dev 模式重建后仍可恢复）
        save_key_to_file(&key);

        key
    })
}

/// 加密字符串
pub fn encrypt(plaintext: &str) -> anyhow::Result<String> {
    let key = get_master_key();
    let cipher = Aes256Gcm::new(key.into());

    // 生成 12 字节的随机 Nonce
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);

    // 执行加密
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

    // 组合 Nonce + Ciphertext 并进行 Base64 编码
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(STANDARD.encode(combined))
}

/// 解密字符串
pub fn decrypt(encrypted_base64: &str) -> anyhow::Result<String> {
    let key = get_master_key();
    let cipher = Aes256Gcm::new(key.into());

    let combined = STANDARD
        .decode(encrypted_base64)
        .map_err(|e| anyhow::anyhow!("Invalid base64: {:?}", e))?;

    if combined.len() < 12 {
        return Err(anyhow::anyhow!("Invalid encrypted data: too short"));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let mut nonce_array = [0u8; 12];
    nonce_array.copy_from_slice(nonce_bytes);
    let nonce = Nonce::from(nonce_array);

    let plaintext_bytes = cipher
        .decrypt(&nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("Decryption failed: {:?}", e))?;

    String::from_utf8(plaintext_bytes).map_err(|e| anyhow::anyhow!("Invalid UTF-8: {:?}", e))
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
            let temp_dir = std::env::temp_dir().join(format!("tjg-crypto-test-{suffix}"));
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

    #[test]
    fn test_encrypt_decrypt() {
        let original = "secret_matrix_token_123456";
        let encrypted = encrypt(original).expect("Encryption failed");
        assert_ne!(original, encrypted);

        let decrypted = decrypt(&encrypted).expect("Decryption failed");
        assert_eq!(original, decrypted);
    }

    /// 验证文件 fallback 的保存和加载往返
    #[test]
    fn test_file_fallback_save_and_load() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("save-load");

        let key = [42u8; 32];
        save_key_to_file(&key);

        let loaded = load_key_from_file();
        assert!(loaded.is_some(), "Should load key from file");
        assert_eq!(loaded.unwrap(), key, "Loaded key should match saved key");
    }

    /// 验证密钥文件不存在时 load_key_from_file 返回 None
    #[test]
    fn test_file_fallback_not_found() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("not-found");

        let loaded = load_key_from_file();
        assert!(
            loaded.is_none(),
            "Should return None when key file doesn't exist"
        );
    }

    /// 验证文件内容损坏（非法 base64）时返回 None
    #[test]
    fn test_file_fallback_invalid_base64() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("invalid-b64");

        fs::create_dir_all(_env.temp_dir.join(".tjg")).unwrap();
        fs::write(
            _env.temp_dir.join(".tjg").join("master-key"),
            "!!!invalid-base64!!!",
        )
        .unwrap();

        let loaded = load_key_from_file();
        assert!(loaded.is_none(), "Should return None for invalid base64");
    }

    /// 验证密钥长度不正确（非 32 字节）时返回 None
    #[test]
    fn test_file_fallback_wrong_length() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("wrong-len");

        let short_key = [0u8; 16]; // 16 字节而非 32 字节
        let encoded = STANDARD.encode(short_key);
        fs::create_dir_all(_env.temp_dir.join(".tjg")).unwrap();
        fs::write(_env.temp_dir.join(".tjg").join("master-key"), encoded).unwrap();

        let loaded = load_key_from_file();
        assert!(loaded.is_none(), "Should return None for wrong key length");
    }

    /// 验证从文件加载的密钥可用于加密/解密（模拟 macOS Keychain 不可用场景）
    #[test]
    fn test_file_fallback_encrypt_decrypt() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("encrypt-decrypt");

        // 模拟首次运行：生成密钥并保存到文件
        let key = [99u8; 32];
        save_key_to_file(&key);

        // 模拟重启后从文件加载密钥（Keychain 不可用）
        let loaded_key = load_key_from_file().expect("Should load key from file");

        // 使用加载的密钥进行加密/解密
        let cipher = Aes256Gcm::new(&loaded_key.into());
        let plaintext = "sensitive_token_abc123";

        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);

        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .expect("Encryption with file key should succeed");

        let decrypted = cipher
            .decrypt(&nonce, ciphertext.as_slice())
            .expect("Decryption with file key should succeed");

        assert_eq!(
            String::from_utf8(decrypted).unwrap(),
            plaintext,
            "Decrypted text should match original"
        );
    }

    /// 验证密钥文件权限为 0600（仅所有者可读写）
    #[test]
    fn test_file_fallback_permissions() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("perms");

        let key = [7u8; 32];
        save_key_to_file(&key);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let path = get_key_file_path().expect("Key file path should exist");
            let mode = fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(
                mode & 0o777,
                0o600,
                "Key file should have 0600 permissions, got {:o}",
                mode & 0o777
            );
        }
    }

    /// 验证密钥在模拟重启后保持一致（dev 模式核心场景）
    #[test]
    fn test_file_fallback_persistence_across_restarts() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("persistence");

        // 第一次"运行"：生成并保存密钥
        let key_run1 = [123u8; 32];
        save_key_to_file(&key_run1);

        // 模拟重启：从文件重新加载
        let key_run2 = load_key_from_file().expect("Should load key after restart");
        assert_eq!(
            key_run1, key_run2,
            "Key should persist across simulated restarts"
        );

        // 用第一次运行的密钥加密
        let cipher1 = Aes256Gcm::new(&key_run1.into());
        let plaintext = "persisted_token_xyz";
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);
        let ciphertext = cipher1.encrypt(&nonce, plaintext.as_bytes()).unwrap();

        // 用重启后加载的密钥解密
        let cipher2 = Aes256Gcm::new(&key_run2.into());
        let decrypted = cipher2.decrypt(&nonce, ciphertext.as_slice()).unwrap();
        assert_eq!(
            String::from_utf8(decrypted).unwrap(),
            plaintext,
            "Decryption with persisted key should succeed"
        );
    }

    /// 验证 HOME 环境变量未设置时 get_key_file_path 返回 None
    #[test]
    fn test_file_fallback_no_home_env() {
        let _lock = TEST_LOCK.lock().unwrap();
        let original_home = std::env::var("HOME").ok();
        // SAFETY: TEST_LOCK 确保不会并行执行
        unsafe { std::env::remove_var("HOME") };

        let path = get_key_file_path();
        assert!(
            path.is_none(),
            "get_key_file_path should return None when HOME is not set"
        );

        // 恢复
        if let Some(home) = original_home {
            unsafe { std::env::set_var("HOME", home) };
        }
    }

    /// 验证空内容文件被正确拒绝
    #[test]
    fn test_file_fallback_empty_file() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("empty-file");

        fs::create_dir_all(_env.temp_dir.join(".tjg")).unwrap();
        fs::write(_env.temp_dir.join(".tjg").join("master-key"), "").unwrap();

        let loaded = load_key_from_file();
        assert!(loaded.is_none(), "Should return None for empty file");
    }

    /// 验证文件包含合法 base64 但解码后非 32 字节时返回 None
    #[test]
    fn test_file_fallback_valid_base64_wrong_size() {
        let _lock = TEST_LOCK.lock().unwrap();
        let _env = TestEnv::new("valid-b64-wrong-size");

        // 64 字节数据，合法 base64 但非 32 字节
        let long_key = [0xAAu8; 64];
        let encoded = STANDARD.encode(long_key);
        fs::create_dir_all(_env.temp_dir.join(".tjg")).unwrap();
        fs::write(_env.temp_dir.join(".tjg").join("master-key"), encoded).unwrap();

        let loaded = load_key_from_file();
        assert!(loaded.is_none(), "Should return None for 64-byte key");
    }
}
