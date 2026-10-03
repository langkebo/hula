import { createLogger } from '@/utils/Logger'

const logger = createLogger('NotificationConfig')

/**
 * 通知配置的 localStorage key。
 *
 * 导出给测试与迁移代码引用：配置损坏告警只记录 key 与长度，不记录配置内容（可能含隐私字段）。
 */
export const NOTIFICATION_CONFIG_STORAGE_KEY = 'tjg-notification-config'

/** 账号数据里的通知展示配置类型（只写不读的服务端备份，见 `syncConfigToAccountData`）。 */
export const NOTIFICATION_CONFIG_ACCOUNT_DATA_TYPE = 'io.hula.notification_settings'

/** 唯一有真实分发点、可以接线的细粒度事件开关。缺省视为开启。 */
export type NotificationEventKind = 'thread_mention'

/**
 * 通知配置的形状。
 *
 * 全部字段都可缺省：缺省表示「用户从未显式写过」，由调用方决定回落默认值还是采纳旧键迁移。
 */
export interface NotificationConfig {
  enableDesktop: boolean
  showSender: boolean
  showMessageContent: boolean
  /** 细粒度事件开关，缺省视为开启（`thread_mention` 是唯一有真实分发点的 kind）。 */
  events: Record<string, boolean>
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enableDesktop: true,
  showSender: true,
  showMessageContent: true,
  events: {}
}

/** 旧「线程中提及」开关（localStorage 字符串），一次性迁移进 `events.thread_mention`。 */
export const LEGACY_THREAD_MENTION_STORAGE_KEY = 'tjg-thread-mention-notify'

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
 * 逐字段校验器：返回 `undefined` 表示「该字段没有被显式写过一个合法值」。
 *
 * 这里刻意不用 `validateObject`：它在 `requiredKeys` 为空时不执行单键校验器
 * （`requiredKeys` 非空又会强制要求字段存在），两种用法都不适合「可缺省 + 逐字段丢弃」。
 * 每个字段独立判定，非法字段丢弃、合法兄弟字段保留。
 */
const CONFIG_FIELD_PARSERS: Readonly<
  Record<keyof NotificationConfig, (value: unknown) => boolean | Record<string, boolean> | undefined>
> = {
  enableDesktop: (value) => (typeof value === 'boolean' ? value : undefined),
  showSender: (value) => (typeof value === 'boolean' ? value : undefined),
  showMessageContent: (value) => (typeof value === 'boolean' ? value : undefined),
  events: (value) => sanitizeNotificationEvents(value)
}

/**
 * `events` 的逐键清洗：只保留布尔值条目，非法条目视为缺省（开启），
 * 避免坏配置静默关掉通知。
 */
export function sanitizeNotificationEvents(value: unknown): Record<string, boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const events: Record<string, boolean> = {}
  for (const [kind, enabled] of Object.entries(value)) {
    if (typeof enabled === 'boolean') {
      events[kind] = enabled
    }
  }
  return events
}

/**
 * 逐字段清洗：合法字段保留，类型非法的字段整体丢弃（视为「用户没写过」）。
 *
 * 与 `validateObject` 的整体判定不同，一个坏字段不会连累其它字段。
 *
 * @returns `value` 为清洗结果，`dropped` 表示是否有字段因类型非法被丢弃
 */
function parseNotificationConfigFields(value: unknown): { value: Partial<NotificationConfig>; dropped: boolean } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { value: {}, dropped: false }
  }

  const record = value as Record<string, unknown>
  const parsed: Partial<NotificationConfig> = {}
  let dropped = false
  for (const key of Object.keys(CONFIG_FIELD_PARSERS) as (keyof NotificationConfig)[]) {
    const raw = record[key]
    const field = CONFIG_FIELD_PARSERS[key](raw)
    if (field === undefined) {
      if (raw !== undefined) {
        dropped = true
      }
      continue
    }
    // 逐字段赋值的键集合是静态的，这里的断言只用于收窄联合类型
    ;(parsed as Record<string, unknown>)[key] = field
  }
  return { value: parsed, dropped }
}

