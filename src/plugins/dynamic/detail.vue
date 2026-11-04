<template>
  <div class="dynamic-detail-page">
    <div class="dynamic-detail-shell">
      <span class="dynamic-detail-tag">{{ getStatusText(selectedItem.status) }}</span>
      <h1>{{ selectedItem.title }}</h1>
      <p>{{ selectedItem.description }}</p>
      <div class="dynamic-detail-note">
        {{ t('dynamic.skeleton.detail') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDynamicDetail } from '@/composables/useDynamicDetail'

const { t } = useI18n()

defineOptions({
  name: 'DynamicDetailPage'
})

// 详情 id 解析、状态读取与渲染采样统一走共享 composable，桌面只保留页面结构
const { selectedItem, getStatusText } = useDynamicDetail({
  sampleName: 'desktop-dynamic-detail',
  routePrefix: '/dynamic'
})
</script>

<style scoped>
.dynamic-detail-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  padding: 24px;
  background: var(--tjg-surface-app);
}

.dynamic-detail-shell {
  width: min(720px, 100%);
  padding: 32px;
  border-radius: var(--tjg-radius-panel);
  background: var(--tjg-surface-panel);
  box-shadow: var(--tjg-shadow-lg);
}

.dynamic-detail-tag {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--tjg-color-info-100);
  color: var(--tjg-color-info-500);
  font-size: 13px;
}

.dynamic-detail-shell h1 {
  margin: 16px 0 12px;
  font-size: 28px;
}

.dynamic-detail-shell p {
  margin: 0;
  color: var(--tjg-text-secondary);
  line-height: 1.6;
}

.dynamic-detail-note {
  margin-top: 20px;
  padding: 16px;
  border-radius: var(--tjg-radius-surface);
  background: var(--tjg-surface-panel-muted);
  color: var(--tjg-text-secondary);
  line-height: 1.6;
}
</style>
