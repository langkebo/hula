<template>
  <section class="external-service-manager" role="region" :aria-label="t('external_service.title')">
    <header class="external-service-manager__header">
      <div class="external-service-manager__title-wrap">
        <svg
          class="external-service-manager__icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        <h3 class="external-service-manager__title">{{ t('external_service.title') }}</h3>
      </div>
      <n-button size="small" type="primary" @click="handleAdd">
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </template>
        {{ t('external_service.add') }}
      </n-button>
    </header>

    <n-spin :show="loading">
      <n-empty v-if="services.length === 0 && !loading" :description="t('external_service.empty')" />
      <n-list v-else bordered hoverable>
        <n-list-item v-for="service in services" :key="service.id" :data-service-id="service.id">
          <div class="external-service-manager__row">
            <div class="external-service-manager__info">
              <div class="external-service-manager__name-row">
                <span class="external-service-manager__name">{{ service.name }}</span>
                <n-tag size="small" :type="serviceTypeTagType(service.type)" round>
                  {{ serviceTypeLabel(service.type) }}
                </n-tag>
                <span
                  class="external-service-manager__status"
                  :class="`external-service-manager__status--${service.status}`"
                  :data-status="service.status">
                  <span
                    class="external-service-manager__status-dot status-dot"
                    :style="{ '--status-color': statusColorVar(service.status) }" />
                  {{ statusLabel(service.status) }}
                </span>
              </div>
              <p v-if="service.configSummary" class="external-service-manager__config">
                {{ service.configSummary }}
              </p>
            </div>
            <div class="external-service-manager__ops">
              <n-button size="tiny" quaternary @click="handleTestConnection(service.id)">
                {{ t('external_service.test_connection') }}
              </n-button>
              <n-button size="tiny" quaternary type="error" @click="handleRemove(service.id)">
                {{ t('external_service.remove') }}
              </n-button>
            </div>
          </div>
        </n-list-item>
      </n-list>
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NList, NListItem, NSpin, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'ExternalServiceManager' })

type ServiceType = 'translation' | 'push_gateway' | 'auth' | 'storage'
type ServiceStatus = 'active' | 'inactive' | 'connecting'

interface ExternalService {
  id: string
  name: string
  type: ServiceType
  status: ServiceStatus
  configSummary?: string
}

const props = defineProps<{
  services: ExternalService[]
  loading: boolean
}>()

const emit = defineEmits<{
  remove: [serviceId: string]
  'test-connection': [serviceId: string]
  add: []
}>()

const { t } = useI18n()

void props

function serviceTypeLabel(type: ServiceType): string {
  switch (type) {
    case 'translation':
      return t('external_service.type_translation')
    case 'push_gateway':
      return t('external_service.type_push_gateway')
    case 'auth':
      return t('external_service.type_auth')
    case 'storage':
      return t('external_service.type_storage')
  }
}

function serviceTypeTagType(type: ServiceType): 'info' | 'success' | 'warning' | 'error' {
  switch (type) {
    case 'translation':
      return 'info'
    case 'push_gateway':
      return 'success'
    case 'auth':
      return 'warning'
    case 'storage':
      return 'error'
  }
}

function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case 'active':
      return t('external_service.status_active')
    case 'inactive':
      return t('external_service.status_inactive')
    case 'connecting':
      return t('external_service.status_connecting')
  }
}

function statusColorVar(status: ServiceStatus): string {
  switch (status) {
    case 'active':
      return 'var(--tjg-status-online)'
    case 'inactive':
      return 'var(--tjg-status-offline)'
    case 'connecting':
      return 'var(--tjg-status-busy)'
  }
}

function handleRemove(serviceId: string): void {
  emit('remove', serviceId)
}

function handleTestConnection(serviceId: string): void {
  emit('test-connection', serviceId)
}

function handleAdd(): void {
  emit('add')
}
</script>

<style scoped lang="scss">
.external-service-manager {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-4);
  background: var(--tjg-surface-panel);
  border-radius: var(--tjg-radius-md);
}

.external-service-manager__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
}

.external-service-manager__title-wrap {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  color: var(--tjg-text-primary);
}

.external-service-manager__icon {
  flex-shrink: 0;
  color: var(--tjg-text-secondary);
}

.external-service-manager__title {
  margin: 0;
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-primary);
}

.external-service-manager__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  width: 100%;
}

.external-service-manager__info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
  min-width: 0;
  flex: 1;
}

.external-service-manager__name-row {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-wrap: wrap;
}

.external-service-manager__name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.external-service-manager__status {
  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.external-service-manager__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--status-color, var(--tjg-status-online));
  flex-shrink: 0;
}

.external-service-manager__status--active .external-service-manager__status-dot {
  background-color: var(--tjg-status-online);
}

.external-service-manager__status--inactive .external-service-manager__status-dot {
  background-color: var(--tjg-status-offline);
}

.external-service-manager__status--connecting .external-service-manager__status-dot {
  background-color: var(--tjg-status-busy);
}

.external-service-manager__config {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  word-break: break-all;
}

.external-service-manager__ops {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-1);
  flex-shrink: 0;
}
</style>
