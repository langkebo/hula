<template>
  <div class="admin-cas">
    <n-alert :bordered="false" type="info">{{ t('admin.cas.hint') }}</n-alert>

    <n-card :title="t('admin.cas.servicesTitle')" class="mt-16px">
      <template #header-extra>
        <n-button data-testid="admin-cas-services-refresh" :loading="servicesLoading" @click="loadServices">
          {{ t('admin.common.refresh') }}
        </n-button>
      </template>

      <n-space vertical>
        <n-alert
          v-if="servicesError"
          data-testid="admin-cas-services-error"
          type="error"
          closable
          @close="servicesError = null">
          {{ servicesError }}
        </n-alert>
        <AdminTable
          :columns="serviceColumns"
          :data="services"
          :loading="servicesLoading"
          :row-key="(row: CasServiceInfo) => row.id"
          :scroll-x="720">
          <template #empty>
            <EmptyState compact data-testid="admin-cas-services-empty" :description="t('admin.cas.servicesEmpty')" />
          </template>
        </AdminTable>
      </n-space>
    </n-card>

    <n-card :title="t('admin.cas.createTitle')" class="mt-16px">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.cas.createHint') }}</n-alert>
        <n-input
          v-model:value="draftId"
          data-testid="admin-cas-service-id"
          :placeholder="t('admin.cas.serviceIdPlaceholder')" />
        <n-input
          v-model:value="draftName"
          data-testid="admin-cas-service-name"
          :placeholder="t('admin.cas.serviceNamePlaceholder')" />
        <n-input
          v-model:value="draftUrl"
          data-testid="admin-cas-service-url"
          :placeholder="t('admin.cas.serviceUrlPlaceholder')" />
        <n-input
          v-model:value="draftDescription"
          data-testid="admin-cas-service-description"
          :placeholder="t('admin.cas.serviceDescriptionPlaceholder')" />
        <n-button data-testid="admin-cas-service-submit" type="primary" :loading="creating" @click="handleCreate">
          {{ t('admin.cas.createSubmit') }}
        </n-button>
      </n-space>
    </n-card>

    <n-card :title="t('admin.cas.attributesTitle')" class="mt-16px">
      <n-space vertical>
        <n-space align="center" :wrap="true">
          <n-input
            v-model:value="attributesUserId"
            data-testid="admin-cas-attributes-user-id"
            :placeholder="t('admin.cas.userIdPlaceholder')"
            class="w-[360px]" />
          <n-button data-testid="admin-cas-attributes-load" :loading="attributesLoading" @click="handleLoadAttributes">
            {{ t('admin.cas.attributesLoad') }}
          </n-button>
        </n-space>

        <n-alert
          v-if="attributesError"
          data-testid="admin-cas-attributes-error"
          type="error"
          closable
          @close="attributesError = null">
          {{ attributesError }}
        </n-alert>

        <AdminTable
          :columns="attributeColumns"
          :data="attributes"
          :loading="attributesLoading"
          :row-key="(row: CasUserAttribute) => row.name"
          :scroll-x="640">
          <template #empty>
            <EmptyState
              compact
              data-testid="admin-cas-attributes-empty"
              :description="t('admin.cas.attributesEmpty')" />
          </template>
        </AdminTable>

        <n-alert :bordered="false" type="info">{{ t('admin.cas.attributeWriteHint') }}</n-alert>
        <n-space align="center" :wrap="true">
          <n-input
            v-model:value="attributeName"
            data-testid="admin-cas-attribute-name"
            :placeholder="t('admin.cas.attributeNamePlaceholder')"
            class="w-[220px]" />
          <n-input
            v-model:value="attributeValue"
            data-testid="admin-cas-attribute-value"
            :placeholder="t('admin.cas.attributeValuePlaceholder')"
            class="w-[280px]" />
          <n-button
            data-testid="admin-cas-attribute-submit"
            type="primary"
            :loading="attributesSaving"
            @click="handleSaveAttribute">
            {{ t('admin.cas.attributeSubmit') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { type DataTableColumns, NAlert, NButton, NCard, NInput, NSpace, NTag, useDialog } from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminTable from '@/components/admin/AdminTable.vue'
import { useAdminCas } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { CasServiceInfo, CasUserAttribute } from '@/services/matrix/admin'

defineOptions({ name: 'AdminCas' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const {
  services,
  servicesLoading,
  servicesError,
  creating,
  attributes,
  attributesLoading,
  attributesSaving,
  attributesError,
  loadServices,
  createService,
  deleteService,
  loadUserAttributes,
  saveUserAttribute
} = useAdminCas()

/** 加载完成且无数据时才展示空态，避免加载中抢先渲染空提示 */

const draftId = ref('')
const draftName = ref('')
const draftUrl = ref('')
const draftDescription = ref('')

const attributesUserId = ref('')
const attributeName = ref('')
const attributeValue = ref('')

const serviceColumns = computed<DataTableColumns<CasServiceInfo>>(() => [
  { title: t('admin.cas.column.id'), key: 'id', width: 180, ellipsis: { tooltip: true } },
  { title: t('admin.cas.column.name'), key: 'name', width: 160, ellipsis: { tooltip: true } },
  { title: t('admin.cas.column.serviceUrl'), key: 'service_url', ellipsis: { tooltip: true } },
  {
    title: t('admin.cas.column.enabled'),
    key: 'enabled',
    width: 110,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.enabled ? 'success' : 'default' },
        { default: () => (row.enabled ? t('admin.cas.enabled') : t('admin.cas.disabled')) }
      )
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 110,
    render: (row) =>
      h(
        NButton,
        { size: 'small', type: 'error', tertiary: true, onClick: () => confirmDelete(row) },
        { default: () => t('admin.common.delete') }
      )
  }
])

const attributeColumns: DataTableColumns<CasUserAttribute> = [
  { title: t('admin.cas.column.attributeName'), key: 'name', width: 220, ellipsis: { tooltip: true } },
  { title: t('admin.cas.column.attributeValue'), key: 'value', ellipsis: { tooltip: true } }
]

function confirmDelete(row: CasServiceInfo): void {
  dialog.warning({
    title: t('admin.cas.deleteConfirmTitle'),
    content: t('admin.cas.deleteConfirmContent', { id: row.id }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      const ok = await deleteService(row.id)
      showFeedback(ok ? t('admin.cas.deleteSuccess') : t('admin.cas.deleteFailed'), ok ? 'success' : 'error')
    }
  })
}

async function handleCreate(): Promise<void> {
  const serviceId = draftId.value.trim()
  const name = draftName.value.trim()
  const serviceUrlPattern = draftUrl.value.trim()
  if (!serviceId || !name || !serviceUrlPattern) {
    showFeedback(t('admin.cas.requiredFields'), 'error')
    return
  }
  const description = draftDescription.value.trim()
  const ok = await createService({
    service_id: serviceId,
    name,
    service_url_pattern: serviceUrlPattern,
    ...(description.length > 0 ? { description } : {})
  })
  showFeedback(ok ? t('admin.cas.createSuccess') : t('admin.cas.createFailed'), ok ? 'success' : 'error')
  if (ok) {
    draftId.value = ''
    draftName.value = ''
    draftUrl.value = ''
    draftDescription.value = ''
  }
}

async function handleLoadAttributes(): Promise<void> {
  const userId = attributesUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.cas.userIdRequired'), 'error')
    return
  }
  const ok = await loadUserAttributes(userId)
  showFeedback(
    ok ? t('admin.cas.attributesLoadSuccess') : t('admin.cas.attributesLoadFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleSaveAttribute(): Promise<void> {
  const userId = attributesUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.cas.userIdRequired'), 'error')
    return
  }
  const name = attributeName.value.trim()
  if (!name) {
    showFeedback(t('admin.cas.attributeNameRequired'), 'error')
    return
  }
  const ok = await saveUserAttribute(userId, {
    attribute_name: name,
    attribute_value: attributeValue.value
  })
  showFeedback(ok ? t('admin.cas.attributeSaved') : t('admin.cas.attributeSaveFailed'), ok ? 'success' : 'error')
  if (ok) {
    attributeName.value = ''
    attributeValue.value = ''
  }
}

onMounted(() => {
  void loadServices()
})
</script>

<style scoped>
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-cas {
  max-width: 1200px;
}

.mt-16px {
  margin-top: 16px;
}

@media (prefers-reduced-motion: reduce) {
  .admin-cas {
    transition: none;
  }
}

@include responsive.down('md') {
  .mt-16px {
    margin-top: 12px;
  }
}
</style>
