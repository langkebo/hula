/** pinia的store的命名空间 */
declare namespace STO {
  import { ShowModeEnum, ThemeEnum } from '@/enums'
  import { UserState } from '@/services/types'
  /**
   * 设置
   * @param themes 主题设置
   * @param tips 关闭提示
   * @param escClose 是否启用ESC关闭窗口
   * @param lockScreen 是否锁屏
   * @param login 用户登录设置
   * @param chat 聊天设置
   * @param page 界面设置
   */
  type Setting = {
    /** 主题设置 */
    themes: {
      content: ThemeEnum
      pattern: string
    }
    /** 关闭提示 */
    tips: {
      type: string
      /** 不再显示提示 */
      notTips: boolean
    }
    /** 是否启用ESC关闭窗口 */
    escClose: boolean
    /** 菜单显示模式 */
    showMode: ShowModeEnum
    /** 是否锁屏 */
    lockScreen: {
      /** 是否启用锁屏 */
      enable: boolean
      /** 锁屏密码 */
      password: string
    }
    /** 登录设置 */
    login: {
      /** 是否启用自动登录 */
      autoLogin: boolean
      /** 开机启动 */
      autoStartup: boolean
    }
    /** 偏好设置 */
    preferences: {
      /** 发送前是否显示确认 */
      messageConfirm: boolean
      /** 是否启用链接预览 */
      linkPreview: boolean
      /** 是否自动转换表情 */
      emojiConvert: boolean
      /** 表情显示大小 */
      emojiSize: 'small' | 'medium' | 'large'
      /** 新私聊默认是否开启阅后即焚 */
      burnDefaultEnabled: boolean
      /** 阅后即焚默认时长 */
      burnDefaultDuration: 30 | 60 | 300 | 3600 | 86400
      /** 是否显示阅后即焚倒计时 */
      burnShowCountdown: boolean
      /** 参与线程时是否自动订阅 */
      threadAutoSubscribe: boolean
      /** 是否在房间内显示线程入口 */
      threadShowInRoom: boolean
      /** 线程通知级别 */
      threadNotificationLevel: 'all' | 'participate' | 'none'
      /** 加入空间时是否自动加入房间 */
      spaceAutoJoinRooms: boolean
      /** 是否显示子空间 */
      spaceShowSubspaces: boolean
      /** 空间默认通知级别 */
      spaceDefaultNotification: 'all_messages' | 'mentions_only' | 'none'
      /** 是否发送已读回执 */
      sendReadReceipts: boolean
      /** 是否发送输入状态 */
      sendTypingNotifications: boolean
    }
    /** 聊天设置 */
    chat: {
      /** 发送快捷键 */
      sendKey: string
      /** 是否双击打开独立会话窗口 */
      isDouble: boolean
      /** 翻译提供商 */
      translate: 'youdao' | 'tencent'
    }
    /** 快捷键设置 */
    shortcuts: {
      /** 截图快捷键 */
      screenshot: string
      /** 打开主面板快捷键 */
      openMainPanel: string
      /** 全局快捷键开关 */
      globalEnabled: boolean
    }
    /** 界面设置 */
    page: {
      /** 是否开启阴影 */
      shadow: boolean
      /** 字体 */
      fonts: string
      /** 高斯模糊 */
      blur: boolean
      lang: string
    }
    /** 更新设置 */
    update: {
      /** 忽略更新版本 */
      dismiss: string
    }
    /** 截图设置 */
    screenshot: {
      /** 截图时是否隐藏窗口 */
      isConceal: boolean
    }
    /** 消息通知设置 */
    notification: {
      /** 是否开启消息提示音 */
      messageSound: boolean
      /** 提示音音量，范围 0-100 */
      volume: number
    }
    /** 私密聊天设置 */
    secretChat: {
      /** 是否启用私密聊天 */
      enabled: boolean
      /** 密码哈希 */
      passwordHash: string
      /** 是否隐藏私密会话 */
      hideSessions: boolean
      /** 是否启用自动锁定 */
      autoLock: boolean
      /** 自动锁定超时，单位分钟 */
      lockTimeout: number
    }
  }

  /**
   * 置顶窗口列表
   * @param key 窗口名称
   */
  type AlwaysOnTop = {
    /** 是否置顶窗口列表 */
    [key: string]: boolean
  }

  /**
   * 历史内容
   * @param emoji 历史消息的emoji列表
   */
  type History = {
    /** emoji列表 */
    emoji: string[]
  }

  /**
   * 用户状态
   * @param {UserState} 通用在线状态
   */
  type UserState = UserState

  /**
   * 插件管理弹窗数据类型
   * @param state 插件状态
   * @param version 插件版本
   * @param isAdd 是否添加侧边栏
   * @param isAnimate 是否动画效果
   * @param { OPT.L.Common } 通用默认侧边栏
   */
  type Plugins<T> = {
    state: T
    version?: string
    isAdd: boolean
    dot?: boolean
    progress: number
    miniShow: boolean
  } & OPT.L.Common

  /**
   * 引导状态
   */
  type Guide = {
    /** 引导完成状态 */
    isGuideCompleted: boolean
  }
}
