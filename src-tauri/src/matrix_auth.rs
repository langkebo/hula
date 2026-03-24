use crate::AppData;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixLoginRequest {
    #[serde(rename = "type")]
    pub login_type: String,
    pub user: String,
    pub password: String,
    pub device_id: Option<String>,
    pub initial_device_display_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixLoginResponse {
    pub user_id: String,
    pub access_token: String,
    pub device_id: String,
    pub home_server: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixRegisterRequest {
    #[serde(rename = "type")]
    pub auth_type: Option<String>,
    pub session: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    #[serde(rename = "device_id")]
    pub device_id: Option<String>,
    #[serde(rename = "initial_device_display_name")]
    pub initial_device_display_name: Option<String>,
    #[serde(rename = "auth")]
    pub auth: Option<MatrixAuthData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixAuthData {
    pub session: Option<String>,
    #[serde(rename = "type")]
    pub auth_type: String,
    pub token: Option<String>,
    pub threepid_creds: Option<ThreepidCreds>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThreepidCreds {
    pub sid: String,
    pub client_secret: String,
    pub token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixRegisterResponse {
    pub user_id: String,
    pub access_token: Option<String>,
    pub device_id: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in_ms: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixEmailTokenRequest {
    pub email: String,
    #[serde(rename = "client_secret")]
    pub client_secret: String,
    #[serde(rename = "send_attempt")]
    pub send_attempt: i64,
    #[serde(rename = "next_link")]
    pub next_link: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixEmailTokenResponse {
    pub sid: String,
    #[serde(rename = "submit_url")]
    pub submit_url: Option<String>,
    #[serde(rename = "expires_in")]
    pub expires_in: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixSubmitTokenRequest {
    pub token: String,
    #[serde(rename = "client_secret")]
    pub client_secret: String,
    pub sid: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixForgetPasswordRequest {
    #[serde(rename = "type")]
    pub auth_type: String,
    pub identifier: MatrixIdentifier,
    pub password: Option<String>,
    #[serde(rename = "auth")]
    pub auth: Option<MatrixAuthData>,
    #[serde(rename = "new_password")]
    pub new_password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixIdentifier {
    #[serde(rename = "type")]
    pub identifier_type: String,
    pub user: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixCaptchaRequest {
    pub length: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixCaptchaResponse {
    pub session: String,
    pub api_path: String,
    pub mxc_url: String,
}

fn get_homeserver_url(config: &crate::configuration::Settings) -> String {
    config.backend.base_url.clone()
}

#[tauri::command]
pub async fn matrix_login(
    username: String,
    password: String,
    device_id: Option<String>,
    device_name: Option<String>,
    state: State<'_, AppData>,
) -> Result<MatrixLoginResponse, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();
    let login_req = MatrixLoginRequest {
        login_type: "m.login.password".to_string(),
        user: username,
        password,
        device_id,
        initial_device_display_name: device_name,
    };

    let url = format!("{}/_matrix/client/v3/login", homeserver);

    let resp = client
        .post(&url)
        .json(&login_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<MatrixLoginResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("登录失败 ({}): {}", status, text))
    }
}

#[tauri::command]
pub async fn matrix_register(
    username: String,
    password: String,
    session: Option<String>,
    auth_type: Option<String>,
    auth_token: Option<String>,
    state: State<'_, AppData>,
) -> Result<MatrixRegisterResponse, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();

    let mut auth_data: Option<MatrixAuthData> = None;
    if let (Some(session), Some(auth_type)) = (&session, &auth_type) {
        auth_data = Some(MatrixAuthData {
            session: Some(session.clone()),
            auth_type: auth_type.clone(),
            token: auth_token,
            threepid_creds: None,
        });
    }

    let register_req = MatrixRegisterRequest {
        auth_type: Some("m.login.dummy".to_string()),
        session,
        username: Some(username),
        password: Some(password),
        device_id: None,
        initial_device_display_name: Some("HuLa Desktop".to_string()),
        auth: auth_data,
    };

    let url = format!("{}/_matrix/client/v3/register", homeserver);

    let resp = client
        .post(&url)
        .json(&register_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<MatrixRegisterResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("注册失败 ({}): {}", status, text))
    }
}

#[tauri::command]
pub async fn matrix_request_email_token(
    email: String,
    client_secret: String,
    send_attempt: i64,
    state: State<'_, AppData>,
) -> Result<MatrixEmailTokenResponse, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();

    let token_req = MatrixEmailTokenRequest {
        email,
        client_secret,
        send_attempt,
        next_link: None,
    };

    let url = format!(
        "{}/_matrix/client/v3/register/email/requestToken",
        homeserver
    );

    let resp = client
        .post(&url)
        .json(&token_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<MatrixEmailTokenResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("请求邮箱令牌失败 ({}): {}", status, text))
    }
}

#[tauri::command]
pub async fn matrix_submit_email_token(
    token: String,
    client_secret: String,
    sid: String,
    state: State<'_, AppData>,
) -> Result<serde_json::Value, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();

    let submit_req = MatrixSubmitTokenRequest {
        token,
        client_secret,
        sid,
    };

    let url = format!(
        "{}/_matrix/client/v3/register/email/submitToken",
        homeserver
    );

    let resp = client
        .post(&url)
        .json(&submit_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("提交邮箱令牌失败 ({}): {}", status, text))
    }
}

#[tauri::command]
pub async fn matrix_get_captcha(
    state: State<'_, AppData>,
) -> Result<MatrixCaptchaResponse, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();

    let captcha_req = MatrixCaptchaRequest { length: Some(4) };

    let url = format!("{}/_matrix/client/v3/register/captcha/send", homeserver);

    let resp = client
        .post(&url)
        .json(&captcha_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<MatrixCaptchaResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("获取验证码失败 ({}): {}", status, text))
    }
}

#[tauri::command]
pub async fn matrix_forget_password(
    email: String,
    state: State<'_, AppData>,
) -> Result<serde_json::Value, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();

    let forget_req = MatrixForgetPasswordRequest {
        auth_type: "m.login.email.identity".to_string(),
        identifier: MatrixIdentifier {
            identifier_type: "m.id.email".to_string(),
            user: None,
            email: Some(email),
        },
        password: None,
        auth: None,
        new_password: None,
    };

    let url = format!("{}/_matrix/client/v3/account/password", homeserver);

    let resp = client
        .post(&url)
        .json(&forget_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("忘记密码请求失败 ({}): {}", status, text))
    }
}

