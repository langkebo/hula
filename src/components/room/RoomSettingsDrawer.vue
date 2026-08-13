<template>
  <Teleport to="body">
    <Transition name="rs-drawer-fade">
      <div
        v-if="roomId"
        class="rs-drawer-overlay"
        data-testid="room-settings-drawer-overlay"
        @click.self="handleClose"
        @keydown.esc="handleClose">
        <Transition name="rs-drawer-slide" appear>
          <aside
            v-if="roomId"
            class="rs-drawer"
            role="dialog"
            aria-modal="true"
            :aria-label="t('room.settings_drawer.title')"
            data-testid="room-settings-drawer">
            <!-- 头部 -->
            <header class="rs-drawer__header">
              <span class="rs-drawer__title">{{ t('room.settings_drawer.title') }}</span>
              <button type="button" class="rs-drawer__close" :aria-label="t('common.close')" @click="handleClose">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </header>

            <!-- Tab 导航栏 -->
            <nav class="rs-drawer__tabs" role="tablist">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                role="tab"
                :aria-selected="activeTab === tab.key"
                :class="['rs-drawer__tab', { 'rs-drawer__tab--active': activeTab === tab.key }]"
                @click="activeTab = tab.key">
                {{ t(tab.label) }}
              </button>
            </nav>

            <!-- Tab 内容 -->
            <div class="rs-drawer__body">
              <div v-if="tabError" class="rs-tab__error" data-testid="tab-error">
                <p class="rs-tab__error-title">{{ t('room.settings_drawer.saved_failed') }}</p>
                <p class="rs-tab__error-detail">{{ tabError }}</p>
                <button type="button" class="rs-tab__error-retry" @click="retryTab">
                  {{ t('common.retry') }}
                </button>
              </div>
              <component
                v-else-if="roomId"
                :is="activeTabComponent"
                :key="activeTab"
                :room-id="roomId"
                @close="handleClose" />
            </div>
          </aside>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AdvancedTab from '@/components/room/settings-tabs/AdvancedTab.vue'
import AliasTab from '@/components/room/settings-tabs/AliasTab.vue'
import BasicTab from '@/components/room/settings-tabs/BasicTab.vue'
import HistoryTab from '@/components/room/settings-tabs/HistoryTab.vue'
import MembersTab from '@/components/room/settings-tabs/MembersTab.vue'
import NotificationsTab from '@/components/room/settings-tabs/NotificationsTab.vue'
import PermissionsTab from '@/components/room/settings-tabs/PermissionsTab.vue'
import RetentionTab from '@/components/room/settings-tabs/RetentionTab.vue'
import SecurityTab from '@/components/room/settings-tabs/SecurityTab.vue'
import StickyTab from '@/components/room/settings-tabs/StickyTab.vue'
import TagsTab from '@/components/room/settings-tabs/TagsTab.vue'
import { createLogger } from '@/utils/Logger'

type TabKey =
  | 'basic'
  | 'members'
  | 'permissions'
  | 'security'
  | 'notifications'
  | 'alias'
  | 'history'
  | 'retention'
  | 'tags'
  | 'sticky'
  | 'advanced'

interface TabDef {
  key: TabKey
  label: string
  component: Component
}

const props = defineProps<{
  roomId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const logger = createLogger('RoomSettingsDrawer')

const tabs: TabDef[] = [
  { key: 'basic', label: 'room.settings_drawer.tab_basic', component: BasicTab },
  { key: 'members', label: 'room.settings_drawer.tab_members', component: MembersTab },
  { key: 'permissions', label: 'room.settings_drawer.tab_permissions', component: PermissionsTab },
  { key: 'security', label: 'room.settings_drawer.tab_security', component: SecurityTab },
  { key: 'notifications', label: 'room.settings_drawer.tab_notifications', component: NotificationsTab },
  { key: 'alias', label: 'room.settings_drawer.tab_alias', component: AliasTab },
  { key: 'history', label: 'room.settings_drawer.tab_history', component: HistoryTab },
  { key: 'retention', label: 'room.settings_drawer.tab_retention', component: RetentionTab },
  { key: 'tags', label: 'room.settings_drawer.tab_tags', component: TagsTab },
  { key: 'sticky', label: 'room.settings_drawer.tab_sticky', component: StickyTab },
  { key: 'advanced', label: 'room.settings_drawer.tab_advanced', component: AdvancedTab }
]

const activeTab = ref<TabKey>('basic')
const tabError = ref('')

const activeTabComponent = computed(() => {
  return tabs.find((tab) => tab.key === activeTab.value)?.component ?? BasicTab
})

const handleClose = () => {
  emit('close')
}

const retryTab = () => {
  tabError.value = ''
}

onErrorCaptured((err) => {
  logger.error('[RoomSettingsDrawer] Tab render error', {
    activeTab: activeTab.value,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined
  })
  tabError.value = err instanceof Error ? err.message : String(err)
  return false
})

watch(
  () => props.roomId,
  (newRoomId) => {
    if (newRoomId) {
      activeTab.value = 'basic'
    }
  }
)

onMounted(() => {
  // Tab 渲染诊断日志已移除：生产构建由 esbuild drop 剔除 console，
  // 错误边界仍通过 logger.error 记录。
})
</script>

<style scoped lang="scss">
.rs-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 1001;
  background: var(--tjg-overlay-mask-default);
  display: flex;
  justify-content: flex-end;
}

.rs-drawer {
  width: 520px;
  max-width: 90vw;
  height: 100%;
  background: var(--tjg-surface-panel);
  border-left: 1px solid var(--tjg-border-default);
  box-shadow: var(--tjg-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rs-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--tjg-border-muted);
  flex-shrink: 0;
}

.rs-drawer__title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.rs-drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }
}

.rs-drawer__tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--tjg-border-muted);
  overflow-x: auto;
  background: var(--tjg-surface-app);
  flex-shrink: 0;
}

.rs-drawer__tab {
  padding: 7px 12px;
  border: none;
  border-radius: var(--tjg-radius-sm) var(--tjg-radius-sm) 0 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  background: transparent;
  transition: all var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-text-primary);
    background: var(--tjg-surface-list-hover);
  }

  &--active {
    color: var(--tjg-color-primary-500);
    border-bottom-color: var(--tjg-color-primary-500);
    background: var(--tjg-surface-list-hover);
  }
}

.rs-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.rs-tab__error {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--tjg-surface-app);
  border-radius: var(--tjg-radius-sm);
  border: 1px solid var(--tjg-status-error);
}

.rs-tab__error-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-status-error);
  margin: 0;
}

.rs-tab__error-detail {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
  margin: 0;
  word-break: break-word;
}

.rs-tab__error-retry {
  align-self: flex-start;
  padding: 4px 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-sm);
  cursor: pointer;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.rs-drawer-fade-enter-active,
.rs-drawer-fade-leave-active {
  transition: opacity var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

.rs-drawer-fade-enter-from,
.rs-drawer-fade-leave-to {
  opacity: 0;
}

.rs-drawer-slide-enter-active,
.rs-drawer-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.rs-drawer-slide-enter-from,
.rs-drawer-slide-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .rs-drawer-fade-enter-active,
  .rs-drawer-fade-leave-active,
  .rs-drawer-slide-enter-active,
  .rs-drawer-slide-leave-active {
    transition: none;
  }
}
</style>
