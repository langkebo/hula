import { computed, onMounted, ref } from 'vue'
import { useOperationFeedback } from '@/composables/common/useOperationFeedback'
import { matrixAccountService } from '@/services/matrix'
import { cacheDmPrivacyPreferences, loadDmPrivacyPreferences } from '@/services/matrix/user/dmPrivacyPreferences'
import {
  type InvitePolicy,
  type InvitePolicyMode,
  isInvitePolicyMode,
  normalizeInvitePolicy,
  normalizeUserId
} from '@/services/matrix/user/invitePolicy'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('InvitePermissionPanel')

export interface InvitePermissionPanelProps {
  visible?: boolean | undefined
  mode?: InvitePolicyMode | undefined
  blocklist?: string[] | undefined
  allowlist?: string[] | undefined
}

/**
 * 桌面邀请权限面板的数据与动作。
 *
 * 从 `InvitePermissionPanel.vue` 抽出：面板自身从 account data 读策略、自己写回，
 * 与移动端 `MobileInvitePermission.vue` 使用同一套 `invitePolicy` API 与判定语义。
 * 数据源统一为 `im.hula.invite_policy`（旧 key `im.hula.invite_blocklist`
 * 与后端房间级表同名，已废弃）。
 *
 * `mode`/`blocklist`/`allowlist` 仍可传入用于覆盖初值（测试与嵌入场景），
 * 但不再要求父组件回写。
 */
export function useInvitePermissionPanel(props: InvitePermissionPanelProps) {
  const { reportFailure } = useOperationFeedback()

  const visible = computed(() => props.visible)

  /**
   * 调用方（测试 / 嵌入场景）是否显式给了策略初值。
   *
   * 有显式初值时**不回读 account data**：否则挂载后立即被账号策略覆盖，
   * 传入的 mode/名单会静默失效。
   */
  const hasPolicyOverride = props.mode !== undefined || props.blocklist !== undefined || props.allowlist !== undefined

  const loading = ref(!hasPolicyOverride)
  // 读取失败时保持未知，不能把默认策略（allow_all）当成账号真实设置
  const loadFailed = ref(false)
  const mode = ref<InvitePolicyMode>(props.mode ?? 'allow_all')
  const blocklist = ref<string[]>(props.blocklist ?? [])
  const allowlist = ref<string[]>(props.allowlist ?? [])
  const allowStrangers = ref(true)
  const contacts = ref<string[]>([])
  const encryptByDefault = ref(loadDmPrivacyPreferences().encryptByDefault)
  const blocklistInput = ref('')
  const allowlistInput = ref('')

  onMounted(loadPolicy)

  async function loadPolicy() {
    if (hasPolicyOverride) {
      return
    }
    loading.value = true
    loadFailed.value = false
    try {
      // 严格变体：宽松版会把失败折叠成默认策略，等于把「读不到」显示成「允许所有人」
      applyPolicy(await matrixAccountService.getInvitePolicyStrict())
    } catch (error) {
      logger.error('Failed to load invite policy', error)
      loadFailed.value = true
    } finally {
      loading.value = false
    }
  }

  /**
   * 最近一次读到的完整策略。
   *
   * `buildPolicy()` 只覆盖本面板拥有的字段，其余字段（如好友请求三项）从这里
   * 原样带过去——否则每次改模式/名单都会把兄弟编辑器拥有的字段重置成默认值。
   */
  let appliedPolicy: InvitePolicy = normalizeInvitePolicy(null)

  function applyPolicy(policy: InvitePolicy | null) {
    const normalized = normalizeInvitePolicy(policy)
    appliedPolicy = normalized
    mode.value = normalized.mode
    blocklist.value = normalized.blocklist
    allowlist.value = normalized.allowlist
    allowStrangers.value = normalized.allowStrangers
    contacts.value = normalized.contacts
  }

  function buildPolicy(): InvitePolicy {
    return {
      ...appliedPolicy,
      mode: mode.value,
      blocklist: blocklist.value,
      allowlist: allowlist.value,
      allowStrangers: allowStrangers.value,
      contacts: contacts.value
    }
  }

  /**
   * 写回 account data。
   *
   * **写前必须重读最新策略**：`SecuritySettings` 同时挂了 `BlockedUsersSection`，
   * 两者写同一份 account data。面板挂载时的快照会过期，整份写回会把对方刚保存的
   * 改动静默覆盖。
   *
   * 传了显式策略初值（props override）时以本地面板状态为基；重读走**严格**
   * 变体 `getInvitePolicyStrict()`，读取失败直接抛错中止写入。
   */
  async function persist(mutate: (base: InvitePolicy) => InvitePolicy): Promise<void> {
    try {
      const base = hasPolicyOverride
        ? normalizeInvitePolicy(buildPolicy())
        : normalizeInvitePolicy(await matrixAccountService.getInvitePolicyStrict())
      const next = mutate(base)
      applyPolicy(next)
      await matrixAccountService.setInvitePolicy(next)
    } catch (error) {
      logger.error('Failed to persist invite policy', error)
      reportFailure(error)
    }
  }

  async function handleModeChange(value: InvitePolicyMode | number | string) {
    const next = String(value)
    if (!isInvitePolicyMode(next) || next === mode.value) {
      return
    }
    mode.value = next
    await persist((base) => ({ ...base, mode: next }))
  }

  /**
   * 「允许非联系人私聊」在 `allow_all` 与 `blocklist` 下都参与判定：
   * `blocklist` 是叠加在它之上的拒绝维度（名单里的人无条件拒），名单外的用户
   * 仍由这个开关决定。只有 `allowlist` 由名单显式决定，开关不生效。
   */
  async function handleAllowStrangersChange(value: boolean) {
    allowStrangers.value = value
    await persist((base) => ({ ...base, allowStrangers: value }))
  }

  /** 新私聊默认加密是本机偏好，不进 account data。 */
  function handleEncryptByDefaultChange(value: boolean) {
    encryptByDefault.value = value
    cacheDmPrivacyPreferences({ encryptByDefault: value })
  }

  async function handleAddUser(listType: 'blocklist' | 'allowlist') {
    const raw = listType === 'blocklist' ? blocklistInput.value : allowlistInput.value
    const userId = normalizeUserId(raw)
    if (!userId) {
      return
    }

    const list = listType === 'blocklist' ? blocklist : allowlist
    if (list.value.includes(userId)) {
      return
    }

    if (listType === 'blocklist') {
      blocklistInput.value = ''
    } else {
      allowlistInput.value = ''
    }

    await persist((base) => {
      const current = base[listType]
      return current.includes(userId) ? base : { ...base, [listType]: [...current, userId] }
    })
  }

  async function handleRemoveUser(listType: 'blocklist' | 'allowlist', userId: string) {
    await persist((base) => ({ ...base, [listType]: base[listType].filter((id) => id !== userId) }))
  }

  return {
    visible,
    loading,
    loadFailed,
    mode,
    blocklist,
    allowlist,
    allowStrangers,
    encryptByDefault,
    blocklistInput,
    allowlistInput,
    loadPolicy,
    handleModeChange,
    handleAllowStrangersChange,
    handleEncryptByDefaultChange,
    handleAddUser,
    handleRemoveUser
  }
}
