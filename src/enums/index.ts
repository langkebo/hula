/**
 * 全局枚举文件
 * 如果枚举值需要在全局使用，那么请在此文件中定义。其他枚举值请在对应的文件中定义。
 * 定义规则：
 *  枚举名：XxxEnum
 *  枚举值：全部大写，单词间用下划线分割
 */

/** WebSocket 消息类型 */
export enum WsResponseMessageType {
  NO_INTERNET = 'noInternet',
  LOGIN_SUCCESS = 'loginSuccess',
  RECEIVE_MESSAGE = 'receiveMessage',
  ONLINE = 'online',
  TOKEN_EXPIRED = 'tokenExpired',
  INVALID_USER = 'invalidUser',
  MSG_MARK_ITEM = 'msgMarkItem',
  MSG_RECALL = 'msgRecall',
  REQUEST_NEW_FRIEND = 'requestNewFriend',
  WS_MEMBER_CHANGE = 'ws-member-change',
  GROUP_SET_ADMIN_SUCCESS = 'groupSetAdmin',
  OFFLINE = 'offline',
  REQUEST_APPROVAL_FRIEND = 'requestApprovalFriend',
  NOTIFY_EVENT = 'notifyEvent',
  USER_STATE_CHANGE = 'userStateChange',
  ROOM_INFO_CHANGE = 'roomInfoChange',
  MY_ROOM_INFO_CHANGE = 'myRoomInfoChange',
  ROOM_DISSOLUTION = 'roomDissolution',
  ROOM_GROUP_NOTICE_MSG = 'roomGroupNoticeMsg',
  ROOM_EDIT_GROUP_NOTICE_MSG = 'roomEditGroupNoticeMsg',
  VideoCallRequest = 'VideoCallRequest'
}

/** tauri原生跨窗口通信时传输的类型 */
export enum EventEnum {
  /** 窗口关闭 */
  WIN_CLOSE = 'winClose',
  /** 窗口显示 */
  /** 退出程序 */
  EXIT = 'exit',
  /** 退出账号 */
  LOGOUT = 'logout',
  /** 独立窗口 */
  ALONE = 'alone',
  /** 共享屏幕 */
  /** 锁屏 */
  LOCK_SCREEN = 'lockScreen',
  /** 多窗口 */
  MULTI_MSG = 'multiMsg'
}

