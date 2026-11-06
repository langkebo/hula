<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('dynamic.title')" />
    </template>

    <template #container>
      <div class="flex h-full flex-col overflow-auto bg-[--tjg-surface-panel-muted]">
        <div class="flex flex-col gap-12px p-16px">
          <div class="rounded-16px bg-[--tjg-glass-row-bg] p-16px">
            <van-tag :type="getTagType(selectedItem.status)">{{ getStatusText(selectedItem.status) }}</van-tag>
            <div class="mt-12px text-18px font-600 text-[--tjg-text-primary]">{{ selectedItem.title }}</div>
            <div class="mt-8px text-13px leading-22px text-[--tjg-text-secondary]">{{ selectedItem.description }}</div>
          </div>

          <div class="rounded-16px bg-[--tjg-glass-row-bg] p-16px text-13px leading-22px text-[--tjg-text-secondary]">
            {{ t('dynamic.detail_placeholder') }}
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useDynamicDetail } from '@/composables/useDynamicDetail'

const { t } = useI18n()

// 详情 id 解析、状态读取、标签配色与渲染采样统一走共享 composable，移动端只保留 Vant 呈现
const { selectedItem, getStatusText, getTagType } = useDynamicDetail({
  sampleName: 'mobile-dynamic-detail',
  routePrefix: '/mobile/dynamic'
})
</script>
