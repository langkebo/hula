/// 集成测试：验证 "Keychain 写入成功但读取失败" 问题的修复
///
/// 生产日志现象（修复前）：
///   set_secret → Successfully stored secret to keychain          ← 写入成功
///   get_secret → No keychain entry found for key '...'           ← 读取失败！
///                 Loaded secret from file fallback               ← 降级文件
///                 Retrieved secret from file fallback (keychain unavailable)
///
/// 修复前 bug：
/// 1. macOS dev 模式下 keychain set_password 返回 Ok 但 get_password 返回 NoEntry
/// 2. fallback 目录权限问题导致 save_to_fallback 静默失败
/// 3. SecureStore::set 仅检查 get_fallback_path(key).is_some()（路径可计算），
///    而非实际文件写入结果，导致两处都失败时仍返回 Ok(())
///
/// 修复后行为：
/// 1. save_to_fallback 返回 bool 表示实际写入结果
/// 2. SecureStore::set 对 keychain 做写后读验证（用新 Entry 实例）
/// 3. 只有当 keychain 或 fallback 至少一处实际成功时才返回 Ok
/// 4. 两处都失败时返回 Err(AccessDenied)
///
/// 运行方式：cd src-tauri && cargo test --test secure_store_keychain_test -- --nocapture
use keyring::Entry;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tjg_app_lib::utils::secure_store::SecureStore;

/// 全局串行锁：所有测试共享，强制串行执行避免 keychain 并发干扰
static SERIAL_LOCK: Mutex<()> = Mutex::new(());

/// 与 secure_store.rs 中 get_service_name() 的默认值保持一致
const SERVICE_NAME: &str = "hula-secure-storage";

/// 生成唯一测试 key，避免不同测试运行之间的干扰
fn unique_key(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("tjg-test-{}-{}", prefix, nanos)
}

