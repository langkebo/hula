use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use keyring::Entry;
use pbkdf2::pbkdf2_hmac;
use rand::{Rng, distributions::Alphanumeric};
use sha2::Sha256;
use std::sync::OnceLock;
use tracing::{error, info, warn};

const SERVICE_NAME: &str = "hula-messenger";
const KEY_NAME: &str = "token-encryption-key";
const SALT: &[u8] = b"hula-secure-salt-2026"; // 静态盐值，用于派生主密钥

static MASTER_KEY: OnceLock<[u8; 32]> = OnceLock::new();

/// 获取或生成主加密密钥
fn get_master_key() -> &'static [u8; 32] {
    MASTER_KEY.get_or_init(|| {
        // 1. 尝试从系统 Keyring 获取
        if let Ok(entry) = Entry::new(SERVICE_NAME, KEY_NAME) {
            if let Ok(key_base64) = entry.get_password() {
                if let Ok(key_bytes) = STANDARD.decode(key_base64) {
                    if let Ok(key) = key_bytes.try_into() {
                        info!("Successfully retrieved encryption key from system keyring");
                        return key;
                    }
                }
            }
        }

        // 2. 如果 Keyring 不可用或没有密钥，生成一个新密钥
        warn!("System keyring key not found, generating new key");
        let mut rng = rand::thread_rng();
        let random_str: String = (0..32).map(|_| rng.sample(Alphanumeric) as char).collect();

        let mut key = [0u8; 32];
        pbkdf2_hmac::<Sha256>(random_str.as_bytes(), SALT, 100_000, &mut key);

        // 3. 尝试保存到 Keyring
        if let Ok(entry) = Entry::new(SERVICE_NAME, KEY_NAME) {
            let key_base64 = STANDARD.encode(key);
            if let Err(e) = entry.set_password(&key_base64) {
                error!("Failed to save encryption key to keyring: {:?}", e);
            } else {
                info!("Saved new encryption key to system keyring");
            }
        }

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

    #[test]
    fn test_encrypt_decrypt() {
        let original = "secret_matrix_token_123456";
        let encrypted = encrypt(original).expect("Encryption failed");
        assert_ne!(original, encrypted);

        let decrypted = decrypt(&encrypted).expect("Decryption failed");
        assert_eq!(original, decrypted);
    }
}
