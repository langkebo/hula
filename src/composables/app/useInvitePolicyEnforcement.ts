import type { InvitePolicy } from '@/services/matrix/user/invitePolicy'
import type {
  InviteDeclinedInfo,
  InvitePolicyEnforcer,
  InvitePolicyEnforcerOptions
} from '@/services/matrix/user/invitePolicyEnforcer'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('InvitePolicyEnforcement')

export interface InvitePolicyEnforcementDeps {
  /** 工厂注入便于测试；生产环境用 createInvitePolicyEnforcer。 */
  createEnforcer: (options: InvitePolicyEnforcerOptions) => InvitePolicyEnforcer
  getCurrentUserId: () => string | undefined
  getPolicy: () => InvitePolicy
  savePolicy: (policy: InvitePolicy) => Promise<unknown>
  getContacts: () => Promise<string[]>
  onDeclined?: (info: InviteDeclinedInfo) => void
}

function sameUserIdList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

/**
 * 把邀请策略强制点接到应用生命周期。
 *
 * 职责边界：
 * - `InvitePolicyEnforcer` 负责"收到邀请事件后做什么"
 * - 这里负责"什么时候启动/停止"，以及把**好友列表同步进策略**
 *
 * contacts 同步不能省：`allowStrangers === false` 时判定依据是 contacts，
 * 如果它一直是空的，关闭"允许非联系人私聊"会把所有好友的邀请一并拒掉。
 */
export function useInvitePolicyEnforcement(deps: InvitePolicyEnforcementDeps) {
  let enforcer: InvitePolicyEnforcer | null = null

  function start(): void {
    if (enforcer) {
      return
    }
    enforcer = deps.createEnforcer({
      getCurrentUserId: deps.getCurrentUserId,
      getPolicy: deps.getPolicy,
      onDeclined: deps.onDeclined ?? (() => {})
    })
    enforcer.start()
  }

  function stop(): void {
    enforcer?.stop()
    enforcer = null
  }

  /**
   * 把当前好友列表写入策略的 contacts。
   *
   * 仅在列表变化时写 account data，避免每次启动都产生一次无意义的同步写。
   */
  async function syncContacts(): Promise<void> {
    try {
      const contacts = await deps.getContacts()
      const policy = deps.getPolicy()
      if (sameUserIdList(policy.contacts ?? [], contacts)) {
        return
      }
      await deps.savePolicy({ ...policy, contacts })
      logger.info(`已同步 ${contacts.length} 个联系人到邀请策略`)
    } catch (err) {
      // 同步失败不阻断启动：contacts 为空只会让判定更严格，不会放行
      logger.warn('同步联系人到邀请策略失败:', err)
    }
  }

  async function undo(roomId: string): Promise<boolean> {
    if (!enforcer) {
      return false
    }
    return enforcer.undo(roomId)
  }

  function canUndo(roomId: string): boolean {
    return enforcer?.canUndo(roomId) ?? false
  }

  return { start, stop, syncContacts, undo, canUndo }
}
