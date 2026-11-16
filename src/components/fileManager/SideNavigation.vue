<template>
  <div
    class="w-200px flex-shrink-0 flex flex-col bg-[--tjg-surface-panel] border-r border-solid border-[--tjg-border-default]">
    <!-- 导航标题 -->
    <div class="navigation-header p-20px pb-16px">
      <h2 class="text-[length:var(--tjg-font-size-lg)] font-600 text-[--tjg-text-primary] m-0">
        {{ t('fileManager.navigation.title') }}
      </h2>
    </div>

    <!-- 导航菜单 -->
    <div class="navigation-menu flex-1 p-16px flex flex-col gap-6px">
      <div
        v-for="item in navigationItems"
        :key="item.key"
        :class="['navigation-item', { 'navigation-item--active': item.active }]"
        @click="handleNavigationClick(item.key)">
        <div class="navigation-item__icon">
          <svg class="size-16px" aria-hidden="true">
            <use :href="`#${item.icon}`"></use>
          </svg>
        </div>
        <span class="text-[length:var(--tjg-font-size-base)]">{{ getNavigationLabel(item) }}</span>
      </div>
    </div>
    <!-- 媒体存储用量：服务端提供配额时才展示 -->
    <div
      v-if="quota && quota.limitBytes > 0"
      class="storage-usage flex-shrink-0 p-16px border-t border-solid border-[--tjg-border-default]">
      <div class="flex items-center justify-between gap-8px text-[length:var(--tjg-font-size-xs)]">
        <span class="text-[--tjg-text-secondary]">{{ t('fileManager.storage.label') }}</span>
        <span class="text-[--tjg-text-primary]">
          {{ formatBytes(quota.storageBytes) }} / {{ formatBytes(quota.limitBytes) }}
        </span>
      </div>
      <div class="storage-usage__track mt-8px">
        <div class="storage-usage__bar" :style="{ width: quotaPercent }"></div>
      </div>
      <div class="mt-6px flex items-center justify-between gap-8px text-[length:var(--tjg-font-size-xs)]">
        <span class="text-[--tjg-text-secondary]">{{ t('fileManager.storage.count') }}</span>
        <span class="text-[--tjg-text-primary]">{{ quota.mediaCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { formatBytes } from '@/utils/Formatting'

type NavigationItem = {
  key: string
  label: string
  icon: string
  active: boolean
}

type FileManagerState = {
  navigationItems: Ref<NavigationItem[]>
  setActiveNavigation: (key: string) => void
}

const { t } = useI18n()
const fileManagerState = inject<FileManagerState>('fileManagerState')!

const { navigationItems, setActiveNavigation } = fileManagerState

const handleNavigationClick = (key: string) => {
  setActiveNavigation(key)
}

// 媒体存储配额（服务端不支持时返回 null，界面自动隐藏）
const quota = ref<{ storageBytes: number; mediaCount: number; limitBytes: number } | null>(null)
const quotaPercent = computed(() => {
  if (!quota.value || quota.value.limitBytes <= 0) return '0%'
  const used = Math.min(quota.value.storageBytes / quota.value.limitBytes, 1)
  return `${Math.round(used * 100)}%`
})

onMounted(async () => {
  quota.value = await matrixMediaService.getQuotaStats()
})

const navigationKeyMap: Record<string, string> = {
  myFiles: 'fileManager.navigation.items.myFiles',
  senders: 'fileManager.navigation.items.senders',
  sessions: 'fileManager.navigation.items.sessions',
  groups: 'fileManager.navigation.items.groups'
}

const getNavigationLabel = (item: NavigationItem) => {
  const key = navigationKeyMap[item.key]
  if (key) {
    return t(key)
  }
  return item.label ?? t('fileManager.navigation.items.default')
}
</script>

<style scoped lang="scss">
.navigation-header {
  border-bottom: 1px solid var(--tjg-border-default);
}

.navigation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    color var(--tjg-motion-duration-normal) ease,
    background-color var(--tjg-motion-duration-normal) ease,
    border-color var(--tjg-motion-duration-normal) ease,
    box-shadow var(--tjg-motion-duration-normal) ease,
    opacity var(--tjg-motion-duration-normal) ease,
    transform var(--tjg-motion-duration-normal) ease;
  color: var(--tjg-text-primary);
  user-select: none;

  &:hover:not(&--active) {
    background-color: var(--tjg-color-primary-400);
    color: var(--tjg-color-primary-500);

    .navigation-item__icon svg {
      color: var(--tjg-color-primary-500);
    }
  }

  &--active {
    background-color: var(--tjg-color-primary-200);
    color: var(--tjg-color-primary-500);

    .navigation-item__icon svg {
      color: var(--tjg-color-primary-500);
    }
  }
}

.navigation-item__icon {
  margin-right: 12px;
  display: flex;
  align-items: center;

  svg {
    color: inherit;
    transition: color var(--tjg-motion-duration-normal) ease;
  }
}

.storage-usage__track {
  height: 4px;
  border-radius: var(--tjg-radius-full);
  background-color: var(--tjg-surface-sunken);
  overflow: hidden;
}

.storage-usage__bar {
  height: 100%;
  border-radius: inherit;
  background-color: var(--tjg-color-primary-500);
  transition: width var(--tjg-motion-duration-normal) ease;
}
</style>
