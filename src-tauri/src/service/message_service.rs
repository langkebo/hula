use crate::error::CommonError;
use crate::pojo::common::{CursorPageParam, CursorPageResp};
use crate::repository::im_message_repository::{self, MessageWithThumbnail};
use sea_orm::{DatabaseConnection, TransactionTrait};
use std::future::Future;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tracing::{error, warn};

const WRITE_RETRY_LIMIT: usize = 3;
const WRITE_RETRY_DELAY_MS: u64 = 80;

pub async fn run_with_write_lock<T, F, Fut>(
    lock: Arc<Mutex<()>>,
    op_name: &str,
    mut operation: F,
) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, CommonError>>,
{
    let mut attempt: usize = 0;
    loop {
        let guard = lock.lock().await;
        let result = operation().await;
        drop(guard);

        match result {
            Ok(val) => return Ok(val),
            Err(err) => {
                let err_msg = err.to_string();
                let lowered = err_msg.to_lowercase();
                let is_locked =
                    lowered.contains("database is locked") || lowered.contains("database is busy");

                if is_locked && attempt + 1 < WRITE_RETRY_LIMIT {
                    let delay = WRITE_RETRY_DELAY_MS * (attempt as u64 + 1);
                    warn!(
                        target: "tauri_db",
                        "[{}] database locked (attempt {}), retrying in {}ms",
                        op_name,
                        attempt + 1,
                        delay
                    );
                    attempt += 1;
                    sleep(Duration::from_millis(delay)).await;
                    continue;
                }

                error!(target: "tauri_db", "[{}] database write failed: {}", op_name, err_msg);
                return Err(err_msg);
            }
        }
    }
}

pub struct MessageService;

impl MessageService {
    pub async fn page_messages(
        db: &DatabaseConnection,
        room_id: String,
        cursor_page_param: CursorPageParam,
        login_uid: &str,
    ) -> Result<CursorPageResp<Vec<MessageWithThumbnail>>, CommonError> {
        im_message_repository::cursor_page_messages(db, room_id, cursor_page_param, login_uid).await
    }

    pub async fn save_message_in_tx(
        tx: &sea_orm::DatabaseTransaction,
        record: MessageWithThumbnail,
    ) -> Result<MessageWithThumbnail, CommonError> {
        im_message_repository::save_message(tx, record).await
    }

    pub async fn send_message_with_lock(
        write_lock: Arc<Mutex<()>>,
        db_conn: Arc<tokio::sync::RwLock<DatabaseConnection>>,
        record: MessageWithThumbnail,
    ) -> Result<MessageWithThumbnail, String> {
        run_with_write_lock(write_lock, "send_msg", || {
            let db_conn = db_conn.clone();
            let mut record = record.clone();
            async move {
                let db = db_conn.read().await;
                let tx = db.begin().await.map_err(CommonError::DatabaseError)?;
                record = im_message_repository::save_message(&tx, record).await?;
                tx.commit().await.map_err(CommonError::DatabaseError)?;
                Ok(record)
            }
        })
        .await
    }

    pub async fn update_message_status(
        db: &DatabaseConnection,
        record: MessageWithThumbnail,
        status: &str,
        id: Option<String>,
        login_uid: String,
    ) -> Result<MessageWithThumbnail, CommonError> {
        im_message_repository::update_message_status(db, record, status, id, login_uid).await
    }

    pub async fn update_message_recall_status(
        db: &DatabaseConnection,
        message_id: &str,
        message_type: u8,
        message_body: &str,
        login_uid: &str,
    ) -> Result<(), CommonError> {
        im_message_repository::update_message_recall_status(
            db,
            message_id,
            message_type,
            message_body,
            login_uid,
        )
        .await
    }

    pub async fn delete_message(
        db: &DatabaseConnection,
        message_id: &str,
        login_uid: &str,
    ) -> Result<Option<String>, CommonError> {
        let room_id =
            im_message_repository::get_room_id_by_message_id(db, message_id, login_uid).await?;
        let resolved =
            room_id.ok_or_else(|| CommonError::RequestError("Message not found".to_string()))?;

        im_message_repository::delete_message_by_id(db, message_id, login_uid).await?;
        im_message_repository::record_deleted_message(db, message_id, &resolved, login_uid).await?;
        Ok(Some(resolved))
    }

    pub async fn delete_room_messages(
        db: &DatabaseConnection,
        room_id: &str,
        login_uid: &str,
    ) -> Result<u64, CommonError> {
        let last_msg_id =
            im_message_repository::get_room_max_message_id(db, room_id, login_uid).await?;
        let affected =
            im_message_repository::delete_messages_by_room(db, room_id, login_uid).await?;
        im_message_repository::record_room_clear(db, room_id, login_uid, last_msg_id).await?;
        Ok(affected)
    }
}
