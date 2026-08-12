/** 聊天/消息/会话相关枚举 */

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
  /** 打开房间内消息搜索面板（ChatHeaderToolbar → ChatMain） */
  OPEN_ROOM_SEARCH = 'openRoomSearch',
  /** 阅后即焚设置变更 */
  BURN_SETTINGS_CHANGED = 'burnSettingsChanged',
  /** Widget 已创建 */
  WIDGET_CREATED = 'widgetCreated',
  /** Widget 已更新 */
  WIDGET_UPDATED = 'widgetUpdated',
  /** Widget 已删除 */
  WIDGET_DELETED = 'widgetDeleted',
  /** 置顶消息变更（pin/unpin 后刷新横幅） */
  PINNED_EVENTS_CHANGED = 'pinnedEventsChanged',
  /** 跳转到指定消息（侧栏置顶/收藏点击 → ChatMain 滚动定位） */
  NAVIGATE_TO_MESSAGE = 'navigateToMessage'
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
 * 消息发送状态
 */
export enum MessageStatusEnum {
  PENDING = 'pending',
  SENDING = 'sending',
  SUCCESS = 'success',
  FAILED = 'failed'
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

export enum MergeMessageType {
  SINGLE = 1
}

// 滚动意图管理枚举
export enum ScrollIntentEnum {
  NONE = 'none',
  INITIAL = 'initial', // 初始化或切换房间
  NEW_MESSAGE = 'new_message', // 新消息到达
  LOAD_MORE = 'load_more' // 加载更多历史消息
}

/** 触发类型枚举 */
export enum TriggerEnum {
  MENTION = '@',
  AI = '/',
  TOPIC = '#'
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
