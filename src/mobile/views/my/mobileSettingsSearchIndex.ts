/**
 * 移动端设置的可搜索条目。
 *
 * 桌面端有 `settingsSearchIndex`（跨 tab + 分区，带键盘导航）；移动端此前完全没有搜索，
 * 16 个一级项 + 20 个二级页只能靠滚动记忆找 —— 低频设置（如「阅后即焚倒计时」）用户会先
 * 怀疑「移动端没这个功能」。
 *
 * 设计取舍：
 * - **与桌面索引不同源**：桌面索引的键是 tab/section id，移动端是路由；硬凑一张表更容易漂移。
 *   这里以「用户所见文案」为准，`keywords` 补中英别名与常见叫法（用户常按「黑名单」找「已忽略用户」）。
 * - **内联项用 anchor**：主题/语言/字号不是独立页面，点了要滚到设置页对应分组，而不是「点了没反应」。
 * - 文案一律复用既有 i18n 键，**不新增键**（避免动 `i18n.d.ts` 与并行改动冲突）。
 */
export interface MobileSettingsSearchEntry {
  /** 条目文案键 */
  labelKey: string
  /** 所属分组文案键（结果列表里作为副标题） */
  groupKey: string
  /** 有独立页面时跳转 */
  path?: string
  /** 内联控件：滚到设置页内对应分组（值是分组容器的 DOM id） */
  anchor?: string
  /** 额外匹配词：中英别名 + 用户的常见叫法 */
  keywords: string[]
}

const DEVICES_PATH = '/mobile/mobileMy/devices'
const SETTINGS_PATH = '/mobile/mobileMy/settings'

