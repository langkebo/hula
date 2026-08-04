<template>
  <mobile-layout :title="t('admin.saml.title')" show-back>
    <div class="mobile-admin-saml">
      <van-notice-bar
        :scrollable="false"
        mode="closeable"
        color="var(--tjg-admin-notice-text)"
        background="var(--tjg-admin-notice-bg)">
        {{ t('admin.saml.metadata_info') }}
      </van-notice-bar>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group inset :title="t('admin.saml.idp_metadata_tab')">
          <van-cell :title="t('admin.saml.idp_entity_id')" :value="idpEntityId" />
          <van-cell :title="t('admin.saml.idp_sso_url')" :value="idpSsoUrl" />
          <div class="action">
            <van-button type="primary" block :loading="admin.refreshing.value" @click="onRefreshIdp">
              {{ t('admin.saml.refresh_idp') }}
            </van-button>
          </div>
        </van-cell-group>

        <van-cell-group inset :title="t('admin.saml.sp_metadata_tab')">
          <van-cell :title="t('admin.saml.download_sp_metadata')" is-link @click="admin.downloadSpMetadata()" />
          <van-cell :label="admin.spMetadata.value || t('admin.saml.no_sp_metadata')" />
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminSaml } from '@/composables/admin'
import MobileLayout from '@/mobile/layout/index.vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminSaml')
const { t } = useI18n()

const admin = useAdminSaml()
const refreshing = ref(false)

const idpEntityId = computed(() => {
  const metadata = admin.idpMetadata.value
  return (metadata.entity_id as string) || (metadata.entityId as string) || '-'
})

const idpSsoUrl = computed(() => {
  const metadata = admin.idpMetadata.value
  return (metadata.sso_url as string) || (metadata.ssoUrl as string) || '-'
})

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadMetadata()
  } catch (error) {
    logger.error('[MobileAdminSaml] load failed', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const onRefreshIdp = async () => {
  try {
    await admin.refreshMetadata()
    showToast(t('admin.saml.refresh_success'))
  } catch (error) {
    logger.error('[MobileAdminSaml] refresh failed', error)
    showToast(t('admin.saml.refresh_failed'))
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-saml {
  .action {
    padding: 12px 16px;
  }
}
</style>
