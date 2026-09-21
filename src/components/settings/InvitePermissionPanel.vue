<template>
  <div v-if="visible" class="invite-permission-panel" role="region" :aria-label="t('setting.invite_permission.title')">
    <div class="invite-permission-panel__header">
      <svg class="invite-permission-panel__icon" aria-hidden="true">
        <use href="#shield"></use>
      </svg>
      <span class="invite-permission-panel__title">{{ t('setting.invite_permission.title') }}</span>
    </div>

    <n-spin :show="loading">
      <n-radio-group :value="mode" class="invite-permission-panel__modes" @update:value="handleModeChange">
        <n-radio value="allow_all">{{ t('setting.invite_permission.mode.allow_all') }}</n-radio>
        <n-radio value="blocklist">{{ t('setting.invite_permission.mode.blocklist') }}</n-radio>
        <n-radio value="allowlist">{{ t('setting.invite_permission.mode.allowlist') }}</n-radio>
      </n-radio-group>

      <div v-if="mode === 'blocklist'" data-test="blocklist-section" class="invite-permission-panel__list">
        <div class="invite-permission-panel__list-header">
          <span class="invite-permission-panel__list-title">
            {{ t('setting.invite_permission.blocklist.title') }}
          </span>
        </div>
        <n-input
          v-model:value="blocklistInput"
          :placeholder="t('setting.invite_permission.user_id_placeholder')"
          size="small" />
        <n-button size="small" type="primary" data-test="add-blocklist-button" @click="handleAddUser('blocklist')">
          {{ t('setting.invite_permission.add') }}
        </n-button>
        <n-list v-if="blocklist.length > 0" bordered>
          <n-list-item v-for="userId in blocklist" :key="userId" class="invite-permission-panel__list-item">
            <div class="invite-permission-panel__user-row">
              <n-tag size="small">{{ userId }}</n-tag>
              <n-button size="tiny" quaternary @click="handleRemoveUser('blocklist', userId)">
                <template #icon>
                  <svg class="invite-permission-panel__remove-icon" aria-hidden="true">
                    <use href="#close"></use>
                  </svg>
                </template>
              </n-button>
            </div>
          </n-list-item>
        </n-list>
      </div>

      <div v-if="mode === 'allowlist'" data-test="allowlist-section" class="invite-permission-panel__list">
        <div class="invite-permission-panel__list-header">
          <span class="invite-permission-panel__list-title">
            {{ t('setting.invite_permission.allowlist.title') }}
          </span>
        </div>
        <n-input
          v-model:value="allowlistInput"
          :placeholder="t('setting.invite_permission.user_id_placeholder')"
          size="small" />
        <n-button size="small" type="primary" data-test="add-allowlist-button" @click="handleAddUser('allowlist')">
          {{ t('setting.invite_permission.add') }}
        </n-button>
        <n-list v-if="allowlist.length > 0" bordered>
          <n-list-item v-for="userId in allowlist" :key="userId" class="invite-permission-panel__list-item">
            <div class="invite-permission-panel__user-row">
              <n-tag size="small">{{ userId }}</n-tag>
              <n-button size="tiny" quaternary @click="handleRemoveUser('allowlist', userId)">
                <template #icon>
                  <svg class="invite-permission-panel__remove-icon" aria-hidden="true">
                    <use href="#close"></use>
                  </svg>
                </template>
              </n-button>
            </div>
          </n-list-item>
        </n-list>
      </div>

      <!-- 私聊：非联系人私聊 + 新私聊默认加密 -->
      <div data-test="dm-section" class="invite-permission-panel__dm">
        <div class="invite-permission-panel__list-header">
          <span class="invite-permission-panel__list-title">
            {{ t('setting.invite_permission.dm_section') }}
          </span>
        </div>

        <div class="invite-permission-panel__setting-row">
          <div>
            <span class="setting-label">{{ t('setting.invite_permission.allow_strangers') }}</span>
            <span class="setting-desc">{{ t('setting.invite_permission.allow_strangers_hint') }}</span>
          </div>
          <n-switch
            data-test="allow-strangers"
            :value="allowStrangers"
            :disabled="mode !== 'allow_all'"
            @update:value="handleAllowStrangersChange" />
        </div>
        <p v-if="mode !== 'allow_all'" data-test="allow-strangers-note" class="setting-desc">
          {{ t('setting.invite_permission.allow_strangers_inactive') }}
        </p>

        <div class="invite-permission-panel__setting-row">
          <div>
            <span class="setting-label">{{ t('setting.invite_permission.encrypt_new_dm') }}</span>
            <span class="setting-desc">{{ t('setting.invite_permission.encrypt_new_dm_hint') }}</span>
          </div>
          <n-switch data-test="encrypt-new-dm" :value="encryptByDefault" @update:value="handleEncryptByDefaultChange" />
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NList, NListItem, NRadio, NRadioGroup, NSpin, NSwitch, NTag } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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

