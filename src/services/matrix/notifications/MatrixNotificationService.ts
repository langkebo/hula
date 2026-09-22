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
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { pullConfigFromAccountData, pushConfigToAccountData } from './configAccountDataSync'
import { DND_ACCOUNT_DATA_TYPE, normalizeDndWindow, pushDndToAccountData } from './dndAccountDataSync'
import { DndSettingsStore } from './dndSettingsStore'
import type { DndWindow, DndWindowInput } from './dndWindow'
import {
  clearAckEndpointCache,
  ackNotification as postNotificationAck,
  ackNotificationWithFallback as postNotificationAckWithFallback
} from './notificationAck'
import { type NotificationConfig, NotificationConfigStore } from './notificationConfig'
import type { NotificationMessageInput } from './notificationDecision'
import { shouldNotifyMessage as decideShouldNotifyMessage, renderNotificationDisplay } from './notificationDecisionGate'
import { isSystemNotificationPermissionGranted } from './systemNotificationPermission'

const logger = createLogger('MatrixNotificationService')

/**
 * 唯一有真实分发点、可以接线的细粒度事件开关。缺省视为开启。
 *
 * 保留在门面层（配置模块只关心 `Record<string, boolean>` 的形状）。
 */
export type NotificationEventKind = 'thread_mention'

interface NotificationRule {
  ruleId: string
  kind: 'override' | 'content' | 'room' | 'sender' | 'underride'
  roomId?: string
  conditions?: Record<string, unknown>
  actions: unknown[]
  enabled?: boolean
}

/**
 * 通知配置、推送规则与勿扰时段的门面服务。
 *
 * 自身只保留「SDK 客户端状态 + 公共编排」；配置持久化/迁移、DND 本地镜像、
 * 决策门与文案渲染、ack 降级分别下沉到同目录的职责模块：
 * `notificationConfig` / `dndSettingsStore` / `notificationDecisionGate` / `notificationAck`。
 */
class MatrixNotificationService extends BaseMatrixService {
  private pushRules: IPushRule[] = []
  private observedClient: MatrixClient | null = null
  private readonly configStore: NotificationConfigStore = new NotificationConfigStore()
  /** 勿扰时段的本地所有者，构造时从 localStorage 镜像同步水合。 */
  private readonly dndStore = new DndSettingsStore()

  constructor() {
    super()
    this.loadConfig()
    this.loadDndFromMirror()
  }

  /**
   * 从 localStorage 重建配置快照，并把「首次发现的损坏」打印一次。
   *
   * 每次读取都重建：独立聊天窗口是各自独立的 realm，设置窗口改了配置后，
   * 已开着的聊天窗口必须能观察到，否则开关"点了没反应"。
   * 告警只打印一次，避免通知热路径上重复刷屏（见 `NotificationConfigStore`）。
   */
  private loadConfig(): void {
    this.configStore.loadConfig()
    this.warnAboutCorruptConfigOnce()
  }

  /** 只消费一次待告警标记：同一次损坏不会被重复打印（每次读取都可能命中损坏配置）。 */
  private warnAboutCorruptConfigOnce(): void {
    const corruption = this.configStore.consumeCorruptionWarning()
    if (corruption) {
      // 只记存储 key 与长度：配置内容可能含隐私字段，不进日志
      logger.warn('[MatrixNotification] 通知配置损坏或校验失败，已回落默认值', corruption)
    }
  }

