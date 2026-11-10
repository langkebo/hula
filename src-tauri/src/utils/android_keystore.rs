//! Android Keystore 安全存储后端（D2）。
//!
//! `keyring` 3.x 只实现了 macOS/iOS/Windows/Linux，Android 上没有原生后端，
//! 导致 secure storage 只能退化为 master-key 加密的本地文件。这里通过本地插件
//! `tauri-plugin-hula` 调用 Android Keystore（AES/GCM），让 Android 也有
//! 「系统密钥库保护」的原生后端。
//!
//! 调用约定：插件命令依赖 Android 主线程上下文，同步命令（主线程）里直接阻塞
//! 会死锁，因此统一切到独立线程发起调用并等待回调。

use std::sync::OnceLock;
use std::sync::mpsc;
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_hula::HulaExt;
use tracing::warn;

/// 插件调用超时：Keystore 加解密是毫秒级，超时视为失败，避免阻塞调用方。
const CALL_TIMEOUT: Duration = Duration::from_secs(5);

static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

/// 注入 AppHandle（由 `common_setup` 在启动时调用）。
pub fn init(app: AppHandle) {
    let _ = APP_HANDLE.set(app);
}

fn run_on_worker<T, F>(operation: &str, f: F) -> Option<T>
where
    T: Send + 'static,
    F: FnOnce(AppHandle) -> Result<T, tauri_plugin_hula::Error> + Send + 'static,
{
    let Some(app) = APP_HANDLE.get().cloned() else {
        warn!(
            "[SECURE_STORE] Android keystore backend unavailable (app handle not initialized), {} skipped",
            operation
        );
        return None;
    };

    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(f(app));
    });

    match rx.recv_timeout(CALL_TIMEOUT) {
        Ok(Ok(value)) => Some(value),
        Ok(Err(e)) => {
            warn!(
                "[SECURE_STORE] Android keystore {} failed: {}",
                operation, e
            );
            None
        }
        Err(e) => {
            warn!(
                "[SECURE_STORE] Android keystore {} timed out: {:?}",
                operation, e
            );
            None
        }
    }
}

/// 用 Android Keystore 加密明文，返回 base64(iv || ciphertext)。
pub fn encrypt(plaintext: &str) -> Option<String> {
    let plaintext = plaintext.to_string();
    run_on_worker("encrypt", move |app| {
        app.hula().keystore_encrypt(&plaintext)
    })
}

/// 解密 base64(iv || ciphertext)，返回明文。
pub fn decrypt(payload: &str) -> Option<String> {
    let payload = payload.to_string();
    run_on_worker("decrypt", move |app| app.hula().keystore_decrypt(&payload))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 未注入 AppHandle 时必须安全返回 None（不 panic、不死锁）。
    #[test]
    fn encrypt_returns_none_without_app_handle() {
        assert!(encrypt("probe").is_none());
        assert!(decrypt("probe").is_none());
    }
}
