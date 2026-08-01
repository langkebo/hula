<template>
  <div class="admin-external-services">
    <n-page-header :title="t('external_services.title')" :subtitle="t('external_services.subtitle')">
      <template #extra>
        <n-space align="center" :size="8">
          <n-select
            v-model:value="filterServiceType"
            :options="serviceTypeOptions"
            :placeholder="t('external_services.filters.service_type_placeholder')"
            style="width: 180px"
            data-testid="filter-service-type"
            clearable
            @update:value="loadAll" />
          <n-button data-testid="register-btn" type="primary" secondary @click="openRegisterDialog">
            {{ t('external_services.actions.register') }}
          </n-button>
          <n-button data-testid="check-all-health-btn" :loading="healthLoading" secondary @click="loadHealth">
            {{ t('external_services.actions.check_all_health') }}
          </n-button>
          <n-button data-testid="refresh-btn" :loading="loading" @click="loadAll">
            {{ t('external_services.actions.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-card :title="t('external_services.list.title')" size="small" class="mt-16px">
      <div v-if="loading" class="table-loading">
        <n-spin size="small" />
      </div>
      <n-empty v-else-if="services.length === 0" :description="t('external_services.list.empty')" size="small" />
      <div v-else class="services-table">
        <div class="table-row table-header">
          <div class="table-cell">{{ t('external_services.list.as_id') }}</div>
          <div class="table-cell">{{ t('external_services.list.service_type') }}</div>
          <div class="table-cell">{{ t('external_services.list.display_name') }}</div>
          <div class="table-cell">{{ t('external_services.list.is_enabled') }}</div>
          <div class="table-cell">{{ t('external_services.list.is_healthy') }}</div>
          <div class="table-cell">{{ t('external_services.list.created_ts') }}</div>
          <div class="table-cell">{{ t('external_services.list.actions') }}</div>
        </div>
        <div v-for="row in services" :key="row.as_id" class="table-row" data-testid="service-row">
          <div class="table-cell" :title="row.as_id">{{ row.as_id }}</div>
          <div class="table-cell">
            <n-tag size="small">{{ row.service_type }}</n-tag>
          </div>
          <div class="table-cell" :title="row.display_name">{{ row.display_name }}</div>
          <div class="table-cell">
            <n-tag size="small" :type="row.is_enabled ? 'success' : 'default'">
              {{ row.is_enabled ? t('external_services.common.yes') : t('external_services.common.no') }}
            </n-tag>
          </div>
          <div class="table-cell">
            <n-tag size="small" :type="row.is_healthy ? 'success' : 'error'">
              {{ row.is_healthy ? t('external_services.health.healthy') : t('external_services.health.unhealthy') }}
            </n-tag>
          </div>
          <div class="table-cell">{{ formatTimestamp(row.created_ts) }}</div>
          <div class="table-cell action-buttons">
            <n-button
              size="tiny"
              secondary
              :disabled="actionLoading !== null"
              data-testid="action-check-health"
              @click="handleCheckHealth(row.as_id)">
              {{ t('external_services.actions.check_health') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              :disabled="actionLoading !== null"
              data-testid="action-toggle-enabled"
              @click="handleToggleEnabled(row)">
              {{ row.is_enabled ? t('external_services.actions.disable') : t('external_services.actions.enable') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              type="error"
              :disabled="actionLoading !== null"
              data-testid="action-delete"
              @click="handleDelete(row.as_id)">
              {{ t('external_services.actions.delete') }}
            </n-button>
          </div>
        </div>
      </div>
    </n-card>

    <n-card :title="t('external_services.health.title')" size="small" class="mt-16px">
      <div v-if="healthLoading" class="table-loading">
        <n-spin size="small" />
      </div>
      <n-empty v-else-if="healthList.length === 0" :description="t('external_services.health.empty')" size="small" />
      <div v-else class="health-table">
        <div class="table-row table-header">
          <div class="table-cell">{{ t('external_services.list.as_id') }}</div>
          <div class="table-cell">{{ t('external_services.list.service_type') }}</div>
          <div class="table-cell">{{ t('external_services.list.is_healthy') }}</div>
          <div class="table-cell">{{ t('external_services.health.last_check_ts') }}</div>
          <div class="table-cell">{{ t('external_services.health.last_success_ts') }}</div>
          <div class="table-cell">{{ t('external_services.health.last_error') }}</div>
          <div class="table-cell">{{ t('external_services.health.consecutive_failures') }}</div>
        </div>
        <div v-for="row in healthList" :key="row.service_id" class="table-row">
          <div class="table-cell" :title="row.service_id">{{ row.service_id }}</div>
          <div class="table-cell">{{ row.service_type }}</div>
          <div class="table-cell">
            <n-tag size="small" :type="row.is_healthy ? 'success' : 'error'">
              {{ row.is_healthy ? t('external_services.health.healthy') : t('external_services.health.unhealthy') }}
            </n-tag>
          </div>
          <div class="table-cell">{{ formatTimestamp(row.last_check_ts) }}</div>
          <div class="table-cell">{{ formatTimestamp(row.last_success_ts) }}</div>
          <div class="table-cell" :title="row.last_error ?? ''">{{ row.last_error ?? '-' }}</div>
          <div class="table-cell">{{ row.consecutive_failures }}</div>
        </div>
      </div>
    </n-card>

    <!-- 注册对话框 -->
    <n-modal
      v-model:show="registerDialogVisible"
      preset="card"
      :title="t('external_services.register.title')"
      style="width: 520px">
      <n-form :model="registerForm">
        <n-form-item :label="t('external_services.register.service_type')" path="service_type">
          <n-input
            v-model:value="registerForm.service_type"
            :placeholder="t('external_services.register.service_type_placeholder')"
            data-testid="register-service-type" />
        </n-form-item>
        <n-form-item :label="t('external_services.register.service_id')" path="service_id">
          <n-input
            v-model:value="registerForm.service_id"
            :placeholder="t('external_services.register.service_id_placeholder')"
            data-testid="register-service-id" />
        </n-form-item>
        <n-form-item :label="t('external_services.register.display_name')" path="display_name">
          <n-input
            v-model:value="registerForm.display_name"
            :placeholder="t('external_services.register.display_name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('external_services.register.webhook_url')" path="webhook_url">
          <n-input
            v-model:value="registerForm.webhook_url"
            :placeholder="t('external_services.register.webhook_url_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('external_services.register.api_key')" path="api_key">
          <n-input
            v-model:value="registerForm.api_key"
            :placeholder="t('external_services.register.api_key_placeholder')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="dialog-footer">
          <n-button data-testid="register-cancel" @click="registerDialogVisible = false">
            {{ t('external_services.common.cancel') }}
          </n-button>
          <n-button
            type="primary"
            data-testid="register-submit"
            :loading="actionLoading === 'register'"
            :disabled="!canSubmitRegister"
            @click="handleRegister">
            {{ t('external_services.actions.register') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPageHeader,
  NSelect,
  NSpace,
  NSpin,
  NTag
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import type { ExternalService, ExternalServiceHealth } from '@/services/matrix/admin/ExternalServiceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminExternalServices')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const healthLoading = ref(false)
const actionLoading = ref<string | null>(null)

const services = ref<ExternalService[]>([])
const healthList = ref<ExternalServiceHealth[]>([])

const filterServiceType = ref<string | null>(null)

const registerDialogVisible = ref(false)
const registerForm = ref({
  service_type: '',
  service_id: '',
  display_name: '',
  webhook_url: '',
  api_key: ''
})

const serviceTypeOptions = computed(() => [
  { label: t('external_services.filters.service_type_all'), value: 'all' },
  { label: 'TrendRadar', value: 'trendradar' },
  { label: 'OpenClaw', value: 'openclaw' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'IRC Bridge', value: 'irc_bridge' },
  { label: 'Slack Bridge', value: 'slack_bridge' },
  { label: 'Discord Bridge', value: 'discord_bridge' },
  { label: 'Custom', value: 'custom' }
])

const canSubmitRegister = computed(() => {
  return (
    registerForm.value.service_type.trim() !== '' &&
    registerForm.value.service_id.trim() !== '' &&
    registerForm.value.display_name.trim() !== ''
  )
})

const formatTimestamp = (ts?: number | null): string => {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

async function loadServices() {
  loading.value = true
  try {
    services.value = await adminService.externalServices.listServices({
      serviceType: filterServiceType.value ?? undefined
    })
  } catch (err) {
    logger.error('加载服务列表失败:', err)
    services.value = []
  } finally {
    loading.value = false
  }
}

async function loadHealth() {
  healthLoading.value = true
  try {
    healthList.value = await adminService.externalServices.getAllHealth()
  } catch (err) {
    logger.error('加载健康状态失败:', err)
    healthList.value = []
  } finally {
    healthLoading.value = false
  }
}

async function loadAll() {
  await Promise.allSettled([loadServices(), loadHealth()])
}

function openRegisterDialog() {
  registerForm.value = {
    service_type: '',
    service_id: '',
    display_name: '',
    webhook_url: '',
    api_key: ''
  }
  registerDialogVisible.value = true
}

async function handleRegister() {
  actionLoading.value = 'register'
  try {
    await adminService.externalServices.registerService({
      service_type: registerForm.value.service_type.trim(),
      service_id: registerForm.value.service_id.trim(),
      display_name: registerForm.value.display_name.trim(),
      webhook_url: registerForm.value.webhook_url.trim() || undefined,
      api_key: registerForm.value.api_key.trim() || undefined
    })
    showFeedback(t('external_services.feedback.register_success'), 'success')
    registerDialogVisible.value = false
    await loadAll()
  } catch (err) {
    logger.error('注册外部服务失败:', err)
    showFeedback(t('external_services.feedback.register_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleCheckHealth(asId: string) {
  actionLoading.value = `check:${asId}`
  try {
    await adminService.externalServices.checkServiceHealth(asId)
    showFeedback(t('external_services.feedback.health_check_success'), 'success')
    await loadAll()
  } catch (err) {
    logger.error('健康检查失败:', err)
    showFeedback(t('external_services.feedback.health_check_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleToggleEnabled(row: ExternalService) {
  actionLoading.value = `toggle:${row.as_id}`
  try {
    await adminService.externalServices.updateService(row.as_id, {
      is_enabled: !row.is_enabled
    })
    showFeedback(t('external_services.feedback.update_success'), 'success')
    await loadServices()
  } catch (err) {
    logger.error('切换启用状态失败:', err)
    showFeedback(t('external_services.feedback.update_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

async function handleDelete(asId: string) {
  if (!window.confirm(t('external_services.feedback.delete_confirm'))) {
    return
  }
  actionLoading.value = `delete:${asId}`
  try {
    await adminService.externalServices.deleteService(asId)
    showFeedback(t('external_services.feedback.delete_success'), 'success')
    await loadAll()
  } catch (err) {
    logger.error('删除服务失败:', err)
    showFeedback(t('external_services.feedback.delete_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped lang="scss">
.admin-external-services {
  padding: 16px 24px;
  height: 100%;
  overflow-y: auto;
}

.mt-16px {
  margin-top: 16px;
}

.table-loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.services-table,
.health-table {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr 1fr 1fr 1.5fr 2fr;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--hula-border-layout-divider);
  align-items: center;

  &.table-header {
    font-weight: 600;
    color: var(--hula-text-secondary);
    background: var(--hula-fill-default, rgba(0, 0, 0, 0.02));
  }
}

.health-table .table-row {
  grid-template-columns: 2fr 1fr 1fr 1.5fr 1.5fr 2fr 1fr;
}

.table-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
