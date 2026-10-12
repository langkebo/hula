//! 集成测试：消息仓储关键路径
//!
//! 覆盖 P2-4（TS-03）要求的 Rust 关键路径测试：DB 迁移建表、消息落库与 upsert、
//! 游标分页降序、time_block 时间块计算、删除消息跳过重插、房间清空、发送状态主键改写。
//!
//! 运行方式：cd src-tauri && cargo test --test message_repository_tests
//!
//! 设计说明：
//! - 每个测试使用独立的内存 SQLite，`max_connections(1)` 保证连接池只保留一个连接，
//!   否则每条连接各自拥有私有内存库，迁移建的表会在连接回收后消失。
//! - `im_message_repository` 的 `im_deleted_message` / `im_room_clear_record` 建表标志
//!   是进程级 `lazy_static`，因此所有测试必须串行执行并在开始时重置标志，
//!   否则会出现「标志已置位但当前库尚无该表」的假性失败。
use entity::im_message;
use migration::{Migrator, MigratorTrait};
use sea_orm::sea_query::Value;
use sea_orm::{
    ConnectOptions, ConnectionTrait, Database, DatabaseConnection, EntityTrait, PaginatorTrait,
    Statement, TransactionTrait,
};
use std::sync::Mutex;
use tjg_app_lib::pojo::common::{CursorPageParam, CursorPageResp};
use tjg_app_lib::repository::im_message_repository as repo;

const UID: &str = "@tester:example.org";
const ROOM: &str = "!room:example.org";

/// 全局串行锁：仓储建表标志为进程级共享状态，所有涉及仓储的测试必须串行。
static REPO_TEST_LOCK: Mutex<()> = Mutex::new(());

struct RepoTestGuard(#[allow(dead_code)] std::sync::MutexGuard<'static, ()>);

impl RepoTestGuard {
    fn acquire() -> Self {
        Self(REPO_TEST_LOCK.lock().unwrap_or_else(|e| e.into_inner()))
    }
}

/// 建立独立内存 SQLite 并执行全部迁移。
async fn setup_db() -> DatabaseConnection {
    repo::reset_table_initialization_flags();
    let mut opt = ConnectOptions::new("sqlite::memory:");
    opt.max_connections(1).min_connections(1);
    let db = Database::connect(opt)
        .await
        .expect("连接内存 SQLite 失败");
    Migrator::up(&db, None).await.expect("执行数据库迁移失败");
    db
}

/// 构造一条消息模型，默认处于 success 提交态。
fn build_message(id: &str, send_time: i64, body: &str) -> im_message::Model {
    im_message::Model {
        id: id.to_string(),
        uid: UID.to_string(),
        nickname: None,
        room_id: ROOM.to_string(),
        send_time: Some(send_time),
        message_type: Some(1),
        body: Some(body.to_string()),
        message_marks: None,
        create_time: Some(send_time),
        update_time: Some(send_time),
        login_uid: UID.to_string(),
        send_status: "success".to_string(),
        time_block: None,
    }
}

fn page_param(page_size: u32, cursor: &str) -> CursorPageParam {
    CursorPageParam {
        page_size,
        cursor: cursor.to_string(),
        create_id: None,
        create_time: None,
        update_time: None,
    }
}

fn message_ids(resp: &CursorPageResp<Vec<repo::MessageWithThumbnail>>) -> Vec<String> {
    resp.list
        .as_ref()
        .expect("分页结果应包含 list")
        .iter()
        .map(|item| item.message.id.clone())
        .collect()
}

async fn table_exists(db: &DatabaseConnection, name: &str) -> bool {
    let stmt = Statement::from_sql_and_values(
        db.get_database_backend(),
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        vec![Value::from(name.to_string())],
    );
    db.query_one(stmt).await.unwrap().is_some()
}

async fn message_count(db: &DatabaseConnection) -> u64 {
    im_message::Entity::find().count(db).await.unwrap()
}

async fn fetch_message(db: &DatabaseConnection, id: &str) -> Option<im_message::Model> {
    im_message::Entity::find_by_id((id.to_string(), UID.to_string()))
        .one(db)
        .await
        .unwrap()
}

/// 缩略图路径存于 `im_message.thumbnail_path` 列，非 `im_message::Model` 字段，
/// 因此只能通过原生 SQL 读取该列进行断言。
async fn fetch_thumbnail_path(db: &DatabaseConnection, id: &str) -> Option<String> {
    let stmt = Statement::from_sql_and_values(
        db.get_database_backend(),
        "SELECT thumbnail_path FROM im_message WHERE id = ? AND login_uid = ?",
        vec![Value::from(id.to_string()), Value::from(UID.to_string())],
    );
    let row = db.query_one(stmt).await.unwrap().expect("消息行应存在");
    row.try_get::<Option<String>>("", "thumbnail_path")
        .unwrap()
}

#[tokio::test]
async fn test_migrator_creates_core_tables() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    for table in [
        "im_user",
        "im_contact",
        "im_room",
        "im_room_member",
        "im_message",
        "im_config",
    ] {
        assert!(table_exists(&db, table).await, "迁移后应存在核心表 {table}");
    }
}

