<template>
  <div class="feature-flag-manager">
    <n-flex vertical :size="16">
      <!-- Toolbar -->
      <n-flex align="center" justify="space-between">
        <n-flex align="center" :size="12">
          <n-input
            v-model:value="searchQuery"
            :placeholder="t('admin.feature_flags.search_placeholder')"
            clearable
            style="width: 260px">
            <template #prefix>
              <Icon icon="mdi:magnify" />
            </template>
          </n-input>
        </n-flex>
        <n-button type="primary" size="small" @click="openCreateDialog">
          <template #icon>
            <Icon icon="mdi:plus" />
          </template>
          {{ t('admin.feature_flags.create') }}
        </n-button>
      </n-flex>

      <!-- Data Table -->
      <n-data-table
        :columns="columns"
        :data="filteredFlags"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :row-props="rowProps"
        :expandable="expandable"
        :expanded-row-keys="expandedRowKeys"
        @update:expanded-row-keys="handleExpandedRowKeysUpdate"
        size="small"
        :row-key="(row: AdminFeatureFlag) => row.flagKey" />

      <!-- Create / Edit Modal -->
      <n-modal
        v-model:show="showFormDialog"
        :title="isEditing ? t('admin.feature_flags.edit_title') : t('admin.feature_flags.create_title')"
        preset="dialog"
        style="width: 560px">
        <n-form :model="formData" label-placement="left" label-width="120">
          <n-form-item
            :label="t('admin.feature_flags.flag_key')"
            :validation-status="flagKeyError ? 'error' : undefined"
            :feedback="flagKeyError">
            <n-input
              v-model:value="formData.flagKey"
              :disabled="isEditing"
              :placeholder="t('admin.feature_flags.flag_key_placeholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.description')">
            <n-input
              v-model:value="formData.description"
              type="textarea"
              :rows="3"
              :placeholder="t('admin.feature_flags.description_placeholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.enabled')">
            <n-switch v-model:value="formData.enabled" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.target_scope')">
            <n-select
              v-model:value="formData.targetScope"
              :options="scopeOptions"
              :placeholder="t('admin.feature_flags.scope_placeholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.rollout_percent')">
            <n-input-number
              v-model:value="formData.rolloutPercent"
              :min="0"
              :max="100"
              style="width: 100%"
              :placeholder="t('admin.feature_flags.rollout_placeholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.expires_at')">
            <n-date-picker v-model:value="formData.expiresAt" type="datetime" clearable style="width: 100%" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.reason')">
            <n-input v-model:value="formData.reason" :placeholder="t('admin.feature_flags.reason_placeholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.feature_flags.targets')">
            <div class="w-full flex flex-col gap-12px">
              <div class="text-12px op-60">{{ t('admin.feature_flags.targets_hint') }}</div>
              <div
                v-for="(target, index) in formData.targets"
                :key="`${target.subjectType}-${target.subjectId}-${index}`"
                class="target-row">
                <n-select
                  v-model:value="target.subjectType"
                  :options="targetTypeOptions"
                  class="target-type-select"
                  :placeholder="t('admin.feature_flags.subject_type')" />
                <n-input
                  v-model:value="target.subjectId"
                  class="flex-1"
                  :placeholder="t('admin.feature_flags.subject_id_placeholder')" />
                <n-button quaternary @click="removeTarget(index)">
                  {{ t('admin.feature_flags.remove_target') }}
                </n-button>
              </div>
              <n-button dashed @click="addTarget">
                {{ t('admin.feature_flags.add_target') }}
              </n-button>
            </div>
          </n-form-item>
        </n-form>
        <template #action>
          <n-flex justify="end" :size="12">
            <n-button @click="showFormDialog = false">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" :loading="saving" @click="handleSubmit">
              {{ t('common.confirm') }}
            </n-button>
          </n-flex>
        </template>
      </n-modal>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  NButton,
  NDataTable,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
  NTag
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AdminFeatureFlag, type AdminFeatureFlagInput, useAdminMaintenance } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FeatureFlagManager')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const maintenance = useAdminMaintenance()
const featureFlags = maintenance.featureFlags
const loading = maintenance.loading
const saving = maintenance.featureSaving

const searchQuery = ref('')
const showFormDialog = ref(false)
const isEditing = ref(false)
const editingFlagKey = ref('')
const flagKeyError = ref('')
const expandedRowKeys = ref<string[]>([])

const pagination = { pageSize: 20 }

const scopeOptions = [
  { label: t('admin.feature_flags.scope_global'), value: 'global' },
  { label: t('admin.feature_flags.scope_tenant'), value: 'tenant' },
  { label: t('admin.feature_flags.scope_room'), value: 'room' },
  { label: t('admin.feature_flags.scope_user'), value: 'user' }
]

