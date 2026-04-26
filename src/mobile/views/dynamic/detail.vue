<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" room-name="动态详情" />
    </template>

    <template #container>
      <div class="flex h-full flex-col overflow-auto bg-#f7f8fa">
        <div class="flex flex-col gap-12px p-16px">
          <div class="rounded-16px bg-white p-16px">
            <van-tag :type="getTagType(selectedItem.status)">{{ getStatusText(selectedItem.status) }}</van-tag>
            <div class="mt-12px text-18px font-600 text-[--text-color]">{{ selectedItem.title }}</div>
            <div class="mt-8px text-13px leading-22px text-gray-500">{{ selectedItem.description }}</div>
          </div>

          <div class="rounded-16px bg-white p-16px text-13px leading-22px text-gray-500">
            当前详情页已接入移动端页面壳，后续直接在这里复用共享详情状态、评论状态与返回路径管理。
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDynamic, type DynamicRoadmapStatus } from '@/composables/useDynamic'
import { completeRenderSampleOnNextFrame, startRenderSample } from '@/utils/AppHarness'

const route = useRoute()
const detailId = computed(() => String(route.params.id || route.query.id || 'detail'))
const { selectedItem, getStatusText } = useDynamic(detailId)

startRenderSample('mobile-dynamic-detail', {
  route: `/mobile/dynamic/${detailId.value}`,
  meta: {
    source: 'page-entry'
  }
})

onMounted(() => {
  completeRenderSampleOnNextFrame('mobile-dynamic-detail', {
    route: `/mobile/dynamic/${detailId.value}`
  })
})

const getTagType = (status: DynamicRoadmapStatus) => {
  if (status === 'in-progress') return 'primary'
  if (status === 'blocked') return 'warning'
  return 'default'
}
</script>
