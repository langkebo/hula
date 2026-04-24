use crate::AppData;
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SseStreamEvent {
    pub event_type: String,
    pub data: Option<String>,
    pub error: Option<String>,
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub use_context: Option<bool>,
    pub reasoning_enabled: Option<bool>,
}

#[tauri::command]
pub async fn ai_message_cancel_stream(
    state: State<'_, AppData>,
    request_id: String,
) -> Result<(), String> {
    info!("尝试取消 AI 流式任务: {}", request_id);
    let mut tasks = state.stream_tasks.lock().await;
    if let Some(handle) = tasks.remove(&request_id) {
        handle.abort();
        info!("AI 流式任务已取消: {}", request_id);
        return Ok(());
    }
    Err(format!("未找到指定请求ID的任务: {}", request_id))
}
