<template>
  <div class="user-menu-desktop" ref="_menuRef">
    <div class="avatar-container" @click="handleLeftClick">
      <slot name="avatar">
        <n-avatar round :size="34" :src="userAvatar" :fallback-src="defaultAvatar" />
      </slot>
      <div v-if="showOnlineStatus" class="online-indicator" :class="onlineClass" />
    </div>

    <UserMenuDropdown
      v-if="isOpen"
      :position="position"
      :is-context-menu="isContextMenu"
      @close="closeMenu"
      @item-click="handleMenuItemClick" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar } from 'naive-ui'
import { useUserMenu } from './useUserMenu'
import { useUserStore } from '@/stores/user'
import { useSettingStore } from '@/stores/setting'
import UserMenuDropdown from './UserMenuDropdown.vue'
import defaultAvatarImg from '@/assets/img/win.png'

defineOptions({
  name: 'UserMenuDesktop'
})

const userStore = useUserStore()
const settingStore = useSettingStore()

const { isOpen, position, isContextMenu, closeMenu, handleMenuItemClick, handleLeftClick } = useUserMenu()

const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
const defaultAvatar = computed(() => defaultAvatarImg)

const showOnlineStatus = computed(() => settingStore.themes.pattern !== 'os')

const onlineClass = computed(() => {
  return 'online'
})
</script>

<style scoped>
.user-menu-desktop {
  position: relative;
  display: flex;
  align-items: center;
}

.avatar-container {
  position: relative;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.avatar-container:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:deep(.dark) .avatar-container:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-color, #fff);
}

.online-indicator.online {
  background-color: #52c41a;
}

.online-indicator.offline {
  background-color: #8c8c8c;
}

.online-indicator.busy {
  background-color: #faad14;
}

.online-indicator.away {
  background-color: #1890ff;
}
</style>
