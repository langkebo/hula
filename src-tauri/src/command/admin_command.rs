use serde::{Deserialize, Serialize};
use tauri::State;

use crate::AppData;

#[derive(Debug, Serialize, Deserialize)]
pub struct AdminCheckResult {
    pub is_admin: bool,
    pub user_id: String,
}

#[tauri::command]
pub async fn check_admin_status(
    user_id: String,
    access_token: String,
    homeserver_url: Option<String>,
    state: State<'_, AppData>,
) -> Result<AdminCheckResult, String> {
    if user_id.is_empty() || access_token.is_empty() {
        return Err("用户未登录".to_string());
    }

    let config = state.config.read().await;
    let homeserver = homeserver_url
        .filter(|url| !url.trim().is_empty())
        .unwrap_or_else(|| config.backend.base_url.clone());
    drop(config);

    let is_admin = verify_admin_via_matrix(&homeserver, &user_id, &access_token).await?;

    tracing::info!("管理员状态检查: userId={}, isAdmin={}", user_id, is_admin);

    Ok(AdminCheckResult { is_admin, user_id })
}

async fn verify_admin_via_matrix(
    homeserver: &str,
    user_id: &str,
    access_token: &str,
) -> Result<bool, String> {
    let client = reqwest::Client::new();

    let url = format!(
        "{}/_synapse/admin/v1/users/{}",
        homeserver,
        urlencoding::encode(user_id)
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await
        .map_err(|e| format!("请求管理员验证失败: {}", e))?;

    if response.status() == reqwest::StatusCode::FORBIDDEN {
        tracing::warn!("管理员验证被拒绝: userId={}", user_id);
        return Ok(false);
    }

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        tracing::warn!("管理员验证未授权: userId={}", user_id);
        return Ok(false);
    }

    if !response.status().is_success() {
        tracing::warn!(
            "管理员验证请求失败: status={}, userId={}",
            response.status(),
            user_id
        );
        return Ok(false);
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析管理员验证响应失败: {}", e))?;

    let is_admin = body.get("admin").and_then(|v| v.as_bool()).unwrap_or(false);

    Ok(is_admin)
}
