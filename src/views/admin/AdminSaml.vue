<template>
  <div class="admin-saml">
    <n-page-header :title="t('admin.saml.title')" :subtitle="t('admin.saml.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="loadMetadata" :loading="loading">
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

    <n-tabs type="line" animated>
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
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NPageHeader,
  NSpace,
  NSpin,
  NTabPane,
  NTabs
} from 'naive-ui'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminSaml } from '@/composables/admin/useAdminSaml'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { idpMetadata, spMetadata, loading, refreshing, loadMetadata, refreshMetadata, downloadSpMetadata } =
  useAdminSaml()

async function handleRefreshMetadata() {
  try {
    await refreshMetadata()
    showFeedback(t('admin.saml.refresh_success'), 'success')
  } catch (err) {
    showFeedback(t('admin.saml.refresh_failed'), 'error')
  }
}

onMounted(() => loadMetadata())
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
</style>
