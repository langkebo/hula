<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" room-name="动态" />
    </template>

    <template #container>
      <div class="flex h-full flex-col overflow-auto bg-#f7f8fa">
        <div class="flex flex-col gap-12px p-16px">
          <div class="rounded-16px bg-white p-16px">
            <div class="text-18px font-600 text-[--hula-text-primary]">动态共享骨架</div>
            <div class="mt-8px text-13px leading-20px text-gray-500">{{ summary }}</div>
            <div class="mt-12px">
              <van-tag type="primary">{{ hasMobileEntry ? '移动端入口已接入' : '移动端入口未接入' }}</van-tag>
            </div>
          </div>

          <div
            v-for="item in roadmap"
            :key="item.id"
            :data-testid="`dynamic-card-${item.id}`"
            class="rounded-16px bg-white p-14px"
            @click="openDetail(item.id)">
            <div class="flex items-start justify-between gap-12px">
              <div class="min-w-0 flex-1">
                <div class="text-15px font-600 text-[--hula-text-primary]">{{ item.title }}</div>
                <div class="mt-6px text-13px leading-20px text-gray-500">{{ item.description }}</div>
              </div>
              <van-tag :type="getTagType(item.status)">{{ getStatusText(item.status) }}</van-tag>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import router from '@/router'
import { useDynamic, type DynamicRoadmapStatus } from '@/composables/useDynamic'
import { completeRenderSampleOnNextFrame, startRenderSample } from '@/utils/AppHarness'

const { roadmap, summary, hasMobileEntry, getStatusText } = useDynamic()

startRenderSample('mobile-dynamic-index', {
  route: '/mobile/dynamic',
  meta: {
    source: 'page-entry'
  }
})

onMounted(() => {
  completeRenderSampleOnNextFrame('mobile-dynamic-index', {
    route: '/mobile/dynamic'
  })
})

const getTagType = (status: DynamicRoadmapStatus) => {
  if (status === 'in-progress') return 'primary'
  if (status === 'blocked') return 'warning'
  return 'default'
}

const openDetail = (id: string) => {
  startRenderSample('mobile-dynamic-detail', {
    route: `/mobile/dynamic/${id}`,
    meta: {
      source: 'dynamic-card'
    }
  })
  router.push(`/mobile/dynamic/${id}`)
}
</script>
