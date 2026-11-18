<template>
  <div class="admin-invite-policy">
    <n-alert :bordered="false" type="warning">{{ t('admin.invitePolicy.hint') }}</n-alert>

    <n-card :title="t('admin.invitePolicy.globalTitle')" class="mt-16px">
      <n-alert :bordered="false" type="info">{{ t('admin.invitePolicy.globalHint') }}</n-alert>
      <n-space class="mt-16px">
        <n-button data-testid="admin-invite-policy-global-refresh" :loading="globalLoading" @click="handleLoadGlobal">
          {{ t('common.refresh') }}
        </n-button>
      </n-space>

      <n-spin :show="globalLoading">
        <n-grid cols="1 m:2" :x-gap="16" :y-gap="16" class="mt-16px">
          <n-grid-item v-for="group in globalGroups" :key="group.kind">
            <n-card size="small" :title="group.title">
              <n-space vertical>
                <n-space :wrap="false">
                  <n-input
                    v-model:value="globalDrafts[group.kind].newUser"
                    size="small"
                    :data-testid="`admin-invite-policy-global-add-input-${group.kind}`"
                    :placeholder="t('admin.invitePolicy.userIdPlaceholder')" />
                  <n-button
                    size="small"
                    type="primary"
                    :loading="globalMutating"
                    :disabled="!globalDrafts[group.kind].newUser.trim()"
                    :data-testid="`admin-invite-policy-global-add-${group.kind}`"
                    @click="handleAddGlobal(group.kind)">
                    {{ t('admin.invitePolicy.addUser') }}
                  </n-button>
                </n-space>

                <EmptyState
                  v-if="!group.users.length"
                  compact
                  variant="subtle"
                  :description="t('admin.invitePolicy.emptyList')" />
                <n-space v-else :size="4">
                  <n-tag
                    v-for="userId in group.users"
                    :key="userId"
                    size="small"
                    closable
                    :disabled="globalMutating"
                    @close="handleRemoveGlobal(group.kind, userId)">
                    {{ userId }}
                  </n-tag>
                </n-space>

                <n-input
                  v-model:value="globalDrafts[group.kind].importText"
                  type="textarea"
                  size="small"
                  :rows="3"
                  :data-testid="`admin-invite-policy-global-import-input-${group.kind}`"
                  :placeholder="t('admin.invitePolicy.bulkImportPlaceholder')" />
                <n-space align="center">
                  <n-button
                    size="small"
                    :loading="globalMutating"
                    :disabled="!globalDrafts[group.kind].importText.trim()"
                    :data-testid="`admin-invite-policy-global-import-${group.kind}`"
                    @click="handleImportGlobal(group.kind)">
                    {{ t('admin.invitePolicy.bulkImport') }}
                  </n-button>
                  <n-popconfirm @positive-click="handleReplaceGlobal(group.kind)">
                    <template #trigger>
                      <n-button
                        size="small"
                        type="warning"
                        :loading="globalMutating"
                        :data-testid="`admin-invite-policy-global-replace-${group.kind}`">
                        {{ t('admin.invitePolicy.replaceAll') }}
                      </n-button>
                    </template>
                    {{
                      t('admin.invitePolicy.replaceConfirm', {
                        current: group.users.length,
                        next: countDraft(group.kind)
                      })
                    }}
                  </n-popconfirm>
                </n-space>
              </n-space>
            </n-card>
          </n-grid-item>
        </n-grid>
      </n-spin>
    </n-card>

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
import { NAlert, NButton, NCard, NGrid, NGridItem, NInput, NPopconfirm, NSpace, NSpin, NTag } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminInvitePolicy } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { GlobalInviteListKind } from '@/services/matrix/admin/AdminInvitePolicyService'

defineOptions({ name: 'AdminInvitePolicy' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const {
  blocklist,
  allowlist,
  loading,
  savingBlocklist,
  savingAllowlist,
  globalAllowlist,
  globalBlocklist,
  globalLoading,
  globalMutating,
  error,
  loadLists,
  saveBlocklist,
  saveAllowlist,
  loadGlobalLists,
  addGlobalUser,
  removeGlobalUser,
  importGlobalUsers,
  replaceGlobalUsers
} = useAdminInvitePolicy()

const roomId = ref('')
const blocklistDraft = ref('')
const allowlistDraft = ref('')

const globalDrafts = reactive({
  allowlist: { newUser: '', importText: '' },
  blocklist: { newUser: '', importText: '' }
})

const globalGroups = computed(() => [
  {
    kind: 'allowlist' as GlobalInviteListKind,
    title: t('admin.invitePolicy.allowlistUsers'),
    users: globalAllowlist.value
  },
  {
    kind: 'blocklist' as GlobalInviteListKind,
    title: t('admin.invitePolicy.blocklistUsers'),
    users: globalBlocklist.value
  }
])

function parseUserIds(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function countDraft(kind: GlobalInviteListKind): number {
  return new Set(parseUserIds(globalDrafts[kind].importText)).size
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

async function handleLoadGlobal(): Promise<void> {
  const ok = await loadGlobalLists()
  showFeedback(ok ? t('admin.invitePolicy.loadSuccess') : t('admin.invitePolicy.loadFailed'), ok ? 'success' : 'error')
}

async function handleAddGlobal(kind: GlobalInviteListKind): Promise<void> {
  const userId = globalDrafts[kind].newUser.trim()
  if (!userId) return
  const ok = await addGlobalUser(kind, userId)
  if (ok) globalDrafts[kind].newUser = ''
  showFeedback(
    ok ? t('admin.invitePolicy.globalAddSuccess') : t('admin.invitePolicy.globalAddFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleRemoveGlobal(kind: GlobalInviteListKind, userId: string): Promise<void> {
  const ok = await removeGlobalUser(kind, userId)
  showFeedback(
    ok ? t('admin.invitePolicy.globalRemoveSuccess') : t('admin.invitePolicy.globalRemoveFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleImportGlobal(kind: GlobalInviteListKind): Promise<void> {
  const userIds = parseUserIds(globalDrafts[kind].importText)
  if (!userIds.length) {
    showFeedback(t('admin.invitePolicy.bulkImportEmpty'), 'warning')
    return
  }
  const result = await importGlobalUsers(kind, userIds)
  if (result.success > 0) globalDrafts[kind].importText = ''
  showFeedback(
    t('admin.invitePolicy.bulkImportResult', { success: result.success, failed: result.failed }),
    result.failed > 0 ? 'warning' : 'success'
  )
}

async function handleReplaceGlobal(kind: GlobalInviteListKind): Promise<void> {
  const userIds = parseUserIds(globalDrafts[kind].importText)
  const ok = await replaceGlobalUsers(kind, userIds)
  showFeedback(
    ok
      ? t('admin.invitePolicy.globalReplaceSuccess', { count: new Set(userIds).size })
      : t('admin.invitePolicy.globalReplaceFailed'),
    ok ? 'success' : 'error'
  )
}

onMounted(() => {
  loadGlobalLists()
})
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