/**
 * 桌面邀请权限面板。
 *
 * 原先它是一个**纯展示组件**：状态靠 props 传入、改动通过 emit 抛给父组件，
 * 而 `SecuritySettings.vue` 以 `<InvitePermissionPanel />` 挂载——既没传 props
 * 也没接事件，于是三档模式点了没反应、名单加了也不落库。
 *
 * 现在改为自包含：自己从 account data 读策略、自己写回，与移动端
 * `MobileInvitePermission.vue` 使用同一套 `invitePolicy` API 与判定语义。
 * 数据源统一为 `im.hula.invite_policy`（旧 key `im.hula.invite_blocklist`
 * 与后端房间级表同名，已废弃）。
 *
 * `visible` 仍作为显示开关保留；`mode`/`blocklist`/`allowlist` 仍可传入用于
 * 覆盖初值（测试与嵌入场景），但不再要求父组件回写。
 */
const props = withDefaults(
  defineProps<{
    visible?: boolean
    mode?: InvitePolicyMode
    blocklist?: string[]
    allowlist?: string[]
  }>(),
  {
    visible: true,
    mode: undefined,
    blocklist: undefined,
    allowlist: undefined
  }
)

const emit = defineEmits<{
  'mode-change': [mode: InvitePolicyMode]
  'add-user': [listType: 'blocklist' | 'allowlist', userId: string]
  'remove-user': [listType: 'blocklist' | 'allowlist', userId: string]
}>()

const logger = createLogger('InvitePermissionPanel')

const { t } = useI18n()

/**
 * 调用方（测试 / 嵌入场景）是否显式给了策略初值。
 *
 * 有显式初值时**不回读 account data**：否则挂载后立即被账号策略覆盖，
 * 传入的 mode/名单会静默失效——这正是原先"面板点了没反应"的同一类问题，
 * 只是换成了 prop 被覆盖的形式。
 */
const hasPolicyOverride = props.mode !== undefined || props.blocklist !== undefined || props.allowlist !== undefined

const loading = ref(!hasPolicyOverride)
const mode = ref<InvitePolicyMode>(props.mode ?? 'allow_all')
const blocklist = ref<string[]>(props.blocklist ?? [])
const allowlist = ref<string[]>(props.allowlist ?? [])
const allowStrangers = ref(true)
const contacts = ref<string[]>([])
const encryptByDefault = ref(loadDmPrivacyPreferences().encryptByDefault)
const blocklistInput = ref('')
const allowlistInput = ref('')

onMounted(async () => {
  if (hasPolicyOverride) {
    return
  }
  try {
    applyPolicy(await matrixAccountService.getInvitePolicy())
  } catch (error) {
    logger.error('Failed to load invite policy', error)
    applyPolicy(normalizeInvitePolicy(null))
  } finally {
    loading.value = false
  }
})

function applyPolicy(policy: InvitePolicy) {
  const normalized = normalizeInvitePolicy(policy)
  mode.value = normalized.mode
  blocklist.value = normalized.blocklist
  allowlist.value = normalized.allowlist
  allowStrangers.value = normalized.allowStrangers
  contacts.value = normalized.contacts
}

function buildPolicy(): InvitePolicy {
  return {
    mode: mode.value,
    blocklist: blocklist.value,
    allowlist: allowlist.value,
    allowStrangers: allowStrangers.value,
    contacts: contacts.value
  }
}

/** 写回 account data。失败只记录，不回滚 UI——用户可重试，避免输入被吞。 */
async function persist(): Promise<void> {
  try {
    await matrixAccountService.setInvitePolicy(buildPolicy())
  } catch (error) {
    logger.error('Failed to persist invite policy', error)
  }
}

async function handleModeChange(value: InvitePolicyMode | number | string) {
  const next = String(value)
  if (!isInvitePolicyMode(next) || next === mode.value) {
    return
  }
  mode.value = next
  emit('mode-change', next)
  await persist()
}

/**
 * 「允许非联系人私聊」只在 allow_all 下有意义：名单模式已经表达了"谁能进"，
 * 再用 contacts 判一次会互相矛盾（与判定层 `decideInviteAction` 一致）。
 */
async function handleAllowStrangersChange(value: boolean) {
  allowStrangers.value = value
  await persist()
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

  list.value = [...list.value, userId]
  if (listType === 'blocklist') {
    blocklistInput.value = ''
  } else {
    allowlistInput.value = ''
  }

  emit('add-user', listType, userId)
  await persist()
}

async function handleRemoveUser(listType: 'blocklist' | 'allowlist', userId: string) {
  if (listType === 'blocklist') {
    blocklist.value = blocklist.value.filter((id) => id !== userId)
  } else {
    allowlist.value = allowlist.value.filter((id) => id !== userId)
  }

  emit('remove-user', listType, userId)
  await persist()
}
</script>

<style scoped lang="scss">
.invite-permission-panel {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3);

  &__header {
    display: flex;
    align-items: center;
    gap: var(--tjg-space-2);
  }

  &__icon {
    width: 16px;
    height: 16px;
    color: var(--tjg-text-primary);
  }

  &__title {
    font-size: var(--tjg-font-size-md);
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  &__modes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tjg-space-3);
  }

  &__list,
  &__dm {
    display: flex;
    flex-direction: column;
    gap: var(--tjg-space-2);
    margin-top: var(--tjg-space-2);
  }

  &__list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__list-title {
    font-size: var(--tjg-font-size-sm);
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  &__list-item {
    display: flex;
    align-items: center;
  }

  &__user-row {
    display: flex;
    align-items: center;
    gap: var(--tjg-space-2);
  }

  &__remove-icon {
    width: 14px;
    height: 14px;
  }

  &__setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--tjg-space-3);
  }
}

.setting-label {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.setting-desc {
  display: block;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
}
</style>
