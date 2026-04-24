use crate::AppData;
use crate::error::CommonError;
use crate::pojo::common::{CursorPageParam, CursorPageResp};
use crate::repository::im_message_repository::MessageWithThumbnail;
use crate::repository::im_message_repository;
use crate::vo::vo::ChatMessageReq;

use entity::im_message;
use sea_orm::TransactionTrait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use tauri::{State, ipc::Channel};
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tracing::{debug, error, info, warn};

const WRITE_RETRY_LIMIT: usize = 3;
const WRITE_RETRY_DELAY_MS: u64 = 80;

async fn run_with_write_lock<T, F, Fut>(
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageResp {
    pub create_id: Option<String>,
    pub create_time: Option<i64>,
    pub update_id: Option<String>,
    pub update_time: Option<i64>,
    pub from_user: FromUser,
    pub message: Message,
    pub old_msg_id: Option<String>,
    pub time_block: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FromUser {
    pub uid: String,
    pub nickname: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: Option<String>,
    pub room_id: Option<String>,
    #[serde(rename = "type")]
    pub message_type: Option<u8>,
    pub body: Option<serde_json::Value>,
    pub message_marks: Option<HashMap<String, MessageMark>>,
    pub send_time: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UrlInfo {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeMessage {
    pub content: Option<String>,
    pub created_time: Option<i64>,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMsg {
    pub id: Option<String>,
    pub uid: Option<String>,
    pub username: Option<String>,
    #[serde(rename = "type")]
    pub msg_type: Option<u8>,
    pub body: Option<Box<serde_json::Value>>,
    pub can_callback: u8,
    pub gap_count: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageMark {
    pub count: u32,
    pub user_marked: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorPageMessageParam {
    room_id: String,
    #[serde(flatten)]
    cursor_page_param: CursorPageParam,
}

#[tauri::command]
pub async fn page_msg(
    param: CursorPageMessageParam,
    state: State<'_, AppData>,
) -> Result<CursorPageResp<Vec<MessageResp>>, String> {
    let login_uid = {
        let user_info = state.user_info.lock().await;
        user_info.uid.clone()
    };

    let db_result = im_message_repository::cursor_page_messages(
        &*state.db_conn.read().await,
        param.room_id,
        param.cursor_page_param,
        &login_uid,
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut raw_list = db_result.list.unwrap_or_default();
    raw_list.sort_by(|a, b| {
        let a_time = a.message.send_time.unwrap_or(0);
        let b_time = b.message.send_time.unwrap_or(0);
        a_time.cmp(&b_time)
    });

    let mut message_resps: Vec<MessageResp> = Vec::new();
    for (index, msg) in raw_list.into_iter().enumerate() {
        let mut resp = convert_message_to_resp(msg.clone(), None);

        if index == 0 {
            resp.time_block = Some(1);
        } else if let Some(send_time) = msg.message.send_time {
            resp.time_block = im_message_repository::calculate_time_block(
                &*state.db_conn.read().await,
                &msg.message.room_id,
                &msg.message.id,
                send_time,
                &login_uid,
            )
            .await
            .map_err(|e| e.to_string())?;
        }

        message_resps.push(resp);
    }

    Ok(CursorPageResp {
        cursor: db_result.cursor,
        is_last: db_result.is_last,
        list: Some(message_resps),
        total: db_result.total,
    })
}

pub fn convert_message_to_resp(
    record: MessageWithThumbnail,
    old_msg_id: Option<String>,
) -> MessageResp {
    let MessageWithThumbnail {
        message: msg,
        thumbnail_path,
    } = record;

    let mut body = msg.body.as_ref().and_then(|body_str| {
        if body_str.trim().is_empty() {
            None
        } else {
            match serde_json::from_str(body_str) {
                Ok(parsed) => Some(parsed),
                Err(e) => {
                    debug!(
                        "Failed to parse message body JSON for message {}: {}",
                        msg.id, e
                    );
                    Some(serde_json::json!({
                        "content": body_str
                    }))
                }
            }
        }
    });

    inject_thumbnail_path(&mut body, thumbnail_path.as_deref());

    let message_marks = msg.message_marks.as_ref().and_then(|marks_str| {
        if marks_str.trim().is_empty() {
            return None;
        }

        match serde_json::from_str::<HashMap<String, MessageMark>>(marks_str) {
            Ok(parsed_marks) => {
                if parsed_marks.is_empty() {
                    None
                } else {
                    Some(parsed_marks)
                }
            }
            Err(e) => {
                debug!(
                    "Failed to parse message marks JSON for message {}: {}",
                    msg.id, e
                );
                None
            }
        }
    });

    MessageResp {
        create_id: Some(msg.id.clone()),
        create_time: msg.send_time,
        update_id: None,
        update_time: None,
        from_user: FromUser {
            uid: msg.uid,
            nickname: msg.nickname,
        },
        message: Message {
            id: Some(msg.id),
            room_id: Some(msg.room_id),
            message_type: msg.message_type,
            body,
            message_marks,
            send_time: msg.send_time,
        },
        old_msg_id: old_msg_id,
        time_block: msg.time_block,
    }
}

fn extract_thumbnail_path_from_body(body: &Option<serde_json::Value>) -> Option<String> {
    body.as_ref().and_then(|value| {
        value.as_object().and_then(|obj| {
            obj.get("thumbnailPath")
                .or_else(|| obj.get("thumbnail_path"))
                .and_then(|v| v.as_str().map(|s| s.to_string()))
        })
    })
}

fn inject_thumbnail_path(body: &mut Option<serde_json::Value>, path: Option<&str>) {
    let Some(path) = path else {
        return;
    };

    if path.is_empty() {
        return;
    }

    if let Some(val) = body {
        if let Some(map) = val.as_object_mut() {
            let exists = map
                .get("thumbnailPath")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false);
            if !exists {
                map.insert(
                    "thumbnailPath".to_string(),
                    serde_json::Value::String(path.to_string()),
                );
            }
        }
    }
}

#[tauri::command]
pub async fn send_msg(
    data: ChatMessageReq,
    state: State<'_, AppData>,
    success_channel: Channel<MessageResp>,
    error_channel: Channel<String>,
) -> Result<(), String> {
    let (login_uid, nickname) = {
        let user_info = state.user_info.lock().await;
        (user_info.uid.clone(), None)
    };

    let current_time = chrono::Utc::now().timestamp_millis();

    let body_json = data
        .body
        .as_ref()
        .and_then(|body| serde_json::to_string(body).ok());
    let thumbnail_path = extract_thumbnail_path_from_body(&data.body);

    let message_model = im_message::Model {
        id: data.id.clone(),
        uid: login_uid.clone(),
        nickname,
        room_id: data.room_id.unwrap_or_default(),
        message_type: data.msg_type,
        body: body_json,
        message_marks: None,
        send_time: Some(current_time),
        create_time: Some(current_time),
        update_time: Some(current_time),
        login_uid: login_uid.clone(),
        send_status: "pending".to_string(),
        time_block: None,
    };

    let mut message_record = MessageWithThumbnail::new(message_model, thumbnail_path);

    let write_lock = state.write_lock.clone();
    message_record = run_with_write_lock(write_lock, "send_msg", || {
        let db_conn = state.db_conn.clone();
        let mut record = message_record.clone();
        async move {
            let db = db_conn.read().await;
            let tx = db.begin().await.map_err(CommonError::DatabaseError)?;
            record = im_message_repository::save_message(&tx, record).await?;
            tx.commit().await.map_err(CommonError::DatabaseError)?;
            Ok(record)
        }
    })
    .await?;

    info!(
        "Message saved to local database, ID: {}",
        message_record.message.id.clone()
    );

    let msg_id = message_record.message.id.clone();

    let db_conn = state.db_conn.clone();
    let record_for_send = message_record.clone();

    tokio::spawn(async move {
        info!("Message send is now handled by frontend SDK. Updating local status to success.");

        let status = "success";

        let model = im_message_repository::update_message_status(
            &*db_conn.read().await,
            record_for_send,
            status,
            None,
            login_uid.clone(),
        )
        .await;

        match model {
            Ok(model) => {
                let resp = convert_message_to_resp(model, Some(msg_id));
                let _ = success_channel.send(resp);
            }
            Err(e) => {
                error!("{:?}", e);
                let _ = error_channel.send(msg_id.clone());
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn save_msg(data: MessageResp, state: State<'_, AppData>) -> Result<(), String> {
    let record = convert_resp_to_record_for_save(data, state.user_info.lock().await.uid.clone());

    let lock = state.write_lock.clone();
    run_with_write_lock(lock, "save_msg", || {
        let db_conn = state.db_conn.clone();
        let record = record.clone();
        async move {
            let db = db_conn.read().await;
            let tx = db.begin().await?;
            im_message_repository::save_message(&tx, record).await?;
            tx.commit().await?;
            Ok(())
        }
    })
    .await?;

    Ok(())
}

fn convert_resp_to_record_for_save(msg_resp: MessageResp, uid: String) -> MessageWithThumbnail {
    use serde_json;

    let body_json = msg_resp
        .message
        .body
        .as_ref()
        .and_then(|body| serde_json::to_string(body).ok());

    let marks_json = msg_resp
        .message
        .message_marks
        .as_ref()
        .and_then(|marks| serde_json::to_string(marks).ok());

    let model = im_message::Model {
        id: msg_resp.message.id.unwrap_or_default(),
        uid: msg_resp.from_user.uid,
        nickname: msg_resp.from_user.nickname,
        room_id: msg_resp.message.room_id.unwrap_or_default(),
        message_type: msg_resp.message.message_type,
        body: body_json,
        message_marks: marks_json,
        send_time: msg_resp.message.send_time,
        create_time: msg_resp.create_time,
        update_time: msg_resp.update_time,
        login_uid: uid.to_string(),
        send_status: "success".to_string(),
        time_block: msg_resp.time_block,
    };

    let thumbnail_path = extract_thumbnail_path_from_body(&msg_resp.message.body);
    MessageWithThumbnail::new(model, thumbnail_path)
}

#[tauri::command]
pub async fn update_message_recall_status(
    message_id: String,
    message_type: u8,
    message_body: String,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let login_uid = state.user_info.lock().await.uid.clone();

    im_message_repository::update_message_recall_status(
        &*state.db_conn.read().await,
        &message_id,
        message_type,
        &message_body,
        &login_uid,
    )
    .await
    .map_err(|e| {
        error!("Failed to update message recall status: {}", e);
        e.to_string()
    })?;

    Ok(())
}

#[tauri::command]
pub async fn delete_message(
    message_id: String,
    room_id: Option<String>,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let login_uid = state.user_info.lock().await.uid.clone();

    let db = state.db_conn.read().await;
    let resolved_room_id = if let Some(room) = room_id {
        room
    } else {
        im_message_repository::get_room_id_by_message_id(&*db, &message_id, &login_uid)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Message not found or room info missing".to_string())?
    };

    im_message_repository::delete_message_by_id(&*db, &message_id, &login_uid)
        .await
        .map_err(|e| {
            error!("Failed to delete message {}: {}", message_id, e);
            e.to_string()
        })?;

    im_message_repository::record_deleted_message(&*db, &message_id, &resolved_room_id, &login_uid)
        .await
        .map_err(|e| {
            error!(
                "Failed to record deletion for message {} in room {}: {}",
                message_id, resolved_room_id, e
            );
            e.to_string()
        })?;

    info!(
        "Deleted message {} for current user {} from local database",
        message_id, login_uid
    );

    Ok(())
}

#[tauri::command]
pub async fn delete_room_messages(
    room_id: String,
    state: State<'_, AppData>,
) -> Result<u64, String> {
    let login_uid = state.user_info.lock().await.uid.clone();
    let db = state.db_conn.read().await;

    let last_msg_id = im_message_repository::get_room_max_message_id(&*db, &room_id, &login_uid)
        .await
        .map_err(|e| {
            error!(
                "Failed to query last message id for room {}: {}",
                room_id, e
            );
            e.to_string()
        })?;

    let affected_rows = im_message_repository::delete_messages_by_room(&*db, &room_id, &login_uid)
        .await
        .map_err(|e| {
            error!("Failed to delete messages for room {}: {}", room_id, e);
            e.to_string()
        })?;

    im_message_repository::record_room_clear(&*db, &room_id, &login_uid, last_msg_id)
        .await
        .map_err(|e| {
            error!(
                "Failed to record room clear for room {} (user {}): {}",
                room_id, login_uid, e
            );
            e.to_string()
        })?;

    info!(
        "Deleted {} messages for room {} (user {})",
        affected_rows, room_id, login_uid
    );

    Ok(affected_rows)
}
