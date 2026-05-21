<template>
  <div class="dynamic-detail-page">
    <div class="dynamic-detail-shell">
      <span class="dynamic-detail-tag">{{ getStatusText(selectedItem.status) }}</span>
      <h1>{{ selectedItem.title }}</h1>
      <p>{{ selectedItem.description }}</p>
      <div class="dynamic-detail-note">
        当前详情页已接入共享骨架，后续将直接在这里承接动态详情状态、评论状态与返回路径管理。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDynamic } from '@/composables/useDynamic'
import { completeRenderSampleOnNextFrame, startRenderSample } from '@/utils/AppHarness'

defineOptions({
  name: 'DynamicDetailPage'
})

const route = useRoute()
const detailId = computed(() => String(route.params.id || route.query.id || 'detail'))
const { selectedItem, getStatusText } = useDynamic(detailId)

startRenderSample('desktop-dynamic-detail', {
  route: `/dynamic/${detailId.value}`,
  meta: {
    source: 'page-entry'
  }
})

onMounted(() => {
  completeRenderSampleOnNextFrame('desktop-dynamic-detail', {
    route: `/dynamic/${detailId.value}`
  })
})
</script>

<style scoped>
.dynamic-detail-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  padding: 24px;
  background: var(--hula-surface-app);
}

.dynamic-detail-shell {
  width: min(720px, 100%);
  padding: 32px;
  border-radius: 20px;
  background: var(--hula-surface-panel);
  box-shadow: var(--hula-shadow-lg);
}

.dynamic-detail-tag {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--hula-color-info-100);
  color: var(--hula-color-info-500);
  font-size: 13px;
}

.dynamic-detail-shell h1 {
  margin: 16px 0 12px;
  font-size: 28px;
}

.dynamic-detail-shell p {
  margin: 0;
  color: var(--hula-text-secondary);
  line-height: 1.6;
}

.dynamic-detail-note {
  margin-top: 20px;
  padding: 16px;
  border-radius: 16px;
  background: var(--hula-surface-panel-muted);
  color: var(--hula-text-secondary);
  line-height: 1.6;
}
</style>
