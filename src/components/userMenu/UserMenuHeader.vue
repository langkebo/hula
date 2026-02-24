<template>
  <div class="user-menu-header">
    <div class="user-info">
      <div class="user-avatar">
        <slot name="avatar">
          <n-avatar
            round
            :size="48"
            :src="userAvatar"
            :fallback-src="defaultAvatar"
          />
        </slot>
      </div>
      <div class="user-details">
        <div class="user-name">{{ displayName }}</div>
        <div class="user-id">{{ userId }}</div>
      </div>
    </div>
    <div class="header-actions">
      <n-button
        quaternary
        circle
        size="small"
        @click="handleThemeToggle"
      >
        <template #icon>
          <Icon :icon="themeIcon" :width="18" />
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NButton } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useUserStore } from '@/stores/user'
import { useSettingStore } from '@/stores/setting'
import { useMatrixStore } from '@/stores/matrix'
import defaultAvatarImg from '@/assets/img/win.png'

defineOptions({
  name: 'UserMenuHeader'
})

const emit = defineEmits<{
  (e: 'theme-toggle'): void
}>()

const userStore = useUserStore()
const settingStore = useSettingStore()
const matrixStore = useMatrixStore()

const displayName = computed(() => userStore.currentUserDisplayName || 'User')
const userId = computed(() => matrixStore.userId || '')
const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
const defaultAvatar = computed(() => defaultAvatarImg)

const isDark = computed(() => {
  if (settingStore.themes.pattern === 'os') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return settingStore.themes.content === 'dark'
})

const themeIcon = computed(() => {
  return isDark.value ? 'mdi:white-balance-sunny' : 'mdi:moon-waning-crescent'
})

function handleThemeToggle() {
  const newTheme = isDark.value ? 'light' : 'dark'
  settingStore.toggleTheme(newTheme)
  emit('theme-toggle')
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
}

.user-details {
  margin-left: 12px;
  min-width: 0;
}

.user-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.dark) .user-name {
  color: #fff;
}

.user-id {
  font-size: 12px;
  color: var(--text-color-3, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.header-actions {
  flex-shrink: 0;
  margin-left: 8px;
}
</style>
