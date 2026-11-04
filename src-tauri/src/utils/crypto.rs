use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use keyring::Entry;
use pbkdf2::pbkdf2_hmac;
use rand::{RngCore, rngs::OsRng};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tracing::{debug, error, info, warn};

const SERVICE_NAME: &str = "hula-messenger";
const KEY_NAME: &str = "token-encryption-key";

/// 密文版本前缀。
///
/// v2 起：每份密文自带随机盐，真正的 AES 密钥由「主密钥 + 盐」经 PBKDF2 派生。
/// 无前缀的旧密文（nonce|ciphertext，密钥即主密钥）走只读兼容路径。
const CIPHERTEXT_PREFIX_V2: &str = "tjg:v2:";
/// 每份密文的随机盐长度（字节）。
const SALT_LEN: usize = 16;
/// AES-GCM nonce 长度（字节）。
const NONCE_LEN: usize = 12;
/// 主密钥长度（字节）。
const MASTER_KEY_LEN: usize = 32;
/// 盐派生迭代次数（主密钥已是 256 位均匀随机，无需 Argon2id 那种抗暴力参数）。
const KDF_ITERATIONS: u32 = 10_000;

static MASTER_KEY: OnceLock<[u8; 32]> = OnceLock::new();

/// 获取密钥文件路径（keyring 不可用时的文件 fallback）
fn get_key_file_path() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(|home| PathBuf::from(home).join(".tjg").join("master-key"))
}

