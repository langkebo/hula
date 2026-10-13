//! 集成测试：配置/会话/房间成员仓储关键路径
//!
//! 覆盖 P2-4（TS-03）要求的 Rust 关键路径测试中尚未覆盖的部分：非消息仓储
//! （`im_config` / `im_contact` / `im_room_member`）的落库、批量整体替换、
//! 幂等写入、隐藏状态改写与游标分页行为。
//!
//! 运行方式：cd src-tauri && cargo test --test repository_tests
//!
//! 设计说明：
//! - 每个测试使用独立的内存 SQLite，`max_connections(1)` 保证连接池只保留一个连接，
//!   否则每条连接各自拥有私有内存库，迁移建的表会在连接回收后消失。
//! - 本文件涉及的仓储不使用进程级建表标志（仅 `im_message_repository` 有），
//!   因此无需串行锁；各测试彼此独立，可并行执行。
//! - 发现两处「实体/仓储」与「迁移建表」不一致的潜在漂移，相关路径以
//!   `#[ignore]` 标注为已知失败复现器（详见各测试注释）；相关函数目前在
//!   Rust 侧无调用方，属潜在缺陷而非活跃故障，故本文件不修改运行时代码。
use entity::{im_config, im_contact, im_room, im_room_member};
use migration::{Migrator, MigratorTrait};
use sea_orm::{
    ColumnTrait, ConnectOptions, Database, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, Set,
};
use tjg_app_lib::pojo::common::{CursorPageParam, CursorPageResp, PageParam};
use tjg_app_lib::repository::{
    im_config_repository as config_repo, im_contact_repository as contact_repo,
    im_room_member_repository as room_repo,
};

const UID: &str = "@tester:example.org";

/// 建立独立内存 SQLite 并执行全部迁移。
async fn setup_db() -> DatabaseConnection {
    let mut opt = ConnectOptions::new("sqlite::memory:");
    opt.max_connections(1).min_connections(1);
    let db = Database::connect(opt).await.expect("连接内存 SQLite 失败");
    Migrator::up(&db, None).await.expect("执行数据库迁移失败");
    db
}

/// 以显式主键预置一行配置（迁移将 `im_config.id` 定义为非自增复合主键）。
async fn seed_config(db: &DatabaseConnection, id: i64, key: &str, value: Option<&str>) {
    im_config::Entity::insert(im_config::ActiveModel {
        id: Set(id),
        config_key: Set(key.to_string()),
        config_value: Set(value.map(|v| v.to_string())),
        login_uid: Set(UID.to_string()),
    })
    .exec(db)
    .await
    .expect("预置配置失败");
}

async fn config_count(db: &DatabaseConnection) -> u64 {
    im_config::Entity::find().count(db).await.unwrap()
}

// =================== im_config ===================

#[tokio::test]
async fn test_config_get_missing_key_returns_none() {
    let db = setup_db().await;
    let got = config_repo::get_config_by_key(&db, "theme", UID)
        .await
        .expect("查询缺失配置不应报错");
    assert!(got.is_none(), "缺失配置应返回 None");
}

#[tokio::test]
async fn test_config_list_returns_user_configs() {
    let db = setup_db().await;
    seed_config(&db, 1, "theme", Some("dark")).await;
    seed_config(&db, 2, "lang", Some("zh")).await;

    let list = config_repo::list_config(&db, UID).await.unwrap();
    assert_eq!(list.len(), 2, "应返回当前用户的全部配置");
}

#[tokio::test]
async fn test_config_save_updates_preexisting_row() {
    let db = setup_db().await;
    seed_config(&db, 1, "lang", Some("zh")).await;

    // 已存在 key 时 save_or_update_config 走更新分支，不新增行
    config_repo::save_or_update_config(&db, "lang", Some("en".to_string()), UID)
        .await
        .expect("更新配置失败");

    let row = config_repo::get_config_by_key(&db, "lang", UID)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(row.config_value.as_deref(), Some("en"));
    assert_eq!(config_count(&db).await, 1);
}

#[tokio::test]
async fn test_config_delete_removes_key() {
    let db = setup_db().await;
    seed_config(&db, 1, "x", Some("1")).await;

    config_repo::delete_config(&db, "x", UID)
        .await
        .expect("删除配置失败");

    assert!(
        config_repo::get_config_by_key(&db, "x", UID)
            .await
            .unwrap()
            .is_none(),
        "删除后配置应不可见"
    );
    assert_eq!(config_count(&db).await, 0);
}

/// 已知漂移复现器：迁移把 `im_config.id` 建为 `bigint NOT NULL` 复合主键
/// `(id, login_uid)` 且无自增，而 `save_or_update_config` 新增分支写入
/// `id = NotSet`，SQLite 会落为 NULL 从而违反 NOT NULL 约束。
/// 该函数目前在 Rust 侧无调用方；修复（补自增/补 id 生成）后此测试应转绿。
#[tokio::test]
#[ignore = "已知 schema 漂移：im_config.id 非自增导致 NotSet 插入违反 NOT NULL"]
async fn test_config_save_inserts_new_key() {
    let db = setup_db().await;

    config_repo::save_or_update_config(&db, "theme", Some("dark".to_string()), UID)
        .await
        .expect("新增配置应成功");

    let row = config_repo::get_config_by_key(&db, "theme", UID)
        .await
        .unwrap()
        .expect("配置应已落库");
    assert_eq!(row.config_value.as_deref(), Some("dark"));
    assert_eq!(config_count(&db).await, 1);
}