  /**
   * 把通知展示配置写入账号数据 `io.hula.notification_settings`。
   *
   * **展示配置是设备本地偏好**（桌面是否显示内容、是否显示发送者等语义随屏幕与场景变化），
   * 因此这里是**只写不读**的服务端备份：`updateConfig` 写入本地后 fire-and-forget 同步一份，
   * 但启动 / 写入后都不会用它覆盖本地。冷启动水合只读 localStorage，见 `loadConfig`。
   */
  async syncConfigToAccountData(): Promise<void> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      await pushConfigToAccountData(this.getNotificationClient(), this.configStore.getConfig())
    } catch (err) {
      logger.error(`[MatrixNotification] 同步通知配置到服务端失败: ${err}`)
    }
  }

  /**
   * 从账号数据读回展示配置。
   *
   * **生产零调用方，且刻意不接线**：展示配置是设备本地偏好（见 `syncConfigToAccountData`），
   * 跨设备同步会引入设备语义冲突与冲突判定成本。保留该方法只作为将来的显式恢复入口：
   * 若要接线，必须先定义「哪些字段算账号级」与「服务端/本地谁赢」，不能直接整份覆盖本地。
   */
  async syncConfigFromAccountData(): Promise<boolean> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const pulled = await pullConfigFromAccountData(this.getNotificationClient(), this.configStore)
      this.warnAboutCorruptConfigOnce()
      return pulled
    } catch (err) {
      logger.error(`[MatrixNotification] 从服务端同步通知配置失败: ${err}`)
      return false
    }
  }

  /**
   * 把勿扰时段（含 `updatedAt`）写入账号数据 `io.hula.dnd_settings`
   * （`setDndSettings` 复用它，不复制实现）。
   *
   * 与另外两个同步方法一样先 `waitForClientReady`：否则冷启动 / 未就绪时会静默丢写，
   * 本地镜像还在、用户看不出来，另一台设备永远收不到。
   */
  async syncDndToAccountData(settings: DndWindow): Promise<void> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      await pushDndToAccountData(this.getNotificationClient(), settings)
    } catch (err) {
      logger.error(`[MatrixNotification] 同步 DND 设置到服务端失败: ${err}`)
    }
  }

  /**
   * 从账号数据 `io.hula.dnd_settings` 拉取勿扰时段（冷启动 + 打开设置页时调用）。
   *
   * 冲突规则（新者胜）：只有服务端 `updatedAt` **严格新于**本地镜像时才覆盖本地。
   * 旧 payload 没有 `updatedAt`（视为 0）不能顶掉本地新改动；但本地从未配置过 DND 时
   * （镜像为空）仍会采纳服务端的旧 payload，否则老用户的跨设备勿扰设置永远进不来。
   */
  async syncDndFromAccountData(): Promise<DndWindow | null> {
    try {
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      const client = this.getNotificationClient()
      const event = client.getAccountData(DND_ACCOUNT_DATA_TYPE)
      if (!event) {
        return null
      }

      const raw = event.getContent() as {
        enabled?: boolean
        startTime?: unknown
        endTime?: unknown
        updatedAt?: unknown
      }
      if (!raw || typeof raw !== 'object') {
        return null
      }

      const normalized = normalizeDndWindow(raw)
      // 先刷新本地镜像，跨窗口改动才算数（另一个窗口刚改的 DND 不能被旧的账号数据顶回）
      const local = this.loadDndFromMirror()
      if (this.dndStore.hasMirror() && normalized.updatedAt <= local.updatedAt) {
        logger.info('[MatrixNotification] 服务端 DND 设置不新于本地，保留本地')
        return local
      }

      const applied = this.dndStore.replace(normalized)
      // 回写本地镜像：否则冷启动时 DND 不水合，用户会被静默重新打开通知，
      // 或在设置页看到一份与账号数据不一致的本地状态。
      this.dndStore.writeMirror(this.resolveMirrorUserId())
      logger.info('[MatrixNotification] 从服务端同步 DND 设置成功')
      return applied
    } catch (err) {
      logger.warn(`[MatrixNotification] 从服务端同步 DND 设置失败: ${err}`)
      return null
    }
  }

  /**
   * 解析当前账号 uid，用作 DND 镜像的归属。
   *
   * 客户端未就绪 / 尚未登录时返回 null：此时不写无主镜像，也不做换号判定
   * （没有身份就没有隔离维度），读取退回设备本地默认值。
   */
  private resolveMirrorUserId(): string | null {
    try {
      const client = matrixClientService.getClient() as { getUserId?: () => string | null } | null
      return client?.getUserId?.() ?? null
    } catch {
      return null
    }
  }

  /** 从 localStorage 镜像同步水合（跨窗口改动的唯一刷新入口）。 */
  private loadDndFromMirror(): DndWindow {
    const loaded = this.dndStore.load(this.resolveMirrorUserId())
    return loaded
  }

  /** 读取当前勿扰时段（每次都从 localStorage 镜像刷新，跨窗口改动无需重启即可生效）。 */
  getDndSettings(): DndWindow {
    return this.loadDndFromMirror()
  }

  /**
   * 勿扰时段的唯一写入点：更新时间戳 + localStorage 镜像，并复用既有 account data 同步。
   *
   * `updatedAt` 由服务打点，调用方只给窗口本身；同步是 fire-and-forget，但必须 `catch`，
   * 否则未就绪 / 网络失败会变成 unhandled rejection（`syncDndToAccountData` 内部已兜底）。
   */
  setDndSettings(settings: DndWindowInput): void {
    const written = this.dndStore.applyInput(settings, this.resolveMirrorUserId())

    void this.syncDndToAccountData(written).catch((err) => {
      logger.warn(`[MatrixNotification] DND 同步到服务端失败（本地镜像已写入）: ${err}`)
    })
  }

  /** 当前是否处于勿扰窗口；`now` 可注入，便于测试与纯函数保持一致。 */
  isWithinDndWindow(now: Date = new Date()): boolean {
    // 先刷新镜像：设置窗口/其它窗口改了 DND，已打开的聊天窗口要立刻看到
    this.loadDndFromMirror()
    return this.dndStore.isActive(now)
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
    this.configStore.setConfig(config)
    this.warnAboutCorruptConfigOnce()
    this.syncConfigToAccountData()
  }

  getConfig(): NotificationConfig {
    // 每次读取都从持久化存储刷新，跨窗口改动无需重启即可生效
    this.loadConfig()
    return this.configStore.getConfig()
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
    return decideShouldNotifyMessage(input, this.getConfig().events, this.isWithinDndWindow())
  }

  /**
   * 发送系统通知前的权限门：只检查、不申请（申请入口在设置页）。
   *
   * 非 Tauri 运行时 / 插件不可用时降级为「无权限」并记日志，见 `systemNotificationPermission`。
   */
  async canSendSystemNotification(): Promise<boolean> {
    return isSystemNotificationPermissionGranted()
  }

  /**
   * 供消息到达时决定通知标题与正文，`messageMutations` 的桌面通知路径消费此处结果。
   *
   * 标题始终保持调用点传入的干净值；折叠 / 关键词命中的可见信号由正文承载。
   */
  buildNotificationDisplay(title: string, body: string): { title: string; body: string } {
    return renderNotificationDisplay(title, body, this.getConfig().showMessageContent, this.t)
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
    return postNotificationAck(notificationId)
  }

  /**
   * 通知确认并带 ack → 已读回执的自动降级（探测结果按 TTL 缓存，见 `notificationAck`）。
   */
  async ackNotificationWithFallback(
    notificationId: string,
    roomId: string,
    eventId: string
  ): Promise<{
    success: boolean
    method: 'ack' | 'receipt'
  }> {
    return postNotificationAckWithFallback(this.getNotificationClient(), notificationId, roomId, eventId)
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
    clearAckEndpointCache()
  }
}

export const matrixNotificationService = new MatrixNotificationService()
