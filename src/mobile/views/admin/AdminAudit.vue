<template>
  <mobile-layout :title="t('admin.audit')" show-back>
    <div class="mobile-admin-audit">
      <van-search v-model="userFilter" :placeholder="t('admin.filter_user_id')" @search="onRefresh" />

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-list :finished="true" :finished-text="t('common.no_more')">
          <van-cell
            v-for="log in admin.logs.value"
            :key="log.id"
            :title="log.type"
            :label="`${log.user_id} · ${new Date(log.timestamp).toLocaleString()}`"
            is-link
            @click="openDetail(log.id)" />
        </van-list>
      </van-pull-refresh>

      <van-popup v-model:show="showDetail" position="bottom" :style="{ height: '70%' }">
        <div v-if="admin.selected.value" class="audit-detail">
          <h3>{{ admin.selected.value.type }}</h3>
          <van-divider />
          <van-cell-group>
            <van-cell :title="t('admin.audit_id')" :value="admin.selected.value.id" />
            <van-cell :title="t('admin.user_id')" :value="admin.selected.value.user_id" />
            <van-cell :title="t('admin.target')" :value="admin.selected.value.target || '-'" />
            <van-cell
              :title="t('admin.timestamp')"
              :value="new Date(admin.selected.value.timestamp).toLocaleString()" />
          </van-cell-group>
          <van-divider>{{ t('admin.details') }}</van-divider>
          <pre class="details-pre">{{ JSON.stringify(admin.selected.value.details ?? {}, null, 2) }}</pre>
        </div>
      </van-popup>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminAudit } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminAudit')
const { t } = useI18n()

const admin = useAdminAudit()
const refreshing = ref(false)
const showDetail = ref(false)
const userFilter = ref('')

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadLogs({ userId: userFilter.value.trim() || undefined, limit: 100 })
  } catch (error) {
    logger.error('[MobileAdminAudit] 加载失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const openDetail = async (id: string) => {
  showDetail.value = true
  try {
    await admin.loadDetail(id)
  } catch (error) {
    logger.error('[MobileAdminAudit] 加载详情失败:', error)
    showToast(t('admin.load_failed'))
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-audit {
  .van-search {
    padding: 12px 16px;
  }
}
.audit-detail {
  padding: 16px;
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
  .details-pre {
    background: var(--van-background-2);
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    overflow-x: auto;
    word-break: break-all;
    white-space: pre-wrap;
  }
}
</style>