/// 已知漂移复现器：`save_config_batch` 同样以 `id = NotSet` 批量插入，
/// 与上一条同因（`im_config.id` 非自增）。修复后此测试应转绿。
#[tokio::test]
#[ignore = "已知 schema 漂移：im_config.id 非自增导致 NotSet 批量插入违反 NOT NULL"]
async fn test_config_save_batch_replaces_user_configs() {
    let db = setup_db().await;
    seed_config(&db, 1, "stale", Some("1")).await;

    config_repo::save_config_batch(
        &db,
        vec![
            im_config::Model {
                id: 0,
                config_key: "a".to_string(),
                config_value: Some("1".to_string()),
                login_uid: UID.to_string(),
            },
            im_config::Model {
                id: 0,
                config_key: "b".to_string(),
                config_value: Some("2".to_string()),
                login_uid: UID.to_string(),
            },
        ],
        UID,
    )
    .await
    .expect("批量保存配置应成功");

    let list = config_repo::list_config(&db, UID).await.unwrap();
    assert_eq!(list.len(), 2, "批量保存后应只保留新配置");
}

// =================== im_contact ===================

fn build_contact(id: &str, room_id: &str, name: &str) -> im_contact::Model {
    im_contact::Model {
        id: id.to_string(),
        detail_id: format!("detail-{id}"),
        room_id: room_id.to_string(),
        contact_type: Some(0),
        hot_flag: None,
        top: Some(false),
        account: Some(UID.to_string()),
        operate: None,
        remark: None,
        my_name: Some("tester".to_string()),
        mute_notification: Some(0),
        hide: Some(false),
        active_time: Some(1000),
        shield: Some(false),
        avatar: None,
        contact_name: Some(name.to_string()),
        text: None,
        unread_count: Some(0),
        create_time: Some(1000),
        update_time: Some(1000),
        login_uid: UID.to_string(),
    }
}

#[tokio::test]
async fn test_contact_save_batch_replaces_previous_set() {
    let db = setup_db().await;

    contact_repo::save_contact_batch(&db, vec![build_contact("c1", "!r1", "A")], UID)
        .await
        .expect("首次批量保存会话失败");
    assert_eq!(contact_repo::list_contact(&db, UID).await.unwrap().len(), 1);

    contact_repo::save_contact_batch(
        &db,
        vec![
            build_contact("c2", "!r2", "B"),
            build_contact("c3", "!r3", "C"),
        ],
        UID,
    )
    .await
    .expect("二次批量保存会话失败");

    let list = contact_repo::list_contact(&db, UID).await.unwrap();
    assert_eq!(list.len(), 2, "批量保存应整体替换旧会话");
    assert!(list.iter().all(|c| c.id != "c1"), "旧会话应被清除");
}

#[tokio::test]
async fn test_contact_update_hide_toggles_flag() {
    let db = setup_db().await;

    contact_repo::save_contact_batch(&db, vec![build_contact("c1", "!r1", "A")], UID)
        .await
        .expect("批量保存会话失败");
    contact_repo::update_contact_hide(&db, "!r1", true, UID)
        .await
        .expect("更新隐藏状态失败");

    let row = im_contact::Entity::find()
        .filter(im_contact::Column::Id.eq("c1"))
        .filter(im_contact::Column::LoginUid.eq(UID))
        .one(&db)
        .await
        .unwrap()
        .expect("会话应存在");
    assert_eq!(row.hide, Some(true), "隐藏标志应被改写为 true");
}

// =================== im_room_member ===================

