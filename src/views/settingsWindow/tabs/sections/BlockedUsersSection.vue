<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.blocked_users') }}</h3>
    <n-spin :show="loadingBlocked">
      <div v-if="blockedUsers.length > 0" class="ignored-list">
        <div v-for="user in blockedUsers" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleUnblock(user)">{{ t('setting.security.unblock') }}</n-button>
        </div>
      </div>
      <n-empty v-else :description="t('setting.security.no_blocked_users')" />
    </n-spin>
    <div class="add-button-wrapper">
      <n-button size="small" @click="showAddBlocked = true">{{ t('setting.security.add_blocked_user') }}</n-button>
    </div>
  </div>

  <n-modal
    v-model:show="showAddBlocked"
    preset="dialog"
    :title="t('setting.security.add_blocked_user_title')"
    :positive-text="t('setting.security.add')"
    :negative-text="t('setting.common.cancel')"
    @positive-click="handleAddBlocked">
    <n-form>
      <n-form-item :label="t('setting.security.user_id_label')">
        <n-input v-model:value="newBlockedUser" :placeholder="t('setting.security.user_id_placeholder')" />
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NForm, NFormItem, NInput, NModal, NSpin } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixAccountService } from '@/services/matrix'
import { type InvitePolicy, normalizeInvitePolicy, normalizeUserId } from '@/services/matrix/user/invitePolicy'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'BlockedUsersSection'
})

const logger = createLogger('BlockedUsersSection')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loadingBlocked = ref(false)
/**
 * 屏蔽名单的唯一数据源是账号级邀请策略 `im.hula.invite_policy` 的 `blocklist`。
 *
 * 这里不再用 localStorage：那份 `tjg-blocked-users` 只有本组件自己读写，
 * 判定层（`shouldRejectInvite`）从不读它，屏蔽了人也不会真的拒邀。
 */
const policy = ref<InvitePolicy | null>(null)
const showAddBlocked = ref(false)
const newBlockedUser = ref('')

const blockedUsers = computed(() => policy.value?.blocklist ?? [])

onMounted(() => {
  loadBlockedUsers()
})

async function loadBlockedUsers() {
  loadingBlocked.value = true
  try {
    policy.value = await matrixAccountService.getInvitePolicy()
  } catch (error) {
    logger.warn('加载屏蔽名单失败:', error)
  } finally {
    loadingBlocked.value = false
  }
}

/**
 * 写回屏蔽名单。
 *
 * **写前必须重读**：`SecuritySettings` 同时挂了 `InvitePermissionPanel`，它有自己
 * 的一份屏蔽名单编辑 UI，两者写同一份 account data。若用挂载时的快照整份写回，
 * 对方刚保存的改动会被静默覆盖（在面板加了人 → 回到这里删除另一个人 → 前一个
 * 改动被回滚）。
 *
 * 读取失败直接抛出，由调用方走错误反馈：绝不拿 `normalizeInvitePolicy(null)` 的
 * 默认策略（`mode: allow_all` + 空名单）覆盖账号上已有的策略。为此重读走
 * **严格**变体 `getInvitePolicyStrict()`——宽松的 `getInvitePolicy()` 会把读取
 * 失败折叠成那份默认策略，写回就等于静默删策略。
 *
 * 只改 `blocklist`，**不动 `mode`**：`mode` 是用户显式选择的模式，
 * 强行改成 `blocklist` 会把「仅允许联系人」这条基线静默关掉。
 */
async function updateBlocklist(mutate: (current: string[]) => string[]) {
  const latest = normalizeInvitePolicy(await matrixAccountService.getInvitePolicyStrict())
  const next: InvitePolicy = { ...latest, blocklist: mutate(latest.blocklist) }
  await matrixAccountService.setInvitePolicy(next)
  policy.value = next
}

async function handleAddBlocked() {
  const userId = normalizeUserId(newBlockedUser.value)
  if (!userId) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return false
  }
  if (blockedUsers.value.includes(userId)) {
    showFeedback(t('setting.security.user_already_blocked'), 'warning')
    return false
  }

  newBlockedUser.value = ''
  try {
    await updateBlocklist((current) => (current.includes(userId) ? current : [...current, userId]))
    showFeedback(t('setting.security.blocked_user_added'), 'success')
  } catch (error) {
    logger.error('添加屏蔽用户失败:', error)
    showFeedback(t('setting.security.operation_failed'), 'error')
  }
  return true
}

async function handleUnblock(userId: string) {
  try {
    await updateBlocklist((current) => current.filter((u) => u !== userId))
    showFeedback(t('setting.security.blocked_user_removed'), 'success')
  } catch (error) {
    logger.error('取消屏蔽失败:', error)
    showFeedback(t('setting.security.operation_failed'), 'error')
  }
}
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.ignored-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.ignored-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2) var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.add-button-wrapper {
  margin-top: var(--tjg-space-2);
}
</style>
