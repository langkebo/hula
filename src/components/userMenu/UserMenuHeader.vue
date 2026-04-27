<template>
  <div class="user-menu-header">
    <div class="user-info">
      <div class="user-avatar" @click="handleAvatarClick">
        <slot name="avatar">
          <n-avatar round :size="48" :src="userAvatar" :fallback-src="defaultAvatar" />
        </slot>
        <div class="status-indicator" :class="statusClass" :style="statusStyle">
          <Icon :icon="statusIcon" :width="10" />
        </div>
      </div>
      <div class="user-details">
        <div class="user-name">{{ displayName }}</div>
        <div class="user-id">{{ userId }}</div>
      </div>
    </div>
    <div class="header-actions">
      <n-popover trigger="click" placement="bottom-end" :show-arrow="false">
        <template #trigger>
          <n-button quaternary circle size="small">
            <template #icon>
              <Icon :icon="statusIcon" :width="18" />
            </template>
          </n-button>
        </template>
        <div class="status-menu">
          <div class="status-menu-title">{{ t('menu.user_menu.status.title') }}</div>
          <div
            v-for="status in statusOptions"
            :key="status.id"
            class="status-option"
            :class="{ active: currentStatusId === status.id }"
            @click="handleStatusChange(status.id)">
            <Icon :icon="status.icon" :width="16" :style="{ color: status.color }" />
            <span>{{ status.label }}</span>
          </div>
        </div>
      </n-popover>
      <n-button quaternary circle size="small" @click="handleThemeToggle">
        <template #icon>
          <Icon :icon="themeIcon" :width="18" />
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NAvatar, NButton, NPopover, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { matrixAccountService } from '@/services/matrix'
import defaultAvatarImg from '@/assets/img/win.png'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('UserMenuHeader')

defineOptions({
  name: 'UserMenuHeader'
})

const emit = defineEmits<{
  (e: 'theme-toggle'): void
  (e: 'avatar-click'): void
}>()

const message = useMessage()
const { t } = useI18n()
const userStore = useUserStore()
const userStatusStore = useUserStatusStore()
const settingStore = useSettingStore()
const matrixStore = useMatrixStore()

const displayName = computed(() => userStore.currentUserDisplayName || 'User')
const userId = computed(() => matrixStore.userId || '')
const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
const defaultAvatar = computed(() => defaultAvatarImg)

const currentStatusId = ref(userStatusStore.stateId || 'online')

const statusOptions = computed(() => [
  { id: 'online', label: t('menu.user_menu.status.online'), icon: 'mdi:circle', color: 'var(--hula-status-online)' },
  { id: 'away', label: t('menu.user_menu.status.away'), icon: 'mdi:circle', color: 'var(--hula-status-away)' },
  { id: 'busy', label: t('menu.user_menu.status.busy'), icon: 'mdi:circle', color: 'var(--hula-status-busy)' },
  {
    id: 'offline',
    label: t('menu.user_menu.status.offline'),
    icon: 'mdi:circle-outline',
    color: 'var(--hula-status-offline)'
  }
])

const statusIcon = computed(() => {
  const status = statusOptions.value.find((s) => s.id === currentStatusId.value)
  return status?.icon || 'mdi:circle'
})

const statusClass = computed(() => {
  return `status-${currentStatusId.value}`
})

const statusStyle = computed(() => {
  const status = statusOptions.value.find((s) => s.id === currentStatusId.value)
  return {
    backgroundColor: status?.color || 'var(--hula-status-online)'
  }
})

const isDark = computed(() => {
  if (settingStore.themePattern === 'os') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return settingStore.themeContent === 'dark'
})

const themeIcon = computed(() => {
  return isDark.value ? 'mdi:white-balance-sunny' : 'mdi:moon-waning-crescent'
})

function handleThemeToggle() {
  const newTheme = isDark.value ? 'light' : 'dark'
  settingStore.toggleTheme(newTheme)
  emit('theme-toggle')
}

function handleAvatarClick() {
  emit('avatar-click')
}

async function handleStatusChange(statusId: string) {
  currentStatusId.value = statusId
  userStatusStore.stateId = statusId

  const presenceMap: Record<string, 'online' | 'offline' | 'unavailable'> = {
    online: 'online',
    away: 'unavailable',
    busy: 'unavailable',
    offline: 'offline'
  }

  try {
    await matrixAccountService.setPresence(presenceMap[statusId] || 'online')
    message.success(t('menu.user_menu.status.updated'))
  } catch (error) {
    logger.error('Failed to update user presence:', error)
  }
}
</script>

<style scoped>
.user-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.user-avatar {
  flex-shrink: 0;
  position: relative;
  cursor: pointer;
}

.status-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--avatar-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-details {
  margin-left: 12px;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-id {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.header-actions {
  flex-shrink: 0;
  margin-left: 8px;
  display: flex;
  gap: 4px;
}

.status-menu {
  padding: 8px 0;
  min-width: 120px;
}

.status-menu-title {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--hula-text-quaternary);
  margin-bottom: 4px;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.status-option:hover {
  background-color: var(--hula-surface-list-hover);
}

.status-option.active {
  background-color: var(--hula-color-info-100);
}
</style>
