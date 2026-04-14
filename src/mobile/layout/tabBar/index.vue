<template>
  <n-divider class="p-0! m-0!" />
  <div class="tab-bar flex justify-around items-end pt-3">
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="tab-item flex flex-col flex-1 items-center no-underline relative"
      :class="route.path === item.path ? 'color-[--tab-bar-icon-color]' : 'text-#000 dark:text-white/80'">
      <n-badge
        class="flex flex-col w-55% flex-1 relative items-center"
        :offset="[-6, 6]"
        color="#c14053"
        :value="getUnReadCount(item.label)"
        :max="99">
        <svg class="w-22px h-22px">
          <use :href="`#${route.path === item.path ? item.actionIcon : item.icon}`"></use>
        </svg>
        <span class="text-xs mt-1">{{ item.label }}</span>
      </n-badge>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { useGlobalStore } from '@/stores/global'
import { useI18n } from 'vue-i18n'

type NavItem = {
  label: string
  path: string
  icon: string
  actionIcon: string
}

const { t } = useI18n()
const route = useRoute()
const globalStore = useGlobalStore()

const getUnReadCount = (label: string) => {
  if (label === t('mobile_tabbar.items.messages')) {
    return globalStore.unReadMark.newMsgUnreadCount
  }
  if (label === t('mobile_tabbar.items.contacts')) {
    return globalStore.unReadMark.newFriendUnreadCount + globalStore.unReadMark.newGroupUnreadCount
  }
  if (label === t('mobile_tabbar.items.rooms')) {
    return globalStore.unReadMark.newMsgUnreadCount
  }
  return 0
}

const navItems: NavItem[] = [
  {
    label: t('mobile_tabbar.items.messages'),
    path: '/mobile/message',
    icon: 'message',
    actionIcon: 'message-action'
  },
  {
    label: t('mobile_tabbar.items.rooms'),
    path: '/mobile/rooms',
    icon: 'chat',
    actionIcon: 'chat-action'
  },
  {
    label: t('mobile_tabbar.items.contacts'),
    path: '/mobile/friends',
    icon: 'avatar',
    actionIcon: 'avatar-action'
  },
  {
    label: t('mobile_tabbar.items.me'),
    path: '/mobile/my',
    icon: 'wode',
    actionIcon: 'wode-action'
  }
]
</script>

<style scoped lang="scss">
.tab-bar {
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
</style>
