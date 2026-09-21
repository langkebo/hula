import { type InvitePolicy, normalizeInvitePolicy } from '@/services/matrix/user/invitePolicy'
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
  /** 宽松读，供判定路径使用（读取失败回落默认策略，不阻断判定）。 */
  getPolicy: () => InvitePolicy
  /**
   * 严格读服务端策略，供 **写路径** 使用。
   *
   * - 返回 `null`：账号上从未存过策略，可以安全以默认值为基线创建；
   * - 抛错：读取失败，调用方必须**跳过写入**，不能拿默认值整对象覆盖服务端。
   */
  getPolicyStrict: () => Promise<InvitePolicy | null>
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
 * `contacts` 同步只维护 account data 里的展示/调试快照，**不参与判定**：
 * 判定依据是 `ContactStateResolver` 的动态三态结果（查询失败 = `unknown` → fail-open），
 * 详见 `invitePolicy.ts` 的 `shouldRejectInvite`。
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
   * **写前必须严格重读服务端策略**：`contacts` 只是 account data 上的展示/调试快照，
   * 其余字段（mode / blocklist / allowlist / allowStrangers / 好友请求三项）都归设置页
   * 所有。若拿本地缓存或默认值整对象回写，新设备 / 清缓存 / 换账号后启动就会把用户
   * 服务端的黑名单与隐私设置静默覆盖成默认值。
   *
   * 因此这里只合并 `contacts`，且：
   * - 严格读抛错（读取失败）→ 跳过写入，绝不覆盖；
   * - 严格读返回 null（从未存过）→ 以默认策略为基线创建；
   * - 联系人未变化 → 不写，避免每次启动产生无意义的同步写。
   */
  async function syncContacts(): Promise<void> {
    let contacts: string[]
    try {
      contacts = await deps.getContacts()
    } catch (err) {
      // 同步失败不阻断启动：contacts 为空只会让判定更严格，不会放行
      logger.warn('读取好友列表失败，跳过邀请策略同步:', err)
      return
    }

    let serverPolicy: InvitePolicy | null
    try {
      serverPolicy = await deps.getPolicyStrict()
    } catch (err) {
      logger.warn('读取服务端邀请策略失败，跳过联系人同步（不覆盖服务端策略）:', err)
      return
    }

    const base = serverPolicy ?? normalizeInvitePolicy(null)
    if (sameUserIdList(base.contacts ?? [], contacts)) {
      return
    }

    try {
      await deps.savePolicy({ ...base, contacts })
      logger.info(`已同步 ${contacts.length} 个联系人到邀请策略`)
    } catch (err) {
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
