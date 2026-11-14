use crate::AppData;
use crate::service::user_service::UserService;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveUserInfoRequest {
    uid: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTokenRequest {
    token: String,
    refresh_token: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    uid: Option<String>,
    token: Option<String>,
    refresh_token: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserTokenRequest {
    uid: String,
    token: String,
    refresh_token: Option<String>,
}

#[tauri::command]
pub async fn save_user_info(
    user_info: SaveUserInfoRequest,
    state: State<'_, AppData>,
) -> Result<(), String> {
    // 克隆连接后立即释放读锁，避免写库期间阻塞账号切换。
    let db = state.db_conn.read().await.clone();
    UserService::save_user_info(&db, &user_info.uid)
        .await
        .map_err(|e| format!("Failed to save user info: {}", e))
}

#[tauri::command]
pub async fn update_user_last_opt_time(state: State<'_, AppData>) -> Result<(), String> {
    info!("Updating user last operation time");
    // 克隆连接后立即释放读锁，避免写库期间阻塞账号切换。
    let db = state.db_conn.read().await.clone();
    let uid = state.user_info.lock().await.uid.clone();
    UserService::update_last_opt_time(&db, &uid)
        .await
        .map_err(|e| format!("Failed to update user last opt time: {}", e))
}

#[tauri::command]
pub async fn get_user_tokens(state: State<'_, AppData>) -> Result<TokenResponse, String> {
    info!("Getting user token info");

    // D2-R：内存态为空时从 DB 兜底回填。
    //
    // 冷启动有两处竞态会让「启动时回填」失效：
    //   ① 前端 `ensureAppStateReady()` 最多等 10s 就放行，而 Android 上
    //      `initialize_app_data`（含迁移 + 回填）实测约 20s；
    //   ② `app-state-ready` 事件可能在监听注册前就已发出（一次性事件丢失）。
    // 该命令只在 `AppData` 被 manage 之后才可调用，此时 DB 一定可用，
    // 因此这里按当前用户兜底读一次，彻底消除对「启动时序」的依赖。
    if state.user_info.lock().await.token.is_empty() {
        let restored = {
            let conn = state.db_conn.read().await;
            crate::repository::im_user_repository::get_last_active_user_tokens(&*conn)
                .await
                .ok()
                .flatten()
        };
        if let Some((uid, token, refresh_token)) = restored {
            let mut user_info = state.user_info.lock().await;
            user_info.uid = uid;
            user_info.token = token;
            user_info.refresh_token = refresh_token;
            info!("[SESSION] get_user_tokens: memory was empty, rehydrated from DB");
        } else {
            info!("[SESSION] get_user_tokens: memory empty and DB has no persisted session");
        }
    }

    let user_info = state.user_info.lock().await;

    let response = TokenResponse {
        uid: if user_info.uid.is_empty() {
            None
        } else {
            Some(user_info.uid.clone())
        },
        token: if user_info.token.is_empty() {
            None
        } else {
            Some(user_info.token.clone())
        },
        refresh_token: if user_info.refresh_token.is_empty() {
            None
        } else {
            Some(user_info.refresh_token.clone())
        },
    };

    let token_len = response
        .token
        .as_ref()
        .map(|token| token.len())
        .unwrap_or(0);
    let refresh_token_len = response
        .refresh_token
        .as_ref()
        .map(|token| token.len())
        .unwrap_or(0);
    info!(
        "Successfully retrieved user token info: uid_present={}, uid={:?}, token_present={}, token_len={}, refresh_token_present={}, refresh_token_len={}",
        response.uid.is_some(),
        response.uid,
        response.token.is_some(),
        token_len,
        response.refresh_token.is_some(),
        refresh_token_len
    );
    Ok(response)
}

#[tauri::command]
pub async fn remove_tokens(state: State<'_, AppData>) -> Result<(), String> {
    info!("Removing user token info");

    let uid = {
        let mut user_info = state.user_info.lock().await;
        let uid = user_info.uid.clone();
        user_info.token.clear();
        user_info.refresh_token.clear();
        uid
    };

    if !uid.is_empty() {
        UserService::delete_secure_token(&uid);
    }

    info!("Successfully removed user token info for uid: {}", uid);
    Ok(())
}

#[tauri::command]
pub async fn update_token(
    req: UpdateUserTokenRequest,
    state: State<'_, AppData>,
) -> Result<(), String> {
    info!("Updating user token");
    let requested_refresh = req.refresh_token.unwrap_or_default();
    let refresh_token = if requested_refresh.is_empty() {
        let current_refresh = state.user_info.lock().await.refresh_token.clone();
        if current_refresh.is_empty() {
            "".to_string()
        } else {
            current_refresh
        }
    } else {
        requested_refresh
    };
    {
        let mut user_info = state.user_info.lock().await;
        user_info.uid = req.uid.clone();
        user_info.token = req.token.clone();
        user_info.refresh_token = refresh_token.clone();
    }
    UserService::save_tokens(
        &*state.db_conn.read().await,
        &req.uid,
        &req.token,
        &refresh_token,
    )
    .await
    .map_err(|e| e.to_string())?;

    UserService::store_token_in_secure_storage(&req.uid, &req.token);

    Ok(())
}
