use serde::de::DeserializeOwned;
use tauri::{
    AppHandle, Runtime,
    plugin::{PluginApi, PluginHandle},
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_hula);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Hula<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("com.plugin.hula", "ExamplePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_hula)?;
    Ok(Hula(handle))
}

/// Access to the hula APIs.
pub struct Hula<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Hula<R> {
    pub fn ping(&self, payload: PingRequest) -> crate::Result<PingResponse> {
        self.0
            .run_mobile_plugin("ping", payload)
            .map_err(Into::into)
    }
}

/// Android Keystore 后端（D2）：keyring 没有 Android 实现，SecureStore 通过这里落到
/// 系统密钥库保护的 AES/GCM 加解密。
#[cfg(target_os = "android")]
impl<R: Runtime> Hula<R> {
    /// 加密明文，返回 base64(iv || ciphertext)。
    pub fn keystore_encrypt(&self, plaintext: &str) -> crate::Result<String> {
        let response: KeystorePayloadResponse = self.0.run_mobile_plugin(
            "keystoreEncrypt",
            KeystoreEncryptRequest {
                plaintext: plaintext.to_string(),
            },
        )?;
        response
            .payload
            .ok_or_else(|| crate::Error::Keystore("missing payload in encrypt response".into()))
    }

    /// 解密 base64(iv || ciphertext)，返回明文。
    pub fn keystore_decrypt(&self, payload: &str) -> crate::Result<String> {
        let response: KeystorePayloadResponse = self.0.run_mobile_plugin(
            "keystoreDecrypt",
            KeystoreDecryptRequest {
                payload: payload.to_string(),
            },
        )?;
        response
            .payload
            .ok_or_else(|| crate::Error::Keystore("missing payload in decrypt response".into()))
    }
}
