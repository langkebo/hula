use crate::AppData;
use crate::error::CommonError;
use crate::repository::im_contact_repository::{list_contact, update_contact_hide};

use entity::im_contact;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{error, info};

#[tauri::command]
pub async fn list_contacts_command(
    state: State<'_, AppData>,
) -> Result<Vec<im_contact::Model>, String> {
    info!("Querying all conversation list:");
    let result: Result<Vec<im_contact::Model>, CommonError> = async {
        let login_uid = {
            let user_info = state.user_info.lock().await;
            user_info.uid.clone()
        };

        let local_data = list_contact(&*state.db_conn.read().await, &login_uid).await;

        if let Ok(local_contacts) = &local_data {
            if !local_contacts.is_empty() {
                info!(
                    "Returning {} contacts from local SQLite",
                    local_contacts.len()
                );
                return Ok(local_contacts.clone());
            }
        }

        info!("No local contacts found, returning empty list. Frontend SDK should handle network sync.");
        Ok(Vec::new())
    }
    .await;

    match result {
        Ok(contacts) => Ok(contacts),
        Err(e) => {
            error!("Failed to get contact list: {:?}", e);
            Err(e.to_string())
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HideContactRequest {
    room_id: String,
    hide: bool,
}

#[tauri::command]
pub async fn hide_contact_command(
    state: State<'_, AppData>,
    data: HideContactRequest,
) -> Result<(), String> {
    info!("Hide contact: room_id={}, hide={}", data.room_id, data.hide);
    let result: Result<(), CommonError> = async {
        let login_uid = {
            let user_info = state.user_info.lock().await;
            user_info.uid.clone()
        };

        update_contact_hide(
            &*state.db_conn.read().await,
            &data.room_id,
            data.hide,
            &login_uid,
        )
        .await?;
        Ok(())
    }
    .await;

    match result {
        Ok(_) => Ok(()),
        Err(e) => {
            error!("Failed to hide contact: {:?}", e);
            Err(e.to_string())
        }
    }
}
