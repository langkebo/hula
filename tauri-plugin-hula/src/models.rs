use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingRequest {
    pub value: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResponse {
    pub value: Option<String>,
}

/// Android Keystore 加密入参。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeystoreEncryptRequest {
    pub plaintext: String,
}

/// Android Keystore 解密入参（base64(iv || ciphertext)）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeystoreDecryptRequest {
    pub payload: String,
}

/// Android Keystore 命令的返回体：加密返回 base64(iv || ciphertext)，解密返回明文。
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeystorePayloadResponse {
    pub payload: Option<String>,
}