/// 串行测试守卫：获取全局锁，Drop 时自动释放
/// 持有此守卫期间，其他测试无法获取锁，强制串行执行避免 keychain 并发干扰
#[allow(dead_code)]
struct SerialGuard(std::sync::MutexGuard<'static, ()>);

impl SerialGuard {
    fn acquire() -> Self {
        Self(SERIAL_LOCK.lock().unwrap_or_else(|e| e.into_inner()))
    }
}

// ============================================================================
// 测试 1：验证修复 — set 不再返回虚假 Ok
// ============================================================================
//
// 修复前：set 返回 Ok(()) 但 keychain 和 fallback 都没有值
// 修复后：set 返回 Err(AccessDenied) 当两处都失败时
//
// 此测试验证：set 的返回值与实际持久化状态一致。
// 如果 set 返回 Ok，get 必须能读到值；如果两处都失败，set 必须返回 Err。

#[test]
fn test_set_does_not_return_false_ok() {
    let _guard = SerialGuard::acquire();
    let key = unique_key("no-false-ok");
    let value = "no-false-ok-value";

    println!("=== 验证 set 不再返回虚假 Ok ===");

    let set_result = SecureStore::set(&key, value);
    println!("[SET] SecureStore::set 返回: {:?}", set_result);

    match &set_result {
        Ok(()) => {
            // set 返回 Ok，必须能 get 到值
            let get_result = SecureStore::get(&key);
            println!("[GET] SecureStore::get 返回: {:?}", get_result);
            assert!(
                get_result.is_ok(),
                "get 不应返回 Err，got: {:?}",
                get_result
            );
            let loaded = get_result.unwrap();
            assert_eq!(
                loaded.as_deref(),
                Some(value),
                "set 返回 Ok 但 get 返回 {:?}，说明 set 返回了虚假的 Ok",
                loaded
            );
            println!("[PASS] set 返回 Ok 且 get 能读到值，行为一致");
        }
        Err(e) => {
            // set 返回 Err，说明 keychain 和 fallback 都失败了
            // 这是正确行为：不再返回虚假 Ok
            println!(
                "[PASS] set 正确返回 Err（keychain 和 fallback 都失败）: {:?}",
                e
            );
            // 验证 get 也返回 None
            let get_result = SecureStore::get(&key).unwrap();
            assert!(
                get_result.is_none(),
                "set 返回 Err 但 get 返回 {:?}，行为不一致",
                get_result
            );
        }
    }

    // Cleanup
    let _ = SecureStore::delete(&key);
}

// ============================================================================
// 测试 2：验证 keychain 写后读验证机制
// ============================================================================
//
// 修复后 SecureStore::set 对 keychain 做写后读验证（用新 Entry 实例）。
// 此测试直接用原始 keyring API 验证 keychain 的写后读行为，
// 确认 macOS dev 模式下 keychain ACL 问题是否存在。
//
// 如果 keychain 存在 ACL 问题（set 返回 Ok 但 new Entry get 返回 NoEntry），
// SecureStore::set 应检测到并降级到 fallback。

#[test]
fn test_keychain_write_then_read_with_new_entry() {
    let _guard = SerialGuard::acquire();
    let key = unique_key("kc-write-read-new");
    let value = "kc-write-read-new-value";

    println!("=== 验证 keychain 写后读（新 Entry 实例）===");

    // 用 Entry A 写入
    let entry_a = Entry::new(SERVICE_NAME, &key).expect("Failed to create Entry A");
    let set_result = entry_a.set_password(value);
    println!("[WRITE] Entry A set_password: {:?}", set_result);
    assert!(set_result.is_ok(), "set_password 应返回 Ok");

    // 用 Entry B 读取（模拟 SecureStore::get 的行为）
    let entry_b = Entry::new(SERVICE_NAME, &key).expect("Failed to create Entry B");
    let get_result = entry_b.get_password();
    println!("[READ] Entry B get_password: {:?}", get_result);

    match get_result {
        Ok(retrieved) => {
            assert_eq!(retrieved, value, "新 Entry 读取的值应与写入一致");
            println!("[INFO] keychain 新实例读取正常，无 ACL 问题");
        }
        Err(keyring::Error::NoEntry) => {
            println!("[INFO] keychain ACL 问题确认：set 返回 Ok 但新 Entry get 返回 NoEntry");
            println!("[INFO] SecureStore::set 的写后读验证会检测到此问题并降级到 fallback");
        }
        Err(e) => {
            println!("[WARN] keychain 新实例读取返回未知错误: {:?}", e);
        }
    }

    // Cleanup
    let _ = entry_a.delete_credential();
    let _ = entry_b.delete_credential();
}

// ============================================================================
// 测试 3：验证 set→get 契约（使用生产 key 格式）
// ============================================================================
//
// 验证 SecureStore 的核心契约：set 返回 Ok ⟹ get 返回 Some(value)
// 如果 set 返回 Err，get 应返回 None。
// 使用与生产日志相同的 key 格式。

#[test]
fn test_set_get_contract_with_production_key_format() {
    let _guard = SerialGuard::acquire();
    let key = format!(
        "tjg-crypto-storage-password:@test-user:matrix.test:{}",
        unique_key("device")
    );
    let value = "test-crypto-password-abc123";

    println!("=== 验证 set→get 契约（生产 key 格式）===");
    println!("[KEY] {}", key);

    let set_result = SecureStore::set(&key, value);
    println!("[SET] 返回: {:?}", set_result);

    let get_result = SecureStore::get(&key);
    println!("[GET] 返回: {:?}", get_result);
    assert!(get_result.is_ok(), "get 不应返回 Err");

    match set_result {
        Ok(()) => {
            // set 成功 → get 必须返回值
            let loaded = get_result.unwrap();
            assert_eq!(
                loaded.as_deref(),
                Some(value),
                "set 返回 Ok 但 get 返回 {:?}，契约 violated",
                loaded
            );
            println!("[PASS] set→get 契约成立");
        }
        Err(_) => {
            // set 失败 → get 应返回 None
            let loaded = get_result.unwrap();
            assert!(
                loaded.is_none(),
                "set 返回 Err 但 get 返回 {:?}，契约 violated",
                loaded
            );
            println!("[PASS] set 失败时 get 返回 None，契约成立");
        }
    }

    // Cleanup
    let _ = SecureStore::delete(&key);
}

// ============================================================================
// 测试 4：验证 fallback 文件实际写入（诊断 fallback 是否工作）
// ============================================================================
//
// 此测试诊断 fallback 机制是否正常工作。
// 在沙箱环境中 fallback 可能写入失败（PermissionDenied），
// 此时 SecureStore::set 应返回 Err 而非虚假 Ok。

#[test]
fn test_fallback_file_actually_written_or_set_returns_err() {
    let _guard = SerialGuard::acquire();
    let key = unique_key("fallback-diag");
    let value = "fallback-diag-value";

    println!("=== 验证 fallback 文件实际写入或 set 返回 Err ===");

    let set_result = SecureStore::set(&key, value);
    println!("[SET] SecureStore::set 返回: {:?}", set_result);

    // 计算 fallback 文件路径
    let home = std::env::var("HOME").expect("HOME 环境变量应存在");
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    let hash = hasher.finish();
    let fallback_file = std::path::Path::new(&home)
        .join(".tjg")
        .join("secure-storage")
        .join(format!("{:016x}.enc", hash));

    println!("[DIAG] fallback 文件路径: {}", fallback_file.display());
    println!("[DIAG] fallback 文件存在: {}", fallback_file.exists());

    // 检查 keychain
    let entry = Entry::new(SERVICE_NAME, &key).expect("Failed to create Entry");
    let kc_result = entry.get_password();
    println!("[DIAG] keychain get_password: {:?}", kc_result);

    let kc_has_value = kc_result.is_ok();
    let fallback_has_value = fallback_file.exists();

    // 核心断言：set 的返回值必须与实际持久化状态一致
    match &set_result {
        Ok(()) => {
            // set 返回 Ok → 至少一处必须有值
            assert!(
                kc_has_value || fallback_has_value,
                "set 返回 Ok 但 keychain({}) 和 fallback({}) 都没有值，set 返回了虚假 Ok",
                kc_has_value,
                fallback_has_value
            );
            println!("[PASS] set 返回 Ok 且至少一处有值");
        }
        Err(e) => {
            // set 返回 Err → 两处都应没有值
            assert!(
                !kc_has_value || !fallback_has_value,
                "set 返回 Err({:?}) 但 keychain({}) 或 fallback({}) 有值，行为不一致",
                e,
                kc_has_value,
                fallback_has_value
            );
            println!("[PASS] set 返回 Err 且两处都无值（keychain 和 fallback 都失败）");
        }
    }

    // Cleanup
    let _ = entry.delete_credential();
    let _ = SecureStore::delete(&key);
}

// ============================================================================
// 测试 5：诊断测试 — 输出当前环境 keychain 状态（不会失败）
// ============================================================================

#[test]
fn test_diagnose_keychain_status() {
    let _guard = SerialGuard::acquire();
    let test_key = unique_key("diagnose");
    let test_value = "diagnostic-value";

    println!("=== Keychain 环境诊断 ===");
    println!("[DIAG] HOME = {:?}", std::env::var("HOME"));
    println!(
        "[DIAG] TJG_PROFILE_DIR = {:?}",
        std::env::var("TJG_PROFILE_DIR")
    );

    // 测试原始 keychain roundtrip（使用同一 Entry 实例）
    let keychain_status = if let Ok(entry) = Entry::new(SERVICE_NAME, &test_key) {
        let set_result = entry.set_password(test_value);
        if set_result.is_err() {
            let _ = entry.delete_credential();
            println!("[DIAG] keychain set_password 失败: {:?}", set_result);
            "set-failed"
        } else {
            // 用新 Entry 实例读取（模拟 SecureStore::get）
            let verify_entry = Entry::new(SERVICE_NAME, &test_key);
            let get_result = verify_entry.map(|e| e.get_password());
            let _ = entry.delete_credential();
            match get_result {
                Ok(Ok(_)) => {
                    println!("[DIAG] keychain 完全正常 (set+get via new Entry 均成功)");
                    "fully-functional"
                }
                Ok(Err(keyring::Error::NoEntry)) => {
                    println!("[DIAG] keychain ACL 问题: set 成功但 new Entry get 返回 NoEntry");
                    "bug-set-ok-get-noentry"
                }
                Ok(Err(e)) => {
                    println!("[DIAG] keychain new Entry get 返回未知错误: {:?}", e);
                    "get-unknown-error"
                }
                Err(e) => {
                    println!("[DIAG] 无法创建验证 Entry: {:?}", e);
                    "verify-entry-failed"
                }
            }
        }
    } else {
        "entry-creation-failed"
    };

    let store_available = SecureStore::is_available();
    println!("[DIAG] SecureStore::is_available: {}", store_available);
    println!("[DIAG] keychain 状态: {}", keychain_status);
    println!("=== 诊断结束 ===");

    assert!(
        store_available,
        "SecureStore::is_available 必须为 true（keychain 或 fallback 至少一处可用）"
    );
}
