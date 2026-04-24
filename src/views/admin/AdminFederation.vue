<template>
  <div class="admin-federation">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="destinations" :tab="t('admin.federation.destinations')">
        <div class="tab-header">
          <n-input
            v-model:value="destSearchQuery"
            :placeholder="t('admin.federation.searchDestinations')"
            clearable
            style="width: 300px">
            <template #prefix>
              <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </template>
          </n-input>
          <n-button @click="loadDestinations">
            {{ t('admin.common.refresh') }}
          </n-button>
        </div>

        <n-spin :show="destLoading">
          <n-data-table
            :columns="destColumns"
            :data="filteredDestinations"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
            striped
            :row-key="(row: FederationDestination) => row.destination" />
        </n-spin>
      </n-tab-pane>

      <n-tab-pane name="blacklist" :tab="t('admin.federation.blacklist')">
        <div class="tab-header">
          <n-input
            v-model:value="blacklistSearchQuery"
            :placeholder="t('admin.federation.searchBlacklist')"
            clearable
            style="width: 300px">
            <template #prefix>
              <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </template>
          </n-input>
          <n-space>
            <n-button type="primary" @click="showAddBlacklistDialog = true">
              {{ t('admin.federation.addToBlacklist') }}
            </n-button>
            <n-button @click="loadBlacklist">
              {{ t('admin.common.refresh') }}
            </n-button>
          </n-space>
        </div>

        <n-spin :show="blacklistLoading">
          <n-data-table
            :columns="blacklistColumns"
            :data="filteredBlacklist"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
            striped
            :row-key="(row: BlacklistEntry) => row.domain" />
        </n-spin>
      </n-tab-pane>
    </n-tabs>

    <n-modal
      v-model:show="showAddBlacklistDialog"
      :title="t('admin.federation.addToBlacklist')"
      preset="dialog"
      style="width: 400px">
      <n-form :model="addBlacklistForm">
        <n-form-item :label="t('admin.federation.domain')" path="domain">
          <n-input v-model:value="addBlacklistForm.domain" placeholder="spam-server.com" />
        </n-form-item>
        <n-form-item :label="t('admin.federation.reason')" path="reason">
          <n-input
            v-model:value="addBlacklistForm.reason"
            type="textarea"
            :placeholder="t('admin.federation.reasonPlaceholder')" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddBlacklistDialog = false">{{ t('admin.common.cancel') }}</n-button>
        <n-button type="primary" :loading="addingBlacklist" @click="handleAddToBlacklist">
          {{ t('admin.common.confirm') }}
        </n-button>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showDestDetail"
      :title="t('admin.federation.destinationDetail')"
      preset="dialog"
      style="width: 500px">
      <template v-if="selectedDest">
        <n-descriptions bordered :column="1" label-placement="left">
          <n-descriptions-item :label="t('admin.federation.destination')">
            {{ selectedDest.destination }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.federation.retryLastTs')">
            {{ selectedDest.retryLastTs ? new Date(selectedDest.retryLastTs).toLocaleString() : '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.federation.retryInterval')">
            {{ selectedDest.retryInterval ? `${selectedDest.retryInterval}ms` : '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.federation.failureTs')">
            {{ selectedDest.failureTs ? new Date(selectedDest.failureTs).toLocaleString() : '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.federation.lastSuccessfulStreamOrdering')">
            {{ selectedDest.lastSuccessfulStreamOrdering ?? '-' }}
          </n-descriptions-item>
        </n-descriptions>
        <n-space style="margin-top: 16px">
          <n-button size="small" type="primary" @click="handleResetConnection(selectedDest.destination)">
            {{ t('admin.federation.resetConnection') }}
          </n-button>
          <n-button size="small" type="error" @click="handleDisconnect(selectedDest.destination)">
            {{ t('admin.federation.disconnect') }}
          </n-button>
        </n-space>
      </template>
      <template #action>
        <n-button @click="showDestDetail = false">{{ t('admin.common.close') }}</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import type { FederationDestination } from '@/services/matrix/MatrixAdminService'
import { useAdminFederation, type FederationBlacklistView } from '@/composables/admin'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const federation = useAdminFederation()

const activeTab = ref('destinations')

const destinations = federation.destinations
const destLoading = federation.destinationsLoading
const destSearchQuery = ref('')

const selectedDest = federation.selectedDestination
const showDestDetail = ref(false)

const blacklist = federation.blacklist
const blacklistLoading = federation.blacklistLoading
const blacklistSearchQuery = ref('')
const showAddBlacklistDialog = ref(false)
const addingBlacklist = ref(false)
const addBlacklistForm = ref({ domain: '', reason: '' })

type BlacklistEntry = FederationBlacklistView

const filteredDestinations = computed(() => {
  if (!destSearchQuery.value) return destinations.value
  const q = destSearchQuery.value.toLowerCase()
  return destinations.value.filter((d) => d.destination.toLowerCase().includes(q))
})

const filteredBlacklist = computed(() => {
  if (!blacklistSearchQuery.value) return blacklist.value
  const q = blacklistSearchQuery.value.toLowerCase()
  return blacklist.value.filter((b) => b.domain.toLowerCase().includes(q))
})

const destColumns = computed(() => [
  {
    title: t('admin.federation.destination'),
    key: 'destination',
    ellipsis: { tooltip: true },
    width: 250
  },
  {
    title: t('admin.federation.status'),
    key: 'status',
    width: 120,
    render(row: FederationDestination) {
      const hasFailure = !!row.failureTs
      return h(NTag, { type: hasFailure ? 'error' : 'success', size: 'small' }, () =>
        hasFailure ? t('admin.federation.failed') : t('admin.federation.connected')
      )
    }
  },
  {
    title: t('admin.federation.lastRetry'),
    key: 'retryLastTs',
    width: 180,
    render(row: FederationDestination) {
      return row.retryLastTs ? new Date(row.retryLastTs).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.federation.retryInterval'),
    key: 'retryInterval',
    width: 120,
    render(row: FederationDestination) {
      return row.retryInterval ? `${row.retryInterval}ms` : '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 100,
    render(row: FederationDestination) {
      return h(NButton, { size: 'small', type: 'primary', onClick: () => openDestDetail(row) }, () =>
        t('admin.federation.detail')
      )
    }
  }
])

const blacklistColumns = computed(() => [
  {
    title: t('admin.federation.domain'),
    key: 'domain',
    ellipsis: { tooltip: true },
    width: 250
  },
  {
    title: t('admin.federation.reason'),
    key: 'reason',
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.federation.addedAt'),
    key: 'addedAt',
    width: 180,
    render(row: BlacklistEntry) {
      return row.addedAt ? new Date(row.addedAt).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 120,
    render(row: BlacklistEntry) {
      return h(NButton, { size: 'small', type: 'error', onClick: () => handleRemoveFromBlacklist(row.domain) }, () =>
        t('admin.federation.removeFromBlacklist')
      )
    }
  }
])

async function loadDestinations() {
  if (!adminStore.isAdmin) return
  await federation.loadDestinations()
}

async function loadBlacklist() {
  if (!adminStore.isAdmin) return
  await federation.loadBlacklist()
}

function openDestDetail(dest: FederationDestination) {
  federation.selectDestination(dest)
  showDestDetail.value = true
}

async function handleResetConnection(destination: string) {
  try {
    await federation.resetFederationConnection(destination)
    message.success(t('admin.federation.resetSuccess'))
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.federation.resetFailed'))
  }
}

async function handleDisconnect(destination: string) {
  dialog.warning({
    title: t('admin.federation.disconnect'),
    content: t('admin.federation.disconnectConfirm', { destination }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await federation.resetFederationConnection(destination)
        message.success(t('admin.federation.disconnectSuccess'))
        showDestDetail.value = false
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.federation.disconnectFailed'))
      }
    }
  })
}

async function handleAddToBlacklist() {
  if (!addBlacklistForm.value.domain) {
    message.error(t('admin.federation.domainRequired'))
    return
  }
  addingBlacklist.value = true
  try {
    const success = await federation.addToBlacklist(
      addBlacklistForm.value.domain,
      addBlacklistForm.value.reason || undefined
    )
    if (success) {
      message.success(t('admin.federation.addBlacklistSuccess'))
      showAddBlacklistDialog.value = false
      addBlacklistForm.value = { domain: '', reason: '' }
    } else {
      message.error(t('admin.federation.addBlacklistFailed'))
    }
  } finally {
    addingBlacklist.value = false
  }
}

async function handleRemoveFromBlacklist(domain: string) {
  dialog.warning({
    title: t('admin.federation.removeFromBlacklist'),
    content: t('admin.federation.removeBlacklistConfirm', { domain }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      const success = await federation.removeFromBlacklist(domain)
      if (success) {
        message.success(t('admin.federation.removeBlacklistSuccess'))
      } else {
        message.error(t('admin.federation.removeBlacklistFailed'))
      }
    }
  })
}

onMounted(() => {
  loadDestinations()
  loadBlacklist()
})
</script>

<style scoped lang="scss">
.admin-federation {
  max-width: 1200px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 768px) {
  .tab-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
