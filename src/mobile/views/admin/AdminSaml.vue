<template>
  <mobile-layout :title="t('admin.saml.title')" show-back>
    <div class="mobile-admin-saml">
      <van-notice-bar :scrollable="false" mode="closeable" color="#9a5a00" background="#fff8e6">
        {{ t('admin.feature_not_ready') }}
      </van-notice-bar>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group inset :title="t('admin.saml.config_tab')">
          <van-field
            v-model="form.idp_url"
            :label="t('admin.saml.idp_url')"
            :placeholder="t('admin.saml.idp_url_placeholder')" />
          <van-field
            v-model="form.idp_entity_id"
            :label="t('admin.saml.idp_entity_id')"
            :placeholder="t('admin.saml.idp_entity_id_placeholder')" />
          <van-field
            v-model="form.sp_url"
            :label="t('admin.saml.sp_url')"
            :placeholder="t('admin.saml.sp_url_placeholder')" />
          <van-cell :title="t('admin.saml.enabled')">
            <template #right-icon>
              <van-switch v-model="form.enabled" size="20" />
            </template>
          </van-cell>
          <div class="action">
            <van-button type="primary" block :loading="admin.saving.value" @click="onSave">
              {{ t('common.save') }}
            </van-button>
          </div>
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminSaml } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminSaml')
const { t } = useI18n()

const admin = useAdminSaml()
const refreshing = ref(false)
const form = reactive({
  idp_url: '',
  idp_entity_id: '',
  sp_url: '',
  enabled: false
})

watch(
  () => admin.config.value,
  (cfg) => {
    if (!cfg) return
    form.idp_url = (cfg.idp_url as string) || ''
    form.idp_entity_id = (cfg.idp_entity_id as string) || ''
    form.sp_url = (cfg.sp_url as string) || ''
    form.enabled = Boolean(cfg.enabled)
  },
  { immediate: true, deep: true }
)

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadConfig()
  } catch (error) {
    logger.error('[MobileAdminSaml] load failed', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const onSave = async () => {
  try {
    await admin.updateConfig({ ...form })
    showToast(t('admin.operation_success'))
  } catch (error) {
    logger.error('[MobileAdminSaml] save failed', error)
    showToast(t('admin.saml.save_failed'))
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
