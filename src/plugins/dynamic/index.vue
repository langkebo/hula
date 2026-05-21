<template>
  <div class="dynamic-page">
    <div class="dynamic-shell">
      <h1>动态共享骨架已接入</h1>
      <p>{{ summary }}</p>
      <div class="dynamic-meta">
        <span>{{ hasMobileEntry ? '移动端入口已就绪' : '移动端入口待接入' }}</span>
      </div>
      <div class="dynamic-grid">
        <div v-for="item in roadmap" :key="item.id" class="dynamic-card">
          <div class="dynamic-card__header">
            <h2>{{ item.title }}</h2>
            <span>{{ getStatusText(item.status) }}</span>
          </div>
          <p>{{ item.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useDynamic } from '@/composables/useDynamic'
import { completeRenderSampleOnNextFrame, startRenderSample } from '@/utils/AppHarness'

defineOptions({
  name: 'DynamicPage'
})

startRenderSample('desktop-dynamic-index', {
  route: '/dynamic',
  meta: {
    source: 'page-entry'
  }
})

onMounted(() => {
  completeRenderSampleOnNextFrame('desktop-dynamic-index', {
    route: '/dynamic'
  })
})

const { roadmap, summary, hasMobileEntry, getStatusText } = useDynamic()
</script>

<style scoped>
.dynamic-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  padding: 24px;
  background: var(--hula-surface-app);
}

.dynamic-shell {
  width: min(840px, 100%);
  padding: 32px;
  border-radius: 20px;
  background: var(--hula-surface-panel);
  box-shadow: var(--hula-shadow-lg);
}

.dynamic-shell h1 {
  margin: 0 0 12px;
  font-size: 28px;
}

.dynamic-shell p {
  margin: 0;
  color: var(--hula-text-secondary);
  line-height: 1.6;
}

.dynamic-meta {
  margin-top: 16px;
  color: var(--hula-color-info-500);
  font-size: 14px;
}

.dynamic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.dynamic-card {
  padding: 16px;
  border: 1px solid var(--hula-border-default);
  border-radius: 16px;
  background: var(--hula-surface-panel-muted);
}

.dynamic-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.dynamic-card__header h2 {
  margin: 0;
  font-size: 16px;
}

.dynamic-card__header span {
  color: var(--hula-text-secondary);
  font-size: 13px;
}
</style>