fn build_member(
    id: &str,
    room_id: Option<&str>,
    uid: &str,
    name: &str,
    ts: i64,
) -> im_room_member::Model {
    im_room_member::Model {
        id: id.to_string(),
        room_id: room_id.map(|r| r.to_string()),
        uid: Some(uid.to_string()),
        account: None,
        my_name: None,
        active_status: None,
        group_role: None,
        loc_place: None,
        last_opt_time: ts,
        create_time: None,
        name: name.to_string(),
        avatar: None,
        user_state_id: None,
        login_uid: UID.to_string(),
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

fn member_ids(resp: &CursorPageResp<Vec<im_room_member::Model>>) -> Vec<String> {
    resp.list
        .as_ref()
        .expect("分页结果应包含 list")
        .iter()
        .map(|m| m.id.clone())
        .collect()
}

#[tokio::test]
async fn test_room_member_batch_replaces_by_room() {
    let db = setup_db().await;
    let room_id: i64 = 100;
    let room_str = room_id.to_string();

    room_repo::save_room_member_batch(
        &db,
        vec![
            build_member("m1", None, "@a:x", "Alice", 1000),
            build_member("m2", None, "@b:x", "Bob", 2000),
        ],
        room_id,
        UID,
    )
    .await
    .expect("首次批量保存成员失败");

    let members = room_repo::get_room_members_by_room_id(&room_str, &db, UID)
        .await
        .unwrap();
    assert_eq!(members.len(), 2);
    assert!(
        members
            .iter()
            .all(|m| m.room_id.as_deref() == Some(room_str.as_str())),
        "批量保存应回填 room_id"
    );

    // 再次保存应整体替换该房间成员
    room_repo::save_room_member_batch(
        &db,
        vec![build_member("m3", None, "@c:x", "Carol", 3000)],
        room_id,
        UID,
    )
    .await
    .expect("二次批量保存成员失败");

    let members = room_repo::get_room_members_by_room_id(&room_str, &db, UID)
        .await
        .unwrap();
    assert_eq!(members.len(), 1, "批量保存应整体替换该房间成员");
    assert_eq!(members[0].id, "m3");
}

#[tokio::test]
async fn test_update_my_room_info_creates_then_updates() {
    let db = setup_db().await;
    let room = "!room:x";
    let uid = "@me:x";

    // 无记录时应创建
    room_repo::update_my_room_info(&db, "My Name", room, uid, UID)
        .await
        .expect("创建我的成员信息失败");
    let created = room_repo::get_room_members_by_room_id(room, &db, UID)
        .await
        .unwrap();
    assert_eq!(created.len(), 1);
    assert_eq!(created[0].my_name.as_deref(), Some("My Name"));
    assert_eq!(created[0].id, format!("{room}_{uid}"));

    // 已有记录时应更新 my_name 而非新增
    room_repo::update_my_room_info(&db, "Renamed", room, uid, UID)
        .await
        .expect("更新我的成员信息失败");
    let updated = room_repo::get_room_members_by_room_id(room, &db, UID)
        .await
        .unwrap();
    assert_eq!(updated.len(), 1, "更新不应产生重复行");
    assert_eq!(updated[0].my_name.as_deref(), Some("Renamed"));
}

#[tokio::test]
async fn test_cursor_page_room_members_orders_desc_and_paginates() {
    let db = setup_db().await;
    let room = "!room:x";

    // last_opt_time 升序插入；查询应按降序返回
    for (i, ts) in [1000i64, 2000, 3000, 4000, 5000].iter().enumerate() {
        im_room_member::Entity::insert(im_room_member::ActiveModel {
            id: Set(format!("m{i}")),
            room_id: Set(Some(room.to_string())),
            uid: Set(Some("@u:x".to_string())),
            name: Set(format!("U{i}")),
            last_opt_time: Set(*ts),
            login_uid: Set(UID.to_string()),
            ..Default::default()
        })
        .exec(&db)
        .await
        .expect("预置房间成员失败");
    }

    let page1 = room_repo::cursor_page_room_members(&db, room.to_string(), page_param(2, ""), UID)
        .await
        .expect("第一页查询失败");
    assert_eq!(page1.total, 5);
    assert!(!page1.is_last);
    assert_eq!(member_ids(&page1), vec!["m4", "m3"]);
    assert_eq!(page1.cursor, "4000");

    let page2 = room_repo::cursor_page_room_members(
        &db,
        room.to_string(),
        page_param(2, &page1.cursor),
        UID,
    )
    .await
    .expect("第二页查询失败");
    assert!(!page2.is_last);
    assert_eq!(member_ids(&page2), vec!["m2", "m1"]);
    assert_eq!(page2.cursor, "2000");

    let page3 = room_repo::cursor_page_room_members(
        &db,
        room.to_string(),
        page_param(2, &page2.cursor),
        UID,
    )
    .await
    .expect("第三页查询失败");
    assert!(page3.is_last, "最后一页 is_last 应为 true");
    assert_eq!(member_ids(&page3), vec!["m0"]);
    assert_eq!(page3.cursor, "");
}

// =================== im_room（已知漂移，复现器） ===================

/// 已知漂移复现器：`im_room` 实体声明了 `remark` 字段，但迁移未创建该列，
/// 导致任何经由 `im_room::Entity` 的读写都报 `no such column: im_room.remark`。
/// `save_room_batch` / `get_room_page` 目前在 Rust 侧无调用方；补齐迁移列后此测试应转绿。
#[tokio::test]
#[ignore = "已知 schema 漂移：im_room 实体有 remark 字段但迁移未建该列"]
async fn test_room_save_batch_and_page() {
    let db = setup_db().await;

    room_repo::save_room_batch(
        &db,
        vec![im_room::Model {
            id: "r1".to_string(),
            room_id: "!r1".to_string(),
            group_id: None,
            room_name: "Room One".to_string(),
            avatar: None,
            login_uid: UID.to_string(),
            remark: None,
        }],
        UID,
    )
    .await
    .expect("保存房间应成功");

    let page = room_repo::get_room_page(
        PageParam {
            current: 1,
            size: 10,
        },
        &db,
        UID,
    )
    .await
    .expect("分页查询房间应成功");
    assert_eq!(page.records.len(), 1);
    assert_eq!(page.total, "1");
}
