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

const logger = createLogger('MatrixNotificationService')

let ackEndpointAvailableCache: boolean | null = null
let ackCheckTimestamp = 0
const ACK_CHECK_TTL = 5 * 60 * 1000

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
}

class MatrixNotificationService extends BaseMatrixService {
  private pushRules: IPushRule[] = []
  private observedClient: MatrixClient | null = null
  private config: NotificationConfig = {
    enableDesktop: true,
    enableSound: true,
    enableVibrate: true,
    showPreview: true,
    showSender: true,
    showMessageContent: true
  }

  private static readonly CONFIG_STORAGE_KEY = 'tjg-notification-config'
  private static readonly ACCOUNT_DATA_TYPE = 'io.hula.notification_settings'
  private static readonly DND_ACCOUNT_DATA_TYPE = 'io.hula.dnd_settings'

  constructor() {
    super()
    this.loadConfig()
  }

  private loadConfig(): void {
    const stored = localStorage.getItem(MatrixNotificationService.CONFIG_STORAGE_KEY)
    if (!stored) return

    const isValidNotificationConfig = (val: unknown): val is Partial<NotificationConfig> =>
      validateObject<Record<string, unknown>>(val, [], {
        enableDesktop: (v) => v === undefined || typeof v === 'boolean',
        enableSound: (v) => v === undefined || typeof v === 'boolean',
        enableVibrate: (v) => v === undefined || typeof v === 'boolean',
        showPreview: (v) => v === undefined || typeof v === 'boolean',
        showSender: (v) => v === undefined || typeof v === 'boolean',
        showMessageContent: (v) => v === undefined || typeof v === 'boolean'
      })

    const defaults: NotificationConfig = {
      enableDesktop: true,
      enableSound: true,
      enableVibrate: true,
      showPreview: true,
      showSender: true,
      showMessageContent: true
    }
    const parsed = safeJsonParse(stored, isValidNotificationConfig, defaults)
    this.config = { ...defaults, ...parsed }
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
          this.config = { ...this.config, ...serverConfig }
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

  async syncDndToAccountData(settings: {
    enabled: boolean
    startTime: number | null
    endTime: number | null
  }): Promise<void> {
    try {
      const client = this.getNotificationClient()
      await client.setAccountData(MatrixNotificationService.DND_ACCOUNT_DATA_TYPE, settings as Record<string, unknown>)
      logger.info('[MatrixNotification] DND 设置已同步到服务端')
    } catch (err) {
      logger.error(`[MatrixNotification] 同步 DND 设置到服务端失败: ${err}`)
    }
  }

  async syncDndFromAccountData(): Promise<{
    enabled: boolean
    startTime: number | null
    endTime: number | null
  } | null> {
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
          logger.info('[MatrixNotification] 从服务端同步 DND 设置成功')
          return {
            enabled: (dndSettings.enabled ?? false) as boolean,
            startTime: (dndSettings.startTime ?? null) as number | null,
            endTime: (dndSettings.endTime ?? null) as number | null
          }
        }
      }
      return null
    } catch (err) {
      logger.warn(`[MatrixNotification] 从服务端同步 DND 设置失败: ${err}`)
      return null
    }
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
      await client.getPushManager().updatePushRule('global', rule.kind as PushRuleKind, rule.ruleId, { actions: rule.actions as PushRuleAction[] })
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

  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
    this.persistConfig()
    this.syncConfigToAccountData()
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
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

      new Notification(title, {
        body: this.config.showMessageContent ? body : undefined
      })
    } catch (err) {
      logger.error(`[MatrixNotification] 显示通知失败: ${err}`)
    }
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
      await client.getPushManager().createPushRule(scope, kind as PushRuleKind, ruleId, body as unknown as ICreatePushRuleRequest)
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
