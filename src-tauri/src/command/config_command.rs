use crate::utils::config_loader::load_layered_config;
use tauri::{AppHandle, Manager};
use tracing::info;

#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<serde_json::Value, String> {
    info!("Config command: get_config called");

    // Load base config from resources
    let base_config = include_str!("../../resources/config.json");

    // Try to load local config from app data directory
    let local_config = match app.path().app_data_dir() {
        Ok(app_data_dir) => {
            let local_config_path = app_data_dir.join("config.local.json");
            match std::fs::read_to_string(&local_config_path) {
                Ok(content) => {
                    info!(
                        "Config command: loaded local config from {:?}",
                        local_config_path
                    );
                    Some(content)
                }
                Err(e) => {
                    info!(
                        "Config command: no local config found at {:?} ({})",
                        local_config_path, e
                    );
                    None
                }
            }
        }
        Err(e) => {
            info!("Config command: cannot access app data dir: {}", e);
            None
        }
    };

    let merged = load_layered_config(base_config, local_config.as_deref())?;
    Ok(merged)
}
