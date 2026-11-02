<template>
  <div v-show="active" class="flex-1 min-h-0 flex flex-col">
    <!-- 头部空间配额统计 -->
    <n-flex
      align="center"
      justify="space-between"
      class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
      <span class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
        {{ t('home.chat_sidebar.quota.title') }}
      </span>
      <span class="text-[var(--text-xs)] color-[--tjg-color-primary-500]">
        {{ '1.2 GB / 5.0 GB' }}
      </span>
    </n-flex>
    <!-- 进度条占位 -->
    <div class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
      <n-progress
        type="line"
        :percentage="24"
        :height="4"
        :show-indicator="false"
        color="var(--tjg-color-primary-500)" />
    </div>

    <div class="flex-1 flex items-center justify-center">
      <n-empty :description="t('home.chat_sidebar.empty.files')">
        <template #icon>
          <svg class="size-48px opacity-50 color-[--tjg-text-quaternary]">
            <use href="#folder"></use>
          </svg>
        </template>
      </n-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ active: boolean }>()

const { t } = useI18n()
</script>
