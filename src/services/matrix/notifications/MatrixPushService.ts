import type {
  ICreatePushRuleRequest,
  IPusher,
  IPusherRequest,
  IPushRule,
  IPushRules,
  MatrixClient,
  PushRuleAction
} from 'matrix-js-sdk'
import { PushRuleKind, TweakName } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { MatrixRequestDeduper } from '../MatrixRequestDeduper'
import { shouldNotifyForEventType } from './pushRules'

const logger = createLogger('MatrixPushService')

type PushRuleScope = 'global' | string

class MatrixPushService extends BaseMatrixService {
  /**
   * 获取当前账号已注册的全部推送设备（pusher）。
   *
   * 高频读取，经 `MatrixRequestDeduper` 并发去重，避免重复 HTTP 请求。
   */
  async getPushers(): Promise<IPusher[]> {
    // FT-132: 高频读取请求并发去重，避免并发调用发送多次 HTTP 请求
    return MatrixRequestDeduper.dedupe('pushers:list', async () => {
      const client = this.getClient()
      try {
        // SDK 的 PushManager.getPushers 返回 lib/push 的 IPusher（data 可选），与对外
        // 顶层 IPusher 类型在 data/kind/device_id 上存在差异，此处做边界类型桥接。
        return (await client.getPushManager().getPushers()) as IPusher[]
      } catch (err) {
        logger.error(`[MatrixPush] 获取 pushers 失败: ${err}`)
        throw err
      }
    })
  }

  /**
   * 获取当前账号的完整推送规则集合。
   */
  async getPushRules(): Promise<IPushRules> {
    const client = this.getClient()
    try {
      return await client.getPushManager().getPushRules()
    } catch (err) {
      logger.error(`[MatrixPush] 获取 push rules 失败: ${err}`)
      throw err
    }
  }

  /**
   * 注销指定的推送设备。
   *
   * 按 pushkey + appId 删除，并携带当前 device_id 以匹配 SDK 契约。
   */
  async unregisterPusher(pushkey: string, appId: string): Promise<void> {
    const client = this.getClient()
    try {
      // 使用 SDK PushManager.removePusher（SDK-7: 支持 deviceId 参数）
      await client.getPushManager().removePusher(pushkey, appId, client.getDeviceId() || undefined)
      logger.info(`[MatrixPush] 注销 pusher 成功: ${appId}/${pushkey}`)
    } catch (err) {
      logger.error(`[MatrixPush] 注销 pusher 失败: ${err}`)
      throw err
    }
  }

  /**
   * 启用或停用指定作用域下的单条推送规则。
   */
  async setPushRuleEnabled(scope: PushRuleScope, kind: PushRuleKind | string, ruleId: string, enabled: boolean) {
    const client = this.getClient()
    try {
      await client.getPushManager().setPushRuleEnabled(scope, kind as PushRuleKind, ruleId, enabled)
      logger.info(`[MatrixPush] 设置规则 enabled 成功: ${scope}/${String(kind)}/${ruleId} -> ${enabled}`)
    } catch (err) {
      logger.error(`[MatrixPush] 设置规则 enabled 失败: ${err}`)
      throw err
    }
  }

