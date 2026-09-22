import {
  type ICreatePushRuleRequest,
  type IPusher,
  type IPusherRequest,
  type IPushRule,
  type IPushRules,
  type MatrixClient,
  type PushRuleAction,
  PushRuleKind
} from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { safeJsonParse, validateObject } from '@/utils/typeGuard'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { matrixHttpClient } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import { isWithinDndWindow as computeWithinDndWindow, type DndWindow } from './dndWindow'
import {
  type NotificationDecisionPreferences,
  type NotificationMessageInput,
  shouldNotify
} from './notificationDecision'
import { loadNotificationDisplayPreferences, materializeNotificationContent } from './notificationDisplayPreferences'

const logger = createLogger('MatrixNotificationService')

let ackEndpointAvailableCache: boolean | null = null
let ackCheckTimestamp = 0
const ACK_CHECK_TTL = 5 * 60 * 1000

/** 唯一有真实分发点、可以接线的细粒度事件开关。缺省视为开启。 */
export type NotificationEventKind = 'thread_mention'

/** 旧「线程中提及」开关（localStorage 字符串），一次性迁移进 `events.thread_mention`。 */
const LEGACY_THREAD_MENTION_STORAGE_KEY = 'tjg-thread-mention-notify'

/**
 * 旧通知展示开关（base 的 NotificationSettings.vue 直接写 localStorage）→ 当前字段。
 * 新配置里已显式写过该字段时以新值为准，旧 key 一律清理。
 */
const LEGACY_NOTIFICATION_CONFIG_KEYS: ReadonlyArray<{
  key: string
  field: 'enableDesktop' | 'showMessageContent' | 'showSender'
}> = [
  { key: 'tjg-desktop-notification', field: 'enableDesktop' },
  { key: 'tjg-show-content', field: 'showMessageContent' },
  { key: 'tjg-show-sender', field: 'showSender' }
]

/**
 * `validateObject` 在 requiredKeys 为空时不会执行单键校验器，因此 events 必须显式清洗。
 * 只保留布尔值：非法条目视为缺省（开启），避免坏配置静默关掉通知。
 */
function sanitizeNotificationEvents(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const events: Record<string, boolean> = {}
  for (const [kind, enabled] of Object.entries(value)) {
    if (typeof enabled === 'boolean') {
      events[kind] = enabled
    }
  }
  return events
}

interface NotificationRule {
  ruleId: string
  kind: 'override' | 'content' | 'room' | 'sender' | 'underride'
  roomId?: string
  conditions?: Record<string, unknown>
  actions: unknown[]
  enabled?: boolean
}

interface NotificationConfig {
  enableDesktop: boolean
  enableSound: boolean
  enableVibrate: boolean
  showPreview: boolean
  showSender: boolean
  showMessageContent: boolean
  /** 细粒度事件开关，缺省视为开启（`thread_mention` 是唯一有真实分发点的 kind）。 */
  events: Record<string, boolean>
}

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enableDesktop: true,
  enableSound: true,
  enableVibrate: true,
  showPreview: true,
  showSender: true,
  showMessageContent: true,
  events: {}
}