#[tokio::test]
async fn test_save_all_inserts_then_upserts_without_duplication() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    let batch = vec![
        repo::MessageWithThumbnail::new(build_message("1", 1000, "hello"), None),
        repo::MessageWithThumbnail::new(build_message("2", 2000, "world"), None),
        repo::MessageWithThumbnail::new(build_message("3", 3000, "bang"), None),
    ];
    repo::save_all(&db, batch).await.expect("首次落库失败");
    assert_eq!(message_count(&db).await, 3);

    // 同 id 再次写入应更新字段而非产生重复行
    let updated = vec![repo::MessageWithThumbnail::new(
        build_message("2", 2000, "world-updated"),
        None,
    )];
    repo::save_all(&db, updated).await.expect("增量落库失败");

    assert_eq!(message_count(&db).await, 3, "upsert 不应产生重复行");
    let row = fetch_message(&db, "2").await.expect("消息 2 应存在");
    assert_eq!(row.body.as_deref(), Some("world-updated"));
}

#[tokio::test]
async fn test_save_all_persists_thumbnail_path() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    repo::save_all(
        &db,
        vec![repo::MessageWithThumbnail::new(
            build_message("1", 1000, "with-thumb"),
            Some("/tmp/thumb.png".to_string()),
        )],
    )
    .await
    .expect("落库失败");

    assert_eq!(
        fetch_thumbnail_path(&db, "1").await.as_deref(),
        Some("/tmp/thumb.png")
    );
}

#[tokio::test]
async fn test_cursor_page_messages_orders_desc_and_paginates() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    let batch: Vec<_> = (1..=5)
        .map(|i| {
            repo::MessageWithThumbnail::new(
                build_message(&i.to_string(), i * 1000, &format!("m{i}")),
                None,
            )
        })
        .collect();
    repo::save_all(&db, batch).await.expect("落库失败");

    let page1 = repo::cursor_page_messages(&db, ROOM.to_string(), page_param(2, ""), UID)
        .await
        .expect("第一页查询失败");
    assert_eq!(page1.total, 5);
    assert!(!page1.is_last);
    assert_eq!(message_ids(&page1), vec!["5", "4"]);
    assert_eq!(page1.cursor, "4");

    let page2 = repo::cursor_page_messages(&db, ROOM.to_string(), page_param(2, &page1.cursor), UID)
        .await
        .expect("第二页查询失败");
    assert!(!page2.is_last);
    assert_eq!(message_ids(&page2), vec!["3", "2"]);
    assert_eq!(page2.cursor, "2");

    let page3 = repo::cursor_page_messages(&db, ROOM.to_string(), page_param(2, &page2.cursor), UID)
        .await
        .expect("第三页查询失败");
    assert!(page3.is_last, "最后一页 is_last 应为 true");
    assert_eq!(message_ids(&page3), vec!["1"]);
    assert_eq!(page3.cursor, "");
}

#[tokio::test]
async fn test_calculate_time_block_rules() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    let t1: i64 = 1_000_000;
    let within_gap: i64 = 5 * 60 * 1000; // 5 分钟
    let beyond_gap: i64 = 10 * 60 * 1000; // 10 分钟（阈值）

    // 空房间 -> 视为首条，始终显示时间
    let first = repo::calculate_time_block(&db, ROOM, "1", t1, UID)
        .await
        .expect("计算 time_block 失败");
    assert_eq!(first, Some(1));

    repo::save_all(
        &db,
        vec![repo::MessageWithThumbnail::new(
            build_message("1", t1, "base"),
            None,
        )],
    )
    .await
    .expect("落库失败");

    // 间隔小于 10 分钟 -> 不显示时间块
    let within = repo::calculate_time_block(&db, ROOM, "2", t1 + within_gap, UID)
        .await
        .expect("计算 time_block 失败");
    assert_eq!(within, None);

    // 间隔达到 10 分钟阈值 -> 返回间隔毫秒
    let beyond = repo::calculate_time_block(&db, ROOM, "3", t1 + beyond_gap, UID)
        .await
        .expect("计算 time_block 失败");
    assert_eq!(beyond, Some(beyond_gap));
}

