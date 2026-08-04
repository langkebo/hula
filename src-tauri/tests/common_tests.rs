use tjg_app_lib::configuration;
use tjg_app_lib::error;

/// 测试 CommonError 的 Display 实现
#[test]
fn test_common_error_display() {
    let err = error::CommonError::RequestError("test error".to_string());
    assert_eq!(err.to_string(), "Request error: test error");

    let err = error::CommonError::TokenExpired;
    assert_eq!(err.to_string(), "Token expired");

    let db_err = sea_orm::DbErr::Custom("db error".to_string());
    let err = error::CommonError::DatabaseError(db_err);
    assert!(err.to_string().contains("Database error"));
}

/// 测试 CommonError Debug 实现（包含错误链）
#[test]
fn test_common_error_debug() {
    let err = error::CommonError::RequestError("debug test".to_string());
    let debug_str = format!("{:?}", err);
    assert!(debug_str.contains("debug test"));
}

/// 测试 CommonError 转为 String
#[test]
fn test_common_error_into_string() {
    let err = error::CommonError::RequestError("convert test".to_string());
    let s: String = err.into();
    assert_eq!(s, "Request error: convert test");
}

/// 测试 anyhow::Error 自动转换
#[test]
fn test_common_error_from_anyhow() {
    let anyhow_err = anyhow::anyhow!("anyhow error");
    let common_err = error::CommonError::from(anyhow_err);
    assert!(common_err.to_string().contains("anyhow error"));
}

/// 测试 sea_orm::DbErr 自动转换
#[test]
fn test_common_error_from_db_err() {
    let db_err = sea_orm::DbErr::Custom("custom db error".to_string());
    let common_err = error::CommonError::from(db_err);
    assert!(common_err.to_string().contains("custom db error"));
}

/// 测试 error_chain_fmt 格式化
#[test]
fn test_error_chain_fmt() {
    let err = error::CommonError::RequestError("chain test".to_string());
    let debug_str = format!("{:?}", err);
    assert!(debug_str.contains("chain test"));
}

// =================== Environment Tests ===================
use configuration::Environment;

#[test]
fn test_environment_as_str() {
    assert_eq!(Environment::Local.as_str(), "local");
    assert_eq!(Environment::Production.as_str(), "production");
}

#[test]
fn test_environment_try_from_valid() {
    assert!(Environment::try_from("local".to_string()).is_ok());
    assert!(Environment::try_from("LOCAL".to_string()).is_ok());
    assert!(Environment::try_from("Local".to_string()).is_ok());
    assert!(Environment::try_from("production".to_string()).is_ok());
    assert!(Environment::try_from("PRODUCTION".to_string()).is_ok());
}

#[test]
fn test_environment_try_from_invalid() {
    let result = Environment::try_from("invalid".to_string());
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(err.contains("not a supported environment"));
}

// =================== Settings Tests ===================
use configuration::{
    BackendSettings, DatabaseSettings, IceServer, MinioSettings, Settings, Tencent, Youdao,
};

#[test]
fn test_settings_deserialization() {
    let yaml = r#"
database:
  sqlite_file: "test.sqlite"
backend:
  base_url: "http://localhost:8008"
  ws_url: "ws://localhost:8008"
"#;
    let settings: Result<Settings, _> = serde_yaml::from_str(yaml);
    assert!(settings.is_ok());
    let settings = settings.unwrap();
    assert_eq!(settings.database.sqlite_file, "test.sqlite");
    assert_eq!(settings.backend.base_url, "http://localhost:8008");
    assert_eq!(settings.backend.ws_url, "ws://localhost:8008");
    assert!(settings.youdao.is_none());
    assert!(settings.tencent.is_none());
    assert!(settings.minio.is_none());
    assert!(settings.ice_server.is_none());
}

#[test]
fn test_settings_full_deserialization() {
    let yaml = r#"
database:
  sqlite_file: "test.sqlite"
backend:
  base_url: "http://localhost:8008"
  ws_url: "ws://localhost:8008"
youdao:
  app_key: "test_key"
  app_secret: "test_secret"
tencent:
  api_key: "tencent_key"
  secret_id: "tencent_sid"
  map_key: "map_key"
minio:
  endpoint: "https://minio.example.com"
  bucket: "test-bucket"
  access_key: "minio_access"
  secret_key: "minio_secret"
  region: "us-east-1"
  download_domain: "https://cdn.example.com"
ice_server:
  urls:
    - "turn:example.com:3478"
  username: "turn_user"
  credential: "turn_pass"
"#;
    let settings: Result<Settings, _> = serde_yaml::from_str(yaml);
    assert!(settings.is_ok());
    let settings = settings.unwrap();
    assert!(settings.youdao.is_some());
    assert!(settings.tencent.is_some());
    assert!(settings.minio.is_some());
    assert!(settings.ice_server.is_some());

    let minio = settings.minio.unwrap();
    assert_eq!(minio.endpoint, "https://minio.example.com");
    assert_eq!(minio.bucket, "test-bucket");

    let ice = settings.ice_server.unwrap();
    assert_eq!(ice.urls.len(), 1);
    assert_eq!(ice.urls[0], "turn:example.com:3478");
    assert_eq!(ice.username, "turn_user");
    assert_eq!(ice.credential, "turn_pass");
}

#[test]
fn test_settings_serialization() {
    let settings = Settings {
        database: DatabaseSettings {
            sqlite_file: "test.sqlite".to_string(),
        },
        backend: BackendSettings {
            base_url: "http://localhost:8008".to_string(),
            ws_url: "ws://localhost:8008".to_string(),
        },
        youdao: None,
        tencent: None,
        minio: None,
        ice_server: None,
    };
    let yaml = serde_yaml::to_string(&settings);
    assert!(yaml.is_ok());
    let yaml = yaml.unwrap();
    assert!(yaml.contains("test.sqlite"));
    assert!(yaml.contains("http://localhost:8008"));
}

// =================== Crypto Tests ===================
use tjg_app_lib::utils::crypto;

#[test]
fn test_encrypt_decrypt_roundtrip() {
    let original = "secret_token_for_testing";
    let encrypted = crypto::encrypt(original).expect("Encryption failed");
    assert_ne!(
        original, encrypted,
        "Encrypted text should differ from original"
    );

    let decrypted = crypto::decrypt(&encrypted).expect("Decryption failed");
    assert_eq!(original, decrypted, "Decrypted text should match original");
}

#[test]
fn test_encrypt_produces_different_results() {
    let plaintext = "test_data";
    let encrypted1 = crypto::encrypt(plaintext).expect("Encrypt 1 failed");
    let encrypted2 = crypto::encrypt(plaintext).expect("Encrypt 2 failed");
    // 由于每次都用随机 nonce，两次加密结果应不同
    assert_ne!(encrypted1, encrypted2);
}

#[test]
fn test_decrypt_invalid_input() {
    let result = crypto::decrypt("not-valid-base64!!!");
    assert!(result.is_err());
}
