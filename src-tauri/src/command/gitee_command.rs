use serde::Serialize;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GiteeReleaseInfo {
    pub id: i64,
    pub tag_name: String,
    pub target_commitish: String,
    pub prerelease: bool,
    pub name: String,
    pub body: String,
    pub created_at: String,
}

#[tauri::command]
pub async fn fetch_gitee_release(version: String) -> Result<GiteeReleaseInfo, String> {
    let token = std::env::var("GITEE_TOKEN").unwrap_or_default();

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let mut url = format!(
        "https://gitee.com/api/v5/repos/llangkebo/hula/releases/tags/v{version}"
    );

    if !token.is_empty() {
        url = format!("{url}?access_token={token}");
    }

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Gitee API request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Gitee API returned status {}",
            response.status()
        ));
    }

    let release: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gitee response: {e}"))?;

    Ok(GiteeReleaseInfo {
        id: release["id"].as_i64().unwrap_or(0),
        tag_name: release["tag_name"].as_str().unwrap_or("").to_string(),
        target_commitish: release["target_commitish"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        prerelease: release["prerelease"].as_bool().unwrap_or(false),
        name: release["name"].as_str().unwrap_or("").to_string(),
        body: release["body"].as_str().unwrap_or("").to_string(),
        created_at: release["created_at"].as_str().unwrap_or("").to_string(),
    })
}
