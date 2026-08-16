<template>
  <div class="tab-bar-wrap" :class="{ 'tab-bar-wrap--vertical': vertical }">
    <div v-if="!vertical" class="h-1px bg-[--tjg-border-layout-divider]"></div>
    <div v-else class="w-1px h-full bg-[--tjg-border-layout-divider]"></div>
    <nav
      class="tab-bar flex items-end"
      :class="vertical ? 'flex-col justify-around' : 'justify-around'"
      aria-label="移动端主导航">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        :data-testid="item.testId"
        :aria-label="item.label"
        :aria-current="route.path === item.path ? 'page' : undefined"
        class="tab-item flex flex-col items-center no-underline relative min-h-48px justify-center"
        :class="[
          vertical ? 'w-full' : 'flex-1',
          route.path === item.path ? 'color-[--tjg-color-primary-500]' : 'text-[--tjg-text-tertiary]'
        ]"
        @click="handleNavigate(item.path)">
        <van-badge
          class="flex flex-col w-full flex-1 relative items-center justify-center"
          :offset="[-6, 6]"
          color="var(--tjg-color-danger-500)"
          :content="getUnReadCount(item.label) || ''"
          :max="99">
          <svg class="w-26px h-26px">
            <use :href="`#${route.path === item.path ? item.actionIcon : item.icon}`"></use>
          </svg>
          <span class="text-11px mt-0.5">{{ item.label }}</span>
        </van-badge>
      </RouterLink>
    </nav>
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

const props = withDefaults(
  defineProps<{
    /** 横屏时启用垂直布局（侧边栏模式） */
    vertical?: boolean
  }>(),
  { vertical: false }
)

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
  if (path === '/mobile/space') {
    startRenderSample('mobile-space-view', {
      route: path,
      meta: { source: 'tab-bar' }
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
    label: t('mobile_tabbar.items.rooms'),
    path: '/mobile/rooms',
    icon: 'room',
    actionIcon: 'room-action',
    testId: 'mobile-tab-rooms'
  },
  {
    label: t('mobile_tabbar.items.spaces'),
    path: '/mobile/space',
    icon: 'space',
    actionIcon: 'space',
    testId: 'mobile-tab-space'
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
  background: var(--tjg-surface-panel);
}

.tab-bar {
  height: 62px;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.tab-item {
  gap: 2px;
  font-size: 11px;
  padding-bottom: var(--safe-area-inset-bottom, 10px);
  /* 触摸热区 >= 48x48px，配合 min-h-48px 确保可点击区域 */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* 横屏垂直布局（侧边栏模式） */
.tab-bar-wrap--vertical {
  width: 72px;
  height: 100%;
  display: flex;
  flex-direction: row;

  .tab-bar {
    height: 100%;
    width: 100%;
    flex-direction: column !important;
  }

  .tab-item {
    padding-bottom: 0;
    padding-top: var(--safe-area-inset-top, 0);
  }
}
</style>