#[tokio::test]
async fn test_save_message_autofills_time_block() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    let t1: i64 = 1_000_000;
    let t2: i64 = t1 + 5 * 60 * 1000;
    let t3: i64 = t2 + 15 * 60 * 1000;

    let txn = db.begin().await.expect("开启事务失败");

    let first = repo::save_message(
        &txn,
        repo::MessageWithThumbnail::new(build_message("1", t1, "first"), None),
    )
    .await
    .expect("保存首条失败");
    assert_eq!(first.message.time_block, Some(1), "房间首条应标记 Some(1)");

    let second = repo::save_message(
        &txn,
        repo::MessageWithThumbnail::new(build_message("2", t2, "second"), None),
    )
    .await
    .expect("保存第二条失败");
    assert_eq!(second.message.time_block, None, "5 分钟内不应显示时间块");

    let third = repo::save_message(
        &txn,
        repo::MessageWithThumbnail::new(build_message("3", t3, "third"), None),
    )
    .await
    .expect("保存第三条失败");
    assert_eq!(
        third.message.time_block,
        Some(t3 - t2),
        "超过阈值应返回与前一条的间隔"
    );

    txn.commit().await.expect("提交事务失败");
    assert_eq!(message_count(&db).await, 3);
}

#[tokio::test]
async fn test_record_deleted_message_prevents_reinsert() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    repo::save_all(
        &db,
        vec![repo::MessageWithThumbnail::new(
            build_message("10", 1000, "bye"),
            None,
        )],
    )
    .await
    .expect("落库失败");
    assert_eq!(message_count(&db).await, 1);

    repo::record_deleted_message(&db, "10", ROOM, UID)
        .await
        .expect("记录删除失败");
    let removed = repo::delete_message_by_id(&db, "10", UID)
        .await
        .expect("删除消息失败");
    assert_eq!(removed, 1);
    assert_eq!(message_count(&db).await, 0);

    // 同步回填同一条已删除消息时应被跳过
    repo::save_all(
        &db,
        vec![repo::MessageWithThumbnail::new(
            build_message("10", 1000, "bye"),
            None,
        )],
    )
    .await
    .expect("重插失败");
    assert_eq!(
        message_count(&db).await,
        0,
        "已记录删除的消息不应被重新插入"
    );
}

#[tokio::test]
async fn test_room_max_message_id_and_clear() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    assert_eq!(
        repo::get_room_max_message_id(&db, ROOM, UID).await.unwrap(),
        None
    );

    let batch: Vec<_> = ["1", "2", "3"]
        .iter()
        .map(|id| repo::MessageWithThumbnail::new(build_message(id, 1000, id), None))
        .collect();
    repo::save_all(&db, batch).await.expect("落库失败");

    assert_eq!(
        repo::get_room_max_message_id(&db, ROOM, UID).await.unwrap(),
        Some("3".to_string())
    );

    let removed = repo::delete_messages_by_room(&db, ROOM, UID)
        .await
        .expect("清空房间失败");
    assert_eq!(removed, 3);
    assert_eq!(
        repo::get_room_max_message_id(&db, ROOM, UID).await.unwrap(),
        None
    );
}

#[tokio::test]
async fn test_update_message_status_rewrites_primary_key_on_success() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    repo::save_all(
        &db,
        vec![repo::MessageWithThumbnail::new(
            build_message("100", 1000, "draft"),
            None,
        )],
    )
    .await
    .expect("落库失败");

    let record = repo::MessageWithThumbnail::new(build_message("100", 1000, "draft"), None);
    let updated = repo::update_message_status(
        &db,
        record,
        "success",
        Some("200".to_string()),
        UID.to_string(),
    )
    .await
    .expect("更新状态失败");

    assert_eq!(updated.message.id, "200");
    assert_eq!(updated.message.send_status, "success");
    assert!(
        fetch_message(&db, "100").await.is_none(),
        "旧主键应被改写为新 id"
    );
    let new = fetch_message(&db, "200").await.expect("新主键应存在");
    assert_eq!(new.send_status, "success");
    assert_eq!(new.body.as_deref(), Some("draft"));
}

#[tokio::test]
async fn test_update_message_status_requires_id_on_success() {
    let _guard = RepoTestGuard::acquire();
    let db = setup_db().await;

    repo::save_all(
        &db,
        vec![repo::MessageWithThumbnail::new(
            build_message("300", 1000, "draft"),
            None,
        )],
    )
    .await
    .expect("落库失败");

    let record = repo::MessageWithThumbnail::new(build_message("300", 1000, "draft"), None);
    let result = repo::update_message_status(&db, record, "success", None, UID.to_string()).await;
    assert!(result.is_err(), "success 状态缺少 id 时应返回错误");
}
