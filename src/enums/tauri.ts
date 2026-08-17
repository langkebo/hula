/** Tauri 命令相关枚举 */

/** Tauri 命令 */
export enum TauriCommand {
  /** 更新我的群聊信息 */
  /** 列出所有会话列表 */
  /** 分页查询会话消息 */
  /** 保存用户信息 */
  SAVE_USER_INFO = 'save_user_info',
  /** 更新用户最后操作时间 */
  /** 发送消息 */
  /** 保存消息 */
  SAVE_MSG = 'save_msg',
  /** 保存消息标记 */
  /** 删除单条聊天消息 */
  DELETE_MESSAGE = 'delete_message',
  /** 删除房间内的所有聊天记录 */
  /** 更新消息撤回状态 */
  /** 获取用户 tokens */
  GET_USER_TOKENS = 'get_user_tokens',
  /** 更新 token */
  UPDATE_TOKEN = 'update_token',
  /** 移除 token */
  REMOVE_TOKENS = 'remove_tokens',
  /** 查询聊天历史记录 */
  QUERY_CHAT_HISTORY = 'query_chat_history',
  /** AI 消息流式发送 */
  /** 生成 MinIO 预签名 URL */
  /** 通过 Rust 端 PUT 上传本地文件 */
  UPLOAD_FILE_PUT = 'upload_file_put',
  /** 将任意绝对路径文件复制到应用作用域目录（供拖拽上传规避 fs scope 收窄） */
  COPY_FILE_TO_APP_SCOPE = 'copy_file_to_app_scope',
  /** 检查管理员状态 */
  CHECK_ADMIN_STATUS = 'check_admin_status'
}
