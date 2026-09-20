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
                v-for="option in INVITE_PERMISSION_MODES"
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
import {
  INVITE_PERMISSION_MODES,
  type InvitePermissionConfig,
  type InvitePermissionMode,
  normalizeInvitePermissionConfig,
  normalizeUserId
} from '@/services/matrix/user/invitePermissionPolicy'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileInvitePermission')

const { t } = useI18n()

const loading = ref(true)
const saving = ref(false)
const mode = ref<InvitePermissionMode>('allow_all')
const blocklist = ref<string[]>([])
const allowlist = ref<string[]>([])
const newUserId = ref('')

/** 当前模式对应的名单。allow_all 下两个名单都不展示。 */
const activeList = computed(() => (mode.value === 'blocklist' ? blocklist.value : allowlist.value))

onMounted(async () => {
  try {
    const config = await matrixAccountService.getInvitePermissionConfig()
    applyConfig(config)
  } catch (error) {
    logger.error('Failed to load invite permission config', error)
    showToast({ type: 'fail', message: t('mobile_invite_permission.load_failed') })
  } finally {
    loading.value = false
  }
})

function applyConfig(config: InvitePermissionConfig) {
  const normalized = normalizeInvitePermissionConfig(config)
  mode.value = normalized.mode
  blocklist.value = normalized.blocklist
  allowlist.value = normalized.allowlist
}

function buildConfig(): InvitePermissionConfig {
  return {
    mode: mode.value,
    blocklist: blocklist.value,
    allowlist: allowlist.value
  }
}

async function persist() {
  saving.value = true
  try {
    await matrixAccountService.setInvitePermissionConfig(buildConfig())
  } catch (error) {
    logger.error('Failed to persist invite permission config', error)
    showToast({ type: 'fail', message: t('mobile_invite_permission.save_failed') })
  } finally {
    saving.value = false
  }
}

async function handleModeChange(next: InvitePermissionMode | number | string) {
  const value = String(next) as InvitePermissionMode
  if (!INVITE_PERMISSION_MODES.includes(value) || value === mode.value) {
    return
  }
  mode.value = value
  await persist()
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
