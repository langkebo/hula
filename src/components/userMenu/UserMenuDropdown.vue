<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="menu-overlay" @click="handleOverlayClick" @contextmenu.prevent>
        <Transition name="slide">
          <div v-if="visible" class="user-menu-dropdown" :style="menuStyle" @click.stop>
            <UserMenuHeader @theme-toggle="$emit('theme-toggle')" />

            <template v-for="section in menuSections" :key="section.id">
              <div v-if="section.title" class="menu-section-title">{{ section.title }}</div>
              <div class="menu-items">
                <template v-for="item in section.items" :key="item.id">
                  <div v-if="item.divider" class="menu-divider" />
                  <div
                    v-else
                    class="menu-item"
                    :class="{
                      'menu-item-danger': item.danger,
                      'menu-item-disabled': item.disabled
                    }"
                    @click="handleItemClick(item.id)">
                    <span class="menu-item-icon">
                      <Icon :icon="getIcon(item.icon)" :width="18" />
                    </span>
                    <span class="menu-item-label">{{ item.label }}</span>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { MenuPosition } from '@/stores/domains/user/userMenu'
import UserMenuHeader from './UserMenuHeader.vue'
import { useUserMenu } from './useUserMenu'

defineOptions({
  name: 'UserMenuDropdown'
})

interface Props {
  position: MenuPosition | null
  isContextMenu?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isContextMenu: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'item-click', id: string): void
  (e: 'theme-toggle'): void
}>()

const visible = ref(false)

const { menuSections } = useUserMenu()

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

function getIcon(iconName: string): string {
  return iconMap[iconName] || 'mdi:cog'
}

const menuStyle = computed(() => {
  if (!props.position) return {}

  const { x, y } = props.position
  const menuWidth = 240
  const menuHeight = 400

  let left = x
  let top = y

  if (x + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 16
  }

  if (y + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 16
  }

  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

function handleOverlayClick() {
  emit('close')
}

function handleItemClick(id: string) {
  emit('item-click', id)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

watch(
  () => props.position,
  (newVal) => {
    if (newVal) {
      visible.value = true
    }
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background-color: transparent;
}

.user-menu-dropdown {
  position: absolute;
  width: 240px;
  background-color: var(--bg-color, #fff);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

:deep(.dark) .user-menu-dropdown {
  background-color: var(--hula-surface-app);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.menu-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.06);
  margin: 4px 0;
}

:deep(.dark) .menu-divider {
  background-color: rgba(255, 255, 255, 0.1);
}

.menu-section-title {
  padding: 8px 16px 4px;
  font-size: 12px;
  color: var(--text-secondary, #999);
  font-weight: 500;
}

.menu-items {
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.menu-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:deep(.dark) .menu-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.menu-item-danger {
  color: var(--hula-color-danger-500);
}

.menu-item-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  margin-right: 12px;
}

.menu-item-label {
  font-size: 14px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
