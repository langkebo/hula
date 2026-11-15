<template>
  <div class="admin-invite-policy">
    <n-alert :bordered="false" type="warning">{{ t('admin.invitePolicy.hint') }}</n-alert>

    <n-card :title="t('admin.invitePolicy.roomTitle')" class="mt-16px">
      <n-space align="center" :wrap="true">
        <n-input
          v-model:value="roomId"
          data-testid="admin-invite-policy-room-id"
          :placeholder="t('admin.invitePolicy.roomIdPlaceholder')"
          class="w-[360px]" />
        <n-button data-testid="admin-invite-policy-load" :loading="loading" @click="handleLoad">
          {{ t('admin.invitePolicy.load') }}
        </n-button>
      </n-space>

      <n-alert
        v-if="error"
        data-testid="admin-invite-policy-error"
        class="mt-16px"
        type="error"
        closable
        @close="error = null">
        {{ error }}
      </n-alert>
    </n-card>

    <n-card :title="t('admin.invitePolicy.blocklistTitle')" class="mt-16px">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.invitePolicy.blocklistHint') }}</n-alert>
        <n-input
          v-model:value="blocklistDraft"
          data-testid="admin-invite-policy-blocklist"
          type="textarea"
          :rows="6"
          :placeholder="t('admin.invitePolicy.userIdsPlaceholder')" />
        <n-button
          data-testid="admin-invite-policy-blocklist-save"
          type="primary"
          :loading="savingBlocklist"
          @click="handleSaveBlocklist">
          {{ t('admin.common.save') }}
        </n-button>
      </n-space>
    </n-card>

    <n-card :title="t('admin.invitePolicy.allowlistTitle')" class="mt-16px">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.invitePolicy.allowlistHint') }}</n-alert>
        <n-input
          v-model:value="allowlistDraft"
          data-testid="admin-invite-policy-allowlist"
          type="textarea"
          :rows="6"
          :placeholder="t('admin.invitePolicy.userIdsPlaceholder')" />
        <n-button
          data-testid="admin-invite-policy-allowlist-save"
          type="primary"
          :loading="savingAllowlist"
          @click="handleSaveAllowlist">
          {{ t('admin.common.save') }}
        </n-button>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NInput, NSpace } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminInvitePolicy } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({ name: 'AdminInvitePolicy' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const {
  blocklist,
  allowlist,
  loading,
  savingBlocklist,
  savingAllowlist,
  error,
  loadLists,
  saveBlocklist,
  saveAllowlist
} = useAdminInvitePolicy()

const roomId = ref('')
const blocklistDraft = ref('')
const allowlistDraft = ref('')

function parseUserIds(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

async function handleLoad(): Promise<void> {
  const room = roomId.value.trim()
  if (!room) {
    showFeedback(t('admin.invitePolicy.roomIdRequired'), 'error')
    return
  }
  const ok = await loadLists(room)
  if (ok) {
    blocklistDraft.value = blocklist.value.join('\n')
    allowlistDraft.value = allowlist.value.join('\n')
  }
  showFeedback(ok ? t('admin.invitePolicy.loadSuccess') : t('admin.invitePolicy.loadFailed'), ok ? 'success' : 'error')
}

async function handleSaveBlocklist(): Promise<void> {
  const room = roomId.value.trim()
  if (!room) {
    showFeedback(t('admin.invitePolicy.roomIdRequired'), 'error')
    return
  }
  const ok = await saveBlocklist(room, parseUserIds(blocklistDraft.value))
  if (ok) {
    blocklistDraft.value = blocklist.value.join('\n')
  }
  showFeedback(
    ok ? t('admin.invitePolicy.blocklistSaved') : t('admin.invitePolicy.saveFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleSaveAllowlist(): Promise<void> {
  const room = roomId.value.trim()
  if (!room) {
    showFeedback(t('admin.invitePolicy.roomIdRequired'), 'error')
    return
  }
  const ok = await saveAllowlist(room, parseUserIds(allowlistDraft.value))
  if (ok) {
    allowlistDraft.value = allowlist.value.join('\n')
  }
  showFeedback(
    ok ? t('admin.invitePolicy.allowlistSaved') : t('admin.invitePolicy.saveFailed'),
    ok ? 'success' : 'error'
  )
}
</script>

<style scoped>
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-invite-policy {
  max-width: 1200px;
}

.mt-16px {
  margin-top: 16px;
}

@media (prefers-reduced-motion: reduce) {
  .admin-invite-policy {
    transition: none;
  }
}

@include responsive.down('md') {
  .mt-16px {
    margin-top: 12px;
  }
}
</style>
