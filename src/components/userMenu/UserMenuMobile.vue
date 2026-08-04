<template>
  <div class="user-menu-mobile" @click="handleTouchClick">
    <slot name="avatar">
      <van-image round width="34px" height="34px" :src="userAvatar" :error-icon="defaultAvatar" />
    </slot>
    <div v-if="showOnlineStatus" class="online-indicator" :class="onlineClass" />

    <van-popup v-model:show="isOpen" position="bottom" round :style="{ height: 'auto', maxHeight: '70vh' }">
      <UserMenuHeader @theme-toggle="handleThemeToggle" />

      <template v-for="section in menuSections" :key="section.id">
        <div v-if="section.title" class="menu-section-title">{{ section.title }}</div>
        <div class="menu-items">
          <template v-for="item in section.items" :key="item.id">
            <div v-if="item.divider" class="menu-divider" />
            <van-cell
              v-else
              :title="item.label"
              :class="{
                'menu-item-danger': item.danger,
                'menu-item-disabled': item.disabled
              }"
              @click="handleItemClick(item.id)">
              <template #icon>
                <Icon :icon="getIconName(item.icon)" class="menu-icon" />
              </template>
            </van-cell>
          </template>
        </div>
      </template>

      <div class="menu-safe-area" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import defaultAvatarImg from '@/assets/img/win.png'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { useUserMenu } from './useUserMenu'

const logger = createLogger('UserMenuMobile')

defineOptions({
  name: 'UserMenuMobile'
})

const userStore = useUserStore()
const settingStore = useSettingStore()

const { isOpen, menuSections, handleMenuItemClick } = useUserMenu()

const userAvatar = computed(() => AvatarUtils.getAvatarUrl(userStore.currentUserAvatarUrl))
const defaultAvatar = computed(() => defaultAvatarImg)

const showOnlineStatus = computed(() => settingStore.themePattern !== 'os')

const onlineClass = computed(() => {
  return 'online'
})

const iconMap: Record<string, string> = {
  home: 'mdi:home',
  message: 'mdi:message-text-outline',
  lock: 'mdi:lock-outline',
  star: 'mdi:star-outline',
  user: 'mdi:account-outline',
  block: 'mdi:cancel',
  delete: 'mdi:delete-outline',
  qrcode: 'mdi:qrcode',
  bell: 'mdi:bell',
  shield: 'mdi:shield',
  settings: 'mdi:cog',
  device: 'mdi:devices',
  chat: 'mdi:chat',
  logout: 'mdi:logout'
}

function getIconName(iconName: string): string {
  return iconMap[iconName] || 'mdi:cog'
}

function handleItemClick(id: string) {
  handleMenuItemClick(id)
}

function handleThemeToggle() {
  logger.debug('Theme toggle')
}

function handleTouchClick() {
  const userMenuStore = useUserMenu()
  userMenuStore.openMenu({ x: 0, y: 0 }, 'touch')
}
</script>

<style scoped>
.user-menu-mobile {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--avatar-border-color);
}

.online-indicator.online {
  background-color: var(--tjg-status-online);
}

.online-indicator.offline {
  background-color: var(--tjg-status-offline);
}

.menu-divider {
  height: 1px;
  background-color: var(--tjg-border-default);
  margin: 8px 0;
}

.menu-section-title {
  padding: 8px 16px 4px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
  font-weight: 500;
}

.menu-items {
  padding: 0 8px;
}

.menu-icon {
  margin-right: 12px;
  font-size: 18px;
}

.menu-item-danger :deep(.van-cell__title) {
  color: var(--tjg-color-danger-500);
}

.menu-item-disabled {
  opacity: 0.5;
}

.menu-safe-area {
  height: env(safe-area-inset-bottom, 20px);
}
</style>
