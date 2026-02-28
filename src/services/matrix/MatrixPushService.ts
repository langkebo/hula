import type {
  IPushRules,
  IPusher,
  IPusherRequest,
  IPushRule,
  PushRuleAction,
  PushRuleKind,
  EmptyObject
} from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export class MatrixPushService {
  async registerPusher(pusher: IPusherRequest): Promise<EmptyObject> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.setPusher(pusher)
      info(`[MatrixPush] 注册推送器成功: ${pusher.pushkey}`)
      return result
    } catch (err) {
      error(`[MatrixPush] 注册推送器失败: ${err}`)
      throw err
    }
  }

  async unregisterPusher(pushKey: string, appId: string): Promise<EmptyObject> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.removePusher(pushKey, appId)
      info(`[MatrixPush] 注销推送器成功: ${pushKey}`)
      return result
    } catch (err) {
      error(`[MatrixPush] 注销推送器失败: ${err}`)
      throw err
    }
  }

  async getPushers(): Promise<IPusher[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.getPushers()
      info(`[MatrixPush] 获取推送器列表成功: ${result.pushers.length} 个`)
      return result.pushers
    } catch (err) {
      error(`[MatrixPush] 获取推送器列表失败: ${err}`)
      throw err
    }
  }

  async getPushRules(): Promise<IPushRules> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const rules = await client.getPushRules()
      info('[MatrixPush] 获取推送规则成功')
      return rules
    } catch (err) {
      error(`[MatrixPush] 获取推送规则失败: ${err}`)
      throw err
    }
  }

  async addPushRule(
    scope: string,
    kind: PushRuleKind,
    ruleId: string,
    body: Pick<IPushRule, 'actions' | 'conditions' | 'pattern'>
  ): Promise<EmptyObject> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.addPushRule(scope, kind, ruleId, body)
      info(`[MatrixPush] 添加推送规则成功: ${ruleId}`)
      return result
    } catch (err) {
      error(`[MatrixPush] 添加推送规则失败: ${err}`)
      throw err
    }
  }

  async deletePushRule(scope: string, kind: PushRuleKind, ruleId: string): Promise<EmptyObject> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.deletePushRule(scope, kind, ruleId)
      info(`[MatrixPush] 删除推送规则成功: ${ruleId}`)
      return result
    } catch (err) {
      error(`[MatrixPush] 删除推送规则失败: ${err}`)
      throw err
    }
  }

  async setPushRuleEnabled(scope: string, kind: PushRuleKind, ruleId: string, enabled: boolean): Promise<EmptyObject> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.setPushRuleEnabled(scope, kind, ruleId, enabled)
      info(`[MatrixPush] ${enabled ? '启用' : '禁用'}推送规则成功: ${ruleId}`)
      return result
    } catch (err) {
      error(`[MatrixPush] 修改推送规则状态失败: ${err}`)
      throw err
    }
  }

  async setPushRuleActions(
    scope: string,
    kind: PushRuleKind,
    ruleId: string,
    actions: PushRuleAction[]
  ): Promise<EmptyObject> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixPush] 客户端未初始化')
    }
    try {
      const result = await client.setPushRuleActions(scope, kind, ruleId, actions)
      info(`[MatrixPush] 设置推送规则动作成功: ${ruleId}`)
      return result
    } catch (err) {
      error(`[MatrixPush] 设置推送规则动作失败: ${err}`)
      throw err
    }
  }
}

export const matrixPushService = new MatrixPushService()