/** Mitt兄弟组件通信 */
export enum MittEnum {
  /** 更新消息数量 */
  UPDATE_MSG_TOTAL = 'updateMsgTotal',
  /** 显示消息框 */
  MSG_BOX_SHOW = 'msgBoxShow',
  /** 跳到发送信息 */
  TO_SEND_MSG = 'toSendMsg',
  /** 缩小窗口 */
  SHRINK_WINDOW = 'windowShrink',
  /** 详情页面显示 */
  DETAILS_SHOW = 'detailsShow',
  /** 好友申请页面显示 */
  APPLY_SHOW = 'applyShow',
  /** 回复消息 */
  REPLY_MEG = 'replyMsg',
  /** 手动触发InfoPopover */
  INFO_POPOVER = 'infoPopover',
  /** 打开个人信息编辑窗口 */
  OPEN_EDIT_INFO = 'openEditInfo',
  /** 关闭个人信息浮窗 */
  CLOSE_INFO_SHOW = 'closeInfoShow',
  /** 打开修改群昵称弹窗 */
  OPEN_GROUP_NICKNAME_MODAL = 'openGroupNicknameModal',
  /** 左边菜单弹窗 */
  LEFT_MODAL_SHOW = 'leftModalShow',
  /** 登录窗口异地登录弹窗 */
  LOGIN_REMOTE_MODAL = 'loginRemoteModal',
  /** 触发home窗口事件 */
  HOME_WINDOW_RESIZE = 'homeWindowResize',
  /** @ AT */
  AT = 'at',
  /** 重新编辑 */
  RE_EDIT = 'reEdit',
  /** 删除会话 */
  DELETE_SESSION = 'deleteSession',
  /** 隐藏会话 */
  HIDE_SESSION = 'hideSession',
  /** 定位会话 */
  LOCATE_SESSION = 'locateSession',
  /** 聊天框滚动到底部 */
  CHAT_SCROLL_BOTTOM = 'chatScrollBottom',
  /** 更新提示 */
  CHECK_UPDATE = 'checkUpdate',
  /** 强制更新 */
  DO_UPDATE = 'doUpdate',
  /** 视频下载状态更新 */
  VIDEO_DOWNLOAD_STATUS_UPDATED = 'videoDownloadStatusUpdated',
  /** 切换语言页面 */
  VOICE_RECORD_TOGGLE = 'voiceRecordToggle',
  /** 消息多选 */
  MSG_MULTI_CHOOSE = 'msgMultiChoose',
  /** 扫码事件 */
  QR_SCAN_EVENT = 'qrScanEvent',
  /** 移动端通话浮层请求 */
  MOBILE_RTC_CALL_REQUEST = 'mobileRtcCallRequest',
  /** 移动端关闭输入框面板 */
  MOBILE_CLOSE_PANEL = 'mobileClosePanel',
  /** 全局文件拖拽 */
  GLOBAL_FILES_DROP = 'globalFilesDrop',
  /** 切换会话 */
  MSG_INIT = 'msg_init',
  /** 会话切换完成*/
  SESSION_CHANGED = 'sessionChanged',
  /** 更新会话最后一条消息 */
  UPDATE_SESSION_LAST_MSG = 'updateSessionLastMsg',
  /** 打开线程 */
  OPEN_THREAD = 'openThread',
  /** AI 停止流式输出 */
  AI_STOP_STREAMING = 'ai_stop_streaming',
  /** 打开公告面板 (MW-ANNOUNCEMENT-002) */
  OPEN_ANNOUNCEMENT_PANEL = 'openAnnouncementPanel',
  ROOM_TYPING_CHANGED = 'roomTypingChanged',
  ROOM_RECEIPT_CHANGED = 'roomReceiptChanged',
  /** 打开事件举报对话框 */
  OPEN_EVENT_REPORT = 'openEventReport',
  /** 好友请求收到 */
  FRIEND_REQUEST_RECEIVED = 'friendRequestReceived',
  /** 好友请求被接受 */
  FRIEND_REQUEST_ACCEPTED = 'friendRequestAccepted',
  /** 好友被移除 */
  FRIEND_REMOVED = 'friendRemoved',
  /** 阅后即焚消息已读 */
  BURN_MESSAGE_READ = 'burnMessageRead',
  /** 阅后即焚消息已焚毁 */
  BURN_MESSAGE_BURNED = 'burnMessageBurned',
  /** 私密模式状态变更 */
  PRIVATE_MODE_CHANGED = 'privateModeChanged',
  /** 移动端请求切换私密模式（HeaderBar → ChatMain） */
  PRIVATE_MODE_TOGGLE_REQUEST = 'privateModeToggleRequest',
  /** 阅后即焚设置变更 */
  BURN_SETTINGS_CHANGED = 'burnSettingsChanged',
  /** Widget 已创建 */
  WIDGET_CREATED = 'widgetCreated',
  /** Widget 已更新 */
  WIDGET_UPDATED = 'widgetUpdated',
  /** Widget 已删除 */
  WIDGET_DELETED = 'widgetDeleted'
}

/** 主题类型 */
export enum ThemeEnum {
  /** 亮色 */
  LIGHT = 'light',
  /** 暗色 */
  DARK = 'dark',
  /** 跟随系统 */
  OS = 'os'
}

/** pinia存储的名称 */
export enum StoresEnum {
  /** 置顶 */
  ALWAYS_ON_TOP = 'alwaysOnTop',
  /** 设置 */
  SETTING = 'setting',
  /** 历史内容 */
  HISTORY = 'history',
  /** 聊天列表 */
  /** 插件列表 */
  PLUGINS = 'plugins',
  /** 侧边栏头部菜单栏 */
  MENUTOP = 'menuTop',
  /** 账号账号历史记录列表 */
  LOGIN_HISTORY = 'loginHistory',
  /** 图片查看器数据 */
  IMAGEVIEWER = 'imageViewer',
  /** 用户状态 */
  USER_STATE = 'userState',
  /** 用户 */
  USER = 'user',
  /** 群组 */
  GROUP = 'group',
  /** 公告 */
  ANNOUNCEMENT = 'announcement',
  /** 全局 */
  GLOBAL = 'global',
  SESSION = 'session',
  /** 表情 */
  EMOJI = 'emoji',
  /** 联系人 */
  CONTACTS = 'contacts',
  /** 聊天 */
  CHAT = 'chat',
  /** 消息 */
  MESSAGE = 'message',
  /** 会话未读缓存 */
  SESSION_UNREAD = 'sessionUnread',
  /** 缓存 */
  /** 视频查看器数据 */
  VIDEOVIEWER = 'videoViewer',
  /** 文件下载管理 */
  FILE_DOWNLOAD = 'fileDownload',
  /** 移动端状态 */
  MOBILE = 'mobile',
  /** 目录扫描器 */
  SCANNER = 'scanner',
  /** 引导状态 */
  GUIDE = 'guide',
  /** Bot 视图状态 */
  BOT = 'bot',
  /** 文件管理 */
  FILE = 'file',
  /** 缩略图缓存 */
  THUMBNAIL_CACHE = 'thumbnailCache',
  /** 初始化同步状态 */
  INITIAL_SYNC = 'initialSync',
  /** Matrix 客户端 */
  MATRIX = 'matrix',
  /** 房间 */
  ROOM = 'room',
  /** 用户菜单 */
  USER_MENU = 'userMenu',
  /** 设置对话框 */
  SETTINGS_DIALOG = 'settingsDialog',
  /** 全局搜索 */
  SPOTLIGHT = 'spotlight',
  /** 线程 */
  /** 空间 */
  /** 通话 */
  /** Widget */
  /** 徽章 */
  BADGE = 'badge',
  /** 配额 */
  QUOTA = 'quota',
  /** 内容审核 */
  MODERATION = 'moderation',
  /** 服务端能力探测 */
  CAPABILITY = 'capability',
  /** 消息多选 */
  /** 加密状态 */
  ENCRYPTION = 'encryption'
}