  async setPushRuleActions(
    scope: PushRuleScope,
    kind: PushRuleKind | string,
    ruleId: string,
    actions: PushRuleAction[]
  ) {
    const client = this.getClient()
    try {
      await client.getPushManager().setPushRuleActions(scope, kind as PushRuleKind, ruleId, actions)
      logger.info(`[MatrixPush] 设置规则 actions 成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      logger.error(`[MatrixPush] 设置规则 actions 失败: ${err}`)
      throw err
    }
  }

  /**
   * 静音指定房间（新增 room 级 mute 推送规则）。
   */
  async muteRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.getPushManager().muteRoom(roomId)
      logger.info(`[MatrixPush] 房间静音成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixPush] 房间静音失败: ${err}`)
      throw err
    }
  }

  /**
   * 取消指定房间的静音状态。
   */
  async unmuteRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.getPushManager().unmuteRoom(roomId)
      logger.info(`[MatrixPush] 取消房间静音成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixPush] 取消房间静音失败: ${err}`)
      throw err
    }
  }

  /**
   * 注册一个推送设备。
   *
   * 显式控制 device_id（SDK 默认由自身注入），故对请求体做字段扩展后再提交。
   */
  async registerPusher(pusher: IPusher): Promise<void> {
    const client = this.getClient()
    try {
      const deviceId = client.getDeviceId()
      const pusherData = pusher as IPusher & Record<string, unknown>

      // 使用 SDK PushManager（SDK-7: device_id 必填化）
      // SDK 的 IPusherRequest 通过 Omit 移除了 device_id 字段（由 SDK 自动注入当前 device_id），
      // 但 tjg 需要显式控制 device_id，因此扩展类型以允许该字段
      const pusherRequest = {
        pushkey: pusher.pushkey,
        kind: pusher.kind,
        app_id: pusher.app_id,
        app_display_name: pusher.app_display_name,
        device_display_name: pusher.device_display_name,
        lang: pusher.lang,
        data: pusher.data,
        device_id: (pusherData.device_id as string) || deviceId || undefined
      } as IPusherRequest & { device_id?: string }
      if (pusherData.profile_tag) {
        pusherRequest.profile_tag = pusherData.profile_tag as string
      }
      await client.getPushManager().setPusher(pusherRequest)
      logger.info(`[MatrixPush] 注册 pusher 成功: ${pusher.app_id}/${pusher.pushkey}`)
    } catch (err) {
      logger.error(`[MatrixPush] 注册 pusher 失败: ${err}`)
      throw err
    }
  }

  async addPushRule(
    scope: PushRuleScope,
    kind: PushRuleKind | string,
    ruleId: string,
    actions: PushRuleAction[],
    conditions?: Record<string, unknown>[],
    pattern?: string
  ): Promise<void> {
    const client = this.getClient()
    try {
      const rule: { actions: PushRuleAction[]; conditions?: Record<string, unknown>[]; pattern?: string } = {
        actions
      }
      if (conditions) rule.conditions = conditions
      if (pattern) rule.pattern = pattern
      await client.getPushManager().createPushRule(scope, kind as PushRuleKind, ruleId, rule as ICreatePushRuleRequest)
      logger.info(`[MatrixPush] 创建推送规则成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      logger.error(`[MatrixPush] 创建推送规则失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除指定作用域下的单条推送规则。
   */
  async deletePushRule(scope: PushRuleScope, kind: PushRuleKind | string, ruleId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.getPushManager().deletePushRule(scope, kind as PushRuleKind, ruleId)
      logger.info(`[MatrixPush] 删除推送规则成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      logger.error(`[MatrixPush] 删除推送规则失败: ${err}`)
      throw err
    }
  }

  /**
   * 判断指定房间是否处于静音状态。
   *
   * 不吞掉 `getPushRules` 的错误：鉴权/网络异常应抛出，仅「成功获取但无匹配规则」才返回 false。
   */
  async isRoomMuted(roomId: string): Promise<boolean> {
    // FT-124: 不吞掉 getPushRules 的错误。鉴权失败/网络错误应抛出，
    // 仅当 push rules 成功获取但无匹配规则时返回 false。
    const rules = await this.getPushRules()
    const roomRules = rules.global?.room ?? []
    return roomRules.some((rule: IPushRule) => rule.rule_id === roomId && rule.enabled !== false)
  }

  subscribePushRules(listener: (rules: IPushRules) => void): () => void {
    const client = this.getClient() as MatrixClient & {
      on(event: string, callback: (...args: unknown[]) => void): void
      removeListener?: (event: string, callback: (...args: unknown[]) => void) => void
      off?: (event: string, callback: (...args: unknown[]) => void) => void
    }

    const handler = (...args: unknown[]) => listener(args[0] as IPushRules)
    client.on('pushRules', handler)

    return () => {
      if (typeof client.removeListener === 'function') {
        client.removeListener('pushRules', handler)
        return
      }
      if (typeof client.off === 'function') {
        client.off('pushRules', handler)
      }
    }
  }

  /**
   * 切换全局主开关（`.m.rule.master`）。
   *
   * 注意入参语义取反：传入 `true` 表示启用通知，对应停用 master 拦截规则。
   */
  async setMasterRuleEnabled(enabled: boolean): Promise<void> {
    await this.setPushRuleEnabled('global', PushRuleKind.Override, '.m.rule.master', !enabled)
  }

  /**
   * 设置指定房间规则的提示音（通过 sound tweak 的 `default` / `none` 切换）。
   */
  async setRoomSoundEnabled(ruleId: string, enabled: boolean): Promise<void> {
    await this.setPushRuleActions('global', PushRuleKind.RoomSpecific, ruleId, [
      { set_tweak: TweakName.Sound, value: enabled ? 'default' : 'none' }
    ])
  }

  /**
   * 启用或停用指定房间级推送规则。
   */
  async setRoomRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
    await this.setPushRuleEnabled('global', PushRuleKind.RoomSpecific, ruleId, enabled)
  }

  /**
   * 从推送规则集合中提取 override 类规则。
   */
  getOverrideRules(rules: IPushRules): IPushRule[] {
    return rules.global?.override ?? []
  }

  /**
   * 从推送规则集合中提取 room 类规则。
   */
  getRoomRules(rules: IPushRules): IPushRule[] {
    return rules.global?.room ?? []
  }

  /**
   * §9.2.5 判断事件类型是否应触发推送通知
   *
   * 覆盖 Matrix 核心事件 + Tjg 扩展事件（好友请求/Widget/AI 工具结果）。
   */
  shouldNotify(eventType: string): boolean {
    return shouldNotifyForEventType(eventType)
  }
}

export type { IPusher, IPushRule, IPushRules } from 'matrix-js-sdk'
export const matrixPushService = new MatrixPushService()
