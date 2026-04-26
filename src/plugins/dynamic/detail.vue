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
import { completeRenderSampleOnNextFrame } from '@/utils/AppHarness'

defineOptions({
  name: 'DynamicDetailPage'
})

const route = useRoute()
const detailId = computed(() => String(route.params.id || route.query.id || 'detail'))
const { selectedItem, getStatusText } = useDynamic(detailId)

onMounted(() => {
  completeRenderSampleOnNextFrame('desktop-dynamic-detail', {
    route: `/plugins/dynamic/${detailId.value}`
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
  background: var(--n-body-color, #f7f8fa);
}

.dynamic-detail-shell {
  width: min(720px, 100%);
  padding: 32px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(15 23 42 / 8%);
}

.dynamic-detail-tag {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 13px;
}

.dynamic-detail-shell h1 {
  margin: 16px 0 12px;
  font-size: 28px;
}

.dynamic-detail-shell p {
  margin: 0;
  color: #52606d;
  line-height: 1.6;
}

.dynamic-detail-note {
  margin-top: 20px;
  padding: 16px;
  border-radius: 16px;
  background: #f8fafc;
  color: #334155;
  line-height: 1.6;
}
</style>
