/** 应用/通用相关枚举 */

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
  /** 设置标签页（持久化 key 保持 settingsDialog 不变） */
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
  /** 位置 / beacon 实时共享 */
  LOCATION = 'location',
  /** 消息多选 */
  /** 加密状态 */
  ENCRYPTION = 'encryption'
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

/** 关闭窗口的行为 */
export enum CloseBxEnum {
  /** 隐藏 */
  HIDE = 'hide',
  /** 关闭 */
  CLOSE = 'close'
}

/** 左边菜单弹出框类型 */
export enum ModalEnum {
  /** 锁屏弹窗 */
  LOCK_SCREEN,
  /** 检查更新弹窗 */
  CHECK_UPDATE
}

/** 限制上传 */
export enum LimitEnum {
  /** 通用限制数量 */
  COM_COUNT = 5
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

/** 是否状态 */
export enum IsYesEnum {
  /** 否 */
  NO,
  /** 是 */
  YES
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

/** 菜单显示模式 */
export enum ShowModeEnum {
  /** 图标方式 */
  ICON,
  /** 文字方式 */
  TEXT
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
