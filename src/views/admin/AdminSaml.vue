<template>
  <div class="admin-saml">
    <n-page-header :title="t('admin.saml.title')" :subtitle="t('admin.saml.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="loadAll" :loading="loading">
            {{ t('common.refresh') }}
          </n-button>
          <n-button type="primary" @click="handleRefreshMetadata" :loading="refreshing">
            {{ t('admin.saml.refresh_idp') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-alert type="info" class="my-12px">
      {{ t('admin.saml.metadata_info') }}
    </n-alert>

    <n-tabs v-model:value="activeTab" type="line" animated>
      <!-- Config Tab -->
      <n-tab-pane name="config" :tab="t('admin.saml.config_tab')">
        <n-spin :show="configLoading">
          <n-form label-placement="left" label-width="180" :show-feedback="false" class="mt-16px">
            <n-form-item :label="t('admin.saml.enabled')">
              <n-switch v-model:value="configForm.enabled" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.idp_entity_id')">
              <n-input
                v-model:value="configForm.idpEntityId"
                :placeholder="t('admin.saml.idp_entity_id_placeholder')" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.idp_url')">
              <n-input v-model:value="configForm.idpUrl" :placeholder="t('admin.saml.idp_url_placeholder')" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.sp_url')">
              <n-input v-model:value="configForm.spUrl" :placeholder="t('admin.saml.sp_url_placeholder')" />
            </n-form-item>
          </n-form>
          <div class="config-actions mt-16px">
            <n-space>
              <n-button type="primary" :loading="configSaving" @click="handleSaveConfig">
                {{ t('common.save') }}
              </n-button>
            </n-space>
          </div>
        </n-spin>
      </n-tab-pane>

      <!-- Mappings Tab -->
      <n-tab-pane name="mappings" :tab="t('admin.saml.mappings_tab')">
        <n-spin :show="mappingsLoading">
          <n-data-table
            :columns="mappingColumns"
            :data="mappings"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
            size="small"
            class="mt-16px" />
        </n-spin>

        <!-- Edit Mapping Modal -->
        <n-modal v-model:show="showEditMappingDialog" :title="t('admin.saml.edit_mapping')" preset="dialog">
          <n-form label-placement="left" label-width="100">
            <n-form-item :label="t('admin.saml.col_user')">
              <n-input v-model:value="editMappingForm.userId" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.col_display_name')">
              <n-input v-model:value="editMappingForm.displayName" />
            </n-form-item>
          </n-form>
          <template #action>
            <n-flex justify="end" :size="12">
              <n-button @click="showEditMappingDialog = false">{{ t('common.cancel') }}</n-button>
              <n-button type="primary" :loading="editMappingSaving" @click="handleSaveMapping">
                {{ t('common.confirm') }}
              </n-button>
            </n-flex>
          </template>
        </n-modal>
      </n-tab-pane>

      <!-- IdP Metadata Tab -->
      <n-tab-pane name="idp" :tab="t('admin.saml.idp_metadata_tab')">
        <n-spin :show="loading">
          <div v-if="idpMetadata" class="mt-16px">
            <n-descriptions label-placement="left" bordered :column="1">
              <n-descriptions-item :label="t('admin.saml.idp_entity_id')">
                {{ idpMetadata.entity_id || idpMetadata.entityId || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.saml.idp_sso_url')">
                {{ idpMetadata.sso_url || idpMetadata.ssoUrl || '-' }}
              </n-descriptions-item>
            </n-descriptions>
            <div class="mt-16px">
              <n-card :title="t('admin.saml.raw_metadata')" size="small">
                <pre class="code-block">{{ JSON.stringify(idpMetadata, null, 2) }}</pre>
              </n-card>
            </div>
          </div>
        </n-spin>
      </n-tab-pane>

      <!-- SP Metadata Tab -->
      <n-tab-pane name="sp" :tab="t('admin.saml.sp_metadata_tab')">
        <n-spin :show="loading">
          <div v-if="spMetadata" class="mt-16px">
            <n-card size="small">
              <template #header-extra>
                <n-button type="primary" size="small" @click="downloadSpMetadata">
                  {{ t('admin.saml.download_sp_metadata') }}
                </n-button>
              </template>
              <pre class="code-block">{{ spMetadata }}</pre>
            </n-card>
          </div>
          <n-empty v-else :description="t('admin.saml.no_sp_metadata')" class="mt-40px" />
        </n-spin>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPageHeader,
  NPopconfirm,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs
} from 'naive-ui'
import { h, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type SamlMapping, useAdminSaml } from '@/composables/admin/useAdminSaml'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const {
  idpMetadata,
  spMetadata,
  samlConfig,
  mappings,
  loading,
  refreshing,
  configLoading,
  configSaving,
  mappingsLoading,
  loadMetadata,
  refreshMetadata,
  downloadSpMetadata,
  loadConfig,
  saveConfig,
  loadMappings,
  deleteMapping,
  updateMapping
} = useAdminSaml()

const activeTab = ref('config')

// Config form
const configForm = reactive({
  enabled: false,
  idpEntityId: '',
  idpUrl: '',
  spUrl: ''
})

function applyConfigToForm(config: Record<string, unknown>) {
  configForm.enabled = Boolean(config.enabled ?? config.saml_enabled ?? false)
  configForm.idpEntityId = String(config.idp_entity_id ?? config.idpEntityId ?? config.entity_id ?? '')
  configForm.idpUrl = String(config.idp_url ?? config.idpUrl ?? config.sso_url ?? '')
  configForm.spUrl = String(config.sp_url ?? config.spUrl ?? config.acs_url ?? '')
}

function buildConfigPayload(): Record<string, unknown> {
  return {
    enabled: configForm.enabled,
    idp_entity_id: configForm.idpEntityId,
    idp_url: configForm.idpUrl,
    sp_url: configForm.spUrl
  }
}

async function handleSaveConfig() {
  try {
    const payload = buildConfigPayload()
    await saveConfig(payload)
    showFeedback(t('admin.saml.save_success'), 'success')
  } catch {
    showFeedback(t('admin.saml.save_failed'), 'error')
  }
}

// Mapping edit
const showEditMappingDialog = ref(false)
const editMappingSaving = ref(false)
const editMappingForm = reactive({
  nameId: '',
  userId: '',
  displayName: ''
})

function handleEditMapping(row: SamlMapping) {
  editMappingForm.nameId = row.nameId
  editMappingForm.userId = row.userId ?? ''
  editMappingForm.displayName = row.displayName ?? ''
  showEditMappingDialog.value = true
}

async function handleSaveMapping() {
  editMappingSaving.value = true
  try {
    const updates: Record<string, unknown> = {}
    if (editMappingForm.userId) updates.user_id = editMappingForm.userId
    if (editMappingForm.displayName) updates.display_name = editMappingForm.displayName
    await updateMapping(editMappingForm.nameId, updates)
    showEditMappingDialog.value = false
    showFeedback(t('admin.saml.save_success'), 'success')
  } catch {
    showFeedback(t('admin.saml.save_failed'), 'error')
  } finally {
    editMappingSaving.value = false
  }
}

async function handleDeleteMapping(nameId: string) {
  try {
    await deleteMapping(nameId)
    showFeedback(t('admin.saml.mapping_deleted'), 'success')
  } catch {
    showFeedback(t('admin.saml.delete_failed'), 'error')
  }
}

// Mapping columns
const mappingColumns = [
  {
    title: 'NameID',
    key: 'nameId',
    ellipsis: true,
    width: 200
  },
  {
    title: t('admin.saml.col_user'),
    key: 'userId',
    width: 200,
    render: (row: SamlMapping) => row.userId ?? '-'
  },
  {
    title: t('admin.saml.col_display_name'),
    key: 'displayName',
    width: 150,
    render: (row: SamlMapping) => row.displayName ?? '-'
  },
  {
    title: t('admin.saml.col_actions'),
    key: 'actions',
    width: 140,
    render: (row: SamlMapping) =>
      h(NSpace, { size: 8 }, () => [
        h(NButton, { size: 'tiny', onClick: () => handleEditMapping(row) }, () => t('common.edit')),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteMapping(row.nameId) },
          {
            trigger: () => h(NButton, { size: 'tiny', type: 'error' }, () => t('common.delete')),
            default: () => t('admin.saml.delete_mapping_confirm')
          }
        )
      ])
  }
]

async function loadAll() {
  await Promise.allSettled([loadMetadata(), loadConfig(), loadMappings()])
}

async function handleRefreshMetadata() {
  try {
    await refreshMetadata()
    showFeedback(t('admin.saml.refresh_success'), 'success')
  } catch {
    showFeedback(t('admin.saml.refresh_failed'), 'error')
  }
}

onMounted(async () => {
  await loadAll()
  applyConfigToForm(samlConfig.value)
})
</script>

<style scoped>
.admin-saml {
  padding: 16px 24px;
}
.code-block {
  margin: 0;
  padding: 12px;
  background-color: var(--n-color-embedded);
  border-radius: 4px;
  overflow: auto;
  font-family: monospace;
  max-height: 500px;
}
.config-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
