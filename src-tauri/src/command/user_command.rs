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

/// 判断本次上报的凭证是否与内存态完全一致（一致则无需重复落盘）。
///
/// B4：一次密码登录会走两遍持久化（SessionLoginService 一次 + matrix store 的
/// persistNativeTokens 一次），冷启动恢复也会把同一 token 写回；每遍都要 SQLite 加密
/// update + 系统钥匙串写入。内存态本身就是 `get_user_tokens` 的数据源，因此「与内存态
/// 完全一致」即可安全跳过写库。内存态为空（首装 / 登出后）时始终落盘。
fn is_same_credentials(
    current: &crate::UserInfo,
    uid: &str,
    token: &str,
    refresh_token: &str,
) -> bool {
    !current.uid.is_empty()
        && current.uid == uid
        && current.token == token
        && current.refresh_token == refresh_token
}

#[tauri::command]
pub async fn update_token(
    req: UpdateUserTokenRequest,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let requested_refresh = req.refresh_token.unwrap_or_default();
    let mut user_info = state.user_info.lock().await;
    let refresh_token = if requested_refresh.is_empty() {
        if user_info.refresh_token.is_empty() {
            "".to_string()
        } else {
            user_info.refresh_token.clone()
        }
    } else {
        requested_refresh
    };

    if is_same_credentials(&user_info, &req.uid, &req.token, &refresh_token) {
        tracing::debug!(
            "[SESSION] update_token: credentials unchanged for {}, skip persistence",
            req.uid
        );
        return Ok(());
    }

    info!("Updating user token for {}", req.uid);
    user_info.uid = req.uid.clone();
    user_info.token = req.token.clone();
    user_info.refresh_token = refresh_token.clone();
    // 先释放锁再 await DB / 钥匙串，避免长临界区阻塞 get_user_tokens
    drop(user_info);

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

#[cfg(test)]
mod token_persistence_tests {
    use super::*;

    fn user_info(uid: &str, token: &str, refresh: &str) -> crate::UserInfo {
        crate::UserInfo {
            token: token.to_string(),
            refresh_token: refresh.to_string(),
            uid: uid.to_string(),
            profile_name: String::new(),
        }
    }

    /// B4 回归锁：同一凭证被再次上报时必须判定为「无需落盘」。
    ///
    /// 实测一次密码登录会写两遍（SessionLoginService 写一次 + matrix store 的
    /// persistNativeTokens 再写一次），每次都要 SQLite 加密 update + 系统钥匙串写入。
    #[test]
    fn identical_credentials_are_treated_as_noop() {
        let current = user_info("@alice:matrix.test", "syt_abc", "syr_def");
        assert!(is_same_credentials(
            &current,
            "@alice:matrix.test",
            "syt_abc",
            "syr_def"
        ));
    }

    #[test]
    fn changed_token_or_refresh_is_not_noop() {
        let current = user_info("@alice:matrix.test", "syt_abc", "syr_def");
        assert!(!is_same_credentials(
            &current,
            "@alice:matrix.test",
            "syt_new",
            "syr_def"
        ));
        assert!(!is_same_credentials(
            &current,
            "@alice:matrix.test",
            "syt_abc",
            "syr_new"
        ));
    }

    #[test]
    fn different_uid_is_not_noop() {
        let current = user_info("@alice:matrix.test", "syt_abc", "syr_def");
        assert!(!is_same_credentials(
            &current,
            "@bob:matrix.test",
            "syt_abc",
            "syr_def"
        ));
    }

    /// 首次登录（内存态为空）必须照常落盘，不能被去重逻辑吞掉。
    #[test]
    fn empty_current_state_always_persists() {
        let current = user_info("", "", "");
        assert!(!is_same_credentials(
            &current,
            "@alice:matrix.test",
            "syt_abc",
            "syr_def"
        ));
    }
}