const targetTypeOptions = [
  { label: t('admin.feature_flags.scope_tenant'), value: 'tenant' },
  { label: t('admin.feature_flags.scope_room'), value: 'room' },
  { label: t('admin.feature_flags.scope_user'), value: 'user' }
]

const defaultFormData = () => ({
  flagKey: '',
  description: '',
  enabled: true,
  targetScope: 'global',
  rolloutPercent: 100,
  expiresAt: null as number | null,
  reason: '',
  targets: [] as Array<{ subjectType: string; subjectId: string }>
})

const formData = ref(defaultFormData())

const filteredFlags = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return featureFlags.value
  return featureFlags.value.filter(
    (flag) =>
      flag.flagKey.toLowerCase().includes(query) ||
      flag.description?.toLowerCase().includes(query) ||
      flag.targetScope?.toLowerCase().includes(query)
  )
})

function formatTimestamp(ts: number | undefined | null): string {
  if (!ts) return '-'
  const n = typeof ts === 'number' ? ts : Date.parse(String(ts))
  return Number.isFinite(n) ? new Date(n).toLocaleString() : String(ts)
}

const columns: DataTableColumns<AdminFeatureFlag> = [
  {
    title: t('admin.feature_flags.flag_key'),
    key: 'flagKey',
    ellipsis: { tooltip: true },
    width: 180
  },
  {
    title: t('admin.feature_flags.status'),
    key: 'enabled',
    width: 100,
    render: (row) =>
      h(NTag, { type: row.enabled ? 'success' : 'default', size: 'small' }, () =>
        row.enabled ? t('admin.feature_flags.enabled') : t('admin.feature_flags.disabled')
      )
  },
  {
    title: t('admin.feature_flags.description'),
    key: 'description',
    ellipsis: { tooltip: true },
    width: 200
  },
  {
    title: t('admin.feature_flags.target_scope'),
    key: 'targetScope',
    width: 100,
    render: (row) => {
      const scopeMap: Record<string, string> = {
        global: t('admin.feature_flags.scope_global'),
        tenant: t('admin.feature_flags.scope_tenant'),
        room: t('admin.feature_flags.scope_room'),
        user: t('admin.feature_flags.scope_user')
      }
      return scopeMap[row.targetScope] ?? row.targetScope
    }
  },
  {
    title: t('admin.feature_flags.rollout_percent'),
    key: 'rolloutPercent',
    width: 100,
    render: (row) => `${row.rolloutPercent ?? 0}%`
  },
  {
    title: t('admin.feature_flags.created'),
    key: 'createdTs',
    width: 160,
    render: (row) => formatTimestamp(row.createdTs)
  },
  {
    title: t('admin.feature_flags.actions'),
    key: 'actions',
    width: 140,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'tiny', quaternary: true, onClick: (event: MouseEvent) => openDetails(row, event) }, () =>
          t('admin.feature_flags.details')
        ),
        h(NButton, { size: 'tiny', onClick: (event: MouseEvent) => openEditDialog(row, event) }, () =>
          t('common.edit')
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDelete(row.flagKey) },
          {
            trigger: () => h(NButton, { size: 'tiny', type: 'error' }, () => t('common.delete')),
            default: () => t('admin.feature_flags.delete_confirm')
          }
        )
      ])
  }
]

const expandable = {
  renderExpand: (row: AdminFeatureFlag) =>
    h(NDescriptions, { column: 2, bordered: true, size: 'small' }, () => [
      h(NDescriptionsItem, { label: t('admin.feature_flags.flag_key') }, () => row.flagKey),
      h(NDescriptionsItem, { label: t('admin.feature_flags.status') }, () =>
        row.enabled ? t('admin.feature_flags.enabled') : t('admin.feature_flags.disabled')
      ),
      h(NDescriptionsItem, { label: t('admin.feature_flags.description') }, () => row.description || '-'),
      h(NDescriptionsItem, { label: t('admin.feature_flags.reason') }, () => row.reason || '-'),
      h(NDescriptionsItem, { label: t('admin.feature_flags.target_scope') }, () => row.targetScope || '-'),
      h(NDescriptionsItem, { label: t('admin.feature_flags.rollout_percent') }, () => `${row.rolloutPercent ?? 0}%`),
      h(NDescriptionsItem, { label: t('admin.feature_flags.created_by') }, () => row.createdBy || '-'),
      h(NDescriptionsItem, { label: t('admin.feature_flags.updated') }, () => formatTimestamp(row.updatedTs)),
      h(NDescriptionsItem, { label: t('admin.feature_flags.expires_at') }, () => formatTimestamp(row.expiresAt)),
      h(NDescriptionsItem, { label: t('admin.feature_flags.targets') }, () =>
        row.targets?.length
          ? row.targets.map((target) => `${target.subjectType}:${target.subjectId}`).join(', ')
          : t('admin.feature_flags.no_targets')
      )
    ])
}

