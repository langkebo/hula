/**
 * §8.3 邀请权限过滤 composable
 *
 * 从 Matrix account data (`im.hula.invite_blocklist`) 读取邀请权限配置，
 * 提供 `shouldRejectInvite(inviterUserId)` 判断是否应自动拒绝邀请。
 *
 * 三种模式：
 * - allow_all: 不拒绝任何邀请（默认）
 * - blocklist: 拒绝黑名单中的用户
 * - allowlist: 仅允许白名单中的用户
 */
import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('InvitePermissionFilter')

const ACCOUNT_DATA_TYPE = 'im.hula.invite_blocklist'

export type InvitePermissionMode = 'allow_all' | 'blocklist' | 'allowlist'

interface InvitePermissionConfig {
  mode: InvitePermissionMode
  blocklist: string[]
  allowlist: string[]
}

const DEFAULT_CONFIG: InvitePermissionConfig = {
  mode: 'allow_all',
  blocklist: [],
  allowlist: []
}

interface MatrixClientLike {
  getAccountData(type: string): { getContent: () => Record<string, unknown> } | undefined
  setAccountData(type: string, content: Record<string, unknown>): Promise<void>
}

export function useInvitePermissionFilter(client: MatrixClientLike) {
  const config = ref<InvitePermissionConfig>({ ...DEFAULT_CONFIG })

  async function loadConfig(): Promise<void> {
    try {
      const event = client.getAccountData(ACCOUNT_DATA_TYPE)
      if (event) {
        const content = event.getContent() as Partial<InvitePermissionConfig>
        config.value = {
          mode: content.mode ?? DEFAULT_CONFIG.mode,
          blocklist: content.blocklist ?? [],
          allowlist: content.allowlist ?? []
        }
      } else {
        config.value = { ...DEFAULT_CONFIG }
      }
    } catch (err) {
      logger.warn('加载邀请权限配置失败，使用默认值:', err)
      config.value = { ...DEFAULT_CONFIG }
    }
  }

  function shouldRejectInvite(inviterUserId: string): boolean {
    const { mode, blocklist, allowlist } = config.value
    if (mode === 'allow_all') return false
    if (mode === 'blocklist') return blocklist.includes(inviterUserId)
    if (mode === 'allowlist') return !allowlist.includes(inviterUserId)
    return false
  }

  async function persistConfig(): Promise<void> {
    try {
      await client.setAccountData(ACCOUNT_DATA_TYPE, { ...config.value })
    } catch (err) {
      logger.error('持久化邀请权限配置失败:', err)
      throw err
    }
  }

  async function updateConfig(next: InvitePermissionConfig): Promise<void> {
    config.value = { ...next }
    await persistConfig()
  }

  async function addToBlocklist(userId: string): Promise<void> {
    if (!config.value.blocklist.includes(userId)) {
      config.value.blocklist.push(userId)
    }
    config.value.mode = 'blocklist'
    await persistConfig()
  }

  async function removeFromBlocklist(userId: string): Promise<void> {
    config.value.blocklist = config.value.blocklist.filter((id) => id !== userId)
    await persistConfig()
  }

  async function addToAllowlist(userId: string): Promise<void> {
    if (!config.value.allowlist.includes(userId)) {
      config.value.allowlist.push(userId)
    }
    config.value.mode = 'allowlist'
    await persistConfig()
  }

  async function removeFromAllowlist(userId: string): Promise<void> {
    config.value.allowlist = config.value.allowlist.filter((id) => id !== userId)
    await persistConfig()
  }

  return {
    config,
    loadConfig,
    shouldRejectInvite,
    updateConfig,
    addToBlocklist,
    removeFromBlocklist,
    addToAllowlist,
    removeFromAllowlist
  }
}