/// 从文件加载密钥（dev 模式 keyring 失效时的 fallback，且仅用于迁移旧安装）。
fn load_key_from_file() -> Option<[u8; 32]> {
    let path = get_key_file_path()?;
    let content = fs::read_to_string(&path).ok()?;
    let key_bytes = STANDARD.decode(content.trim()).ok()?;
    if key_bytes.len() != MASTER_KEY_LEN {
        return None;
    }
    let mut key = [0u8; MASTER_KEY_LEN];
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

/// 从系统钥匙串读取主密钥。
fn load_key_from_keychain() -> Option<[u8; 32]> {
    let entry = match Entry::new(SERVICE_NAME, KEY_NAME) {
        Ok(entry) => entry,
        Err(e) => {
            warn!("Failed to create keyring entry: {:?}", e);
            return None;
        }
    };

    match entry.get_password() {
        Ok(key_base64) => match STANDARD.decode(&key_base64) {
            Ok(key_bytes) if key_bytes.len() == MASTER_KEY_LEN => {
                let mut key = [0u8; MASTER_KEY_LEN];
                key.copy_from_slice(&key_bytes);
                info!("Successfully retrieved encryption key from system keyring");
                Some(key)
            }
            _ => {
                warn!("Keyring key exists but format invalid, trying file fallback");
                None
            }
        },
        Err(keyring::Error::NoEntry) => {
            // 首次运行或 macOS dev mode 签名变化的正常情况
            debug!("Keyring entry not found (first run or macOS dev mode)");
            None
        }
        Err(e) => {
            warn!(
                "Keyring get_password failed (likely macOS dev mode signature change): {:?}",
                e
            );
            None
        }
    }
}

/// 把主密钥写入系统钥匙串，并用**新 Entry** 读回验证。
///
/// macOS dev 模式下存在「set_password 返回 Ok 但读不到」的 ACL 问题。
/// 若不验证就认为已托管成功（并删除文件 fallback），下次启动会生成新主密钥，
/// 导致既有密文（token / secure-storage）全部无法解密。因此只有读回一致才算成功。
fn store_key_in_keychain(key: &[u8; 32]) -> bool {
    let encoded = STANDARD.encode(key);

    match Entry::new(SERVICE_NAME, KEY_NAME) {
        Ok(entry) => {
            if let Err(e) = entry.set_password(&encoded) {
                warn!("Failed to save encryption key to keyring: {:?}", e);
                return false;
            }
        }
        Err(e) => {
            warn!("Failed to create keyring entry for saving: {:?}", e);
            return false;
        }
    }

    let verified = Entry::new(SERVICE_NAME, KEY_NAME)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .is_some_and(|stored| stored == encoded);
    if verified {
        info!("Saved new encryption key to system keyring (verified)");
    } else {
        warn!("Keyring write could not be verified (macOS dev mode ACL), keeping file fallback");
    }
    verified
}

/// 删除旧版明文密钥文件（仅在钥匙串已完成托管后调用）。
fn remove_key_file() {
    let Some(path) = get_key_file_path() else {
        return;
    };
    match fs::remove_file(&path) {
        Ok(()) => info!("Migrated master key into keyring and removed legacy file"),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => warn!("Failed to remove legacy master-key file: {:?}", e),
    }
}

/// 获取或生成主加密密钥
///
/// 优先级：系统钥匙串 > 旧版文件 fallback（读取后迁移进钥匙串）> 新生成随机密钥。
///
/// 2026-10-31 修复（审计 H-4）：
/// - 不再使用硬编码盐，也不再以低熵随机串做 PBKDF2 派生 —— 直接用 `OsRng`
///   生成 256 位均匀随机主密钥；
/// - 主密钥首选钥匙串托管，旧版 `~/.tjg/master-key` 明文文件在迁移成功后删除；
/// - 只有钥匙串写入且读回验证失败时，才保留 0600 文件作为降级（否则会丢密钥）。
fn get_master_key() -> &'static [u8; 32] {
    MASTER_KEY.get_or_init(|| {
        // 1. 系统钥匙串优先
        if let Some(key) = load_key_from_keychain() {
            return key;
        }

        // 2. 旧版文件 fallback：读到后立即迁入钥匙串并删除明文文件
        if let Some(key) = load_key_from_file() {
            info!("Successfully retrieved encryption key from file fallback");
            if store_key_in_keychain(&key) {
                remove_key_file();
            } else {
                warn!(
                    "Master key remains in legacy file fallback because keyring is unavailable; \
                     it will be migrated on the next start once the keyring works"
                );
            }
            return key;
        }

        // 3. 首次运行：CSPRNG 生成 256 位随机主密钥
        warn!("No encryption key found in keyring or file, generating new key");
        let mut key = [0u8; MASTER_KEY_LEN];
        OsRng.fill_bytes(&mut key);

        if !store_key_in_keychain(&key) {
            warn!("Keyring unavailable: master key is degraded to 0600 file fallback");
            save_key_to_file(&key);
        }

        key
    })
}

/// 由主密钥与随机盐派生单份密文的 AES 密钥。
fn derive_cipher_key(master: &[u8; 32], salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(master, salt, KDF_ITERATIONS, &mut key);
    key
}

/// 加密字符串
///
/// 输出格式：`tjg:v2:` + base64(`salt(16) | nonce(12) | ciphertext`)。
pub fn encrypt(plaintext: &str) -> anyhow::Result<String> {
    let master = get_master_key();

    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    let cipher = Aes256Gcm::new((&derive_cipher_key(master, &salt)).into());

    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from(nonce_bytes);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {:?}", e))?;

    let mut combined = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(&salt);
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(format!(
        "{}{}",
        CIPHERTEXT_PREFIX_V2,
        STANDARD.encode(combined)
    ))
}

