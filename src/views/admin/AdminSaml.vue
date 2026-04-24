<template>
  <div class="admin-saml">
    <n-page-header :title="t('admin.saml.title')" :subtitle="t('admin.saml.subtitle')">
      <template #extra>
        <n-button @click="loadData" :loading="loading">
          {{ t('common.refresh') }}
        </n-button>
      </template>
    </n-page-header>

    <n-alert type="warning" title="功能尚未就绪 / Feature not available" class="my-12px">
      后端仅实现了 SAML 元数据刷新；其余 SAML 管理端点尚未实现。Backend only implements SAML metadata refresh; other SAML management endpoints are not available yet.
    </n-alert>

    <n-tabs type="line" animated>
      <n-tab-pane name="config" :tab="t('admin.saml.config_tab')">
        <n-spin :show="loading">
          <n-form v-if="samlConfig" :model="samlConfig" label-placement="left" label-width="180px" class="mt-16px">
            <n-form-item :label="t('admin.saml.idp_url')">
              <n-input v-model:value="samlConfig.idp_url" :placeholder="t('admin.saml.idp_url_placeholder')" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.idp_entity_id')">
              <n-input v-model:value="samlConfig.idp_entity_id" :placeholder="t('admin.saml.idp_entity_id_placeholder')" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.sp_url')">
              <n-input v-model:value="samlConfig.sp_url" :placeholder="t('admin.saml.sp_url_placeholder')" />
            </n-form-item>
            <n-form-item :label="t('admin.saml.enabled')">
              <n-switch v-model:value="samlConfig.enabled" />
            </n-form-item>
            <n-form-item>
              <n-button type="primary" @click="saveConfig" :loading="saveLoading">
                {{ t('common.save') }}
              </n-button>
            </n-form-item>
          </n-form>
        </n-spin>
      </n-tab-pane>

      <n-tab-pane name="mappings" :tab="t('admin.saml.mappings_tab')">
        <n-data-table
          :columns="mappingColumns"
          :data="mappings"
          :loading="loading"
          :pagination="pagination"
          :row-key="(row: SamlMapping) => row.nameId"
          striped
          class="mt-16px"
        />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NPageHeader,
  NTabs,
  NTabPane,
  NDataTable,
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  NSpin,
  NSpace,
  NAlert,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { adminService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSaml')
const { t } = useI18n()
const message = useMessage()

interface SamlMapping {
  nameId: string
  userId?: string
  displayName?: string
}

interface SamlConfig {
  idp_url: string
  idp_entity_id: string
  sp_url: string
  enabled: boolean
  [key: string]: unknown
}

const loading = ref(false)
const saveLoading = ref(false)
const samlConfig = ref<SamlConfig | null>(null)
const mappings = ref<SamlMapping[]>([])

const pagination = { pageSize: 20 }

const mappingColumns: DataTableColumns<SamlMapping> = [
  { title: 'Name ID', key: 'nameId', width: 240, ellipsis: { tooltip: true } },
  { title: t('admin.saml.col_user'), key: 'userId', width: 240, ellipsis: { tooltip: true } },
  { title: t('admin.saml.col_display_name'), key: 'displayName', width: 200 },
  {
    title: t('admin.saml.col_actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'tiny', type: 'error', onClick: () => deleteMapping(row.nameId) }, () => t('common.delete'))
      ])
  }
]

async function loadData() {
  loading.value = true
  try {
    const [samlData, mappingsResult] = await Promise.all([adminService.getSamlConfig(), adminService.getSamlMappings()])
    samlConfig.value = {
      idp_url: (samlData?.idp_url as string) || '',
      idp_entity_id: (samlData?.idp_entity_id as string) || '',
      sp_url: (samlData?.sp_url as string) || '',
      enabled: (samlData?.enabled as boolean) || false,
      ...samlData
    }
    mappings.value = (mappingsResult?.mappings ?? []).map((m: Record<string, unknown>) => ({
      nameId: (m.name_id as string) || (m.nameId as string) || '',
      userId: (m.user_id as string) || '',
      displayName: (m.display_name as string) || ''
    }))
  } catch (err) {
    logger.error('加载 SAML 配置失败:', err)
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!samlConfig.value) return
  saveLoading.value = true
  try {
    await adminService.updateSamlConfig(samlConfig.value)
    message.success(t('admin.saml.save_success'))
  } catch (err) {
    logger.error('保存 SAML 配置失败:', err)
    message.error(t('admin.saml.save_failed'))
  } finally {
    saveLoading.value = false
  }
}

async function deleteMapping(nameId: string) {
  try {
    await adminService.deleteSamlMapping(nameId)
    message.success(t('admin.saml.mapping_deleted'))
    await loadData()
  } catch (err) {
    logger.error('删除 SAML 映射失败:', err)
    message.error(t('admin.saml.delete_failed'))
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.admin-saml {
  padding: 16px 24px;
}
</style>