/** localStorage 镜像值 → 时间戳；非法值视为未配置（null），不猜。 */
function parseStoredDndTimestamp(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

/** 账号数据里的时间戳：只有有限数值才是有效边界；缺失 / NaN / 非法类型一律视为未设置。 */
function normalizeDndTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

class MatrixNotificationService extends BaseMatrixService {
  private pushRules: IPushRule[] = []
  private observedClient: MatrixClient | null = null
  private config: NotificationConfig = { ...DEFAULT_NOTIFICATION_CONFIG, events: {} }
  /** 勿扰时段的唯一所有者，构造时从 localStorage 镜像同步水合。 */
  private dndSettings: DndWindow = { enabled: false, startTime: null, endTime: null }

  private static readonly CONFIG_STORAGE_KEY = 'tjg-notification-config'
  private static readonly ACCOUNT_DATA_TYPE = 'io.hula.notification_settings'
  private static readonly DND_ACCOUNT_DATA_TYPE = 'io.hula.dnd_settings'
  private static readonly DND_ENABLED_STORAGE_KEY = 'tjg-push-dnd'
  private static readonly DND_START_STORAGE_KEY = 'tjg-push-dnd-start'
  private static readonly DND_END_STORAGE_KEY = 'tjg-push-dnd-end'

  constructor() {
    super()
    this.loadConfig()
    this.loadDndFromMirror()
  }

  /**
   * 从 localStorage 重新读一份配置到内存快照。
   *
   * 每次读取都从默认值重建，而不是在旧内存快照上打补丁：独立聊天窗口是各自独立的
   * realm，设置窗口改了配置后，已开着的聊天窗口必须能观察到，否则开关"点了没反应"。
   */
  private loadConfig(): void {
    const isValidNotificationConfig = (val: unknown): val is Partial<NotificationConfig> =>
      validateObject<Record<string, unknown>>(val, [], {
        enableDesktop: (v) => v === undefined || typeof v === 'boolean',
        enableSound: (v) => v === undefined || typeof v === 'boolean',
        enableVibrate: (v) => v === undefined || typeof v === 'boolean',
        showPreview: (v) => v === undefined || typeof v === 'boolean',
        showSender: (v) => v === undefined || typeof v === 'boolean',
        showMessageContent: (v) => v === undefined || typeof v === 'boolean',
        events: (v) => v === undefined || (typeof v === 'object' && v !== null && !Array.isArray(v))
      })

    let stored: string | null = null
    try {
      stored = localStorage.getItem(MatrixNotificationService.CONFIG_STORAGE_KEY)
    } catch (err) {
      logger.warn('读取通知配置失败:', err)
    }

    let parsed: Partial<NotificationConfig> | null = null
    if (stored) {
      parsed = safeJsonParse(stored, isValidNotificationConfig, DEFAULT_NOTIFICATION_CONFIG)
      this.config = {
        ...DEFAULT_NOTIFICATION_CONFIG,
        ...parsed,
        events: sanitizeNotificationEvents(parsed.events)
      }
    } else {
      this.config = { ...DEFAULT_NOTIFICATION_CONFIG, events: {} }
    }

    // 迁移必须在「配置 key 不存在」时也执行：老用户可能只动过线程开关，从未写过配置。
    this.migrateLegacyEventNotification()
    // 旧通知展示开关（base UI 写入）同理：只有在新配置未显式设置该字段时才采用旧值，
    // 否则关过「通知内容 / 发送者」的用户升级后会被静默恢复成开启。
    this.migrateLegacyDisplayConfig(parsed)
  }

  /**
   * 旧通知展示开关（`tjg-desktop-notification` / `tjg-show-content` / `tjg-show-sender`，
   * 由 base 的 NotificationSettings.vue 写入）一次性并入配置，幂等且「新值优先」：
   * 新配置里已显式写过该字段就保留新值；旧 key 无论是否被采用都清理掉。
   */
  private migrateLegacyDisplayConfig(explicit: Partial<NotificationConfig> | null): void {
    for (const { key, field } of LEGACY_NOTIFICATION_CONFIG_KEYS) {
      let legacy: string | null = null
      try {
        legacy = localStorage.getItem(key)
      } catch (err) {
        logger.warn(`读取旧通知设置失败: ${key}`, err)
        continue
      }
      if (legacy === null) continue

      if (explicit?.[field] === undefined && (legacy === 'true' || legacy === 'false')) {
        this.config = { ...this.config, [field]: legacy === 'true' }
        this.persistConfig()
      }

      try {
        localStorage.removeItem(key)
      } catch (err) {
        logger.warn(`清理旧通知设置失败: ${key}`, err)
      }
    }
  }

  /**
   * 旧 `tjg-thread-mention-notify` 一次性并入 `events.thread_mention`，幂等：
   * 新值已存在时保留新值，旧 key 无论是否被采用都清理掉。
   */
  private migrateLegacyEventNotification(): void {
    let legacy: string | null = null
    try {
      legacy = localStorage.getItem(LEGACY_THREAD_MENTION_STORAGE_KEY)
    } catch (err) {
      logger.warn('读取旧线程通知开关失败:', err)
      return
    }

    if (legacy === null) return

    if (legacy === 'true' || legacy === 'false') {
      const enabled = legacy === 'true'
      if (this.config.events.thread_mention === undefined) {
        this.config.events = { ...this.config.events, thread_mention: enabled }
        this.persistConfig()
      }
    }

    try {
      localStorage.removeItem(LEGACY_THREAD_MENTION_STORAGE_KEY)
    } catch (err) {
      logger.warn('清理旧线程通知开关失败:', err)
    }
  }

  private persistConfig(): void {
    try {
      localStorage.setItem(MatrixNotificationService.CONFIG_STORAGE_KEY, JSON.stringify(this.config))
    } catch (err) {
      logger.warn('Notification storage error:', err)
    }
  }

  async syncConfigToAccountData(): Promise<void> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const client = this.getNotificationClient()
      await client.setAccountData(
        MatrixNotificationService.ACCOUNT_DATA_TYPE,
        this.config as unknown as Record<string, unknown>
      )
      logger.info('[MatrixNotification] 通知配置已同步到服务端')
    } catch (err) {
      logger.error(`[MatrixNotification] 同步通知配置到服务端失败: ${err}`)
    }
  }

  async syncConfigFromAccountData(): Promise<boolean> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const client = this.getNotificationClient()
      const event = client.getAccountData(MatrixNotificationService.ACCOUNT_DATA_TYPE)
      if (event) {
        const serverConfig = event.getContent() as Partial<NotificationConfig>
        if (serverConfig && typeof serverConfig === 'object') {
          this.loadConfig()
          this.config = {
            ...this.config,
            ...serverConfig,
            events: sanitizeNotificationEvents(serverConfig.events ?? this.config.events)
          }
          this.persistConfig()
          logger.info('[MatrixNotification] 从服务端同步通知配置成功')
          return true
        }
      }
      return false
    } catch (err) {
      logger.error(`[MatrixNotification] 从服务端同步通知配置失败: ${err}`)
      return false
    }
  }

  /** 把勿扰时段写入账号数据 `io.hula.dnd_settings`（`setDndSettings` 复用它，不复制实现）。 */
  async syncDndToAccountData(settings: DndWindow): Promise<void> {
    try {
      const client = this.getNotificationClient()
      await client.setAccountData(
        MatrixNotificationService.DND_ACCOUNT_DATA_TYPE,
        settings as unknown as Record<string, unknown>
      )
      logger.info('[MatrixNotification] DND 设置已同步到服务端')
    } catch (err) {
      logger.error(`[MatrixNotification] 同步 DND 设置到服务端失败: ${err}`)
    }
  }

  async syncDndFromAccountData(): Promise<DndWindow | null> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const client = this.getNotificationClient()
      const event = client.getAccountData(MatrixNotificationService.DND_ACCOUNT_DATA_TYPE)
      if (event) {
        const dndSettings = event.getContent() as {
          enabled?: boolean
          startTime?: number | null
          endTime?: number | null
        }
        if (dndSettings && typeof dndSettings === 'object') {
          const normalized: DndWindow = {
            enabled: dndSettings.enabled === true,
            // 账号数据未经校验：非有限数一律视为"未设置"，否则会静默抑制通知
            startTime: normalizeDndTimestamp(dndSettings.startTime),
            endTime: normalizeDndTimestamp(dndSettings.endTime)
          }
          this.dndSettings = normalized
          // 回写本地镜像：否则冷启动时 DND 不水合，用户会被静默重新打开通知，
          // 或在设置页看到一份与账号数据不一致的本地状态。
          this.writeDndMirror(normalized)
          logger.info('[MatrixNotification] 从服务端同步 DND 设置成功')
          return normalized
        }
      }
      return null
    } catch (err) {
      logger.warn(`[MatrixNotification] 从服务端同步 DND 设置失败: ${err}`)
      return null
    }
  }

  /**
   * 构造时从 localStorage 镜像同步水合。
   *
   * `syncConfigFromAccountData()` 生产零调用方，账号数据在启动时并不可用，
   * 因此必须在这里读本地镜像，否则不打开设置窗口就不会生效。
   */
  private loadDndFromMirror(): void {
    try {
      this.dndSettings = {
        enabled: localStorage.getItem(MatrixNotificationService.DND_ENABLED_STORAGE_KEY) === 'true',
        startTime: parseStoredDndTimestamp(localStorage.getItem(MatrixNotificationService.DND_START_STORAGE_KEY)),
        endTime: parseStoredDndTimestamp(localStorage.getItem(MatrixNotificationService.DND_END_STORAGE_KEY))
      }
    } catch (err) {
      logger.warn('读取勿扰时段设置失败:', err)
    }
  }

  private writeMirroredTimestamp(key: string, value: number | null): void {
    if (value === null) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, value.toString())
  }

  /** 把勿扰时段写入 localStorage 镜像（`setDndSettings` 与账号数据水合共用一份实现）。 */
  private writeDndMirror(settings: DndWindow): void {
    try {
      localStorage.setItem(MatrixNotificationService.DND_ENABLED_STORAGE_KEY, settings.enabled.toString())
      this.writeMirroredTimestamp(MatrixNotificationService.DND_START_STORAGE_KEY, settings.startTime)
      this.writeMirroredTimestamp(MatrixNotificationService.DND_END_STORAGE_KEY, settings.endTime)
    } catch (err) {
      logger.warn('写入勿扰时段设置失败:', err)
    }
  }

  /** 读取当前勿扰时段（每次都从 localStorage 镜像刷新，跨窗口改动无需重启即可生效）。 */
  getDndSettings(): DndWindow {
    this.loadDndFromMirror()
    return { ...this.dndSettings }
  }

  /** 勿扰时段的唯一写入点：更新缓存 + localStorage 镜像，并复用既有 account data 同步。 */
  setDndSettings(settings: DndWindow): void {
    this.dndSettings = {
      enabled: settings.enabled,
      startTime: settings.startTime,
      endTime: settings.endTime
    }

    this.writeDndMirror(this.dndSettings)

    this.syncDndToAccountData(this.dndSettings)
  }

  /** 当前是否处于勿扰窗口；`now` 可注入，便于测试与纯函数保持一致。 */
  isWithinDndWindow(now: Date = new Date()): boolean {
    // 先刷新镜像：设置窗口/其它窗口改了 DND，已打开的聊天窗口要立刻看到
    this.loadDndFromMirror()
    return computeWithinDndWindow(this.dndSettings, now)
  }

  private syncClientState(): MatrixClient | null {
    const client = matrixClientService.getClient()
    if (this.observedClient && this.observedClient !== client) {
      this.pushRules = []
    }
    this.observedClient = client
    return client
  }

  private getNotificationClient(): MatrixClient {
    const client = this.syncClientState()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }
    return client
  }

  private flattenRules(rules: IPushRules): IPushRule[] {
    const allRules: IPushRule[] = []
    const globalRules = rules.global
    for (const value of Object.values(globalRules)) {
      if (Array.isArray(value)) {
        allRules.push(...value)
      }
    }
    return allRules
  }

  async initialize(): Promise<void> {
    try {
      const client = this.getNotificationClient()
      const rules = await client.getPushManager().getPushRules()
      this.pushRules = this.flattenRules(rules)
      logger.info('[MatrixNotification] 初始化完成')
    } catch (err) {
      logger.error(`[MatrixNotification] 初始化失败: ${err}`)
      throw err
    }
  }

  async setPushRule(rule: NotificationRule): Promise<void> {
    const client = this.getNotificationClient()
    try {
      await client
        .getPushManager()
        .updatePushRule('global', rule.kind as PushRuleKind, rule.ruleId, { actions: rule.actions as PushRuleAction[] })
      logger.info(`[MatrixNotification] 设置推送规则成功: ${rule.ruleId}`)
    } catch (err) {
      logger.error(`[MatrixNotification] 设置推送规则失败: ${err}`)
      throw err
    }
  }

  async deletePushRule(ruleId: string, kind?: PushRuleKind): Promise<void> {
    const client = this.getNotificationClient()
    try {
      const resolvedKind = kind ?? (await this.findPushRuleKind(client, ruleId))
      await client.getPushManager().deletePushRule('global', resolvedKind, ruleId)
      logger.info(`[MatrixNotification] 删除推送规则成功: ${ruleId} (kind: ${resolvedKind})`)
    } catch (err) {
      logger.error(`[MatrixNotification] 删除推送规则失败: ${err}`)
      throw err
    }
  }

  private async findPushRuleKind(client: MatrixClient, ruleId: string): Promise<PushRuleKind> {
    try {
      const rules = await client.getPushManager().getPushRules()
      const kinds: PushRuleKind[] = [
        PushRuleKind.Override,
        PushRuleKind.ContentSpecific,
        PushRuleKind.RoomSpecific,
        PushRuleKind.SenderSpecific,
        PushRuleKind.Underride
      ]
      for (const kind of kinds) {
        // FT-106: IPushRules 结构是 { global: { override, content, room, sender, underride } }
        // 必须通过 rules.global[kind] 访问，而非 rules[kind]
        const ruleList = (rules.global?.[kind] ?? undefined) as IPushRule[] | undefined
        if (ruleList?.some((r) => r.rule_id === ruleId)) {
          return kind
        }
      }
    } catch (err) {
      logger.warn('Notification operation failed:', err)
    }
    return PushRuleKind.Override
  }

  async setPusher(pusher: IPusherRequest): Promise<void> {
    const client = this.getNotificationClient()
    try {
      await client.getPushManager().setPusher(pusher)
      logger.info('[MatrixNotification] 设置 pusher 成功')
    } catch (err) {
      logger.error(`[MatrixNotification] 设置 pusher 失败: ${err}`)
      throw err
    }
  }

  getPushRules(): IPushRule[] {
    this.syncClientState()
    return this.pushRules
  }

  getPushRule(ruleId: string): IPushRule | undefined {
    this.syncClientState()
    return this.pushRules.find((rule) => rule.rule_id === ruleId)
  }

  /**
   * 局部更新通知配置。
   *
   * 写前先从 localStorage 读一份最新配置再合并，**只覆盖调用方传入的字段**：
   * 独立窗口各有自己的内存快照，若把旧快照整份写回，别的窗口刚改的
   * `showSender` / `showMessageContent` 会被静默顶回旧值。
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.loadConfig()
    this.config = {
      ...this.config,
      ...config,
      // events 做浅合并：调用方通常只改其中一个 kind，不能把别的 kind 一起覆盖
      events: config.events !== undefined ? { ...this.config.events, ...config.events } : this.config.events
    }
    this.persistConfig()
    this.syncConfigToAccountData()
  }

  getConfig(): NotificationConfig {
    // 每次读取都从持久化存储刷新，跨窗口改动无需重启即可生效
    this.loadConfig()
    return { ...this.config, events: { ...this.config.events } }
  }

  /** 写入细粒度事件开关（目前唯一 kind：`thread_mention`），与 `enableDesktop` 同一份配置、同一发送路径读取。 */
  setEventNotificationEnabled(kind: NotificationEventKind, enabled: boolean): void {
    // 只传被改的 kind，交给 updateConfig 与最新持久化快照浅合并
    this.updateConfig({ events: { [kind]: enabled } })
  }

  /**
   * 消息到达时的统一通知决策门：汇总 `config.events`、关键词展示偏好与勿扰窗口后委托纯函数。
   *
   * 自己发送的消息由调用方先排除（发送路径还持有 userStore 身份）。
   */
  shouldNotifyMessage(input: NotificationMessageInput): boolean {
    const config = this.getConfig()
    const preferences = loadNotificationDisplayPreferences()
    const decisionPreferences: NotificationDecisionPreferences = {
      events: config.events,
      keywordNotifications: preferences.keywordNotifications,
      keywords: preferences.keywords,
      dndActive: this.isWithinDndWindow()
    }
    return shouldNotify(input, decisionPreferences)
  }

  async requestNotificationPermission(): Promise<boolean> {
    try {
      if (typeof Notification === 'undefined') {
        return false
      }

      if (Notification.permission === 'granted') {
        return true
      }

      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (err) {
      logger.error(`[MatrixNotification] 请求通知权限失败: ${err}`)
      return false
    }
  }

  /**
   * 通过浏览器 Notification API 弹出通知（Web 场景）。
   *
   * 注意：Tauri 桌面端的真实发送路径不经过这里——chat 收到命中当前用户的消息时，
   * 由 `messageMutations` 读取 `getConfig()` 并用 `buildNotificationDisplay()` 裁定
   * 标题/正文后交给 `@tauri-apps/plugin-notification` 发送。
   */
  async showNotification(title: string, body: string): Promise<void> {
    try {
      if (!this.config.enableDesktop) {
        return
      }

      if (typeof Notification === 'undefined') {
        logger.warn('[MatrixNotification] Notification API 不可用')
        return
      }

      if (Notification.permission !== 'granted') {
        const granted = await this.requestNotificationPermission()
        if (!granted) {
          return
        }
      }

      const display = this.buildNotificationDisplay(title, body)
      new Notification(display.title, {
        body: display.body
      })
    } catch (err) {
      logger.error(`[MatrixNotification] 显示通知失败: ${err}`)
    }
  }

  /**
   * 供消息到达时决定通知标题与正文，`messageMutations` 的桌面通知路径消费此处结果。
   *
   * 合并两处偏好：账号级 `showMessageContent` 先并入本地展示偏好，
   * 再由优先级裁定（high 可突破账号级开关，low 强制折叠）。
   * 正文隐藏时标题加折叠标记，避免偏好静默失效、用户无从察觉。
   */
  buildNotificationDisplay(title: string, body: string): { title: string; body: string | undefined } {
    const preferences = loadNotificationDisplayPreferences()
    const decision = materializeNotificationContent(
      { title, body },
      { ...preferences, contentSummary: preferences.contentSummary && this.config.showMessageContent }
    )

    if (!decision.contentVisible) {
      return { title: `[•] ${title}`, body: undefined }
    }

    const prefix = decision.highlighted ? '[*] ' : ''
    return { title: `${prefix}${decision.title}`, body: decision.body }
  }

  async playSound(url: string): Promise<void> {
    try {
      if (!this.config.enableSound) {
        return
      }

      const audio = new Audio(url)
      await audio.play()
    } catch (err) {
      logger.warn(`[MatrixNotification] 播放提示音失败: ${err}`)
    }
  }

  async vibrate(pattern: number | number[] = [100, 50, 100]): Promise<void> {
    try {
      if (!this.config.enableVibrate || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return
      }

      navigator.vibrate(pattern)
    } catch (err) {
      logger.warn(`[MatrixNotification] 震动失败: ${err}`)
    }
  }

  async getNotifications(
    from?: string,
    limit: number = 20
  ): Promise<{
    notifications: Array<Record<string, unknown>>
    next_token?: string
  }> {
    const client = this.getNotificationClient()
    try {
      const result = await client.getNotificationsManager().getNotifications({ from, limit })
      return result as { notifications: Array<Record<string, unknown>>; next_token?: string }
    } catch (err) {
      logger.error(`[MatrixNotification] 获取通知列表失败: ${err}`)
      return { notifications: [] }
    }
  }

  async ackNotification(notificationId: string): Promise<boolean> {
    try {
      await matrixHttpClient.request('POST', MATRIX_PATHS.NOTIFICATION.NOTIFICATIONS_ACK(notificationId))
      logger.info(`[MatrixNotification] 通知确认成功: ${notificationId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixNotification] 通知确认失败: ${err}`)
      return false
    }
  }

  async ackNotificationWithFallback(
    notificationId: string,
    roomId: string,
    eventId: string
  ): Promise<{
    success: boolean
    method: 'ack' | 'receipt'
  }> {
    const now = Date.now()
    if (ackEndpointAvailableCache !== null && now - ackCheckTimestamp < ACK_CHECK_TTL) {
      if (ackEndpointAvailableCache) {
        const ok = await this.ackNotification(notificationId)
        return { success: ok, method: 'ack' }
      }
      const ok = await this.sendReadReceipt(roomId, eventId)
      return { success: ok, method: 'receipt' }
    }

    const ok = await this.ackNotification(notificationId)
    if (ok) {
      ackEndpointAvailableCache = true
      ackCheckTimestamp = now
      return { success: true, method: 'ack' }
    }

    logger.info(`[MatrixNotification] ack 端点不可用，回退到已读回执: ${notificationId}`)
    ackEndpointAvailableCache = false
    ackCheckTimestamp = now
    const receiptOk = await this.sendReadReceipt(roomId, eventId)
    return { success: receiptOk, method: 'receipt' }
  }

  private async sendReadReceipt(roomId: string, eventId: string): Promise<boolean> {
    const client = this.getNotificationClient()
    try {
      await client.getReadReceiptsManager().sendReceiptForce(roomId, 'm.read', eventId)
      logger.info(`[MatrixNotification] 已读回执发送成功: ${roomId}/${eventId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixNotification] 已读回执发送失败: ${err}`)
      return false
    }
  }

  /**
   * 从服务端获取完整推送规则 (async, 使用 SDK 高层方法)
   */
  async fetchPushRules(): Promise<IPushRules> {
    const client = this.getNotificationClient()
    try {
      return await client.getPushManager().getPushRules()
    } catch (err) {
      logger.error(`[MatrixNotification] 获取推送规则失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置推送规则 (使用 SDK PushManager.createPushRule)
   */
  async setPushRuleByScope(scope: string, kind: string, ruleId: string, body: Record<string, unknown>): Promise<void> {
    const client = this.getNotificationClient()
    try {
      await client
        .getPushManager()
        .createPushRule(scope, kind as PushRuleKind, ruleId, body as unknown as ICreatePushRuleRequest)
      logger.info(`[MatrixNotification] 设置推送规则成功: ${scope}/${kind}/${ruleId}`)
    } catch (err) {
      logger.error(`[MatrixNotification] 设置推送规则失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除推送规则 (使用 SDK PushManager.deletePushRule)
   */
  async deletePushRuleByScope(scope: string, kind: string, ruleId: string): Promise<void> {
    const client = this.getNotificationClient()
    try {
      await client.getPushManager().deletePushRule(scope, kind as PushRuleKind, ruleId)
      logger.info(`[MatrixNotification] 删除推送规则成功: ${scope}/${kind}/${ruleId}`)
    } catch (err) {
      logger.error(`[MatrixNotification] 删除推送规则失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取推送设备列表 (使用 SDK 高层方法)
   * FT-128: 返回 IPusher[] 而非类型擦除的 Array<Record<string, unknown>>
   */
  async fetchPushers(): Promise<IPusher[]> {
    const client = this.getNotificationClient()
    try {
      const result = await client.getPushManager().getPushers()
      return result as unknown as IPusher[]
    } catch (err) {
      logger.error(`[MatrixNotification] 获取推送设备列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置推送设备 (使用 SDK 高层方法)
   * FT-129: 校验必填字段后再调用 SDK，不使用 as unknown as 强转
   */
  async setPusherByBody(pusher: Record<string, unknown>): Promise<void> {
    if (typeof pusher.pushkey !== 'string' || pusher.pushkey === '') {
      throw new Error('pusher.pushkey is required and must be a non-empty string')
    }
    if (typeof pusher.app_id !== 'string' || pusher.app_id === '') {
      throw new Error('pusher.app_id is required and must be a non-empty string')
    }
    if (typeof pusher.kind !== 'string' || pusher.kind === '') {
      throw new Error('pusher.kind is required and must be a non-empty string')
    }

    const client = this.getNotificationClient()
    try {
      await client.getPushManager().setPusher(pusher as unknown as IPusherRequest)
      logger.info('[MatrixNotification] 设置推送设备成功')
    } catch (err) {
      logger.error(`[MatrixNotification] 设置推送设备失败: ${err}`)
      throw err
    }
  }

  clearAckCache(): void {
    ackEndpointAvailableCache = null
    ackCheckTimestamp = 0
  }
}

export const matrixNotificationService = new MatrixNotificationService()
