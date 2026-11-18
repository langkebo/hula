<template>
  <div class="admin-external-services">
    <n-page-header :title="t('admin.externalServices.title')" :subtitle="t('admin.externalServices.subtitle')">
      <template #extra>
        <n-button class="header-btn" :loading="loading" data-testid="refresh" @click="loadServices()">
          {{ t('common.refresh') }}
        </n-button>
        <n-button type="primary" data-testid="register-open" @click="openRegister">
          {{ t('admin.externalServices.register') }}
        </n-button>
      </template>
    </n-page-header>

    <n-alert type="info" class="block-gap">
      {{ t('admin.externalServices.panel_notice') }}
    </n-alert>

    <n-alert v-if="error" type="error" class="block-gap" data-testid="load-error">
      <div class="error-row">
        <span>{{ t('admin.load_failed') }}</span>
        <n-button size="small" data-testid="retry" @click="loadServices()">{{ t('common.refresh') }}</n-button>
      </div>
    </n-alert>

    <div class="toolbar">
      <n-select
        v-model:value="selectedType"
        :options="filterOptions"
        size="small"
        class="type-filter"
        data-testid="type-filter"
        @update:value="onFilterChange" />
    </div>

    <n-spin :show="loading">
      <n-list v-if="services.length" bordered>
        <n-list-item v-for="service in services" :key="service.as_id" data-testid="service-item">
          <AdminServiceRow
            :name="service.display_name"
            :meta="serviceMeta(service.service_id)"
            :error-text="healthMap[service.service_id]?.last_error">
            <template #tags>
              <n-tag size="small" :bordered="false">{{ service.service_type }}</n-tag>
              <n-tag size="small" :type="healthTagType(service.service_id)" data-testid="health-tag">
                {{ healthLabel(service.service_id) }}
              </n-tag>
            </template>
            <template #actions>
              <n-switch
                :value="service.is_enabled"
                size="small"
                :loading="mutating"
                :data-testid="`toggle-${service.as_id}`"
                @update:value="(value: boolean) => setEnabled(service, value)" />
              <n-button
                size="small"
                :loading="checkingId === service.as_id"
                :data-testid="`check-${service.as_id}`"
                @click="checkHealth(service)">
                {{ t('admin.externalServices.health_check') }}
              </n-button>
              <n-popconfirm @positive-click="removeService(service)">
                <template #trigger>
                  <n-button size="small" type="error" quaternary :data-testid="`delete-${service.as_id}`">
                    {{ t('admin.externalServices.delete') }}
                  </n-button>
                </template>
                {{ t('admin.externalServices.delete_confirm', { name: service.display_name }) }}
              </n-popconfirm>
            </template>
          </AdminServiceRow>
        </n-list-item>
      </n-list>
      <n-empty v-else-if="!error" :description="t('admin.externalServices.empty')" data-testid="empty-state" />
    </n-spin>

    <n-card size="small" class="block-gap client-card" data-testid="client-services">
      <template #header>
        <div class="client-header">
          <span>{{ t('admin.externalServices.client_title') }}</span>
          <n-button size="small" :loading="clientLoading" data-testid="client-refresh" @click="loadClientHealth()">
            {{ t('common.refresh') }}
          </n-button>
        </div>
      </template>
      <p class="client-hint">{{ t('admin.externalServices.client_hint') }}</p>
      <n-list v-if="clientServices.length" bordered>
        <n-list-item v-for="item in clientServices" :key="item.id" data-testid="client-service-item">
          <AdminServiceRow :name="item.id" :meta="clientMeta(item.last_check)">
            <template #tags>
              <n-tag size="small" :bordered="false">{{ item.type }}</n-tag>
              <n-tag size="small" :type="clientStatusTagType(item.status)" data-testid="client-status">
                {{ item.status }}
              </n-tag>
            </template>
            <template #actions>
              <n-button
                size="small"
                :loading="clientMutatingId === item.id"
                :data-testid="`client-enable-${item.id}`"
                @click="setClientEnabled(item.id, true)">
                {{ t('admin.externalServices.enable') }}
              </n-button>
              <n-button
                size="small"
                :loading="clientMutatingId === item.id"
                :data-testid="`client-disable-${item.id}`"
                @click="setClientEnabled(item.id, false)">
                {{ t('admin.externalServices.disable') }}
              </n-button>
              <n-popconfirm @positive-click="removeClientService(item.id)">
                <template #trigger>
                  <n-button size="small" type="error" quaternary :data-testid="`client-delete-${item.id}`">
                    {{ t('admin.externalServices.delete') }}
                  </n-button>
                </template>
                {{ t('admin.externalServices.delete_confirm', { name: item.id }) }}
              </n-popconfirm>
            </template>
          </AdminServiceRow>
        </n-list-item>
      </n-list>
      <n-empty v-else :description="t('admin.externalServices.client_empty')" data-testid="client-empty-state" />
    </n-card>

    <n-modal
      v-model:show="showRegister"
      preset="card"
      class="register-modal"
      :title="t('admin.externalServices.register_title')">
      <n-form label-placement="top">
        <n-form-item :label="t('admin.externalServices.service_type')" required>
          <n-select v-model:value="draft.service_type" :options="typeOptions" data-testid="draft-type" />
        </n-form-item>
        <n-form-item :label="t('admin.externalServices.service_id')" required>
          <n-input v-model:value="draft.service_id" data-testid="draft-id" />
        </n-form-item>
        <n-form-item :label="t('admin.externalServices.display_name')" required>
          <n-input v-model:value="draft.display_name" data-testid="draft-name" />
        </n-form-item>
        <n-form-item :label="t('admin.externalServices.webhook_url')">
          <n-input v-model:value="draft.webhook_url" placeholder="https://" data-testid="draft-webhook" />
        </n-form-item>
        <n-form-item :label="t('admin.externalServices.api_key')">
          <n-input v-model:value="draft.api_key" type="password" show-password-on="click" data-testid="draft-key" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="modal-footer">
          <n-button @click="showRegister = false">{{ t('common.cancel') }}</n-button>
          <n-button
            type="primary"
            :loading="mutating"
            :disabled="!canSubmit"
            data-testid="register-submit"
            @click="submitRegister">
            {{ t('common.confirm') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NList,
  NListItem,
  NModal,
  NPageHeader,
  NPopconfirm,
  NSelect,
  NSpin,
  NSwitch,
  NTag
} from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminExternalServices } from '@/composables/admin'
import AdminServiceRow from './AdminServiceRow.vue'

