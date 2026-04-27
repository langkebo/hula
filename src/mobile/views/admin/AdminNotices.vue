<template>
  <mobile-layout :title="t('admin.notices')" show-back>
    <div class="mobile-admin-notices">
      <div class="send-section">
        <van-cell-group inset :title="t('admin.send_notice')">
          <van-field v-model="targetUserId" :label="t('admin.user_id')" :placeholder="'@user:server'" />
          <van-field
            v-model="noticeBody"
            :label="t('admin.message')"
            type="textarea"
            rows="3"
            autosize
            :placeholder="t('admin.message_placeholder')" />
          <div class="send-btn">
            <van-button type="primary" block :loading="admin.sending.value" @click="handleSend">
              {{ t('admin.send') }}
            </van-button>
          </div>
        </van-cell-group>
      </div>

      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <van-cell-group :title="t('admin.sent_notices')">
          <van-cell
            v-for="(notice, idx) in admin.notices.value"
            :key="idx"
            :title="notice.userId"
            :label="notice.sentTs ? new Date(notice.sentTs).toLocaleString() : '-'" />
        </van-cell-group>
      </van-pull-refresh>
    </div>
  </mobile-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import MobileLayout from '@/mobile/layout/index.vue'
import { useAdminNotices } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileAdminNotices')
const { t } = useI18n()

const admin = useAdminNotices()
const refreshing = ref(false)
const targetUserId = ref('')
const noticeBody = ref('')

const onRefresh = async () => {
  refreshing.value = true
  try {
    await admin.loadNotices()
  } catch (error) {
    logger.error('[MobileAdminNotices] 加载失败:', error)
    showToast(t('admin.load_failed'))
  } finally {
    refreshing.value = false
  }
}

const handleSend = async () => {
  if (!targetUserId.value.trim() || !noticeBody.value.trim()) {
    showToast(t('admin.fill_required'))
    return
  }
  try {
    await admin.sendNotice(targetUserId.value.trim(), noticeBody.value.trim())
    showToast(t('admin.operation_success'))
    targetUserId.value = ''
    noticeBody.value = ''
    await onRefresh()
  } catch (error) {
    logger.error('[MobileAdminNotices] 发送失败:', error)
    showToast(t('admin.load_failed'))
  }
}

onRefresh()
</script>

<style scoped lang="scss">
.mobile-admin-notices {
  .send-section {
    padding: 12px 0;
  }
  .send-btn {
    padding: 12px 16px;
  }
}
</style>
