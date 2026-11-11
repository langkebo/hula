use crate::AppData;
use crate::configuration::get_configuration;
use crate::error::CommonError;
use crate::repository::im_message_repository::reset_table_initialization_flags;
use migration::{Migrator, MigratorTrait};
use sea_orm::{ConnectionTrait, DatabaseConnection, DbBackend, Statement, TransactionTrait};
use std::path::Path;
use tauri::{AppHandle, State};
use tracing::{info, warn};

/// 切换用户数据库
/// 根据用户ID切换到对应的数据库文件，如果数据库不存在则创建
///
/// # 参数
/// * `uid` - 用户ID，用于生成用户专属的数据库文件名
/// * `state` - 应用状态
/// * `app_handle` - Tauri应用句柄
///
/// # 返回值
/// * `Ok(())` - 切换成功
/// * `Err(String)` - 切换失败时返回错误信息
#[tauri::command]
pub async fn switch_user_database(
    uid: String,
    state: State<'_, AppData>,
    app_handle: AppHandle,
) -> Result<(), String> {
    info!("Switching to user database for uid: {}", uid);

    let result: Result<(), CommonError> = async {
        // 获取配置
        let configuration = get_configuration(&app_handle)
            .map_err(|e| anyhow::anyhow!("Failed to load configuration: {}", e))?;

        // 创建新的数据库连接
        let new_db = configuration
            .database
            .connection_string(&app_handle, Some(&uid))
            .await?;

        // 执行数据库迁移。迁移失败必须向上返回：继续运行会得到一个 schema 半迁移的库，
        // 后续读写按新表结构执行时会在不可预期的地方报错（甚至静默写坏数据）。
        Migrator::up(&new_db, None)
            .await
            .map_err(|e| anyhow::anyhow!("Database migration failed for user {}: {}", uid, e))?;
        info!("Database migration completed for user: {}", uid);

        // 重置表初始化标志，确保新数据库会创建必要的表
        reset_table_initialization_flags();

        // 替换数据库连接
        {
            let mut db_guard = state.db_conn.write().await;
            *db_guard = new_db;
        }

        info!("Successfully switched to database for user: {}", uid);
        Ok(())
    }
    .await;

    result.map_err(|e| e.to_string())
}

/// 本地库里所有带 `login_uid` 维度的表。
///
/// 本地数据有**两套账号维度**：库文件按 uid 分（`db_{uid}.sqlite`），
/// 表内又用 `login_uid` 列二次过滤。因此迁库必须「换文件 + 改列」同时做，
/// 只换文件的话查询按旧 uid 过滤，等于拿到一个查不到任何行的空库。
const LOGIN_UID_TABLES: [&str; 5] = [
    "im_message",
    "im_config",
    "im_room",
    "im_contact",
    "im_room_member",
];

/// 统计 5 张表中属于 `uid` 的**总行数**。
///
/// 用「全部表求和」而不是单表探测：访客可能一条消息都没有但有联系人/房间，
/// 只看 `im_message` 会把「有数据」误判成「空库」而跳过改写。
async fn count_login_uid_rows(db: &DatabaseConnection, uid: &str) -> Result<i64, CommonError> {
    let mut total = 0i64;
    for table in LOGIN_UID_TABLES {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Sqlite,
            format!("SELECT COUNT(*) AS cnt FROM {table} WHERE login_uid = ?"),
            [uid.into()],
        );
        let Some(row) = db.query_one(stmt).await? else {
            continue;
        };
        total += row.try_get::<i64>("", "cnt").unwrap_or(0);
    }
    Ok(total)
}

/// 把 5 张表里 `login_uid = from_uid` 的行改写成 `to_uid`，返回改写行数。
///
/// 抽成独立函数（不需要 `AppHandle`）便于用内存 SQLite 直接测 SQL 部分：
/// 这是整个迁移里唯一有可能**静默改错数据**的地方（改错列/改错表 = 数据看似迁走实则失联）。
pub async fn merge_login_uid(
    db: &DatabaseConnection,
    from_uid: &str,
    to_uid: &str,
) -> Result<u64, CommonError> {
    // 5 张表必须在同一事务里改写：中途失败若不回滚，会留下「一半表指向新账号、
    // 一半仍指向旧账号」的分裂状态，而按行数的进度判定无法识别这种分裂。
    let txn = db.begin().await?;
    let mut affected = 0u64;
    for table in LOGIN_UID_TABLES {
        let stmt = Statement::from_sql_and_values(
            DbBackend::Sqlite,
            format!("UPDATE {table} SET login_uid = ? WHERE login_uid = ?"),
            [to_uid.into(), from_uid.into()],
        );
        affected += txn.execute(stmt).await?.rows_affected();
    }
    txn.commit().await?;
    Ok(affected)
}

/// 迁移的下一步动作，由「源账号行数 / 目标账号行数」决定。
///
/// 为什么用行数而不是「目标文件是否存在」：迁移可能在复制完成、改写未完成时中断，
/// 用文件存在与否判定会把这种半成品当成「已完成」，从此永久跳过改写
/// （数据看着在库里，查询按旧 uid 过滤却一行都取不到）。
#[derive(Debug, PartialEq, Eq)]
pub enum MigrationStep {
    /// 目标库里已无旧账号行、且有新账号行 ⇒ 上次已迁完，幂等重入，只需切连接
    AlreadyMerged,
    /// 目标库已有新账号自己的数据 ⇒ 放弃，避免两个账号的数据混写
    Conflict,
    /// 两边都没有行 ⇒ 源库本来就没数据（或复制失败被重建），交给调用方切库
    NothingToMigrate,
    /// 目标库只有旧账号行 ⇒ 改写 `login_uid`
    Merge,
}

