//! 访客升级的本地库迁移：文件层与判定逻辑。
//!
//! 运行方式：`cd src-tauri && cargo test --test database_migration_tests`
//!
//! 为什么要单独一个文件：`repository_tests.rs` 里的 `merge_login_uid` 只覆盖 SQL 改写，
//! 而迁移真正容易出错的是**文件层**（复制内容是否完整、目标已存在会不会被覆盖、
//! 源库是否被破坏）与**进度判定**（中断后能否自愈）。这两块不需要 `AppHandle`，
//! 因此可以脱离 Tauri 运行时直接测。
//!
//! 不引入 `tempfile` 依赖：用例只在系统临时目录下建一个带 pid+纳秒后缀的目录，
//! 结束时尽力删除（失败不影响断言）。
use entity::{im_config, im_message};
use migration::{Migrator, MigratorTrait};
use sea_orm::{
    ConnectOptions, ConnectionTrait, Database, DatabaseConnection, DbBackend, EntityTrait, Set,
    Statement,
};
use std::path::{Path, PathBuf};
use tjg_app_lib::command::database_command::{
    MigrationStep, copy_database_file, decide_migration_step, merge_login_uid,
};

const FROM: &str = "@guest:example.org";
const TO: &str = "@upgraded:example.org";
const OTHER: &str = "@other:example.org";

