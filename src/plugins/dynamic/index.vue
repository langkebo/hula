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
import { completeRenderSampleOnNextFrame } from '@/utils/AppHarness'

defineOptions({
  name: 'DynamicPage'
})

onMounted(() => {
  completeRenderSampleOnNextFrame('desktop-dynamic-index', {
    route: '/plugins/dynamic'
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
  background: var(--n-body-color, #f7f8fa);
}

.dynamic-shell {
  width: min(840px, 100%);
  padding: 32px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(15 23 42 / 8%);
}

.dynamic-shell h1 {
  margin: 0 0 12px;
  font-size: 28px;
}

.dynamic-shell p {
  margin: 0;
  color: #52606d;
  line-height: 1.6;
}

.dynamic-meta {
  margin-top: 16px;
  color: #1d4ed8;
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
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #f8fafc;
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
  color: #475569;
  font-size: 13px;
}
</style>
