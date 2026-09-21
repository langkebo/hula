<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_invite_permission.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px gap-12px">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_invite_permission.loading') }}</van-loading>
        </div>

        <template v-else>
          <van-cell-group inset>
            <van-radio-group v-model="mode" data-testid="invite-mode-group" @change="handleModeChange">
              <van-cell
                v-for="option in INVITE_POLICY_MODES"
                :key="option"
                :title="t(`mobile_invite_permission.mode.${option}`)"
                :label="t(`mobile_invite_permission.mode_hint.${option}`)"
                clickable
                :data-testid="`invite-mode-${option}`"
                @click="handleModeChange(option)">
                <template #right-icon>
                  <van-radio :name="option" />
                </template>
              </van-cell>
            </van-radio-group>
          </van-cell-group>

          <van-cell-group inset :title="t('mobile_invite_permission.dm_section')">
            <van-cell
              :title="t('mobile_invite_permission.allow_strangers')"
              :label="t('mobile_invite_permission.allow_strangers_hint')">
              <template #right-icon>
                <van-switch
                  v-model="allowStrangers"
                  data-testid="allow-strangers"
                  :disabled="mode === 'allowlist'"
                  @change="handleAllowStrangersChange" />
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_invite_permission.encrypt_new_dm')"
              :label="t('mobile_invite_permission.encrypt_new_dm_hint')">
              <template #right-icon>
                <van-switch
                  v-model="encryptByDefault"
                  data-testid="encrypt-new-dm"
                  @change="handleEncryptByDefaultChange" />
              </template>
            </van-cell>

            <van-cell
              v-if="mode === 'allowlist'"
              data-testid="allow-strangers-note"
              :title="t('mobile_invite_permission.allow_strangers_inactive')" />
          </van-cell-group>

          <van-cell-group
            v-if="mode !== 'allow_all'"
            :title="
              mode === 'blocklist'
                ? t('mobile_invite_permission.blocklist_section')
                : t('mobile_invite_permission.allowlist_section')
            "
            inset>
            <van-field
              v-model="newUserId"
              :label="t('mobile_invite_permission.user_id')"
              :placeholder="t('mobile_invite_permission.user_id_placeholder')"
              data-testid="invite-user-input"
              @keyup.enter="handleAdd" />
            <van-cell>
              <van-button
                type="primary"
                size="small"
                block
                :loading="saving"
                data-testid="invite-add"
                @click="handleAdd">
                {{ t('mobile_invite_permission.add') }}
              </van-button>
            </van-cell>
          </van-cell-group>

          <van-cell-group v-if="mode !== 'allow_all'" inset>
            <van-cell v-for="userId in activeList" :key="userId" :title="userId" data-testid="invite-user-row">
              <template #right-icon>
                <van-button size="mini" plain type="danger" @click="handleRemove(userId)">
                  {{ t('mobile_invite_permission.remove') }}
                </van-button>
              </template>
            </van-cell>
            <van-cell
              v-if="activeList.length === 0"
              data-testid="invite-empty"
              :title="t('mobile_invite_permission.empty')" />
          </van-cell-group>
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixAccountService } from '@/services/matrix'
import { cacheDmPrivacyPreferences, loadDmPrivacyPreferences } from '@/services/matrix/user/dmPrivacyPreferences'
import {
  INVITE_POLICY_MODES,
  type InvitePolicy,
  type InvitePolicyMode,
  isInvitePolicyMode,
  normalizeInvitePolicy,
  normalizeUserId
} from '@/services/matrix/user/invitePolicy'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileInvitePermission')

const { t } = useI18n()
const INVITE_PERMISSION_MODES = INVITE_POLICY_MODES

const loading = ref(true)
const saving = ref(false)
const mode = ref<InvitePolicyMode>('allow_all')
const blocklist = ref<string[]>([])
const allowlist = ref<string[]>([])
const allowStrangers = ref(true)
const newUserId = ref('')
const encryptByDefault = ref(loadDmPrivacyPreferences().encryptByDefault)

/** 当前模式对应的名单。allow_all 下两个名单都不展示。 */
const activeList = computed(() => (mode.value === 'blocklist' ? blocklist.value : allowlist.value))

onMounted(async () => {
  try {
    // 严格读取：能区分「从未存过」（null）与「读取失败」（抛错），
    // 读取失败时展示错误而不是把默认策略当成账号真实策略渲染。
    const policy = await matrixAccountService.getInvitePolicyStrict()
    applyConfig(policy)
  } catch (error) {
    logger.error('Failed to load invite permission config', error)
    showToast({ type: 'fail', message: t('mobile_invite_permission.load_failed') })
  } finally {
    loading.value = false
  }
})

function applyConfig(policy: InvitePolicy | null) {
  const normalized = normalizeInvitePolicy(policy)
  mode.value = normalized.mode
  blocklist.value = normalized.blocklist
  allowlist.value = normalized.allowlist
  allowStrangers.value = normalized.allowStrangers
}

/**
 * 写回本页拥有的四个字段。
 *
 * **写前必须严格重读**（与桌面编辑器一致）：本页只拥有 mode / blocklist /
 * allowlist / allowStrangers，其余字段（好友请求三项、contacts）必须来自
 * 服务端最新值。读取失败会抛错 → 中止写入并提示；绝不拿挂载快照或默认值
 * 整对象覆盖，否则一次读取失败 + 一次成功的 PUT 就会静默删掉服务端策略。
 */
async function persist() {
  saving.value = true
  try {
    const latest = await matrixAccountService.getInvitePolicyStrict()
    const base = normalizeInvitePolicy(latest)
    await matrixAccountService.setInvitePolicy({
      ...base,
      mode: mode.value,
      blocklist: blocklist.value,
      allowlist: allowlist.value,
      allowStrangers: allowStrangers.value
    })
  } catch (error) {
    logger.error('Failed to persist invite policy', error)
    showToast({ type: 'fail', message: t('mobile_invite_permission.save_failed') })
  } finally {
    saving.value = false
  }
}

async function handleModeChange(next: InvitePolicyMode | number | string) {
  const value = String(next)
  if (!isInvitePolicyMode(value) || value === mode.value) {
    return
  }
  mode.value = value
  await persist()
}

/**
 * 「允许非联系人私聊」在 `allow_all` 与 `blocklist` 下都参与判定：
 * `blocklist` 是叠加在它之上的拒绝维度（名单里的人无条件拒），名单外的用户
 * 仍由这个开关决定。只有 `allowlist` 由名单显式决定，开关不生效。
 */
async function handleAllowStrangersChange(next: boolean) {
  allowStrangers.value = next
  await persist()
}

/** 新私聊默认加密是本机偏好，不进 account data。 */
function handleEncryptByDefaultChange(next: boolean) {
  encryptByDefault.value = next
  cacheDmPrivacyPreferences({ encryptByDefault: next })
}

async function handleAdd() {
  const userId = normalizeUserId(newUserId.value)
  if (!userId) {
    return
  }

  const list = mode.value === 'blocklist' ? blocklist : allowlist
  if (list.value.includes(userId)) {
    showToast({ type: 'fail', message: t('mobile_invite_permission.duplicate') })
    return
  }

  list.value = [...list.value, userId]
  newUserId.value = ''
  await persist()
}

async function handleRemove(userId: string) {
  if (mode.value === 'blocklist') {
    blocklist.value = blocklist.value.filter((id) => id !== userId)
  } else {
    allowlist.value = allowlist.value.filter((id) => id !== userId)
  }
  await persist()
}
</script>
