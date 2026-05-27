<template>
  <div class="admin-app-services">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="list" :tab="t('admin.appServices.list')">
        <div class="tab-header">
          <n-input
            v-model:value="searchQuery"
            :placeholder="t('admin.appServices.searchServices')"
            clearable
            style="width: 300px">
            <template #prefix>
              <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </template>
          </n-input>
          <n-button @click="loadServices">
            {{ t('admin.common.refresh') }}
          </n-button>
        </div>

        <n-spin :show="servicesLoading">
          <n-data-table
            :columns="serviceColumns"
            :data="filteredServices"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
            striped
            :row-key="(row: AppServiceInfo) => row.id" />
        </n-spin>
      </n-tab-pane>

      <n-tab-pane v-if="selectedService" name="detail" :tab="t('admin.appServices.detail')">
        <n-spin :show="detailLoading">
          <template v-if="selectedService">
            <n-descriptions bordered :column="2" label-placement="left" style="margin-bottom: 16px">
              <n-descriptions-item :label="t('admin.appServices.id')">
                {{ selectedService.id }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.appServices.url')">
                {{ selectedService.url || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.appServices.asToken')">
                {{ maskToken(selectedService.asToken) }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.appServices.hsToken')">
                {{ maskToken(selectedService.hsToken) }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.appServices.senderLocalpart')">
                {{ selectedService.senderLocalpart || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.appServices.rateLimited')">
                <n-tag :type="selectedService.rateLimited ? 'warning' : 'success'" size="small">
                  {{ selectedService.rateLimited ? t('admin.appServices.yes') : t('admin.appServices.no') }}
                </n-tag>
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.appServices.enabled')">
                <n-switch
                  :value="selectedService.enabled ?? false"
                  @update:value="(val: boolean) => handleToggleEnabled(val)" />
              </n-descriptions-item>
            </n-descriptions>

            <n-card :title="t('admin.appServices.namespaces')" style="margin-bottom: 16px">
              <template v-if="selectedService.namespaces">
                <n-tabs type="segment">
                  <n-tab-pane name="users" :tab="t('admin.appServices.nsUsers')">
                    <n-data-table
                      v-if="selectedService.namespaces.users?.length"
                      :columns="namespaceColumns"
                      :data="selectedService.namespaces.users"
                      :bordered="false"
                      size="small" />
                    <n-empty v-else :description="t('admin.appServices.noNamespaces')" />
                  </n-tab-pane>
                  <n-tab-pane name="rooms" :tab="t('admin.appServices.nsRooms')">
                    <n-data-table
                      v-if="selectedService.namespaces.rooms?.length"
                      :columns="namespaceColumns"
                      :data="selectedService.namespaces.rooms"
                      :bordered="false"
                      size="small" />
                    <n-empty v-else :description="t('admin.appServices.noNamespaces')" />
                  </n-tab-pane>
                  <n-tab-pane name="aliases" :tab="t('admin.appServices.nsAliases')">
                    <n-data-table
                      v-if="selectedService.namespaces.aliases?.length"
                      :columns="namespaceColumns"
                      :data="selectedService.namespaces.aliases"
                      :bordered="false"
                      size="small" />
                    <n-empty v-else :description="t('admin.appServices.noNamespaces')" />
                  </n-tab-pane>
                </n-tabs>
              </template>
              <n-empty v-else :description="t('admin.appServices.noNamespaces')" />
            </n-card>

            <n-space>
              <n-button :loading="pingLoading" @click="handlePing">
                {{ t('admin.appServices.ping') }}
              </n-button>
              <n-tag v-if="pingResult" :type="pingResult.ok ? 'success' : 'error'" size="medium">
                {{ pingResult.ok ? t('admin.appServices.pingOk') : t('admin.appServices.pingFailed') }}
                <template v-if="pingResult.durationMs !== undefined">({{ pingResult.durationMs }}ms)</template>
              </n-tag>
              <n-popconfirm @positive-click="handleDeleteService">
                <template #trigger>
                  <n-button type="error">{{ t('admin.appServices.delete') }}</n-button>
                </template>
                {{ t('admin.appServices.deleteConfirm') }}
              </n-popconfirm>
            </n-space>
          </template>
        </n-spin>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AppServiceInfo, useAdminAppServices } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const appServices = useAdminAppServices()

const activeTab = ref('list')
const searchQuery = ref('')

const services = appServices.services
const servicesLoading = appServices.servicesLoading
const selectedService = appServices.selectedService
const detailLoading = appServices.detailLoading
const pingResult = appServices.pingResult
const pingLoading = appServices.pingLoading

const filteredServices = computed(() => {
  if (!searchQuery.value) return services.value
  const q = searchQuery.value.toLowerCase()
  return services.value.filter(
    (s) =>
      s.id.toLowerCase().includes(q) || s.url?.toLowerCase().includes(q) || s.senderLocalpart?.toLowerCase().includes(q)
  )
})

function maskToken(token?: string): string {
  if (!token) return '-'
  if (token.length <= 8) return '****'
  return token.slice(0, 4) + '****' + token.slice(-4)
}

const serviceColumns = computed(() => [
  {
    title: t('admin.appServices.id'),
    key: 'id',
    ellipsis: { tooltip: true },
    width: 180
  },
  {
    title: t('admin.appServices.url'),
    key: 'url',
    ellipsis: { tooltip: true },
    width: 200
  },
  {
    title: t('admin.appServices.senderLocalpart'),
    key: 'senderLocalpart',
    width: 150,
    render(row: AppServiceInfo) {
      return row.senderLocalpart || '-'
    }
  },
  {
    title: t('admin.appServices.rateLimited'),
    key: 'rateLimited',
    width: 100,
    render(row: AppServiceInfo) {
      return h(NTag, { size: 'small', type: row.rateLimited ? 'warning' : 'success' }, () =>
        row.rateLimited ? t('admin.appServices.yes') : t('admin.appServices.no')
      )
    }
  },
  {
    title: t('admin.appServices.enabled'),
    key: 'enabled',
    width: 80,
    render(row: AppServiceInfo) {
      return h(NTag, { size: 'small', type: row.enabled ? 'success' : 'error' }, () =>
        row.enabled ? t('admin.appServices.yes') : t('admin.appServices.no')
      )
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 100,
    render(row: AppServiceInfo) {
      return h(NButton, { size: 'small', type: 'primary', onClick: () => openServiceDetail(row) }, () =>
        t('admin.appServices.detail')
      )
    }
  }
])

const namespaceColumns = computed(() => [
  {
    title: t('admin.appServices.nsRegex'),
    key: 'regex',
    ellipsis: { tooltip: true },
    render(row: Record<string, unknown>) {
      return (row.regex as string) || (row.exclusive as string) || JSON.stringify(row)
    }
  },
  {
    title: t('admin.appServices.nsExclusive'),
    key: 'exclusive',
    width: 100,
    render(row: Record<string, unknown>) {
      const exclusive = row.exclusive as boolean
      return h(NTag, { size: 'small', type: exclusive ? 'warning' : 'default' }, () =>
        exclusive ? t('admin.appServices.yes') : t('admin.appServices.no')
      )
    }
  }
])

async function loadServices() {
  if (!adminStore.isAdmin) return
  await appServices.loadServices()
}

async function openServiceDetail(row: AppServiceInfo) {
  await appServices.selectService(row.id)
  activeTab.value = 'detail'
}

async function handleToggleEnabled(enabled: boolean) {
  if (!selectedService.value) return
  try {
    await appServices.updateService(selectedService.value.id, { ...selectedService.value, enabled })
    showFeedback(enabled ? t('admin.appServices.enableSuccess') : t('admin.appServices.disableSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err))
      showFeedback(enabled ? t('admin.appServices.enableFailed') : t('admin.appServices.disableFailed'), 'error')
  }
}

async function handlePing() {
  if (!selectedService.value) return
  await appServices.pingService(selectedService.value.id)
}

async function handleDeleteService() {
  if (!selectedService.value) return
  try {
    await appServices.deleteService(selectedService.value.id)
    activeTab.value = 'list'
    showFeedback(t('admin.appServices.deleteSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.appServices.deleteFailed'), 'error')
  }
}

onMounted(() => {
  loadServices()
})
</script>

<style scoped lang="scss">
.admin-app-services {
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