/// 建一个带 pid+纳秒的唯一临时目录（进程内多次调用也不会撞名）。
fn unique_temp_dir(tag: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("tjg-{tag}-{}-{nanos}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("创建临时目录失败");
    dir
}

async fn connect_file(path: &Path) -> DatabaseConnection {
    let mut opt = ConnectOptions::new(format!("sqlite:{}?mode=rwc", path.display()));
    // 与仓储测试一致：单连接，避免多个连接各自持有一份状态
    opt.max_connections(1).min_connections(1);
    let db = Database::connect(opt)
        .await
        .expect("连接文件型 SQLite 失败");
    Migrator::up(&db, None).await.expect("执行迁移失败");
    db
}

async fn count_login_uid(db: &DatabaseConnection, table: &str, uid: &str) -> i64 {
    let stmt = Statement::from_sql_and_values(
        DbBackend::Sqlite,
        format!("SELECT COUNT(*) AS cnt FROM {table} WHERE login_uid = ?"),
        [uid.into()],
    );
    let row = db
        .query_one(stmt)
        .await
        .expect("统计失败")
        .expect("COUNT(*) 应返回一行");
    row.try_get::<i64>("", "cnt").expect("读取 cnt 失败")
}

/// 种一条消息 + 一条配置，归属 `login_uid`。
async fn seed(db: &DatabaseConnection, login_uid: &str, suffix: &str) {
    im_message::Entity::insert(im_message::ActiveModel {
        id: Set(format!("msg-{suffix}")),
        uid: Set("@peer:example.org".to_string()),
        room_id: Set("!room:example.org".to_string()),
        login_uid: Set(login_uid.to_string()),
        send_status: Set("success".to_string()),
        ..Default::default()
    })
    .exec(db)
    .await
    .expect("预置消息失败");

    im_config::Entity::insert(im_config::ActiveModel {
        id: Set(if suffix == "from" { 1 } else { 2 }),
        config_key: Set(format!("k-{suffix}")),
        config_value: Set(None),
        login_uid: Set(login_uid.to_string()),
    })
    .exec(db)
    .await
    .expect("预置配置失败");
}

#[test]
fn decide_migration_step_covers_every_row_combination() {
    // 已迁完：旧账号行没了、新账号有行 ⇒ 幂等重入，不能再改写（否则会把新账号数据当成旧的）
    assert_eq!(decide_migration_step(0, 3), MigrationStep::AlreadyMerged);
    // 两边都有 ⇒ 目标库已有新账号自己的数据，混写会串号
    assert_eq!(decide_migration_step(2, 3), MigrationStep::Conflict);
    // 两边都空 ⇒ 没东西可迁（源库本身空，或复制失败被重建）
    assert_eq!(decide_migration_step(0, 0), MigrationStep::NothingToMigrate);
    // 只有旧账号行 ⇒ 正需要改写
    assert_eq!(decide_migration_step(5, 0), MigrationStep::Merge);
}

#[test]
fn copy_database_file_is_idempotent_and_never_overwrites_target() {
    let dir = unique_temp_dir("copy");
    let from = dir.join("db_from.sqlite");
    let to = dir.join("db_to.sqlite");
    std::fs::write(&from, b"source-bytes").expect("写入源文件失败");

    assert!(
        copy_database_file(&from, &to).expect("首次复制应成功"),
        "目标不存在时应真正复制"
    );
    assert_eq!(
        std::fs::read(&to).expect("读取目标失败"),
        b"source-bytes",
        "复制内容必须与源一致"
    );

    // 目标已存在：不得覆盖（否则会把新账号已有的库冲掉）
    std::fs::write(&to, b"target-bytes").expect("改写目标失败");
    assert!(
        !copy_database_file(&from, &to).expect("二次复制应返回 false"),
        "目标已存在时不应声称复制过"
    );
    assert_eq!(
        std::fs::read(&to).expect("读取目标失败"),
        b"target-bytes",
        "已存在的目标库不得被覆盖"
    );

    let _ = std::fs::remove_dir_all(&dir);
}

/// 真实文件级全流程：建库 → 复制 → 在新库上改写 → 源库保持可用且未被篡改。
#[tokio::test]
async fn file_level_migration_keeps_source_intact_and_rewrites_target() {
    let dir = unique_temp_dir("migrate");
    let from_path = dir.join("db_guest.sqlite");
    let to_path = dir.join("db_upgraded.sqlite");

    {
        let source = connect_file(&from_path).await;
        seed(&source, FROM, "from").await;
        seed(&source, OTHER, "other").await;
        // 关闭连接，模拟「下次启动时从磁盘打开」——复制的是落盘后的文件
        source.close().await.expect("关闭源库失败");
    }

    assert!(
        copy_database_file(&from_path, &to_path).expect("复制失败"),
        "首次迁移应复制出目标库"
    );

    {
        let target = connect_file(&to_path).await;
        // 每张表各 1 行（消息 + 配置），两层都要能跟着账号走
        let from_msg = count_login_uid(&target, "im_message", FROM).await;
        let from_cfg = count_login_uid(&target, "im_config", FROM).await;
        assert_eq!(
            (from_msg, from_cfg),
            (1, 1),
            "复制过来的库应含旧账号的两表数据"
        );
        assert_eq!(decide_migration_step(from_msg, 0), MigrationStep::Merge);

        let affected = merge_login_uid(&target, FROM, TO).await.expect("改写失败");
        assert_eq!(affected, 2, "应改写旧账号的两行（消息 + 配置）");
        assert_eq!(
            count_login_uid(&target, "im_message", FROM).await,
            0,
            "旧账号的消息应归零"
        );
        assert_eq!(
            count_login_uid(&target, "im_config", FROM).await,
            0,
            "旧账号的配置应归零"
        );
        assert_eq!(
            count_login_uid(&target, "im_message", TO).await,
            1,
            "新账号应拿到消息"
        );
        assert_eq!(
            count_login_uid(&target, "im_config", TO).await,
            1,
            "新账号应拿到配置"
        );
        assert_eq!(
            count_login_uid(&target, "im_message", OTHER).await,
            1,
            "其他账号的消息不得被误改"
        );
        assert_eq!(
            count_login_uid(&target, "im_config", OTHER).await,
            1,
            "其他账号的配置不得被误改"
        );
        target.close().await.expect("关闭目标库失败");
    }

    // 源库必须仍然完整可读：迁移失败时它是唯一回滚来源
    {
        let source = connect_file(&from_path).await;
        assert_eq!(
            count_login_uid(&source, "im_message", FROM).await,
            1,
            "源库的旧账号行不得被改写（迁移是复制，不是搬走）"
        );
        source.close().await.expect("关闭源库失败");
    }

    let _ = std::fs::remove_dir_all(&dir);
}
