use crate::AppData;
use crate::service::user_service::UserService;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex as StdMutex};
use std::time::{Duration, Instant};
use tauri::State;
use tracing::{info, warn};

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

    // P-11：仅清内存与钥匙串会让 SQLite 里的旧 token 复活。
    // 下一次 `get_user_tokens`（内存为空）会把最后活跃用户的旧 token 回填给登录窗口，
    // 新窗口随即拿着已撤销的凭证启动并 401。这里同步清除持久化的 access/refresh token
    // 与 last-active 标记；内存 uid 为空时按 DB 里最后活跃用户在 DB 侧定位。
    let conn = state.db_conn.read().await.clone();
    let target_uid = if uid.is_empty() {
        crate::repository::im_user_repository::get_last_active_user_tokens(&conn)
            .await
            .ok()
            .flatten()
            .map(|(persisted_uid, _, _)| persisted_uid)
    } else {
        Some(uid.clone())
    };

    if let Some(target_uid) = target_uid {
        UserService::delete_secure_token(&target_uid);
        if let Err(e) =
            crate::repository::im_user_repository::clear_user_tokens(&conn, &target_uid).await
        {
            // 登出不应因清理失败而中断，但必须留下可追踪的告警。
            warn!(
                "Failed to clear persisted tokens for uid {}: {}",
                target_uid, e
            );
        }
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

/// 跨窗口 token 刷新租约的返回状态。
///
/// 每个 WebviewWindow 是独立 JS 上下文，前端内存锁无法覆盖跨窗口并发；而服务端
/// refresh 采用 CAS 轮换，重放旧 refresh token 会触发 reuse detection 并吊销该用户
/// 全部凭证（P-26：登录后数秒必然掉线）。因此由 Rust 侧做唯一仲裁者。
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenRefreshLease {
    /// owner = 由调用方执行 refresh；wait = 其他窗口正在刷新；reuse = 直接复用已轮换凭证
    status: String,
    token: Option<String>,
    refresh_token: Option<String>,
    expires_in_ms: Option<i64>,
}

struct LastTokenRefresh {
    token: String,
    refresh_token: String,
    expires_in_ms: i64,
    completed_at: Instant,
}

#[derive(Default)]
struct RefreshLeaseState {
    /// 当前 owner 的起始时间；超过 TTL 视为持有方异常退出，允许接管
    in_flight_since: Option<Instant>,
    last_success: Option<LastTokenRefresh>,
}

/// owner 持有租约的上限；超过视为窗口崩溃/请求挂死，允许其他窗口接管
const LEASE_TTL: Duration = Duration::from_secs(30);
/// 刷新成功后 60s 内其他窗口直接复用结果，不再发起 refresh
const REUSE_TTL: Duration = Duration::from_secs(60);

static TOKEN_REFRESH_STATES: LazyLock<StdMutex<HashMap<String, RefreshLeaseState>>> =
    LazyLock::new(|| StdMutex::new(HashMap::new()));

fn lock_refresh_states() -> std::sync::MutexGuard<'static, HashMap<String, RefreshLeaseState>> {
    // 锁内只做内存操作、不会 panic；即便被 poison 也应继续可用，避免刷新链路卡死
    TOKEN_REFRESH_STATES
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// 申请 token 刷新租约。
///
/// 同一 uid 同时只有一个窗口拿到 `owner`；其余窗口得到 `wait`（应轮询重试）或
/// `reuse`（直接使用 owner 刚轮换出的凭证，不再发 HTTP）。
#[tauri::command]
pub async fn begin_token_refresh(uid: String) -> Result<TokenRefreshLease, String> {
    let mut states = lock_refresh_states();
    let state = states.entry(uid.clone()).or_default();

    if let Some(last) = &state.last_success {
        if last.completed_at.elapsed() < REUSE_TTL {
            return Ok(TokenRefreshLease {
                status: "reuse".to_string(),
                token: Some(last.token.clone()),
                refresh_token: Some(last.refresh_token.clone()),
                expires_in_ms: Some(last.expires_in_ms),
            });
        }
    }

    let lease_alive = state
        .in_flight_since
        .map(|started| started.elapsed() < LEASE_TTL)
        .unwrap_or(false);
    if lease_alive {
        return Ok(TokenRefreshLease {
            status: "wait".to_string(),
            token: None,
            refresh_token: None,
            expires_in_ms: None,
        });
    }

    state.in_flight_since = Some(Instant::now());
    info!("[SESSION] token refresh lease acquired for {}", uid);
    Ok(TokenRefreshLease {
        status: "owner".to_string(),
        token: None,
        refresh_token: None,
        expires_in_ms: None,
    })
}

/// 结束刷新租约。成功时记录结果供其他窗口复用；失败时清除结果，允许下次重试。
#[tauri::command]
pub async fn finish_token_refresh(
    uid: String,
    token: Option<String>,
    refresh_token: Option<String>,
    expires_in_ms: Option<i64>,
) -> Result<(), String> {
    let mut states = lock_refresh_states();
    let state = states.entry(uid.clone()).or_default();
    state.in_flight_since = None;

    match (token, refresh_token) {
        (Some(token), Some(refresh_token)) if !token.is_empty() => {
            state.last_success = Some(LastTokenRefresh {
                token,
                refresh_token,
                expires_in_ms: expires_in_ms.unwrap_or(0),
                completed_at: Instant::now(),
            });
            info!(
                "[SESSION] token refresh lease released for {} (success)",
                uid
            );
        }
        _ => {
            state.last_success = None;
            info!(
                "[SESSION] token refresh lease released for {} (failed)",
                uid
            );
        }
    }

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
}

#[cfg(test)]
mod token_refresh_lease_tests {
    use super::*;

    /// P-26 回归锁：同一 uid 并发刷新只允许一个 owner，其余等待并复用结果。
    #[tokio::test]
    async fn concurrent_callers_are_serialized_and_reuse_result() {
        let uid = "@lease:matrix.test".to_string();

        let first = begin_token_refresh(uid.clone()).await.unwrap();
        assert_eq!(first.status, "owner");

        let second = begin_token_refresh(uid.clone()).await.unwrap();
        assert_eq!(second.status, "wait");

        finish_token_refresh(
            uid.clone(),
            Some("syt_new".to_string()),
            Some("syr_new".to_string()),
            Some(86_400_000),
        )
        .await
        .unwrap();

        let third = begin_token_refresh(uid.clone()).await.unwrap();
        assert_eq!(third.status, "reuse");
        assert_eq!(third.token.as_deref(), Some("syt_new"));
        assert_eq!(third.refresh_token.as_deref(), Some("syr_new"));
        assert_eq!(third.expires_in_ms, Some(86_400_000));
    }

    /// 刷新失败必须释放租约，否则其他窗口会一直 wait。
    #[tokio::test]
    async fn failed_refresh_releases_lease_for_next_owner() {
        let uid = "@lease_fail:matrix.test".to_string();

        assert_eq!(
            begin_token_refresh(uid.clone()).await.unwrap().status,
            "owner"
        );
        finish_token_refresh(uid.clone(), None, None, None)
            .await
            .unwrap();
        assert_eq!(
            begin_token_refresh(uid.clone()).await.unwrap().status,
            "owner"
        );
        finish_token_refresh(uid.clone(), None, None, None)
            .await
            .unwrap();
    }
}