function rowProps(row: AdminFeatureFlag) {
  return {
    style: 'cursor: pointer',
    onClick: () => {
      if (expandedRowKeys.value.includes(row.flagKey)) {
        expandedRowKeys.value = expandedRowKeys.value.filter((key) => key !== row.flagKey)
      } else {
        expandedRowKeys.value = [...expandedRowKeys.value, row.flagKey]
      }
    }
  }
}

function handleExpandedRowKeysUpdate(keys: Array<string | number>) {
  expandedRowKeys.value = keys as string[]
}

function openCreateDialog() {
  isEditing.value = false
  editingFlagKey.value = ''
  formData.value = defaultFormData()
  flagKeyError.value = ''
  showFormDialog.value = true
}

function openDetails(flag: AdminFeatureFlag, event?: MouseEvent) {
  event?.stopPropagation()
  if (expandedRowKeys.value.includes(flag.flagKey)) {
    expandedRowKeys.value = expandedRowKeys.value.filter((key) => key !== flag.flagKey)
  } else {
    expandedRowKeys.value = [...expandedRowKeys.value, flag.flagKey]
  }
}

function addTarget() {
  formData.value.targets.push({
    subjectType: formData.value.targetScope === 'global' ? 'user' : formData.value.targetScope,
    subjectId: ''
  })
}

function removeTarget(index: number) {
  formData.value.targets.splice(index, 1)
}

async function openEditDialog(flag: AdminFeatureFlag, event?: MouseEvent) {
  event?.stopPropagation()
  isEditing.value = true
  editingFlagKey.value = flag.flagKey
  flagKeyError.value = ''
  try {
    const detail = (await maintenance.getFeatureFlagDetail(flag.flagKey)) ?? flag
    formData.value = {
      flagKey: detail.flagKey,
      description: detail.description ?? '',
      enabled: detail.enabled,
      targetScope: detail.targetScope ?? 'global',
      rolloutPercent: detail.rolloutPercent ?? 100,
      expiresAt: detail.expiresAt,
      reason: detail.reason ?? '',
      targets: (detail.targets ?? []).map((target) => ({
        subjectType: target.subjectType,
        subjectId: target.subjectId
      }))
    }
    showFormDialog.value = true
  } catch (err) {
    logger.error('加载特性标志详情失败:', err)
    showFeedback(t('admin.feature_flags.load_detail_failed'), 'error')
  }
}

async function handleSubmit() {
  flagKeyError.value = ''
  if (!formData.value.flagKey.trim()) {
    flagKeyError.value = t('admin.feature_flags.flag_key_required')
    return
  }

  const input: AdminFeatureFlagInput = {
    flagKey: formData.value.flagKey.trim(),
    targetScope: formData.value.targetScope,
    rolloutPercent: formData.value.rolloutPercent,
    expiresAt: formData.value.expiresAt,
    reason: formData.value.reason?.trim() || formData.value.description?.trim() || undefined,
    targets: formData.value.targets
      .filter((target) => target.subjectType.trim() && target.subjectId.trim())
      .map((target) => ({
        subjectType: target.subjectType.trim(),
        subjectId: target.subjectId.trim()
      }))
  }

  try {
    await maintenance.saveFeatureFlag(input)
    showFeedback(
      isEditing.value ? t('admin.feature_flags.update_success') : t('admin.feature_flags.create_success'),
      'success'
    )
    showFormDialog.value = false
  } catch (err) {
    logger.error('保存特性标志失败:', err)
    showFeedback(
      isEditing.value ? t('admin.feature_flags.update_failed') : t('admin.feature_flags.create_failed'),
      'error'
    )
  }
}

async function handleDelete(flagKey: string) {
  try {
    await maintenance.deleteFeatureFlag(flagKey)
    showFeedback(t('admin.feature_flags.delete_success'), 'success')
  } catch (err) {
    logger.error('删除特性标志失败:', err)
    showFeedback(t('admin.feature_flags.delete_failed'), 'error')
  }
}

async function loadData() {
  try {
    await maintenance.loadFeatureFlags()
  } catch (err) {
    logger.error('加载特性标志失败:', err)
    showFeedback(t('admin.feature_flags.load_failed'), 'error')
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.feature-flag-manager {
  width: 100%;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.target-type-select {
  width: 160px;
}
</style>