/// 解密字符串
///
/// 兼容两种格式：
/// - `tjg:v2:` 前缀：base64(`salt(16) | nonce(12) | ciphertext`)，密钥由主密钥 + 盐派生；
/// - 无前缀（历史 v1）：base64(`nonce(12) | ciphertext`)，密钥即主密钥（只读兼容）。
pub fn decrypt(encrypted_base64: &str) -> anyhow::Result<String> {
    let master = get_master_key();

    let (cipher, combined) = match encrypted_base64.strip_prefix(CIPHERTEXT_PREFIX_V2) {
        Some(body) => {
            let combined = STANDARD
                .decode(body)
                .map_err(|e| anyhow::anyhow!("Invalid base64: {:?}", e))?;
            if combined.len() <= SALT_LEN + NONCE_LEN {
                return Err(anyhow::anyhow!("Invalid encrypted data: too short"));
            }
            let (salt, rest) = combined.split_at(SALT_LEN);
            let key = derive_cipher_key(master, salt);
            (Aes256Gcm::new((&key).into()), rest.to_vec())
        }
        None => (
            Aes256Gcm::new(master.into()),
            STANDARD
                .decode(encrypted_base64)
                .map_err(|e| anyhow::anyhow!("Invalid base64: {:?}", e))?,
        ),
    };

    if combined.len() < NONCE_LEN {
        return Err(anyhow::anyhow!("Invalid encrypted data: too short"));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let mut nonce_array = [0u8; NONCE_LEN];
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
    // 所有修改 HOME 的测试必须获取此锁，防止并行执行时环境变量冲突。
    // 注意：必须是**进程级共享**那把锁 —— 本模块与 utils::crypto 的用例都会改 HOME，
    // 各持一把锁时跨模块会交叉污染（表现为「单跑绿、全量偶发红」）。
    use crate::utils::test_env_lock::ENV_LOCK as TEST_LOCK;

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

    /// 新密文必须带 v2 前缀，且每份密文使用不同随机盐（盐随密文存储）。
    #[test]
    fn test_encrypt_uses_v2_prefix_with_random_salt() {
        let first = encrypt("same").expect("Encryption failed");
        let second = encrypt("same").expect("Encryption failed");

        assert!(first.starts_with(CIPHERTEXT_PREFIX_V2));
        assert!(second.starts_with(CIPHERTEXT_PREFIX_V2));

        let body = |value: &str| {
            STANDARD
                .decode(value.strip_prefix(CIPHERTEXT_PREFIX_V2).unwrap())
                .expect("valid base64 body")
        };
        let first_body = body(&first);
        let second_body = body(&second);
        assert_ne!(
            &first_body[..SALT_LEN],
            &second_body[..SALT_LEN],
            "每份密文必须携带不同的随机盐"
        );

        assert_eq!(decrypt(&first).unwrap(), "same");
        assert_eq!(decrypt(&second).unwrap(), "same");
    }

    /// 历史 v1 密文（无前缀，密钥即主密钥）必须仍可解密。
    #[test]
    fn test_decrypt_legacy_ciphertext_without_prefix() {
        let master = get_master_key();
        let cipher = Aes256Gcm::new(master.into());

        let mut nonce_bytes = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from(nonce_bytes);
        let ciphertext = cipher
            .encrypt(&nonce, b"legacy-token".as_ref())
            .expect("legacy encryption");

        let mut combined = nonce_bytes.to_vec();
        combined.extend_from_slice(&ciphertext);
        let legacy = STANDARD.encode(combined);

        assert!(!legacy.starts_with(CIPHERTEXT_PREFIX_V2));
        assert_eq!(decrypt(&legacy).unwrap(), "legacy-token");
    }

    /// 篡改 v2 密文必须解密失败（fail-closed，绝不返回明文猜测）。
    #[test]
    fn test_v2_ciphertext_tamper_detected() {
        let encrypted = encrypt("tamper").expect("Encryption failed");
        let body = encrypted.strip_prefix(CIPHERTEXT_PREFIX_V2).unwrap();
        let mut combined = STANDARD.decode(body).expect("valid base64 body");
        let last = combined.len() - 1;
        combined[last] ^= 0xFF;

        let tampered = format!("{}{}", CIPHERTEXT_PREFIX_V2, STANDARD.encode(combined));
        assert!(decrypt(&tampered).is_err());
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
        OsRng.fill_bytes(&mut nonce_bytes);
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
        OsRng.fill_bytes(&mut nonce_bytes);
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
