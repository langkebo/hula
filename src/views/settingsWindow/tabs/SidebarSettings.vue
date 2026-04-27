<template>
  <div class="sidebar-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sidebar.layout') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_avatar') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_avatar_desc') }}</span>
        </div>
        <n-switch v-model:value="showAvatar" @update:value="handleLayoutToggle('showAvatar')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_collapsed') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_collapsed_desc') }}</span>
        </div>
        <n-switch v-model:value="showCollapsed" @update:value="handleLayoutToggle('showCollapsed')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_drag') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_drag_desc') }}</span>
        </div>
        <n-switch v-model:value="showDrag" @update:value="handleLayoutToggle('showDrag')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_icons_only') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_icons_only_desc') }}</span>
        </div>
        <n-switch v-model:value="showIconsOnly" @update:value="handleLayoutToggle('showIconsOnly')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sidebar.display_content') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_spaces') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_spaces_desc') }}</span>
        </div>
        <n-switch v-model:value="showSpaces" @update:value="handleToggle('showSpaces')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_rooms') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_rooms_desc') }}</span>
        </div>
        <n-switch v-model:value="showRooms" @update:value="handleToggle('showRooms')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_direct_messages') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_direct_messages_desc') }}</span>
        </div>
        <n-switch v-model:value="showDirectMessages" @update:value="handleToggle('showDirectMessages')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_friends') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_friends_desc') }}</span>
        </div>
        <n-switch v-model:value="showFriends" @update:value="handleToggle('showFriends')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.show_threads') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.show_threads_desc') }}</span>
        </div>
        <n-switch v-model:value="showThreads" @update:value="handleToggle('showThreads')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sidebar.sort_by') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.room_sort') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.room_sort_desc') }}</span>
        </div>
        <n-select v-model:value="sortBy" :options="sortOptions" style="width: 150px" @update:value="handleSortChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.sidebar.list_item_size') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.sidebar.list_item_size') }}</span>
          <span class="setting-desc">{{ t('setting.sidebar.list_item_size_desc') }}</span>
        </div>
        <n-select
          v-model:value="itemSize"
          :options="itemSizeOptions"
          style="width: 120px"
          @update:value="handleItemSizeChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSwitch, NDivider, NSelect, useMessage } from 'naive-ui'

defineOptions({
  name: 'SidebarSettings'
})

const message = useMessage()
const { t } = useI18n()

const STORAGE_KEY = 'hula-sidebar-settings'

const showSpaces = ref(true)
const showRooms = ref(true)
const showDirectMessages = ref(true)
const showFriends = ref(true)
const showThreads = ref(true)
const showAvatar = ref(true)
const showCollapsed = ref(true)
const showDrag = ref(true)
const showIconsOnly = ref(false)
const sortBy = ref('activity')
const itemSize = ref('medium')

const sortOptions = computed(() => [
  { label: t('setting.sidebar.sort_options.recent'), value: 'activity' },
  { label: t('setting.sidebar.sort_options.alphabetical'), value: 'alphabetical' },
  { label: t('setting.sidebar.sort_options.manual'), value: 'manual' }
])

const itemSizeOptions = computed(() => [
  { label: t('setting.sidebar.size_small'), value: 'small' },
  { label: t('setting.sidebar.size_medium'), value: 'medium' },
  { label: t('setting.sidebar.size_large'), value: 'large' }
])

onMounted(() => {
  loadSettings()
})

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const settings = JSON.parse(saved)
      if (settings.showSpaces !== undefined) showSpaces.value = settings.showSpaces
      if (settings.showRooms !== undefined) showRooms.value = settings.showRooms
      if (settings.showDirectMessages !== undefined) showDirectMessages.value = settings.showDirectMessages
      if (settings.showFriends !== undefined) showFriends.value = settings.showFriends
      if (settings.showThreads !== undefined) showThreads.value = settings.showThreads
      if (settings.showAvatar !== undefined) showAvatar.value = settings.showAvatar
      if (settings.showCollapsed !== undefined) showCollapsed.value = settings.showCollapsed
      if (settings.showDrag !== undefined) showDrag.value = settings.showDrag
      if (settings.showIconsOnly !== undefined) showIconsOnly.value = settings.showIconsOnly
      if (settings.sortBy) sortBy.value = settings.sortBy
      if (settings.itemSize) itemSize.value = settings.itemSize
    } catch {
      // ignore parse errors
    }
  }
}

function saveSettings() {
  const settings = {
    showSpaces: showSpaces.value,
    showRooms: showRooms.value,
    showDirectMessages: showDirectMessages.value,
    showFriends: showFriends.value,
    showThreads: showThreads.value,
    showAvatar: showAvatar.value,
    showCollapsed: showCollapsed.value,
    showDrag: showDrag.value,
    showIconsOnly: showIconsOnly.value,
    sortBy: sortBy.value,
    itemSize: itemSize.value
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function handleToggle(key: string) {
  saveSettings()
  const labelMap: Record<string, string> = {
    showSpaces: t('setting.sidebar.show_spaces_short'),
    showRooms: t('setting.sidebar.show_rooms_short'),
    showDirectMessages: t('setting.sidebar.show_direct_messages_short'),
    showFriends: t('setting.sidebar.show_friends_short'),
    showThreads: t('setting.sidebar.show_threads_short')
  }
  const label = labelMap[key] || key
  const stateMap: Record<string, boolean> = {
    showSpaces: showSpaces.value,
    showRooms: showRooms.value,
    showDirectMessages: showDirectMessages.value,
    showFriends: showFriends.value,
    showThreads: showThreads.value
  }
  message.success(
    stateMap[key] ? t('setting.sidebar.feedback.shown', { label }) : t('setting.sidebar.feedback.hidden', { label })
  )
}

function handleLayoutToggle(key: string) {
  saveSettings()
  const labelMap: Record<string, string> = {
    showAvatar: t('setting.sidebar.show_avatar_short'),
    showCollapsed: t('setting.sidebar.show_collapsed_short'),
    showDrag: t('setting.sidebar.show_drag_short'),
    showIconsOnly: t('setting.sidebar.show_icons_only_short')
  }
  const label = labelMap[key] || key
  const stateMap: Record<string, boolean> = {
    showAvatar: showAvatar.value,
    showCollapsed: showCollapsed.value,
    showDrag: showDrag.value,
    showIconsOnly: showIconsOnly.value
  }
  message.success(
    stateMap[key] ? t('setting.sidebar.feedback.enabled', { label }) : t('setting.sidebar.feedback.disabled', { label })
  )
}

function handleSortChange(value: string) {
  sortBy.value = value
  saveSettings()
  message.success(
    t('setting.sidebar.feedback.sort_changed', {
      label: sortOptions.value.find((o) => o.value === value)?.label || value
    })
  )
}

function handleItemSizeChange(value: string) {
  itemSize.value = value
  saveSettings()
  message.success(
    t('setting.sidebar.feedback.size_changed', {
      label: itemSizeOptions.value.find((o) => o.value === value)?.label || value
    })
  )
}
</script>

<style scoped>
.sidebar-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}
</style>
