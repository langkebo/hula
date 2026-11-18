import { useDialog } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { matrixAccountService, matrixFriendGroups, matrixFriendOperations } from '@/services/matrix'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { DEFAULT_INVITE_POLICY, type InvitePolicy, normalizeInvitePolicy } from '@/services/matrix/user/invitePolicy'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FriendsSettings')

export interface FriendGroup {
  group_id: string
  name: string
  member_count: number
}

export interface FriendRequest {
  user_id: string
  message?: string
}

/**
 * 好友设置页的数据与动作。
 *
 * 从 `FriendsSettings.vue` 抽出：组件只负责区块编排，读写与失败回滚都在这里。
 */
export function useFriendsSettings() {
  const { showFeedback } = useActionFeedback()
  const dialog = useDialog()
  const { t } = useI18n()
  const { ensureSessionReady } = useWindowSessionReady()

  /**
   * 好友请求三开关的唯一数据源是账号级邀请策略 `im.hula.invite_policy` 的
   * account data。
   *
   * 消费方在 synapse-rust 后端：前端只负责读写，不做本地强制，所以这里读到的值
   * 只是「后端会读到的策略」，不是「功能已生效」的证据。
   */
  const allowFriendRequests = ref(DEFAULT_INVITE_POLICY.allowFriendRequests)
  const autoAcceptFriends = ref(DEFAULT_INVITE_POLICY.autoAcceptFriends)
  const requireFriendRequestMessage = ref(DEFAULT_INVITE_POLICY.requireFriendRequestMessage)

  /**
   * 最近一次「成功读入或成功写回」的三个开关值。
   *
   * `n-switch` 是先改本地模型再触发 `handleToggle`：保存失败时若不回滚，
   * 界面会显示成已保存，而账号上的策略其实没变。失败时回滚到这里。
   */
  const persistedFlags = ref({
    allowFriendRequests: DEFAULT_INVITE_POLICY.allowFriendRequests,
    autoAcceptFriends: DEFAULT_INVITE_POLICY.autoAcceptFriends,
    requireFriendRequestMessage: DEFAULT_INVITE_POLICY.requireFriendRequestMessage
  })

  const loadingGroups = ref(false)
  const loadingRequests = ref(false)
  /**
   * 好友请求策略读取失败标记。
   *
   * 宽松变体 `getInvitePolicy()` 会把失败折叠成默认策略，界面于是把「允许所有好友请求」
   * 这类默认值当成账号真实设置展示。读取走严格变体，失败时单独记标记并渲染错误态 + 重试，
   * 不渲染三个开关，避免把读失败谎报成账号设置。
   */
  const settingsLoadFailed = ref(false)
  const friendGroups = ref<FriendGroup[]>([])
  const incomingRequests = ref<FriendRequest[]>([])
  const outgoingRequests = ref<FriendRequest[]>([])

  /**
   * 分组 / 请求列表的读取失败标记。
   *
   * 两处 catch 都把失败吞成空数组，界面会显示成「暂无分组 / 暂无好友申请」，
   * 等于把「读失败」谎报成「确实没有」。这里单独记失败，让页面用 partial 态
   * 说明「部分数据缺失」，而不是伪装成空态。
   */
  const groupsLoadFailed = ref(false)
  const requestsLoadFailed = ref(false)
  const partialFailures = computed(() => Number(groupsLoadFailed.value) + Number(requestsLoadFailed.value))

  const showCreateGroup = ref(false)
  const showEditGroup = ref(false)
  const newGroupName = ref('')
  const editGroupName = ref('')
  const editingGroupId = ref('')

  onMounted(async () => {
    // 好友分组/请求与好友请求策略都依赖 MatrixClient（策略存在 account data 上，必须先能读到
    // 账号上的真实值，否则拿到的是归一化默认值）。恢复统一走 `useWindowSessionReady()`
    // （幂等、每窗口一次），不再自带 waitForClientReady(10s) 白等。
    const sessionState = await ensureSessionReady()
    if (sessionState !== 'ready') {
      logger.warn(`[FriendsSettings] session state=${sessionState}; friend request policy may fall back to defaults`)
    }
    await loadSettings()
    await loadFriendGroups()
    await loadFriendRequests()
  })

  async function loadSettings() {
    settingsLoadFailed.value = false
    try {
      // 严格变体：宽松版会把读取失败折叠成默认策略，等于把「读不到」显示成账号真实设置
      const policy = normalizeInvitePolicy(await matrixAccountService.getInvitePolicyStrict())
      allowFriendRequests.value = policy.allowFriendRequests
      autoAcceptFriends.value = policy.autoAcceptFriends
      requireFriendRequestMessage.value = policy.requireFriendRequestMessage
      persistedFlags.value = {
        allowFriendRequests: policy.allowFriendRequests,
        autoAcceptFriends: policy.autoAcceptFriends,
        requireFriendRequestMessage: policy.requireFriendRequestMessage
      }
    } catch (error) {
      logger.warn('Failed to load friend request policy:', error)
      settingsLoadFailed.value = true
    }
  }

  /**
   * 写回好友请求策略。
   *
   * **写前必须重读**：同一份 account data 还被 `BlockedUsersSection` 与
   * `InvitePermissionPanel` 编辑（SecuritySettings 同时挂载它们）。若用挂载时的
   * 快照整份写回，对方刚保存的改动会被静默覆盖。这里只覆盖本组件拥有的三个字段。
   *
   * 重读走**严格**变体 `getInvitePolicyStrict()`：读取失败会抛错而不是回落
   * `normalizeInvitePolicy(null)` 的默认策略。否则「读失败 + 写成功」会用
   * `{mode: 'allow_all', blocklist: [], allowlist: []}` 静默删掉用户已有的策略，
   * 还会因为 PUT 成功而弹「已保存」。
   */
  async function saveSettings() {
    const latest = normalizeInvitePolicy(await matrixAccountService.getInvitePolicyStrict())
    const next: InvitePolicy = {
      ...latest,
      allowFriendRequests: allowFriendRequests.value,
      autoAcceptFriends: autoAcceptFriends.value,
      requireFriendRequestMessage: requireFriendRequestMessage.value
    }
    await matrixAccountService.setInvitePolicy(next)
    persistedFlags.value = {
      allowFriendRequests: next.allowFriendRequests,
      autoAcceptFriends: next.autoAcceptFriends,
      requireFriendRequestMessage: next.requireFriendRequestMessage
    }
  }

  async function loadFriendGroups() {
    loadingGroups.value = true
    groupsLoadFailed.value = false
    try {
      const groups = await matrixFriendGroups.getFriendGroups()
      friendGroups.value = (groups || []).map((g) => ({
        group_id: g.group_id,
        name: g.name,
        member_count: g.member_count || 0
      }))
    } catch {
      groupsLoadFailed.value = true
      logger.warn('Failed to load friend groups')
    } finally {
      loadingGroups.value = false
    }
  }

  async function loadFriendRequests() {
    loadingRequests.value = true
    requestsLoadFailed.value = false
    try {
      const [incomingResult, outgoingResult] = await Promise.allSettled([
        matrixFriendService.getIncomingRequests(),
        matrixFriendService.getOutgoingRequests()
      ])

      requestsLoadFailed.value = incomingResult.status === 'rejected' || outgoingResult.status === 'rejected'

      const incoming = incomingResult.status === 'fulfilled' ? incomingResult.value : []
      const outgoing = outgoingResult.status === 'fulfilled' ? outgoingResult.value : []
      incomingRequests.value = (incoming || []).map((r) => ({
        user_id: r.user_id,
        ...(r.message === undefined ? {} : { message: r.message })
      }))
      outgoingRequests.value = (outgoing || []).map((r) => ({
        user_id: r.user_id
      }))
    } catch {
      logger.error('Failed to load friend requests')
    } finally {
      loadingRequests.value = false
    }
  }

  /** partial 态的重试只补读失败的分组与请求，不重发策略写入 */
  function retryPartialLoads() {
    void Promise.all([loadFriendGroups(), loadFriendRequests()])
  }

  async function handleToggle() {
    try {
      await saveSettings()
      showFeedback(t('setting.friends.feedback.settings_updated'), 'success')
    } catch (error) {
      logger.error('Failed to save friend request policy:', error)
      // 保存没有成功：把开关回滚到最近一次确认过的值，不显示成已生效
      allowFriendRequests.value = persistedFlags.value.allowFriendRequests
      autoAcceptFriends.value = persistedFlags.value.autoAcceptFriends
      requireFriendRequestMessage.value = persistedFlags.value.requireFriendRequestMessage
      showFeedback(t('setting.invite_permission.save_failed'), 'error')
    }
  }

  async function handleCreateGroup() {
    if (!newGroupName.value.trim()) {
      showFeedback(t('setting.friends.groups.name_required'), 'warning')
      return false
    }
    try {
      await matrixFriendGroups.createFriendGroup(newGroupName.value.trim())
      newGroupName.value = ''
      showFeedback(t('setting.friends.groups.create_success'), 'success')
      await loadFriendGroups()
    } catch {
      showFeedback(t('setting.friends.groups.create_failed'), 'error')
    }
    showCreateGroup.value = false
  }

  function handleEditGroup(group: FriendGroup) {
    editingGroupId.value = group.group_id
    editGroupName.value = group.name
    showEditGroup.value = true
  }

  async function handleSaveGroup() {
    if (!editGroupName.value.trim()) {
      showFeedback(t('setting.friends.groups.name_required'), 'warning')
      return false
    }
    try {
      await matrixFriendGroups.renameFriendGroup(editingGroupId.value, editGroupName.value.trim())
      showFeedback(t('setting.friends.groups.rename_success'), 'success')
      showEditGroup.value = false
      await loadFriendGroups()
    } catch {
      showFeedback(t('setting.friends.groups.rename_failed'), 'error')
    }
  }

  function handleDeleteGroup(group: FriendGroup) {
    dialog.warning({
      title: t('setting.friends.groups.delete_title'),
      content: t('setting.friends.groups.delete_confirm', { name: group.name }),
      positiveText: t('setting.friends.groups.delete_confirm_action'),
      negativeText: t('setting.common.cancel'),
      onPositiveClick: async () => {
        try {
          await matrixFriendGroups.deleteFriendGroup(group.group_id)
          showFeedback(t('setting.friends.groups.delete_success'), 'success')
          await loadFriendGroups()
        } catch {
          showFeedback(t('setting.friends.groups.delete_failed'), 'error')
        }
      }
    })
  }

  async function handleAcceptRequest(req: FriendRequest) {
    try {
      await matrixFriendOperations.acceptFriendRequest(req.user_id)
      showFeedback(t('setting.friends.pending.accept_success'), 'success')
      await loadFriendRequests()
    } catch {
      showFeedback(t('setting.friends.pending.accept_failed'), 'error')
    }
  }

  async function handleRejectRequest(req: FriendRequest) {
    try {
      await matrixFriendOperations.rejectFriendRequest(req.user_id)
      showFeedback(t('setting.friends.pending.reject_success'), 'success')
      await loadFriendRequests()
    } catch {
      showFeedback(t('setting.friends.pending.reject_failed'), 'error')
    }
  }

  async function handleCancelRequest(req: FriendRequest) {
    try {
      await matrixFriendOperations.cancelFriendRequest(req.user_id)
      showFeedback(t('setting.friends.pending.cancel_success'), 'success')
      await loadFriendRequests()
    } catch {
      showFeedback(t('setting.friends.pending.cancel_failed'), 'error')
    }
  }

  return {
    allowFriendRequests,
    autoAcceptFriends,
    requireFriendRequestMessage,
    settingsLoadFailed,
    loadingGroups,
    loadingRequests,
    friendGroups,
    incomingRequests,
    outgoingRequests,
    partialFailures,
    showCreateGroup,
    showEditGroup,
    newGroupName,
    editGroupName,
    loadSettings,
    retryPartialLoads,
    handleToggle,
    handleCreateGroup,
    handleEditGroup,
    handleSaveGroup,
    handleDeleteGroup,
    handleAcceptRequest,
    handleRejectRequest,
    handleCancelRequest
  }
}
