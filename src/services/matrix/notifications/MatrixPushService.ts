import { error, info } from '@tauri-apps/plugin-log'
import type { IPusher, IPushRule, IPushRules, MatrixClient, PushRuleAction } from 'matrix-js-sdk'
import { PushRuleKind, type TweakName } from 'matrix-js-sdk'
import { BaseMatrixService } from '../BaseMatrixService'

type PushRuleScope = 'global' | string

class MatrixPushService extends BaseMatrixService {
  async getPushers(): Promise<IPusher[]> {
    const client = this.getClient()
    try {
      const response = (await client.http.authedRequest('GET', '/_matrix/client/v3/pushers')) as { pushers?: unknown }
      return Array.isArray(response.pushers) ? (response.pushers as IPusher[]) : []
    } catch (err) {
      error(`[MatrixPush] 获取 pushers 失败: ${err}`)
      throw err
    }
  }

  async getPushRules(): Promise<IPushRules> {
    const client = this.getClient()
    try {
      return await client.getPushRules()
    } catch (err) {
      error(`[MatrixPush] 获取 push rules 失败: ${err}`)
      throw err
    }
  }

  async unregisterPusher(pushkey: string, appId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.http.authedRequest('POST', '/_matrix/client/v3/pushers/set', undefined, {
        pushkey,
        app_id: appId,
        kind: null
      })
      info(`[MatrixPush] 注销 pusher 成功: ${appId}/${pushkey}`)
    } catch (err) {
      error(`[MatrixPush] 注销 pusher 失败: ${err}`)
      throw err
    }
  }

  async setPushRuleEnabled(scope: PushRuleScope, kind: PushRuleKind | string, ruleId: string, enabled: boolean) {
    const client = this.getClient()
    try {
      const path = `/_matrix/client/v3/pushrules/${encodeURIComponent(scope)}/${encodeURIComponent(String(kind))}/${encodeURIComponent(
        ruleId
      )}/enabled`
      await client.http.authedRequest('PUT', path, undefined, { enabled })
      info(`[MatrixPush] 设置规则 enabled 成功: ${scope}/${String(kind)}/${ruleId} -> ${enabled}`)
    } catch (err) {
      error(`[MatrixPush] 设置规则 enabled 失败: ${err}`)
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
      const path = `/_matrix/client/v3/pushrules/${encodeURIComponent(scope)}/${encodeURIComponent(String(kind))}/${encodeURIComponent(
        ruleId
      )}/actions`
      await client.http.authedRequest('PUT', path, undefined, { actions })
      info(`[MatrixPush] 设置规则 actions 成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      error(`[MatrixPush] 设置规则 actions 失败: ${err}`)
      throw err
    }
  }

  async muteRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      const path = `/_matrix/client/v3/pushrules/global/room/${encodeURIComponent(roomId)}`
      await client.http.authedRequest('PUT', path, undefined, {
        actions: ['dont_notify'],
        enabled: true
      })
      info(`[MatrixPush] 房间静音成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixPush] 房间静音失败: ${err}`)
      throw err
    }
  }

  async unmuteRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      const path = `/_matrix/client/v3/pushrules/global/room/${encodeURIComponent(roomId)}`
      await client.http.authedRequest('DELETE', path)
      info(`[MatrixPush] 取消房间静音成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixPush] 取消房间静音失败: ${err}`)
      throw err
    }
  }

  async registerPusher(pusher: IPusher): Promise<void> {
    const client = this.getClient()
    try {
      const body: Record<string, unknown> = {
        pushkey: pusher.pushkey,
        kind: pusher.kind,
        app_id: pusher.app_id,
        app_display_name: pusher.app_display_name,
        device_display_name: pusher.device_display_name,
        lang: pusher.lang,
        data: pusher.data
      }
      if ((pusher as unknown as Record<string, unknown>).profile_tag)
        body.profile_tag = (pusher as unknown as Record<string, unknown>).profile_tag
      await client.http.authedRequest('POST', '/_matrix/client/v3/pushers/set', undefined, body)
      info(`[MatrixPush] 注册 pusher 成功: ${pusher.app_id}/${pusher.pushkey}`)
    } catch (err) {
      error(`[MatrixPush] 注册 pusher 失败: ${err}`)
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
      const path = `/_matrix/client/v3/pushrules/${encodeURIComponent(scope)}/${encodeURIComponent(String(kind))}/${encodeURIComponent(ruleId)}`
      const body: Record<string, unknown> = { actions }
      if (conditions) body.conditions = conditions
      if (pattern) body.pattern = pattern
      await client.http.authedRequest('PUT', path, undefined, body)
      info(`[MatrixPush] 创建推送规则成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      error(`[MatrixPush] 创建推送规则失败: ${err}`)
      throw err
    }
  }

  async deletePushRule(scope: PushRuleScope, kind: PushRuleKind | string, ruleId: string): Promise<void> {
    const client = this.getClient()
    try {
      const path = `/_matrix/client/v3/pushrules/${encodeURIComponent(scope)}/${encodeURIComponent(String(kind))}/${encodeURIComponent(ruleId)}`
      await client.http.authedRequest('DELETE', path)
      info(`[MatrixPush] 删除推送规则成功: ${scope}/${String(kind)}/${ruleId}`)
    } catch (err) {
      error(`[MatrixPush] 删除推送规则失败: ${err}`)
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
      { set_tweak: { tweak: 'sound' as TweakName, value: enabled ? 'default' : 'none' } }
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
}

export type { IPusher, IPushRule, IPushRules } from 'matrix-js-sdk'
export const matrixPushService = new MatrixPushService()
export default matrixPushService
