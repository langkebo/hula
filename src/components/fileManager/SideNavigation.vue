<template>
  <div
    class="w-200px flex-shrink-0 flex flex-col bg-[--hula-surface-panel] border-r border-solid border-[--hula-border-default]">
    <!-- 导航标题 -->
    <div class="navigation-header p-20px pb-16px">
      <h2 class="text-16px font-600 text-[--hula-text-primary] m-0">
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
          <svg class="size-16px">
            <use :href="`#${item.icon}`"></use>
          </svg>
        </div>
        <span class="text-14px">{{ getNavigationLabel(item) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

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
  border-bottom: 1px solid var(--hula-border-default);
}

.navigation-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--hula-text-primary);
  user-select: none;

  &:hover:not(&--active) {
    background-color: var(--color-primary-light);
    color: var(--hula-color-primary-500);

    .navigation-item__icon svg {
      color: var(--hula-color-primary-500);
    }
  }

  &--active {
    background-color: var(--color-primary-hover);
    color: var(--hula-color-primary-500);

    .navigation-item__icon svg {
      color: var(--hula-color-primary-500);
    }
  }
}

.navigation-item__icon {
  margin-right: 12px;
  display: flex;
  align-items: center;

  svg {
    color: inherit;
    transition: color 0.2s ease;
  }
}
</style>