defineOptions({
  name: 'AdminExternalServices'
})

const { t } = useI18n()
const {
  services,
  healthMap,
  loading,
  error,
  serviceType,
  checkingId,
  mutating,
  loadServices,
  registerService,
  setEnabled,
  checkHealth,
  removeService,
  clientServices,
  clientLoading,
  clientMutatingId,
  loadClientHealth,
  setClientEnabled,
  removeClientService
} = useAdminExternalServices()

const SERVICE_TYPES = ['trendradar', 'openclaw', 'webhook', 'irc', 'slack', 'discord', 'custom'] as const

const selectedType = ref(serviceType.value)
const showRegister = ref(false)
const draft = reactive({ service_type: 'webhook', service_id: '', display_name: '', webhook_url: '', api_key: '' })

const typeOptions = SERVICE_TYPES.map((value) => ({ label: value, value }))

const filterOptions = computed(() => [{ label: t('admin.externalServices.filter_all'), value: 'all' }, ...typeOptions])

const canSubmit = computed(
  () => Boolean(draft.service_type) && Boolean(draft.service_id.trim()) && Boolean(draft.display_name.trim())
)

function healthTagType(serviceId: string): 'success' | 'error' | 'default' {
  const health = healthMap.value[serviceId]
  if (!health) return 'default'
  return health.is_healthy ? 'success' : 'error'
}

function healthLabel(serviceId: string): string {
  const health = healthMap.value[serviceId]
  if (!health) return t('admin.externalServices.unknown')
  return health.is_healthy ? t('admin.externalServices.healthy') : t('admin.externalServices.unhealthy')
}

function lastCheckLabel(serviceId: string): string {
  const ts = healthMap.value[serviceId]?.last_check_ts
  return ts ? new Date(ts).toLocaleString() : t('admin.externalServices.never_checked')
}

function clientStatusTagType(status: string): 'success' | 'error' | 'default' {
  if (status === 'healthy' || status === 'ok' || status === 'enabled') return 'success'
  if (status === 'unhealthy' || status === 'error' || status === 'disabled') return 'error'
  return 'default'
}

function clientLastCheckLabel(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : t('admin.externalServices.never_checked')
}

function serviceMeta(serviceId: string): string[] {
  return [
    `${t('admin.externalServices.service_id')}: ${serviceId}`,
    `${t('admin.externalServices.last_check')}: ${lastCheckLabel(serviceId)}`
  ]
}

function clientMeta(ts?: number): string[] {
  return [`${t('admin.externalServices.last_check')}: ${clientLastCheckLabel(ts)}`]
}

function onFilterChange(value: string) {
  void loadServices(value)
}

function openRegister() {
  draft.service_type = 'webhook'
  draft.service_id = ''
  draft.display_name = ''
  draft.webhook_url = ''
  draft.api_key = ''
  showRegister.value = true
}

async function submitRegister() {
  const created = await registerService(draft)
  if (created) {
    showRegister.value = false
  }
}

onMounted(() => {
  void loadServices()
  void loadClientHealth()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-external-services {
  padding: 16px 24px;
}

.header-btn {
  margin-right: 8px;
}

.block-gap {
  margin: 12px 0;
}

.error-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.type-filter {
  width: 200px;
}

.register-modal {
  width: 480px;
  max-width: 90vw;
}

.client-card {
  margin-top: 16px;
}

.client-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  font-weight: var(--tjg-font-weight-medium, 500);
}

.client-hint {
  margin: 0 0 var(--tjg-space-2);
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--tjg-space-2);
}

@include responsive.down('md') {
  .admin-external-services {
    padding: 12px;
  }

  .toolbar {
    justify-content: stretch;
  }

  .type-filter {
    width: 100%;
  }
}
</style>
