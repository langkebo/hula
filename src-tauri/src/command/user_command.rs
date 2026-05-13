use crate::AppData;
use crate::repository::im_user_repository;
use crate::utils::secure_store::SecureStore;
use chrono::Local;
use entity::im_user;
use entity::prelude::ImUserEntity;
use sea_orm::ActiveValue::Set;
use sea_orm::ColumnTrait;
use sea_orm::EntityTrait;
use sea_orm::IntoActiveModel;
use sea_orm::QueryFilter;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{debug, info, warn};

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
    let db = state.db_conn.read().await;

    let exists = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(&user_info.uid))
        .one(&*db)
        .await
        .map_err(|err| format!("Failed to query user: {}", err))?;

    if exists.is_none() {
        info!("User does not exist, preparing to insert new user");

        let user = im_user::ActiveModel {
            id: Set(user_info.uid.clone()),
            is_init: Set(true),
            ..Default::default()
        };

        im_user::Entity::insert(user)
            .exec(&*db)
            .await
            .map_err(|err| format!("Failed to insert user: {}", err))?;
    } else {
        debug!("User already exists, no need to insert");
    }
    Ok(())
}

#[tauri::command]
pub async fn update_user_last_opt_time(state: State<'_, AppData>) -> Result<(), String> {
    info!("Updating user last operation time");
    let db = state.db_conn.read().await;

    let uid = state.user_info.lock().await.uid.clone();

    let user = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(uid.clone()))
        .one(&*db)
        .await
        .map_err(|err| format!("Failed to query user: {}", err))?;

    if let Some(user) = user {
        let mut active_model = user.into_active_model();
        active_model.last_opt_time = Set(Some(Local::now().timestamp_millis()));

        ImUserEntity::update(active_model)
            .exec(&*db)
            .await
            .map_err(|err| format!("Failed to update user last operation time: {}", err))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_user_tokens(state: State<'_, AppData>) -> Result<TokenResponse, String> {
    info!("Getting user token info");

    let user_info = state.user_info.lock().await;

    let response = TokenResponse {
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
        "Successfully retrieved user token info: token_present={}, token_len={}, refresh_token_present={}, refresh_token_len={}",
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
        let secure_key = format!("matrix_token_{}", uid);
        if let Err(e) = SecureStore::delete(&secure_key) {
            warn!("Failed to delete token from secure storage: {}", e);
        }
    }

    info!("Successfully removed user token info");
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
    im_user_repository::save_user_tokens(
        &*state.db_conn.read().await,
        &req.uid,
        &req.token,
        &refresh_token,
    )
    .await
    .map_err(|e| e.to_string())?;

    let secure_key = format!("matrix_token_{}", req.uid);
    if let Err(e) = SecureStore::set(&secure_key, &req.token) {
        warn!("Failed to store token in secure storage: {}", e);
    }

    Ok(())
}
