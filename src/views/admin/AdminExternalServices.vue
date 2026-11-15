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
          <div class="service-row">
            <div class="service-main">
              <div class="service-title">
                <span class="service-name">{{ service.display_name }}</span>
                <n-tag size="small" :bordered="false">{{ service.service_type }}</n-tag>
                <n-tag size="small" :type="healthTagType(service.service_id)" data-testid="health-tag">
                  {{ healthLabel(service.service_id) }}
                </n-tag>
              </div>
              <p class="service-meta">
                <span>{{ t('admin.externalServices.service_id') }}: {{ service.service_id }}</span>
                <span>{{ t('admin.externalServices.last_check') }}: {{ lastCheckLabel(service.service_id) }}</span>
              </p>
              <p v-if="healthMap[service.service_id]?.last_error" class="service-error">
                {{ healthMap[service.service_id].last_error }}
              </p>
            </div>
            <div class="service-actions">
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
            </div>
          </div>
        </n-list-item>
      </n-list>
      <n-empty v-else-if="!error" :description="t('admin.externalServices.empty')" data-testid="empty-state" />
    </n-spin>

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
  removeService
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

.service-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tjg-space-4);
  width: 100%;
}

.service-main {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1, 4px);
  min-width: 0;
}

.service-title {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-wrap: wrap;
}

.service-name {
  font-size: var(--tjg-font-size-base, 14px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-text-primary);
}

.service-meta {
  display: flex;
  gap: var(--tjg-space-4);
  margin: 0;
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-secondary);
  flex-wrap: wrap;
}

.service-error {
  margin: 0;
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-status-offline);
  word-break: break-word;
}

.service-actions {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-shrink: 0;
}

.register-modal {
  width: 480px;
  max-width: 90vw;
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

  .service-row {
    flex-direction: column;
    align-items: stretch;
  }

  .service-actions {
    justify-content: flex-end;
  }
}
</style>