export const MOBILE_SETTINGS_SEARCH_ENTRIES: MobileSettingsSearchEntry[] = [
  // ── 账户
  {
    labelKey: 'mobile_devices.title',
    groupKey: 'mobile_setting.account_section',
    path: DEVICES_PATH,
    keywords: ['device', 'devices', '登录', 'login', 'session', '会话', '设备', '踢下线']
  },
  {
    labelKey: 'mobile_setting.status',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/status',
    keywords: ['status', 'presence', '状态', '在线', '离开', '忙碌']
  },
  {
    labelKey: 'mobile_setting.edit_profile',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/editProfile',
    keywords: ['profile', '昵称', '头像', '简介', 'avatar', 'nickname', '资料']
  },
  {
    labelKey: 'mobile_setting.change_password',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/password',
    keywords: ['password', '密码', '改密', '口令']
  },
  {
    labelKey: 'mobile_setting.security',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/securityPrivacy',
    keywords: ['security', '安全', '隐私', 'privacy', '私密聊天']
  },
  {
    labelKey: 'mobile_security_key.manage',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/securityKey',
    keywords: ['key', '密钥', 'recovery', '恢复', '安全密钥']
  },
  {
    labelKey: 'mobile_security.ignored_users',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/ignoredUsers',
    keywords: ['ignore', '屏蔽', '黑名单', 'block', '忽略']
  },
  {
    labelKey: 'mobile_security.invite_permission',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/invitePermission',
    keywords: ['invite', '邀请', '谁能加我', '陌生人']
  },
  {
    labelKey: 'mobile_security.deactivate_account',
    groupKey: 'mobile_setting.account_section',
    path: '/mobile/mobileMy/deactivateAccount',
    keywords: ['deactivate', '注销', '删除账号', '销户']
  },

  // ── 社交
  {
    labelKey: 'mobile_setting.friend_groups',
    groupKey: 'mobile_setting.social_section',
    path: '/mobile/mobileFriends/groups',
    keywords: ['group', '分组', '好友', 'friend', '标签']
  },

  // ── 通知
  {
    labelKey: 'mobile_setting.notifications',
    groupKey: 'mobile_setting.notification_section',
    path: '/mobile/mobileMy/notifications',
    keywords: ['notification', '通知', '提醒', '声音', '震动', '关键词']
  },
  {
    labelKey: 'mobile_push.title',
    groupKey: 'mobile_setting.notification_section',
    path: '/mobile/mobileMy/pushSettings',
    keywords: ['push', '推送', '设备令牌', 'pusher']
  },

  // ── 外观（内联控件，按 anchor 滚动）
  {
    labelKey: 'mobile_setting.theme',
    groupKey: 'mobile_setting.appearance_section',
    anchor: 'settings-group-appearance',
    keywords: ['theme', '主题', '深色', '暗色', 'dark', 'light', '亮色']
  },
  {
    labelKey: 'mobile_setting.language',
    groupKey: 'mobile_setting.appearance_section',
    anchor: 'settings-group-appearance',
    keywords: ['language', '语言', '中英文', 'locale', '语言包']
  },
  {
    labelKey: 'mobile_setting.font_size',
    groupKey: 'mobile_setting.appearance_section',
    anchor: 'settings-group-appearance',
    keywords: ['font', '字号', '大小', '字体', '缩放']
  },
  {
    labelKey: 'emoticon.packs.title',
    groupKey: 'mobile_setting.appearance_section',
    path: '/mobile/mobileMy/emoticons',
    keywords: ['emoji', 'emoticon', '表情', '贴纸', 'sticker', '表情包']
  },

  // ── 隐私
  {
    labelKey: 'mobile_setting.preferences',
    groupKey: 'mobile_setting.privacy_section',
    path: '/mobile/mobileMy/preferences',
    keywords: ['preference', '偏好', '已读回执', '输入状态', '链接预览', '发送键']
  },
  {
    labelKey: 'mobile_setting.burn_after_read',
    groupKey: 'mobile_setting.privacy_section',
    path: '/mobile/mobileMy/burnAfterRead',
    keywords: ['burn', '阅后即焚', '焚毁', '倒计时', '自动删除']
  },

  // ── 帮助
  {
    labelKey: 'mobile_setting.help_feedback',
    groupKey: 'mobile_setting.help_section',
    path: '/mobile/mobileMy/helpAbout',
    keywords: ['help', '帮助', '反馈', 'about', '关于', '版本', '更新']
  },

  // ── 高级
  {
    labelKey: 'setting.encryption.title',
    groupKey: 'mobile_setting.advanced_section',
    path: '/mobile/encryption',
    keywords: ['encryption', '加密', 'e2ee', '密钥备份', '交叉签名', '设备验证', '脱水设备']
  },
  {
    labelKey: 'mobile_setting.voice_video',
    groupKey: 'mobile_setting.advanced_section',
    path: '/mobile/mobileMy/voiceVideo',
    keywords: ['voice', 'video', '语音', '视频', '通话', '麦克风', '摄像头']
  },
  {
    labelKey: 'mobile_setting.storage',
    groupKey: 'mobile_setting.advanced_section',
    path: '/mobile/mobileMy/storage',
    keywords: ['storage', '存储', '缓存', '空间', 'quota', '配额']
  },
  {
    labelKey: 'mobile_setting.labs',
    groupKey: 'mobile_setting.advanced_section',
    path: '/mobile/mobileMy/labs',
    keywords: ['labs', '实验', '内测', 'beta', '新功能']
  },
  {
    labelKey: 'mobile_setting.integrations',
    groupKey: 'mobile_setting.advanced_section',
    path: '/mobile/mobileMy/labs/integrations',
    keywords: ['integration', '集成', 'widget', 'bot', '机器人']
  },
  {
    labelKey: 'mobile_setting.homeserver',
    groupKey: 'mobile_setting.advanced_section',
    path: '/mobile/mobileMy/homeserver',
    keywords: ['homeserver', '服务器', '地址', 'server', '域名']
  }
]

/** 兜底：设置页本身（用于「搜不到但想回全部设置」） */
export const MOBILE_SETTINGS_INDEX_PATH = SETTINGS_PATH