#[tauri::command]
pub async fn matrix_reset_password(
    _old_password: Option<String>,
    new_password: String,
    auth_session: Option<String>,
    auth_type: Option<String>,
    auth_token: Option<String>,
    state: State<'_, AppData>,
) -> Result<serde_json::Value, String> {
    let config = state.config.lock().await;
    let homeserver = get_homeserver_url(&config);
    drop(config);

    let client = Client::new();

    let mut auth_data: Option<MatrixAuthData> = None;
    if let (Some(session), Some(auth_type)) = (&auth_session, &auth_type) {
        auth_data = Some(MatrixAuthData {
            session: Some(session.clone()),
            auth_type: auth_type.clone(),
            token: auth_token,
            threepid_creds: None,
        });
    }

    #[derive(Serialize)]
    struct ResetPasswordRequest<'a> {
        #[serde(rename = "type")]
        pub auth_type: String,
        pub password: &'a str,
        pub auth: Option<MatrixAuthData>,
    }

    let reset_req = ResetPasswordRequest {
        auth_type: "m.login.password".to_string(),
        password: &new_password,
        auth: auth_data,
    };

    let url = format!("{}/_matrix/client/v3/account/password", homeserver);

    let resp = client
        .post(&url)
        .json(&reset_req)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if resp.status().is_success() {
        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("重置密码失败 ({}): {}", status, text))
    }
}