/// 纯函数：根据两边行数判定下一步。
pub fn decide_migration_step(from_rows: i64, to_rows: i64) -> MigrationStep {
    if from_rows == 0 && to_rows > 0 {
        MigrationStep::AlreadyMerged
    } else if to_rows > 0 {
        MigrationStep::Conflict
    } else if from_rows == 0 {
        MigrationStep::NothingToMigrate
    } else {
        MigrationStep::Merge
    }
}

/// 把源库文件复制成目标库文件；目标已存在时**不动它**，返回是否真的复制了。
///
/// 与命令分开是为了可测 —— 文件级行为（内容一致、不覆盖已有目标、幂等）
/// 恰恰是 SQL 断言发现不了的部分。
pub fn copy_database_file(from_path: &Path, to_path: &Path) -> Result<bool, CommonError> {
    if to_path.exists() {
        return Ok(false);
    }
    std::fs::copy(from_path, to_path)
        .map_err(|e| anyhow::anyhow!("failed to copy database file: {}", e))?;
    Ok(true)
}

/// 把 `from_uid` 的本地库迁移成 `to_uid` 的本地库（访客升级为正式账号时调用）。
///
/// # 为什么需要
/// 访客升级（`/account/upgrade`）返回的是**新 MXID**，等价于换账号；而本地库按 uid 分文件，
/// 不迁移就会出现「运行期继续写访客库 → 重启后切到 newUid 的空库」，
/// 于是聊天记录窗口、文件索引、本地搜索在升级重启后**全部读不到**。
///
/// # 返回值语义
/// - `true`  = 迁移完成（或此前已完成，幂等），运行期连接已切到 `to_uid` 的库；
/// - `false` = 未迁移（无源库 / 目标库已有新账号数据），调用方应退回「直接切库」。
///
/// 迁移失败**不得**让升级失败：服务端账号已经升级成功，本地库是次要数据，
/// 因此错误只向上返回 false/Err 供调用方记录，由调用方决定降级。
///
#[tauri::command]
pub async fn migrate_user_database(
    from_uid: String,
    to_uid: String,
    state: State<'_, AppData>,
    app_handle: AppHandle,
) -> Result<bool, String> {
    info!("Migrating user database: {} -> {}", from_uid, to_uid);

    if from_uid == to_uid {
        return Ok(false);
    }

    let result: Result<bool, CommonError> = async {
        let configuration = get_configuration(&app_handle)
            .map_err(|e| anyhow::anyhow!("Failed to load configuration: {}", e))?;

        let from_path = configuration
            .database
            .user_db_path(&app_handle, Some(&from_uid))?;
        let to_path = configuration
            .database
            .user_db_path(&app_handle, Some(&to_uid))?;

        if !from_path.exists() {
            warn!(
                "source database missing, skipping migration ({:?}): new account starts from an empty database",
                from_path
            );
            return Ok(false);
        }

        // 1) 目标库不存在 ⇒ 复制一份。源库保留不删：迁移出问题它是唯一数据来源。
        if !to_path.exists() {
            // 复制前把 WAL 落盘：未 checkpoint 的最新写入不在主文件里，直接复制会缺数据
            {
                let db = state.db_conn.read().await;
                if let Err(err) = db
                    .execute_unprepared("PRAGMA wal_checkpoint(TRUNCATE)")
                    .await
                {
                    warn!("WAL checkpoint before migration failed (continuing with copy): {}", err);
                }
            }
            // 库文件可能有数 GB：同步复制会阻塞 tokio worker，放到阻塞线程池执行。
            let copy_from = from_path.clone();
            let copy_to = to_path.clone();
            let copied = tokio::task::spawn_blocking(move || copy_database_file(&copy_from, &copy_to))
                .await
                .map_err(|e| anyhow::anyhow!("database copy task join failed: {}", e))??;
            if copied {
                info!("copied local database: {:?} -> {:?}", from_path, to_path);
            }
        }

        // 2) 打开目标库（顺带执行迁移，确保表结构齐全）
        let target = configuration
            .database
            .connection_string(&app_handle, Some(&to_uid))
            .await?;

        let from_rows = count_login_uid_rows(&target, &from_uid).await?;
        let to_rows = count_login_uid_rows(&target, &to_uid).await?;

        // 3) 按行数判定进度（判定逻辑见 `decide_migration_step`，中断后可自愈）
        match decide_migration_step(from_rows, to_rows) {
            MigrationStep::AlreadyMerged => {
                info!("target database already migrated (idempotent skip): {}", to_uid);
            }
            MigrationStep::Conflict => {
                warn!(
                    "target database already contains new account data ({} rows), aborting migration to avoid mixed writes (source kept): {}",
                    to_rows,
                    to_path.display()
                );
                return Ok(false);
            }
            MigrationStep::NothingToMigrate => {
                warn!("source database has no visible data ({} rows), skipping rewrite", from_rows);
                return Ok(false);
            }
            MigrationStep::Merge => {
                let affected = merge_login_uid(&target, &from_uid, &to_uid).await?;
                info!(
                    "rewrote login_uid for {} rows to {} (source had {} rows)",
                    affected, to_uid, from_rows
                );
            }
        }

        // 4) 切换运行期连接，后续写入直接落在新库
        reset_table_initialization_flags();
        {
            let mut db_guard = state.db_conn.write().await;
            *db_guard = target;
        }

        Ok(true)
    }
    .await;

    result.map_err(|e| e.to_string())
}
