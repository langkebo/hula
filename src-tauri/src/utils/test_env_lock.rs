//! 测试专用：**进程级**环境变量的唯一互斥锁。
//!
//! 为什么需要单独一个模块：`std::env::set_var` 改的是整个进程的环境，而 `cargo test`
//! 默认在一个测试二进制内多线程跑所有用例。`utils::crypto` 与 `utils::secure_store`
//! 的用例都会把 `HOME` 指到各自的临时目录，历史上两者**各持一把模块内锁**，
//! 两把锁互不排斥 ⇒ 交叉污染：
//!
//! - A 模块把 `HOME` 指向 `/tmp/tjg-crypto-test-x`，用完 Drop 里删掉目录；
//! - 同一时刻 B 模块正按 `HOME` 计算 fallback 路径并写探测文件 ⇒ 写进已删目录 ⇒ 失败。
//!
//! 症状很典型：**单独跑该用例永远绿，跑全量才偶发红**。这类失败一旦混进门禁，
//! 会被当成"flaky"从而削弱所有人对 CI 的信任，所以宁可集中一把锁。
//!
//! 使用方式：在测试模块里 `use crate::utils::test_env_lock::ENV_LOCK as TEST_LOCK;`，
//! 既有 `TEST_LOCK.lock()` 调用无需改动。
use std::sync::Mutex;

/// 所有会读写进程级环境变量的测试共用这一把锁。
pub static ENV_LOCK: Mutex<()> = Mutex::new(());