/**
 * 消息类型
 * Matrix 消息类型映射
 */
export enum MsgEnum {
  /** 未知 0*/
  UNKNOWN,
  /** 文本 1 - m.text */
  TEXT,
  /** 撤回 2 - m.room.redaction */
  RECALL,
  /** 图片 3 - m.image */
  IMAGE,
  /** 文件 4 - m.file */
  FILE,
  /** 语音 5 - m.audio */
  VOICE,
  /** 视频 6 - m.video */
  VIDEO,
  /** 表情包 7 - 自定义表情 */
  EMOJI,
  /** 系统消息 8 - m.room.member 等 */
  SYSTEM,
  /** 聊天记录 9 - 合并消息 */
  MERGE,
  /** 位置 10 - m.location */
  LOCATION,
  /** 音频通话 11 */
  AUDIO_CALL,
  /** 视频通话 12 */
  VIDEO_CALL,
  /** 公告 13 */
  NOTICE,
  /** Bot 消息 14 */
  BOT,
  /** 链接预览 15 - org.matrix.msc2788.room.message */
  LINK_PREVIEW,
  /** 位置信标 16 - m.beacon_info / m.beacon */
  BEACON,
  /** 混合消息 */
  MIXED,
  /** 艾特 16 */
  AIT,
  /** 回复 17 */
  REPLY,
  /** AI 18 */
  AI,
  /** 音频 19 */
  AUDIO
}

/**
 * AI 消息内容类型枚举
 * 用于标识 AI 生成的消息内容类型（文本、图片、视频、音频）
 */
export enum AiMsgContentTypeEnum {
  /** 文本 1 */
  TEXT = 1,
  /** 图片 2 */
  IMAGE = 2,
  /** 视频 3 */
  VIDEO = 3,
  /** 音频 4 */
  AUDIO = 4
}

/**
 * 在线状态
 */
export enum OnlineEnum {
  /** 在线 */
  ONLINE = 1,
  /** 离线 */
  OFFLINE
}

/**
 * 操作类型
 */
export enum ActEnum {
  /** 确认 */
  Confirm = 1,
  /** 取消 */
  Cancel
}

/** 性别 */
export enum SexEnum {
  /** 男 */
  MAN = 1,
  /** 女 */
  REMALE
}

/** 权限状态 */
export enum PowerEnum {
  /** 用户 */
  /** 管理员 */
  ADMIN
}

/** 是否状态 */
export enum IsYesEnum {
  /** 否 */
  NO,
  /** 是 */
  YES
}

export enum MarkEnum {
  /** 点赞 */
  LIKE = 1,
  /** 不满 */
  DISLIKE,
  /** 爱心 */
  HEART,
  /** 愤怒 */
  ANGRY,
  /** 礼炮 */
  CELEBRATE,
  /** 火箭 */
  ROCKET,
  /** 笑哭 */
  LOL,
  /** 鼓掌 */
  APPLAUSE,
  /** 鲜花 */
  FLOWER,
  /** 炸弹 */
  BOMB,
  /** 疑问 */
  CONFUSED,
  /** 胜利 */
  VICTORY,
  /** 灯光 */
  LIGHT,
  /** 红包 */
  MONEY
}

// 成员角色 1群主 2管理员 3普通成员 4踢出群聊
export enum RoleEnum {
  /** 1群主 */
  LORD = 1,
  /** 2管理员 */
  ADMIN,
  /** 3普通成员 */
  NORMAL
  /** 4踢出群聊 */
}

/** 房间类型 1群聊 2单聊 3空间 */
export enum RoomTypeEnum {
  /** 1群聊 */
  GROUP = 1,
  /** 2单聊 */
  SINGLE = 2,
  /** 3空间 */
  SPACE = 3
}