/**
 * 「是不是一个可以当配置对象看的 JSON」——数组 / 标量 / null 都算结构性损坏，
 * 逐字段类型非法则不算（由逐字段解析丢弃）。
 *
 * 不复用 `validateObject`：它只负责「是不是对象」，判定不了本模块的逐字段语义，
 * 而 `requiredKeys` 为空时又不执行单键校验器，两个方向都用不上。
 */
function isStructuralConfigRecord(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 通知配置的持久化与迁移所有者。
 *
 * 独立于 `MatrixNotificationService`：服务只负责编排读写时机，
 * 「怎么解析、怎么迁移、损坏时告警几次」都在这里收敛，便于单独测试。
 *
 * **告警去重**：`getConfig()` 每次通知决策都会重新读取，而读取本身会重新解析、
 * 因此会重新发现同一份损坏。告警只在「存储内容与上次已告警的不同」时置位，
 * 由服务 `consumeCorruptionWarning()` 取走后清空，同一份损坏配置不会在消息热路径上刷屏。
 */
export class NotificationConfigStore {
  private config: NotificationConfig = { ...DEFAULT_NOTIFICATION_CONFIG, events: {} }
  private pendingCorruptionWarning: { storageKey: string; length: number } | null = null
  /**
   * 上一次已告警的原始存储内容。
   *
   * 去重按「内容」而不是「一次读取」：损坏内容没变时反复读取不重复告警；
   * 内容变了（用户又改坏了 / 换成另一份坏配置）则重新告警一次。
   */
  private lastWarnedCorruptRaw: string | null = null

  /** 当前内存快照（从存储重建后的副本）。 */
  getConfig(): NotificationConfig {
    return { ...this.config, events: { ...this.config.events } }
  }

  /**
   * 从 localStorage 重新读一份配置到内存快照并返回。
   *
   * 每次读取都从存储重建，而不是在旧内存快照上打补丁：独立聊天窗口是各自独立的
   * realm，设置窗口改了配置后，已开着的聊天窗口必须能观察到，否则开关"点了没反应"。
   */
  loadConfig(): NotificationConfig {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(NOTIFICATION_CONFIG_STORAGE_KEY)
    } catch (err) {
      logger.warn('读取通知配置失败:', err)
    }

    // 损坏 / 非法时回落 `{}`（而不是填满的默认配置）：`{}` 表示「什么都没显式写过」，
    // 旧展示键才会被 migrateLegacyDisplayConfig 采纳。回落到默认配置会把默认值误当成
    // 显式值，导致用户关过的开关在升级后被静默恢复默认（隐私回退）。
    const { value: raw, parsed: jsonParsed } = this.parseStoredConfig(stored)
    const { value: explicit, dropped } = parseNotificationConfigFields(raw)

    this.config = {
      ...DEFAULT_NOTIFICATION_CONFIG,
      ...explicit,
      events: explicit.events ?? {}
    }

    // 迁移必须在「配置 key 不存在」时也执行：老用户可能只动过线程开关，从未写过配置。
    this.migrateLegacyEventNotification()
    // 旧通知展示开关（base UI 写入）同理：只有在新配置未显式设置该字段时才采用旧值，
    // 否则关过「通知内容 / 发送者」的用户升级后会被静默恢复成开启。
    this.migrateLegacyDisplayConfig(explicit)

    // 清掉存储里的非法字段：否则下一次读取还会看到同一个坏值，
    // 且 `updateConfig` 之外的路径永远等不到一次"合法写入"来覆盖它。
    if (dropped) {
      this.persistConfig()
    }

    if (stored !== null && (!jsonParsed || !isStructuralConfigRecord(raw))) {
      // 只在「损坏内容」变化时重新置位：否则每次读取都会重新发现同一份损坏并刷屏
      if (stored !== this.lastWarnedCorruptRaw) {
        this.pendingCorruptionWarning = { storageKey: NOTIFICATION_CONFIG_STORAGE_KEY, length: stored.length }
      }
      this.lastWarnedCorruptRaw = stored
    } else {
      // 恢复成合法配置后重新武装：下次再损坏仍然要告警
      this.lastWarnedCorruptRaw = null
    }

    return this.getConfig()
  }

  /**
   * 局部更新：写前先从存储读一份最新配置再合并，**只覆盖调用方传入的字段**。
   *
   * 独立窗口各有自己的内存快照，若把旧快照整份写回，别的窗口刚改的
   * `showSender` / `showMessageContent` 会被静默顶回旧值。
   */
  setConfig(patch: Partial<NotificationConfig>): NotificationConfig {
    this.loadConfig()
    this.config = {
      ...this.config,
      ...patch,
      // events 做浅合并：调用方通常只改其中一个 kind，不能把别的 kind 一起覆盖
      events: patch.events !== undefined ? { ...this.config.events, ...patch.events } : this.config.events
    }
    this.persistConfig()
    return this.getConfig()
  }

  /**
   * 整份采用服务端配置（显式恢复入口）：先本地重载观察其它窗口的改动，
   * 再让服务端字段覆盖同名字段；但 `events` 是**清洗后整体替换**，不是 `setConfig` 的浅合并。
   *
   * 这两点都来自拆分前 `syncConfigFromAccountData` 的语义，必须逐字保持：
   * - 整体替换：服务端那份就是该字段的完整快照，本地独有的 kind 不能残留
   *   （否则服务端删掉的开关会在下次拉取后复活）。
   * - 逐键清洗：账号数据里的非布尔条目不能被原样写进配置并持久化。
   *
   * @param serverConfig 账号数据 `getContent()` 里的配置对象（未受信任，需清洗）
   */
  applyServerConfig(serverConfig: Partial<NotificationConfig>): NotificationConfig {
    this.loadConfig()
    this.config = {
      ...this.config,
      ...serverConfig,
      events: sanitizeNotificationEvents(serverConfig.events ?? this.config.events) ?? {}
    }
    this.persistConfig()
    return this.getConfig()
  }

  /**
   * 取出并清空「待告警的损坏配置」。
   *
   * 返回 `null` 表示本次读取没有新发现的损坏（已告警过 / 本来就是合法配置）。
   * 调用方负责真正打印日志，保证同一次损坏只告警一次。
   */
  consumeCorruptionWarning(): { storageKey: string; length: number } | null {
    const warning = this.pendingCorruptionWarning
    this.pendingCorruptionWarning = null
    return warning
  }

  /**
   * 解析存储里的原始 JSON。
   *
   * `parsed` 单独返回：损坏 JSON 会回落 `{}`，但 `{}` 同时也是合法配置，
   * 只看解析结果无法区分「没写过」与「写坏了」，告警判定必须知道 JSON 是否解析成功。
   *
   * 解析失败刻意不在这里打日志：`loadConfig` 每次通知决策都会跑，
   * 告警统一由 `consumeCorruptionWarning()` 按内容去重后交给服务打印一次。
   */
  private parseStoredConfig(stored: string | null): { value: unknown; parsed: boolean } {
    if (!stored) {
      return { value: {}, parsed: true }
    }

    try {
      return { value: JSON.parse(stored) as unknown, parsed: true }
    } catch {
      return { value: {}, parsed: false }
    }
  }

  private persistConfig(): void {
    try {
      localStorage.setItem(NOTIFICATION_CONFIG_STORAGE_KEY, JSON.stringify(this.config))
    } catch (err) {
      logger.warn('Notification storage error:', err)
    }
  }

  /**
   * 旧通知展示开关（`tjg-desktop-notification` / `tjg-show-content` / `tjg-show-sender`，
   * 由 base 的 NotificationSettings.vue 写入）一次性并入配置，幂等且「新值优先」：
   * 新配置里已显式写过该字段就保留新值；旧 key 无论是否被采用都清理掉。
   */
  private migrateLegacyDisplayConfig(explicit: Partial<NotificationConfig>): void {
    for (const { key, field } of LEGACY_NOTIFICATION_CONFIG_KEYS) {
      let legacy: string | null = null
      try {
        legacy = localStorage.getItem(key)
      } catch (err) {
        logger.warn(`读取旧通知设置失败: ${key}`, err)
        continue
      }
      if (legacy === null) continue

      if (explicit[field] === undefined && (legacy === 'true' || legacy === 'false')) {
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
}
