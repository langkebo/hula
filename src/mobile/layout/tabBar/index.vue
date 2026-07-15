<template>
  <div class="tab-bar-wrap">
    <div class="h-1px bg-[--hula-border-layout-divider]"></div>
    <div class="tab-bar flex justify-around items-end pt-3">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :data-testid="item.testId"
        class="tab-item flex flex-col flex-1 items-center no-underline relative"
        :class="route.path === item.path ? 'color-[--hula-color-primary-500]' : 'text-[--hula-text-tertiary]'"
        @click="handleNavigate(item.path)">
        <van-badge
          class="flex flex-col w-55% flex-1 relative items-center"
          :offset="[-6, 6]"
          color="var(--hula-color-danger-500)"
          :content="getUnReadCount(item.label) || ''"
          :max="99">
          <svg class="w-22px h-22px">
            <use :href="`#${route.path === item.path ? item.actionIcon : item.icon}`"></use>
          </svg>
          <span class="text-xs mt-1">{{ item.label }}</span>
        </van-badge>
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { startRenderSample } from '@/utils/AppHarness'

type NavItem = {
  label: string
  path: string
  icon: string
  actionIcon: string
  testId: string
}

const { t } = useI18n()
const route = useRoute()
const globalStore = useGlobalStore()

const getUnReadCount = (label: string) => {
  if (label === t('mobile_tabbar.items.messages')) {
    return globalStore.messageUnreadCount
  }
  if (label === t('mobile_tabbar.items.contacts')) {
    return globalStore.contactUnreadCount
  }
  return 0
}

const handleNavigate = (path: string) => {
  if (path === '/mobile/dynamic') {
    startRenderSample('mobile-dynamic-index', {
      route: path,
      meta: {
        source: 'tab-bar'
      }
    })
  }
}

const navItems: NavItem[] = [
  {
    label: t('mobile_tabbar.items.messages'),
    path: '/mobile/message',
    icon: 'message',
    actionIcon: 'message-action',
    testId: 'mobile-tab-message'
  },
  {
    label: t('mobile_tabbar.items.contacts'),
    path: '/mobile/friends',
    icon: 'avatar',
    actionIcon: 'avatar-action',
    testId: 'mobile-tab-friends'
  },
  {
    label: t('mobile_tabbar.items.community'),
    path: '/mobile/dynamic',
    icon: 'robot',
    actionIcon: 'robot',
    testId: 'mobile-tab-dynamic'
  },
  {
    label: t('mobile_tabbar.items.me'),
    path: '/mobile/my',
    icon: 'wode',
    actionIcon: 'wode-action',
    testId: 'mobile-tab-my'
  }
]
</script>

<style scoped lang="scss">
.tab-bar-wrap {
  background: var(--center-bg-color);
}

.tab-bar {
  height: 52px;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.tab-item {
  gap: 2px;
  font-size: 10px;
  padding-bottom: var(--safe-area-inset-bottom, 10px);
}
</style>