/** 房间操作 */
export enum RoomActEnum {
  /** 退出群聊 */
  EXIT_GROUP,
  /** 解散群聊 */
  DISSOLUTION_GROUP,
  /** 删除好友 */
  DELETE_FRIEND,
  /** 删除记录 */
  DELETE_RECORD,
  /** 屏蔽好友 */
  BLOCK_FRIEND,
  /** 修改群名称 */
  UPDATE_GROUP_NAME,
  /** 修改群信息 */
  UPDATE_GROUP_INFO
}

/** 变更类型 1 加入群组，2： 移除群组 */
export enum ChangeTypeEnum {
  /** 1 加入群组 */
  JOIN = 1,
  /** 2 移除群组 */
  REMOVE,
  /** 3 退出群组 */
  EXIT_GROUP
}

/** 关闭窗口的行为 */
export enum CloseBxEnum {
  /** 隐藏 */
  HIDE = 'hide',
  /** 关闭 */
  CLOSE = 'close'
}

/** 限制上传 */
export enum LimitEnum {
  /** 通用限制数量 */
  COM_COUNT = 5
}

/** 左边菜单弹出框类型 */
export enum ModalEnum {
  /** 锁屏弹窗 */
  LOCK_SCREEN,
  /** 检查更新弹窗 */
  CHECK_UPDATE
}

/** MacOS键盘映射 */
export enum MacOsKeyEnum {
  '⌘' = '⌘',
  '⇧' = '⇧'
}

/** Windows键盘映射 */
export enum WinKeyEnum {
  CTRL = 'Ctrl',
  SHIFT = 'Shift'
}

/** 插件状态 */
export enum PluginEnum {
  /** 已内置 */
  BUILTIN,
  /** 已安装 */
  INSTALLED,
  /** 下载中 */
  DOWNLOADING,
  /** 未安装 */
  NOT_INSTALLED,
  /** 卸载中 */
  UNINSTALLING,
  /** 可更新 */
  CAN_UPDATE
}

/** 菜单显示模式 */
export enum ShowModeEnum {
  /** 图标方式 */
  ICON,
  /** 文字方式 */
  TEXT
}

/**
 * 消息发送状态
 */
export enum MessageStatusEnum {
  PENDING = 'pending',
  SENDING = 'sending',
  SUCCESS = 'success',
  FAILED = 'failed'
}

/** 触发类型枚举 */
export enum TriggerEnum {
  MENTION = '@',
  AI = '/',
  TOPIC = '#'
}

/** 上传scene值状态 */
export enum UploadSceneEnum {
  /** 聊天 */
  CHAT = 'chat',
  /** 表情 */
  EMOJI = 'emoji',
  /** 头像 */
  AVATAR = 'avatar'
}

/** 移动端面板状态枚举 */
export enum MobilePanelStateEnum {
  /** 无面板 */
  NONE = 'none',
  /** 表情面板 */
  EMOJI = 'emoji',
  /** 语音面板 */
  VOICE = 'voice',
  /** 更多面板 */
  MORE = 'more',
  /** 输入框聚焦 */
  FOCUS = 'focus'
}

/** 会话操作 */
export enum SessionOperateEnum {
  /** 删除好友 */
  DELETE_FRIEND = 0,
  /** 解散群聊 */
  DISSOLUTION_GROUP = 1,
  /** 退出群聊 */
  EXIT_GROUP = 2 | 3
}

/**
 * 通知类型 0 -> 允许接受消息 1 -> 接收但不提醒[免打扰] 2 -> 屏蔽消息
 */
export enum NotificationTypeEnum {
  /** 允许接受消息 */
  RECEPTION = 0,
  /** 接收但不提醒[免打扰] */
  NOT_DISTURB = 1
}

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
  /** 检查管理员状态 */
  CHECK_ADMIN_STATUS = 'check_admin_status'
}

// 通话状态枚举
export enum RTCCallStatus {
  CALLING = 1, // 呼叫
  ACCEPT = 2, // 接听
  END = 3, // 结束
  REJECT = 4, // 拒绝
  ERROR = 5, // 错误中断
  BUSY = 6, // 忙线中
  CANCEL = 7 // 取消
}

// 通话类型枚举
export enum CallTypeEnum {
  AUDIO = 1, // 语音通话
  VIDEO = 2 // 视频通话
}

// 滚动意图管理枚举
export enum ScrollIntentEnum {
  NONE = 'none',
  INITIAL = 'initial', // 初始化或切换房间
  NEW_MESSAGE = 'new_message', // 新消息到达
  LOAD_MORE = 'load_more' // 加载更多历史消息
}

export enum MergeMessageType {
  SINGLE = 1
}

// 用户类型
export enum UserType {
  BOT = 'bot'
}
