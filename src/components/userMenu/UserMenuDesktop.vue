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
import { useUserStore } from '@/stores/domains/user/user'
import { useSettingStore } from '@/stores/domains/settings/setting'
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

const showOnlineStatus = computed(() => settingStore.themePattern !== 'os')

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
  background-color: var(--bg-msg-hover);
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--avatar-border-color);
}

.online-indicator.online {
  background-color: var(--hula-status-online);
}

.online-indicator.offline {
  background-color: var(--hula-status-offline);
}

.online-indicator.busy {
  background-color: var(--hula-status-busy);
}

.online-indicator.away {
  background-color: var(--hula-status-away);
}
</style>
