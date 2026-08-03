import type {
  IPusher,
  IPusherRequest,
  IPushRule,
  IPushRules,
  MatrixClient,
  PushRuleAction,
  PushRuleCondition
} from 'matrix-js-sdk'
import { PushRuleKind, TweakName } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { shouldNotifyForEventType } from './pushRules'

const logger = createLogger('MatrixPushService')

type PushRuleScope = 'global' | string

class MatrixPushService extends BaseMatrixService {
  async getPushers(): Promise<IPusher[]> {
    const client = this.getClient()
    try {
      return (await client.getPushManager().getPushers()) as unknown as IPusher[]
    } catch (err) {
      logger.error(`[MatrixPush] 获取 pushers 失败: ${err}`)
      throw err
    }
  }

  async getPushRules(): Promise<IPushRules> {
    const client = this.getClient()
    try {
      return await client.getPushRules()
    } catch (err) {
      logger.error(`[MatrixPush] 获取 push rules 失败: ${err}`)
      throw err
    }
  }

  async unregisterPusher(pushkey: string, appId: string): Promise<void> {
    const client = this.getClient()
    try {
      const deviceId = client.getDeviceId()
      // SDK PushManager.removePusher（SDK-7: 支持 deviceId 参数）
      await client.getPushManager().removePusher(pushkey, appId, deviceId || undefined)
      logger.info(`[MatrixPush] 注销 pusher 成功: ${appId}/${pushkey}`)
    } catch (err) {
      logger.error(`[MatrixPush] 注销 pusher 失败: ${err}`)
      throw err
    }
  }

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

  async registerPusher(pusher: IPusher): Promise<void> {
    const client = this.getClient()
    try {
      const deviceId = client.getDeviceId()
      const pusherData = pusher as unknown as Record<string, unknown>
      // 使用 SDK PushManager（SDK-7: device_id 必填化）
      // SDK 的 IPusherRequest 通过 Omit 移除了 device_id 字段（由 SDK 自动注入当前 device_id），
      // 但 hula 需要显式控制 device_id，因此扩展类型以允许该字段
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
      await client.getPushManager().createPushRule(scope, kind as PushRuleKind, ruleId, {
        actions,
        conditions: conditions as unknown as PushRuleCondition[],
        pattern
      })
      logger.info(`[MatrixPush] 创建推送规则成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      logger.error(`[MatrixPush] 创建推送规则失败: ${err}`)
      throw err
    }
  }

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

  async isRoomMuted(roomId: string): Promise<boolean> {
    try {
      const rules = await this.getPushRules()
      const roomRules = rules.global?.room ?? []
      return roomRules.some((rule: IPushRule) => rule.rule_id === roomId && rule.enabled !== false)
    } catch {
      return false
    }
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

  async setMasterRuleEnabled(enabled: boolean): Promise<void> {
    await this.setPushRuleEnabled('global', PushRuleKind.Override, '.m.rule.master', !enabled)
  }

  async setRoomSoundEnabled(ruleId: string, enabled: boolean): Promise<void> {
    await this.setPushRuleActions('global', PushRuleKind.RoomSpecific, ruleId, [
      { set_tweak: TweakName.Sound, value: enabled ? 'default' : 'none' }
    ])
  }

  async setRoomRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
    await this.setPushRuleEnabled('global', PushRuleKind.RoomSpecific, ruleId, enabled)
  }

  getOverrideRules(rules: IPushRules): IPushRule[] {
    return rules.global?.override ?? []
  }

  getRoomRules(rules: IPushRules): IPushRule[] {
    return rules.global?.room ?? []
  }

  /**
   * §9.2.5 判断事件类型是否应触发推送通知
   *
   * 覆盖 Matrix 核心事件 + HuLa 扩展事件（好友请求/Widget/AI 工具结果）。
   */
  shouldNotify(eventType: string): boolean {
    return shouldNotifyForEventType(eventType)
  }
}

export type { IPusher, IPushRule, IPushRules } from 'matrix-js-sdk'
export const matrixPushService = new MatrixPushService()
